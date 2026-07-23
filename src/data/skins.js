// 皮肤数据：角色 / 背景 / 障碍。当前以"配色方案"实现，后续可无缝替换为自制像素美术
export const CHARACTER_SKINS = [
  { id: "default", name: "霓虹紫", price: 0,   body: "#3d2a54", outline: "#b96bff", visor: "#4fe0d0", trail: "#4fe0d0" },
  { id: "cyan",    name: "电子青", price: 40,  body: "#123240", outline: "#4fe0d0", visor: "#b96bff", trail: "#4fe0d0" },
  { id: "crimson", name: "绯红",   price: 80,  body: "#3a1020", outline: "#ff5c8a", visor: "#ffcf5c", trail: "#ff5c8a" },
  { id: "gold",    name: "黄金",   price: 150, body: "#3a2e10", outline: "#ffcf5c", visor: "#ffffff", trail: "#ffcf5c" },
];

export const BACKGROUND_SKINS = [
  { id: "default",    name: "紫夜都市", price: 0,   sky: ["#1a0d2b", "#140a1f", "#0a0512"], far: "#241436", mid: "#301a4a", ground: "#0d0718", line: "#7a48b0", grid: "rgba(185,107,255,0.18)" },
  { id: "cyber_teal", name: "青碧回路", price: 50,  sky: ["#0d2630", "#0a1a1f", "#04100f"], far: "#123a3a", mid: "#164a44", ground: "#07160f", line: "#3fa89c", grid: "rgba(79,224,208,0.18)" },
  { id: "sunset",     name: "黄昏电波", price: 100, sky: ["#3a1a2b", "#2b1020", "#160610"], far: "#4a2436", mid: "#5a2a2a", ground: "#1a0a10", line: "#c86a8a", grid: "rgba(255,207,92,0.16)" },
];

export const OBSTACLE_SKINS = [
  { id: "default", name: "警示红", price: 0,  fill: "#2a1a3a", outline: "#ff5c8a", stripe: "#ff5c8a" },
  { id: "toxic",   name: "剧毒绿", price: 40, fill: "#0d2a1a", outline: "#5cff9a", stripe: "#5cff9a" },
  { id: "ice",     name: "寒冰蓝", price: 80, fill: "#0d1a2a", outline: "#5cc8ff", stripe: "#5cc8ff" },
];

export const CATEGORIES = [
  { key: "character",  label: "角色", list: CHARACTER_SKINS },
  { key: "background", label: "背景", list: BACKGROUND_SKINS },
  { key: "obstacle",   label: "障碍", list: OBSTACLE_SKINS },
];

export function getSkinList(category) {
  return CATEGORIES.find((c) => c.key === category)?.list || [];
}

export function getSkin(category, id) {
  const list = getSkinList(category);
  return list.find((s) => s.id === id) || list[0];
}
