// 核心跑酷场景（魔女试炼 · 肉鸽版）：
// - 收集魔法星星(+50)/药水(+100) 累积试炼值
// - 撞障碍不再秒死：扣 20 试炼值 + 僵直 + 短暂无敌
// - 每累积 2500 试炼值暂停，弹出三选一 Buff（可持续可叠加）
// - 随累计试炼值进化魔女形态（水手服 → 见习魔女 → 扫帚魔女）
// - 累计试炼值达到关卡目标(goalTrial) → 进入武器选择 → 弹幕 Boss 战
// - 试炼值降到 0 且再次受伤则结束（试炼失败）
// - 局内可暂停(P/暂停按钮) 与 退出(回主菜单)
import { Scene } from "../engine/Scene.js";
import { PALETTE } from "../engine/Game.js";
import { CONFIG } from "../data/config.js";
import { Player } from "../systems/Player.js";
import { Spawner } from "../systems/Spawner.js";
import { Particles } from "../systems/Particles.js";
import { Background } from "../systems/Background.js";
import { Save } from "../systems/Save.js";
import { getSkin } from "../data/skins.js";
import { rollChoices } from "../data/buffs.js";
import { getFormByTrial, getNextForm, WITCH_FORMS } from "../data/witchForms.js";
import { getLevel, levelBgSkin } from "../data/levels.js";
import { Difficulty } from "../data/difficulty.js";
import { ACHIEVEMENTS } from "../data/achievements.js";
import { MenuScene } from "./MenuScene.js";
import { audio } from "../engine/Audio.js";

const FINAL_FORM_ID = WITCH_FORMS[WITCH_FORMS.length - 1].id;

export class RunScene extends Scene {
  // carry: 无限模式跨轮累加的状态（buffs / totalTrial 基线 / collected / round）
  constructor(game, level, carry = null) {
    super(game);
    this.level = level || getLevel(1);
    this.carry = carry;
    this.endless = !!(level && level.endless);
    this.save = Save.load();
    // 关卡专属背景：每关用自己的主题配色与背景风格（森林/毒沼/洞窟/城堡/月蚀）
    this.bg = new Background(game.width, game.height, levelBgSkin(this.level));
    this.player = new Player(getFormByTrial(0), this.save.equipped.character);
    this.spawner = new Spawner(getSkin("obstacle", this.save.equipped.obstacle), this.level.name);
    this.particles = new Particles();

    // ===== 先天角色能力：海於专属契约鲸鱼 =====
    // 仅当前装备的角色皮肤配置了 pet 时生效（目前只有海於的碧海魔女皮肤）。
    // 鲸鱼跟随玩家显示；每隔 shieldInterval 秒攒一层不可叠加的护盾，
    // 护盾在下一次撞上障碍时消耗，完全抵挡那一次碰撞伤害。
    const charSkin = getSkin("character", this.save.equipped.character);
    this.pet = charSkin && charSkin.pet ? charSkin.pet : null;
    if (this.pet) {
      this.petX = this.player.cx - 30;
      this.petY = this.player.cy;
      this.petBob = 0;
      this.petShieldT = 0;
      this.petShieldInterval = this.pet.shieldInterval || 30;
      this.petShieldReady = false;
    }

    this.speed = CONFIG.startSpeed;
    this.speedMul = this.level.speedMul || 1;
    this.elapsed = 0;
    this.distance = 0;

    // 试炼值系统
    this.trial = 0;      // 当前试炼值（会因收集增加、受伤减少）
    this.totalTrial = 0;     // 累计获得（只增，用于形态进化 & 触发阈值）
    this.nextThreshold = CONFIG.trialPerLevel; // 下一次触发三选一的累计值
    this.collected = 0;  // 收集数量（用于结算金币）
    this.goalTrial = this.level.goalTrial;// 达到即进入 Boss 战

    // Buff 层数：{ buffId: stacks }
  this.buffs = {};

    // ===== 无限模式：继承上一轮累加的 Buff 与收集度 =====
    this.round = (carry && carry.round) || (this.endless ? 1 : this.level.round || 1);
    if (carry) {
      // Buff 层数继承叠加
    this.buffs = { ...(carry.buffs || {}) };
      // 收集数继承
      this.collected = carry.collected || 0;
  // 试炼值累计继承为基线：本轮目标是"在已有累计上再攒满一整轮"
      const carriedTotal = carry.totalTrial || 0;
      this.totalTrial = carriedTotal;
      this.trial = carry.trial || 0;
      // 本轮目标 = 已累计 + 本轮 goalTrial（这样进度条只表示"本轮进度"）
      this.roundBase = carriedTotal;
      this.goalTrial = carriedTotal + this.level.goalTrial;
      this.nextThreshold = carriedTotal + CONFIG.trialPerLevel;
      // 依据继承的累计值恢复形态
      this.player.setForm(getFormByTrial(this.totalTrial));
    } else {
      this.roundBase = 0;
  }

    // ===== 难度：地狱模式生命制 =====
    this.diff = Difficulty.get();
    this.hitsTaken = 0;   // 已受击次数（地狱生命制用）
    // ===== 本局统计（成就系统用） =====
    Save.initRunStats(this.save);

    this.state = "run";      // run | choose | dead | paused | goal
    this.shake = 0;
    this.hitStop = 0;
    this.deadT = 0;
    this.earned = 0;
    this.t = 0;
    this.goalT = 0;

    // 三选一
    this.choices = [];
    this.chooseAppearT = 0;

    // 连续收集连击：收集物累计到 3 个以上时在屏幕最右侧显示连击数字，
    // 撞到障碍物立即清零消失。
    this.combo = 0;
    this.comboT = 0; // 距上次连击增加的时间，用于弹出动画
  }

