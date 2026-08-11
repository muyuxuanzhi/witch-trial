// 音频管理器：BGM 循环播放（菜单/关卡自动切换）+ 音效叠放播放 + 静音开关（记忆到本地存档）
// 使用原生 HTMLAudioElement 实现，无需额外依赖；SFX 通过 cloneNode 支持同一音效快速重叠播放。
const BASE = "assets/audio/";

const SFX_FILES = {
  collectStar: "sfx_collect_star.mp3",
  collectPotion: "sfx_collect_potion.mp3",
  rareStar: "sfx_rarestar.mp3",
  hit: "sfx_hit.mp3",
  death: "sfx_death.mp3",
  click: "sfx_click.mp3",
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
    this.sfxVol = 0.7;
    this.bgmVol = 0.45;
    this._sfxCache = {};   // id -> 预加载的模板 <audio>，播放时 clone
    this._bgmEl = null;    // 当前 bgm 的 <audio>
    this._curBgmId = null;
    this._unlocked = false;  // 浏览器要求一次用户交互后才允许真正出声
    this._pendingBgm = null;

    const unlock = () => {
      if (this._unlocked) return;
      this._unlocked = true;
      if (this._pendingBgm) {
        const id = this._pendingBgm;
        this._pendingBgm = null;
        this.playBgm(id);
      }
    };
    window.addEventListener("pointerdown", unlock, { once: true });
    window.addEventListener("keydown", unlock, { once: true });
    window.addEventListener("touchstart", unlock, { once: true, passive: true });
  }

  _getSfxTemplate(id) {
    const file = SFX_FILES[id];
    if (!file) return null;
    if (!this._sfxCache[id]) {
      const a = new Audio(BASE + file);
      a.preload = "auto";
      this._sfxCache[id] = a;
    }
    return this._sfxCache[id];
  }

  // 播放一次性音效，可重叠播放（如连续拾取）
  play(id) {
    if (this.muted) return;
    const tpl = this._getSfxTemplate(id);
    if (!tpl) return;
    try {
      const node = tpl.cloneNode(true);
      node.volume = this.sfxVol;
      const p = node.play();
      if (p && p.catch) p.catch(() => {});
    } catch (e) { /* 忽略播放失败（如未解锁音频上下文） */ }
  }

  // 播放/切换循环 BGM；同一首正在播放时不重启
  playBgm(id) {
    if (!BGM_FILES[id]) return;
    if (!this._unlocked) { this._pendingBgm = id; return; }
    if (this._curBgmId === id && this._bgmEl && !this._bgmEl.paused) return;
    if (this._bgmEl) {
      this._bgmEl.pause();
      this._bgmEl = null;
    }
    const el = new Audio(BASE + BGM_FILES[id]);
    el.loop = true;
    el.volume = this.muted ? 0 : this.bgmVol;
    const p = el.play();
    if (p && p.catch) p.catch(() => {});
    this._bgmEl = el;
    this._curBgmId = id;
  }

  stopBgm() {
    if (this._bgmEl) {
      this._bgmEl.pause();
      this._bgmEl = null;
    }
    this._curBgmId = null;
    this._pendingBgm = null;
  }

  setMuted(m) {
    this.muted = !!m;
    try { localStorage.setItem(MUTE_KEY, this.muted ? "1" : "0"); } catch (e) { /* 忽略存储失败 */ }
    if (this._bgmEl) this._bgmEl.volume = this.muted ? 0 : this.bgmVol;
  }

  toggleMute() {
    this.setMuted(!this.muted);
    return this.muted;
  }
}

// 全局单例：各场景直接 import { audio } 使用
export const audio = new AudioManager();
