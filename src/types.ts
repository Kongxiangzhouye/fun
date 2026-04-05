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

/** 灵卡唤引通鉴单条 */
export interface PullChronicleEntry {
  atMs: number;
  defId: string;
  rarity: Rarity;
  isNew: boolean;
}

/** 铸灵池产出通鉴单条（与灵卡分表） */
export interface GearPullChronicleEntry {
  atMs: number;
  baseId: string;
  rarity: Rarity;
  /** 产出时的展示名快照 */
  displayName: string;
}

/** 终身统计（部分由事件累加） */
export interface LifetimeStatsState {
  /** 自幻域入包累计的整数唤灵髓（与背包总髓不同，不含抽卡/成就等来源） */
  dungeonEssenceIntGained: number;
  /** 天机匣累计成功兑换次数 */
  celestialStashBuys: number;
  /** 蓄灵池累计收取次数 */
  spiritReservoirClaims: number;
  /** 心斋卦象累计刷新次数（跨日计数） */
  dailyFortuneRolls: number;
  /** 累计铸灵次数（铸灵池成功产出装备） */
  gearForgesTotal: number;
}

/** 灵田作物 id */
export type GardenCropId = "qing_grass" | "cloud_shroom" | "jade_mist";

/** 洞府灵田：时间制种植，轮回不重置 */
export interface SpiritGardenState {
  plots: Array<{ crop: GardenCropId | null; plantedAtMs: number }>;
  /** 累计收获次数（成就） */
  totalHarvests: number;
}

/** 周常悬赏：按自然周（本地周一）重置 */
export interface WeeklyBountyState {
  weekKey: string;
  waves: number;
  cardPulls: number;
  gardenHarvests: number;
  tuna: number;
  breakthroughs: number;
  claimed: string[];
}

/** 天机匣：每周轮换限购兑换（与周悬赏同周 key） */
export interface CelestialStashState {
  weekKey: string;
  /** 本周已兑换的 offer id */
  purchased: string[];
}