  get hi() { return this.save.hi; }
  get score() { return Math.floor(this.distance) + this.totalTrial; }
  stacks(id) { return this.buffs[id] || 0; }

  onEnter() {
    audio.playBgm("run");
  }

  // 地狱难度：最大可承受撞击数= 基础命数 × 2^(破障魔法层数)
  // 破障魔法【smash】在地狱下效果改变：每拾取一层耐撞翻倍(3→6→12)
  get maxLives() {
    if (!this.diff.runLifeMode) return Infinity;
    const smash = this.diff.smashDoubleEndurance ? this.stacks("smash") : 0;
    return this.diff.runLives * Math.pow(2, smash);
  }
  get lives() { return this.maxLives - this.hitsTaken; }

  _deadButtons() {
    const W = this.game.width, H = this.game.height;
    return {
      restart: { x: W / 2 - 86, y: H * 0.78, w: 80, h: 22 },
      menu: { x: W / 2 + 6, y: H * 0.78, w: 80, h: 22 },
    };
  }

  // 局内右上角暂停按钮
  _pauseBtn() { return { x: this.game.width - 26, y: 18, w: 18, h: 16 }; }

  _pauseMenuButtons() {
    const W = this.game.width, H = this.game.height;
    return {
      resume: { x: W / 2 - 70, y: H * 0.46, w: 140, h: 26 },
      exit: { x: W / 2 - 70, y: H * 0.46 + 34, w: 140, h: 26 },
    };
  }

  _choiceRects() {
    const W = this.game.width, H = this.game.height;
    const cw = 130, gap = 12;
    const totalW = cw * 3 + gap * 2;
    const x0 = (W - totalW) / 2;
    return this.choices.map((_, i) => ({
      x: x0 + i * (cw + gap), y: H * 0.34, w: cw, h: H * 0.4,
    }));
  }

  update(dt, input) {
    this.t += dt;

    // ===== 暂停界面 =====
    if (this.state === "paused") {
      const b = this._pauseMenuButtons();
      if (input.justPressed("p", "escape") || input.tapIn(b.resume)) {
        audio.play("click");
        this.state = "run";
      } else if (input.tapIn(b.exit)) {
        audio.play("click");
        this.game.changeScene(new MenuScene(this.game));
      }
      return;
    }

    if (this.hitStop > 0) {
      this.hitStop -= dt;
      this.shake *= 0.9;
      return;
    }

    // ===== 目标达成过场 =====
    if (this.state === "goal") {
      this.goalT += dt;
      this.particles.update(dt);
      this.shake *= 0.9;
      // _leavingGoal 防止异步切场景（import().then()）还没完成时，
      // goalT>1.4 这个条件每帧持续成立，导致每帧都重复播放 click 音效
      // （叠加成巨大噪音）并重复触发场景切换（造成切场景竞态、卡在半路）。
      if (!this._leavingGoal && (this.goalT > 1.4 || input.justPressed("enter", " ") || input.pointer.justDown)) {
        this._leavingGoal = true;
        audio.play("click");
        this._enterWeaponSelect();
      }
      return;
    }

    // ===== 三选一界面 =====
    if (this.state === "choose") {
      this.chooseAppearT += dt;
      this.particles.update(dt);
      const rects = this._choiceRects();
      let pick = -1;
      if (input.justPressed("1")) pick = 0;
      if (input.justPressed("2")) pick = 1;
      if (input.justPressed("3")) pick = 2;
      for (let i = 0; i < rects.length; i++) {
        if (input.tapIn(rects[i])) pick = i;
      }
      if (pick >= 0 && pick < this.choices.length && this.chooseAppearT > 0.25) {
        audio.play("click");
        this._takeBuff(this.choices[pick]);
        this.state = "run";
      }
      return;
    }

    // ===== 结算界面 =====
    if (this.state === "dead") {
      this.deadT += dt;
      this.particles.update(dt);
      this.shake *= 0.88;
      if (this.deadT > 0.4 && !this._leavingDead) {
        const b = this._deadButtons();
        if (input.justPressed("enter", " ") || input.tapIn(b.restart)) {
          this._leavingDead = true;
          audio.play("click");
          if (this.endless) {
            import("../data/levels.js")
              .then((m) => {
                this.game.changeScene(new RunScene(this.game, m.makeEndlessLevel(1)));
              })
              .catch((e) => {
                console.warn("[RunScene] 重开无限模式失败，可再次点击重试", e);
                this._leavingDead = false;
              });
          } else {
            this.game.changeScene(new RunScene(this.game, this.level));
          }
        } else if (input.justPressed("escape", "backspace") || input.tapIn(b.menu)) {
          this._leavingDead = true;
          audio.play("click");
          this.game.changeScene(new MenuScene(this.game));
        }
      }
      return;
    }

    // ===== 正常游玩 =====
    // 暂停触发（P 键 / 点击右上角暂停按钮）
    if (input.justPressed("p", "escape") || input.tapIn(this._pauseBtn())) {
      audio.play("click");
      this.state = "paused";
      return;
    }

    this.elapsed += dt;
    this.speed = Math.min(CONFIG.maxSpeed, CONFIG.startSpeed + this.elapsed * CONFIG.accel) * this.speedMul;
    const hasteMul = 1 + this.stacks("haste") * 0.15;
    this.distance += this.speed * dt * 0.1 * hasteMul;

    this.spawner.orbBonus = this.stacks("lucky") * 0.12;

    this.bg.update(dt, this.speed);
    this.player.update(dt, input);
    // 触摸滑动切轨：上滑→上轨，下滑→下轨（全屏任意位置有效）
    if (input.swipeUp) this.player.switchLane(0);
    else if (input.swipeDown) this.player.switchLane(1);
    this.spawner.update(dt, this.speed, this.elapsed);
    this.particles.update(dt);

    this._checkCollisions();
    this._updateSmashRings(dt);
    this._updatePet(dt);
    this.comboT += dt;

    this.shake *= 0.85;
  }

