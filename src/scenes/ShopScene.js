// 商城：键盘(←→分类/↑↓选择/Enter/Esc) + 触屏(点分类标签/皮肤行/购买按钮/返回)
import { Scene } from "../engine/Scene.js";
import { PALETTE } from "../engine/Game.js";
import { Save } from "../systems/Save.js";
import { CATEGORIES } from "../data/skins.js";
import { MenuScene } from "./MenuScene.js";
import { audio } from "../engine/Audio.js";
import { getWitchSprite } from "../systems/WitchSprites.js";

export class ShopScene extends Scene {
  constructor(game) {
    super(game);
    this.t = 0;
    this.save = Save.load();
    this.cat = 0;
    this.sel = 0;
    this.toast = "";
    this.toastT = 0;
  }

  get category() { return CATEGORIES[this.cat]; }
  get skins() { return this.category.list; }
  get current() { return this.skins[this.sel]; }

  _setToast(msg) { this.toast = msg; this.toastT = 1.4; }

  // ---- 布局（update/render 共用，保证点击区域与显示一致） ----
  _backBtn() { return { x: 8, y: 6, w: 54, h: 18 }; }
  _catRects() { return CATEGORIES.map((_, i) => ({ x: 12 + i * 68, y: 30, w: 62, h: 16 })); }
  _rowRects() { return this.skins.map((_, i) => ({ x: 8, y: 54 + i * 18, w: 214, h: 16 })); }
  _previewBox() { const W = this.game.width; return { x: 250, y: 54, w: W - 266, h: 150 }; }
  _confirmBtn() { const b = this._previewBox(); return { x: b.x + 12, y: b.y + b.h - 26, w: b.w - 24, h: 20 }; }

  update(dt, input) {
    this.t += dt;
    if (this.toastT > 0) this.toastT -= dt;

    if (input.justPressed("escape", "backspace") || input.tapIn(this._backBtn())) {
      audio.play("click");
      this.game.changeScene(new MenuScene(this.game));
      return;
    }

    if (input.justPressed("arrowleft", "a")) { this.cat = (this.cat + CATEGORIES.length - 1) % CATEGORIES.length; this.sel = 0; }
    if (input.justPressed("arrowright", "d")) { this.cat = (this.cat + 1) % CATEGORIES.length; this.sel = 0; }
    if (input.justPressed("arrowup", "w")) this.sel = (this.sel + this.skins.length - 1) % this.skins.length;
    if (input.justPressed("arrowdown", "s")) this.sel = (this.sel + 1) % this.skins.length;
    if (input.justPressed("enter", " ")) this._confirm();

    // 触屏
    if (input.pointer.justDown) {
      const catR = this._catRects();
      for (let i = 0; i < catR.length; i++) if (input.tapIn(catR[i])) { audio.play("click"); this.cat = i; this.sel = 0; }
      const rowR = this._rowRects();
      for (let i = 0; i < rowR.length; i++) {
        if (input.tapIn(rowR[i])) {
          if (this.sel === i) this._confirm(); // 再次点选中项 = 确认
          else { audio.play("click"); this.sel = i; }
        }
      }
      if (input.tapIn(this._confirmBtn())) this._confirm();
    }
  }

  _confirm() {
    audio.play("click");
    const cat = this.category.key;
    const skin = this.current;
    if (Save.isOwned(this.save, cat, skin.id)) {
      if (this.save.equipped[cat] === skin.id) this._setToast("已装备");
      else { Save.equip(this.save, cat, skin.id); this._setToast("已装备：" + skin.name); }
    } else {
      if (Save.buy(this.save, cat, skin)) this._setToast("购买成功并装备：" + skin.name);
      else this._setToast("金币不足！还差 " + (skin.price - this.save.coins));
    }
  }

