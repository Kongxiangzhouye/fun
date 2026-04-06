import Decimal from "decimal.js";
import type { GameState } from "../types";
import { recordDaoEssenceSpentLifetime } from "./pullChronicle";

export const DAO_MERIDIAN_MAX = 5;

export interface DaoMeridianTier {
  cost: number;
  title: string;
  desc: string;
  stone: number;
  essence: number;
  /** 加在 gacha luckFactor 的额外加项（与 meta.gachaLuck*0.02 同量级） */
  luckFlat: number;
  hp: number;
  /** 仅幻域内玩家有效攻击 */
  dungeonAtk: number;
}

export const DAO_MERIDIAN_TIERS: DaoMeridianTier[] = [
  {
    cost: 18,
    title: "汇灵窍",
    desc: "灵石挂机收益 +3%。",
    stone: 1.03,
    essence: 1,
    luckFlat: 0,
    hp: 1,
    dungeonAtk: 1,
  },
  {
    cost: 36,
    title: "淬髓窍",
    desc: "幻域唤灵髓 +4%。",
    stone: 1,
    essence: 1.04,
    luckFlat: 0,
    hp: 1,
    dungeonAtk: 1,
  },
  {
    cost: 54,
    title: "缘法窍",
    desc: "唤引时高稀有倾向微量提升。",
    stone: 1,
    essence: 1,
    luckFlat: 0.12,
    hp: 1,
    dungeonAtk: 1,
  },
  {
    cost: 72,
    title: "固本窍",
    desc: "生命上限 +5%。",
    stone: 1,
    essence: 1,
    luckFlat: 0,
    hp: 1.05,
    dungeonAtk: 1,
  },
  {
    cost: 96,
    title: "战意窍",
    desc: "幻域内攻击 +6%。",
    stone: 1,
    essence: 1,
    luckFlat: 0,
    hp: 1,
    dungeonAtk: 1.06,
  },
];

export function normalizeDaoMeridian(st: GameState): void {
  if (st.daoMeridian == null || !Number.isFinite(st.daoMeridian)) st.daoMeridian = 0;
  st.daoMeridian = Math.max(0, Math.min(DAO_MERIDIAN_MAX, Math.floor(st.daoMeridian)));
}

function productUpTo<T>(n: number, pick: (t: DaoMeridianTier) => T, one: T, mul: (a: T, b: T) => T): T {
  let acc = one;
  for (let i = 0; i < n && i < DAO_MERIDIAN_TIERS.length; i++) {
    acc = mul(acc, pick(DAO_MERIDIAN_TIERS[i]!));
  }
  return acc;
}

export function daoMeridianStoneMult(state: GameState): Decimal {
  return productUpTo(
    state.daoMeridian,
    (t) => new Decimal(t.stone),
    new Decimal(1),
    (a, b) => a.mul(b),
  );
}

export function daoMeridianDungeonEssenceMult(state: GameState): number {
  return productUpTo(state.daoMeridian, (t) => t.essence, 1, (a, b) => a * b);
}

export function daoMeridianLuckFlat(state: GameState): number {
  let s = 0;
  for (let i = 0; i < state.daoMeridian && i < DAO_MERIDIAN_TIERS.length; i++) {
    s += DAO_MERIDIAN_TIERS[i]!.luckFlat;
  }
  return s;
}

export function daoMeridianHpMult(state: GameState): number {
  return productUpTo(state.daoMeridian, (t) => t.hp, 1, (a, b) => a * b);
}

/** 幻域内与词缀叠乘 */
export function daoMeridianDungeonAtkMult(state: GameState): number {
  return productUpTo(state.daoMeridian, (t) => t.dungeonAtk, 1, (a, b) => a * b);
}

export function nextDaoMeridianCost(state: GameState): number | null {
  if (state.daoMeridian >= DAO_MERIDIAN_MAX) return null;
  return DAO_MERIDIAN_TIERS[state.daoMeridian]!.cost;
}

export function tryBuyDaoMeridian(state: GameState): boolean {
  normalizeDaoMeridian(state);
  if (state.daoMeridian >= DAO_MERIDIAN_MAX) return false;
  const cost = DAO_MERIDIAN_TIERS[state.daoMeridian]!.cost;
  if (state.daoEssence < cost) return false;
  state.daoEssence -= cost;
  recordDaoEssenceSpentLifetime(state, cost);
  state.daoMeridian += 1;
  return true;
}

/** 主循环：`uiPrefs.autoBuyDaoMeridian` 时连续贯通，返回本轮成功层数 */
export function tryAutoBuyDaoMeridianIfPref(state: GameState): number {
  if (!state.uiPrefs.autoBuyDaoMeridian) return 0;
  let n = 0;
  let guard = 0;
  while (guard++ < DAO_MERIDIAN_MAX + 2) {
    if (!tryBuyDaoMeridian(state)) break;
    n += 1;
  }
  return n;
}
