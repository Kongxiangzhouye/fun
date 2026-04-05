import type { GameState, PullChronicleEntry, Rarity } from "../types";

export const PULL_CHRONICLE_MAX = 48;

export function normalizePullChronicle(st: GameState): void {
  if (!Array.isArray(st.pullChronicle)) st.pullChronicle = [];
  st.pullChronicle = st.pullChronicle.filter((e) => e && typeof e.defId === "string" && e.atMs);
  if (st.pullChronicle.length > PULL_CHRONICLE_MAX) {
    st.pullChronicle.length = PULL_CHRONICLE_MAX;
  }
}

export function normalizeLifetimeStats(st: GameState): void {
  if (!st.lifetimeStats || typeof st.lifetimeStats !== "object") {
    st.lifetimeStats = { dungeonEssenceIntGained: 0, celestialStashBuys: 0 };
    return;
  }
  const n = st.lifetimeStats.dungeonEssenceIntGained;
  if (n == null || !Number.isFinite(n)) st.lifetimeStats.dungeonEssenceIntGained = 0;
  else st.lifetimeStats.dungeonEssenceIntGained = Math.max(0, Math.floor(n));
  const cb = st.lifetimeStats.celestialStashBuys;
  if (cb == null || !Number.isFinite(cb)) st.lifetimeStats.celestialStashBuys = 0;
  else st.lifetimeStats.celestialStashBuys = Math.max(0, Math.floor(cb));
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
