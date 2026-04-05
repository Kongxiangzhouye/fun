import type { GameState } from "../types";
import { TUNA_COOLDOWN_MS } from "../types";
import { addStones } from "../stones";
import { noteWeeklyBountyTuna } from "./weeklyBounty";

export function tunaStoneReward(realmLevel: number): number {
  const rl = Math.max(1, Math.floor(realmLevel));
  const linear = 72 + rl * 20;
  const scale = Math.pow(1.035, Math.max(0, rl - 1));
  return Math.max(1, Math.floor(linear * scale));
}

function normalizedElapsedMs(lastMs: number, nowMs: number): number {
  if (nowMs < lastMs) return Number.POSITIVE_INFINITY;
  return nowMs - lastMs;
}

/** @returns 获得的灵石，0 表示尚在冷却 */
export function tryTuna(state: GameState, nowMs: number): number {
  if (state.lastTunaMs > 0) {
    const elapsed = normalizedElapsedMs(state.lastTunaMs, nowMs);
    if (elapsed < TUNA_COOLDOWN_MS) return 0;
  }
  const gain = tunaStoneReward(state.realmLevel);
  addStones(state, gain);
  state.lastTunaMs = nowMs;
  noteWeeklyBountyTuna(state);
  return gain;
}

export function tunaCooldownLeftMs(state: GameState, nowMs: number): number {
  if (state.lastTunaMs <= 0) return 0;
  const elapsed = normalizedElapsedMs(state.lastTunaMs, nowMs);
  if (!Number.isFinite(elapsed)) return 0;
  return Math.max(0, TUNA_COOLDOWN_MS - elapsed);
}
