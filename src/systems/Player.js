// 玩家：双轨切换（上/下键）、切轨视觉插值、拖尾、挤压拉伸手感
// 支持皮肤配色（skin: { body, outline, visor, trail }）
import { CONFIG } from "../data/config.js";
import { getSkin } from "../data/skins.js";

export class Player {
  constructor(skin) {
    this.skin = skin || getSkin("character", "default");
    this.lane = 1;                 // 0=上轨 1=下轨
    this.x = CONFIG.playerX;
    this.w = CONFIG.playerW;
    this.h = CONFIG.playerH;
    this.y = CONFIG.laneTopY[this.lane];
    this.squash = 0;
    this.trail = [];
    this.runT = 0;
  }

  get cx() { return this.x + this.w / 2; }
  get cy() { return this.y + this.h / 2; }

  switchLane(lane) {
    if (this.lane !== lane) {
      this.lane = lane;
      this.squash = 1;
    }
  }

  update(dt, input) {
    if (input.justPressed("arrowup", "w")) this.switchLane(0);
    if (input.justPressed("arrowdown", "s")) this.switchLane(1);

    const targetY = CONFIG.laneTopY[this.lane];
    this.y += (targetY - this.y) * Math.min(1, CONFIG.laneSwitchLerp * dt);
    this.squash += (0 - this.squash) * Math.min(1, 10 * dt);
    this.runT += dt;

    this.trail.unshift({ x: this.cx, y: this.cy });
    if (this.trail.length > 8) this.trail.pop();
  }

  render(ctx) {
    const sk = this.skin;
    // 拖尾
    for (let i = this.trail.length - 1; i >= 0; i--) {
      const t = this.trail[i];
      const a = (1 - i / this.trail.length) * 0.35;
      ctx.globalAlpha = a;
      ctx.fillStyle = sk.trail;
      const s = 3 * (1 - i / this.trail.length);
      ctx.fillRect(Math.round(t.x - s), Math.round(t.y - s), s * 2, s * 2);
    }
    ctx.globalAlpha = 1;

    // 挤压拉伸
    const sx = 1 + this.squash * 0.25;
    const sy = 1 - this.squash * 0.3;
    const w = this.w * sx;
    const h = this.h * sy;
    const px = Math.round(this.x + (this.w - w) / 2);
    const py = Math.round(this.y + (this.h - h));
    const bob = Math.floor(Math.sin(this.runT * 16) * 1.2);

    ctx.fillStyle = sk.body;
    ctx.fillRect(px, py + bob, w, h);
    ctx.strokeStyle = sk.outline;
    ctx.lineWidth = 1;
    ctx.shadowColor = sk.outline;
    ctx.shadowBlur = 6;
    ctx.strokeRect(px + 0.5, py + 0.5 + bob, w - 1, h - 1);
    ctx.shadowBlur = 0;
    ctx.fillStyle = sk.visor;
    ctx.fillRect(px + 3, py + 3 + bob, w - 6, 3);
  }
}
