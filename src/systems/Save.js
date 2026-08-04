// 存档系统：金币、最高分、已购皮肤、已装备皮肤、关卡解锁进度，持久化到 localStorage
const KEY = "neon-dash-save";

function defaults() {
  return {
    coins: 0,
    hi: 0,
    owned: { character: ["default"], background: ["default"], obstacle: ["default"], weapon: ["wand"] },
    equipped: { character: "default", background: "default", obstacle: "default", weapon: "wand" },
    // 关卡进度：已解锁到第几关（1~5），已通关的关卡索引集合
    unlockedLevel: 1,   // 已解锁的最高关卡序号（从 1 开始）
    clearedLevels: [],  // 已通关的关卡 id 列表
  };
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
    // 迁移旧版最高分键
    const oldHi = Number(localStorage.getItem("neon-dash-hi") || 0);
    if (oldHi > merged.hi) merged.hi = oldHi;
    return merged;
  },

  save(data) {
    localStorage.setItem(KEY, JSON.stringify(data));
  },

  isOwned(data, category, id) {
    return (data.owned[category] || []).includes(id);
  },

  // 购买：成功返回 true
  buy(data, category, skin) {
    if (this.isOwned(data, category, skin.id)) return false;
    if (data.coins < skin.price) return false;
    data.coins -= skin.price;
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
    this.save(data);
  },
};
