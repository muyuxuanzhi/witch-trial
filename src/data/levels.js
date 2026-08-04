// 关卡数据：5 个可解锁关卡。
// 每关有独立主题、背景配色、难度参数、通关所需累计试炼值(goalTrial)。
// 重要：goalTrial 必须 >= 终极形态阈值(扫帚魔女 12000)，
//       确保玩家先经过完整进化收集流程、进化到终极魔女后，才进入 Boss 弹幕战。
// 达到 goalTrial 后进入武器选择 → 弹幕Boss 战，击败Boss 即通关解锁下一关。
// 每关有独立 sky/accent 配色 + bgStyle（背景绘制风格），进入不同关卡背景明显不同。
import { getBossById, BOSSES } from "./bosses.js";

export const LEVELS = [
  {
    id: "lv1_forest",
    index: 1,
    name: "迷雾森林",
    subtitle: "见习魔女的第一课",
    goalTrial: 12000,         // 进化到终极形态（扫帚魔女）即挑战 Boss
    speedMul: 1.0,
    potionChance: 0.30,
    sky: ["#12261a", "#0a1a10", "#04100a"],
    accentA: "#5cff9a",
    accentB: "#4fe0d0",
    bgStyle: "forest",        // 背景风格：树林
    ground: "#0c1f14",
    bossId: "evil_mushroom",
    reward: 30,
    desc: "森林深处潜伏着第一只试炼之敌。",
  },
  {
    id: "lv2_swamp",
    index: 2,
    name: "毒沼藤林",
    subtitle: "缠绕的恶意",
    goalTrial: 13500,
    speedMul: 1.12,
    potionChance: 0.30,
    sky: ["#1a2610", "#12190a", "#0a1004"],
    accentA: "#b7ff5c",
    accentB: "#5cff9a",
    bgStyle: "swamp",         // 背景风格：毒沼藤蔓
    ground: "#161f0a",
    bossId: "evil_vine",
    reward: 45,
    desc: "藤蔓蔓延，绞杀一切闯入者。",
  },
  {
    id: "lv3_cave",
    index: 3,
    name: "水晶洞窟",
    subtitle: "回响的低语",
    goalTrial: 15000,
    speedMul: 1.24,
    potionChance: 0.32,
    sky: ["#0d1a2a", "#0a1220", "#040a14"],
    accentA: "#5cc8ff",
    accentB: "#4fe0d0",
    bgStyle: "cave",          // 背景风格：水晶洞窟
    ground: "#0a1420",
    bossId: "crystal_golem",
    reward: 60,
    desc: "冰冷的水晶怪物守着洞窟核心。",
  },
  {
    id: "lv4_castle",
    index: 4,
    name: "幽灵城堡",
    subtitle: "不眠的宿敌",
    goalTrial: 16500,
    speedMul: 1.36,
    potionChance: 0.34,
    sky: ["#2a0d2b", "#1a0a1f", "#100512"],
    accentA: "#b96bff",
    accentB: "#ff8bd0",
    bgStyle: "castle",        // 背景风格：幽灵城堡
    ground: "#180a1a",
    bossId: "ghost_lord",
    reward: 80,
    desc: "城堡之主在阴影中窥视着你。",
  },
  {
    id: "lv5_moon",
    index: 5,
    name: "月蚀祭坛",
    subtitle: "最终试炼",
    goalTrial: 18000,
    speedMul: 1.5,
    potionChance: 0.36,
    sky: ["#1a0f3a", "#100826", "#060312"],
    accentA: "#ffcf5c",
    accentB: "#ff8bd0",
    bgStyle: "moon",          // 背景风格：月蚀祭坛
    ground: "#0e0826",
    bossId: "eclipse_witch",
    reward: 150,
    desc: "月蚀之下，真正的魔女试炼降临。",
  },
];

// ===== 无限模式 =====
// 流程与普通关一致（跑酷收集 → 武器选择 → 弹幕Boss），
// 但 Boss 每轮从 5 个里随机、收集度与 Buff 属性可无限叠加、通关后进入下一轮（目标递增）。
export const ENDLESS_LEVEL = {
  id: "endless",
  index: 0,
  endless: true,
  name: "无尽试炼",
  subtitle: "永无止境的魔女之路",
  goalTrial: 12000,   // 第 1 轮目标（后续每轮递增）
  speedMul: 1.0,
  potionChance: 0.32,
  sky: ["#1a0f3a", "#100826", "#060312"],
  accentA: "#ffcf5c",
  accentB: "#ff8bd0",
  bgStyle: "moon",
  ground: "#0e0826",
  bossId: "eclipse_witch", // 占位，实际每轮随机
  reward: 40,
  desc: "Boss 随机、属性无限叠加，看你能撑到第几轮！",
};

// 随机取一个 Boss（用于无限模式每轮）
export function randomBossId() {
  return BOSSES[Math.floor(Math.random() * BOSSES.length)].id;
}

// 生成第 round 轮的无限模式关卡（round 从 1 开始）
export function makeEndlessLevel(round = 1) {
  // 随机套用一个已有关卡的配色主题，让每轮画面有变化
  const theme = LEVELS[Math.floor(Math.random() * LEVELS.length)];
  return {
    ...ENDLESS_LEVEL,
    round,
    // 目标随轮次递增：第 1 轮 12000，之后每轮 +3000
    goalTrial: 12000 + (round - 1) * 3000,
    // 速度随轮次略增（有上限感）
    speedMul: Math.min(2.2, 1.0 + (round - 1) * 0.12),
    // 本轮随机 Boss
  bossId: randomBossId(),
    // 本轮随机配色主题
    sky: theme.sky,
    accentA: theme.accentA,
    accentB: theme.accentB,
    bgStyle: theme.bgStyle,
ground: theme.ground,
    name: `无尽试炼 · 第${round}轮`,
  };
}

export function getLevel(index) {
  return LEVELS.find((l) => l.index === index) || LEVELS[0];
}

export function getLevelById(id) {
  return LEVELS.find((l) => l.id === id) || LEVELS[0];
}

export function getLevelBoss(level) {
  return getBossById(level.bossId);
}

// 依据关卡配色生成 Background 皮肤（每关背景不同）
export function levelBgSkin(level) {
  return {
    sky: level.sky,
    far: level.accentB,
    mid: level.accentA,
    ground: level.ground || level.sky[2],
    line: level.accentA,
    grid: level.accentB,
    bgStyle: level.bgStyle || "forest",
    accentA: level.accentA,
    accentB: level.accentB,
  };
}

export const TOTAL_LEVELS = LEVELS.length;
