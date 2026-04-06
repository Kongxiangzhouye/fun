import type { GameState, GearPullChronicleEntry, PullChronicleEntry, Rarity } from "../types";

export const PULL_CHRONICLE_MAX = 48;

const RARITY_RANK: Record<Rarity, number> = {
  N: 0,
  R: 1,
  SR: 2,
  SSR: 3,
  UR: 4,
};

export function normalizePullChronicle(st: GameState): void {
  if (!Array.isArray(st.pullChronicle)) st.pullChronicle = [];
  st.pullChronicle = st.pullChronicle.filter((e) => e && typeof e.defId === "string" && e.atMs);
  if (st.pullChronicle.length > PULL_CHRONICLE_MAX) {
    st.pullChronicle.length = PULL_CHRONICLE_MAX;
  }
}

export function normalizeGearPullChronicle(st: GameState): void {
  if (!Array.isArray(st.gearPullChronicle)) st.gearPullChronicle = [];
  st.gearPullChronicle = st.gearPullChronicle.filter(
    (e) => e && typeof e.baseId === "string" && typeof e.displayName === "string" && e.atMs,
  );
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
  else st.lifetimeStats.maxGearRarityRankForged = Math.max(0, Math.min(4, Math.floor(mx)));
  const wb = st.lifetimeStats.weeklyBountyFullWeeks;
  if (wb == null || !Number.isFinite(wb)) st.lifetimeStats.weeklyBountyFullWeeks = 0;
  else st.lifetimeStats.weeklyBountyFullWeeks = Math.max(0, Math.floor(wb));
  const wbk = st.lifetimeStats.lastWeeklyBountyFullWeekKey;
  st.lifetimeStats.lastWeeklyBountyFullWeekKey = typeof wbk === "string" ? wbk : "";
}

/** 每次铸灵成功后更新终身最高稀有度（不因分解回退） */
export function recordMaxGearForgedRarity(state: GameState, rarity: Rarity): void {
  normalizeLifetimeStats(state);
  const r = RARITY_RANK[rarity] ?? 0;
  if (r > state.lifetimeStats.maxGearRarityRankForged) {
    state.lifetimeStats.maxGearRarityRankForged = r;
  }
}

/** 读档时从背包与铸灵通鉴补齐最高阶（兼容旧存档无此字段） */
export function syncMaxGearRarityFromInventoryAndChronicle(state: GameState): void {
  normalizeLifetimeStats(state);
  let m = state.lifetimeStats.maxGearRarityRankForged;
  for (const g of Object.values(state.gearInventory)) {
    m = Math.max(m, RARITY_RANK[g.rarity] ?? 0);
  }
  for (const e of state.gearPullChronicle) {
    m = Math.max(m, RARITY_RANK[e.rarity] ?? 0);
  }
  state.lifetimeStats.maxGearRarityRankForged = Math.max(0, Math.min(4, m));
}

export function noteGearForgePull(state: GameState, n: number = 1): void {
  normalizeLifetimeStats(state);
  state.lifetimeStats.gearForgesTotal += Math.max(0, Math.floor(n));
}

export function pushGearPullChronicle(
  state: GameState,
  entry: { baseId: string; rarity: Rarity; displayName: string; atMs?: number },
): void {
  normalizeGearPullChronicle(state);
  const atMs = entry.atMs ?? Date.now();
  const row: GearPullChronicleEntry = {
    atMs,
    baseId: entry.baseId,
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
