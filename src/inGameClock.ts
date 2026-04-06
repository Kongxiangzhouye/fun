/**
 * 游戏内日序刻度：内部推进「第几日」，不向玩家展示十二时辰。
 */
import type { GameState } from "./types";
import { GAME_HOUR_REAL_SEC } from "./types";
import { recordSpiritTideLifetimeIfActive } from "./systems/spiritTide";

/** 主动行为（共鸣、余泽等）不再随刻度波动，恒为 1 */
export function lingXiActiveFactor(_state: GameState): number {
  return 1;
}

/** 挂机灵石不再随刻度波动；洞府「灵息」单独在 economy 中叠乘 */
export function idleLingXiFactor(_state: GameState): number {
  return 1;
}

/** 与旧 dailyActionRewardFactor(v²) 同形 */
export function cycleActionRewardFactor(ling: number): number {
  return Math.max(0, ling * ling);
}

export function streakMultiplierFromCycle(inGameDay: number): number {
  return 1 + Math.min(0.5, Math.max(0, inGameDay - 1) * 0.025);
}

/** 日序回转时调用；聚灵共鸣不再随周期清空（无上限） */
export function resetInGameCycleRewards(_state: GameState): void {}

/** 推进内部刻度；刻度回转时进入下一游戏日并刷新周期奖励 */
export function advanceInGameHour(state: GameState, steps: number): void {
  if (steps <= 0) return;
  for (let i = 0; i < steps; i++) {
    const prev = state.inGameHour;
    state.inGameHour = (state.inGameHour + 1) % 12;
    if (state.inGameHour === 0 && prev === 11) {
      state.inGameDay += 1;
      resetInGameCycleRewards(state);
    }
    recordSpiritTideLifetimeIfActive(state);
  }
}

/** Tick：每累计 GAME_HOUR_REAL_SEC 秒推进 1 格内部刻度 */
export function tickInGameClock(state: GameState, dtSec: number): void {
  if (dtSec <= 0) return;
  state.gameHourTickAccum += dtSec;
  while (state.gameHourTickAccum >= GAME_HOUR_REAL_SEC) {
    state.gameHourTickAccum -= GAME_HOUR_REAL_SEC;
    advanceInGameHour(state, 1);
  }
}

/** 副标题一行；留空则不占顶栏下位（货币说明改由顶栏长按查看） */
export function describeInGameUi(_state: GameState): {
  tagLine: string;
} {
  return {
    tagLine: "",
  };
}
