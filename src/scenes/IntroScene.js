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
      { who: "？？？", text: "♾ 无尽试炼" },
      { who: "？？？", text: "Boss 随机降临，收集度与属性会一直叠加……" },
      { who: "？？？", text: "看你能撑到第几轮，出发吧！" },
    ] : [
      { who: "？？？", text: `第${this.level.index}关 · ${lvName}` },
      { who: "？？？", text: "你决定好了吗？" },
   { who: "？？？", text: `那魔女试炼……${bossName}，就开始了！` },
    ]) : [
      { who: "？？？", text: "你决定好了吗？" },
      { who: "？？？", text: "那魔女试炼……就开始了！" },
    ];
    this.idx = 0;
    this.charT = 0;       // 打字机计时
    this.done = false;    // 当前句是否显示完
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
    // 动态导入避免循环依赖
    import("./RunScene.js").then((m) => {
      this.game.changeScene(new m.RunScene(this.game, this.level));
    });
  }

  update(dt, input) {
    this.t += dt;
    this.charT += dt;
 this.bg.update(dt, 40);

    if (input.justPressed("enter", " ") || input.pointer.justDown) {
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
  }
}
