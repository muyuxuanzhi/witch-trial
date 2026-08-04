# 魔女试炼 / Witch Trial

赛博紫色像素风的**横屏双轨跑酷 + 弹幕 Boss 战**肉鸽游戏。仅用**上下键**在双轨间穿行、躲避障碍、收集试炼值进化形态；攒满目标后选择武器，进入弹幕 Boss 战决战魔女。原生 HTML5 Canvas + ES Modules 自研引擎，零构建、静态可部署，电脑与手机端通用。

> 由早期跑酷原型「霓虹疾跑」演进而来，现已发展为带关卡、剧情、Boss 与肉鸽成长的完整可玩版本。

## 核心玩法

- **↑ / W**：切上轨　**↓ / S**：切下轨（手机：点上/下半屏切轨）
- 跑酷阶段：躲红色障碍、吃金色光点，**收集试炼值**；每攒够一定量触发**三选一 Buff**并进化魔女形态
- 达到本关目标后进入**武器选择**，再进入**弹幕 Boss 战**
- Boss 战：纵向移动走位、射击输出，收集**六芒星**触发狂暴；击败 Boss 通关解锁下一关

## 内容一览

- **5 个关卡**：各有独立配色、剧情 Intro、目标与 Boss
- **5 个 Boss**：蘑菇 / 藤蔓 / 石魔 / 幽灵 / 月蚀魔女，各自弹幕形态
- **武器系统**：Boss 战前多种武器可选（射速 / 伤害 / 弹型各异）
- **三选一 Buff**：护盾结界 / 迅捷 / 双倍 / 破障 / 幸运 等，成长驱动
- **魔女形态进化**：随累计试炼值逐级进化
- **♾ 无限模式**：Boss 每轮从 5 个里随机、收集度与属性**无限叠加**、目标逐轮递增，挑战能撑到第几轮

## 本地运行

```bash
python -m http.server 5500   # 或 npx serve .
# 浏览器打开 http://localhost:5500
```

## 目录结构

```
neon-runner/
├─ index.html
├─ css/style.css
└─ src/
   ├─ main.js
   ├─ engine/        Game(循环/像素缩放/场景栈) · Input · Scene
├─ data/
   │  ├─ config.js 全部手感/难度参数集中可调
 │  ├─ levels.js       关卡数据 + 无限模式生成器
   │  ├─ bosses.js       Boss 弹幕配置
   │  ├─ weapons.js      武器定义
   │  ├─ buffs.js        三选一 Buff 定义
   │  ├─ witchForms.js   魔女形态进化
   │  └─ skins.js        皮肤（角色/背景/障碍）
   ├─ systems/
   │  ├─ Player.js       双轨切换 + 切轨插值 + 拖尾 + 挤压拉伸 + 形态
   │  ├─ Spawner.js      程序化障碍/光点生成 + 难度爬升
   │  ├─ Particles.js    粒子反馈（juice）
   │  ├─ Background.js   多层视差霓虹城市 + 滚动地面
   │  └─ Save.js         localStorage 存档（金币/最高分/皮肤/关卡解锁）
   └─ scenes/
   ├─ MenuScene.js          主菜单
      ├─ LevelSelectScene.js   选关 + 无限模式入口
      ├─ IntroScene.js    关卡剧情
      ├─ RunScene.js     跑酷：碰撞/计分/试炼收集/形态进化
      ├─ WeaponSelectScene.js  武器选择
      ├─ BossScene.js  弹幕 Boss 战
  └─ ShopScene.js        商城
```

## 技术看点

- 自研游戏循环（dt 上限、场景栈）与整数放大像素渲染管线
- **程序化内容生成**：障碍/光点随机布轨 + 难度随时间爬升
- **肉鸽成长系统**：试炼值 → 形态进化 + 三选一 Buff，Buff 在 Boss 战换算成实战属性
- **无限模式**：跨轮 carry 累加（Buff / 收集度 / 试炼值），Boss 随机、目标逐轮递增
- **弹幕 Boss 战**：多形态弹幕、六芒星狂暴机制、走位射击
- **手感/juice 全家桶**：切轨挤压拉伸、拖尾、粒子爆发、屏震、碰撞顿帧
- 参数集中在 `config.js`，可快速调优
- 电脑端键鼠 + 手机端触屏双适配，960×540 视口，支持全屏

## 存档

localStorage 持久化：金币、最高分、已购/已装备皮肤、关卡解锁进度。无限模式仅累加金币，不影响关卡解锁。
