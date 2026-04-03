/** 五行：用于元素共鸣与图鉴分组 */
export type Element = "metal" | "wood" | "water" | "fire" | "earth";

/** 稀有度：影响基础产出与抽卡权重 */
export type Rarity = "N" | "R" | "SR" | "SSR" | "UR";

export interface CardDef {
  id: string;
  name: string;
  element: Element;
  rarity: Rarity;
  /** 基础灵石/秒加成系数（装备在卡组中生效，会随星级缩放） */
  prod: number;
  /** 境界倍率加成（百分比，加算到境界倍率上） */
  realmBonusPct: number;
  flavor: string;
}

export interface OwnedCard {
  defId: string;
  /** 星级 0–5，由重复卡提升 */
  stars: number;
  /** 卡牌等级 1–上限 */
  level: number;
}

/** 技能（Melvor 式：挂机训练其一） */
export type SkillId = "combat" | "gathering" | "arcana";

/** 灵宠 id（唤灵池邂逅后养成，全局生效） */
export type PetId = "yuling" | "zijing" | "chiyan" | "qingluan" | "xuangui" | "linghu" | "qilin";

export interface PetProgress {
  level: number;
  xp: number;
}

/** 装备词条属性键（类 PoE：前缀/后缀分组互斥由生成器保证） */
export type GearStatKey =
  | "life_flat"
  | "atk_flat"
  | "atk_inc"
  | "def_flat"
  | "res_all"
  | "crit_chance"
  | "crit_mult"
  | "essence_find";

export interface GearAffixRoll {
  groupId: string;
  stat: GearStatKey;
  tier: number;
  value: number;
  /** 界面展示一行 */
  text: string;
}

/** 一件装备实例 */
export interface GearItem {
  instanceId: string;
  baseId: string;
  displayName: string;
  slot: "weapon" | "body" | "ring";
  rarity: Rarity;
  itemLevel: number;
  /** SSR 及以下：与灵卡同级强化感；UR 可继续精炼 */
  enhanceLevel: number;
  /** 仅 UR：消耗同基底同稀有度提升 */
  refineLevel: number;
  prefixes: GearAffixRoll[];
  suffixes: GearAffixRoll[];
}

/** 造化玉解锁的 QoL（文档 §5） */
export interface QoLFlags {
  /** 【天道酬勤】一键十连 */
  tenPull: boolean;
  /** 【袖里乾坤】一键满级 */
  bulkLevel: boolean;
  /** 【万法自然】自动破境 */
  autoRealm: boolean;
  /** 【心血来潮】自动抽卡 */
  autoGacha: boolean;
  /** 【吐纳自成】冷却就绪自动吐纳 */
  autoTuna: boolean;
}

export interface GameState {
  version: number;
  /** 灵石（Decimal 字符串存档） */
  spiritStones: string;
  /** 本轮轮回内峰值灵石（道韵对数结算） */
  peakSpiritStonesThisLife: string;
  /** 唤灵髓：抽卡、铸灵、心法等主要消耗货币 */
  summonEssence: number;
  /** 道韵：轮回货币 */
  daoEssence: number;
  /** 造化玉：QoL 解锁 */
  zaoHuaYu: number;
  /** 境界等级 */
  realmLevel: number;
  /** 战斗当前生命（上限为 playerMaxHp），随时间恢复 */
  combatHpCurrent: number;
  /**
   * 用于 `playerIncomingDamageMult` 中 K 的波次项（≥1）。
   * 新存档默认 1；从旧存档迁移时取原幻域最高推进波，以保持护体受击参考与迁移前一致。
   */
  combatReferenceWave: number;
  /** 已抽总次数（用于统计与成就） */
  totalPulls: number;
  /** 距离 UR 保底的计数（大保底） */
  pityUr: number;
  /** 距离 SSR+ 软保底的计数 */
  pitySsrSoft: number;
  owned: Record<string, OwnedCard>;
  /** 卡组槽位：最多 6 张，存 defId 或 null */
  deck: (string | null)[];
  /** 图鉴：已解锁的 defId */
  codexUnlocked: Set<string>;
  /** 轮回次数 */
  reincarnations: number;
  /** 元升级等级 */
  meta: {
    idleMult: number;
    gachaLuck: number;
    deckSlots: number;
    ticketRegen: number;
    stoneMult: number;
  };
  /** 成就已领取 id */
  achievementsDone: Set<string>;
  /** 上次 tick 时间戳 ms */
  lastTick: number;
  /** 累计在线秒（用于统计） */
  playtimeSec: number;

  /** 固定随机：gachaSeed 字符串 + seedrandom 状态 JSON */
  rngSeed: string;
  rngStateJson: string;

  /**
   * 内部刻度：每满若干秒推进一格，满 12 格进一日（不向玩家展示「时辰」）。
   */
  inGameHour: number;
  /** 游戏内第几日（从 1 起，内部刻度，界面不强调「日序」） */
  inGameDay: number;
  /** 本轮起算的游戏日（木系岁月沉淀） */
  lifeStartInGameDay: number;

