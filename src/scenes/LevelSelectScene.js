// 选关界面：展示 5 个关卡（已解锁/锁定/已通关），点击进入 IntroScene → RunScene。
import { Scene } from "../engine/Scene.js";
import { PALETTE } from "../engine/Game.js";
import { Background } from "../systems/Background.js";
import { Save } from "../systems/Save.js";
import { getSkin } from "../data/skins.js";
import { LEVELS, TOTAL_LEVELS, makeEndlessLevel } from "../data/levels.js";
import { getBossById } from "../data/bosses.js";
import { MenuScene } from "./MenuScene.js";
import { IntroScene } from "./IntroScene.js";
import { audio } from "../engine/Audio.js";

export class LevelSelectScene extends Scene {
  constructor(game) {
    super(game);
    this.t = 0;
    this.save = Save.load();
    this.bg = new Background(game.width, game.height, getSkin("background", this.save.equipped.background));
    this.sel = Math.min(this.save.unlockedLevel - 1, TOTAL_LEVELS - 1);
  }

  onEnter() { this.save = Save.load(); }

  _backBtn() { return { x: 8, y: 6, w: 54, h: 18 }; }

  _cardRects() {
    const W = this.game.width;
    const n = LEVELS.length;
    const cw = 82, gap = 8;
    const totalW = cw * n + gap * (n - 1);
    const x0 = (W - totalW) / 2;
    const y = 70, h = 128;
    return LEVELS.map((_, i) => ({ x: x0 + i * (cw + gap), y, w: cw, h }));
  }

  _startBtn() {
    const W = this.game.width, H = this.game.height;
    return { x: W / 2 - 70, y: H - 40, w: 140, h: 24 };
  }

  // 无限模式入口按钮（开始按钮右侧）
  _endlessBtn() {
    const W = this.game.width, H = this.game.height;
    return { x: W / 2 + 76, y: H - 40, w: 96, h: 24 };
  }

  update(dt, input) {
    this.t += dt;
    this.bg.update(dt, 90);

    if (input.justPressed("escape", "backspace") || input.tapIn(this._backBtn())) {
      audio.play("click");
      this.game.changeScene(new MenuScene(this.game));
      return;
    }

    if (input.justPressed("arrowleft", "a")) this.sel = (this.sel + LEVELS.length - 1) % LEVELS.length;
    if (input.justPressed("arrowright", "d")) this.sel = (this.sel + 1) % LEVELS.length;

    const rects = this._cardRects();
    for (let i = 0; i < rects.length; i++) {
      if (input.tapIn(rects[i])) {
        if (Save.isLevelUnlocked(this.save, LEVELS[i].index)) {
          if (this.sel === i) this._enterLevel(i);
          else { audio.play("click"); this.sel = i; }
        } else {
          this.sel = i; // 锁定关也可选中看信息，但不能进入
        }
      }
    }

    if (input.tapIn(this._endlessBtn())) {
      this._enterEndless();
      return;
    }

    if (input.justPressed("enter", " ") || input.tapIn(this._startBtn())) {
  this._enterLevel(this.sel);
    }
  }

  _enterEndless() {
    audio.play("click");
    // 无限模式从第 1 轮开始，直接进入 IntroScene 走正常流程
    this.game.changeScene(new IntroScene(this.game, makeEndlessLevel(1)));
  }

  _enterLevel(i) {
    const lv = LEVELS[i];
    if (!Save.isLevelUnlocked(this.save, lv.index)) return;
    audio.play("click");
    this.game.changeScene(new IntroScene(this.game, lv));
  }