  render(ctx) {
    const W = this.game.width, H = this.game.height;

    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, "#1a0d2b");
    g.addColorStop(1, "#0a0512");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);

    // 返回按钮
    const back = this._backBtn();
    ctx.fillStyle = "rgba(185,107,255,0.14)";
    ctx.fillRect(back.x, back.y, back.w, back.h);
    ctx.strokeStyle = PALETTE.neon; ctx.lineWidth = 1;
    ctx.strokeRect(back.x + 0.5, back.y + 0.5, back.w - 1, back.h - 1);
    ctx.fillStyle = PALETTE.neon; ctx.font = "10px 'Microsoft YaHei', 'PingFang SC', sans-serif";
    ctx.textAlign = "center"; ctx.textBaseline = "middle";
    ctx.fillText("‹ 返回", back.x + back.w / 2, back.y + back.h / 2 + 1);

    // 金币
    ctx.textAlign = "right"; ctx.textBaseline = "top";
    ctx.fillStyle = PALETTE.gold; ctx.font = "11px 'Microsoft YaHei', 'PingFang SC', sans-serif";
    ctx.fillText(`金币 ${this.save.coins}`, W - 12, 8);

    // 分类标签
    const catR = this._catRects();
    ctx.textBaseline = "middle"; ctx.font = "10px 'Microsoft YaHei', 'PingFang SC', sans-serif";
    for (let i = 0; i < CATEGORIES.length; i++) {
      const r = catR[i];
      const on = i === this.cat;
      if (on) { ctx.fillStyle = "rgba(79,224,208,0.15)"; ctx.fillRect(r.x, r.y, r.w, r.h); }
      ctx.fillStyle = on ? PALETTE.cyan : "rgba(233,220,255,0.45)";
      ctx.textAlign = "center";
      ctx.fillText(CATEGORIES[i].label, r.x + r.w / 2, r.y + r.h / 2 + 1);
    }

    // 皮肤列表
    const rowR = this._rowRects();
    ctx.font = "10px 'Microsoft YaHei', 'PingFang SC', sans-serif";
    for (let i = 0; i < this.skins.length; i++) {
      const s = this.skins[i];
      const r = rowR[i];
      const owned = Save.isOwned(this.save, this.category.key, s.id);
      const equipped = this.save.equipped[this.category.key] === s.id;
      const on = i === this.sel;

      if (on) { ctx.fillStyle = "rgba(185,107,255,0.18)"; ctx.fillRect(r.x - 2, r.y, r.w, r.h); }
      ctx.textAlign = "left";
      ctx.fillStyle = on ? PALETTE.text : "rgba(233,220,255,0.7)";
      ctx.fillText((on ? "▶ " : "  ") + s.name, r.x + 2, r.y + r.h / 2 + 1);

      ctx.textAlign = "right";
      let tag, col;
      if (equipped) { tag = "装备中"; col = PALETTE.cyan; }
      else if (owned) { tag = "已拥有"; col = "rgba(233,220,255,0.6)"; }
      else { tag = s.price + " 金"; col = this.save.coins >= s.price ? PALETTE.gold : PALETTE.danger; }
      ctx.fillStyle = col;
      ctx.fillText(tag, r.x + r.w - 6, r.y + r.h / 2 + 1);
    }

    this._drawPreview(ctx);

    // toast + 提示
    ctx.textAlign = "center"; ctx.textBaseline = "middle";
    if (this.toastT > 0) {
      ctx.fillStyle = PALETTE.gold; ctx.font = "10px 'Microsoft YaHei', 'PingFang SC', sans-serif";
      ctx.fillText(this.toast, W / 2, H - 24);
    }
    ctx.fillStyle = "rgba(233,220,255,0.4)"; ctx.font = "8px 'Microsoft YaHei', 'PingFang SC', sans-serif";
    ctx.fillText("点击标签切分类 · 点皮肤选择 · 点按钮购买/装备 · 返回", W / 2, H - 11);
    ctx.textAlign = "left";
  }

  _drawPreview(ctx) {
    const b = this._previewBox();
    ctx.fillStyle = "rgba(20,10,31,0.6)";
    ctx.fillRect(b.x, b.y, b.w, b.h);
    ctx.strokeStyle = PALETTE.neonDim; ctx.lineWidth = 1;
    ctx.strokeRect(b.x + 0.5, b.y + 0.5, b.w - 1, b.h - 1);

    const cx = b.x + b.w / 2;
    const cy = b.y + b.h / 2 - 8;
    const s = this.current;
    const key = this.category.key;

    ctx.textAlign = "center"; ctx.textBaseline = "top";
    ctx.fillStyle = PALETTE.text; ctx.font = "10px 'Microsoft YaHei', 'PingFang SC', sans-serif";
    ctx.fillText(s.name, cx, b.y + 8);

    if (key === "character") {
      const sprite = getWitchSprite(s.id, "sailor"); // 商城预览统一用初始形态·水手服少女
      if (sprite) {
        const drawH = 96;
        const drawW = (sprite.width / sprite.height) * drawH;
        ctx.drawImage(sprite, cx - drawW / 2, cy - drawH / 2 + 6, drawW, drawH);
      } else {
        const w = 34, h = 46, x = cx - w / 2, y = cy - h / 2;
        ctx.fillStyle = s.body; ctx.fillRect(x, y, w, h);
        ctx.strokeStyle = s.outline; ctx.lineWidth = 2;
        ctx.shadowColor = s.outline; ctx.shadowBlur = 10;
        ctx.strokeRect(x, y, w, h); ctx.shadowBlur = 0;
        ctx.fillStyle = s.visor; ctx.fillRect(x + 6, y + 6, w - 12, 7);
      }
    } else if (key === "background") {
      const bw = 110, bh = 58, bx = cx - bw / 2, by = cy - bh / 2;
      const gg = ctx.createLinearGradient(0, by, 0, by + bh);
      gg.addColorStop(0, s.sky[0]); gg.addColorStop(0.7, s.sky[1]); gg.addColorStop(1, s.sky[2]);
      ctx.fillStyle = gg; ctx.fillRect(bx, by, bw, bh);
      ctx.fillStyle = s.far; ctx.fillRect(bx + 10, by + 24, 16, 18);
      ctx.fillStyle = s.far; ctx.fillRect(bx + 32, by + 18, 14, 24);
      ctx.fillStyle = s.mid; ctx.fillRect(bx + 60, by + 28, 20, 14);
      ctx.fillStyle = s.mid; ctx.fillRect(bx + 84, by + 20, 16, 22);
      ctx.fillStyle = s.ground; ctx.fillRect(bx, by + bh - 8, bw, 8);
      ctx.strokeStyle = s.line; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(bx, by + bh - 8.5); ctx.lineTo(bx + bw, by + bh - 8.5); ctx.stroke();
    } else {
      const w = 26, h = 40, x = cx - w / 2, y = cy - h / 2;
      ctx.fillStyle = s.fill; ctx.fillRect(x, y, w, h);
      ctx.strokeStyle = s.outline; ctx.lineWidth = 2;
      ctx.shadowColor = s.outline; ctx.shadowBlur = 10;
      ctx.strokeRect(x, y, w, h); ctx.shadowBlur = 0;
      ctx.fillStyle = s.stripe; ctx.fillRect(x + 5, y + 6, w - 10, 3);
      ctx.fillStyle = s.stripe; ctx.fillRect(x + 5, y + 14, w - 10, 3);
    }

    // 购买/装备 按钮
    const btn = this._confirmBtn();
    const cat = this.category.key;
    const owned = Save.isOwned(this.save, cat, s.id);
    const equipped = this.save.equipped[cat] === s.id;
    let label, col;
    if (equipped) { label = "已装备"; col = PALETTE.cyan; }
    else if (owned) { label = "装备"; col = PALETTE.gold; }
    else { label = "购买 (" + s.price + ")"; col = this.save.coins >= s.price ? PALETTE.gold : PALETTE.danger; }
    ctx.fillStyle = "rgba(185,107,255,0.14)";
    ctx.fillRect(btn.x, btn.y, btn.w, btn.h);
    ctx.strokeStyle = col; ctx.lineWidth = 1;
    ctx.strokeRect(btn.x + 0.5, btn.y + 0.5, btn.w - 1, btn.h - 1);
    ctx.fillStyle = col; ctx.font = "10px 'Microsoft YaHei', 'PingFang SC', sans-serif";
    ctx.textAlign = "center"; ctx.textBaseline = "middle";
    ctx.fillText(label, btn.x + btn.w / 2, btn.y + btn.h / 2 + 1);
    ctx.textAlign = "left";
  }
}
