// Boss 数据：每关一个最终 Boss。
// 每个 Boss 有血量(hp)、弹幕攻击模式(patterns)、移动方式、外观绘制类型(shape)、配色。
// BossScene 依据这些数据驱动弹幕战。
// 肉鸽爽游平衡：玩家有效 DPS 约 12~16，血量按"至少撑住 30 秒攻击"配平，
//第1关 ~30s，逐关递增到最终关 ~50s。弹幕数量偏少、间隔偏长，好躲、打得爽。

export const BOSSES = [
  {
    id: "evil_mushroom",
    name: "邪恶蘑菇",
    hp: 460,                  // ~30 秒
    shape: "mushroom",
    color: "#ff5c8a",
    capColor: "#c8324f",
    moveMode: "sway",        // 上下摇摆
    moveSpeed: 60,
    patterns: [
      { type: "spread", count: 3, interval: 1.4, bulletSpeed: 90, spreadDeg: 50 },
      { type: "aimed", count: 1, interval: 1.0, bulletSpeed: 120 },
    ],
    desc: "喷吐孢子弹幕的森林之敌。",
  },
  {
    id: "evil_vine",
    name: "邪恶藤蔓",
    hp: 540,                  // ~35 秒
    shape: "vine",
    color: "#5cff9a",
    capColor: "#2ea85c",
    moveMode: "sway",
    moveSpeed: 75,
    patterns: [
      { type: "wave", count: 4, interval: 1.5, bulletSpeed: 80, spreadDeg: 80 },
      { type: "aimed", count: 1, interval: 0.95, bulletSpeed: 110 },
    ],
    desc: "挥舞藤蔓、缠绕射击的毒沼之主。",
  },
  {
    id: "crystal_golem",
    name: "水晶魔像",
    hp: 620,                  // ~40 秒
    shape: "golem",
    color: "#5cc8ff",
    capColor: "#3a8cc8",
    moveMode: "chase",       // 追踪玩家 Y
    moveSpeed: 46,
    patterns: [
      { type: "ring", count: 8, interval: 2.0, bulletSpeed: 80 },
      { type: "aimed", count: 2, interval: 0.95, bulletSpeed: 125 },
    ],
    desc: "以水晶碎片轰击的洞窟守卫。",
  },
  {
    id: "ghost_lord",
    name: "幽灵领主",
    hp: 700,                  // ~45 秒
    shape: "ghost",
    color: "#b96bff",
    capColor: "#7a48b0",
    moveMode: "teleport",    // 瞬移
    moveSpeed: 0,
    patterns: [
      { type: "spiral", count: 2, interval: 0.32, bulletSpeed: 88 },
      { type: "aimed", count: 2, interval: 0.95, bulletSpeed: 135 },
    ],
    desc: "瞬移穿梭、螺旋弹幕的城堡之主。",
  },
  {
    id: "eclipse_witch",
    name: "月蚀魔女",
    hp: 800,                  // ~50 秒
    shape: "witch",
    color: "#ffcf5c",
    capColor: "#c89a3a",
    moveMode: "sway",
    moveSpeed: 88,
    patterns: [
      { type: "ring", count: 10, interval: 1.9, bulletSpeed: 82 },
      { type: "spiral", count: 3, interval: 0.3, bulletSpeed: 90 },
      { type: "aimed", count: 2, interval: 0.95, bulletSpeed: 140 },
    ],
    desc: "掌控月蚀之力的最终宿敌。",
  },
];

export function getBossById(id) {
  return BOSSES.find((b) => b.id === id) || BOSSES[0];
}
