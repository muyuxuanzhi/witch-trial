// 轻量游戏引擎核心：画布管理、像素缩放、场景栈、固定步长游戏循环
import { Input } from "./Input.js";

export const PALETTE = {
  bg: "#140a1f",
  panel: "#2a1a3a",
  panelLight: "#3d2a54",
  neon: "#b96bff",
  neonDim: "#7a48b0",
  cyan: "#4fe0d0",
  gold: "#ffcf5c",
  text: "#e9dcff",
  shadow: "#0a0512",
  danger: "#ff5c8a",
};

export class Game {
  constructor({ canvas, width, height }) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d");
    this.width = width;
    this.height = height;
    this.scene = null;
    this.input = new Input(canvas);
    this.time = 0;
    this._raf = null;
    this._last = 0;

    this._resize();
    window.addEventListener("resize", () => this._resize());
    window.addEventListener("orientationchange", () => setTimeout(() => this._resize(), 120));
  }

  _resize() {
    // 自适应缩放：canvas 按当前视口等比缩放并居中，坐标一律直接映射。
    // 不做任何 CSS 旋转 / 遮罩，避免坐标错乱与鼠标被挡。
    // 手机横过来即自然铺满 16:9；竖着拿画面缩小居中，仍可玩。
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const scale = Math.min(vw / this.width, vh / this.height);
    this.scale = scale;
    this.canvas.width = this.width;
    this.canvas.height = this.height;
    this.canvas.style.width = Math.round(this.width * scale) + "px";
    this.canvas.style.height = Math.round(this.height * scale) + "px";
    this.ctx.imageSmoothingEnabled = false;
  }

  changeScene(scene) {
    if (this.scene && this.scene.onExit) this.scene.onExit();
    this.scene = scene;
    if (this.scene.onEnter) this.scene.onEnter();
  }

  start() {
    this._last = performance.now();
    const loop = (now) => {
      let dt = (now - this._last) / 1000;
      this._last = now;
      if (dt > 0.05) dt = 0.05;
      this.time += dt;

      if (this.scene) {
        this.scene.update(dt, this.input);
        this.scene.render(this.ctx);
      }
      this.input.postUpdate();
      this._raf = requestAnimationFrame(loop);
    };
    this._raf = requestAnimationFrame(loop);
  }

  stop() {
    if (this._raf) cancelAnimationFrame(this._raf);
  }
}
