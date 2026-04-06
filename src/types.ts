/** 五行：用于元素共鸣与图鉴分组 */
export type Element = "metal" | "wood" | "water" | "fire" | "earth";

/** 稀有度：影响基础产出与抽卡权重 */
export type Rarity = "N" | "R" | "SR" | "SSR" | "UR";
/** 装备专用视觉品阶（与灵卡/灵宠稀有度分离） */
export type GearRarityTier = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9;

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

/** 行囊背包列表排序（与 UI 一致，持久化） */
export type GearInventorySortMode = "rarity" | "ilvl" | "slot" | "name";

/** 铸灵池产出通鉴单条（与灵卡分表） */
export interface GearPullChronicleEntry {
  atMs: number;
  baseId: string;
  /** 装备专用品阶 1–9（凡品…至宝） */
  gearTier: GearRarityTier;
  /** 旧存档兼容：历史上曾以灵卡稀有度写入 */
  rarity?: Rarity;
  /** 产出时的展示名快照 */
  displayName: string;
}

/** 终身统计（部分由事件累加） */
export interface LifetimeStatsState {
  /** 历练副本入包累计的整数筑灵髓（不含唤灵髓、抽卡/成就等来源） */
  dungeonEssenceIntGained: number;
  /** 天机匣累计成功兑换次数 */
  celestialStashBuys: number;
  /** 蓄灵池累计收取次数 */
  spiritReservoirClaims: number;
  /** 心斋卦象累计刷新次数（跨日计数） */
  dailyFortuneRolls: number;
  /** 累计铸灵次数（铸灵池成功产出装备） */
  gearForgesTotal: number;
  /** 历史铸灵达到过的最高装备品阶 0–8（凡品…至宝），用于成就，不因分解降低） */
  maxGearRarityRankForged: number;
  /** 累计有多少个自然周曾完成并领取全部周常悬赏条目（每周最多计 1 次） */
  weeklyBountyFullWeeks: number;
  /** 最近一次计入 `weeklyBountyFullWeeks` 的周 key（与 `weeklyBounty.weekKey` 同源），防同周重复累加 */
  lastWeeklyBountyFullWeekKey: string;
  /** 累计选择离线奇遇「静修余韵」次数（成就） */
  offlineAdventureBoostPicks: number;
  /** 累计达成「自然周内满 7 日灵息礼」的周次数（成就统计） */
  loginCalendarFullWeeks: number;
  /** 最近一次计入满签周次的周 key（与周悬赏同源周一 key） */
  lastLoginCalendarFullWeekKey: string;
  /** 聚灵共鸣满百发放唤灵髓的累计次数（终身） */
  resonanceEssencePayouts: number;
  /** 吐纳成功累计次数（手动与自动吐纳均计入，终身） */
  tunaCompletions: number;
  /** 焚天成功触发累计次数（终身） */
  fenTianBursts: number;
  /** 洞府委托成功结算累计次数（终身） */
  estateCommissionCompletions: number;
  /** 幻域心法领悟/精进成功次数（终身，含自动） */
  battleSkillPulls: number;
  /** 行囊装备分解成功次数（终身，含自动分解） */
  gearSalvages: number;
  /** 灵卡分解成功次数（终身，含自动分解） */
  cardSalvages: number;
  /** 洞府灵脉任意一条目成功升级次数（终身，含自动） */
  veinUpgrades: number;
  /** 离线奇遇成功结算次数（任选一项即计 1，含自动） */
  offlineAdventureCompletions: number;
  /** 轮回元强化（道韵购买）成功次数（终身，含自动） */
  metaUpgrades: number;
  /** 灵宠喂养成功次数（每次消耗唤灵髓喂养计 1，含自动） */
  petFeeds: number;
  /** 灵田种植成功次数（每次播种计 1，含自动续种） */
  gardenPlants: number;
  /** 战艺/采灵/法篆挂机技能等级提升次数（每次升 1 级计 1） */
  skillLevelUps: number;
  /** 境界突破成功次数（每次破境计 1，含自动破境） */
  realmBreakthroughs: number;
  /** 行囊部位槽位强化（玄铁强化）成功次数 */
  gearEnhances: number;
  /** 天极（UR）装备精炼成功次数 */
  urGearRefines: number;
  /** 灵卡等级提升成功次数（每次升 1 级计 1，含袖里乾坤批量） */
  cardLevelUps: number;
  /** 灵卡叠星成功次数（唤引重复卡升星计 1） */
  cardStarUps: number;
  /** 进入「灵潮」内部时辰累计次数（刻度推进至 0～2 时各计 1，含离线/闭关推进） */
  spiritTideHours: number;
  /** 纳灵阵图绘阵成功次数（每次升 1 级计 1，含自动绘阵） */
  spiritArrayUpgrades: number;
  /** 闭关「时间推进」成功结算次数（每次闭关一纪计 1） */
  biGuanCompletions: number;
  /** 灵卡池十连唤引完成次数（每次完整十连计 1） */
  cardTenPullSessions: number;
  /** 境界铸灵十铸完成次数（每次完整十铸计 1） */
  gearTenPullSessions: number;
  /** 灵息日历「当日灵息礼」成功领取次数（每领取一个本地日计 1） */
  dailyLoginDayClaims: number;
  /** 离线挂机回补灵石成功结算次数（每次 `catchUpOffline` 实际产出灵石计 1） */
  offlineStoneSettlements: number;
  /** 入世以来游戏内日序达到过的最大值（与轮回无关，跨周目累计峰值） */
  maxInGameDayReached: number;
}