  // 契约鲸鱼：跟随玩家游动 + 护盾节奏计时（不可叠加，攒满一层就等待被消耗）
  _updatePet(dt) {
    if (!this.pet) return;
    const targetX = this.player.cx - 30;
    const targetY = this.player.cy;
    this.petX += (targetX - this.petX) * Math.min(1, 6 * dt);
    this.petBob += dt;
    this.petY = targetY + Math.sin(this.petBob * 3) * 6;

    this.petShieldT += dt;
    if (this.petShieldT >= this.petShieldInterval) {
      this.petShieldT = 0;
      if (!this.petShieldReady) {
        this.petShieldReady = true;
        this.particles.burst(this.player.cx, this.player.cy, this.pet.color, 14, { speed: 90, life: 0.5, size: 2 });
      }
    }
  }

  _updateSmashRings(dt) {
    if (!this.smashRings || !this.smashRings.length) return;
    for (const s of this.smashRings) {
      s.life -= dt;
      s.r += 260 * dt; // 快速扩张
    }
    this.smashRings = this.smashRings.filter((s) => s.life > 0);
  }

  _takeBuff(buff) {
    this.buffs[buff.id] = (this.buffs[buff.id] || 0) + 1;
    this.particles.burst(this.player.cx, this.player.cy, buff.color, 20, { speed: 130, life: 0.7 });
  }

  _gainTrial(amount, x, y, color) {
    this.trial += amount;
    this.totalTrial += amount;
    this.collected++;
    this.combo++;
    this.comboT = 0;
    this.particles.burst(x, y, color, 12, { speed: 100 });

    // 形态进化检查
    const newForm = getFormByTrial(this.totalTrial);
    this.player.setForm(newForm);

    // 达成关卡目标 → 进入 Boss 战（优先于三选一）
    if (this.totalTrial >= this.goalTrial && this.state === "run") {
      this._reachGoal();
      return;
    }

    // 三选一触发检查
    if (this.totalTrial >= this.nextThreshold) {
      this.nextThreshold += CONFIG.trialPerLevel;
      this._openChoose();
    }
  }

  _reachGoal() {
    this.state = "goal";
    this.goalT = 0;
    // 确保进化到最终形态用于展示（若未自然到达，仍以当前形态进Boss）
    this.particles.burst(this.player.cx, this.player.cy, PALETTE.gold, 30, { speed: 160, life: 0.9 });
    this.shake = 6;
    // 到达目标的瞬间就在后台预取下一场景模块，而不是等 1.4 秒过场结束/
    // 玩家点击那一刻才发起加载——过场展示期间正好用来把请求提前做完，
    // 避免"进入下一阶段"瞬间的卡顿，弱网下也不容易卡死进不去。
    this._weaponSelectPromise = import("./WeaponSelectScene.js").catch((e) => {
      console.warn("[RunScene] 预加载 WeaponSelectScene 失败，将在切换时重试", e);
      return null;
    });
  }

  _enterWeaponSelect() {
    const carry = {
      buffs: { ...this.buffs },
      formId: this.player.form.id,
      collected: this.collected,
      score: this.score,
      // 无限模式跨轮累加数据
      endless: this.endless,
    round: this.round,
      totalTrial: this.totalTrial,
    trial: this.trial,
  };
    const loader = this._weaponSelectPromise || import("./WeaponSelectScene.js");
    loader
      .then((m) => {
        if (!m) throw new Error("WeaponSelectScene module not loaded");
        this.game.changeScene(new m.WeaponSelectScene(this.game, this.level, carry));
      })
      .catch((e) => {
        console.warn("[RunScene] 进入武器选择失败，可再次点击重试", e);
        this._leavingGoal = false;
        this._weaponSelectPromise = null;
      });
  }

  _openChoose() {
    this.choices = rollChoices(3);
    this.state = "choose";
    this.chooseAppearT = 0;
  }

