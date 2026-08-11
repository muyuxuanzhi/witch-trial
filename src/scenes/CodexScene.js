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
    if (input.justPressed("arrowdown", "s") || input.swipeDown) this.scroll += 24;
    if (input.justPressed("arrowup", "w") || input.swipeUp) this.scroll = Math.max(0, this.scroll - 24);
    // 滚动范围由各 render 方法设置 _maxScroll，在此统一钳制
    if (this._maxScroll != null && this.scroll > this._maxScroll) this.scroll = this._maxScroll;

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

  // ===== 角色页（可滚动，每角色独立卡片不硬挤）=====
  _renderCharacter(ctx, W, H, top) {
    const blockH = 130, gap = 16;
    let y = top + 8 - this.scroll;
    // 叶林卡片
    y = this._renderCharBlock(ctx, W, y, blockH,
      CHAR_IMG, "叶林 · 森林魔女", "rgba(185,107,255,0.5)", PALETTE.gold, [
      "森林魔女学院的见习生，元气活泼、好奇",
      "莽撞又坚韧。并非天赋型魔女，被评",
      "为「勉强及格」，却坚信集齐星光就能证",
      "明自己。为通过正式魔女试炼，踏上五段",
      "秘境旅程。",
    ], [
      "形态进化线",
      WITCH_FORMS.map((f, i) => `◆ ${f.name} (试炼值 ${f.threshold})`).join("\n"),
      "口头禅：「深呼吸……我准备好了！」",
    ], ["#8fb8ff", "#b96bff", "#d08bff", "#ffcf5c"]);
    y += gap;
    // 分隔线
    ctx.fillStyle = "rgba(185,107,255,0.15)";
    ctx.fillRect(16, y - gap / 2 - 0.5, W - 32, 1);
    // 黄金魔女卡片
    y = this._renderCharBlock(ctx, W, y, blockH,
      GOLDEN_IMG, "露娜 · 黄金魔女", "#ffcf5c", "#ffcf5c", [
      "慵懒的电波系魔女。爱吃甜食尤其钟爱",
      "坚果巧克力，喜欢一切金灿灿的东西。",
      "曾立下豪言——通过试炼的话，就给自己",
      "买 10 万箱金箔坚果巧克力！",
    ], [
      "可通过商城解锁皮肤（150 金币）",
      "解锁后同样从森林魔女初始形态开始。",
      "口头禅：「为了金灿灿和甜品……power！！！」",
    ], []);
    const totalH = y + gap;
    this._maxScroll = Math.max(0, totalH + this.scroll - (H - 20));
  }

  // 通用角色卡片（可滚动复用）
  _renderCharBlock(ctx, W, y0, blockH, img, name, strokeColor, nameColor, descLines, infoLines, colors) {
    const imgW = Math.min(80, W * 0.22);
    const imgX = 16, imgY = y0 + 6;
    const ratio = (img.naturalHeight && img.naturalWidth) ? (img.naturalHeight / img.naturalWidth) : 1;
    const ih = Math.min(blockH - 16, imgW * ratio);
    const iw = ih / ratio;
    // 卡片底
    ctx.fillStyle = "rgba(255,255,255,0.03)";
    ctx.fillRect(14, y0, W - 28, blockH);
    // 图片
    ctx.save();
    ctx.strokeStyle = strokeColor; ctx.lineWidth = nameColor === "#ffcf5c" ? 2 : 1;
    ctx.shadowColor = strokeColor; ctx.shadowBlur = nameColor === "#ffcf5c" ? 6 : 0;
    ctx.strokeRect(imgX, imgY, iw, ih);
    ctx.shadowBlur = 0;
    if (img.complete && img.naturalWidth) ctx.drawImage(img, imgX, imgY, iw, ih);
    else {
      ctx.fillStyle = "rgba(255,255,255,0.06)"; ctx.fillRect(imgX, imgY, iw, ih);
      ctx.fillStyle = "rgba(233,220,255,0.5)"; ctx.font = "8px monospace"; ctx.textAlign = "center";
      ctx.fillText("加载中", imgX + iw / 2, imgY + ih / 2);
    }
    ctx.restore();

    const tx = imgX + iw + 16;
    let ty = y0 + 4;
    ctx.textAlign = "left"; ctx.textBaseline = "top";
    ctx.fillStyle = nameColor; ctx.font = "bold 12px monospace";
    if (nameColor === "#ffcf5c") { ctx.shadowColor = "#ffcf5c"; ctx.shadowBlur = 4; }
    ctx.fillText(name, tx, ty);
    ctx.shadowBlur = 0;
    ty += 16;

    // 描述
    ctx.font = "8px monospace"; ctx.fillStyle = nameColor === "#ffcf5c" ? "rgba(255,247,200,0.85)" : "rgba(233,220,255,0.85)";
    for (const l of descLines) { ctx.fillText(l, tx, ty); ty += 11; }
    ty += 2;

    // 额外信息
    if (infoLines.length) {
      ctx.fillStyle = nameColor === "#ffcf5c" ? "#ffd94a" : PALETTE.neon;
      ctx.font = "8px monospace";
      for (const l of infoLines) {
        if (l.startsWith("◆")) {
          // 进化形态条目用对应颜色
          const idx = infoLines.indexOf(l);
          if (idx < colors.length) ctx.fillStyle = colors[idx] || (nameColor === "#ffcf5c" ? "#ffd94a" : PALETTE.neon);
        }
        ctx.fillText(l, tx, ty);
        ty += 11;
      }
    }
    return y0 + blockH;
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
