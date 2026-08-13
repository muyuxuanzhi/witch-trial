// 武器数据：达到最终形态后进入弹幕战，可选择武器。
// 每种武器有独立的射击模式（fireMode）、伤害、冷却、子弹速度、颜色，且各自弹道有区别于
// 直线弹幕的特色轨迹（散射会越飞越散、贯穿光束会持续加速）。
// 单挑 Boss 的目标基线 DPS 约 12~16（见 bosses.js 注释），下面数值已按此重新平衡，
// 不再像之前那样随便一把武器都轻松跑到 20~30 DPS 把 Boss 战节奏碾平。
// price/currency 展示价交由 skins.js 的 WEAPON_SKINS 维护（六芒星货币解锁）。

export const WEAPONS = [
  {
    id: "wand",
    name: "星辉法杖",
    icon: "✦",
    color: "#4fe0d0",
    damage: 2.2,
    cooldown: 0.15,      // 射击间隔（秒）
    bulletSpeed: 400,
    fireMode: "single", // 单发直线
    desc: "基础法杖，单发直线、伤害与射速均衡，新手最稳妥的起手武器。",
  },
  {
    id: "spread",
    name: "群星散射",
    icon: "✷",
    color: "#ffcf5c",
    damage: 1.3,
    cooldown: 0.22,
    bulletSpeed: 380,
    fireMode: "spread", // 三向散射，且随飞行距离持续外扩
    spreadCurve: 220,   // 弹道外扩加速度(px/s²)：越飞越散，近战覆盖广，远处则容易漏
    desc: "三向扇形弹，且越飞越散——贴脸打覆盖广，远距离命中率会下降。",
  },
  {
    id: "beam",
    name: "月光贯穿",
    icon: "➤",
    color: "#b96bff",
    damage: 5,
    cooldown: 0.5,
    bulletSpeed: 460,
    fireMode: "beam",   // 高伤穿透大弹，且飞行途中持续加速
    beamAccel: 300,     // 弹道特色：出手慢但会越飞越快，且贯穿只结算一次伤害
    desc: "蓄力贯穿光束，射速慢但单发重创，且穿透飞行途中会持续加速。",
  },
  {
    id: "homing",
    name: "追踪飞星",
    icon: "★",
    color: "#ff8bd0",
    damage: 1.5,
    cooldown: 0.22,
    bulletSpeed: 320,
    fireMode: "homing", // 追踪弹，弹道会主动转弯咬住 Boss
    desc: "自动追踪 Boss 的魔法飞星，命中稳定但单发威力较低，适合走位苟命。",
  },
];

export function getWeapon(id) {
  return WEAPONS.find((w) => w.id === id) || WEAPONS[0];
}
