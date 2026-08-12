// 玩家：双轨切换（上/下键）、切轨视觉插值、拖尾、挤压拉伸手感
// 魔女形态进化：随累计试炼值切换形态（水手服 → 见习魔女 → 扫帚魔女）
// 支持僵直(stun)与无敌闪烁(invuln)视觉
import { CONFIG } from "../data/config.js";
import { WITCH_FORMS } from "../data/witchForms.js";
import { getWitchSprite, WITCH_SPRITES_ENABLED } from "./WitchSprites.js";

export class Player {
  constructor(form, skinId) {
this.form = form || WITCH_FORMS[0];
    this.skinId = skinId || "default"; // 用于查找对应角色立绘，没有立绘时自动回退矢量绘制
    this.lane = 1;        // 0=上轨 1=下轨
    this.x = CONFIG.playerX;
    this.w = CONFIG.playerW;
    this.h = CONFIG.playerH;
    this.y = CONFIG.laneTopY[this.lane];
    this.squash = 0;
    this.trail = [];
    this.runT = 0;
    this.stun = 0;      // 僵直计时（>0 时抖动、无法切轨）
    this.invuln = 0;    // 无敌计时（>0 时闪烁）
  }

  get cx() { return this.x + this.w / 2; }
  get cy() { return this.y + this.h / 2; }

  setForm(form) {
    if (form && form.id !== this.form.id) {
    this.form = form;
      this.squash = 1.2; // 进化时弹一下
    }
  }

  hit() {
    this.stun = CONFIG.stunTime;
    this.invuln = CONFIG.hitInvuln;
    this.squash = 1;
  }

  switchLane(lane) {
    if (this.stun > 0) return; // 僵直中不能切轨
    if (this.lane !== lane) {
      this.lane = lane;
      this.squash = 1;
    }
  }

  update(dt, input) {
    if (this.stun > 0) this.stun -= dt;
    if (this.invuln > 0) this.invuln -= dt;

    if (this.stun <= 0) {
   if (input.justPressed("arrowup", "w")) this.switchLane(0);
      if (input.justPressed("arrowdown", "s")) this.switchLane(1);
    }

    const targetY = CONFIG.laneTopY[this.lane];
    this.y += (targetY - this.y) * Math.min(1, CONFIG.laneSwitchLerp * dt);
    this.squash += (0 - this.squash) * Math.min(1, 10 * dt);
  this.runT += dt;

    this.trail.unshift({ x: this.cx, y: this.cy });
if (this.trail.length > 8) this.trail.pop();
  }

