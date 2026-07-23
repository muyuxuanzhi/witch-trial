// 主菜单：霓虹标题 + 视差城市 + 上下键/点击选择（开始 / 商城），显示金币与最高分
import { Scene } from "../engine/Scene.js";
import { PALETTE } from "../engine/Game.js";
import { Background } from "../systems/Background.js";
import { Save } from "../systems/Save.js";
import { getSkin } from "../data/skins.js";
import { RunScene } from "./RunScene.js";
import { ShopScene } from "./ShopScene.js";

export class MenuScene extends Scene {
  constructor(game) {
    super(game);
    this.t = 0;
    this.save = Save.load();
    this.bg = new Background(game.width, game.height, getSkin("background", this.save.equipped.background));
    this.items = ["开始疾跑", "商城"];
    this.sel = 0;
  }

  onEnter() {
    this.save = Save.load();
    this.bg.setSkin(getSkin("background", this.save.equipped.background));
  }

  _itemRects() {
    const W = this.game.width, H = this.game.height;
    return this.items.map((_, i) => ({ x: W / 2 - 90, y: H * 0.56 + i * 28 - 13, w: 180, h: 26 }));
  }

  _activate(i) {
    if (i === 0) this.game.changeScene(new RunScene(this.game));
    else this.game.changeScene(new ShopScene(this.game));
  }

  update(dt, input) {
    this.t += dt;
    this.bg.update(dt, 120);

    if (input.justPressed("arrowup", "w")) this.sel = (this.sel + this.items.length - 1) % this.items.length;
    if (input.justPressed("arrowdown", "s")) this.sel = (this.sel + 1) % this.items.length;
    if (input.justPressed("enter", " ")) this._activate(this.sel);

    // 触屏：直接点击菜单项
    const rects = this._itemRects();
    for (let i = 0; i < rects.length; i++) {
      if (input.tapIn(rects[i])) { this.sel = i; this._activate(i); }
    }
  }

  render(ctx) {
    const W = this.game.width, H = this.game.height;
    this.bg.render(ctx, this.t);
    ctx.fillStyle = "rgba(20,10,31,0.5)";
    ctx.fillRect(0, 0, W, H);

    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    const glow = 8 + Math.sin(this.t * 2) * 4;
    ctx.shadowColor = PALETTE.neon;
    ctx.shadowBlur = glow;
    ctx.fillStyle = PALETTE.text;
    ctx.font = "bold 34px monospace";
    ctx.fillText("霓虹疾跑", W / 2, H * 0.26);
    ctx.shadowBlur = 0;
    ctx.fillStyle = PALETTE.neon;
    ctx.font = "11px monospace";
    ctx.fillText("N E O N   D A S H", W / 2, H * 0.26 + 26);

    const rects = this._itemRects();
    ctx.font = "14px monospace";
    for (let i = 0; i < this.items.length; i++) {
      const r = rects[i];
      const on = i === this.sel;
      if (on) {
        ctx.fillStyle = "rgba(185,107,255,0.16)";
        ctx.fillRect(r.x, r.y, r.w, r.h);
        ctx.fillStyle = PALETTE.gold;
        ctx.fillText("▶  " + this.items[i] + "  ◀", W / 2, r.y + r.h / 2 + 1);
      } else {
        ctx.fillStyle = "rgba(233,220,255,0.6)";
        ctx.fillText(this.items[i], W / 2, r.y + r.h / 2 + 1);
      }
    }

    ctx.textAlign = "right";
    ctx.font = "10px monospace";
    ctx.fillStyle = PALETTE.gold;
    ctx.textBaseline = "top";
    ctx.fillText(`金币 ${this.save.coins}`, W - 10, 8);
    ctx.fillStyle = "rgba(233,220,255,0.6)";
    ctx.fillText(`最高 ${this.save.hi}`, W - 10, 22);

    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillStyle = "rgba(233,220,255,0.45)";
    ctx.font = "8px monospace";
    ctx.fillText("↑↓ / 点击 选择 · Enter 确认", W / 2, H * 0.9);
    ctx.textAlign = "left";
  }
}
