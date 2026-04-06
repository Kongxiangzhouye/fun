import type { GameState } from "../types";
import {
  canClaimDailyLoginReward,
  previewDailyLoginReward,
  toLocalYMD,
  weekdayIndexMon0,
} from "../systems/dailyLoginCalendar";
import { UI_HEAD_DAILY_LOGIN } from "./visualAssets";

const WEEK_LABELS = ["一", "二", "三", "四", "五", "六", "日"];

export function renderDailyLoginPanel(state: GameState, now: number): string {
  const today = toLocalYMD(now);
  const canClaim = canClaimDailyLoginReward(state, now);
  const prev = previewDailyLoginReward(state.dailyStreak);
  const widx = weekdayIndexMon0(now);
  const weekCells = WEEK_LABELS.map((lb, i) => {
    const isToday = i === widx;
    const claimedToday = state.dailyLoginClaimedDate === today;
    const cls = `daily-login-day${isToday ? " today" : ""}${isToday && claimedToday ? " claimed" : ""}`;
    return `<span class="${cls}" title="周${lb}">${lb}</span>`;
  }).join("");

  return `
    <section class="panel daily-login-panel">
      <div class="panel-title-art-row">
        <img class="panel-title-art-icon" src="${UI_HEAD_DAILY_LOGIN}" alt="" width="28" height="28" loading="lazy" />
        <h2>灵息日历</h2>
      </div>
      <p class="hint">按<strong>本地日历日</strong>结算连签；跨日自动刷新。每日可领一次「灵息礼」。</p>
      <div class="daily-login-strip" aria-hidden="true">${weekCells}</div>
      <p class="hint sm daily-login-streak-line">当前连签：<strong id="daily-login-streak-val">${state.dailyStreak}</strong> 日 · 今日 <strong>${today}</strong></p>
      <div class="daily-login-reward-card">
        <p class="daily-login-reward-title">今日灵息礼（随连签提升）</p>
        <p class="hint sm">灵石 <strong id="daily-login-reward-stones">${prev.stones}</strong> · 唤灵髓 <strong id="daily-login-reward-essence">${prev.essence}</strong></p>
        <button type="button" class="btn ${canClaim ? "btn-primary" : ""}" id="btn-daily-login-claim" ${canClaim ? "" : "disabled"}>
          ${canClaim ? "领取今日灵息礼" : "今日已领取"}
        </button>
      </div>
    </section>`;
}

export function updateDailyLoginPanelReadouts(state: GameState, now: number): void {
  const today = toLocalYMD(now);
  const canClaim = canClaimDailyLoginReward(state, now);
  const prev = previewDailyLoginReward(state.dailyStreak);
  const widx = weekdayIndexMon0(now);
  const streakEl = document.getElementById("daily-login-streak-val");
  if (streakEl) streakEl.textContent = String(state.dailyStreak);
  const rs = document.getElementById("daily-login-reward-stones");
  if (rs) rs.textContent = String(prev.stones);
  const re = document.getElementById("daily-login-reward-essence");
  if (re) re.textContent = String(prev.essence);
  const btn = document.getElementById("btn-daily-login-claim") as HTMLButtonElement | null;
  if (btn) {
    btn.disabled = !canClaim;
    btn.className = `btn ${canClaim ? "btn-primary" : ""}`;
    btn.textContent = canClaim ? "领取今日灵息礼" : "今日已领取";
  }
  document.querySelectorAll(".daily-login-day").forEach((el, i) => {
    const isToday = i === widx;
    const claimedToday = state.dailyLoginClaimedDate === today;
    el.className = `daily-login-day${isToday ? " today" : ""}${isToday && claimedToday ? " claimed" : ""}`;
  });
}
