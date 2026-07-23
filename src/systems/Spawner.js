// 程序化生成器：随机在上/下轨生成障碍与光点，难度随时间提升
// 障碍支持皮肤配色（obSkin: { fill, outline, stripe }）；光点固定金色（代表金币）
import { CONFIG } from "../data/config.js";
import { PALETTE } from "../engine/Game.js";
import { getSkin } from "../data/skins.js";

export class Spawner {
  constructor(obSkin) {
    this.obSkin = obSkin || getSkin("obstacle", "default");
    this.entities = [];
    this.timer = 0;
    this.interval = CONFIG.spawnStart;
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

    if (Math.random() < CONFIG.orbChance) {
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
    return { type: "orb", lane, x, w: 12, h: 12, dead: false, t: Math.random() * 6 };
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
        ctx.fillStyle = PALETTE.gold;
        ctx.shadowColor = PALETTE.gold;
        ctx.shadowBlur = 8;
        ctx.beginPath();
        ctx.arc(cx, cy, 4 * pulse, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0;
      }
    }
  }
}