/** 灵田作物 id */
export type GardenCropId = "qing_grass" | "cloud_shroom" | "jade_mist";

/** 洞府灵田：时间制种植，轮回不重置 */
export interface SpiritGardenState {
  plots: Array<{ crop: GardenCropId | null; plantedAtMs: number; lastCrop: GardenCropId | null }>;
  /** 累计收获次数（成就） */
  totalHarvests: number;
}

/** 周常悬赏：按自然周（本地周一）重置 */
export interface WeeklyBountyState {
  weekKey: string;
  waves: number;
  cardPulls: number;
  /** 本周铸灵池成功产出次数 */
  gearForges: number;
  gardenHarvests: number;
  tuna: number;
  breakthroughs: number;
  /** 本周洞府委托完成次数 */
  estateCompletions: number;
  claimed: string[];
  /** 本周已领取的里程奖励 id（如 wb_ms_2） */
  milestoneClaimed: string[];
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

/** 离线奇遇：三选一中的单个方案 */
export interface OfflineAdventureOptionState {
  id: "instant" | "boost" | "essence";
  title: string;
  desc: string;
  instantStones: string;
  instantEssence: number;
  boostMult: number;
  boostDurationSec: number;
  /** 髓潮选项：额外发放的筑灵髓 */
  zhuLingBonus?: number;
}

/** 离线奇遇：等待玩家选择的结算快照 */
export interface OfflineAdventurePendingState {
  triggeredAtMs: number;
  settledSec: number;
  options: [OfflineAdventureOptionState, OfflineAdventureOptionState, OfflineAdventureOptionState];
  /** 本轮奇遇是否已重掷过一次 */
  rerolled: boolean;
  /** 本轮重掷消耗灵石 */
  rerollCostStones: string;
}

/** 离线奇遇自动结算回执（持久化） */
export interface OfflineAdventureLastAutoSettleReceipt {
  atMs: number;
  policy: "steady" | "boost" | "essence" | "smart";
  optionId: OfflineAdventureOptionState["id"];
  rerolled: boolean;
  /** 一行可读摘要，含策略名与资源/增益要点 */
  summaryLine: string;
}

/** 离线奇遇系统持久状态 */
export interface OfflineAdventureState {
  pending: OfflineAdventurePendingState | null;
  activeBoostUntilMs: number;
  activeBoostMult: number;
  /** 连选共鸣：最近一次选择类型 */
  resonanceType: OfflineAdventureOptionState["id"] | null;
  /** 连选共鸣：连续选择同类型层数 */
  resonanceStacks: number;
  /** 自动策略：为 true 时在有 pending 时自动结算 */
  autoPolicyEnabled: boolean;
  /** 自动策略偏好：稳态优先 / 增益优先 / 髓潮优先 / 智能 */
  autoPolicy: "steady" | "boost" | "essence" | "smart";
  /** 自动重掷开关：仅对本轮 pending 生效且最多一次 */
  autoRerollEnabled: boolean;
  /** 自动重掷预算上限（灵石）；超出则不自动重掷 */
  autoRerollBudgetStones: string;
  /** 最近一次自动策略结算摘要（仅在一次成功的自动结算后写入；关闭自动策略不会清除） */
  lastAutoSettleReceipt: OfflineAdventureLastAutoSettleReceipt | null;
}

export type EstateCommissionType = "resource" | "combat" | "cultivation";
export type EstateCommissionAutoStrategy = "same-type" | "any-type";
export type EstateCommissionAutoQueueLastResult = "none" | "accepted" | "blocked_type" | "blocked_offer_missing";

export interface EstateCommissionReward {
  spiritStones: string;
  summonEssence: number;
  zhuLingEssence: number;
}

export interface EstateCommissionOffer {
  id: string;
  type: EstateCommissionType;
  title: string;
  desc: string;
  durationSec: number;
  reward: EstateCommissionReward;
}

export interface EstateCommissionActive {
  offer: EstateCommissionOffer;
  acceptedAtMs: number;
  dueAtMs: number;
  completedAtMs: number | null;
}

/** 洞府委托：单次仅允许 1 个活动委托 */
export interface EstateCommissionState {
  offer: EstateCommissionOffer | null;
  active: EstateCommissionActive | null;
  refreshCount: number;
  streak: number;
  /** 连续成功类型（用于专精加成）；中断时清空 */
  lastSuccessType: EstateCommissionType | null;
  refreshCooldownUntilMs: number;
  /** 托管：结算后自动接取下一单 */
  autoQueueEnabled: boolean;
  /** 托管策略：同类型优先 / 任意类型 */
  autoQueueStrategy: EstateCommissionAutoStrategy;
  /** 最近一次结算后的托管续单结果（用于提示） */
  autoQueueLastResult: EstateCommissionAutoQueueLastResult;
  /** 最近一次可见托管反馈的时间戳 */
  autoQueueLastAtMs: number;
  /** 最近一次托管看到的下一单类型 */
  autoQueueLastOfferType: EstateCommissionType | null;
  /** 最近一次托管看到的下一单标题 */
  autoQueueLastOfferTitle: string;
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

export type GearSlot =
  | "weapon"
  | "body"
  | "ring"
  | "slot4"
  | "slot5"
  | "slot6"
  | "slot7"
  | "slot8"
  | "slot9"
  | "slot10"
  | "slot11"
  | "slot12";

/** 一件装备实例 */
export interface GearItem {
  instanceId: string;
  baseId: string;
  displayName: string;
  slot: GearSlot;
  rarity: Rarity;
  /** 装备专用品阶（1–9，凡品…至宝） */
  gearTier: GearRarityTier;
  /** 筑灵阶 1–48：越高词条池越强（与稀有度、装等协同） */
  gearGrade: number;
  itemLevel: number;
  /** 旧存档兼容字段：强化已迁移为槽位强化，不再绑定单件装备 */
  enhanceLevel: number;
  /** 仅 UR：消耗同基底同稀有度提升 */
  refineLevel: number;
  prefixes: GearAffixRoll[];
  suffixes: GearAffixRoll[];
  /** 锁定后不可分解，且不能作为自动分解与精炼消耗（可手动解锁） */
  locked?: boolean;
}

export type EquippedGearState = Record<GearSlot, string | null>;
export type GearSlotEnhanceState = Record<GearSlot, number>;

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
  /** 阵线对决暂离：连击/破绽/战意（与 DungeonState 同名场一致） */
  duelComboStacks?: number;
  duelWeakUntilMs?: number;
  duelWeakNextAtMs?: number;
  duelFervor?: number;
  duelElemSurgeCounter?: number;
  /** 首领前哨：本波累计击杀的小兵数（用于解锁挑战首领） */
  bossPrepKills?: number;
  /** 首领前哨：是否已达到挑战门槛 */
  bossPrepChallengeReady?: boolean;
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
  /** 幻域表现：接战且出手时为圆形 AoE */
  attackVisualMode: "none" | "aoe";
  /** 清完一波后，到下一波刷怪前的休整截止时间（ms）；0 表示未在休整 */
  interWaveCooldownUntil: number;
  /** 当前波累计获得唤灵髓（本关结算展示） */
  essenceThisWave: number;
  /** 待主界面 toast 的关卡结算文案（消费后清空） */
  pendingToast: string | null;
  /** 单次击杀即时入袋整数筑灵髓的提示（小兵；消费后清空） */
  pendingKillToast: string | null;
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
  /** 阵线对决：连击层数（命中累加，偏斜或换目标清零） */
  duelComboStacks: number;
  /** 破绽窗口结束时间（ms）；≤now 表示未激活 */
  duelWeakUntilMs: number;
  /** 下次尝试触发破绽的时间（ms） */
  duelWeakNextAtMs: number;
  /** 战意 0–100，满额下一击消耗并增伤 */
  duelFervor: number;
  /** 克制命中计数，用于灵脉共鸣 */
  duelElemSurgeCounter: number;
  /** 首领前哨：本波累计击杀的小兵数（达到门槛后可随时挑战首领） */
  bossPrepKills: number;
  /** 首领前哨：是否已达到挑战门槛（达到后即便继续刷小兵也保持可挑战） */
  bossPrepChallengeReady: boolean;
}

/** 界面偏好（写入存档；不影响玩法数值） */
export interface UiPrefs {
  /** 减弱装饰性过渡与动画（根节点 CSS 类） */
  reduceMotion: boolean;
  /** true：灵石等使用 K/M/B 缩写；false：尽量完整数字 */
  compactNumbers: boolean;
  /** 全局静音（保留主音量数值，取消静音后恢复） */
  soundMuted: boolean;
  /** 主音量 0–1（未静音时对 Web Audio / 后续音效生效） */
  masterVolume: number;
  /** 蓄灵池蓄满时自动收取（需已解锁蓄灵池） */
  autoClaimSpiritReservoir: boolean;
  /** 灵田：有成熟地块时自动「收获并续种」（需已解锁灵田） */
  autoHarvestSpiritGarden: boolean;
  /** 灵息日历：可领时自动领取今日灵息礼（需已解锁该页） */
  autoClaimDailyLogin: boolean;
  /** 周常悬赏：有可领任务或里程时自动一键领取（需已解锁周常） */
  autoClaimWeeklyBounty: boolean;
  /** 洞府委托：活动委托到期可结算时自动领奖（不要求开启托管连签） */
  autoSettleEstateCommission: boolean;
  /** 天机匣：本周尚有可换条目且资源与境界满足时，按列表顺序自动兑换（需已解锁天机匣页） */
  autoRedeemCelestialStash: boolean;
  /** 灵宠：主循环内对已结缘灵宠自动「尽髓连喂」（需已解锁灵宠页） */
  autoFeedPets: boolean;
  /** 纳灵阵图：灵石与灵砂足够时自动连续绘阵直至买不起或满级（需已解锁阵图页） */
  autoUpgradeSpiritArray: boolean;
  /** 心法：唤灵髓足够且尚有未满级条目时自动连续领悟/精进（需已解锁心法页） */
  autoPullBattleSkill: boolean;
  /** 道韵灵窍：道韵足够时自动贯通下一层直至买不起或满层（需已解锁灵窍页） */
  autoBuyDaoMeridian: boolean;
  /** 洞府蕴灵：按汇灵→灵息→共鸣→固元顺序轮询，能升则升直至本轮无进展（需已解锁灵脉页） */
  autoUpgradeVein: boolean;
  /** 元强化：按固定顺序轮询五条元强化，道韵足够则买直至本轮无进展（需已解锁轮回·永久强化页） */
  autoBuyMeta: boolean;
  /** 点击「确认轮回」时是否弹出浏览器确认框；关闭后一键直接轮回（仍受境界条件限制） */
  confirmReincarnation: boolean;
  /** 是否在浏览器标签标题中显示境界与灵石摘要；关闭后固定为「万象唤灵」 */
  dynamicDocumentTitle: boolean;
  /** 灵府·修炼页是否显示「收益来源拆分与升级引导」说明面板 */
  showIncomeGuidePanel: boolean;
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
  /** 唤灵髓：共鸣、心法、灵宠等（非副本抽卡） */
  summonEssence: number;
  /** 筑灵髓：历练副本掉落；灵卡池与境界铸灵消耗 */
  zhuLingEssence: number;
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
  /** 圣所回满后是否自动进本；未勾选则需手动点击 */
  dungeonSanctuaryAutoEnter: boolean;
  /**
   * 首领关（每 5 波）是否先刷小怪群；为 false 时该波为真正首领。
   * 击败首领后会自动设回 true，进入「先清小怪再点挑战首领」节奏。
   */
  dungeonDeferBoss: boolean;
  /** 自动单铸开关（仅境界铸灵，消耗筑灵髓） */
  autoGearForge: boolean;
  /** 自动挑战首领开关（首领前哨达门槛后自动切入首领战） */
  autoBossChallenge: boolean;
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
  /**
   * 本轮轮回内累计在线/离线追赶秒（与 `playtimeSec` 同源累加节奏；轮回时归零）。
   * 用于界面展示「本世修行时长」，不含跨轮回总量。
   */
  lifePlaytimeSec: number;

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
  /** 自动单铸节流（上次触发 ms） */
  lastAutoGearForgeMs: number;
  /** 自动挑战首领节流（上次触发 ms） */
  lastAutoBossChallengeMs: number;

