import Decimal from "decimal.js";
import type { GameState } from "../types";
import { normalizeLifetimeStats } from "./pullChronicle";

/** 内部刻度 0～2（约子、丑、寅）为灵潮窗口 */
const SPIRIT_TIDE_HOURS = new Set([0, 1, 2]);

/** 灵潮窗口内全局灵石/秒乘区 */
export const SPIRIT_TIDE_STONE_MULT = 1.08;

export function spiritTideActive(state: GameState): boolean {
  return SPIRIT_TIDE_HOURS.has(state.inGameHour);
}

export function spiritTideStoneMult(state: GameState): Decimal {
  return spiritTideActive(state) ? new Decimal(SPIRIT_TIDE_STONE_MULT) : new Decimal(1);
}

/** 刻度推进后若当前落在灵潮时辰则累加（每进入 0/1/2 各计一次） */
export function recordSpiritTideLifetimeIfActive(state: GameState): void {
  if (!spiritTideActive(state)) return;
  normalizeLifetimeStats(state);
  state.lifetimeStats.spiritTideHours += 1;
}
