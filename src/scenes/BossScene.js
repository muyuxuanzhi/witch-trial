// 弹幕Boss 战场景（横屏）：
// - 玩家在左侧，上下移动(↑ ↓ / W S / 点击拖动)，自动/持续向右射击
// - Boss在右侧，依据 bosses.js 的 patterns 向左发射弹幕
// - 玩家子弹击中Boss 扣血，Boss 弹幕/接触扣玩家血
// - 击败Boss → 通关，解锁下一关；玩家血量耗尽 → 失败
// 肉鸽爽游调性：玩家血条长、攻击强，Boss 弹幕稀疏偏慢，打起来爽。
import { Scene } from "../engine/Scene.js";
import { PALETTE } from "../engine/Game.js";
import { Particles } from "../systems/Particles.js";
import { Save } from "../systems/Save.js";
import { getLevelBoss, getLevel, TOTAL_LEVELS } from "../data/levels.js";
import { Difficulty } from "../data/difficulty.js";
import { MenuScene } from "./MenuScene.js";
import { audio } from "../engine/Audio.js";

// 全局难度系数（肉鸽爽游：玩家肉、能连续输出，Boss 耐打能撑30秒+、弹幕稀疏好躲）
const PLAYER_MAX_HP = 40;         // 玩家基础血量（长血条，很肉）
const BOSS_HP_SCALE = 1;          // Boss 血量整体缩放（血量在 bosses.js 里已调到能撑 30s+）
const BOSS_BULLET_SPEED_SCALE = 0.6;  // Boss 弹幕速度缩放（越小越慢越好躲）
const BOSS_INTERVAL_SCALE = 1.4;  // Boss 弹幕间隔缩放（越大越稀疏）
const PLAYER_DMG_SCALE = 1;       // 玩家武器伤害系数（血量已按此系数配平）
const PLAYER_HIT_DMG = 1;         // 玩家每次被击扣血
const PLAYER_INVULN = 1.0;        // 受击无敌时间

export class BossScene extends Scene {
  constructor(game, level, weapon, carry = {}) {
    super(game);
    this.level = level;
    this.weapon = weapon;
    this.carry = carry;
    this.endless = !!(level && level.endless);
    this.round = (carry && carry.round) || level.round || 1;
    this.save = Save.load();
    this.boss = getLevelBoss(level);
    this.particles = new Particles();
    // ===== 难度 =====
    this.diff = Difficulty.get();

    const W = game.width, H = game.height;

    // 玩家（左侧，纵向移动）
    // 地狱难度：3 血制（开局三滴血），撞满即败；普通：长血条 40。
    const baseHp = this.diff.bossLifeMode ? this.diff.bossLives : PLAYER_MAX_HP;
    this.player = {
      x: 46, y: H / 2, w: 18, h: 16,
    hp: baseHp, maxHp: baseHp,
      speed: 210,
 invuln: 0,
      fireCd: 0,
    };
    // ===== Buff 属性叠加进 Boss 战（无限模式下随轮次不断变强）=====
    const B = (carry && carry.buffs) || {};
  // 护盾结界：受伤减半 → 换算成更多血量（地狱 3 血制下不加血，保持生死张力）
    const guard = B.guard || 0;
    if (guard > 0 && !this.diff.bossLifeMode) { this.player.maxHp += guard * 4; this.player.hp += guard * 4; }
    // 迅捷：射速加成（每层 +8%，boss 战体现为冷却缩短）
    this.hasteMul = 1 + (B.haste || 0) * 0.08;
    // 双倍/破障：转化为额外伤害倍率（每层 +12%）
    this.dmgBuffMul = 1 + ((B.double || 0) + (B.smash || 0)) * 0.12;
    // 幸运：略微提升六芒星生成频率
    this.starLuck = (B.lucky || 0);

    // 星辰牵引：每层召唤一颗跟随玩家的绿色小星星，在 Boss 战协同攻击
    // （伤害约为玩家单发的 0.5 倍）
    this.companions = [];
    const magnetLv = B.magnet || 0;
    for (let i = 0; i < magnetLv; i++) {
      this.companions.push({
        // 环绕玩家的相位/半径，营造"跟随"感
        ang: (Math.PI * 2 * i) / Math.max(1, magnetLv),
        orbitR: 26 + i * 6,
        x: this.player.x, y: this.player.y,
        fireCd: 0.5 + i * 0.15, // 错开开火节奏
        spin: 0,
      });
    }

    // Boss 状态（右侧）  地狱难度：血量 ×3
    this.bhp = Math.max(20, Math.round(this.boss.hp * BOSS_HP_SCALE * this.diff.bossHpMul));
    this.bMaxHp = this.bhp;
    this.bx = W - 70;
    this.by = H / 2;
    this.bw = 46; this.bh = 46;
    this.bDir = 1;
    this.bTeleT = 0;
    this.spiralAng = 0;
    // 每个 pattern 独立计时器
    this.patTimers = this.boss.patterns.map(() => 0);

    this.playerBullets = [];
    this.bossBullets = [];

    // ===== 六芒星特殊道具 =====
    this.stars = [];           // 场上漂浮的六芒星
    this.starSpawnT = 0;       // 生成计时
    this.starInterval = Math.max(2.2, 4.5 - (this.starLuck || 0) * 0.4);   // 幸运越高越勤
    this.starCollected = 0;    // 已收集数量
    this.powerT = 0;           // 六芒星增益（火力狂暴）剩余时间
    // 地狱难度：六芒星出现频率大幅降低——整局只出现一次
    this.hellStarOnce = !!this.diff.bossLifeMode;
    this.hellStarSpawned = false;      // 是否已生成过那唯一一次
    this.hellStarDelay = 8+ Math.random() * 6; // 战斗开始 8~14s 后出现

    this.state = "fight";// fight | win | lose | paused
    this.t = 0;
    this.endT = 0;
    this.reward = level.reward || 30;
  }

