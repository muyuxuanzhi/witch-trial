// 成就界面：分两页（普通 / 隐藏）。菱形图标，每个不同。
// 触屏：点标签切换 / 点卡片无操作，仅展示。
// 键盘：← → 翻页；Esc / 返回返回主菜单。
import { Scene } from "../engine/Scene.js";
import { PALETTE } from "../engine/Game.js";
import { Save } from "../systems/Save.js";
import { ACHIEVEMENTS, ACHIEVEMENT_ICONS, ACHIEVEMENT_TOTAL, setAchievementRenderContext, countUnlocked } from "../data/achievements.js";
import { MenuScene } from "./MenuScene.js";
import { audio } from "../engine/Audio.js";
import { ACHIEVEMENTS as ACH_LIST } from "../data/achievements.js";

const TABS = ["全部成就", "隐藏成就"];

export class AchievementsScene extends Scene {
  constructor(game) {
    super(game);
    this.t = 0;
    this.tab = 0;
    this.save = Save.load();
    this._toastT = 0;     // 刚刚解锁的成就 toast 显示计时
    this._toastList = []; // 本场景内解锁的成就
  }

  _backBtn() { return { x: 8, y: 6, w: 54, h: 18 }; }
  _tabRects() {
    const W = this.game.width;
    const tw = Math.min(96, (W - 80) / TABS.length);
    const startX = W - 12 - tw * TABS.length;
    return TABS.map((_, i) => ({ x: startX + i * tw, y: 6, w: tw - 4, h: 18 }));
  }

  // 解锁检查 + toast（在本场景内触发时显示）
  _check() {
    const newly = Save.checkAchievements(this.save);
    if (newly && newly.length) {
      this._toastList.push(...newly);
      this._toastT = 2.5;
    }
  }

  update(dt, input) {
    this.t += dt;
    if (this._toastT > 0) this._toastT -= dt;

    // 进入成就界面时跑一次完整检查（之前漏触发的成就可在此刻解锁并 toast）
    if (!this._checked) {
      this._checked = true;
      this.save = Save.load();
      const newly = Save.checkAchievements(this.save, ACH_LIST);
      if (newly.length) {
        this._toastList.push(...newly);
        this._toastT = 2.5;
      }
    }

    if (input.justPressed("escape", "backspace") || input.tapIn(this._backBtn())) {
      audio.play("click");
      this.game.changeScene(new MenuScene(this.game));
      return;
    }
    if (input.justPressed("arrowleft", "a")) this.tab = (this.tab + TABS.length - 1) % TABS.length;
    if (input.justPressed("arrowright", "d")) this.tab = (this.tab + 1) % TABS.length;

    if (input.pointer && input.pointer.justDown) {
      const tr = this._tabRects();
      for (let i = 0; i < tr.length; i++) {
        if (input.tapIn(tr[i])) { audio.play("click"); this.tab = i; }
      }
    }
  }

