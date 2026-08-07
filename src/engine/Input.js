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
    // 触摸追踪：记录起点，用于判定滑动方向与距离
    this._touch = { active: false, startX: 0, startY: 0, lastX: 0, lastY: 0, fired: false };
    this._swipeThreshold = 28; // 视口像素，达到即判定为一次滑动

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
    if (canvas) {
      const setP = (e) => {
        const r = canvas.getBoundingClientRect();
        const rotated = document.body && document.body.classList.contains("rotate");
        if (rotated) {
          // 舞台顺时针旋转 90°：以 canvas 视觉中心做反旋转，再映射到内部分辨率。
          // getBoundingClientRect 在旋转后返回的是包围盒，其中心即为 canvas 中心。
          const ccx = r.left + r.width / 2;
          const ccy = r.top + r.height / 2;
          const ox = e.clientX - ccx;
          const oy = e.clientY - ccy;
          // 反向旋转 90°(顺时针显示 → 逆旋转)：local = (oy, -ox)
          const lx = oy;
          const ly = -ox;
          // 旋转后视觉宽=r.height、视觉高=r.width；除以缩放后的实际显示尺寸
          const dispW = r.height; // 游戏横向对应的屏幕方向尺寸
          const dispH = r.width;
          this.pointer.x = (lx / dispW + 0.5) * canvas.width;
          this.pointer.y = (ly / dispH + 0.5) * canvas.height;
        } else {
          // 把屏幕坐标换算到内部分辨率坐标（canvas.width = 内部宽）
          this.pointer.x = ((e.clientX - r.left) / r.width) * canvas.width;
          this.pointer.y = ((e.clientY - r.top) / r.height) * canvas.height;
        }
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
      const { dx, dy } = this._dirDelta(
        t.clientX - this._touch.startX,
        t.clientY - this._touch.startY
      );
      // 以"游戏视觉上的纵向"为准（考虑 CSS 旋转），纵向占主导才判定为切轨
      if (Math.abs(dy) >= this._swipeThreshold && Math.abs(dy) > Math.abs(dx)) {
        if (dy < 0) this.swipeUp = true; else this.swipeDown = true;
        this._touch.fired = true;   // 一次滑动只触发一次
      }
    };
    const onEnd = () => { this._touch.active = false; };

    window.addEventListener("touchstart", onStart, { passive: true });
    window.addEventListener("touchmove", onMove, { passive: true });
    window.addEventListener("touchend", onEnd, { passive: true });
    window.addEventListener("touchcancel", onEnd, { passive: true });
  }

  // 把物理滑动位移换算到"游戏视觉方向"：
  // 当页面因竖屏而把 #stage 旋转 90° 显示时（body.rotate），
  // 手指的物理"上滑"对应游戏画面里的"左滑"，需要重新映射。
  _dirDelta(pdx, pdy) {
    if (document.body && document.body.classList.contains("rotate")) {
      // 顺时针旋转 90°：屏幕向右滑 = 游戏向上；屏幕向左滑 = 游戏向下
      // 物理位移 (pdx,pdy) → 游戏位移：gameDx = -pdy, gameDy = pdx
      return { dx: -pdy, dy: pdx };
    }
    return { dx: pdx, dy: pdy };
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
  }
}
