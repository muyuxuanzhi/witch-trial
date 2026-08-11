// 皮肤数据：角色 / 背景 / 障碍 / 武器。以"配色方案"实现，后续可无缝替换为自制像素美术
export const CHARACTER_SKINS = [
  { id: "default", name: "森林魔女", price: 0,   body: "#3d2a54", outline: "#b96bff", visor: "#4fe0d0", trail: "#4fe0d0", desc: "叶林 · 森林魔女学院的见习生。每一位魔女都从最初始的水手服少女形态出发，通过试炼逐级进化。" },
  { id: "cyan",    name: "碧海魔女", price: 40,  body: "#123240", outline: "#4fe0d0", visor: "#b96bff", trail: "#4fe0d0", desc: "深海一般的静谧配色。从水手服少女初始形态起步，凭借星光进化成长。" },
  { id: "crimson", name: "绯红魔女", price: 80,  body: "#3a1020", outline: "#ff5c8a", visor: "#ffcf5c", trail: "#ff5c8a", desc: "绯红如血的高贵配色。同样从零开始，在试炼中积攒星光、进化形态。" },
  { id: "gold",    name: "黄金魔女", price: 150, body: "#3a2e10", outline: "#ffcf5c", visor: "#ffffff", trail: "#ffcf5c", desc: "金橙 · 慵懒的电波系魔女。最爱坚果巧克力与一切金灿灿。初始形态起跑，试炼之路漫漫其修远兮。" },
];

export const BACKGROUND_SKINS = [
  { id: "default",    name: "紫夜星空", price: 0,   sky: ["#1a0d2b", "#140a1f", "#0a0512"], far: "#241436", mid: "#301a4a", ground: "#0d0718", line: "#7a48b0", grid: "rgba(185,107,255,0.18)" },
  { id: "cyber_teal", name: "碧森秘境", price: 50,  sky: ["#0d2630", "#0a1a1f", "#04100f"], far: "#123a3a", mid: "#164a44", ground: "#07160f", line: "#3fa89c", grid: "rgba(79,224,208,0.18)" },
  { id: "sunset",     name: "黄昏祭坛", price: 100, sky: ["#3a1a2b", "#2b1020", "#160610"], far: "#4a2436", mid: "#5a2a2a", ground: "#1a0a10", line: "#c86a8a", grid: "rgba(255,207,92,0.16)" },
];

export const OBSTACLE_SKINS = [
  { id: "default", name: "荆棘红", price: 0,  fill: "#2a1a3a", outline: "#ff5c8a", stripe: "#ff5c8a" },
  { id: "toxic",   name: "剧毒绿", price: 40, fill: "#0d2a1a", outline: "#5cff9a", stripe: "#5cff9a" },
  { id: "ice",     name: "寒冰蓝", price: 80, fill: "#0d1a2a", outline: "#5cc8ff", stripe: "#5cc8ff" },
];

// 武器皮肤：同时也是弹幕战可选武器（数据源在 weapons.js，这里补充商店价格/展示）
export const WEAPON_SKINS = [
  { id: "wand",   name: "星辉法杖", price: 0,   fill: "#123240", outline: "#4fe0d0", stripe: "#4fe0d0" },
  { id: "spread", name: "群星散射", price: 120, fill: "#3a2e10", outline: "#ffcf5c", stripe: "#ffcf5c" },
  { id: "beam",   name: "月光贯穿", price: 200, fill: "#2a1a3a", outline: "#b96bff", stripe: "#b96bff" },
  { id: "homing", name: "追踪飞星", price: 280, fill: "#3a1020", outline: "#ff8bd0", stripe: "#ff8bd0" },
];

export const CATEGORIES = [
  { key: "character",  label: "魔女", list: CHARACTER_SKINS },
  { key: "background", label: "场景", list: BACKGROUND_SKINS },
  { key: "obstacle",   label: "荆棘", list: OBSTACLE_SKINS },
  { key: "weapon",     label: "武器", list: WEAPON_SKINS },
];

export function getSkinList(category) {
  return CATEGORIES.find((c) => c.key === category)?.list || [];
}

export function getSkin(category, id) {
  const list = getSkinList(category);
  return list.find((s) => s.id === id) || list[0];
}
