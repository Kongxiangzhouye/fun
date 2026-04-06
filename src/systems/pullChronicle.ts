import type { GameState, GearPullChronicleEntry, PullChronicleEntry, Rarity } from "../types";
import { gearTierRank, gearVisualTierFor, legacyGearRank5ToRank9 } from "../ui/gearVisualTier";

export const PULL_CHRONICLE_MAX = 48;

export function normalizePullChronicle(st: GameState): void {
  if (!Array.isArray(st.pullChronicle)) st.pullChronicle = [];
  st.pullChronicle = st.pullChronicle.filter((e) => e && typeof e.defId === "string" && e.atMs);
  if (st.pullChronicle.length > PULL_CHRONICLE_MAX) {
    st.pullChronicle.length = PULL_CHRONICLE_MAX;
  }
}

export function normalizeGearPullChronicle(st: GameState): void {
  if (!Array.isArray(st.gearPullChronicle)) st.gearPullChronicle = [];
  st.gearPullChronicle = st.gearPullChronicle
    .filter((e) => e && typeof e.baseId === "string" && typeof e.displayName === "string" && e.atMs)
    .map((e) => {
      const tier =
        Number.isFinite(e.gearTier) && (e.gearTier as number) >= 1
          ? Math.max(1, Math.min(9, Math.floor(e.gearTier as number)))
          : e.rarity
            ? gearVisualTierFor(e.rarity, 1)
            : 1;
      return { ...e, gearTier: tier as GearPullChronicleEntry["gearTier"] };
    });
  if (st.gearPullChronicle.length > PULL_CHRONICLE_MAX) {
    st.gearPullChronicle.length = PULL_CHRONICLE_MAX;
  }
}

export function normalizeLifetimeStats(st: GameState): void {
  if (!st.lifetimeStats || typeof st.lifetimeStats !== "object") {
    st.lifetimeStats = {
      dungeonEssenceIntGained: 0,
      celestialStashBuys: 0,
      spiritReservoirClaims: 0,
      dailyFortuneRolls: 0,
      gearForgesTotal: 0,
      maxGearRarityRankForged: 0,
      weeklyBountyFullWeeks: 0,
      lastWeeklyBountyFullWeekKey: "",
      offlineAdventureBoostPicks: 0,
      loginCalendarFullWeeks: 0,
      lastLoginCalendarFullWeekKey: "",
      resonanceEssencePayouts: 0,
      tunaCompletions: 0,
    };
    return;
  }
  const n = st.lifetimeStats.dungeonEssenceIntGained;
  if (n == null || !Number.isFinite(n)) st.lifetimeStats.dungeonEssenceIntGained = 0;
  else st.lifetimeStats.dungeonEssenceIntGained = Math.max(0, Math.floor(n));
  const cb = st.lifetimeStats.celestialStashBuys;
  if (cb == null || !Number.isFinite(cb)) st.lifetimeStats.celestialStashBuys = 0;
  else st.lifetimeStats.celestialStashBuys = Math.max(0, Math.floor(cb));
  const rc = st.lifetimeStats.spiritReservoirClaims;
  if (rc == null || !Number.isFinite(rc)) st.lifetimeStats.spiritReservoirClaims = 0;
  else st.lifetimeStats.spiritReservoirClaims = Math.max(0, Math.floor(rc));
  const dr = st.lifetimeStats.dailyFortuneRolls;
  if (dr == null || !Number.isFinite(dr)) st.lifetimeStats.dailyFortuneRolls = 0;
  else st.lifetimeStats.dailyFortuneRolls = Math.max(0, Math.floor(dr));
  const gf = st.lifetimeStats.gearForgesTotal;
  if (gf == null || !Number.isFinite(gf)) st.lifetimeStats.gearForgesTotal = 0;
  else st.lifetimeStats.gearForgesTotal = Math.max(0, Math.floor(gf));
  const mx = st.lifetimeStats.maxGearRarityRankForged;
  if (mx == null || !Number.isFinite(mx)) st.lifetimeStats.maxGearRarityRankForged = 0;
  else {
    const raw = Math.floor(mx);
    st.lifetimeStats.maxGearRarityRankForged =
      raw <= 4 ? legacyGearRank5ToRank9(raw) : Math.max(0, Math.min(8, raw));
  }
  const wb = st.lifetimeStats.weeklyBountyFullWeeks;
  if (wb == null || !Number.isFinite(wb)) st.lifetimeStats.weeklyBountyFullWeeks = 0;
  else st.lifetimeStats.weeklyBountyFullWeeks = Math.max(0, Math.floor(wb));
  const wbk = st.lifetimeStats.lastWeeklyBountyFullWeekKey;
  st.lifetimeStats.lastWeeklyBountyFullWeekKey = typeof wbk === "string" ? wbk : "";
  const oab = st.lifetimeStats.offlineAdventureBoostPicks;
  if (oab == null || !Number.isFinite(oab)) st.lifetimeStats.offlineAdventureBoostPicks = 0;
  else st.lifetimeStats.offlineAdventureBoostPicks = Math.max(0, Math.floor(oab));
  const lcf = st.lifetimeStats.loginCalendarFullWeeks;
  if (lcf == null || !Number.isFinite(lcf)) st.lifetimeStats.loginCalendarFullWeeks = 0;
  else st.lifetimeStats.loginCalendarFullWeeks = Math.max(0, Math.floor(lcf));
  const lck = st.lifetimeStats.lastLoginCalendarFullWeekKey;
  st.lifetimeStats.lastLoginCalendarFullWeekKey = typeof lck === "string" ? lck : "";
  const rep = st.lifetimeStats.resonanceEssencePayouts;
  if (rep == null || !Number.isFinite(rep)) st.lifetimeStats.resonanceEssencePayouts = 0;
  else st.lifetimeStats.resonanceEssencePayouts = Math.max(0, Math.floor(rep));
  const tc = st.lifetimeStats.tunaCompletions;
  if (tc == null || !Number.isFinite(tc)) st.lifetimeStats.tunaCompletions = 0;
  else st.lifetimeStats.tunaCompletions = Math.max(0, Math.floor(tc));
}

