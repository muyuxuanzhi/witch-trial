// 图鉴：从主菜单进入，分三页展示——角色设定 / Buff 增益 / Boss 敌人。
// 键盘：←→切换分页 / ↑↓滚动 / Esc 返回；触屏：点标签/点返回。
import { Scene } from "../engine/Scene.js";
import { PALETTE } from "../engine/Game.js";
import { BUFFS } from "../data/buffs.js";
import { BOSSES } from "../data/bosses.js";
import { WITCH_FORMS } from "../data/witchForms.js";
import { MenuScene } from "./MenuScene.js";
import { audio } from "../engine/Audio.js";

// 角色设定图（仓库 assets 目录）
const CHAR_IMG = new Image();
CHAR_IMG.src = "assets/witch-character.png";
const GOLDEN_IMG = new Image();
GOLDEN_IMG.src = "assets/golden-witch.png";

const TABS = ["角色", "Buff 增益", "Boss 图鉴"];

export class CodexScene extends Scene {
  constructor(game) {
    super(game);
    this.t = 0;
    this.tab = 0;
    this.scroll = 0;       // Boss/Buff 页滚动偏移
  }

  _backBtn() { return { x: 8, y: 6, w: 54, h: 18 }; }
  _tabRects() {
    const W = this.game.width;
    const tw = Math.min(96, (W - 80) / TABS.length);
    const startX = W - 12 - tw * TABS.length;
    return TABS.map((_, i) => ({ x: startX + i * tw, y: 6, w: tw - 4, h: 18 }));
  }

  update(dt, input) {
    this.t += dt;

    if (input.justPressed("escape", "backspace") || input.tapIn(this._backBtn())) {
      audio.play("click");
      this.game.changeScene(new MenuScene(this.game));
      return;
    }
    if (input.justPressed("arrowleft", "a")) { this.tab = (this.tab + TABS.length - 1) % TABS.length; this.scroll = 0; }
    if (input.justPressed("arrowright", "d")) { this.tab = (this.tab + 1) % TABS.length; this.scroll = 0; }
    if (input.justPressed("arrowdown", "s")) this.scroll += 24;
    if (input.justPressed("arrowup", "w")) this.scroll = Math.max(0, this.scroll - 24);

    // 触屏：点标签切页
    if (input.pointer && input.pointer.justDown) {
      const tr = this._tabRects();
      for (let i = 0; i < tr.length; i++) if (input.tapIn(tr[i])) { audio.play("click"); this.tab = i; this.scroll = 0; }
    }
  }