  /** 现实秒累计：每满 GAME_HOUR_REAL_SEC 推进 1 游戏时辰 */
  gameHourTickAccum: number;

  /** 焚天冷却结束时间戳 ms */
  fenTianCooldownUntil: number;

  /** 闭关快进可再次使用的时间戳 ms（防连点刷收益） */
  biGuanCooldownUntil: number;

  /** 造化玉 QoL */
  qoL: QoLFlags;

  /** 自动抽卡节流（上次触发 ms） */
  lastAutoGachaMs: number;

  /** 飞升已触发（金色 UI + 沙盒） */
  trueEndingSeen: boolean;

  /**
   * 引导：0 结束；1 启程礼；2 聚灵阵；3 唤引；4 卡组；5 上阵；
   * 6 洞府蕴灵首次；7 首次破境
   */
  tutorialStep: number;

  /** 已关闭过的阶段性功能说明 id（无奖励，可跳过） */
  featureGuideDismissed: string[];
  /** 勾选后不再弹出任何功能说明 */
  suppressFeatureGuides: boolean;

  /** 洞府蕴灵（卡组外持久养成，轮回不重置） */
  vein: {
    huiLing: number;
    guYuan: number;
    lingXi: number;
    /** 聚灵共鸣：加快共鸣点累积速度（轮回不重置） */
    gongMing: number;
  };

  /** 本轮轮回内累计唤引（余泽前 12 次加成） */
  pullsThisLife: number;

  /** 灵砂：分解灵卡获得，用于灵卡养成 */
  lingSha: number;
  /** 玄铁：分解装备获得，用于装备强化 */
  xuanTie: number;

  /** 自动分解未上阵的低品灵卡 / 装备（仓库） */
  salvageAuto: { n: boolean; r: boolean; gearN: boolean; gearR: boolean };

  /** 已领悟心法 id → 等级 */
  battleSkills: Record<string, number>;

  wishResonance: number;
  firstOpenTodayMs: number;
  dailyStreak: number;
  lastLoginCalendarDate: string | null;

  /** 吐纳：上次点击时间 ms，0 表示从未 */
  lastTunaMs: number;

  skills: Record<SkillId, { level: number; xp: number }>;
  /** 当前挂机修炼的技能；null 为不修炼 */
  activeSkillId: SkillId | null;

  gearInventory: Record<string, GearItem>;
  equippedGear: { weapon: string | null; body: string | null; ring: string | null };
  nextGearInstanceId: number;

  /** 已邂逅的灵宠（仅存在的键）；唤灵池抽到后才可喂养 */
  pets: Partial<Record<PetId, PetProgress>>;
  /** 累计唤灵次数（统计） */
  petPullsTotal: number;
}

export const DECK_SIZE = 6;
export const MAX_CARD_LEVEL = 100;
export const MAX_STARS = 5;

/** 升级消耗：灵石 = base * level^gamma */
export const LEVEL_COST_BASE = 12;
export const LEVEL_COST_GAMMA = 1.55;

/** 单抽唤灵髓消耗 */
export const ESSENCE_COST_SINGLE = 12;
/** 十连唤灵髓消耗（略优惠） */
export const ESSENCE_COST_TEN = 110;

/** 铸灵池：单抽 / 十连（仅产装备，不占灵卡保底） */
export const ESSENCE_COST_GEAR_SINGLE = 16;
export const ESSENCE_COST_GEAR_TEN = 145;

/** 轮回解锁：境界 >= 此值可轮回 */
export const REINCARNATION_REALM_REQ = 25;

/** 最大离线结算秒（土系可突破） */
export const MAX_OFFLINE_SEC_BASE = 72 * 3600;

/** 现实时间每累计多少秒 → 推进 1 格内部刻度（12 格为一日，不向玩家称时辰） */
export const GAME_HOUR_REAL_SEC = 36;

/** 闭关「预演挂机」冷却：真实时间，毫秒 */
export const BI_GUAN_COOLDOWN_MS = 70_000;

/** 吐纳：小额主动灵石，冷却 ms */
export const TUNA_COOLDOWN_MS = 24_000;

/** 飞升数值阈值（与文档一致） */
export const TRUE_ENDING_STONE_THRESHOLD = "1e1000";

/** 飞升境界阈值 */
export const TRUE_ENDING_REALM = 50;

/** 战斗期望秒伤：基准攻击间隔（秒）；与攻速乘区相除得等效攻击频率 */
export const PLAYER_DUNGEON_HIT_INTERVAL_SEC = 1.5;

/**
 * 受击参考：护体值 K 与 `playerDefenseRating` 共同决定乘区 K/(K+护体)。
 * 波次项由 `combatReferenceWave` 提供，与境界项叠加。
 */
export const PLAYER_DEFENSE_K_BASE = 88;
export const PLAYER_DEFENSE_K_PER_WAVE = 1.65;
export const PLAYER_DEFENSE_K_PER_REALM = 1.1;
