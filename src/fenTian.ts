import type { GameState } from "./types";
import { incomePerSecond } from "./economy";
import { normalizeLifetimeStats } from "./systems/pullChronicle";
import { totalCardsInPool } from "./storage";
import { addStones } from "./stones";
import { fenTianCooldownMs, fenTianHours, fireSynergyActive } from "./deckSynergy";

export function tryFenTianBurst(state: GameState): boolean {
  if (!fireSynergyActive(state)) return false;
  const now = Date.now();
  if (now < state.fenTianCooldownUntil) return false;
  const hours = fenTianHours(state);
  if (hours <= 0) return false;
  const ips = incomePerSecond(state, totalCardsInPool());
  const gain = ips.times(3600).times(hours);
  addStones(state, gain);
  state.fenTianCooldownUntil = now + fenTianCooldownMs(state);
  normalizeLifetimeStats(state);
  state.lifetimeStats.fenTianBursts += 1;
  return true;
}
