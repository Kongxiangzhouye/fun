import type { GameState } from "./types";

/** 本地日历日 YYYY-MM-DD */
export function calendarDayKey(now: number): string {
  const n = new Date(now);
  return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, "0")}-${String(n.getDate()).padStart(2, "0")}`;
}

function yesterdayKey(now: number): string {
  const d = new Date(now);
  d.setDate(d.getDate() - 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** 自今日首次打开以来经过的分钟数 */
export function minutesSinceFirstOpenToday(state: GameState, now: number): number {
  return Math.max(0, (now - state.firstOpenTodayMs) / 60000);
}

/**
 * 今日活力 0.03–1：前几分钟维持峰值，随后缓慢衰减，长时间后接近下限。
 * 用于「心流先高后低」：高收益行为乘此系数，至本日尾声趋近于零。
 */
export function dailyVigor(state: GameState, now: number): number {
  const m = minutesSinceFirstOpenToday(state, now);
  const peakMinutes = 7;
  if (m < peakMinutes) return 1;
  return Math.max(0.03, Math.exp(-(m - peakMinutes) / 185));
}

/** 挂机灵石效率：随活力下降，保留极低下限以免完全卡死 */
export function idleIncomeVigorFactor(vigor: number): number {
  return 0.06 + 0.94 * vigor;
}

/** 每日礼包、任务、共鸣等「今日行为」的奖励系数 */
export function dailyActionRewardFactor(vigor: number): number {
  return Math.max(0, vigor * vigor);
}

export function ensureDailyRollover(state: GameState, now: number): void {
  const today = calendarDayKey(now);
  if (state.dailyProcessedDate === today) return;

  const y = yesterdayKey(now);
  if (state.lastLoginCalendarDate === y) {
    state.dailyStreak = Math.min(999, state.dailyStreak + 1);
  } else if (state.lastLoginCalendarDate !== null && state.lastLoginCalendarDate !== today) {
    state.dailyStreak = 1;
  } else if (state.lastLoginCalendarDate === null) {
    state.dailyStreak = Math.max(1, state.dailyStreak);
  }

  state.dailyProcessedDate = today;
  state.lastLoginCalendarDate = today;
  state.firstOpenTodayMs = now;
  state.dailyPackClaimed = [false, false, false, false];
  state.dailyTaskRewarded = [false, false, false];
  state.dailyPullCount = 0;
  state.dailyDidRealm = false;
  state.dailyDeckAdjustCount = 0;
  state.wishResonance = 0;
  state.wishTicketsToday = 0;
  state.dailyPullBonusCount = 0;
}

/** 共鸣每次点击增加的进度（0–100） */
export function resonanceGainPerClick(vigor: number): number {
  return 3.5 + 6.5 * vigor;
}

/** 今日通过共鸣可获得券的上限（随活力减少） */
export function resonanceTicketCapToday(vigor: number): number {
  return Math.max(0, Math.min(4, Math.floor(1 + vigor * 3.2)));
}

export function streakMultiplier(streak: number): number {
  return 1 + Math.min(0.45, streak * 0.03);
}
