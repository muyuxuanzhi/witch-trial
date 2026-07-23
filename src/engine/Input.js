// 输入管理：键盘（按住/刚按下）+ 指针/触摸（tap 坐标换算到内部分辨率）
export class Input {
  constructor(canvas) {
    this.down = new Set();
    this.pressed = new Set();
    this.pointer = { x: 0, y: 0, down: false, justDown: false };
    this.canvas = canvas || null;

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

    // 指针事件同时兼容鼠标与触摸
    if (canvas) {
      const setP = (e) => {
        const r = canvas.getBoundingClientRect();
        // 把屏幕坐标换算到内部分辨率坐标（canvas.width = 内部宽）
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
  }
}
