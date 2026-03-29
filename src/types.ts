/** 五行：用于元素共鸣与图鉴分组 */
export type Element = "metal" | "wood" | "water" | "fire" | "earth";

/** 稀有度：影响基础产出与抽卡权重 */
export type Rarity = "N" | "R" | "SR" | "SSR" | "UR";

export interface CardDef {
  id: string;
  name: string;
  element: Element;
  rarity: Rarity;
  /** 基础灵石/秒加成系数（装备在卡组时生效，会随星级缩放） */
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

export interface GameState {
  version: number;
  /** 灵石 */
  spiritStones: number;
  /** 抽卡券 */
  tickets: number;
  /** 道韵：轮回货币 */
  daoEssence: number;
  /** 境界等级 */
  realmLevel: number;
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
  /** @deprecated 迁移用：旧版单日领取标记 */
  dailyClaimDate: string | null;

  /** 0=引导结束；1 欢迎；2 去抽卡页；3 完成单抽；4 去卡组；5 完成上阵 */
  tutorialStep: number;
  /** 已处理的日历日，用于每日重置 */
  dailyProcessedDate: string | null;
  /** 今日首次打开游戏的时间戳（每个日历日锚定一次） */
  firstOpenTodayMs: number;
  /** 连续登录天数 */
  dailyStreak: number;
  /** 用于计算 streak 的上一次登录日 */
  lastLoginCalendarDate: string | null;
  /** 四层每日礼包 */
  dailyPackClaimed: [boolean, boolean, boolean, boolean];
  dailyTaskRewarded: [boolean, boolean, boolean];
  dailyPullCount: number;
  dailyDidRealm: boolean;
  dailyDeckAdjustCount: number;
  wishResonance: number;
  wishTicketsToday: number;
  /** 今日已触发「首抽额外灵石」次数（前几次有加成） */
  dailyPullBonusCount: number;
}

export const DECK_SIZE = 6;
export const MAX_CARD_LEVEL = 100;
export const MAX_STARS = 5;

/** 升级消耗：灵石 = base * level^gamma */
export const LEVEL_COST_BASE = 12;
export const LEVEL_COST_GAMMA = 1.55;

/** 单抽券消耗 */
export const TICKET_COST_SINGLE = 1;
export const TICKET_COST_TEN = 10;

/** 轮回解锁：境界 >= 此值可轮回 */
export const REINCARNATION_REALM_REQ = 25;