/** 心斋卦象：按本地日刷新的一条运势（影响灵石/幻域等乘区） */
export interface DailyFortuneState {
  /** 当前卦象对应的日历日 YYYY-MM-DD */
  calendarDay: string;
  fortuneId: string;
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

/** 幻域地图上的单只魔物（位置 0–1 归一化，对应格子中心） */
export interface DungeonMob {
  id: number;
  x: number;
  y: number;
  hp: number;
  maxHp: number;
  element: Element;
  /** 首领：更高血与掉落加成 */
  isBoss: boolean;
  /** 外观种类 0–7，影响配色与称呼 */
  mobKind: number;
  /** 仅首领：称号片段（与元素组合成全名） */
  bossEpithet?: string;
  /** 闪避：0–1，玩家对其造成伤害时期望按 (1−闪避) 结算 */
  dodge: number;
  /** 攻击范围（归一化距离）：与玩家距离不大于此值时魔物可攻击玩家 */
  attackRange: number;
  /** 攻击间隔（秒），越小攻速越快 */
  attackInterval: number;
  /** 移动速度乘数（相对同类基础移速） */
  moveSpeedMul: number;
  /** 普通怪：近战血厚距短；远程攻远血脆。首领不设 */
  mobRole?: "melee" | "ranged";
  /** 非锁定目标时的游荡朝向（弧度），随机转向以覆盖全图可走区域，非周期绕圈 */
  wanderHeading?: number;
}

/** 未通关波次的快照（暂离存档；进关时会清除以重新刷怪） */
export interface WaveCheckpoint {
  mobs: DungeonMob[];
  walkable: boolean[];
  mapW: number;
  mapH: number;
  packSize: number;
  packKilled: number;
  essenceThisWave: number;
  monsterAttackAccum: number;
  /** 接续：玩家普攻间隔累积（与 `DungeonState` 同步） */
  playerAttackAccum?: number;
  /** 接续：当前普攻目标魔物 id */
  playerAttackTargetMobId?: number;
  /** 本波生成时的出生点（归一化） */
  spawnX: number;
  spawnY: number;
  /** 接续时是否复刷关（影响唤灵髓倍率） */
  rewardModeRepeat?: boolean;
}

export interface DungeonState {
  active: boolean;
  wave: number;
  /** 当前锁定目标（UI 血条）；与 mobs 中目标同步 */
  monsterHp: number;
  monsterMax: number;
  playerHp: number;
  playerMax: number;
  deathCooldownUntil: number;
  totalWavesCleared: number;
  /** 怪物普攻间隔累积（秒） */
  monsterAttackAccum: number;
  /** 幻域：玩家普攻间隔累积（秒），满间隔出一击离散伤害 */
  playerAttackAccum: number;
  /** 幻域：当前普攻计时锁定的魔物 id（切换目标时清零 accum） */
  playerAttackTargetMobId: number;
  /** 本波怪群总只数（刷宝：一波多怪） */
  packSize: number;
  /** 本波已击杀只数 */
  packKilled: number;
  /** 本次进本累计击杀 */
  sessionKills: number;
  /** 本次进本已获得唤灵髓（按关结算后累计，可含小数显示） */
  sessionEssence: number;
  /** 本波掉落小数累加，清关时与 essenceThisWave 一并折算进背包 */
  essenceRemainder: number;
  /** 角色在地图上的位置（0–1） */
  playerX: number;
  playerY: number;
  /** 地图上全部魔物（含已死 hp≤0，便于过渡动画；波次刷新时重建） */
  mobs: DungeonMob[];
  nextMobId: number;
  /** 当前关卡地图：row-major，true=可走 */
  walkable: boolean[];
  mapW: number;
  mapH: number;
  /** 历史最高通关波次（存档） */
  maxWaveRecord: number;
  /** 下次进入副本默认起始波；合法值为「下一未通关波」或仍有存活魔物的存档波 */
  entryWave: number;
  /** 攻击摆动相位（表现用） */
  attackAnimPhase: number;
  /** 是否与目标接战（供 UI 动画） */
  inMelee: boolean;
  /** 幻域表现：接战且出手时为圆形 AoE（`aoe`）；`single` 保留兼容旧存档 */
  attackVisualMode: "none" | "aoe" | "single";
  /** 清完一波后，到下一波刷怪前的休整截止时间（ms）；0 表示未在休整 */
  interWaveCooldownUntil: number;
  /** 当前波累计获得唤灵髓（本关结算展示） */
  essenceThisWave: number;
  /** 待主界面 toast 的关卡结算文案（消费后清空） */
  pendingToast: string | null;
  /** 兼容旧存档；已不再用于 UI，阵亡说明见 `pendingToast` */
  pendingDeathPresentation: boolean;
  /** 各波次未通关时的进度（反复挑战同一关时魔物血量持久化） */
  waveCheckpoint: Record<number, WaveCheckpoint>;
  /** 当前波地图生成时的出生点（用于阵亡/暂离后再入） */
  waveEntrySpawnX: number;
  waveEntrySpawnY: number;
  /** 首领战：当前帧是否处于受击前闪避位移（供 UI） */
  bossDodgeVisual: boolean;
  /** 幻域体力（闪避消耗） */
  stamina: number;
  /** 闪避无敌帧结束时间（ms 时间戳）；`now < 此值` 时无敌 */
  dodgeIframesUntil: number;
  /** 主线程输入：请求本 tick 尝试闪避（消费后清空） */
  dodgeQueued: boolean;
  /** 定身/硬直结束时间（ms）；`now < 此值` 时不可移动、不可闪避 */
  playerMoveLockUntil: number;
  /** 上一帧寻路位移方向（单位向量）；非接战闪避沿此方向；无位移时由追击方向兜底 */
  playerLastMoveNx: number;
  playerLastMoveNy: number;
  /** 本局是否为复刷旧关（唤灵髓削减，关末奖灵砂） */
  rewardModeRepeat: boolean;
  /** 幻域解锁后是否已自动进过第一关（仅一次） */
  autoEnterConsumed: boolean;
  /** 本次进本时刻（ms），用于本局用时；进本时写入，暂离/阵亡出本后保留至下次进本覆盖 */
  sessionEnterAtMs: number;
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
  /** 唤灵髓：抽卡唯一货币，仅副本掉落 */
  summonEssence: number;
  /** 道韵：轮回货币 */
  daoEssence: number;
  /** 造化玉：QoL 解锁 */
  zaoHuaYu: number;
  /** 境界等级 */
  realmLevel: number;
  /**
   * 幻域/战斗当前生命（不随进关重置；上限为 playerMaxHp）
   * 阵亡后为 0，随时间恢复。
   */
  combatHpCurrent: number;
  /** 阵亡后在灵息之地回气；满血后可传送回中断关卡 */
  dungeonSanctuaryMode: boolean;
  /** 自动传送目标波次（阵亡时记录，0 表示无） */
  dungeonPortalTargetWave: number;
  /** 圣所回满后是否自动进本（付入场髓）；未勾选则需手动点击 */
  dungeonSanctuaryAutoEnter: boolean;
  /** 已抽总次数（用于统计与成就） */
  totalPulls: number;
  /** 距离 UR 保底的计数（大保底） */
  pityUr: number;
  /** 距离 SSR+ 软保底的计数 */
  pitySsrSoft: number;
  /** 铸灵池：连续未出珍品+（SR 及以上）的计数，用于珍品保底 */
  gearPityPulls: number;
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
  /** 上次执行灵息日历跨日逻辑的本机日 YYYY-MM-DD */
  dailyLoginTickDay: string | null;
  /** 上次领取灵息日历礼的本机日 */
  dailyLoginClaimedDate: string | null;