  /**
   * 自动分解累计秒（每满约 2.5s 触发一次）；必须随存档绑定，避免切档/导入串扰。
   */
  autoSalvageAccumSec: number;

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

  /** 显示与舒适度偏好 */
  uiPrefs: UiPrefs;

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
  /** 灵息周打卡：与周悬赏同源的周 key（周一日期 YYYY-MM-DD） */
  loginCalendarWeekKey: string;
  /** 本周已领取灵息礼的本地日（去重，最多 7 条） */
  loginCalendarClaimedDates: string[];
  /** 本周是否已领取「满 7 日」额外奖励（每自然周最多一次） */
  loginCalendarWeeklyBonusClaimed: boolean;

  /** 吐纳：上次点击时间 ms，0 表示从未 */
  lastTunaMs: number;

  skills: Record<SkillId, { level: number; xp: number }>;
  /** 当前挂机修炼的技能；null 为不修炼 */
  activeSkillId: SkillId | null;

  dungeon: DungeonState;

  gearInventory: Record<string, GearItem>;
  equippedGear: EquippedGearState;
  /** 槽位强化等级：替换装备后仍保留在该部位 */
  gearSlotEnhance: GearSlotEnhanceState;
  nextGearInstanceId: number;
  /** 行囊背包排序偏好 */
  gearInventorySort: GearInventorySortMode;

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

  /** 离线奇遇（二选一 + 限时挂机增益） */
  offlineAdventure: OfflineAdventureState;

  /** 洞府委托（离线可结算） */
  estateCommission: EstateCommissionState;

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
/** 装备筑灵阶上限（与稀有度并行，用于词条池分层） */
export const GEAR_GRADE_MAX = 48;

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
/** 历史：复刷关入场费相对首通的比例；当前无入场费，保留常量以免改存档键 */
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