  render(ctx) {
    setAchievementRenderContext(ctx);
    const W = this.game.width, H = this.game.height;
    // 背景
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, "#160a26");
    g.addColorStop(1, "#0d0619");
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);

    // 顶栏
    const bb = this._backBtn();
    ctx.fillStyle = "rgba(185,107,255,0.18)"; ctx.fillRect(bb.x, bb.y, bb.w, bb.h);
    ctx.strokeStyle = "rgba(185,107,255,0.5)"; ctx.lineWidth = 1;
    ctx.strokeRect(bb.x + 0.5, bb.y + 0.5, bb.w - 1, bb.h - 1);
    ctx.fillStyle = PALETTE.text; ctx.font = "10px monospace";
    ctx.textAlign = "left"; ctx.textBaseline = "middle";
    ctx.fillText("‹ 返回", bb.x + 8, bb.y + bb.h / 2 + 1);

    ctx.fillStyle = PALETTE.gold; ctx.font = "bold 13px monospace";
    ctx.fillText("成就 ACHIEVEMENTS", bb.x + bb.w + 12, bb.y + bb.h / 2 + 1);

    // 计数
    const total = ACHIEVEMENT_TOTAL;
    const unlocked = countUnlocked(this.save);
    ctx.fillStyle = "rgba(233,220,255,0.7)"; ctx.font = "10px monospace";
    ctx.textAlign = "right";
    ctx.fillText(`解锁 ${unlocked} / ${total}`, W - 12, 32);

    // 分页
    const tr = this._tabRects();
    ctx.font = "10px monospace"; ctx.textAlign = "center";
    for (let i = 0; i < TABS.length; i++) {
      const r = tr[i], on = i === this.tab;
      ctx.fillStyle = on ? "rgba(255,207,92,0.22)" : "rgba(255,255,255,0.05)";
      ctx.fillRect(r.x, r.y, r.w, r.h);
      if (on) { ctx.strokeStyle = PALETTE.gold; ctx.strokeRect(r.x + 0.5, r.y + 0.5, r.w - 1, r.h - 1); }
      ctx.fillStyle = on ? PALETTE.gold : "rgba(233,220,255,0.6)";
      ctx.fillText(TABS[i], r.x + r.w / 2, r.y + r.h / 2 + 1);
    }

    // 内容
    const top = 42;
    const cardH = 50, gap = 6;
    const list = ACHIEVEMENTS.filter((a) => this.tab === 0 ? !a.hidden : a.hidden);
    const startY = top + 6;
    ctx.save();
    ctx.beginPath(); ctx.rect(0, top, W, H - top - 14); ctx.clip();

    let y = startY;
    for (const a of list) {
      if (y > H) break;
      this._renderCard(ctx, a, W, y, cardH);
      y += cardH + gap;
    }
    ctx.restore();

    // 底部提示
    ctx.textAlign = "center"; ctx.textBaseline = "middle";
    ctx.fillStyle = "rgba(233,220,255,0.4)"; ctx.font = "8px monospace";
    ctx.fillText("←→ 切换页 · Esc 返回", W / 2, H - 7);
    ctx.textAlign = "left";

    // Toast
    if (this._toastT > 0 && this._toastList.length) {
      this._renderToast(ctx, W, H);
    }
  }

  _renderCard(ctx, a, W, y, cardH) {
    const unlocked = !!(this.save.achievements && this.save.achievements[a.id]);
    const hiddenUnlocked = unlocked && a.hidden;
    // 普通隐藏（未解锁）显示 ???；普通隐藏（解锁）正常显示
    const showSecret = a.hidden && !unlocked;

    // 卡片底
    ctx.fillStyle = unlocked ? "rgba(255,207,92,0.07)" : "rgba(255,255,255,0.04)";
    ctx.fillRect(16, y, W - 32, cardH);
    ctx.strokeStyle = unlocked ? PALETTE.gold : "rgba(120,100,140,0.4)";
    ctx.lineWidth = unlocked ? 2 : 1;
    if (unlocked) { ctx.shadowColor = PALETTE.gold; ctx.shadowBlur = 6; }
    ctx.strokeRect(16.5, y + 0.5, W - 33, cardH - 1);
    ctx.shadowBlur = 0;

    // 图标菱形（22x22 居中于图标格内）
    const iconCx = 16 + 28, iconCy = y + cardH / 2;
    if (showSecret) {
      // 隐藏未解锁：灰色菱形 + 问号
      ctx.fillStyle = "rgba(60,40,80,0.8)";
      ctx.beginPath();
      ctx.moveTo(iconCx, iconCy - 11);
      ctx.lineTo(iconCx + 11, iconCy);
      ctx.lineTo(iconCx, iconCy + 11);
      ctx.lineTo(iconCx - 11, iconCy);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = "rgba(180,160,200,0.7)"; ctx.lineWidth = 1;
      ctx.stroke();
      ctx.fillStyle = "rgba(220,210,240,0.7)";
      ctx.font = "bold 11px monospace";
      ctx.textAlign = "center"; ctx.textBaseline = "middle";
      ctx.fillText("?", iconCx, iconCy + 1);
    } else {
      ACHIEVEMENT_ICONS[a.iconKind](iconCx, iconCy, a.iconColor, a.iconAccent);
      // 锁定状态：灰度覆盖
      if (!unlocked) {
        ctx.fillStyle = "rgba(20,10,31,0.6)";
        ctx.beginPath();
        ctx.arc(iconCx, iconCy, 12, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // 文字
    ctx.textAlign = "left"; ctx.textBaseline = "top";
    const tx = 16 + 50;
    ctx.fillStyle = unlocked ? PALETTE.gold : "rgba(220,210,240,0.7)";
    ctx.font = "bold 12px monospace";
    ctx.fillText(showSecret ? "???" : a.name, tx, y + 8);

    ctx.fillStyle = unlocked ? "rgba(233,220,255,0.85)" : "rgba(180,170,200,0.55)";
    ctx.font = "9px monospace";
    const desc = showSecret ? a.hint : a.desc;
    this._wrapText(ctx, desc, tx, y + 25, W - tx - 30, 11);

    // 状态角标
    ctx.fillStyle = unlocked ? PALETTE.gold : "rgba(220,210,240,0.45)";
    ctx.font = "10px monospace";
    ctx.textAlign = "right"; ctx.textBaseline = "middle";
    ctx.fillText(unlocked ? "★ 已解锁" : (showSecret ? "???" : "未解锁"), W - 24, y + cardH / 2);
    ctx.textAlign = "left";
  }

  _wrapText(ctx, text, x, y, maxW, lh) {
    // 简单按字符宽度截断（中文字符用近似宽度 9px 处理；先按 split 后累加）
    if (!text) return;
    const chars = text.split("");
    let line = "";
    let yy = y;
    for (const ch of chars) {
      const test = line + ch;
      if (ctx.measureText(test).width > maxW && line) {
        ctx.fillText(line, x, yy);
        line = ch; yy += lh;
      } else line = test;
    }
    if (line) ctx.fillText(line, x, yy);
  }

  _renderToast(ctx, W, H) {
    // 顶部 toast 条
    const a = this._toastList[0];
    if (!a) return;
    const tw = W - 32, th = 36;
    const ty = 50 + Math.max(0, (1 - Math.min(1, this._toastT * 2)) * -20);
    ctx.fillStyle = "rgba(20,10,31,0.92)";
    ctx.fillRect(16, ty, tw, th);
    ctx.strokeStyle = PALETTE.gold; ctx.lineWidth = 1;
    ctx.strokeRect(16.5, ty + 0.5, tw - 1, th - 1);
    ctx.fillStyle = PALETTE.gold; ctx.font = "bold 10px monospace";
    ctx.textAlign = "left"; ctx.textBaseline = "top";
    ctx.fillText("✦ 成就解锁", 22, ty + 5);
    ctx.fillStyle = PALETTE.text; ctx.font = "11px monospace";
    ctx.fillText(a.name, 22, ty + 19);
    // 右侧图标小菱形
    ACHIEVEMENT_ICONS[a.iconKind](tw + 16 - 18, ty + th / 2, a.iconColor, a.iconAccent);
  }
}