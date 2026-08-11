// 武器选择界面：达到最终形态、跑酷阶段完成后进入。
// 展示已拥有的武器（未拥有的置灰），选定后进入 BossScene 弹幕战。
import { Scene } from "../engine/Scene.js";
import { PALETTE } from "../engine/Game.js";
import { Save } from "../systems/Save.js";
import { WEAPONS } from "../data/weapons.js";
import { getLevelBoss } from "../data/levels.js";
import { audio } from "../engine/Audio.js";

export class WeaponSelectScene extends Scene {
  // level: 当前关卡数据；carry: 从RunScene 带过来的状态（buffs、form等，可选）
  constructor(game, level, carry = {}) {
    super(game);
    this.t = 0;
    this.level = level;
    this.carry = carry;
    this.save = Save.load();
    // 默认选中已装备武器，若未拥有则选第一个拥有的
    const owned = this.save.owned.weapon || ["wand"];
    const eq = this.save.equipped.weapon;
    this.sel = Math.max(0, WEAPONS.findIndex((w) => w.id === (owned.includes(eq) ? eq : owned[0])));
  }

  _cardRects() {
    const W = this.game.width;
    const n = WEAPONS.length;
    const cw = 96, gap = 10;
    const totalW = cw * n + gap * (n - 1);
    const x0 = (W - totalW) / 2;
    const y = 80, h = 110;
    return WEAPONS.map((_, i) => ({ x: x0 + i * (cw + gap), y, w: cw, h }));
  }

  _startBtn() {
    const W = this.game.width, H = this.game.height;
    return { x: W / 2 - 80, y: H - 40, w: 160, h: 26 };
  }

  _isOwned(w) { return (this.save.owned.weapon || ["wand"]).includes(w.id); }

  update(dt, input) {
    this.t += dt;
    if (input.justPressed("arrowleft", "a")) this.sel = (this.sel + WEAPONS.length - 1) % WEAPONS.length;
    if (input.justPressed("arrowright", "d")) this.sel = (this.sel + 1) % WEAPONS.length;
    if (input.justPressed("1")) this.sel = 0;
    if (input.justPressed("2")) this.sel = 1;
    if (input.justPressed("3")) this.sel = 2;
    if (input.justPressed("4")) this.sel = 3;

    const rects = this._cardRects();
    for (let i = 0; i < rects.length; i++) {
      if (input.tapIn(rects[i])) {
        if (this._isOwned(WEAPONS[i])) {
          if (this.sel === i) this._start();
          else { audio.play("click"); this.sel = i; }
        } else this.sel = i;
      }
    }
    if (input.justPressed("enter", " ") || input.tapIn(this._startBtn())) this._start();
  }

  _start() {
    if (this._starting) return;
    const w = WEAPONS[this.sel];
    if (!this._isOwned(w)) return;
    this._starting = true;
    audio.play("click");
    // 记住装备
    Save.equip(this.save, "weapon", w.id);
    import("./BossScene.js").then((m) => {
      this.game.changeScene(new m.BossScene(this.game, this.level, w, this.carry));
    });
  }

  render(ctx) {
    const W = this.game.width, H = this.game.height;
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, this.level.sky[0]); g.addColorStop(1, this.level.sky[2]);
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);

    const boss = getLevelBoss(this.level);

    ctx.textAlign = "center"; ctx.textBaseline = "top";
    ctx.fillStyle = PALETTE.gold; ctx.font = "bold 18px monospace";
    ctx.shadowColor = PALETTE.gold; ctx.shadowBlur = 8;
    ctx.fillText("选择你的武器", W / 2, 24);
    ctx.shadowBlur = 0;
    ctx.fillStyle = PALETTE.text; ctx.font = "11px monospace";
    ctx.fillText(`即将挑战 · ${boss.name}`, W / 2, 50);

    const rects = this._cardRects();
    for (let i = 0; i < WEAPONS.length; i++) {
      const w = WEAPONS[i];
      const r = rects[i];
      const on = i === this.sel;
      const owned = this._isOwned(w);

      ctx.fillStyle = "rgba(42,26,58,0.9)";
      ctx.fillRect(r.x, r.y, r.w, r.h);
      ctx.strokeStyle = on ? PALETTE.gold : w.color;
      ctx.lineWidth = on ? 2 : 1;
      if (on) { ctx.shadowColor = PALETTE.gold; ctx.shadowBlur = 10; }
      ctx.strokeRect(r.x + 0.5, r.y + 0.5, r.w - 1, r.h - 1);
      ctx.shadowBlur = 0;

      ctx.textAlign = "center"; ctx.textBaseline = "top";
      ctx.fillStyle = w.color; ctx.font = "28px monospace";
      ctx.fillText(w.icon, r.x + r.w / 2, r.y + 8);
      ctx.fillStyle = PALETTE.text; ctx.font = "bold 11px monospace";
      ctx.fillText(w.name, r.x + r.w / 2, r.y + 44);

      ctx.fillStyle = "rgba(233,220,255,0.7)"; ctx.font = "8px monospace";
      this._wrap(ctx, w.desc, r.x + r.w / 2, r.y + 62, r.w - 12, 10);

      if (!owned) {
        ctx.fillStyle = "rgba(10,5,18,0.6)"; ctx.fillRect(r.x, r.y, r.w, r.h);
        ctx.fillStyle = "rgba(220,210,240,0.85)"; ctx.font = "10px monospace";
        ctx.fillText("🔒 商店解锁", r.x + r.w / 2, r.y + r.h / 2 - 4);
      }
    }

    const w = WEAPONS[this.sel];
    const owned = this._isOwned(w);
    const sb = this._startBtn();
    ctx.fillStyle = owned ? "rgba(185,107,255,0.18)" : "rgba(80,70,95,0.25)";
    ctx.fillRect(sb.x, sb.y, sb.w, sb.h);
    ctx.strokeStyle = owned ? PALETTE.gold : "rgba(120,110,140,0.5)"; ctx.lineWidth = 1;
    ctx.strokeRect(sb.x + 0.5, sb.y + 0.5, sb.w - 1, sb.h - 1);
    ctx.fillStyle = owned ? PALETTE.gold : "rgba(180,170,200,0.6)";
    ctx.font = "12px monospace"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
    ctx.fillText(owned ? "⚔ 进入弹幕战" : "该武器需在商店购买", sb.x + sb.w / 2, sb.y + sb.h / 2 + 1);

    ctx.fillStyle = "rgba(233,220,255,0.4)"; ctx.font = "8px monospace"; ctx.textBaseline = "top";
    ctx.fillText("← → / 点击选择 · Enter 确认", W / 2, H - 14);
    ctx.textAlign = "left";
  }

  _wrap(ctx, text, cx, y, maxW, lh) {
    const chars = text.split("");
    let line = "", yy = y;
    for (const ch of chars) {
      const test = line + ch;
      if (ctx.measureText(test).width > maxW && line) { ctx.fillText(line, cx, yy); line = ch; yy += lh; }
      else line = test;
    }
    if (line) ctx.fillText(line, cx, yy);
  }
}
