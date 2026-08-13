// 存档系统：金币、最高分、已购皮肤、已装备皮肤、关卡解锁进度、成就进度，持久化到 localStorage
const KEY = "neon-dash-save";

function defaults() {
  return {
    coins: 0,
    hi: 0,
    hexagram: 0, // 六芒星：金币之外的独立收集货币，专门用于在商店解锁武器
    owned: { character: ["default"], background: ["default"], obstacle: ["default"], weapon: ["wand"] },
    equipped: { character: "default", background: "default", obstacle: "default", weapon: "wand" },
    // 关卡进度：已解锁到第几关（1~5），已通关的关卡 id 集合
    unlockedLevel: 1,   // 已解锁的最高关卡序号（从 1 开始）
    clearedLevels: [],  // 已通关的关卡 id 列表
    // ===== 成就系统进度统计 =====
    // 累计统计（仅增不减） / 单局统计（每局结算时清零） / 标记位
    statStars: 0,           // 累计拾取六芒星（含跑酷的星星/药水/中间轨稀有星 + Boss战六芒星）
    statCoinsTotal: 0,      // 累计获得金币（仅记收入，未扣除花费）
    statBestEndlessRound: 0,// 无限模式最高到达轮次
    statHellCleared: 0,     // 累计通关地狱关卡数（按 level.id 去重）
    statBossClearNoHit: 0,  // 累计：Boss战不受伤通关次数
    statClearWithoutHit: 0, // 累计：跑酷不撞障碍通关次数
    statFullBloodClear: 0,  // 累计：撞满血量上限仍通关次数（地狱"永不退缩"）
    statStarChain: 0,       // 单局最长连续拾取收集物
    statRunMaxStars: 0,     // 单局跑酷最高拾取数（通关时记录）
    statOneShotClear: 0,    // 一周目通关数（自上次进入主菜单以来通关全部5关）
    statCoins666: 0,        // 通关时金币恰好为666的倍数的次数
    statGuard6: 0,          // 通关时护盾结界层数≥6
    statFinalSweet: 0,      // 终极甜蜜：通关+解锁黄金魔女皮肤
    // ===== 已解锁成就 id 集合 =====
    achievements: {},
    // 本局统计（每局开始时归零）
    runStats: null,
  };
}

// 数值默认（避免 undefined 出现在统计字段）
function fillStats(d, m) {
  const fields = [
    "statStars", "statCoinsTotal", "statBestEndlessRound", "statHellCleared",
    "statBossClearNoHit", "statClearWithoutHit", "statFullBloodClear",
    "statStarChain", "statRunMaxStars", "statOneShotClear", "statCoins666",
    "statGuard6", "statFinalSweet",
  ];
  for (const k of fields) if (typeof m[k] !== "number") m[k] = d[k];
  if (!m.achievements || typeof m.achievements !== "object") m.achievements = {};
}