  _pauseBtn() { return { x: this.game.width - 26, y: 8, w: 18, h: 16 }; }
  _pauseMenuButtons() {
    const W = this.game.width, H = this.game.height;
    return {
      resume: { x: W / 2 - 70, y: H * 0.46, w: 140, h: 26 },
      exit: { x: W / 2 - 70, y: H * 0.46 + 34, w: 140, h: 26 },
    };
  }
  _endButtons() {
    const W = this.game.width, H = this.game.height;
    return {
      next: { x: W / 2 - 86, y: H * 0.72, w: 80, h: 24 },
      menu: { x: W / 2 + 6, y: H * 0.72, w: 80, h: 24 },
    };
  }

  update(dt, input) {
    this.t += dt;

    if (this.state === "paused") {
      const b = this._pauseMenuButtons();
      if (input.justPressed("p", "escape") || input.tapIn(b.resume)) { audio.play("click"); this.state = "fight"; }
      else if (input.tapIn(b.exit)) { audio.play("click"); this.game.changeScene(new MenuScene(this.game)); }
      return;
    }

    if (this.state === "win" || this.state === "lose") {
      this.endT += dt;
      this.particles.update(dt);
      this._updateBullets(dt, true);
      if (this.endT > 0.5 && !this._navigating) {
        const b = this._endButtons();
        if (this.state === "win") {
          if (input.justPressed("enter", " ") || input.tapIn(b.next)) { this._navigating = true; audio.play("click"); this._goNext(); }
          else if (input.justPressed("escape") || input.tapIn(b.menu)) { this._navigating = true; audio.play("click"); this._goSelect(); }
        } else {
          if (input.justPressed("enter", " ") || input.tapIn(b.next)) { this._navigating = true; audio.play("click"); this._retry(); }
          else if (input.justPressed("escape") || input.tapIn(b.menu)) { this._navigating = true; audio.play("click"); this.game.changeScene(new MenuScene(this.game)); }
        }
      }
      return;
    }

    // 暂停
    if (input.justPressed("p", "escape") || input.tapIn(this._pauseBtn())) {
      audio.play("click");
      this.state = "paused";
      return;
    }

    // ===== 玩家移动（前后左右四方向）=====
    const p = this.player;
    let dy = 0, dx = 0;
    if (input.isDown("arrowup", "w")) dy -= 1;
    if (input.isDown("arrowdown", "s")) dy += 1;
    if (input.isDown("arrowleft", "a")) dx -= 1;
    if (input.isDown("arrowright", "d")) dx += 1;
    // 归一化斜向速度
    if (dx !== 0 && dy !== 0) { const inv = 0.7071; dx *= inv; dy *= inv; }
    p.x += dx * p.speed * dt;
    p.y += dy * p.speed * dt;
    // 指针拖动控制（可任意方向移动到指针处）
    if (input.pointer.down) {
      p.x += (input.pointer.x - p.x) * Math.min(1, 12 * dt);
      p.y += (input.pointer.y - p.y) * Math.min(1, 12 * dt);
    }
    // 活动范围：左侧 ~ 屏幕中线偏右一点（不能贴到 Boss 身上）
    const W = this.game.width, H = this.game.height;
    p.x = Math.max(p.w / 2 + 8, Math.min(W * 0.62, p.x));
    p.y = Math.max(p.h / 2 + 20, Math.min(H - p.h / 2 - 8, p.y));
    if (p.invuln > 0) p.invuln -= dt;

    // ===== 射击（持续自动开火，向右）=====
    p.fireCd -= dt;
    if (p.fireCd <= 0) {
      this._fire();
      // 六芒星狂暴时射速翻倍；迅捷 buff 额外缩短冷却
   p.fireCd = this.weapon.cooldown / this.hasteMul * (this.powerT > 0 ? 0.5 : 1);
    }

    // ===== 星辰牵引小星星：环绕玩家 + 协同开火 =====
    this._updateCompanions(dt);

    // ===== Boss移动 =====
    this._updateBoss(dt);

    // ===== Boss 弹幕生成 =====
    this._updatePatterns(dt);

    // ===== 子弹推进与碰撞 =====
    this._updateBullets(dt, false);

    // ===== 六芒星道具 =====
    this._updateStars(dt);
    if (this.powerT > 0) this.powerT -= dt;

    this.particles.update(dt);
  }

  _updateStars(dt) {
    const W = this.game.width, H = this.game.height;
    // 生成逻辑：
    // - 地狱难度：整局只出现一次（延迟一段时间后生成，之后不再生成）
    // - 普通难度：按 starInterval 周期性生成
    if (this.hellStarOnce) {
      if (!this.hellStarSpawned) {
        this.starSpawnT += dt;
        if (this.starSpawnT >= this.hellStarDelay) {
          this.hellStarSpawned = true;
          this._spawnStar();
        }
      }
    } else {
      this.starSpawnT += dt;
      if (this.starSpawnT >= this.starInterval) {
        this.starSpawnT = 0;
        this._spawnStar();
      }
    }
    const p = this.player;
    for (const s of this.stars) {
      s.x += s.vx * dt;
      s.y += s.vy * dt;
      s.spin += dt * 2;
      s.life -= dt;
      // 轻微上下漂浮
      s.y += Math.sin(this.t * 3 + s.x * 0.05) * 8 * dt;
      if (s.y < 40) s.vy = Math.abs(s.vy);
      if (s.y > H - 30) s.vy = -Math.abs(s.vy);
      if (s.x < -20 || s.life <= 0) s.dead = true;
      // 拾取判定
      if (!s.dead && Math.abs(s.x - p.x) < (p.w / 2 + s.r) && Math.abs(s.y - p.y) < (p.h / 2 + s.r)) {
        s.dead = true;
        this._collectStar();
      }
    }
    this.stars = this.stars.filter((s) => !s.dead);
  }

