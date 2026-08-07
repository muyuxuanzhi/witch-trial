// Buff 数据：见习魔女试炼的成长循环。每达到一个试炼阈值触发三选一。
// 效果可持续、可叠加（stacks 记录层数）。
// apply(ctx) 在收集/碰撞/生成等时机被 RunScene 查询。

export const BUFFS = [
  {
    id: "smash",
    name: "破障魔法",
    icon: "✦",
    color: "#ff5c8a",
    desc: "冲撞时击碎障碍，不再受伤（每层减少僵直）",
  },
  {
    id: "double",
    name: "双倍魔力",
    icon: "✷",
    color: "#ffcf5c",
    desc: "收集物价值 ×2（可叠加：×2 ×3 ×4…）",
  },
  {
  id: "guard",
    name: "护盾结界",
    icon: "❖",
    color: "#4fe0d0",
    desc: "受伤减半（每层再减，扣除更少试炼值）",
  },
  {
    id: "magnet",
    name: "星辰牵引",
    icon: "★",
    color: "#5cff9a",
    desc: "召唤跟随的绿色小星星，Boss战协同攻击（伤害约为你的一半，可叠加）",
  },
  {
    id: "haste",
    name: "疾风加速",
    icon: "➤",
    color: "#5cff9a",
    desc: "得分速率提升（每层 +15% 距离分）",
  },
  {
    id: "lucky",
    name: "幸运星",
    icon: "★",
    color: "#5cc8ff",
    desc: "收集物出现率提升（每层 +12%）",
  },
];

export function getBuff(id) {
  return BUFFS.find((b) => b.id === id);
}

// 随机抽取 n 个不重复的 buff 供三选一（允许抽到已拥有的以便叠加）
export function rollChoices(n = 3) {
  const pool = BUFFS.slice();
  const out = [];
  while (out.length < n && pool.length) {
    const i = Math.floor(Math.random() * pool.length);
    out.push(pool.splice(i, 1)[0]);
  }
  return out;
}
