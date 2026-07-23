// 核心跑酷场景：滚动、双轨躲避、碰撞、计分、屏震顿帧、结算重开
// 键盘 + 触屏：点击上/下半屏切轨；结算界面点击「重开 / 主菜单」按钮
import { Scene } from "../engine/Scene.js";
import { PALETTE } from "../engine/Game.js";
import { CONFIG } from "../data/config.js";
import { Player } from "../systems/Player.js";
import { Spawner } from "../systems/Spawner.js";
import { Particles } from "../systems/Particles.js";
import { Background } from "../systems/Background.js";
import { Save } from "../systems/Save.js";
import { getSkin } from "../data/skins.js";
import { MenuScene } from "./MenuScene.js";

export class RunScene extends Scene {
  constructor(game) {
    super(game);
    this.save = Save.load();
    this.bg = new Background(game.width, game.height, getSkin("background", this.save.equipped.background));
    this.player = new Player(getSkin("character", this.save.equipped.character));
    this.spawner = new Spawner(getSkin("obstacle", this.save.equipped.obstacle));
    this.particles = new Particles();

    this.speed = CONFIG.startSpeed;
    this.elapsed = 0;
    this.distance = 0;
    this.orbs = 0;
    this.state = "run";
    this.shake = 0;
    this.hitStop = 0;
    this.deadT = 0;
    this.earned = 0;
    this.t = 0;
  }

  get hi() { return this.save.hi; }
  get score() { return Math.floor(this.distance) + this.orbs * 25; }

  _deadButtons() {
    const W = this.game.width, H = this.game.height;
    return {
      restart: { x: W / 2 - 86, y: H * 0.72, w: 80, h: 22 },
      menu: { x: W / 2 + 6, y: H * 0.72, w: 80, h: 22 },
    };
  }

  update(dt, input) {
    this.t += dt;

    if (this.hitStop > 0) {
      this.hitStop -= dt;
      this.shake *= 0.9;
      return;
    }

    if (this.state === "dead") {
      this.deadT += dt;
      this.particles.update(dt);
      this.shake *= 0.88;
      if (this.deadT > 0.4) {
        const b = this._deadButtons();
        if (input.justPressed("enter", " ") || input.tapIn(b.restart)) {
          this.game.changeScene(new RunScene(this.game));
        } else if (input.justPressed("escape", "backspace") || input.tapIn(b.menu)) {
          this.game.changeScene(new MenuScene(this.game));
        }
      }
      return;
    }

    this.elapsed += dt;
    this.speed = Math.min(CONFIG.maxSpeed, CONFIG.startSpeed + this.elapsed * CONFIG.accel);
    this.distance += this.speed * dt * 0.1;

    this.bg.update(dt, this.speed);
    this.player.update(dt, input);
    // 触屏：点击上半屏切上轨，下半屏切下轨
    if (input.pointer.justDown) {
      this.player.switchLane(input.pointer.y < this.game.height / 2 ? 0 : 1);
    }
    this.spawner.update(dt, this.speed, this.elapsed);
    this.particles.update(dt);
    this._checkCollisions();

    this.shake *= 0.85;
  }

  _checkCollisions() {
    const pL = this.player.x;
    const pR = this.player.x + this.player.w;
    for (const e of this.spawner.entities) {
      if (e.dead) continue;
      if (e.lane !== this.player.lane) continue;
      const overlap = e.x < pR && e.x + e.w > pL;
      if (!overlap) continue;

      if (e.type === "orb") {
        e.dead = true;
        this.orbs++;
        this.particles.burst(e.x + e.w / 2, this.player.cy, PALETTE.gold, 12, { speed: 100 });
      } else {
        this._die();
        break;
      }
    }
  }

  _die() {
    this.state = "dead";
    this.hitStop = CONFIG.hitStop;
    this.shake = CONFIG.shakeOnHit;
    this.particles.burst(this.player.cx, this.player.cy, PALETTE.danger, 24, { speed: 150, life: 0.7, size: 3 });
    this.earned = this.orbs;
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
    ctx.font = "11px monospace";
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
    this.particles.render(ctx);
    ctx.restore();

    // HUD
    ctx.fillStyle = PALETTE.text;
    ctx.font = "10px monospace";
    ctx.textBaseline = "top";
    ctx.textAlign = "left";
    ctx.fillText(`分数 ${this.score}`, 10, 8);
    ctx.fillStyle = PALETTE.gold;
    ctx.fillText(`光点 ${this.orbs}`, 10, 22);
    ctx.fillStyle = "rgba(233,220,255,0.6)";
    ctx.textAlign = "right";
    ctx.fillText(`最高 ${this.hi}`, W - 10, 8);
    ctx.fillText(`速度 ${Math.round(this.speed)}`, W - 10, 22);
    ctx.textAlign = "left";

    if (this.state === "dead" && this.hitStop <= 0) {
      ctx.fillStyle = "rgba(20,10,31,0.72)";
      ctx.fillRect(0, 0, W, H);
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillStyle = PALETTE.danger;
      ctx.font = "bold 24px monospace";
      ctx.fillText("疾跑结束", W / 2, H * 0.28);
      ctx.fillStyle = PALETTE.text;
      ctx.font = "12px monospace";
      ctx.fillText(`本次分数  ${this.score}`, W / 2, H * 0.42);
      ctx.fillStyle = PALETTE.gold;
      ctx.font = "11px monospace";
      ctx.fillText(`金币 +${this.earned}   （共 ${this.save.coins}）`, W / 2, H * 0.51);
      ctx.fillStyle = "rgba(233,220,255,0.7)";
      ctx.fillText(`历史最高  ${this.hi}`, W / 2, H * 0.59);

      if (this.deadT > 0.4) {
        const b = this._deadButtons();
        this._button(ctx, b.restart, "重开", PALETTE.cyan);
        this._button(ctx, b.menu, "主菜单", PALETTE.neon);
      }
      ctx.textAlign = "left";
    }
  }
}