  _spawnStar() {
    const H = this.game.height;
    this.stars.push({
      x: this.bx - 20,
      y: 60 + Math.random() * (H - 120),
      vx: -(46 + Math.random() * 24),
      vy: (Math.random() - 0.5) * 30,
      r: 10,
      spin: 0,
      // 地狱唯一星停留更久，给玩家足够时间接住
      life: this.hellStarOnce ? 18 : 12,
      dead: false,
    });
  }

  // 收集六芒星：回血 + 触发短暂火力狂暴（地狱难度额外给短暂无敌）
  _collectStar() {
    const p = this.player;
    this.starCollected++;
    audio.play("rareStar");
    // 回血：普通 +6；地狱 3 血制下最多回 1 滴（避免瞬间回满，无敌才是核心收益）
    p.hp = Math.min(p.maxHp, p.hp + (this.diff.bossLifeMode ? 1 : 6));
    // 火力狂暴 5 秒（叠加时间）
    this.powerT = Math.min(12, this.powerT + 5);
    // 地狱难度：拾取后短暂无敌
    if (this.diff.starInvuln > 0) {
      p.invuln = Math.max(p.invuln, this.diff.starInvuln);
    }
    this.particles.burst(p.x, p.y, "#ffd94a", 26, { speed: 180, life: 0.7, size: 3 });
    this.particles.burst(p.x, p.y, "#ffffff", 12, { speed: 120, life: 0.4, size: 2 });
  }

  _fire() {
    const p = this.player;
    const w = this.weapon;
    const bx = p.x + p.w / 2, by = p.y;
    const dmg = w.damage * PLAYER_DMG_SCALE * this.dmgBuffMul * (this.powerT > 0 ? 2 : 1);
    const col = this.powerT > 0 ? "#ffd94a" : w.color;
    // 向右发射（vx 为正）
    const mk = (vx, vy, homing = false) => ({
      x: bx, y: by, vx, vy, r: this.powerT > 0 ? 5 : 4, dmg, color: col, homing, dead: false,
    });
    if (w.fireMode === "single") {
      this.playerBullets.push(mk(w.bulletSpeed, 0));
    } else if (w.fireMode === "spread") {
      for (const a of [-0.28, 0, 0.28]) {
        this.playerBullets.push(mk(Math.cos(a) * w.bulletSpeed, Math.sin(a) * w.bulletSpeed));
      }
    } else if (w.fireMode === "beam") {
      const b = mk(w.bulletSpeed, 0); b.r = 7; b.pierce = true;
      this.playerBullets.push(b);
    } else if (w.fireMode === "homing") {
      this.playerBullets.push(mk(w.bulletSpeed, 0, true));
    }
    this.particles.burst(bx, by, w.color, 4, { speed: 60, life: 0.2, size: 2 });
  }

  // 星辰牵引小星星：绕玩家旋转跟随；持续向Boss 发射绿色小弹（0.5 倍玩家伤害）
  _updateCompanions(dt) {
    if (!this.companions || !this.companions.length) return;
    const p = this.player;
    const w = this.weapon;
    // 单发基础伤害（含 buff 与狂暴），星星取其一半
    const baseDmg = w.damage * PLAYER_DMG_SCALE * this.dmgBuffMul * (this.powerT > 0 ? 2 : 1);
    const starDmg = baseDmg * 0.5;
    const interval = (this.weapon.cooldown / this.hasteMul) * (this.powerT > 0 ? 0.5 : 1) * 1.3; // 略慢于玩家
    for (const c of this.companions) {
      c.ang += dt * 2.4;
      c.spin += dt * 3;
      // 平滑跟随到环绕位置
      const tx = p.x + Math.cos(c.ang) * c.orbitR;
      const ty = p.y + Math.sin(c.ang) * (c.orbitR * 0.6);
      c.x += (tx - c.x) * Math.min(1, 10 * dt);
      c.y += (ty - c.y) * Math.min(1, 10 * dt);
      // 开火
      c.fireCd -= dt;
      if (c.fireCd <= 0) {
        c.fireCd = interval;
        this.playerBullets.push({
          x: c.x, y: c.y,
          vx: w.bulletSpeed * 0.95, vy: 0,
          r: 3, dmg: starDmg, color: "#5cff9a",
          homing: false, dead: false, fromCompanion: true,
        });
        this.particles.burst(c.x, c.y, "#5cff9a", 3, { speed: 50, life: 0.18, size: 2 });
      }
    }
  }

  _renderCompanions(ctx) {
    if (!this.companions || !this.companions.length) return;
    for (const c of this.companions) {
      ctx.save();
      ctx.translate(Math.round(c.x), Math.round(c.y));
      ctx.rotate(c.spin);
      ctx.fillStyle = "#5cff9a";
      ctx.shadowColor = "#5cff9a";
      ctx.shadowBlur = 8;
      // 简易五角星
      const R =5, r = 2.2;
      ctx.beginPath();
      for (let i = 0; i < 10; i++) {
        const rad = i % 2 === 0 ? R : r;
        const a = (i / 10) * Math.PI * 2 - Math.PI / 2;
        const px = Math.cos(a) * rad, py = Math.sin(a) * rad;
        if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
      }
      ctx.closePath();
      ctx.fill();
      ctx.shadowBlur = 0;
      ctx.restore();
    }
  }

