import type { GameState } from "../types";
import { DAILY_FORTUNES, type DailyFortuneDef } from "../data/dailyFortune";
import { toLocalYMD } from "./dailyLoginCalendar";
import { normalizeLifetimeStats } from "./pullChronicle";
import Decimal from "decimal.js";

/** 与 UI tabDailyFortune 一致 */
export function dailyFortuneUnlocked(state: GameState): boolean {
  return state.realmLevel >= 4 || state.totalPulls >= 5;
}

function hashDaySeed(day: string, seed: string): number {
  const s = `${day}|${seed}`;
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (Math.imul(31, h) + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}

export function pickFortuneIdForDay(state: GameState, calendarDay: string): string {
  const h = hashDaySeed(calendarDay, state.rngSeed || "0");
  return DAILY_FORTUNES[h % DAILY_FORTUNES.length].id;
}

/** 跨本地日或首次解锁时刷新卦象 */
export function tickDailyFortune(state: GameState, now: number): void {
  if (!dailyFortuneUnlocked(state)) return;
  const today = toLocalYMD(now);
  if (state.dailyFortune.calendarDay === today) return;
  state.dailyFortune.calendarDay = today;
  state.dailyFortune.fortuneId = pickFortuneIdForDay(state, today);
  normalizeLifetimeStats(state);
  state.lifetimeStats.dailyFortuneRolls += 1;
}

export function getActiveFortuneDef(state: GameState): DailyFortuneDef | null {
  if (!dailyFortuneUnlocked(state)) return null;
  return DAILY_FORTUNES.find((f) => f.id === state.dailyFortune.fortuneId) ?? DAILY_FORTUNES[0];
}

export function dailyFortuneStoneMult(state: GameState): Decimal {
  const d = getActiveFortuneDef(state);
  if (!d) return new Decimal(1);
  return new Decimal(d.stoneMult);
}

export function dailyFortuneDungeonMult(state: GameState): number {
  const d = getActiveFortuneDef(state);
  if (!d) return 1;
  return d.dungeonMult;
}