  _checkCollisions() {
    // 收集物用玩家全宽判定（拾取手感好）；障碍判定水平内缩，视觉不变但更宽松，
    // 避免"看起来能过却被判定撞上"，尤其是成组细障碍。
    const inset = CONFIG.hitboxInset;
    const pL = this.player.x;
    const pR = this.player.x + this.player.w;
    const hL = pL + inset;
    const hR = pR - inset;
    for (const e of this.spawner.entities) {
      if (e.dead) continue;

      // 六芒星在中间轨(lane=-1)：必须主动切轨经过中线附近才能拾到，
      // 而不是停在某条固定轨道上就被动收走。
      // 之前 dy<24 时，静止停在上轨(dy≈22)也满足条件，等于不切轨也能白拿；
      // 收紧到 dy<10——两条轨道静止时的 dy 分别约 22 / 50，只有真正切轨经过
      // 中线的那一瞬间才会落入这个窗口，逼玩家必须移动才能收集。
      if (e.orbKind === "rarestar") {
        const prevRight = (e.prevX != null ? e.prevX : e.x) + e.w;
        const overlapX = e.x < pR && prevRight > pL;
        const dy = Math.abs(this.player.cy - CONFIG.laneMidY);
        if (overlapX && dy < 10) {
          e.dead = true;
          const doubleMul = 1 + this.stacks("double");
          const val = CONFIG.rareStarValue * doubleMul;
          audio.play("rareStar");
          this._gainTrial(val, e.x + e.w / 2, CONFIG.laneMidY, PALETTE.gold);
          //拾取特效更华丽
          this.particles.burst(e.x + e.w / 2, CONFIG.laneMidY, PALETTE.gold, 24, { speed: 170, life: 0.8, size: 3 });
          Save.recordCollect(this.save, 1);
          Save.addHexagram(this.save, 1); // 六芒星：独立于金币的收集货币，用于商店解锁武器
        }
        continue;
      }

      if (e.lane !== this.player.lane) continue;

      if (e.type === "orb") {
        const prevRight = (e.prevX != null ? e.prevX : e.x) + e.w;
        if (!(e.x < pR && prevRight > pL)) continue;
        e.dead = true;
        const doubleMul = 1 + this.stacks("double");
        const base = e.orbKind === "potion" ? CONFIG.potionValue : CONFIG.starValue;
        const val = base * doubleMul;
        const color = e.orbKind === "potion" ? PALETTE.cyan : PALETTE.gold;
        audio.play(e.orbKind === "potion" ? "collectPotion" : "collectStar");
        this._gainTrial(val, e.x + e.w / 2, this.player.cy, color);
        Save.recordCollect(this.save, 1);
      } else {
        // 障碍从右向左移动，用"扫掠区间"判定：本帧覆盖 [e.x, prevRight]，
        // 避免高速下细障碍一帧内跨过玩家判定区而漏检（碰到不受伤）。
        const prevRight = (e.prevX != null ? e.prevX : e.x) + e.w;
        if (!(e.x < hR && prevRight > hL)) continue;
        this._hitObstacle(e);
        break;
      }
    }
  }

  _hitObstacle(e) {
    if (this.player.invuln > 0) return;

    // ===== 海於专属：契约鲸鱼护盾——不可叠加，攒满就挡下这一次碰撞伤害 =====
    if (this.petShieldReady) {
      this.petShieldReady = false;
      e.dead = true;
      this.player.invuln = 0.3;
      audio.play("rareStar");
      this.particles.burst(this.player.cx, this.player.cy, this.pet.color, 22, { speed: 150, life: 0.5, size: 3 });
      return;
    }

    // ===== 地狱难度：生命制（撞满 maxLives 次即死）=====
    // 破障魔法在地狱下不再"直接碾压"，而是把耐撞上限翻倍(见 maxLives)
    if (this.diff.runLifeMode) {
      e.dead = true;
      this.hitsTaken++;
      this.combo = 0;
      Save.recordObstacleHit(this.save);
      this.player.hit();
      audio.play("hit");
      this.hitStop = CONFIG.hitStop;
      this.shake = CONFIG.shakeOnHit;
      this.particles.burst(this.player.cx, this.player.cy, PALETTE.danger, 18, { speed: 130, life: 0.6, size: 3 });
      // 小幅扣试炼值（不为负）
      const guardMul = Math.pow(0.5, this.stacks("guard"));
      this.trial = Math.max(0, this.trial - Math.round(CONFIG.hitPenalty * guardMul));
      if (this.hitsTaken >= this.maxLives) {
        this._die();
      }
      return;
    }

    const smash = this.stacks("smash");
    if (smash > 0) {
      e.dead = true;
      this.player.invuln = 0.2;
      // 破障魔法 2 层以上：碾压时完全不受僵直（不触发 hitStop）
      if (smash < 2) {
        this.hitStop = CONFIG.hitStop * 0.4;
      }
      this._smashFx(e);
      // 破障碾压不计入"撞击"次数（不算障碍撞击），不打断连续拾取
      return;
    }

    const guardMul = Math.pow(0.5, this.stacks("guard"));
    const penalty = Math.round(CONFIG.hitPenalty * guardMul);

    this.trial -= penalty;
    this.player.hit();
    this.combo = 0;
    Save.recordObstacleHit(this.save);
    audio.play("hit");
    this.hitStop = CONFIG.hitStop;
    this.shake = CONFIG.shakeOnHit;
    this.particles.burst(this.player.cx, this.player.cy, PALETTE.danger, 18, { speed: 130, life: 0.6, size: 3 });
    e.dead = true;

    if (this.trial < 0) {
      this.trial = 0;
      this._die();
    }
  }

