// 输入管理：键盘（按住/刚按下）+ 指针/触摸（tap 坐标换算到内部分辨率）
// 触摸滑动手势：上滑 / 下滑（全屏任意位置有效，用于手机切轨）
export class Input {
  constructor(canvas) {
    this.down = new Set();
    this.pressed = new Set();
    this.pointer = { x: 0, y: 0, down: false, justDown: false };
    this.canvas = canvas || null;

    // 滑动手势状态：swipeUp / swipeDown 为"本帧刚触发"的一次性标记
    this.swipeUp = false;
    this.swipeDown = false;
    // 轻触（tap）：本帧刚发生一次"没有明显滑动"的手指抬起，作为独立于
    // pointerdown 的兜底触发源。手机上 canvas 的 pointerdown 偶尔会因为
    // 极小的手指位移/页面滚动拦截而不派发，导致"点了没反应"；用 touchend
    // 判定 tap 可以稳定地补上这类点击，专门解决独白/对话点不动的问题。
    this.tap = false;
    // 触摸追踪：记录起点，用于判定滑动方向与距离
    this._touch = { active: false, startX: 0, startY: 0, lastX: 0, lastY: 0, fired: false };
    this._swipeThreshold = 28; // 视口像素，达到即判定为一次滑动
    this._tapMove = 16;        // 视口像素，抬手时位移小于此值判定为一次轻触

    window.addEventListener("keydown", (e) => {
      const k = e.key.toLowerCase();
      if (!this.down.has(k)) this.pressed.add(k);
      this.down.add(k);
      if (["arrowup", "arrowdown", "arrowleft", "arrowright", " "].includes(k)) {
        e.preventDefault();
      }
    });
    window.addEventListener("keyup", (e) => {
      this.down.delete(e.key.toLowerCase());
    });

    // 指针事件同时兼容鼠标与触摸（用于点击菜单/拖动等）
    // 无CSS 旋转，坐标直接换算到内部分辨率（简单、可靠）
    if (canvas) {
      const setP = (e) => {
        const r = canvas.getBoundingClientRect();
        this.pointer.x = ((e.clientX - r.left) / r.width) * canvas.width;
        this.pointer.y = ((e.clientY - r.top) / r.height) * canvas.height;
      };
      canvas.addEventListener("pointerdown", (e) => {
        setP(e);
        this.pointer.down = true;
        this.pointer.justDown = true;
        e.preventDefault();
      }, { passive: false });
      canvas.addEventListener("pointermove", (e) => {
        if (this.pointer.down) { setP(e); e.preventDefault(); }
      }, { passive: false });
      window.addEventListener("pointerup", () => { this.pointer.down = false; });
    }

    // ===== 全屏滑动手势：绑定到 window，全屏任意位置上滑/下滑均生效 =====
    // 使用原生 touch 事件以获得稳定的多点/滑动语义（考虑设备旋转，见 _dirDelta）
    const onStart = (e) => {
      const t = e.touches? e.touches[0] : e;
      this._touch.active = true;
      this._touch.fired = false;
      this._touch.startX = this._touch.lastX = t.clientX;
      this._touch.startY = this._touch.lastY = t.clientY;
    };
    const onMove = (e) => {
      if (!this._touch.active) return;
      const t = e.touches ? e.touches[0] : e;
      this._touch.lastX = t.clientX;
      this._touch.lastY = t.clientY;
      if (this._touch.fired) return;
      const dx = t.clientX - this._touch.startX;
      const dy = t.clientY - this._touch.startY;
      // 纵向占主导才判定为切轨
      if (Math.abs(dy) >= this._swipeThreshold && Math.abs(dy) > Math.abs(dx)) {
        if (dy < 0) this.swipeUp = true; else this.swipeDown = true;
        this._touch.fired = true;   // 一次滑动只触发一次
      }
    };
    const onEnd = () => {
      // 抬手时若整段触摸位移很小（没有明显滑动），判定为一次轻触 tap。
      // 这是独立于 canvas pointerdown 的兜底点击源，专治手机上对话/独白
      // "点了没反应"。仅在本次触摸未被判定为滑动时才触发。
      if (this._touch.active && !this._touch.fired) {
        const dx = this._touch.lastX - this._touch.startX;
        const dy = this._touch.lastY - this._touch.startY;
        if (Math.abs(dx) < this._tapMove && Math.abs(dy) < this._tapMove) {
          this.tap = true;
        }
      }
      this._touch.active = false;
    };

    window.addEventListener("touchstart", onStart, { passive: true });
    window.addEventListener("touchmove", onMove, { passive: true });
    window.addEventListener("touchend", onEnd, { passive: true });
    window.addEventListener("touchcancel", onEnd, { passive: true });
  }

  isDown(...keys) {
    return keys.some((k) => this.down.has(k.toLowerCase()));
  }

  justPressed(...keys) {
    return keys.some((k) => this.pressed.has(k.toLowerCase()));
  }

  // 点击是否命中矩形（内部分辨率坐标）
  tapIn(r) {
    const p = this.pointer;
    return p.justDown && p.x >= r.x && p.x <= r.x + r.w && p.y >= r.y && p.y <= r.y + r.h;
  }

  postUpdate() {
    this.pressed.clear();
    this.pointer.justDown = false;
    this.swipeUp = false;
    this.swipeDown = false;
    this.tap = false;
  }

  // 场景切换时调用：清掉所有一次性触发标志位（按键刚按、指针刚按下、滑动刚触发），
  // 避免上一场景的 tap/按键被带到下一场景，造成"打开新场景的瞬间就被错误地
  // 点了一下/按了一下"。同时确保指针 down 状态也被清掉（防止某次触摸事件丢失
  // 导致 down 状态卡住、下一帧被错误识别为拖动）。
  resetTransient() {
    this.pressed.clear();
    this.pointer.justDown = false;
    this.pointer.down = false;
    this.swipeUp = false;
    this.swipeDown = false;
    this.tap = false;
    this._touch.active = false;
    this._touch.fired = false;
  }
}