  render(ctx) {
    const f = this.form;

    // 无敌闪烁：每 0.1s 闪一次
  const blink = this.invuln > 0 && Math.floor(this.invuln * 12) % 2 === 0;
    if (blink) return;

    // 拖尾
    for (let i = this.trail.length - 1; i >= 0; i--) {
      const t = this.trail[i];
const a = (1 - i / this.trail.length) * 0.35;
  ctx.globalAlpha = a;
      ctx.fillStyle = f.trail;
      const s = 3 * (1 - i / this.trail.length);
      ctx.fillRect(Math.round(t.x - s), Math.round(t.y - s), s * 2, s * 2);
 }
    ctx.globalAlpha = 1;

    // 僵直抖动
    const shakeX = this.stun > 0 ? Math.round((Math.random() - 0.5) * 3) : 0;

    // 挤压拉伸
    const sx = 1 + this.squash * 0.25;
    const sy = 1 - this.squash * 0.3;
    const w = this.w * sx;
    const h = this.h * sy;
    const px = Math.round(this.x + (this.w - w) / 2) + shakeX;
    const py = Math.round(this.y + (this.h - h));
    const bob = Math.floor(Math.sin(this.runT * 16) * 1.2);

    // ===== 立绘预览：命中角色专属立绘时，直接画立绘替代下方矢量画法 =====
    if (WITCH_SPRITES_ENABLED) {
      const sprite = getWitchSprite(this.skinId, f.id);
      if (sprite) {
        this._drawSprite(ctx, sprite, px, py + bob, w, h);
        return;
      }
    }

    // 扫帚（终极形态）：画在身体下方
    if (f.broom) {
      this._drawBroom(ctx, px, py + bob, w, h);
    }

    // 斗篷（飘在身后）
    if (f.cape) {
      const flap = Math.sin(this.runT * 12) * 2;
      ctx.fillStyle = f.body;
      ctx.globalAlpha = 0.75;
      ctx.beginPath();
  ctx.moveTo(px + 1, py + bob + 2);
      ctx.lineTo(px - 6 - flap, py + bob + h * 0.5);
      ctx.lineTo(px - 3, py + bob + h);
      ctx.lineTo(px + w * 0.5, py + bob + h);
 ctx.closePath();
      ctx.fill();
      ctx.globalAlpha = 1;
    }

    // 身体
    ctx.fillStyle = f.body;
  ctx.fillRect(px, py + bob, w, h);
    ctx.strokeStyle = f.outline;
    ctx.lineWidth = 1;
    ctx.shadowColor = f.outline;
  ctx.shadowBlur = 6;
    ctx.strokeRect(px + 0.5, py + 0.5 + bob, w - 1, h - 1);
    ctx.shadowBlur = 0;

    // 领巾 / 徽章
 ctx.fillStyle = f.visor;
  ctx.fillRect(px + 3, py + 3 + bob, w - 6, 3);

    // 尖顶帽（魔女形态）
if (f.hat) {
      this._drawHat(ctx, px, py + bob, w, f);
    }
  }

  // 画角色立绘：立绘是骑扫帚横向飞行构图（已离线裁边贴合内容+统一同阶段三人体型），
  // 按固定展示高度等比缩放，扫帚/脚部贴齐碰撞框底部（=贴近赛道），左右居中。
  // 展示高度调到与 Boss 战立绘（30px）基本一致，避免跑酷时立绘过大导致视觉穿模。
  _drawSprite(ctx, sprite, px, py, w, h) {
    const drawH = 32; // 立绘展示高度，觉得太大/太小可以直接改这个数
    const drawW = (sprite.width / sprite.height) * drawH;
    const dx = Math.round(px + w / 2 - drawW / 2);
    const dy = Math.round(py + h - drawH);
    ctx.drawImage(sprite, dx, dy, drawW, drawH);
  }

  _drawHat(ctx, px, py, w, f) {
    const cx = px + w / 2;
    ctx.fillStyle = f.body;
    ctx.strokeStyle = f.outline;
    ctx.lineWidth = 1;
    // 帽檐
    ctx.fillRect(px - 2, py - 2, w + 4, 3);
  // 帽尖三角
 ctx.beginPath();
    ctx.moveTo(cx, py - 12);
    ctx.lineTo(px + 2, py - 1);
    ctx.lineTo(px + w - 2, py - 1);
    ctx.closePath();
    ctx.fill();
    ctx.shadowColor = f.outline;
    ctx.shadowBlur = 5;
    ctx.stroke();
    ctx.shadowBlur = 0;
    // 帽尖星星
    ctx.fillStyle = f.visor;
    ctx.fillRect(cx - 1, py - 10, 2, 2);
  }

  _drawBroom(ctx, px, py, w, h) {
    const y = py + h - 2;
    ctx.strokeStyle = "#c8964a";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(px - 8, y + 4);
    ctx.lineTo(px + w + 6, y);
    ctx.stroke();
    // 扫帚尾
    ctx.strokeStyle = "#e0b45c";
    ctx.lineWidth = 1;
    for (let i = 0; i < 4; i++) {
    ctx.beginPath();
      ctx.moveTo(px - 8, y + 4);
      ctx.lineTo(px - 14, y + i * 2);
      ctx.stroke();
    }
    // 魔法微光
    ctx.fillStyle = "rgba(255,207,92,0.5)";
    ctx.fillRect(px + w, y - 1, 2, 2);
  }
}
