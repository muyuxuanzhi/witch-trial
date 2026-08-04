// 关卡背景：依据皮肤的 bgStyle 绘制不同主题的视差背景。
// 支持 5 种风格：forest(树林) / swamp(毒沼) / cave(洞窟) / castle(城堡) / moon(月蚀祭坛)。
// 皮肤结构：{ sky[3], far, mid, ground, line, grid, bgStyle, accentA, accentB }
import { PALETTE } from "../engine/Game.js";
import { CONFIG } from "../data/config.js";
import { getSkin } from "../data/skins.js";

export class Background {
  constructor(W, H, skin) {
    this.W = W;
    this.H = H;
    this.skin = skin || getSkin("background", "default");
    this.offFar = 0;
    this.offMid = 0;
    this.offNear = 0;
    this._genShapes();
  }

  setSkin(skin) {
    this.skin = skin;
    this._genShapes();
  }

  // 依据当前风格生成远/中景轮廓
  _genShapes() {
    const style = (this.skin && this.skin.bgStyle) || "forest";
    this.style = style;
    this.far = this._genLayer(this.W, 12, 30, 70);
    this.mid = this._genLayer(this.W, 16, 46, 110);
  }

  _genLayer(W, count, minH, maxH) {
    const arr = [];
    let x = 0;
    for (let i = 0; i < count; i++) {
      const w = 24 + Math.floor(Math.random() * 40);
      const h = minH + Math.floor(Math.random() * (maxH - minH));
      arr.push({ x, w, h, lit: Math.random() < 0.5, seed: Math.random() });
      x += w + Math.floor(Math.random() * 14);
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

    // 主题天空装饰（月亮/雾气/水晶光）
    this._renderSkyDecor(ctx, time);

    // 远/中景剪影（按风格）
    this._drawLayer(ctx, this.far, this.offFar, CONFIG.groundY, 0.55, sk.far);
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
    ctx.globalAlpha = 0.5;
    for (let x = -this.offNear; x < W; x += 24) {
      ctx.beginPath();
      ctx.moveTo(x, CONFIG.groundY);
      ctx.lineTo(x - 40, H);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }

  _renderSkyDecor(ctx, time) {
    const W = this.W, H = this.H, sk = this.skin;
    const style = this.style;
    if (style === "moon") {
      // 月蚀：暗红大月 + 光环
      const mx = W * 0.75, my = H * 0.28, r = 34;
      ctx.fillStyle = "#3a1020";
      ctx.beginPath(); ctx.arc(mx, my, r, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = sk.accentA; ctx.lineWidth = 2;
      ctx.globalAlpha = 0.5 + Math.sin(time * 2) * 0.2;
      ctx.beginPath(); ctx.arc(mx, my, r + 6, 0, Math.PI * 2); ctx.stroke();
      ctx.globalAlpha = 1;
    } else if (style === "cave") {
      // 洞窟：漂浮水晶光点
      for (let i = 0; i < 12; i++) {
        const x = (i * 83 + time * 6) % W;
        const y = 30 + (i * 37) % 120;
        ctx.fillStyle = sk.accentB;
        ctx.globalAlpha = 0.3 + Math.sin(time * 2 + i) * 0.2;
        ctx.fillRect((x + W) % W, y, 2, 2);
      }
      ctx.globalAlpha = 1;
    } else if (style === "castle") {
      // 城堡：幽灵薄雾 + 满月
      const mx = W * 0.7, my = H * 0.25;
      ctx.fillStyle = "rgba(220,200,255,0.55)";
      ctx.beginPath(); ctx.arc(mx, my, 22, 0, Math.PI * 2); ctx.fill();
    } else if (style === "swamp") {
      // 毒沼：飘浮毒气泡
      for (let i = 0; i < 10; i++) {
        const x = (i * 97 - time * 10) % W;
        const y = CONFIG.groundY - 20 - (i * 29) % 90;
        ctx.fillStyle = sk.accentA;
        ctx.globalAlpha = 0.15 + Math.sin(time + i) * 0.1;
        ctx.beginPath(); ctx.arc((x + W) % W, y, 3 + (i % 3), 0, Math.PI * 2); ctx.fill();
      }
      ctx.globalAlpha = 1;
    } else {
      // forest：星星/萤火
      ctx.fillStyle = "rgba(255,255,255,0.35)";
      for (let i = 0; i < 26; i++) {
        const x = (i * 71) % W;
        const y = (i * 43) % 120;
        ctx.globalAlpha = 0.3 + Math.sin(time * 1.5 + i) * 0.25;
        ctx.fillRect(x, y, 1, 1);
      }
      ctx.globalAlpha = 1;
    }
  }

  _drawLayer(ctx, layer, off, baseY, alpha, color) {
    const style = this.style;
    ctx.globalAlpha = alpha;
    for (let rep = 0; rep <= Math.ceil(this.W / layer.span) + 1; rep++) {
      const base = rep * layer.span - off;
      for (const b of layer.items) {
        const x = Math.round(base + b.x);
        if (x > this.W || x + b.w < 0) continue;
        ctx.fillStyle = color;
        if (style === "forest" || style === "swamp") {
          this._drawTree(ctx, x, baseY, b, style);
        } else if (style === "cave") {
          this._drawStalactite(ctx, x, baseY, b);
        } else if (style === "castle") {
          this._drawTower(ctx, x, baseY, b, alpha, color);
        } else {
          this._drawAltar(ctx, x, baseY, b, alpha, color);
        }
      }
    }
    ctx.globalAlpha = 1;
  }

  // 树（森林/毒沼）：三角树冠 + 树干
  _drawTree(ctx, x, baseY, b, style) {
    const cx = x + b.w / 2;
    const trunkW = Math.max(3, b.w * 0.16);
    ctx.fillRect(Math.round(cx - trunkW / 2), baseY - b.h * 0.35, trunkW, b.h * 0.35);
    ctx.beginPath();
    ctx.moveTo(cx, baseY - b.h);
    ctx.lineTo(x, baseY - b.h * 0.3);
    ctx.lineTo(x + b.w, baseY - b.h * 0.3);
    ctx.closePath();
    ctx.fill();
    if (style === "swamp") {
      // 藤蔓垂挂
      ctx.strokeStyle = ctx.fillStyle; ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(cx, baseY - b.h * 0.3);
      ctx.lineTo(cx + (b.seed - 0.5) * 10, baseY - 4);
      ctx.stroke();
    }
  }

  // 钟乳石（洞窟）：从顶垂下
  _drawStalactite(ctx, x, baseY, b) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x + b.w / 2, b.h * 0.7);
    ctx.lineTo(x + b.w, 0);
    ctx.closePath();
    ctx.fill();
    // 地面石笋
    ctx.beginPath();
    ctx.moveTo(x, baseY);
    ctx.lineTo(x + b.w / 2, baseY - b.h * 0.5);
    ctx.lineTo(x + b.w, baseY);
    ctx.closePath();
    ctx.fill();
  }

  // 尖塔（城堡）：矩形塔身 + 三角顶 + 窗户
  _drawTower(ctx, x, baseY, b, alpha, color) {
    ctx.fillRect(x, baseY - b.h, b.w, b.h);
    ctx.beginPath();
    ctx.moveTo(x - 2, baseY - b.h);
    ctx.lineTo(x + b.w / 2, baseY - b.h - 12);
    ctx.lineTo(x + b.w + 2, baseY - b.h);
    ctx.closePath();
    ctx.fill();
    if (b.lit) {
      ctx.fillStyle = PALETTE.gold;
      ctx.globalAlpha = alpha * 0.7;
      ctx.fillRect(x + b.w / 2 - 1, baseY - b.h * 0.6, 3, 4);
      ctx.globalAlpha = alpha;
      ctx.fillStyle = color;
    }
  }

  // 祭坛石柱（月蚀）：断裂石柱 + 顶部符文光
  _drawAltar(ctx, x, baseY, b, alpha, color) {
    ctx.fillRect(x, baseY - b.h, b.w, b.h);
    //顶部横石
    ctx.fillRect(x - 2, baseY - b.h, b.w + 4, 5);
    if (b.lit) {
      ctx.fillStyle = this.skin.accentA;
      ctx.globalAlpha = alpha * 0.6;
      ctx.fillRect(x + 2, baseY - b.h + 2, b.w - 4, 2);
      ctx.globalAlpha = alpha;
      ctx.fillStyle = color;
    }
  }
}
