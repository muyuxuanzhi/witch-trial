// 程序化生成器：随机在上/下轨生成障碍与收集物，难度随时间提升
// 收集物分两种：魔法星星（star）/ 魔法药水（potion）
// 障碍支持皮肤配色（obSkin: { fill, outline, stripe }）
import { CONFIG } from "../data/config.js";
import { PALETTE } from "../engine/Game.js";
import { getSkin } from "../data/skins.js";

export class Spawner {
  constructor(obSkin) {
    this.obSkin = obSkin || getSkin("obstacle", "default");
    this.entities = [];
    this.timer = 0;
    this.interval = CONFIG.spawnStart;
    this.orbBonus = 0; // 幸运星 buff 提升的收集物概率
  }

  reset() {
    this.entities.length = 0;
    this.timer = 0;
    this.interval = CONFIG.spawnStart;
  }

  update(dt, speed, elapsed) {
    this.interval = Math.max(
      CONFIG.spawnMin,
      CONFIG.spawnStart - elapsed * CONFIG.spawnRampSpeed
    );

    this.timer += dt;
    if (this.timer >= this.interval) {
      this.timer = 0;
      this._spawn();
    }

    for (const e of this.entities) e.x -= speed * dt;
    this.entities = this.entities.filter((e) => e.x + e.w > -20 && !e.dead);
  }

  _spawn() {
    const lane = Math.random() < 0.5 ? 0 : 1;
    const spawnX = 500;
    const orbChance = Math.min(0.85, CONFIG.orbChance + this.orbBonus);

    if (Math.random() < orbChance) {
      this.entities.push(this._makeOrb(lane, spawnX));
    } else {
      this.entities.push(this._makeObstacle(lane, spawnX));
      if (Math.random() < CONFIG.pairOrbChance) {
        this.entities.push(this._makeOrb(lane === 0 ? 1 : 0, spawnX + 4));
      }
    }
  }

  _makeObstacle(lane, x) {
    const h = 20 + Math.floor(Math.random() * 10);
    return { type: "obstacle", lane, x, w: 16, h, dead: false };
  }

  _makeOrb(lane, x) {
    // 区分星星与药水
    const isPotion = Math.random() < CONFIG.potionChance;
    return {
      type: "orb",
      orbKind: isPotion ? "potion" : "star",
      lane, x, w: 14, h: 14, dead: false,
      t: Math.random() * 6,
    };
  }

  render(ctx, time) {
    const ob = this.obSkin;
    for (const e of this.entities) {
      const topY = CONFIG.laneTopY[e.lane];
      if (e.type === "obstacle") {
        const y = topY + (CONFIG.playerH - e.h);
        ctx.fillStyle = ob.fill;
        ctx.fillRect(Math.round(e.x), Math.round(y), e.w, e.h);
        ctx.strokeStyle = ob.outline;
        ctx.lineWidth = 1;
        ctx.shadowColor = ob.outline;
        ctx.shadowBlur = 6;
        ctx.strokeRect(Math.round(e.x) + 0.5, Math.round(y) + 0.5, e.w - 1, e.h - 1);
        ctx.shadowBlur = 0;
        ctx.fillStyle = ob.stripe;
        ctx.fillRect(Math.round(e.x) + 3, Math.round(y) + 3, e.w - 6, 2);
      } else {
        const cx = e.x + e.w / 2;
        const cy = topY + CONFIG.playerH / 2;
        const pulse = 1 + Math.sin((time + e.t) * 6) * 0.15;
        if (e.orbKind === "potion") {
          this._drawPotion(ctx, cx, cy, pulse);
        } else {
          this._drawStar(ctx, cx, cy, pulse, time + e.t);
        }
      }
    }
  }

  // 魔法星星：金色五角星
  _drawStar(ctx, cx, cy, pulse, phase) {
    const R = 7 * pulse;
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(Math.sin(phase * 1.2) * 0.2);
    ctx.fillStyle = PALETTE.gold;
    ctx.shadowColor = PALETTE.gold;
    ctx.shadowBlur = 10;
    ctx.beginPath();
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * Math.PI * 2 - Math.PI / 2;
      const a2 = a + Math.PI / 5;
      ctx.lineTo(Math.cos(a) * R, Math.sin(a) * R);
      ctx.lineTo(Math.cos(a2) * R * 0.45, Math.sin(a2) * R * 0.45);
    }
    ctx.closePath();
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.restore();
  }

  // 魔法药水：青色小瓶 + 高光
  _drawPotion(ctx, cx, cy, pulse) {
    const s = pulse;
    ctx.save();
    ctx.translate(cx, cy);
    ctx.shadowColor = PALETTE.cyan;
    ctx.shadowBlur = 10;
    // 瓶身
    ctx.fillStyle = PALETTE.cyan;
    ctx.beginPath();
    ctx.arc(0, 2 * s, 5 * s, 0, Math.PI * 2);
    ctx.fill();
    // 瓶颈
    ctx.fillRect(-2 * s, -6 * s, 4 * s, 6 * s);
    // 瓶塞
    ctx.fillStyle = PALETTE.neon;
    ctx.fillRect(-2.5 * s, -8 * s, 5 * s, 2.5 * s);
    ctx.shadowBlur = 0;
    // 高光
    ctx.fillStyle = "rgba(255,255,255,0.7)";
    ctx.beginPath();
    ctx.arc(-1.5 * s, 1 * s, 1.3 * s, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
}
