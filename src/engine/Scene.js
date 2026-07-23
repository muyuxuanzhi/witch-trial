// 场景基类
export class Scene {
  constructor(game) {
    this.game = game;
  }
  onEnter() {}
  onExit() {}
  update(_dt, _input) {}
  render(_ctx) {}
}