  _updateBoss(dt) {
    const H = this.game.height;
    const b = this.boss;
    const spd = b.moveSpeed * 0.8; // 略降移动速度
    if (b.moveMode === "sway") {
      this.by += this.bDir * spd * dt;
      if (this.by < 60) { this.by = 60; this.bDir = 1; }
      if (this.by > H - 60) { this.by = H - 60; this.bDir = -1; }
    } else if (b.moveMode === "chase") {
      const dy = this.player.y - this.by;
      this.by += Math.sign(dy) * Math.min(Math.abs(dy), spd * dt);
      this.by = Math.max(60, Math.min(H - 60, this.by));
    } else if (b.moveMode === "teleport") {
      this.bTeleT += dt;
      if (this.bTeleT > 2.6) {
        this.bTeleT = 0;
        this.by = 70 + Math.random() * (H - 140);
        this.particles.burst(this.bx, this.by, b.color, 16, { speed: 120, life: 0.5 });
      }
    }
    //轻微左右浮动
    this.bx = (this.game.width - 70) + Math.sin(this.t * 1.5) * 6;
  }

  _updatePatterns(dt) {
    const patterns = this.boss.patterns;
    for (let i = 0; i < patterns.length; i++) {
      const pat = patterns[i];
      this.patTimers[i] += dt;
      // 地狱难度：攻击频率加快（间隔缩短）
      const interval = pat.interval * BOSS_INTERVAL_SCALE * this.diff.bossIntervalMul;
      if (this.patTimers[i] >= interval) {
        this.patTimers[i] = 0;
        this._emitPattern(pat);
      }
    }
  }

  _emitPattern(pat) {
    const ox = this.bx - this.bw / 2, oy = this.by;
    // 地狱难度：弹速加快
    const spd = pat.bulletSpeed * BOSS_BULLET_SPEED_SCALE * this.diff.bossBulletSpeedMul;
    const col = this.boss.color;
    const push = (vx, vy) => this.bossBullets.push({ x: ox, y: oy, vx, vy, r: 4, color: col, dead: false });

    if (pat.type === "aimed") {
      const ang = Math.atan2(this.player.y - oy, this.player.x - ox);
      const n = pat.count || 1;
      for (let i = 0; i < n; i++) {
        const a = ang + (i - (n - 1) / 2) * 0.12;
        push(Math.cos(a) * spd, Math.sin(a) * spd);
      }
    } else if (pat.type === "spread") {
      const n = pat.count, half = ((pat.spreadDeg || 60) * Math.PI / 180) / 2;
      const base = Math.PI; // 向左
      for (let i = 0; i < n; i++) {
        const a = base - half + (2 * half) * (n === 1 ? 0.5 : i / (n - 1));
        push(Math.cos(a) * spd, Math.sin(a) * spd);
      }
    } else if (pat.type === "wave") {
      const n = pat.count, half = ((pat.spreadDeg || 90) * Math.PI / 180) / 2;
      const base = Math.PI + Math.sin(this.t * 2) * 0.4; // 向左摆动
      for (let i = 0; i < n; i++) {
        const a = base - half + (2 * half) * (i / (n - 1));
        push(Math.cos(a) * spd, Math.sin(a) * spd);
      }
    } else if (pat.type === "ring") {
      const n = pat.count;
      for (let i = 0; i < n; i++) {
        const a = (i / n) * Math.PI * 2;
        push(Math.cos(a) * spd, Math.sin(a) * spd);
      }
    } else if (pat.type === "spiral") {
      const n = pat.count;
      for (let i = 0; i < n; i++) {
        const a = this.spiralAng + (i / n) * Math.PI * 2;
        push(Math.cos(a) * spd, Math.sin(a) * spd);
      }
      this.spiralAng += 0.5;
    }
  }

  _updateBullets(dt, endMode) {
    const W = this.game.width, H = this.game.height;

    // 玩家子弹
    for (const b of this.playerBullets) {
      if (b.homing && this.state === "fight") {
        const ang = Math.atan2(this.by - b.y, this.bx - b.x);
        const cur = Math.atan2(b.vy, b.vx);
        const spd = Math.hypot(b.vx, b.vy);
        const na = cur + Math.max(-3 * dt, Math.min(3 * dt, ang - cur));
        b.vx = Math.cos(na) * spd; b.vy = Math.sin(na) * spd;
      }
      b.x += b.vx * dt; b.y += b.vy * dt;
      if (b.x < -10 || b.x > W + 10 || b.y < -10 || b.y > H + 10) b.dead = true;
    }
    // 玩家子弹 vs Boss
    if (!endMode && this.state === "fight") {
      for (const b of this.playerBullets) {
        if (b.dead) continue;
        if (Math.abs(b.x - this.bx) < this.bw / 2 && Math.abs(b.y - this.by) < this.bh / 2) {
          this.bhp -= b.dmg;
          this.particles.burst(b.x, b.y, b.color, 6, { speed: 80, life: 0.3, size: 2 });
          if (!b.pierce) b.dead = true;
          if (this.bhp <= 0) { this._win(); break; }
        }
      }
    }
    this.playerBullets = this.playerBullets.filter((b) => !b.dead);

    // Boss 子弹
    for (const b of this.bossBullets) {
      b.x += b.vx * dt; b.y += b.vy * dt;
      if (b.x < -10 || b.x > W + 10 || b.y < -10 || b.y > H + 10) b.dead = true;
    }
    // Boss 子弹 vs 玩家
    if (!endMode && this.state === "fight") {
      const p = this.player;
      for (const b of this.bossBullets) {
        if (b.dead) continue;
        if (Math.abs(b.x - p.x) < (p.w / 2 + b.r) && Math.abs(b.y - p.y) < (p.h / 2 + b.r)) {
          b.dead = true;
          if (p.invuln <= 0) {
            p.hp -= PLAYER_HIT_DMG;
            p.invuln = PLAYER_INVULN;
            audio.play("hit");
            this.particles.burst(p.x, p.y, PALETTE.danger, 12, { speed: 110, life: 0.5, size: 3 });
            if (p.hp <= 0) this._lose();
          }
        }
      }
    }
    this.bossBullets = this.bossBullets.filter((b) => !b.dead);
  }