  // 障碍碾压特效：冲击环 + 碎片飞溅 + 拖尾冲击线，配合短震
  _smashFx(e) {
    const cx = e.x + e.w / 2;
    const cy = this.player.cy;
    // 碎片飞溅（橙红+白）
    this.particles.burst(cx, cy, PALETTE.danger, 22, { speed: 220, life: 0.45, size: 3 });
    this.particles.burst(cx, cy, "#ffffff", 10, { speed: 160, life: 0.3, size: 2 });
    this.particles.burst(cx, cy, PALETTE.gold, 12, { speed: 180, life: 0.4, size: 2 });
    // 碾压冲击环（用于 render 层绘制的短生命特效）
    if (!this.smashRings) this.smashRings = [];
    this.smashRings.push({ x: cx, y: cy, r: 6, life: 0.32, maxLife: 0.32 });
    this.shake = 7;
  }

  _die() {
    this.state = "dead";
    audio.play("death");
    this.hitStop = CONFIG.hitStop;
    this.shake = CONFIG.shakeOnHit;
    this.particles.burst(this.player.cx, this.player.cy, PALETTE.danger, 24, { speed: 150, life: 0.7, size: 3 });
    this.earned = this.collected;
    this.save.coins += this.earned;
    if (this.score > this.save.hi) this.save.hi = this.score;
    Save.save(this.save);
  }

  _button(ctx, r, label, color) {
    ctx.fillStyle = "rgba(185,107,255,0.14)";
    ctx.fillRect(r.x, r.y, r.w, r.h);
    ctx.strokeStyle = color;
    ctx.lineWidth = 1;
    ctx.strokeRect(r.x + 0.5, r.y + 0.5, r.w - 1, r.h - 1);
    ctx.fillStyle = color;
    ctx.font = "11px 'Microsoft YaHei', 'PingFang SC', sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(label, r.x + r.w / 2, r.y + r.h / 2 + 1);
  }

  render(ctx) {
    const W = this.game.width, H = this.game.height;

    ctx.save();
    if (this.shake > 0.2) {
      ctx.translate((Math.random() - 0.5) * this.shake, (Math.random() - 0.5) * this.shake);
    }
    this.bg.render(ctx, this.t);
    this.spawner.render(ctx, this.t);
    this.player.render(ctx);
    this._renderPet(ctx);
    this._renderSmashRings(ctx);
    this.particles.render(ctx);
    ctx.restore();

    this._renderHUD(ctx, W, H);

    if (this.state === "choose") this._renderChoose(ctx, W, H);
    if (this.state === "goal") this._renderGoal(ctx, W, H);
    if (this.state === "paused") this._renderPause(ctx, W, H);
    if (this.state === "dead" && this.hitStop <= 0) this._renderDead(ctx, W, H);
  }

  // 契约鲸鱼跟随伙伴 + 护盾环（攒满一层护盾时在玩家身周画一圈微光提示）
  _renderPet(ctx) {
    if (!this.pet) return;
    const col = this.pet.color;
    if (this.petShieldReady) {
      ctx.save();
      ctx.strokeStyle = col;
      ctx.lineWidth = 1.5;
      ctx.shadowColor = col; ctx.shadowBlur = 8;
      ctx.globalAlpha = 0.75 + Math.sin(this.t * 6) * 0.2;
      ctx.beginPath();
      ctx.arc(this.player.cx, this.player.cy, 14, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
      ctx.shadowBlur = 0;
    }
    ctx.save();
    ctx.translate(Math.round(this.petX), Math.round(this.petY));
    ctx.fillStyle = col;
    ctx.shadowColor = col; ctx.shadowBlur = 5;
    // 身体
    ctx.beginPath();
    ctx.ellipse(0, 0, 9, 5, 0, 0, Math.PI * 2);
    ctx.fill();
    // 尾巴
    ctx.beginPath();
    ctx.moveTo(-9, 0);
    ctx.lineTo(-15, -5);
    ctx.lineTo(-15, 5);
    ctx.closePath();
    ctx.fill();
    // 喷水
    ctx.strokeStyle = col;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(3, -5);
    ctx.lineTo(2, -9 - Math.sin(this.petBob * 4) * 2);
    ctx.stroke();
    ctx.shadowBlur = 0;
    ctx.restore();
  }

  _renderSmashRings(ctx) {
    if (!this.smashRings || !this.smashRings.length) return;
    for (const s of this.smashRings) {
      const a = Math.max(0, s.life / s.maxLife);
      ctx.save();
      ctx.globalAlpha = a;
      // 冲击环
      ctx.strokeStyle = PALETTE.gold;
      ctx.lineWidth = 3 * a + 0.5;
      ctx.shadowColor = PALETTE.gold; ctx.shadowBlur = 10;
      ctx.beginPath(); ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2); ctx.stroke();
      // 内层白环
      ctx.strokeStyle = "#ffffff";
      ctx.lineWidth = 1.5 * a;
      ctx.beginPath(); ctx.arc(s.x, s.y, s.r * 0.6, 0, Math.PI * 2); ctx.stroke();
      // 放射冲击线（碾压爆裂感）
      ctx.strokeStyle = PALETTE.danger;
      ctx.lineWidth = 2* a;
      for (let i = 0; i < 6; i++) {
        const ang = (i / 6) * Math.PI * 2 + s.maxLife;
        const r0 = s.r * 0.7, r1 = s.r * 1.25;
        ctx.beginPath();
        ctx.moveTo(s.x + Math.cos(ang) * r0, s.y + Math.sin(ang) * r0);
        ctx.lineTo(s.x + Math.cos(ang) * r1, s.y + Math.sin(ang) * r1);
        ctx.stroke();
      }
      ctx.restore();
    }
    ctx.shadowBlur = 0;
  }

