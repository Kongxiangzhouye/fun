import type { GameState } from "../types";
import { CELESTIAL_OFFERS } from "../data/celestialStash";
import { currentWeekKey } from "./weeklyBounty";
import { addStones, canAfford, stones, subStones } from "../stones";
import { normalizeLifetimeStats } from "./pullChronicle";

export function emptyCelestialStash(weekKey: string): GameState["celestialStash"] {
  return { weekKey, purchased: [] };
}

export function ensureCelestialStashWeek(state: GameState, now: number): void {
  const wk = currentWeekKey(now);
  if (!state.celestialStash || typeof state.celestialStash.weekKey !== "string") {
    state.celestialStash = emptyCelestialStash(wk);
    return;
  }
  if (state.celestialStash.weekKey !== wk) {
    state.celestialStash = { weekKey: wk, purchased: [] };
    return;
  }
  if (!Array.isArray(state.celestialStash.purchased)) state.celestialStash.purchased = [];
  state.celestialStash.purchased = state.celestialStash.purchased.filter((x) => typeof x === "string");
}

export function isCelestialOfferPurchasedThisWeek(state: GameState, offerId: string): boolean {
  return state.celestialStash.purchased.includes(offerId);
}

/** 失败时返回原因文案；成功返回 null */
export function tryBuyCelestialOffer(state: GameState, offerId: string, now: number): string | null {
  ensureCelestialStashWeek(state, now);
  const def = CELESTIAL_OFFERS.find((o) => o.id === offerId);
  if (!def) return "条目不存在。";
  if (isCelestialOfferPurchasedThisWeek(state, offerId)) return "本周已兑换过此项。";
  if (def.minRealm != null && state.realmLevel < def.minRealm) return "境界不足。";

  const cs = def.costStones ?? 0;
  const cl = def.costLingSha ?? 0;
  const cx = def.costXuanTie ?? 0;
  const ce = def.costEssence ?? 0;

  if (cs > 0 && !canAfford(state, cs)) return "灵石不足。";
  if (cl > 0 && state.lingSha < cl) return "灵砂不足。";
  if (cx > 0 && state.xuanTie < cx) return "玄铁不足。";
  if (ce > 0 && state.summonEssence < ce) return "唤灵髓不足。";

  if (cs > 0 && !subStones(state, cs)) return "灵石不足。";
  if (cl > 0) state.lingSha -= cl;
  if (cx > 0) state.xuanTie -= cx;
  if (ce > 0) state.summonEssence -= ce;

  if (def.rewardStones != null && def.rewardStones > 0) addStones(state, def.rewardStones);
  if (def.rewardEssence != null && def.rewardEssence > 0) state.summonEssence += def.rewardEssence;
  if (def.rewardDao != null && def.rewardDao > 0) state.daoEssence += def.rewardDao;

  state.celestialStash.purchased.push(offerId);
  normalizeLifetimeStats(state);
  state.lifetimeStats.celestialStashBuys += 1;

  return null;
}

/** 用于 UI 展示「是否付得起」 */
export function canAffordCelestialOffer(state: GameState, offerId: string): boolean {
  const def = CELESTIAL_OFFERS.find((o) => o.id === offerId);
  if (!def) return false;
  if (def.minRealm != null && state.realmLevel < def.minRealm) return false;
  const cs = def.costStones ?? 0;
  const cl = def.costLingSha ?? 0;
  const cx = def.costXuanTie ?? 0;
  const ce = def.costEssence ?? 0;
  if (cs > 0 && stones(state).lt(cs)) return false;
  if (cl > 0 && state.lingSha < cl) return false;
  if (cx > 0 && state.xuanTie < cx) return false;
  if (ce > 0 && state.summonEssence < ce) return false;
  return true;
}

/** 本周各档限购统计：已兑换条目数 / 总条目数 */
export function celestialStashWeeklyProgress(state: GameState, now: number): { purchased: number; total: number } {
  ensureCelestialStashWeek(state, now);
  let purchased = 0;
  for (const o of CELESTIAL_OFFERS) {
    if (isCelestialOfferPurchasedThisWeek(state, o.id)) purchased += 1;
  }
  return { purchased, total: CELESTIAL_OFFERS.length };
}
