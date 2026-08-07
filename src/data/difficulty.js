// 全局难度系统：普通 / 地狱
// 难度是全局设置，在主菜单切换，用localStorage 持久化。
// 地狱难度是一套"生命制+ Boss 强化"的规则，跑酷与 Boss 战都读取这里的参数。
//
// 地狱难度规则（对应策划）：
//   跑酷：3血制，撞 3 次障碍即结束（普通是扣试炼值不死）
//   Boss：3 血制（开局三滴血）；Boss 血量 ×3；攻击频率加快
//   六芒星：拾取后获得短暂无敌
//   破障魔法【smash】效果改变：每拾取一层，耐撞次数翻倍（3 → 6 → 12 …）

const DIFF_KEY = "witch-trial-difficulty";

export const DIFFICULTIES = {
  normal: {
    id: "normal",
    name: "普通",
    icon: "☾",
    color: "#5cff9a",
    desc: "撞障碍只扣试炼值，血条很肉，轻松爽玩。",
    // 跑酷：非生命制（沿用原试炼值机制）
    runLifeMode: false,
    runLives: 0,
    // Boss：血量倍率 / 攻击间隔倍率 / 弹速倍率
    bossHpMul: 1,
    bossIntervalMul: 1,      // 与原BOSS_INTERVAL_SCALE 相乘（越小越密）
    bossBulletSpeedMul: 1,
    // Boss：非生命制（沿用原 40 血长血条）
    bossLifeMode: false,
    bossLives: 0,
    // 六芒星无敌时长（秒）
    starInvuln: 0,
    // 破障魔法：每层耐撞翻倍（仅地狱生效）
    smashDoubleEndurance: false,
  },
  hell: {
    id: "hell",
    name: "地狱",
    icon: "🔥",
    color: "#ff5c5c",
    desc: "三条命定生死！撞 3 次即败，Boss 血量 ×3 且攻势凶猛。破障魔法改为每层耐撞翻倍。",
    // 跑酷：3 血制
    runLifeMode: true,
    runLives: 3,
    // Boss 强化
    bossHpMul: 3,
    bossIntervalMul: 0.62,   // 攻击更频繁（间隔缩短 ~38%）
    bossBulletSpeedMul: 1.15,
    // Boss：3 血制（开局三滴血）
    bossLifeMode: true,
    bossLives: 3,
    // 六芒星：拾取后 2.5s 无敌
    starInvuln: 2.5,
    // 破障魔法：每层耐撞翻倍（3→6→12）
    smashDoubleEndurance: true,
  },
};

export const DIFF_ORDER = ["normal", "hell"];

export function getDifficulty(id) {
  return DIFFICULTIES[id] || DIFFICULTIES.normal;
}

export const Difficulty = {
  load() {
    let id = null;
    try { id = localStorage.getItem(DIFF_KEY); } catch { id = null; }
    return DIFFICULTIES[id] ? id : "normal";
  },
  save(id) {
    if (!DIFFICULTIES[id]) id = "normal";
    try { localStorage.setItem(DIFF_KEY, id); } catch {}
  },
  get() {
    return getDifficulty(this.load());
  },
  isHell() {
    return this.load() === "hell";
  },
};