  _renderHUD(ctx, W, H) {
    // 目标进度条（当前累计 / 关卡目标）
    // 无限模式：进度按"本轮"计算（从 roundBase 到 goalTrial）
    const base = this.roundBase || 0;
    const span = Math.max(1, this.goalTrial - base);
    const goalProg = Math.max(0, Math.min(1, (this.totalTrial - base) / span));
    const barW = W - 20, barX = 10, barY = 8, barH = 6;
    ctx.fillStyle = "rgba(20,10,31,0.6)";
    ctx.fillRect(barX, barY, barW, barH);
    ctx.fillStyle = PALETTE.gold;
    ctx.fillRect(barX, barY, barW * goalProg, barH);
    ctx.strokeStyle = "rgba(255,207,92,0.5)";
    ctx.lineWidth = 1;
    ctx.strokeRect(barX + 0.5, barY + 0.5, barW - 1, barH - 1);

    // 试炼奖励节点标记（每 trialPerLevel 一个三选一，进度条上标特殊符号）
    const step = CONFIG.trialPerLevel;
    const cyMark = barY + barH / 2;
  ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    for (let v = base + step; v < this.goalTrial; v += step) {
      const mx = barX + barW * ((v - base) / span);
      const reached = this.totalTrial >= v;
      // 特殊符号：✦ 已达成金色发光，未达成暗色
      ctx.font = "10px 'Microsoft YaHei', 'PingFang SC', sans-serif";
      if (reached) {
        ctx.fillStyle = PALETTE.gold;
        ctx.shadowColor = PALETTE.gold; ctx.shadowBlur = 6;
      } else {
        ctx.fillStyle = "rgba(233,220,255,0.55)";
        ctx.shadowBlur = 0;
      }
      ctx.fillText("✦", mx, cyMark);
      ctx.shadowBlur = 0;
    }
    // 终点标记（关卡目标 = Boss）用六芒星
    ctx.font = "11px 'Microsoft YaHei', 'PingFang SC', sans-serif";
    ctx.fillStyle = goalProg >= 1 ? PALETTE.danger : "rgba(255,92,138,0.85)";
    ctx.shadowColor = PALETTE.danger; ctx.shadowBlur = goalProg >= 1 ? 8 : 0;
    ctx.fillText("✶", barX + barW - 2, cyMark);
    ctx.shadowBlur = 0;
    ctx.textAlign = "left";

 ctx.fillStyle = PALETTE.text;
    ctx.font = "10px 'Microsoft YaHei', 'PingFang SC', sans-serif";
    ctx.textBaseline = "top";
    ctx.textAlign = "left";
    if (this.endless) {
      ctx.fillText(`♾ 无尽试炼 第${this.round}轮  试炼值 ${this.trial}`, 10, 20);
    } else {
      ctx.fillText(`第${this.level.index}关 ${this.level.name}  试炼值 ${this.trial}`, 10, 20);
    }
    ctx.fillStyle = "rgba(233,220,255,0.7)";
    ctx.fillText(`形态 ${this.player.form.name}`, 10, 34);

    //地狱难度：血量爱心显示（撞 maxLives 次即死）
    if (this.diff.runLifeMode) {
      const lives = this.lives, max = this.maxLives;
      let hx = 10, hy = 48;
      ctx.font = "11px 'Microsoft YaHei', 'PingFang SC', sans-serif";
      ctx.textBaseline = "top";
      ctx.fillStyle = this.diff.color;
      ctx.fillText("🔥", hx, hy);
      hx += 16;
      for (let i = 0; i < max; i++) {
        ctx.fillStyle = i < lives ? "#ff5c8a" : "rgba(120,80,100,0.5)";
        ctx.fillText(i < lives ? "♥" : "♡", hx + i * 11, hy);
      }
    }

    ctx.fillStyle = "rgba(255,207,92,0.85)";
    ctx.textAlign = "right";
    if (this.endless) {
      ctx.fillText(`本轮 ${this.totalTrial - base}/${this.goalTrial - base}`, W - 34, 34);
    } else {
  ctx.fillText(`目标 ${this.totalTrial}/${this.goalTrial}`, W - 34, 34);
    }

    // 契约鲸鱼护盾状态（海於专属，独立于 Buff 图标行显示在其上方）
    if (this.pet) {
      ctx.textAlign = "left";
      ctx.textBaseline = "middle";
      ctx.font = "9px 'Microsoft YaHei', 'PingFang SC', sans-serif";
      ctx.fillStyle = this.pet.color;
      const label = this.petShieldReady
        ? "🐋 护盾已就位"
        : `🐋 护盾 ${Math.max(0, this.petShieldInterval - this.petShieldT).toFixed(0)}s`;
      // 原来固定在 H-30，和下方 Buff 图标行（H-18，图标框顶边在 H-26）几乎贴死，
      // 中文字号稍高时会视觉重叠，上移到 H-34 留出安全间距。
      ctx.fillText(label, 10, H - 34);
    }

    // Buff 图标列表（左下）
    this._renderBuffIcons(ctx, H);

    // 连续收集连击：屏幕最右侧竖排显示，撞障碍立即清零消失
    this._renderCombo(ctx, W, H);

    // 暂停按钮
    this._renderPauseBtn(ctx);

    ctx.textAlign = "left";
  }