  render(ctx) {
    const W = this.game.width, H = this.game.height;
    this.bg.render(ctx, this.t);
    ctx.fillStyle = "rgba(20,10,31,0.6)";
    ctx.fillRect(0, 0, W, H);

    // 返回
    const back = this._backBtn();
    ctx.fillStyle = "rgba(185,107,255,0.14)"; ctx.fillRect(back.x, back.y, back.w, back.h);
    ctx.strokeStyle = PALETTE.neon; ctx.lineWidth = 1;
    ctx.strokeRect(back.x + 0.5, back.y + 0.5, back.w - 1, back.h - 1);
    ctx.fillStyle = PALETTE.neon; ctx.font = "10px monospace";
    ctx.textAlign = "center"; ctx.textBaseline = "middle";
    ctx.fillText("‹ 返回", back.x + back.w / 2, back.y + back.h / 2 + 1);

    // 标题
    ctx.textAlign = "center"; ctx.textBaseline = "top";
    ctx.fillStyle = PALETTE.text; ctx.font = "bold 18px monospace";
    ctx.shadowColor = PALETTE.neon; ctx.shadowBlur = 8;
    ctx.fillText("选择试炼", W / 2, 26);
    ctx.shadowBlur = 0;

    ctx.fillStyle = PALETTE.gold; ctx.font = "10px monospace";
    ctx.textAlign = "right";
    ctx.fillText(`金币 ${this.save.coins}`, W - 12, 10);

    // 关卡卡片
    const rects = this._cardRects();
    for (let i = 0; i < LEVELS.length; i++) {
      const lv = LEVELS[i];
      const r = rects[i];
      const unlocked = Save.isLevelUnlocked(this.save, lv.index);
      const cleared = Save.isLevelCleared(this.save, lv.id);
      const on = i === this.sel;

      // 卡背景
      const g = ctx.createLinearGradient(0, r.y, 0, r.y + r.h);
      g.addColorStop(0, lv.sky[0]); g.addColorStop(1, lv.sky[2]);
      ctx.fillStyle = g;
      ctx.fillRect(r.x, r.y, r.w, r.h);

      // 边框
      ctx.strokeStyle = on ? PALETTE.gold : (unlocked ? lv.accentA : "rgba(120,100,140,0.5)");
      ctx.lineWidth = on ? 2 : 1;
      if (on) { ctx.shadowColor = PALETTE.gold; ctx.shadowBlur = 10; }
      ctx.strokeRect(r.x + 0.5, r.y + 0.5, r.w - 1, r.h - 1);
      ctx.shadowBlur = 0;

      // 关卡序号
      ctx.textAlign = "center"; ctx.textBaseline = "top";
      ctx.fillStyle = unlocked ? lv.accentA : "rgba(180,170,200,0.6)";
      ctx.font = "bold 20px monospace";
      ctx.fillText(`${lv.index}`, r.x + r.w / 2, r.y + 8);

      // 名称
      ctx.fillStyle = unlocked ? PALETTE.text : "rgba(180,170,200,0.6)";
      ctx.font = "bold 11px monospace";
      ctx.fillText(lv.name, r.x + r.w / 2, r.y + 34);

      // Boss 小图标区
      this._drawBossMini(ctx, r.x + r.w / 2, r.y + 70, lv, unlocked);

      // 状态标记
      if (!unlocked) {
        // 锁
        ctx.fillStyle = "rgba(10,5,18,0.55)";
        ctx.fillRect(r.x, r.y, r.w, r.h);
        ctx.fillStyle = "rgba(220,210,240,0.85)";
        ctx.font = "22px monospace";
        ctx.fillText("🔒", r.x + r.w / 2, r.y + r.h / 2 - 12);
        ctx.font = "9px monospace";
        ctx.fillStyle = "rgba(220,210,240,0.7)";
        ctx.fillText("未解锁", r.x + r.w / 2, r.y + r.h / 2 + 14);
      } else if (cleared) {
        ctx.fillStyle = PALETTE.gold;
        ctx.font = "10px monospace";
        ctx.fillText("★ 已通关", r.x + r.w / 2, r.y + r.h - 18);
      } else {
        ctx.fillStyle = lv.accentB;
        ctx.font = "9px monospace";
        ctx.fillText("挑战", r.x + r.w / 2, r.y + r.h - 18);
      }
    }

    // 选中关信息
    const lv = LEVELS[this.sel];
    const boss = getBossById(lv.bossId);
    ctx.textAlign = "center"; ctx.textBaseline = "top";
    ctx.fillStyle = PALETTE.text; ctx.font = "11px monospace";
    ctx.fillText(`${lv.subtitle} · Boss：${boss.name}`, W / 2, 208);
    ctx.fillStyle = "rgba(233,220,255,0.65)"; ctx.font = "9px monospace";
    ctx.fillText(lv.desc, W / 2, 224);

    // 开始按钮
    const unlocked = Save.isLevelUnlocked(this.save, lv.index);
    const sb = this._startBtn();
    ctx.fillStyle = unlocked ? "rgba(185,107,255,0.18)" : "rgba(80,70,95,0.25)";
    ctx.fillRect(sb.x, sb.y, sb.w, sb.h);
    ctx.strokeStyle = unlocked ? PALETTE.gold : "rgba(120,110,140,0.5)"; ctx.lineWidth = 1;
    ctx.strokeRect(sb.x + 0.5, sb.y + 0.5, sb.w - 1, sb.h - 1);
    ctx.fillStyle = unlocked ? PALETTE.gold : "rgba(180,170,200,0.6)";
    ctx.font = "12px monospace"; ctx.textBaseline = "middle";
    ctx.fillText(unlocked ? "▶ 开始试炼" : "尚未解锁", sb.x + sb.w / 2, sb.y + sb.h / 2 + 1);

    // 无限模式按钮
    const eb = this._endlessBtn();
 ctx.fillStyle = "rgba(255,139,208,0.16)";
    ctx.fillRect(eb.x, eb.y, eb.w, eb.h);
    ctx.strokeStyle = PALETTE.danger; ctx.lineWidth = 1;
  ctx.shadowColor = PALETTE.danger; ctx.shadowBlur = 6 + Math.sin(this.t * 4) * 3;
    ctx.strokeRect(eb.x + 0.5, eb.y + 0.5, eb.w - 1, eb.h - 1);
    ctx.shadowBlur = 0;
    ctx.fillStyle = PALETTE.danger;
    ctx.font = "11px monospace"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
    ctx.fillText("♾ 无限模式", eb.x + eb.w / 2, eb.y + eb.h / 2 + 1);

    ctx.textAlign = "left"; ctx.textBaseline = "alphabetic";
  }

