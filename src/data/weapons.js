// 武器数据：达到最终形态后进入弹幕战，可选择武器。
// 每种武器有独立的射击模式（fireMode）、伤害、冷却、子弹速度、颜色。
// BossScene 依据装备/选择的武器决定玩家弹幕形态。
// 肉鸽爽游：整体伤害高、冷却低、子弹快，打起来爽快。

export const WEAPONS = [
  {
    id: "wand",
    name: "星辉法杖",
    icon: "✦",
    price: 0,
    color: "#4fe0d0",
    damage: 2,
    cooldown: 0.1,      // 射击间隔（秒）
    bulletSpeed: 420,
    fireMode: "single", // 单发直线
    desc: "基础法杖，极速连射，稳定可靠。",
  },
  {
    id: "spread",
    name: "群星散射",
    icon: "✷",
    price: 120,
    color: "#ffcf5c",
    damage: 2,
    cooldown: 0.2,
    bulletSpeed: 400,
    fireMode: "spread", // 三向散射
    desc: "一次射出三发扇形弹，火力覆盖极广。",
  },
  {
    id: "beam",
    name: "月光贯穿",
    icon: "➤",
    price: 200,
    color: "#b96bff",
    damage: 4,
    cooldown: 0.3,
    bulletSpeed: 640,
    fireMode: "beam",   // 高速穿透大弹
    desc: "高伤穿透光束，命中即重创。",
  },
  {
    id: "homing",
    name: "追踪飞星",
    icon: "★",
    price: 280,
    color: "#ff8bd0",
    damage: 2,
    cooldown: 0.16,
    bulletSpeed: 340,
    fireMode: "homing", // 追踪弹
    desc: "自动追踪 Boss 的魔法飞星，指哪打哪。",
  },
];

export function getWeapon(id) {
  return WEAPONS.find((w) => w.id === id) || WEAPONS[0];
}