/** 每次铸灵成功后更新终身最高稀有度（不因分解回退） */
export function recordMaxGearForgedRarity(state: GameState, rarity: Rarity, gearGrade: number): void {
  normalizeLifetimeStats(state);
  const r = gearTierRank(gearVisualTierFor(rarity, gearGrade));
  if (r > state.lifetimeStats.maxGearRarityRankForged) {
    state.lifetimeStats.maxGearRarityRankForged = r;
  }
}

/** 读档时从背包与铸灵通鉴补齐最高阶（兼容旧存档无此字段） */
export function syncMaxGearRarityFromInventoryAndChronicle(state: GameState): void {
  normalizeLifetimeStats(state);
  let m = state.lifetimeStats.maxGearRarityRankForged;
  for (const g of Object.values(state.gearInventory)) {
    m = Math.max(m, gearTierRank(g.gearTier ?? gearVisualTierFor(g.rarity, g.gearGrade ?? 1)));
  }
  for (const e of state.gearPullChronicle) {
    const t = Number.isFinite(e.gearTier) ? e.gearTier : e.rarity ? gearVisualTierFor(e.rarity, 1) : 1;
    m = Math.max(m, gearTierRank(t));
  }
  state.lifetimeStats.maxGearRarityRankForged = Math.max(0, Math.min(8, m));
}

export function noteGearForgePull(state: GameState, n: number = 1): void {
  normalizeLifetimeStats(state);
  state.lifetimeStats.gearForgesTotal += Math.max(0, Math.floor(n));
}

export function pushGearPullChronicle(
  state: GameState,
  entry: { baseId: string; rarity: Rarity; gearTier: number; displayName: string; atMs?: number },
): void {
  normalizeGearPullChronicle(state);
  const atMs = entry.atMs ?? Date.now();
  const row: GearPullChronicleEntry = {
    atMs,
    baseId: entry.baseId,
    gearTier: Math.max(1, Math.min(9, Math.floor(entry.gearTier))) as GearPullChronicleEntry["gearTier"],
    rarity: entry.rarity,
    displayName: entry.displayName,
  };
  state.gearPullChronicle.unshift(row);
  if (state.gearPullChronicle.length > PULL_CHRONICLE_MAX) {
    state.gearPullChronicle.length = PULL_CHRONICLE_MAX;
  }
}

export function pushPullChronicle(
  state: GameState,
  entry: { defId: string; rarity: Rarity; isNew: boolean; atMs?: number },
): void {
  normalizePullChronicle(state);
  const atMs = entry.atMs ?? Date.now();
  const row: PullChronicleEntry = {
    atMs,
    defId: entry.defId,
    rarity: entry.rarity,
    isNew: entry.isNew,
  };
  state.pullChronicle.unshift(row);
  if (state.pullChronicle.length > PULL_CHRONICLE_MAX) {
    state.pullChronicle.length = PULL_CHRONICLE_MAX;
  }
}

export function noteDungeonEssenceIntGained(state: GameState, n: number): void {
  normalizeLifetimeStats(state);
  const add = Math.max(0, Math.floor(n));
  state.lifetimeStats.dungeonEssenceIntGained += add;
}
