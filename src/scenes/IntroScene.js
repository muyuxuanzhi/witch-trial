// 开场对话：点击开始游戏后进入。逐句显示对话，点击/回车推进，
// 最后一句后进入 RunScene 正式开始魔女试炼。
import { Scene } from "../engine/Scene.js";
import { PALETTE } from "../engine/Game.js";
import { Background } from "../systems/Background.js";
import { Save } from "../systems/Save.js";
import { getSkin } from "../data/skins.js";

export class IntroScene extends Scene {
  constructor(game, level) {
    super(game);
    this.t = 0;
    this.save = Save.load();
    this.level = level || null;
    this.bg = new Background(game.width, game.height, getSkin("background", this.save.equipped.background));
    // 对话按关卡定制
    const lvName = this.level ? this.level.name : "";
    const bossName = this.level ? this.level.subtitle : "";
    this.lines = this.level ? (this.level.endless ? [
      { who: "叶林", text: "♾ 无尽试炼……星光没有尽头呢。" },
      { who: "叶林", text: "Boss 会一直降临，收集度与属性也会一直叠加……" },
      { who: "叶林", text: "看我能撑到第几轮吧——出发！" },
    ] : [
      { who: "叶林", text: `第${this.level.index}关 · ${lvName}` },
      { who: "叶林", text: "呼……我准备好了。" },
      { who: "叶林", text: `那……我的魔女试炼，${bossName}，现在开始！` },
    ]) : [
      { who: "叶林", text: "深呼吸……我准备好了。" },
      { who: "叶林", text: "我的魔女试炼，现在开始！" },
    ];
    this.idx = 0;
    this.charT = 0;       // 打字机计时
    this.done = false;    // 当前句是否显示完
    // 对话一开始就在后台预取 RunScene 模块（及其依赖链），而不是等到对话
    // 读完点击“开始试炼”那一刻才发起加载：这样有对话展示的这几秒时间可以
    // 把模块请求 + 解析都提前做完，避免"点击瞬间"才发起一大串请求导致的
    // 明显卡顿；弱网下也能大幅降低"点了没反应/进不去"的概率。
    this._runScenePromise = import("./RunScene.js").catch((e) => {
      console.warn("[IntroScene] 预加载 RunScene 失败，将在点击时重试", e);
      return null;
    });
  }

  _curFullText() {
    return this.lines[this.idx].text;
  }

  _shownText() {
    const full = this._curFullText();
 const n = Math.floor(this.charT * 22);
  return full.slice(0, n);
  }

  _advance() {
    const full = this._curFullText();
    if (this._shownText().length < full.length) {
      // 未显示完：直接显示完整句
      this.charT = full.length / 22 + 0.01;
      return;
    }
    // 已显示完：进入下一句或开始游戏
    if (this.idx < this.lines.length - 1) {
      this.idx++;
      this.charT = 0;
    } else {
      this._startGame();
    }
  }

  _startGame() {
    // 防止异步模块加载期间用户再次点击，重复触发切场景
    if (this._starting) return;
    this._starting = true;
    // 优先复用对话期间就已经在后台预取的 Promise（此时大概率已经加载完成，
    // 几乎瞬间进入下一场景）；如果预取失败了（或还没建立），才现场再 import 一次。
    const loader = this._runScenePromise || import("./RunScene.js");
    loader
      .then((m) => {
        if (!m) throw new Error("RunScene module not loaded");
        this.game.changeScene(new m.RunScene(this.game, this.level));
      })
      .catch((e) => {
        // 加载失败（弱网/超时等）：不能让玩家卡在这里点了完全没反应——
        // 重置状态允许再次点击重试，并现场发起一次全新的 import。
        console.warn("[IntroScene] 进入关卡失败，可再次点击重试", e);
        this._starting = false;
        this._runScenePromise = null;
      });
  }

  update(dt, input) {
    this.t += dt;
    this.charT += dt;
    this.bg.update(dt, 40);

    // ===== 移动端衔接 Bug 修复 =====
    // 刚切换进来的 0.25 秒内忽略任何点击 / 回车 / 空格，
    // 避免上一场景（菜单/选关/结算）的最后一次 tap 或回车被原样带入本场景
    // ——这正是"对话框出现瞬间立刻被当作下一句跳过"的根因。
    if (!this._guardT) this._guardT = 0.25;
    if (this._guardT > 0) this._guardT -= dt;

    if (this._guardT <= 0 && !this._starting && (input.justPressed("enter", " ") || input.pointer.justDown)) {
      this._advance();
    }
  }

  render(ctx) {
    const W = this.game.width, H = this.game.height;
    this.bg.render(ctx, this.t);
    ctx.fillStyle = "rgba(20,10,31,0.68)";
    ctx.fillRect(0, 0, W, H);

    // 对话框
    const boxH = 70;
    const boxY = H - boxH - 16;
    ctx.fillStyle = "rgba(42,26,58,0.92)";
    ctx.fillRect(16, boxY, W - 32, boxH);
    ctx.strokeStyle = PALETTE.neon;
 ctx.lineWidth = 1;
    ctx.shadowColor = PALETTE.neon;
    ctx.shadowBlur = 8;
    ctx.strokeRect(16.5, boxY + 0.5, W - 33, boxH - 1);
    ctx.shadowBlur = 0;

    // 说话人
    const line = this.lines[this.idx];
    ctx.textAlign = "left";
    ctx.textBaseline = "top";
    ctx.fillStyle = PALETTE.gold;
    ctx.font = "bold 12px monospace";
    ctx.fillText(line.who, 28, boxY + 10);

    // 正文（打字机）
    ctx.fillStyle = PALETTE.text;
    ctx.font = "14px monospace";
    ctx.fillText(this._shownText(), 28, boxY + 30);

    // 提示：闪烁的继续箭头
    if (this._shownText().length >= this._curFullText().length) {
      if (Math.floor(this.t * 2) % 2 === 0) {
        ctx.fillStyle = PALETTE.cyan;
        ctx.font = "12px monospace";
        ctx.textAlign = "right";
        const tip = this.idx < this.lines.length - 1 ? "▼ 点击继续" : "▼ 点击开始试炼";
      ctx.fillText(tip, W - 28, boxY + boxH - 18);
      }
    }
    ctx.textAlign = "left";

    // ===== 顶部小提示：移动端竖屏请横屏 =====
    if (this.game.scale && this.game.scale < 0.55) {
      // 当前缩放比 < 0.55（典型竖屏场景）：顶部一条横屏提示
      ctx.textAlign = "center";
      ctx.fillStyle = "rgba(255,207,92,0.85)";
      ctx.font = "10px monospace";
      ctx.fillText("📱 建议横屏体验更佳（请转动手机）", W / 2, 12);
      ctx.textAlign = "left";
    }
  }
}