  _win() {
    this.state = "win";
    this.endT = 0;
    this.stars = [];
    this.particles.burst(this.bx, this.by, PALETTE.gold, 40, { speed: 180, life: 1.0, size: 3 });
    if (this.endless) {
      // 无限模式：不解锁关卡，仅累加金币奖励并存档
      this.save.coins += this.reward;
      Save.save(this.save);
    } else {
      // 记录通关 + 奖励 + 解锁下一关
      Save.clearLevel(this.save, this.level.id, this.level.index, TOTAL_LEVELS, this.reward);
  }
    // 胜利判定出来就立刻在后台预取"下一步"要用到的场景模块，结算画面展示
    // 期间正好用来把加载做完，避免点击"下一关/下一轮"瞬间才发起请求造成卡顿。
    this._nextPromise = (this.endless
      ? Promise.all([import("../data/levels.js"), import("./RunScene.js")])
      : this.level.index < TOTAL_LEVELS
        ? import("./IntroScene.js")
        : import("./LevelSelectScene.js")
    ).catch((e) => {
      console.warn("[BossScene] 预加载下一场景失败，将在切换时重试", e);
      return null;
    });
  }

  _lose() {
    this.state = "lose";
    this.endT = 0;
    this.stars = [];
    audio.play("death");
    this.particles.burst(this.player.x, this.player.y, PALETTE.danger, 30, { speed: 160, life: 0.9, size: 3 });
    // 失败结算展示期间预取重试所需的武器选择场景。
    this._retryPromise = import("./WeaponSelectScene.js").catch((e) => {
      console.warn("[BossScene] 预加载重试场景失败，将在切换时重试", e);
      return null;
    });
  }

  _goNext() {
if (this.endless) {
      // 无限模式：进入下一轮（round+1），累加 buffs / totalTrial 到下一轮 RunScene
   const carry = {
   buffs: { ...(this.carry.buffs || {}) },
        formId: this.carry.formId,
        collected: this.carry.collected || 0,
     score: this.carry.score || 0,
        endless: true,
        round: this.round + 1,
 totalTrial: this.carry.totalTrial || 0,
        trial: this.carry.trial || 0,
      };
      const loader = this._nextPromise || Promise.all([import("../data/levels.js"), import("./RunScene.js")]);
      loader
        .then((r) => {
          if (!r) throw new Error("next scene modules not loaded");
          const [lv, rs] = r;
          this.game.changeScene(new rs.RunScene(this.game, lv.makeEndlessLevel(this.round + 1), carry));
        })
        .catch((e) => {
          console.warn("[BossScene] 进入下一轮失败，可再次点击重试", e);
          this._navigating = false;
          this._nextPromise = null;
        });
    return;
    }
    const loader = this._nextPromise || (this.level.index < TOTAL_LEVELS
      ? import("./IntroScene.js")
      : import("./LevelSelectScene.js"));
    if (this.level.index < TOTAL_LEVELS) {
      loader
        .then((m) => {
          if (!m) throw new Error("IntroScene module not loaded");
          this.game.changeScene(new m.IntroScene(this.game, getLevel(this.level.index + 1)));
        })
        .catch((e) => {
          console.warn("[BossScene] 进入下一关失败，可再次点击重试", e);
          this._navigating = false;
          this._nextPromise = null;
        });
 } else {
      // 通关全部 → 回选关（显示全通关）
      this._goSelect();
    }
  }

  _goSelect() {
    const loader = this._nextPromise || import("./LevelSelectScene.js");
    loader
      .then((m) => {
        if (!m) throw new Error("LevelSelectScene module not loaded");
        this.game.changeScene(new m.LevelSelectScene(this.game));
      })
      .catch((e) => {
        console.warn("[BossScene] 返回选关失败，可再次点击重试", e);
        this._navigating = false;
        this._nextPromise = null;
      });
  }

  _retry() {
    const loader = this._retryPromise || import("./WeaponSelectScene.js");
    loader
      .then((m) => {
        if (!m) throw new Error("WeaponSelectScene module not loaded");
        this.game.changeScene(new m.WeaponSelectScene(this.game, this.level, this.carry));
      })
      .catch((e) => {
        console.warn("[BossScene] 重试失败，可再次点击重试", e);
        this._navigating = false;
        this._retryPromise = null;
      });
  }

  render(ctx) {
    const W = this.game.width, H = this.game.height;
    // 背景
    const g = ctx.createLinearGradient(0, 0, W, 0);
    g.addColorStop(0, this.level.sky[0]);
    g.addColorStop(0.6, this.level.sky[1]);
    g.addColorStop(1, this.level.sky[2]);
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);

