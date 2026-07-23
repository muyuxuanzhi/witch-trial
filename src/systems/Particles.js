// 粒子系统：吃光点爆发、碰撞爆发等即时反馈（juice）
export class Particles {
  constructor() {
    this.list = [];
  }

  reset() {
    this.list.length = 0;
  }

  burst(x, y, color, count = 10, opts = {}) {
    const speed = opts.speed ?? 90;
    const life = opts.life ?? 0.5;
    const size = opts.size ?? 2;
    for (let i = 0; i < count; i++) {
      const a = Math.random() * Math.PI * 2;
      const sp = speed * (0.4 + Math.random() * 0.6);
      this.list.push({
        x, y,
        vx: Math.cos(a) * sp,
        vy: Math.sin(a) * sp,
        life,
        maxLife: life,
        color,
        size,
      });
    }
  }

  update(dt) {
    for (const p of this.list) {
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vy += 120 * dt;      // 轻微重力
      p.vx *= 0.94;
      p.life -= dt;
    }
    this.list = this.list.filter((p) => p.life > 0);
  }

  render(ctx) {
    for (const p of this.list) {
      const a = Math.max(0, p.life / p.maxLife);
      ctx.globalAlpha = a;
      ctx.fillStyle = p.color;
      const s = p.size * a;
      ctx.fillRect(Math.round(p.x - s), Math.round(p.y - s), s * 2, s * 2);
    }
    ctx.globalAlpha = 1;
  }
}