  // 收集连击达到 3 个以上才显示，避免刷屏；每次新增有一次短暂的弹出放大动画
  _renderCombo(ctx, W, H) {
    if (this.combo < 3) return;
    const pop = Math.max(0, 1 - this.comboT * 4); // 0.25s 内的弹出缩放动画
    const scale = 1 + pop * 0.6;
    ctx.save();
    ctx.translate(W - 12, H * 0.42);
    ctx.scale(scale, scale);
    ctx.textAlign = "right";
    ctx.textBaseline = "middle";
    ctx.fillStyle = PALETTE.gold;
    ctx.shadowColor = PALETTE.gold;
    ctx.shadowBlur = 8 + pop * 10;
    ctx.font = "bold 20px 'Microsoft YaHei', 'PingFang SC', sans-serif";
    ctx.fillText(`${this.combo}`, 0, 0);
    ctx.font = "9px 'Microsoft YaHei', 'PingFang SC', sans-serif";
    ctx.fillStyle = "rgba(255,207,92,0.9)";
    ctx.fillText("连击 COMBO", 0, 15);
    ctx.shadowBlur = 0;
    ctx.restore();
    ctx.textAlign = "left";
  }

  _renderPauseBtn(ctx) {
    const b = this._pauseBtn();
    ctx.fillStyle = "rgba(20,10,31,0.6)";
    ctx.fillRect(b.x, b.y, b.w, b.h);
    ctx.strokeStyle = PALETTE.neon; ctx.lineWidth = 1;
    ctx.strokeRect(b.x + 0.5, b.y + 0.5, b.w - 1, b.h - 1);
    ctx.fillStyle = PALETTE.neon;
    ctx.fillRect(b.x + 5, b.y + 4, 3, 8);
    ctx.fillRect(b.x + 10, b.y + 4, 3, 8);
  }

  _renderBuffIcons(ctx, H) {
    const ids = Object.keys(this.buffs).filter((k) => this.buffs[k] > 0);
    let y = H - 18;
    ctx.textAlign = "left";
    ctx.textBaseline = "middle";
    ctx.font = "10px 'Microsoft YaHei', 'PingFang SC', sans-serif";
    for (let i = 0; i < ids.length; i++) {
      const id = ids[i];
      const meta = this._buffMeta(id);
      const x = 10 + i * 34;
      ctx.fillStyle = "rgba(20,10,31,0.6)";
      ctx.fillRect(x, y - 8, 30, 16);
      ctx.fillStyle = meta.color;
      ctx.fillText(`${meta.icon}${this.buffs[id]}`, x + 4, y + 1);
    }
  }

  _buffMeta(id) {
    const map = {
      smash: { icon: "✦", color: "#ff5c8a" },
      double: { icon: "✷", color: "#ffcf5c" },
      guard: { icon: "❖", color: "#4fe0d0" },
      magnet: { icon: "◆", color: "#b96bff" },
      haste: { icon: "➤", color: "#5cff9a" },
      lucky: { icon: "★", color: "#5cc8ff" },
    };
    return map[id] || { icon: "?", color: "#fff" };
  }

  _renderChoose(ctx, W, H) {
    ctx.fillStyle = "rgba(20,10,31,0.82)";
    ctx.fillRect(0, 0, W, H);
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillStyle = PALETTE.gold;
    ctx.font = "bold 18px 'Microsoft YaHei', 'PingFang SC', sans-serif";
    ctx.shadowColor = PALETTE.gold;
    ctx.shadowBlur = 8;
    ctx.fillText("★ 试炼奖励 · 三选一 ★", W / 2, H * 0.2);
    ctx.shadowBlur = 0;
    ctx.fillStyle = "rgba(233,220,255,0.7)";
    ctx.font = "10px 'Microsoft YaHei', 'PingFang SC', sans-serif";
    ctx.fillText("点击卡片 / 按 1 2 3 选择（可叠加）", W / 2, H * 0.2 + 22);

    const rects = this._choiceRects();
    for (let i = 0; i < this.choices.length; i++) {
      const b = this.choices[i];
      const r = rects[i];
      const owned = this.stacks(b.id);
      const anim = Math.min(1, this.chooseAppearT * 4 - i * 0.15);
      if (anim <= 0) continue;
      const oy = (1 - anim) * 30;
      ctx.globalAlpha = Math.max(0, anim);

      ctx.fillStyle = "rgba(42,26,58,0.95)";
      ctx.fillRect(r.x, r.y + oy, r.w, r.h);
      ctx.strokeStyle = b.color;
      ctx.lineWidth = 2;
      ctx.shadowColor = b.color;
      ctx.shadowBlur = 10;
      ctx.strokeRect(r.x + 1, r.y + oy + 1, r.w - 2, r.h - 2);
      ctx.shadowBlur = 0;

      ctx.fillStyle = b.color;
      ctx.font = "bold 12px 'Microsoft YaHei', 'PingFang SC', sans-serif";
      ctx.textAlign = "left";
      ctx.fillText(`${i + 1}`, r.x + 8, r.y + oy + 14);

      ctx.textAlign = "center";
      ctx.font = "30px 'Microsoft YaHei', 'PingFang SC', sans-serif";
      ctx.fillText(b.icon, r.x + r.w / 2, r.y + oy + 44);

      ctx.fillStyle = PALETTE.text;
      ctx.font = "bold 13px 'Microsoft YaHei', 'PingFang SC', sans-serif";
      ctx.fillText(b.name, r.x + r.w / 2, r.y + oy + 78);

      if (owned > 0) {
        ctx.fillStyle = PALETTE.gold;
        ctx.font = "9px 'Microsoft YaHei', 'PingFang SC', sans-serif";
        ctx.fillText(`已拥有 ${owned} 层 → ${owned + 1}`, r.x + r.w / 2, r.y + oy + 96);
      }

      ctx.fillStyle = "rgba(233,220,255,0.8)";
      ctx.font = "9px 'Microsoft YaHei', 'PingFang SC', sans-serif";
      this._wrapText(ctx, b.desc, r.x + r.w / 2, r.y + oy + 116, r.w - 16, 12);

      ctx.globalAlpha = 1;
    }
    ctx.textAlign = "left";
  }

