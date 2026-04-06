import type { GameState } from "../types";
import { addStones } from "../stones";
import { currentWeekKey } from "./weeklyBounty";
import { normalizeLifetimeStats } from "./pullChronicle";

export function toLocalYMD(ms: number): string {
  const d = new Date(ms);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function yesterdayYMD(ms: number): string {
  const d = new Date(ms);
  d.setDate(d.getDate() - 1);
  return toLocalYMD(d.getTime());
}

/** 本周一至周日的本地日 YYYY-MM-DD（与周悬赏周界一致） */
export function weekDatesMonToSun(now: number): string[] {
  const d = new Date(now);
  const day = d.getDay();
  const monOffset = day === 0 ? -6 : 1 - day;
  const mon = new Date(d.getFullYear(), d.getMonth(), d.getDate() + monOffset);
  mon.setHours(0, 0, 0, 0);
  const out: string[] = [];
  for (let i = 0; i < 7; i++) {
    const x = new Date(mon.getFullYear(), mon.getMonth(), mon.getDate() + i);
    out.push(toLocalYMD(x.getTime()));
  }
  return out;
}

/** 自然周切换时重置灵息周打卡（与 `weeklyBounty.weekKey` 同源） */
export function ensureLoginCalendarWeek(state: GameState, now: number): void {
  const wk = currentWeekKey(now);
  if (state.loginCalendarWeekKey === wk) return;
  state.loginCalendarWeekKey = wk;
  state.loginCalendarClaimedDates = [];
  state.loginCalendarWeeklyBonusClaimed = false;
}

/** 旧档仅有 `dailyLoginClaimedDate` 时，把本周已领日同步进周打卡列表 */
function syncClaimedDatesFromLegacy(state: GameState, now: number): void {
  const c = state.dailyLoginClaimedDate;
  if (!c) return;
  const week = weekDatesMonToSun(now);
  if (!week.includes(c)) return;
  if (!state.loginCalendarClaimedDates.includes(c)) {
    state.loginCalendarClaimedDates.push(c);
    state.loginCalendarClaimedDates.sort();
  }
}

/**
 * 本地日跨天时更新连签（由主循环或初始化调用）。
 * `lastLoginCalendarDate` 存上一次处理 streak 时所处日历日。
 */
export function tickDailyLoginCalendar(state: GameState, now: number): void {
  ensureLoginCalendarWeek(state, now);
  syncClaimedDatesFromLegacy(state, now);
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

/** 本周满 7 日灵息礼时的额外一次性奖励（每自然周最多领一次） */
export function previewWeeklyFullBonus(): { stones: number; summonEssence: number; zhuLingEssence: number } {
  return { stones: 320, summonEssence: 24, zhuLingEssence: 18 };
}

export function weeklyLoginClaimCount(state: GameState): number {
  return state.loginCalendarClaimedDates?.length ?? 0;
}

export function claimDailyLoginReward(state: GameState, now: number): boolean {
  if (!canClaimDailyLoginReward(state, now)) return false;
  ensureLoginCalendarWeek(state, now);
  const today = toLocalYMD(now);
  const { stones: sa, essence } = previewDailyLoginReward(state.dailyStreak);
  addStones(state, sa);
  state.summonEssence += essence;
  state.dailyLoginClaimedDate = today;

  if (!state.loginCalendarClaimedDates.includes(today)) {
    state.loginCalendarClaimedDates.push(today);
  }
  state.loginCalendarClaimedDates.sort();

  if (state.loginCalendarClaimedDates.length >= 7 && !state.loginCalendarWeeklyBonusClaimed) {
    const b = previewWeeklyFullBonus();
    addStones(state, b.stones);
    state.summonEssence += b.summonEssence;
    state.zhuLingEssence += b.zhuLingEssence;
    state.loginCalendarWeeklyBonusClaimed = true;
    normalizeLifetimeStats(state);
    const wk = currentWeekKey(now);
    if (state.lifetimeStats.lastLoginCalendarFullWeekKey !== wk) {
      state.lifetimeStats.loginCalendarFullWeeks += 1;
      state.lifetimeStats.lastLoginCalendarFullWeekKey = wk;
    }
  }

  normalizeLifetimeStats(state);
  state.lifetimeStats.dailyLoginDayClaims += 1;
  return true;
}

/** 周一=0 … 周日=6 */
export function weekdayIndexMon0(now: number): number {
  const wd = new Date(now).getDay();
  return wd === 0 ? 6 : wd - 1;
}
