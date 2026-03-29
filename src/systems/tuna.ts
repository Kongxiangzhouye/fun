import type { GameState } from "../types";
import { TUNA_COOLDOWN_MS } from "../types";
import { addStones } from "../stones";

export function tunaStoneReward(realmLevel: number): number {
  return 42 + realmLevel * 15;
}

/** @returns 获得的灵石，0 表示尚在冷却 */
export function tryTuna(state: GameState, nowMs: number): number {
  if (state.lastTunaMs > 0 && nowMs - state.lastTunaMs < TUNA_COOLDOWN_MS) return 0;
  const gain = tunaStoneReward(state.realmLevel);
  addStones(state, gain);
  state.lastTunaMs = nowMs;
  return gain;
}

export function tunaCooldownLeftMs(state: GameState, nowMs: number): number {
  if (state.lastTunaMs <= 0) return 0;
  return Math.max(0, TUNA_COOLDOWN_MS - (nowMs - state.lastTunaMs));
}
