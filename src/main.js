// 入口：初始化引擎（横屏 480x270）并进入标题
import { Game } from "./engine/Game.js";
import { MenuScene } from "./scenes/MenuScene.js";

const game = new Game({
  canvas: document.getElementById("game"),
  width: 480,   // 横屏 16:9 内部分辨率
  height: 270,
});

game.changeScene(new MenuScene(game));
game.start();

window.__game = game;