  _renderGoal(ctx, W, H) {
    ctx.fillStyle = "rgba(20,10,31,0.78)";
    ctx.fillRect(0, 0, W, H);
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillStyle = PALETTE.gold;
    ctx.font = "bold 20px 'Microsoft YaHei', 'PingFang SC', sans-serif";
    ctx.shadowColor = PALETTE.gold;
    ctx.shadowBlur = 10;
    ctx.fillText("试炼值已满！", W / 2, H * 0.4);
    ctx.shadowBlur = 0;
    ctx.fillStyle = PALETTE.text;
    ctx.font = "12px 'Microsoft YaHei', 'PingFang SC', sans-serif";
    ctx.fillText("准备迎战 Boss —— 选择你的武器", W / 2, H * 0.52);
    if (Math.floor(this.t * 2) % 2 === 0) {
      ctx.fillStyle = PALETTE.cyan;
      ctx.font = "10px 'Microsoft YaHei', 'PingFang SC', sans-serif";
      ctx.fillText("▼ 点击继续", W / 2, H * 0.62);
    }
    ctx.textAlign = "left";
  }

  _renderPause(ctx, W, H) {
    ctx.fillStyle = "rgba(20,10,31,0.82)";
    ctx.fillRect(0, 0, W, H);
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillStyle = PALETTE.neon;
    ctx.font = "bold 22px 'Microsoft YaHei', 'PingFang SC', sans-serif";
    ctx.shadowColor = PALETTE.neon;
    ctx.shadowBlur = 8;
    ctx.fillText("暂停", W / 2, H * 0.32);
    ctx.shadowBlur = 0;

    const b = this._pauseMenuButtons();
    this._button(ctx, b.resume, "继续游戏", PALETTE.cyan);
    this._button(ctx, b.exit, "退出到主菜单", PALETTE.danger);

    ctx.fillStyle = "rgba(233,220,255,0.45)";
    ctx.font = "9px 'Microsoft YaHei', 'PingFang SC', sans-serif";
    ctx.fillText("P / Esc 继续", W / 2, H * 0.7);
    ctx.textAlign = "left";
  }

  _wrapText(ctx, text, cx, y, maxW, lh) {
    const chars = text.split("");
    let line = "";
    let yy = y;
    for (const ch of chars) {
      const test = line + ch;
      if (ctx.measureText(test).width > maxW && line) {
        ctx.fillText(line, cx, yy);
        line = ch;
        yy += lh;
      } else {
        line = test;
      }
    }
    if (line) ctx.fillText(line, cx, yy);
  }

  _renderDead(ctx, W, H) {
    ctx.fillStyle = "rgba(20,10,31,0.72)";
    ctx.fillRect(0, 0, W, H);
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillStyle = PALETTE.danger;
    ctx.font = "bold 24px 'Microsoft YaHei', 'PingFang SC', sans-serif";
    ctx.fillText("试炼失败", W / 2, H * 0.24);
    ctx.fillStyle = PALETTE.text;
    ctx.font = "12px 'Microsoft YaHei', 'PingFang SC', sans-serif";
    ctx.fillText(`最终形态  ${this.player.form.name}`, W / 2, H * 0.37);
    ctx.fillText(`本次分数  ${this.score}`, W / 2, H * 0.45);
    ctx.fillStyle = PALETTE.gold;
    ctx.font = "11px 'Microsoft YaHei', 'PingFang SC', sans-serif";
    ctx.fillText(`收集 ${this.collected}   金币 +${this.earned}   （共 ${this.save.coins}）`, W / 2, H * 0.53);
    ctx.fillStyle = "rgba(233,220,255,0.7)";
    ctx.fillText(`历史最高  ${this.hi}`, W / 2, H * 0.61);

    if (this.deadT > 0.4) {
      const b = this._deadButtons();
      this._button(ctx, b.restart, "重开", PALETTE.cyan);
      this._button(ctx, b.menu, "主菜单", PALETTE.neon);
    }
    ctx.textAlign = "left";
  }
}
