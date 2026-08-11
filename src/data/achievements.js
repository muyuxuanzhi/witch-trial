// 成就系统定义
// 每个成就以菱形为主图标（drawIcon 渲染），形态/颜色/内嵌符号各不相同，
// 让玩家一眼能区分。
// 字段说明：
//   id        - 唯一 ID
//   name      - 成就名
//   desc      - 描述
//   hint      - 解锁条件提示（隐藏成就显示为 ???）
//   hidden    - 隐藏成就：未解锁前整张卡片都只显示为 "???"
//   iconKind  - 图标种类（drawIcon 用）
//   iconColor - 主色
//   iconAccent- 副色（用于符号/描边）
//   check(save) -> bool  是否解锁（由 Save 提供的进度计算）
// 进度存储于 Save.stats：statStars / statCoins / statObstacleHit /
//                       statBossClearNoHit / statClearWithoutHit /
//                       statBestEndlessRound / statStarChain /
//                       statFinalFormCleared / statSkinGold
// 触发明细见 Save.checkAchievements()。

// ===== 图标绘制（菱形为主，每种都不同）=====
// 通过 ctx 路径直接绘制，所有图标统一 22x22 大小，便于网格对齐。
export const ACHIEVEMENT_ICONS = {
  // 1. 入门：单菱形带星点
  first_step(x, y, c, a) {
    // 外菱形
    drawDiamond(x, y, 10, c);
    // 内圆点
    fillCircle(x, y, 3, a);
  },
  // 2. 100星：菱形中嵌一颗五角星
  star100(x, y, c, a) {
    drawDiamond(x, y, 10, c);
    fillStar(x, y, 5, a);
  },
  // 3. 500星：菱形 + 大五角星
  star500(x, y, c, a) {
    drawDiamond(x, y, 11, c, "#ffffff");
    fillStar(x, y, 6, a);
    fillCircle(x, y, 2, "#ffffff");
  },
  // 4. 1000星：菱形 + 六芒星
  star1000(x, y, c, a) {
    drawDiamond(x, y, 11, c);
    fillSixStar(x, y, 6, a);
    fillCircle(x, y, 1.5, "#ffffff");
  },
  // 5. 通关5关：菱形 + 皇冠
  clear5(x, y, c, a) {
    drawDiamond(x, y, 11, c);
    // 简化皇冠（三尖）
    drawCrown(x, y - 1, a);
  },
  // 6. 地狱通关：菱形 + 火焰
  hell5(x, y, c, a) {
    drawDiamond(x, y, 11, c);
    drawFlame(x, y, a);
  },
  // 7. 无尽5：菱形 + 数字5
  endless5(x, y, c, a) {
    drawDiamond(x, y, 11, c);
    drawNumber(x, y, "5", a);
  },
  // 8. 无尽10
  endless10(x, y, c, a) {
    drawDiamond(x, y, 11, c);
    drawNumber(x, y, "10", a, 7);
  },
  // 9. 无尽20
  endless20(x, y, c, a) {
    drawDiamond(x, y, 11, c);
    drawNumber(x, y, "20", a, 7);
  },
  // 10. 黄金魔女：菱形 + 太阳花（最华丽）
  goldWitch(x, y, c, a) {
    drawDiamond(x, y, 11, c);
    // 内：太阳光芒
    for (let i = 0; i < 8; i++) {
      const ang = (i / 8) * Math.PI * 2;
      const r0 = 3.5, r1 = 7;
      drawLine(
        x + Math.cos(ang) * r0, y + Math.sin(ang) * r0,
        x + Math.cos(ang) * r1, y + Math.sin(ang) * r1,
        a, 1.5
      );
    }
    fillCircle(x, y, 2.5, "#ffffff");
  },
  // 11. 弹幕宗师：菱形 + 盾牌
  noHitBoss(x, y, c, a) {
    drawDiamond(x, y, 11, c);
    drawShield(x, y, a);
  },
  // 12. 无伤通关：菱形 + 闪电
  noHitRun(x, y, c, a) {
    drawDiamond(x, y, 11, c);
    drawBolt(x, y, a);
  },
  // 13. 永不退缩：菱形 + 心形（核心血量）
  ironHeart(x, y, c, a) {
    drawDiamond(x, y, 11, c);
    drawHeart(x, y, a);
  },
  // 14. 狂吃糖果：菱形 + 巧克力
  sweetTooth(x, y, c, a) {
    drawDiamond(x, y, 11, c);
    drawChocoBar(x, y, a);
  },
  // 15. 金币满仓：菱形 + 钱袋
  piggy(x, y, c, a) {
    drawDiamond(x, y, 11, c);
    drawCoin(x, y, a);
  },
  // 16. 钻石魔女：菱形 + 钻石（宝石）
  diamondWitch(x, y, c, a) {
    drawDiamond(x, y, 11, c);
    fillDiamond(x, y, 5, a, "#ffffff");
  },
  // 17. 试炼狂（隐藏）：菱形 + 钥匙
  secretKey(x, y, c, a) {
    drawDiamond(x, y, 11, c);
    drawKey(x, y, a);
  },
  // 18. 甜党宣言（隐藏搞笑）：菱形 + 666
  sweet666(x, y, c, a) {
    drawDiamond(x, y, 11, c);
    drawNumber(x, y, "666", a, 5);
  },
  // 19. 电波系（隐藏搞笑）：菱形 + 闪电 + 问号
  denpa(x, y, c, a) {
    drawDiamond(x, y, 11, c);
    drawBolt(x, y, a);
    fillCircle(x + 5, y - 5, 2, "#ffffff");
  },
  // 20. 终极甜蜜（剧情彩蛋）：菱形 + 月蚀
  sweetEclipse(x, y, c, a) {
    drawDiamond(x, y, 11, c);
    // 月蚀：金色月 + 缺口阴影
    fillCircle(x - 2, y, 5, a);
    fillCircle(x + 1, y - 1, 5, "#140a1f");
  },
};

