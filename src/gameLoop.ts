import type { GameState } from "./types";
import { incomePerSecond } from "./economy";
import { totalCardsInPool } from "./storage";
import { tryCompleteAchievements } from "./achievements";

const OFFLINE_CAP_SEC = 8 * 3600;

export function applyTick(state: GameState, now: number): void {
  const dt = Math.min(120, Math.max(0, (now - state.lastTick) / 1000));
  state.lastTick = now;
  state.playtimeSec += dt;
  const ips = incomePerSecond(state, totalCardsInPool());
  state.spiritStones += ips * dt;
  tryCompleteAchievements(state);
}

export function catchUpOffline(state: GameState, now: number): number {
  const raw = (now - state.lastTick) / 1000;
  const dt = Math.min(OFFLINE_CAP_SEC, Math.max(0, raw));
  if (dt < 1) return 0;
  const ips = incomePerSecond(state, totalCardsInPool());
  const gained = ips * dt;
  state.spiritStones += gained;
  state.lastTick = now;
  state.playtimeSec += dt;
  tryCompleteAchievements(state);
  return gained;
}
