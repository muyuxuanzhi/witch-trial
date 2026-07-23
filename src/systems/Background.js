// 多层视差霓虹城市背景：支持皮肤配色（skin: { sky[3], far, mid, ground, line, grid }）
import { PALETTE } from "../engine/Game.js";
import { CONFIG } from "../data/config.js";
import { getSkin } from "../data/skins.js";

export class Background {
  constructor(W, H, skin) {
    this.W = W;
    this.H = H;
    this.skin = skin || getSkin("background", "default");
    this.far = this._genBuildings(W, 14, 26, 60);
    this.mid = this._genBuildings(W, 20, 40, 90);
    this.offFar = 0;
    this.offMid = 0;
    this.offNear = 0;
  }

  setSkin(skin) { this.skin = skin; }

  _genBuildings(W, count, minH, maxH) {
    const arr = [];
    let x = 0;
    for (let i = 0; i < count; i++) {
      const w = 20 + Math.floor(Math.random() * 34);
      const h = minH + Math.floor(Math.random() * (maxH - minH));
      arr.push({ x, w, h, lit: Math.random() < 0.5 });
      x += w + Math.floor(Math.random() * 10);
    }
    return { items: arr, span: x };
  }

  update(dt, speed) {
    this.offFar = (this.offFar + speed * 0.15 * dt) % this.far.span;
    this.offMid = (this.offMid + speed * 0.4 * dt) % this.mid.span;
    this.offNear = (this.offNear + speed * dt) % 24;
  }

  render(ctx, time) {
    const W = this.W, H = this.H;
    const sk = this.skin;

    // 天空渐变
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, sk.sky[0]);
    g.addColorStop(0.7, sk.sky[1]);
    g.addColorStop(1, sk.sky[2]);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);

    // 楼群
    this._drawLayer(ctx, this.far, this.offFar, CONFIG.groundY, 0.5, sk.far);
    this._drawLayer(ctx, this.mid, this.offMid, CONFIG.groundY, 0.85, sk.mid);

    // 地面
    ctx.fillStyle = sk.ground;
    ctx.fillRect(0, CONFIG.groundY, W, H - CONFIG.groundY);
    ctx.strokeStyle = sk.line;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, CONFIG.groundY + 0.5);
    ctx.lineTo(W, CONFIG.groundY + 0.5);
    ctx.stroke();

    // 近景滚动网格
    ctx.strokeStyle = sk.grid;
    for (let x = -this.offNear; x < W; x += 24) {
      ctx.beginPath();
      ctx.moveTo(x, CONFIG.groundY);
      ctx.lineTo(x - 40, H);
      ctx.stroke();
    }
  }

  _drawLayer(ctx, layer, off, baseY, alpha, color) {
    ctx.globalAlpha = alpha;
    for (let rep = 0; rep <= Math.ceil(this.W / layer.span) + 1; rep++) {
      const base = rep * layer.span - off;
      for (const b of layer.items) {
        const x = base + b.x;
        if (x > this.W || x + b.w < 0) continue;
        ctx.fillStyle = color;
        ctx.fillRect(Math.round(x), baseY - b.h, b.w, b.h);
        if (b.lit) {
          ctx.fillStyle = Math.random() < 0.5 ? PALETTE.cyan : PALETTE.gold;
          ctx.globalAlpha = alpha * 0.5;
          ctx.fillRect(Math.round(x) + 3, baseY - b.h + 4, 2, 2);
          ctx.globalAlpha = alpha;
        }
      }
    }
    ctx.globalAlpha = 1;
  }
}