  // 卡片上的 Boss 缩略图标
  _drawBossMini(ctx, cx, cy, lv, unlocked) {
    const col = unlocked ? lv.accentA : "rgba(120,110,140,0.5)";
    ctx.save();
    ctx.translate(cx, cy);
    ctx.fillStyle = col;
    ctx.strokeStyle = unlocked ? lv.accentB : "rgba(120,110,140,0.5)";
    ctx.lineWidth = 1;
    const boss = getBossById(lv.bossId);
    if (boss.shape === "mushroom") {
      ctx.beginPath(); ctx.arc(0, -3, 9, Math.PI, 0); ctx.fill();
      ctx.fillRect(-4, -3, 8, 10);
    } else if (boss.shape === "vine") {
      ctx.beginPath();
      ctx.moveTo(-8, 8);
      ctx.quadraticCurveTo(-4, -6, 0, 4);
      ctx.quadraticCurveTo(4, -8, 8, 6);
      ctx.lineWidth = 2; ctx.strokeStyle = col; ctx.stroke();
    } else if (boss.shape === "golem") {
      ctx.beginPath();
      ctx.moveTo(0, -10); ctx.lineTo(9, -2); ctx.lineTo(6, 9); ctx.lineTo(-6, 9); ctx.lineTo(-9, -2);
      ctx.closePath(); ctx.fill();
    } else if (boss.shape === "ghost") {
      ctx.beginPath(); ctx.arc(0, -2, 9, Math.PI, 0);
      ctx.lineTo(9, 8); ctx.lineTo(4, 4); ctx.lineTo(0, 8); ctx.lineTo(-4, 4); ctx.lineTo(-9, 8);
      ctx.closePath(); ctx.fill();
    } else {
      // witch
      ctx.beginPath(); ctx.moveTo(0, -12); ctx.lineTo(-8, 2); ctx.lineTo(8, 2); ctx.closePath(); ctx.fill();
      ctx.fillRect(-9, 2, 18, 3);
      ctx.beginPath(); ctx.arc(0, 8, 5, 0, Math.PI * 2); ctx.fill();
    }
    ctx.restore();
  }
}
