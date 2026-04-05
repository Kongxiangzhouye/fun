import type { GameState, GearPullChronicleEntry, PullChronicleEntry, Rarity } from "../types";

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