  render(ctx) {
    const W = this.game.width, H = this.game.height;
    // 背景
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, "#160a26");
    g.addColorStop(1, "#0d0619");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);

    // 顶栏
    ctx.textAlign = "left"; ctx.textBaseline = "middle";
    const bb = this._backBtn();
    ctx.fillStyle = "rgba(185,107,255,0.18)";
    ctx.fillRect(bb.x, bb.y, bb.w, bb.h);
    ctx.strokeStyle = "rgba(185,107,255,0.5)"; ctx.lineWidth = 1;
    ctx.strokeRect(bb.x + 0.5, bb.y + 0.5, bb.w - 1, bb.h - 1);
    ctx.fillStyle = PALETTE.text; ctx.font = "10px monospace";
    ctx.fillText("‹ 返回", bb.x + 8, bb.y + bb.h / 2 + 1);

    ctx.fillStyle = PALETTE.gold; ctx.font = "bold 13px monospace";
    ctx.fillText("图鉴 CODEX", bb.x + bb.w + 12, bb.y + bb.h / 2 + 1);

    // 分页标签
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

    // 内容区裁剪
    const top = 32;
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, top, W, H - top - 14);
    ctx.clip();

    if (this.tab === 0) this._renderCharacter(ctx, W, H, top);
    else if (this.tab === 1) this._renderBuffs(ctx, W, H, top);
    else this._renderBosses(ctx, W, H, top);

    ctx.restore();

    // 底部提示
    ctx.textAlign = "center"; ctx.textBaseline = "middle";
    ctx.fillStyle = "rgba(233,220,255,0.4)"; ctx.font = "8px monospace";
    ctx.fillText("←→ 切换页 · ↑↓ 滚动 · Esc 返回", W / 2, H - 7);
    ctx.textAlign = "left";
  }

  // ===== 角色页 =====
  _renderCharacter(ctx, W, H, top) {
    // 上半：叶林（见习魔女） 下半：黄金魔女
    const halfH = (H - top - 14) / 2;
    this._renderYelin(ctx, W, top, halfH);
    const sep = top + halfH;
    // 分隔线
    ctx.fillStyle = "rgba(185,107,255,0.2)";
    ctx.fillRect(16, sep - 0.5, W - 32, 1);
    this._renderGoldenWitch(ctx, W, sep + 4, halfH - 4);
  }

  // 叶林
  _renderYelin(ctx, W, top, halfH) {
    const imgW = Math.min(80, W * 0.22);
    const imgX = 16, imgY = top + 6;
    const ratio = (CHAR_IMG.naturalHeight && CHAR_IMG.naturalWidth) ? (CHAR_IMG.naturalHeight / CHAR_IMG.naturalWidth) : 1;
    const ih = Math.min(halfH - 14, imgW * ratio);
    const iw = ih / ratio;
    ctx.save();
    ctx.strokeStyle = "rgba(185,107,255,0.5)"; ctx.lineWidth = 1;
    ctx.strokeRect(imgX, imgY, iw, ih);
    if (CHAR_IMG.complete && CHAR_IMG.naturalWidth) ctx.drawImage(CHAR_IMG, imgX, imgY, iw, ih);
    else {
      ctx.fillStyle = "rgba(255,255,255,0.06)"; ctx.fillRect(imgX, imgY, iw, ih);
      ctx.fillStyle = "rgba(233,220,255,0.5)"; ctx.font = "8px monospace"; ctx.textAlign = "center";
      ctx.fillText("加载中", imgX + iw / 2, imgY + ih / 2);
    }
    ctx.restore();

    // 右侧文字（紧凑）
    const tx = imgX + iw + 12;
    let ty = top + 4;
    ctx.textAlign = "left"; ctx.textBaseline = "top";
    ctx.fillStyle = PALETTE.gold; ctx.font = "bold 12px monospace";
    ctx.fillText("叶林 · 见习魔女", tx, ty); ty += 16;

    ctx.font = "8px monospace"; ctx.fillStyle = "rgba(233,220,255,0.85)";
    const lines = [
      "森林魔女学院的见习生，元气活泼、好",
      "奇莽撞又坚韧。并非天赋型魔女，被评",
      "为「勉强及格」，却坚信集齐星光就能",
      "证明自己。为通过正式魔女的试炼，踏",
      "上五段秘境旅程。",
    ];
    for (const l of lines) { ctx.fillText(l, tx, ty); ty += 11; }
    ty += 2;

    ctx.fillStyle = PALETTE.neon; ctx.font = "9px monospace";
    ctx.fillText("形态进化线", tx, ty); ty += 12;
    ctx.font = "8px monospace";
    const formColors = ["#8fb8ff", "#b96bff", "#d08bff", "#ffcf5c"];
    for (let i = 0; i < WITCH_FORMS.length; i++) {
      const f = WITCH_FORMS[i];
      ctx.fillStyle = formColors[i] || "#fff";
      ctx.fillText(`◆ ${f.name} (${f.threshold})`, tx, ty);
      ty += 11;
    }
  }

  // 黄金魔女
  _renderGoldenWitch(ctx, W, top, halfH) {
    const imgW = Math.min(80, W * 0.22);
    const imgX = 16, imgY = top + 6;
    const ratio = (GOLDEN_IMG.naturalHeight && GOLDEN_IMG.naturalWidth) ? (GOLDEN_IMG.naturalHeight / GOLDEN_IMG.naturalWidth) : 1;
    const ih = Math.min(halfH - 14, imgW * ratio);
    const iw = ih / ratio;
    ctx.save();
    // 金色描边（黄金魔女专属）
    ctx.strokeStyle = "#ffcf5c"; ctx.lineWidth = 2;
    ctx.shadowColor = "#ffcf5c"; ctx.shadowBlur = 6;
    ctx.strokeRect(imgX, imgY, iw, ih);
    ctx.shadowBlur = 0;
    if (GOLDEN_IMG.complete && GOLDEN_IMG.naturalWidth) ctx.drawImage(GOLDEN_IMG, imgX, imgY, iw, ih);
    else {
      ctx.fillStyle = "rgba(255,255,255,0.06)"; ctx.fillRect(imgX, imgY, iw, ih);
      ctx.fillStyle = "rgba(255,207,92,0.6)"; ctx.font = "8px monospace"; ctx.textAlign = "center";
      ctx.fillText("加载中", imgX + iw / 2, imgY + ih / 2);
    }
    ctx.restore();

    // 右侧文字
    const tx = imgX + iw + 12;
    let ty = top + 4;
    ctx.textAlign = "left"; ctx.textBaseline = "top";
    ctx.fillStyle = "#ffcf5c"; ctx.font = "bold 12px monospace";
    ctx.shadowColor = "#ffcf5c"; ctx.shadowBlur = 4;
    ctx.fillText("露娜 · 黄金魔女", tx, ty);
    ctx.shadowBlur = 0;
    ty += 16;

    ctx.font = "8px monospace"; ctx.fillStyle = "rgba(255,247,200,0.9)";
    const lines = [
      "慵懒的电波系魔女。爱吃甜食尤其钟爱坚",
      "果巧克力，喜欢一切金灿灿的东西。曾经",
      "立下豪言——若叶林能通过试炼，就给",
      "她买 10 万箱金箔坚果巧克力！",
    ];
    for (const l of lines) { ctx.fillText(l, tx, ty); ty += 11; }
    ty += 4;

    ctx.fillStyle = "#ffcf5c"; ctx.font = "9px monospace";
    ctx.fillText("「为了金灿灿和甜品……power！！！」", tx, ty);
  }

  // ===== Buff 页 =====
  _renderBuffs(ctx, W, H, top) {
    const cardH = 40, gap = 8, cardW = W - 32;
    let y = top + 10 - this.scroll;
    ctx.textAlign = "left";
    for (const b of BUFFS) {
      //卡片
      ctx.fillStyle = "rgba(255,255,255,0.05)";
      ctx.fillRect(16, y, cardW, cardH);
      ctx.strokeStyle = b.color; ctx.lineWidth = 1;
      ctx.strokeRect(16.5, y + 0.5, cardW - 1, cardH - 1);
      // 图标
      ctx.fillStyle = b.color; ctx.font = "20px monospace"; ctx.textBaseline = "middle";
      ctx.fillText(b.icon, 26, y + cardH / 2);
      // 名称+描述
      ctx.fillStyle = b.color; ctx.font = "bold 11px monospace"; ctx.textBaseline = "top";
      ctx.fillText(b.name, 52, y + 7);
      ctx.fillStyle = "rgba(233,220,255,0.8)"; ctx.font = "8px monospace";
      let desc = b.desc;
      // 破障魔法：补充地狱难度特殊说明
      if (b.id === "smash") desc = b.desc + "（地狱难度：每层耐撞翻倍 3→6→12）";
      ctx.fillText(desc, 52, y + 23);
      y += cardH + gap;
    }
    this._maxScroll = Math.max(0, y + this.scroll - (H - 20));
  }

  // ===== Boss 页 =====
  _renderBosses(ctx, W, H, top) {
    const cardH = 46, gap = 8, cardW = W - 32;
    let y = top + 10 - this.scroll;
    ctx.textAlign = "left";
    for (let i = 0; i < BOSSES.length; i++) {
      const b = BOSSES[i];
      ctx.fillStyle = "rgba(255,255,255,0.05)";
      ctx.fillRect(16, y, cardW, cardH);
      ctx.strokeStyle = b.color; ctx.lineWidth = 1;
      ctx.strokeRect(16.5, y + 0.5, cardW - 1, cardH - 1);
      // 关卡序号色块
      ctx.fillStyle = b.color;
      ctx.fillRect(16, y, 4, cardH);
      // 名称
      ctx.fillStyle = b.color; ctx.font = "bold 11px monospace"; ctx.textBaseline = "top";
      ctx.fillText(`第${i + 1}关 · ${b.name}`, 30, y + 6);
      // 描述
      ctx.fillStyle = "rgba(233,220,255,0.8)"; ctx.font = "8px monospace";
      ctx.fillText(b.desc, 30, y + 20);
      // 数值
      ctx.fillStyle = "rgba(255,207,92,0.85)"; ctx.font = "8px monospace";
      ctx.fillText(`HP ${b.hp} · 弹幕 ${b.patterns.length} 种 · 地狱 HP×3`, 30, y + 32);
      y += cardH + gap;
    }
  }
}