    // 星尘
    ctx.fillStyle = "rgba(255,255,255,0.15)";
    for (let i = 0; i < 30; i++) {
      const x = (i * 71 - this.t * 12) % W;
      const y = (i * 43) % H;
      ctx.fillRect((x + W) % W, y, 1, 1);
    }

    // Boss
    this._renderBoss(ctx);

    // 六芒星特殊道具
    this._renderStars(ctx);

    // Boss 子弹
    for (const b of this.bossBullets) {
      ctx.fillStyle = b.color;
      ctx.shadowColor = b.color; ctx.shadowBlur = 6;
      ctx.beginPath(); ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2); ctx.fill();
    }
    ctx.shadowBlur = 0;

    // 玩家子弹
    for (const b of this.playerBullets) {
      ctx.fillStyle = b.color;
      ctx.shadowColor = b.color; ctx.shadowBlur = 6;
      ctx.beginPath(); ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2); ctx.fill();
    }
    ctx.shadowBlur = 0;

    // 玩家
    this._renderPlayer(ctx);
    // 星辰牵引小星星（跟随玩家）
    this._renderCompanions(ctx);

    this.particles.render(ctx);

    // HUD
    this._renderHUD(ctx, W, H);

    if (this.state === "paused") this._renderPause(ctx, W, H);
    if (this.state === "win") this._renderWin(ctx, W, H);
    if (this.state === "lose") this._renderLose(ctx, W, H);
  }

  _renderBoss(ctx) {
    const b = this.boss;
    const cx = this.bx, cy = this.by;
    ctx.save();
    ctx.translate(cx, cy);
    ctx.shadowColor = b.color; ctx.shadowBlur = 10;
    ctx.fillStyle = b.color;
    ctx.strokeStyle = b.capColor; ctx.lineWidth = 2;

    if (b.shape === "mushroom") {
      //菌盖
      ctx.fillStyle = b.capColor;
      ctx.beginPath(); ctx.arc(0, -4, 22, Math.PI, 0); ctx.fill();
      // 斑点
      ctx.fillStyle = "rgba(255,255,255,0.7)";
      ctx.beginPath(); ctx.arc(-8, -8, 3, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(7, -6, 4, 0, Math.PI * 2); ctx.fill();
      // 菌柄
      ctx.fillStyle = b.color;
      ctx.fillRect(-10, -4, 20, 22);
      // 怒眼
      ctx.fillStyle = "#000";
      ctx.fillRect(-6, 4, 4, 4); ctx.fillRect(3, 4, 4, 4);
    } else if (b.shape === "vine") {
      ctx.strokeStyle = b.color; ctx.lineWidth = 5;
      for (let s = -1; s <= 1; s += 1) {
        ctx.beginPath();
        ctx.moveTo(s * 14, 20);
        ctx.quadraticCurveTo(s * 24 + Math.sin(this.t * 3 + s) * 6, 0, s * 10, -18);
        ctx.stroke();
      }
      ctx.fillStyle = b.capColor;
      ctx.beginPath(); ctx.arc(0, 0, 14, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = "#000";
      ctx.fillRect(-6, -3, 4, 5); ctx.fillRect(3, -3, 4, 5);
    } else if (b.shape === "golem") {
      ctx.fillStyle = b.color;
      ctx.beginPath();
      ctx.moveTo(0, -22); ctx.lineTo(20, -6); ctx.lineTo(14, 20); ctx.lineTo(-14, 20); ctx.lineTo(-20, -6);
      ctx.closePath(); ctx.fill();
      ctx.strokeStyle = b.capColor; ctx.stroke();
      ctx.fillStyle = "#fff";
      ctx.fillRect(-7, -2, 5, 5); ctx.fillRect(4, -2, 5, 5);
    } else if (b.shape === "ghost") {
      ctx.fillStyle = b.color;
      ctx.beginPath(); ctx.arc(0, -4, 20, Math.PI, 0);
      ctx.lineTo(20, 18); ctx.lineTo(10, 10); ctx.lineTo(0, 18); ctx.lineTo(-10, 10); ctx.lineTo(-20, 18);
      ctx.closePath(); ctx.fill();
      ctx.fillStyle = "#000";
      ctx.beginPath(); ctx.arc(-7, -4, 3, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(7, -4, 3, 0, Math.PI * 2); ctx.fill();
    } else {
      // witch（最终 Boss）
      ctx.fillStyle = b.capColor;
      ctx.beginPath(); ctx.moveTo(0, -26); ctx.lineTo(-16, 2); ctx.lineTo(16, 2); ctx.closePath(); ctx.fill();
      ctx.fillRect(-20, 2, 40, 5);
      ctx.fillStyle = b.color;
      ctx.beginPath(); ctx.arc(0, 16, 12, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = "#000";
      ctx.fillRect(-6, 12, 3, 4); ctx.fillRect(3, 12, 3, 4);
      // 月蚀光环
      ctx.strokeStyle = b.color; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.arc(0, 8, 28 + Math.sin(this.t * 2) * 2, 0, Math.PI * 2); ctx.stroke();
    }
    ctx.shadowBlur = 0;
    ctx.restore();
  }

  //绘制六芒星特殊道具（两个交叠正三角形 + 发光旋转）
  _renderStars(ctx) {
    for (const s of this.stars) {
      const blink = s.life < 3 ? (Math.floor(this.t * 12) % 2 === 0 ? 0.4 : 1) : 1;
      ctx.save();
      ctx.globalAlpha = blink;
      ctx.translate(s.x, s.y);
      ctx.rotate(s.spin);
      ctx.shadowColor = "#ffd94a"; ctx.shadowBlur = 12;
      ctx.strokeStyle = "#ffd94a"; ctx.lineWidth = 2;
      ctx.fillStyle = "rgba(255,217,74,0.35)";
      this._sixStarPath(ctx, s.r);
      ctx.fill();
      ctx.stroke();
      // 中心亮点
      ctx.shadowBlur = 6;
      ctx.fillStyle = "#ffffff";
      ctx.beginPath(); ctx.arc(0, 0, 2, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
    }
    ctx.shadowBlur = 0;
  }

  _sixStarPath(ctx, r) {
    // 正三角形
    const tri = (rot) => {
      ctx.beginPath();
      for (let i = 0; i < 3; i++) {
        const a = rot + i * (Math.PI * 2 / 3) - Math.PI / 2;
        const x = Math.cos(a) * r, y = Math.sin(a) * r;
        if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      }
      ctx.closePath();
    };
    tri(0);
    tri(Math.PI);
  }

  _renderPlayer(ctx) {
    const p = this.player;
    // 无敌闪烁
    if (p.invuln > 0 && Math.floor(this.t * 20) % 2 === 0) return;
    ctx.save();
    ctx.translate(p.x, p.y);
    // 六芒星狂暴光环
    if (this.powerT > 0) {
      ctx.strokeStyle = "#ffd94a";
      ctx.lineWidth = 1.5;
      ctx.shadowColor = "#ffd94a"; ctx.shadowBlur = 10;
      ctx.beginPath(); ctx.arc(0, 2, 16 + Math.sin(this.t * 8) * 2, 0, Math.PI * 2); ctx.stroke();
      ctx.shadowBlur = 0;
    }
    ctx.fillStyle = this.weapon.color;
    ctx.shadowColor = this.weapon.color; ctx.shadowBlur = 8;
    // 尖顶帽
    ctx.beginPath(); ctx.moveTo(0, -14); ctx.lineTo(-7, -2); ctx.lineTo(7, -2); ctx.closePath(); ctx.fill();
    ctx.fillRect(-8, -2, 16, 2);
    // 身体
    ctx.fillStyle = "#3d2a54";
    ctx.strokeStyle = this.weapon.color; ctx.lineWidth = 1;
    ctx.fillRect(-6, 0, 12, 12);
    ctx.strokeRect(-6.5, 0.5, 13, 12);
    ctx.shadowBlur = 0;
    ctx.restore();
  }

  _renderHUD(ctx, W, H) {
    // Boss 血条（顶部长条）
    const bw = W - 40, bx = 20, by = 6, bh = 8;
    ctx.fillStyle = "rgba(20,10,31,0.7)";
    ctx.fillRect(bx, by, bw, bh);
    ctx.fillStyle = this.boss.color;
    ctx.fillRect(bx, by, bw * Math.max(0, this.bhp / this.bMaxHp), bh);
    ctx.strokeStyle = this.boss.capColor; ctx.lineWidth = 1;
    ctx.strokeRect(bx + 0.5, by + 0.5, bw - 1, bh - 1);
    ctx.fillStyle = PALETTE.text; ctx.font = "9px monospace";
    ctx.textAlign = "center"; ctx.textBaseline = "top";
    ctx.fillText(`${this.boss.name}  ${Math.max(0, Math.ceil(this.bhp))}/${this.bMaxHp}`, W / 2, by + bh + 2);

    // 玩家血量（地狱：爱心命制；普通：长血条）
    const php = Math.max(0, this.player.hp);
    const pbx = 10, pby = H - 16, pbw = 160, pbh = 9;
    if (this.diff.bossLifeMode) {
      ctx.textAlign = "left"; ctx.textBaseline = "middle";
      ctx.font = "13px monospace";
      ctx.fillStyle = this.diff.color;
      ctx.fillText("🔥", pbx, pby + pbh / 2);
      let hx = pbx + 18;
      for (let i = 0; i < this.player.maxHp; i++) {
        ctx.fillStyle = i < php ? "#ff5c8a" : "rgba(120,80,100,0.5)";
        ctx.fillText(i < php ? "♥" : "♡", hx + i * 14, pby + pbh / 2);
      }
      // 无敌状态提示
      if (this.player.invuln > 0) {
        ctx.fillStyle = "#ffd94a"; ctx.font = "9px monospace";
        ctx.fillText(`无敌 ${this.player.invuln.toFixed(1)}s`, hx + this.player.maxHp * 14 + 6, pby + pbh / 2 + 1);
      }
    } else {
      const pratio = php / this.player.maxHp;
      ctx.fillStyle = "rgba(20,10,31,0.7)";
      ctx.fillRect(pbx, pby, pbw, pbh);
      // 血量颜色随比例变化
      const hpColor = pratio > 0.5 ? "#5cff9a" : pratio > 0.25 ? PALETTE.gold : PALETTE.danger;
      ctx.fillStyle = hpColor;
      ctx.fillRect(pbx, pby, pbw * pratio, pbh);
      ctx.strokeStyle = "rgba(255,255,255,0.35)"; ctx.lineWidth = 1;
      ctx.strokeRect(pbx + 0.5, pby + 0.5, pbw - 1, pbh - 1);
      ctx.fillStyle = PALETTE.text; ctx.font = "8px monospace";
      ctx.textAlign = "left"; ctx.textBaseline = "middle";
      ctx.fillText(`HP ${php}/${this.player.maxHp}`, pbx + pbw + 6, pby + pbh / 2 + 1);
    }

    // 武器名
    ctx.fillStyle = this.weapon.color; ctx.font = "9px monospace";
    ctx.textAlign = "right"; ctx.textBaseline = "bottom";
    ctx.fillText(`${this.weapon.icon} ${this.weapon.name}`, W - 10, H - 8);

    // 六芒星收集数 + 狂暴状态（顶部靠右，避免与底部血量/爱心重叠）
    ctx.textAlign = "right"; ctx.textBaseline = "top";
    ctx.font = "10px monospace";
    ctx.fillStyle = "#ffd94a";
    ctx.shadowColor = "#ffd94a"; ctx.shadowBlur = this.powerT > 0 ? 6 : 0;
    ctx.fillText(`✶六芒星 x${this.starCollected}`, W - 30, by + bh + 2);
    ctx.shadowBlur = 0;
    if (this.powerT > 0) {
      ctx.fillStyle = "#ffd94a";
      ctx.font = "9px monospace";
      ctx.fillText(`星辉狂暴 ${this.powerT.toFixed(1)}s`, W - 30, by + bh + 15);
    }

    // 暂停按钮
    const pb = this._pauseBtn();
    ctx.fillStyle = "rgba(20,10,31,0.6)"; ctx.fillRect(pb.x, pb.y, pb.w, pb.h);
    ctx.strokeStyle = PALETTE.neon; ctx.lineWidth = 1;
    ctx.strokeRect(pb.x + 0.5, pb.y + 0.5, pb.w - 1, pb.h - 1);
    ctx.fillStyle = PALETTE.neon;
    ctx.fillRect(pb.x + 5, pb.y + 4, 3, 8); ctx.fillRect(pb.x + 10, pb.y + 4, 3, 8);

    ctx.textAlign = "left"; ctx.textBaseline = "alphabetic";
  }

  _renderPause(ctx, W, H) {
    ctx.fillStyle = "rgba(20,10,31,0.82)"; ctx.fillRect(0, 0, W, H);
    ctx.textAlign = "center"; ctx.textBaseline = "middle";
    ctx.fillStyle = PALETTE.neon; ctx.font = "bold 22px monospace";
    ctx.fillText("暂停", W / 2, H * 0.32);
    const b = this._pauseMenuButtons();
    this._btn(ctx, b.resume, "继续战斗", PALETTE.cyan);
    this._btn(ctx, b.exit, "退出到主菜单", PALETTE.danger);
    ctx.textAlign = "left";
  }

  _renderWin(ctx, W, H) {
    ctx.fillStyle = "rgba(20,10,31,0.78)"; ctx.fillRect(0, 0, W, H);
    ctx.textAlign = "center"; ctx.textBaseline = "middle";
    ctx.fillStyle = PALETTE.gold; ctx.font = "bold 24px monospace";
    ctx.shadowColor = PALETTE.gold; ctx.shadowBlur = 10;
    const allClear = !this.endless && this.level.index >= TOTAL_LEVELS;
    if (this.endless) {
      ctx.fillText(`第${this.round}轮达成！击败 ${this.boss.name}`, W / 2, H * 0.3);
    } else {
 ctx.fillText(allClear ? "全部试炼达成！" : "击败 " + this.boss.name, W / 2, H * 0.3);
    }
    ctx.shadowBlur = 0;
    ctx.fillStyle = PALETTE.text; ctx.font = "12px monospace";
    ctx.fillText(`金币 +${this.reward}   （共 ${this.save.coins}）`, W / 2, H * 0.44);
    ctx.fillStyle = "#ffd94a";
    ctx.fillText(`✶ 六芒星收集 x${this.starCollected}`, W / 2, H * 0.5);
    if (this.endless) ctx.fillText(`继续挑战 第${this.round + 1}轮（Boss 随机·属性继续叠加）`, W / 2, H * 0.58);
    else if (!allClear) ctx.fillText(`已解锁 第${this.level.index + 1}关`, W / 2, H * 0.58);
    else ctx.fillText("你已成为真正的魔女！", W / 2, H * 0.58);

    if (this.endT > 0.5) {
      const b = this._endButtons();
    this._btn(ctx, b.next, this.endless ? "下一轮" : (allClear ? "选关" : "下一关"), PALETTE.cyan);
      this._btn(ctx, b.menu, "选关界面", PALETTE.neon);
    }
    ctx.textAlign = "left";
  }

  _renderLose(ctx, W, H) {
    ctx.fillStyle = "rgba(20,10,31,0.78)"; ctx.fillRect(0, 0, W, H);
    ctx.textAlign = "center"; ctx.textBaseline = "middle";
    ctx.fillStyle = PALETTE.danger; ctx.font = "bold 24px monospace";
    ctx.fillText("试炼失败", W / 2, H * 0.32);
    ctx.fillStyle = PALETTE.text; ctx.font = "12px monospace";
    ctx.fillText(`${this.boss.name} 太强大了……`, W / 2, H * 0.46);
    if (this.endT > 0.5) {
      const b = this._endButtons();
      this._btn(ctx, b.next, "再战", PALETTE.cyan);
      this._btn(ctx, b.menu, "主菜单", PALETTE.neon);
    }
    ctx.textAlign = "left";
  }

  _btn(ctx, r, label, color) {
    ctx.fillStyle = "rgba(185,107,255,0.14)";
    ctx.fillRect(r.x, r.y, r.w, r.h);
    ctx.strokeStyle = color; ctx.lineWidth = 1;
    ctx.strokeRect(r.x + 0.5, r.y + 0.5, r.w - 1, r.h - 1);
    ctx.fillStyle = color; ctx.font = "11px monospace";
    ctx.textAlign = "center"; ctx.textBaseline = "middle";
    ctx.fillText(label, r.x + r.w / 2, r.y + r.h / 2 + 1);
  }
}
