// 全局可调参数：把所有"手感/难度"数值集中，便于快速调优
export const CONFIG = {
  // 场景布局（内部分辨率 480x270）
  groundY: 214,          // 地面基准线
  laneTopY: [104, 176],  // 玩家在 [上轨, 下轨] 的 y（顶部坐标）
  playerX: 96,
  playerW: 16,
  playerH: 22,

  // 速度与难度
  startSpeed: 140,       // 初始滚动速度 px/s
  maxSpeed: 340,
  accel: 6,              // 每秒增加的速度
  laneSwitchLerp: 20,    // 切轨视觉插值速度（越大越干脆）

  // 生成
  spawnStart: 1.05,      // 初始生成间隔（秒）
  spawnMin: 0.5,         // 最小生成间隔
  spawnRampSpeed: 0.02,  // 每秒缩短的间隔
  orbChance: 0.42,       // 生成物为光点的概率（否则为障碍）
  pairOrbChance: 0.5,    // 生成障碍时，另一轨附带光点的概率

  // 手感
  hitStop: 0.12,         // 碰撞顿帧时长
  shakeOnHit: 6,         // 碰撞屏震强度
};
