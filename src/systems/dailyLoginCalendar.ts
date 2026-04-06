import type { GameState } from "../types";
import { addStones } from "../stones";

export function toLocalYMD(ms: number): string {
  const d = new Date(ms);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function yesterdayYMD(ms: number): string {
  const d = new Date(ms);
  d.setDate(d.getDate() - 1);
  return toLocalYMD(d.getTime());
}

/**
 * 本地日跨天时更新连签（由主循环或初始化调用）。
 * `lastLoginCalendarDate` 存上一次处理 streak 时所处日历日。
 */
export function tickDailyLoginCalendar(state: GameState, now: number): void {
  const today = toLocalYMD(now);
  if (state.dailyLoginTickDay === today) return;

  const yest = yesterdayYMD(now);
  const lp = state.lastLoginCalendarDate;

  if (lp === yest) {
    state.dailyStreak += 1;
  } else if (lp !== today) {
    state.dailyStreak = 1;
  }

  state.lastLoginCalendarDate = today;
  state.dailyLoginTickDay = today;
}

export function canClaimDailyLoginReward(state: GameState, now: number): boolean {
  return state.dailyLoginClaimedDate !== toLocalYMD(now);
}

export function previewDailyLoginReward(streak: number): { stones: number; essence: number } {
  const s = Math.max(1, streak);
  return { stones: 60 + s * 20, essence: 1 + Math.floor(s / 4) };
}

export function claimDailyLoginReward(state: GameState, now: number): boolean {
  if (!canClaimDailyLoginReward(state, now)) return false;
  const today = toLocalYMD(now);
  const { stones: sa, essence } = previewDailyLoginReward(state.dailyStreak);
  addStones(state, sa);
  state.summonEssence += essence;
  state.dailyLoginClaimedDate = today;
  return true;
}

/** 周一=0 … 周日=6 */
export function weekdayIndexMon0(now: number): number {
  const wd = new Date(now).getDay();
  return wd === 0 ? 6 : wd - 1;
}
