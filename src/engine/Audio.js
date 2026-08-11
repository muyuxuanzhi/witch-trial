// 音频管理器：BGM 循环播放（菜单/关卡自动切换）+ 音效叠放播放 + 静音开关（记忆到本地存档）
//
// 说明：改用 Web Audio API（AudioContext + AudioBufferSourceNode）而不是原生
// <audio> 元素实现。原因：
// 1. 旧实现每次 play() 都会 new Audio()/cloneNode() 生成一个新的 <audio> 元素，
//    这些元素播放结束后并不会被立刻回收，且部分浏览器（尤其移动端 WebKit）对同时
//    存在的 <audio> 元素数量有硬性上限——一旦点击音效连续触发导致元素堆积超限，
//    浏览器会“抢占”/静音其中的一路播放，正在循环的 BGM 就可能被顶掉，
//    表现为“点击之后 BGM 突然卡顿或没声音”。
// 2. Web Audio 里所有声音都在同一个 AudioContext 里混音输出，不受“并发音频元素数”
//    限制，AudioBufferSourceNode 是一次性轻量对象，播放结束(onended)后自动可回收，
//    不会累积。
// 3. 可以给 BGM 和每种音效分别接一个 GainNode，独立、精确地控制音量，
//    解决“音效被 BGM 盖住听不见”的问题（之前所有音效共用同一个音量倍数，
//    但各段素材原始响度不同，导致有的音效相对 BGM 音量偏小）。
const BASE = "assets/audio/";

const SFX_FILES = {
  collectStar: "sfx_collect_star.mp3",
  collectPotion: "sfx_collect_potion.mp3",
  rareStar: "sfx_rarestar.mp3",
  hit: "sfx_hit.mp3",
  death: "sfx_death.mp3",
  click: "sfx_click.mp3",
};

// 各音效相对增益微调：原始素材响度不完全一致（click 天生比较“冲耳”，
// 其余几个偏弱），这里单独放大后几个，让它们在 BGM 播放时也能被听清。
const SFX_GAIN = {
  collectStar: 1.5,
  collectPotion: 1.5,
  rareStar: 1.6,
  hit: 1.7,
  death: 1.7,
  click: 1.0,
};

const BGM_FILES = {
  menu: "bgm_menu.mp3",
  run: "bgm_run.mp3",
};

const MUTE_KEY = "witchTrial_audioMuted";

class AudioManager {
  constructor() {
    this.muted = (() => {
      try { return localStorage.getItem(MUTE_KEY) === "1"; } catch (e) { return false; }
    })();
    this.sfxVol = 0.85;
    this.bgmVol = 0.32;

    this.ctx = null;
    this._masterGain = null;
    this._sfxBus = null;
    this._bgmBus = null;

    this._buffers = {};          // url -> 已解码的 AudioBuffer（BGM/SFX 共用缓存，只解码一次）
    this._loadPromises = {};     // url -> 解码中的 Promise，避免重复请求
    this._bgmSource = null;      // 当前播放中的 BGM 节点
    this._curBgmId = null;       // 当前已经在播的 BGM id
    this._wantedBgmId = null;    // 期望播放的 BGM id（用于处理"加载中又切换"的竟态）
    this._pendingBgm = null;     // 解锁前排队等待播放的 BGM id

    this._unlocked = false;      // 浏览器要求一次用户交互后才允许真正出声

    // 提前建好 AudioContext 并预解码所有素材：不需要用户交互也能 fetch+decode，
    // 真正需要用户手势的只是"resume 播放"，这样首次播放时不会有加载卡顿。
    this._ensureCtx();
    this._preloadAll();

    const unlock = () => this._unlock();
    window.addEventListener("pointerdown", unlock, { once: true });
    window.addEventListener("keydown", unlock, { once: true });
    window.addEventListener("touchstart", unlock, { once: true, passive: true });
  }

  _ensureCtx() {
    if (this.ctx) return this.ctx;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    this.ctx = new AC();
    this._masterGain = this.ctx.createGain();
    this._masterGain.connect(this.ctx.destination);
    this._sfxBus = this.ctx.createGain();
    this._sfxBus.gain.value = this.muted ? 0 : this.sfxVol;
    this._sfxBus.connect(this._masterGain);
    this._bgmBus = this.ctx.createGain();
    this._bgmBus.gain.value = this.muted ? 0 : this.bgmVol;
    this._bgmBus.connect(this._masterGain);
    return this.ctx;
  }