export const Save = {
  load() {
    let data = null;
    try { data = JSON.parse(localStorage.getItem(KEY)); } catch { data = null; }
    const d = defaults();
    if (!data) data = {};
    // 合并，保证结构完整
    const merged = {
      coins: data.coins ?? d.coins,
      hi: data.hi ?? d.hi,
      hexagram: data.hexagram ?? d.hexagram,
      owned: {
        character: data.owned?.character ?? d.owned.character.slice(),
        background: data.owned?.background ?? d.owned.background.slice(),
        obstacle: data.owned?.obstacle ?? d.owned.obstacle.slice(),
        weapon: data.owned?.weapon ?? d.owned.weapon.slice(),
      },
      equipped: {
        character: data.equipped?.character ?? d.equipped.character,
        background: data.equipped?.background ?? d.equipped.background,
        obstacle: data.equipped?.obstacle ?? d.equipped.obstacle,
        weapon: data.equipped?.weapon ?? d.equipped.weapon,
      },
      unlockedLevel: data.unlockedLevel ?? d.unlockedLevel,
      clearedLevels: data.clearedLevels ?? d.clearedLevels.slice(),
    };
    fillStats(d, merged);
    // 迁移旧版最高分键
    const oldHi = Number(localStorage.getItem("neon-dash-hi") || 0);
    if (oldHi > merged.hi) merged.hi = oldHi;
    return merged;
  },

  save(data) {
    try { localStorage.setItem(KEY, JSON.stringify(data)); } catch {}
  },

  isOwned(data, category, id) {
    return (data.owned[category] || []).includes(id);
  },

  // 购买：成功返回 true。skin.currency==="hexagram" 时消耗六芒星而非金币（目前武器解锁走这条路）
  buy(data, category, skin) {
    if (this.isOwned(data, category, skin.id)) return false;
    const useHex = skin.currency === "hexagram";
    const bal = useHex ? (data.hexagram || 0) : data.coins;
    if (bal < skin.price) return false;
    if (useHex) data.hexagram -= skin.price;
    else data.coins -= skin.price;
    data.owned[category].push(skin.id);
    data.equipped[category] = skin.id; // 购买后自动装备
    this.save(data);
    return true;
  },

  equip(data, category, id) {
    if (!this.isOwned(data, category, id)) return false;
    data.equipped[category] = id;
    this.save(data);
    return true;
  },

  // ===== 关卡进度 =====
  isLevelUnlocked(data, index) {
    // index 从 1 开始
    return index <= (data.unlockedLevel || 1);
  },

  isLevelCleared(data, levelId) {
    return (data.clearedLevels || []).includes(levelId);
  },

  // 通关某关：记录已通关，并解锁下一关
  clearLevel(data, levelId, levelIndex, totalLevels, reward = 0) {
    if (!data.clearedLevels.includes(levelId)) data.clearedLevels.push(levelId);
    if (levelIndex + 1 > data.unlockedLevel && levelIndex < totalLevels) {
      data.unlockedLevel = levelIndex + 1;
    }
    data.coins += reward;
    data.statCoinsTotal = (data.statCoinsTotal || 0) + reward;
    this.save(data);
  },

  // ===== 成就系统辅助 =====
  // 初始化本局统计（在 RunScene / BossScene 开始时调用）
  initRunStats(data) {
    data.runStats = {
      collected: 0,        // 本局拾取收集物总数
      stars: 0,            // 本局拾取六芒星（含Boss战）
      chain: 0,            // 本局当前连续拾取（被打断清零）
      maxChain: 0,         // 本局最长连续
      obstacleHits: 0,     // 本局障碍受击次数
      bossHits: 0,         // 本局Boss战受击次数
      bossEndlessRound: 0, // 本局无限模式轮次
      guardStacks: 0,      // 本局通关时护盾结界层数
      startCoins: data.coins,
      startedAt: Date.now(),
      clearedLevelIds: [], // 本局通关的关卡id
    };
    return data.runStats;
  },

  // 累加拾取：更新本局/全局统计 + 连续拾取链
  recordCollect(data, n = 1) {
    data.statStars = (data.statStars || 0) + n;
    if (data.runStats) {
      data.runStats.collected += n;
      data.runStats.stars += n;
      data.runStats.chain += n;
      if (data.runStats.chain > data.runStats.maxChain) {
        data.runStats.maxChain = data.runStats.chain;
      }
      if (data.runStats.chain > (data.statStarChain || 0)) {
        data.statStarChain = data.runStats.chain;
      }
    }
  },

  // 拾取六芒星：累加持久货币并立即落盘（避免半局退出丢失），配合 recordCollect 一起调用
  addHexagram(data, n = 1) {
    data.hexagram = (data.hexagram || 0) + n;
    this.save(data);
  },

  // 障碍受击（连续拾取清零 + 计入本局受击数）
  recordObstacleHit(data) {
    if (data.runStats) {
      data.runStats.obstacleHits++;
      data.runStats.chain = 0;  // 撞击打断连续拾取
    }
  },

  // Boss战受击
  recordBossHit(data) {
    if (data.runStats) data.runStats.bossHits++;
  },

  // ===== 检查并解锁成就 =====
  // achievements: ACHIEVEMENTS 数组（由调用方 import 传入，避免 Save 循环依赖）
  // 返回：本调用新增解锁的成就对象数组（用于 toast 提示）
  checkAchievements(data, achievements) {
    // 同步 runStats → 总统计（结算用）
    if (data.runStats) {
      if (data.runStats.stars > (data.statRunMaxStars || 0)) {
        data.statRunMaxStars = data.runStats.stars;
      }
    }
    const newly = [];
    if (!achievements || !achievements.length) return newly;
    for (const a of achievements) {
      if (data.achievements[a.id]) continue;
      try {
        if (a.check(data)) {
          data.achievements[a.id] = Date.now();
          newly.push(a);
        }
      } catch (e) { /* 单个检查出错不影响其他 */ }
    }
    if (newly.length) this.save(data);
    return newly;
  },

  // 手动标记一个成就（用于剧情/隐藏触发点）
  grant(data, id) {
    if (!data.achievements[id]) {
      data.achievements[id] = Date.now();
      this.save(data);
      return true;
    }
    return false;
  },
};