// ===== 图标底层绘制辅助函数 =====
// 通过 ctx 直接绘制（不依赖 ctx.fillText，让图标看起来都是菱形风格）

function drawDiamond(x, y, r, fill, stroke) {
  ctx.fillStyle = fill;
  ctx.beginPath();
  ctx.moveTo(x, y - r);
  ctx.lineTo(x + r, y);
  ctx.lineTo(x, y + r);
  ctx.lineTo(x - r, y);
  ctx.closePath();
  ctx.fill();
  if (stroke) {
    ctx.strokeStyle = stroke;
    ctx.lineWidth = 1;
    ctx.stroke();
  }
}
// 内部菱形（宝石感）
function fillDiamond(x, y, r, fill, stroke) {
  drawDiamond(x, y, r, fill, stroke);
}
function fillCircle(x, y, r, color) {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();
}
function fillStar(x, y, r, color) {
  ctx.fillStyle = color;
  ctx.beginPath();
  for (let i = 0; i < 10; i++) {
    const rad = i % 2 === 0 ? r : r * 0.45;
    const a = (i / 10) * Math.PI * 2 - Math.PI / 2;
    const px = x + Math.cos(a) * rad;
    const py = y + Math.sin(a) * rad;
    if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
  }
  ctx.closePath();
  ctx.fill();
}
function fillSixStar(x, y, r, color) {
  ctx.fillStyle = color;
  // 两个交叠三角
  for (const rot of [0, Math.PI]) {
    ctx.beginPath();
    for (let i = 0; i < 3; i++) {
      const a = rot + i * (Math.PI * 2 / 3) - Math.PI / 2;
      const px = x + Math.cos(a) * r;
      const py = y + Math.sin(a) * r;
      if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
    }
    ctx.closePath();
    ctx.fill();
  }
}
function drawLine(x1, y1, x2, y2, color, w) {
  ctx.strokeStyle = color;
  ctx.lineWidth = w || 1;
  ctx.beginPath();
  ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
}
function drawCrown(x, y, color) {
  ctx.fillStyle = color;
  ctx.strokeStyle = "#ffffff"; ctx.lineWidth = 0.5;
  ctx.beginPath();
  ctx.moveTo(x - 5, y + 3);
  ctx.lineTo(x - 5, y - 2);
  ctx.lineTo(x - 2.5, y + 1);
  ctx.lineTo(x, y - 4);
  ctx.lineTo(x + 2.5, y + 1);
  ctx.lineTo(x + 5, y - 2);
  ctx.lineTo(x + 5, y + 3);
  ctx.closePath(); ctx.fill(); ctx.stroke();
}
function drawFlame(x, y, color) {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(x, y - 5);
  ctx.quadraticCurveTo(x + 4, y - 1, x + 3, y + 3);
  ctx.quadraticCurveTo(x + 1, y + 5, x, y + 5);
  ctx.quadraticCurveTo(x - 1, y + 5, x - 3, y + 3);
  ctx.quadraticCurveTo(x - 4, y - 1, x, y - 5);
  ctx.fill();
  ctx.fillStyle = "#ffd94a";
  ctx.beginPath(); ctx.arc(x, y + 1, 1.5, 0, Math.PI * 2); ctx.fill();
}
function drawNumber(x, y, n, color, size) {
  ctx.fillStyle = color;
  ctx.font = `bold ${size || 9}px monospace`;
  ctx.textAlign = "center"; ctx.textBaseline = "middle";
  ctx.fillText(n, x, y + 1);
}
function drawShield(x, y, color) {
  ctx.fillStyle = color;
  ctx.strokeStyle = "#ffffff"; ctx.lineWidth = 0.5;
  ctx.beginPath();
  ctx.moveTo(x - 5, y - 5);
  ctx.lineTo(x + 5, y - 5);
  ctx.lineTo(x + 5, y + 1);
  ctx.quadraticCurveTo(x + 5, y + 5, x, y + 6);
  ctx.quadraticCurveTo(x - 5, y + 5, x - 5, y + 1);
  ctx.closePath();
  ctx.fill(); ctx.stroke();
}
function drawBolt(x, y, color) {
  ctx.fillStyle = color;
  ctx.strokeStyle = "#ffffff"; ctx.lineWidth = 0.5;
  ctx.beginPath();
  ctx.moveTo(x - 1, y - 6);
  ctx.lineTo(x - 4, y + 1);
  ctx.lineTo(x - 1, y + 1);
  ctx.lineTo(x - 3, y + 6);
  ctx.lineTo(x + 4, y - 2);
  ctx.lineTo(x + 1, y - 2);
  ctx.lineTo(x + 4, y - 6);
  ctx.closePath();
  ctx.fill(); ctx.stroke();
}
function drawHeart(x, y, color) {
  ctx.fillStyle = color;
  ctx.strokeStyle = "#ffffff"; ctx.lineWidth = 0.5;
  ctx.beginPath();
  ctx.moveTo(x, y + 5);
  ctx.quadraticCurveTo(x - 6, y + 1, x - 5, y - 3);
  ctx.quadraticCurveTo(x - 3, y - 6, x, y - 2);
  ctx.quadraticCurveTo(x + 3, y - 6, x + 5, y - 3);
  ctx.quadraticCurveTo(x + 6, y + 1, x, y + 5);
  ctx.closePath();
  ctx.fill(); ctx.stroke();
}
function drawChocoBar(x, y, color) {
  ctx.fillStyle = color;
  ctx.strokeStyle = "#ffffff"; ctx.lineWidth = 0.5;
  // 巧克力块轮廓
  ctx.fillRect(x - 5, y - 4, 10, 7);
  ctx.strokeRect(x - 5.5, y - 4.5, 11, 8);
  // 表面分隔线
  ctx.strokeStyle = "rgba(0,0,0,0.4)";
  ctx.lineWidth = 0.5;
  for (let i = -3; i <= 3; i += 3) {
    ctx.beginPath(); ctx.moveTo(x + i, y - 4); ctx.lineTo(x + i, y + 3); ctx.stroke();
  }
  // 一颗坚果点缀
  ctx.fillStyle = "#fff7d0";
  ctx.beginPath(); ctx.arc(x + 1, y, 1.2, 0, Math.PI * 2); ctx.fill();
}
function drawCoin(x, y, color) {
  ctx.fillStyle = color;
  ctx.strokeStyle = "#7a5a10"; ctx.lineWidth = 0.5;
  ctx.beginPath(); ctx.arc(x, y, 5, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
  ctx.fillStyle = "#7a5a10";
  ctx.font = "bold 6px monospace";
  ctx.textAlign = "center"; ctx.textBaseline = "middle";
  ctx.fillText("$", x, y + 0.5);
}
function drawKey(x, y, color) {
  ctx.fillStyle = color;
  ctx.strokeStyle = "#ffffff"; ctx.lineWidth = 0.5;
  ctx.beginPath(); ctx.arc(x - 2, y - 1, 2.5, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
  ctx.fillRect(x + 1, y - 1.5, 5, 2);
  ctx.fillRect(x + 4, y + 0.5, 1, 1.5);
  ctx.fillRect(x + 2.5, y + 0.5, 1, 1.5);
}

// 提供给 render 的统一绘制函数（带 ctx 上下文）
let ctx = null;
export function setAchievementRenderContext(c) {
  ctx = c;
}

export const ACHIEVEMENTS = [
  // ===== 入门 =====
  {
    id: "first_step",
    name: "初出茅庐",
    desc: "完成第 1 关，正式踏上试炼之旅。",
    hint: "完成第 1 关",
    iconKind: "first_step",
    iconColor: "#5cff9a",
    iconAccent: "#ffffff",
    check: (s) => (s.clearedLevels || []).length >= 1,
  },
  // ===== 收集六芒星 =====
  {
    id: "star_100",
    name: "星之执着",
    desc: "累计拾取 100 个六芒星。",
    hint: "累计拾取 100 个六芒星（跑酷+Boss）",
    iconKind: "star100",
    iconColor: "#ffcf5c",
    iconAccent: "#ffffff",
    check: (s) => (s.statStars || 0) >= 100,
  },
  {
    id: "star_500",
    name: "星之狂人",
    desc: "累计拾取 500 个六芒星。",
    hint: "累计拾取 500 个六芒星",
    iconKind: "star500",
    iconColor: "#ffd94a",
    iconAccent: "#ffffff",
    check: (s) => (s.statStars || 0) >= 500,
  },
  {
    id: "star_1000",
    name: "星之传说",
    desc: "累计拾取 1000 个六芒星。",
    hint: "累计拾取 1000 个六芒星",
    iconKind: "star1000",
    iconColor: "#ffcf5c",
    iconAccent: "#ffffff",
    check: (s) => (s.statStars || 0) >= 1000,
  },
  // ===== 通关 =====
  {
    id: "clear_5",
    name: "试炼完成",
    desc: "普通难度下通关全部 5 关。",
    hint: "普通难度通关全部 5 关",
    iconKind: "clear5",
    iconColor: "#b96bff",
    iconAccent: "#ffcf5c",
    check: (s) => (s.clearedLevels || []).length >= 5,
  },
  {
    id: "hell_clear_5",
    name: "地狱试炼完成",
    desc: "地狱难度下通关全部 5 关。",
    hint: "地狱难度通关全部 5 关",
    iconKind: "hell5",
    iconColor: "#ff5c5c",
    iconAccent: "#ffd94a",
    check: (s) => (s.statHellCleared || 0) >= 5,
  },
  // ===== 无限模式 =====
  {
    id: "endless_5",
    name: "无尽 · 5",
    desc: "无限模式打到第 5 轮。",
    hint: "无限模式打到第 5 轮",
    iconKind: "endless5",
    iconColor: "#ff8bd0",
    iconAccent: "#ffffff",
    check: (s) => (s.statBestEndlessRound || 0) >= 5,
  },
  {
    id: "endless_10",
    name: "无尽 · 10",
    desc: "无限模式打到第 10 轮。",
    hint: "无限模式打到第 10 轮",
    iconKind: "endless10",
    iconColor: "#ff5c8a",
    iconAccent: "#ffffff",
    check: (s) => (s.statBestEndlessRound || 0) >= 10,
  },
  {
    id: "endless_20",
    name: "无尽 · 20",
    desc: "无限模式打到第 20 轮。",
    hint: "无限模式打到第 20 轮",
    iconKind: "endless20",
    iconColor: "#b96bff",
    iconAccent: "#ffd94a",
    check: (s) => (s.statBestEndlessRound || 0) >= 20,
  },
  // ===== 解锁/经济 =====
  {
    id: "skin_gold",
    name: "金灿灿！power！",
    desc: "解锁黄金魔女皮肤。",
    hint: "在商店解锁黄金魔女皮肤",
    iconKind: "goldWitch",
    iconColor: "#3a2e10",
    iconAccent: "#ffcf5c",
    check: (s) => (s.owned && s.owned.character || []).includes("gold"),
  },
  {
    id: "piggy",
    name: "金币满仓",
    desc: "累计获得 500 金币。",
    hint: "累计获得 500 金币",
    iconKind: "piggy",
    iconColor: "#ffcf5c",
    iconAccent: "#ffd94a",
    check: (s) => (s.statCoinsTotal || 0) >= 500,
  },
  // ===== 战斗风格成就 =====
  {
    id: "no_hit_boss",
    name: "弹幕宗师",
    desc: "在一次 Boss 战中全程不受伤并获胜。",
    hint: "一局 Boss 战全程不受伤通关",
    iconKind: "noHitBoss",
    iconColor: "#5cc8ff",
    iconAccent: "#ffffff",
    check: (s) => (s.statBossClearNoHit || 0) >= 1,
  },
  {
    id: "no_hit_run",
    name: "极速闪避",
    desc: "在一次跑酷关中不撞任何障碍并通关。",
    hint: "一关跑酷全程不撞障碍通关",
    iconKind: "noHitRun",
    iconColor: "#4fe0d0",
    iconAccent: "#ffffff",
    check: (s) => (s.statClearWithoutHit || 0) >= 1,
  },
  {
    id: "iron_heart",
    name: "永不退缩",
    desc: "一局内连续撞满血量上限的障碍仍通关。",
    hint: "一局内撞满血量上限的障碍仍然通关",
    iconKind: "ironHeart",
    iconColor: "#ff5c8a",
    iconAccent: "#ffd94a",
    check: (s) => (s.statFullBloodClear || 0) >= 1,
  },
  {
    id: "sweet_tooth",
    name: "狂吃糖果",
    desc: "一次跑酷中连续拾取 10 个收集物不间断。",
    hint: "一次跑酷连续拾取 10 个收集物",
    iconKind: "sweetTooth",
    iconColor: "#c88a5c",
    iconAccent: "#fff7d0",
    check: (s) => (s.statStarChain || 0) >= 10,
  },
  // ===== 隐藏成就 =====
  {
    id: "diamond_witch",
    name: "钻石魔女",
    desc: "一关内累计收集 30 个星星。",
    hint: "???",
    hidden: true,
    iconKind: "diamondWitch",
    iconColor: "#5cc8ff",
    iconAccent: "#ffffff",
    check: (s) => (s.statRunMaxStars || 0) >= 30,
  },
  {
    id: "trial_freak",
    name: "试炼狂",
    desc: "一周目内（不退出主菜单）通关全部 5 关。",
    hint: "???",
    hidden: true,
    iconKind: "secretKey",
    iconColor: "#ffd94a",
    iconAccent: "#ffffff",
    check: (s) => (s.statOneShotClear || 0) >= 1,
  },
  {
    id: "sweet_666",
    name: "甜党宣言",
    desc: "通关时金币正好是 666 的倍数。",
    hint: "???",
    hidden: true,
    iconKind: "sweet666",
    iconColor: "#ff8bd0",
    iconAccent: "#ffcf5c",
    check: (s) => (s.statCoins666 || 0) >= 1,
  },
  {
    id: "denpa",
    name: "电波系",
    desc: "通关时累计选择了 6 次护盾结界。",
    hint: "???",
    hidden: true,
    iconKind: "denpa",
    iconColor: "#b96bff",
    iconAccent: "#ffd94a",
    check: (s) => (s.statGuard6 || 0) >= 1,
  },
  {
    id: "sweet_eclipse",
    name: "终极甜蜜",
    desc: "通关游戏并解锁黄金魔女皮肤，金橙的大魔女朋友会履行诺言——10 万箱金箔坚果巧克力！",
    hint: "???",
    hidden: true,
    iconKind: "sweetEclipse",
    iconColor: "#140a1f",
    iconAccent: "#ffcf5c",
    check: (s) => (s.statFinalSweet || 0) >= 1,
  },
];

// 总数（用于成就界面显示）
export const ACHIEVEMENT_TOTAL = ACHIEVEMENTS.length;

// 解锁总数（不含隐藏未解锁）
export function countUnlocked(save) {
  if (!save || !save.achievements) return 0;
  let n = 0;
  for (const a of ACHIEVEMENTS) {
    if (save.achievements[a.id]) n++;
  }
  return n;
}