  _preloadAll() {
    const urls = [
      ...Object.values(SFX_FILES),
      ...Object.values(BGM_FILES),
    ].map((f) => BASE + f);
    for (const url of urls) this._loadBuffer(url).catch(() => {});
  }

  _loadBuffer(url) {
    if (this._buffers[url]) return Promise.resolve(this._buffers[url]);
    if (this._loadPromises[url]) return this._loadPromises[url];
    const ctx = this._ensureCtx();
    if (!ctx) return Promise.reject(new Error("no AudioContext"));
    const p = fetch(url)
      .then((r) => r.arrayBuffer())
      .then((ab) => ctx.decodeAudioData(ab))
      .then((buf) => {
        this._buffers[url] = buf;
        delete this._loadPromises[url];
        return buf;
      })
      .catch((e) => {
        delete this._loadPromises[url];
        throw e;
      });
    this._loadPromises[url] = p;
    return p;
  }

  async _unlock() {
    if (this._unlocked) return;
    this._unlocked = true;
    const ctx = this._ensureCtx();
    if (ctx && ctx.state === "suspended") {
      try { await ctx.resume(); } catch (e) { /* 忽略 */ }
    }
    if (this._pendingBgm) {
      const id = this._pendingBgm;
      this._pendingBgm = null;
      this.playBgm(id);
    }
  }

  // 播放一次性音效，可重叠播放（如连续拾取）；用完自动释放，不会累积节点。
  play(id) {
    if (this.muted) return;
    const file = SFX_FILES[id];
    if (!file) return;
    const ctx = this._ensureCtx();
    if (!ctx) return;
    const url = BASE + file;
    this._loadBuffer(url)
      .then((buf) => {
        if (this.muted) return;
        const src = ctx.createBufferSource();
        src.buffer = buf;
        const gain = ctx.createGain();
        gain.gain.value = SFX_GAIN[id] != null ? SFX_GAIN[id] : 1;
        src.connect(gain);
        gain.connect(this._sfxBus);
        src.onended = () => {
          try { src.disconnect(); gain.disconnect(); } catch (e) { /* 忽略 */ }
        };
        src.start(0);
      })
      .catch(() => { /* 加载失败时静默跳过，不影响游戏 */ });
  }

  // 播放/切换循环 BGM；同一首正在播放（或正在加载）时不重复触发。
  playBgm(id) {
    if (!BGM_FILES[id]) return;
    if (!this._unlocked) {
      this._pendingBgm = id;
      this._wantedBgmId = id;
      return;
    }
    if (this._wantedBgmId === id) return;
    this._wantedBgmId = id;
    const ctx = this._ensureCtx();
    if (!ctx) return;
    const url = BASE + BGM_FILES[id];
    this._loadBuffer(url)
      .then((buf) => {
        // 加载完成前目标又被切换了（比如快速连续换场景），放弃这次，避免叠放两路 BGM
        if (this._wantedBgmId !== id) return;
        this._stopBgmSource();
        const src = ctx.createBufferSource();
        src.buffer = buf;
        src.loop = true;
        src.connect(this._bgmBus);
        src.start(0);
        this._bgmSource = src;
        this._curBgmId = id;
      })
      .catch(() => { /* 忽略加载失败 */ });
  }

  _stopBgmSource() {
    if (this._bgmSource) {
      try { this._bgmSource.stop(); this._bgmSource.disconnect(); } catch (e) { /* 忽略 */ }
      this._bgmSource = null;
    }
    this._curBgmId = null;
  }

  stopBgm() {
    this._stopBgmSource();
    this._wantedBgmId = null;
    this._pendingBgm = null;
  }

  setMuted(m) {
    this.muted = !!m;
    try { localStorage.setItem(MUTE_KEY, this.muted ? "1" : "0"); } catch (e) { /* 忽略存储失败 */ }
    if (this._bgmBus) this._bgmBus.gain.value = this.muted ? 0 : this.bgmVol;
    if (this._sfxBus) this._sfxBus.gain.value = this.muted ? 0 : this.sfxVol;
  }

  toggleMute() {
    this.setMuted(!this.muted);
    return this.muted;
  }
}

// 全局单例：各场景直接 import { audio } 使用
export const audio = new AudioManager();
