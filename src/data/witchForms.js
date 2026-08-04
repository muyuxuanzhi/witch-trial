// 魔女形态进化：随累计试炼值 (trial) 阶段进化。
// 每个形态定义配色与绘制特征，Player 依据当前形态渲染。
// threshold: 达到该累计试炼值即进化到此形态。

export const WITCH_FORMS = [
  {
    id: "sailor",
    name: "水手服少女",
    threshold: 0,
    body: "#2a3a6a",       // 深蓝水手服
    outline: "#8fb8ff",
    visor: "#ffffff",    // 白色领巾
  trail: "#8fb8ff",
    hat: false,
    broom: false,
    cape: false,
  },
  {
    id: "apprentice",
    name: "见习魔女",
    threshold: 2500,
    body: "#3a2a54",     // 紫色斗篷
    outline: "#b96bff",
    visor: "#ffcf5c",      // 金色徽章
    trail: "#b96bff",
    hat: true,   // 尖顶帽
    broom: false,
    cape: true,
  },
  {
    id: "witch",
    name: "见习魔女·进阶",
    threshold: 6000,
    body: "#2a1a4a",
    outline: "#d08bff",
    visor: "#4fe0d0",
    trail: "#d08bff",
    hat: true,
    broom: false,
    cape: true,
  },
  {
    id: "broom_witch",
    name: "扫帚魔女",
    threshold: 12000,
    body: "#1a0f3a",    // 终极形态：深邃星空紫
    outline: "#ffcf5c",    // 金色描边
    visor: "#ff8bd0",
    trail: "#ffcf5c",
    hat: true,
    broom: true,           // 骑扫帚
    cape: true,
  },
];

// 依据累计试炼值返回当前形态（取满足 threshold 的最高阶）
export function getFormByTrial(totalTrial) {
  let form = WITCH_FORMS[0];
  for (const f of WITCH_FORMS) {
    if (totalTrial >= f.threshold) form = f;
  }
  return form;
}

// 返回下一个形态（用于进度提示），已满级返回 null
export function getNextForm(totalTrial) {
  for (const f of WITCH_FORMS) {
    if (totalTrial < f.threshold) return f;
  }
return null;
}