  /** 吐纳：上次点击时间 ms，0 表示从未 */
  lastTunaMs: number;

  skills: Record<SkillId, { level: number; xp: number }>;
  /** 当前挂机修炼的技能；null 为不修炼 */
  activeSkillId: SkillId | null;

  dungeon: DungeonState;

  gearInventory: Record<string, GearItem>;
  equippedGear: { weapon: string | null; body: string | null; ring: string | null };
  nextGearInstanceId: number;

  /** 已邂逅的灵宠（仅存在的键）；唤灵池抽到后才可喂养 */
  pets: Partial<Record<PetId, PetProgress>>;
  /** 累计唤灵次数（统计） */
  petPullsTotal: number;

  /** 灵府·灵田（种植收获，持久养成） */
  spiritGarden: SpiritGardenState;

  /** 周常悬赏进度与领取记录 */
  weeklyBounty: WeeklyBountyState;

  /** 天机匣：周限购资源兑换 */
  celestialStash: CelestialStashState;

  /**
   * 蓄灵池：额外比例灵石蓄存（与每秒灵石挂钩，收取时并入灵石）
   */
  spiritReservoirStored: string;

  /** 心斋卦象（每日运势） */
  dailyFortune: DailyFortuneState;

  /**
   * 纳灵阵图等级（灵府；轮回不重置）：提升全局灵石收益乘区
   */
  spiritArrayLevel: number;

  /**
   * 道韵灵窍：0–5 已解锁层数（消耗道韵；轮回不重置）
   */
  daoMeridian: number;

  /** 最近灵卡唤引记录（轮替 FIFO） */
  pullChronicle: PullChronicleEntry[];
  /** 最近铸灵池产出记录（轮替 FIFO） */
  gearPullChronicle: GearPullChronicleEntry[];
  /** 终身统计 */
  lifetimeStats: LifetimeStatsState;
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

/** 副本死亡惩罚：真实时间 CD */
export const DUNGEON_DEATH_CD_MS = 75_000;

/** 幻域：清关后进入下一关前的休整时间 */
export const DUNGEON_INTER_WAVE_CD_MS = 4_000;

/** 复刷已通关波次：唤灵髓相对首通的比例 */
export const DUNGEON_REPEAT_ESSENCE_MULT = 0.2;
/** 复刷关入场费相对首通的比例 */
export const DUNGEON_REPEAT_ENTRY_FEE_MULT = 0.45;

/** 怪物攻击间隔（秒） */
export const DUNGEON_MONSTER_HIT_INTERVAL = 1.15;

/** 幻域玩家持续伤害：基准攻击间隔（秒）；伤害/秒 ∝ 攻速乘区 ÷ 此值 */
export const PLAYER_DUNGEON_HIT_INTERVAL_SEC = 1.5;

/** 幻域：接战圈内移速乘数（相对未接战；约降低 70%） */
export const DUNGEON_MELEE_MOVE_MULT = 0.3;

/**
 * 幻域受击：护体值 K 与 `playerDefenseRating` 共同决定乘区 K/(K+护体)，
 * 与闪避、元素相克独立；随波次略升，避免前期护体过强。
 */
export const PLAYER_DEFENSE_K_BASE = 88;
export const PLAYER_DEFENSE_K_PER_WAVE = 1.65;
export const PLAYER_DEFENSE_K_PER_REALM = 1.1;

/** 幻域体力上限（闪避消耗） */
export const DUNGEON_STAMINA_MAX = 100;
/** 单次闪避消耗体力 */
export const DUNGEON_DODGE_STAMINA_COST = 38;
/** 闪避无敌帧时长（毫秒） */
export const DUNGEON_DODGE_IFRAMES_MS = 480;
/** 体力每秒回复（副本内） */
export const DUNGEON_STAMINA_REGEN_PER_SEC = 22;
/** 闪避侧向位移强度（归一化坐标量级） */
export const DUNGEON_DODGE_SLIDE = 0.034;

/** 幻域：己方攻击周期落地后定身（不可移动/闪避，毫秒） */
export const DUNGEON_PLAYER_ATTACK_ROOT_MS = 260;
/** 幻域：受敌方伤害硬直（毫秒） */
export const DUNGEON_HITSTUN_ROOT_MS = 340;
/** 幻域：首领攻击命中硬直（长于普通怪，与接战移速 debuff 配套） */
export const DUNGEON_BOSS_HITSTUN_ROOT_MS = 520;
