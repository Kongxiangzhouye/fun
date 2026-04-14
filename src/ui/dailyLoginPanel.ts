import type { GameState } from "../types";
import {
  canClaimDailyLoginReward,
  previewDailyLoginReward,
  previewWeeklyFullBonus,
  toLocalYMD,
  weekDatesMonToSun,
  weeklyLoginClaimCount,
} from "../systems/dailyLoginCalendar";
import {
  UI_DAILY_LOGIN_AUTO,
  UI_DAILY_LOGIN_LIFETIME_RIBBON,
  UI_DAILY_LOGIN_WEEK_BONUS,
  UI_DAILY_LOGIN_WEEK_CHECK,
  UI_HEAD_DAILY_LOGIN,
} from "./visualAssets";

const WEEK_LABELS = ["一", "二", "三", "四", "五", "六", "日"];

function weekStripCells(state: GameState, now: number): string {
  const today = toLocalYMD(now);
  const weekDates = weekDatesMonToSun(now);
  return WEEK_LABELS.map((lb, i) => {
    const d = weekDates[i]!;
    const isToday = d === today;
    const claimedInWeek = state.loginCalendarClaimedDates.includes(d);
    const isFuture = d > today;
    let cls = "daily-login-day";
    if (isToday) cls += " today";
    if (claimedInWeek) cls += " claimed-week";
    if (isFuture) cls += " future";
    if (isToday && state.dailyLoginClaimedDate === today) cls += " claimed";
    return `<span class="${cls}" title="周${lb} ${d}">${lb}</span>`;
  }).join("");
}

export function renderDailyLoginPanel(state: GameState, now: number): string {
  const today = toLocalYMD(now);
  const canClaim = canClaimDailyLoginReward(state, now);
  const prev = previewDailyLoginReward(state.dailyStreak);
  const wk = weeklyLoginClaimCount(state);
  const wb = previewWeeklyFullBonus();
  const weekCells = weekStripCells(state, now);
  const bonusDone = state.loginCalendarWeeklyBonusClaimed;

  return `
    <section class="panel daily-login-panel" data-next-boost-target="daily-login">
      <div class="panel-title-art-row">
        <img class="panel-title-art-icon" src="${UI_HEAD_DAILY_LOGIN}" alt="" width="28" height="28" loading="lazy" />
        <h2>灵息日历</h2>
      </div>
      <p class="hint">按<strong>本地日历日</strong>结算连签；跨日自动刷新。每日可领一次「灵息礼」。本周一至周日累计领取满 7 日可领额外奖励。</p>
      <div class="daily-login-week-hint-row">
        <img src="${UI_DAILY_LOGIN_WEEK_CHECK}" alt="" width="18" height="18" loading="lazy" />
        <span id="daily-login-week-progress-line">本周已领 <strong id="daily-login-week-count">${wk}</strong>/7 日</span>
        <img src="${UI_DAILY_LOGIN_WEEK_BONUS}" alt="" width="18" height="18" loading="lazy" class="daily-login-week-bonus-ico" />
        <span id="daily-login-week-bonus-line" class="hint sm">${
          bonusDone
            ? "本周满签额外奖励已领取。"
            : `满签额外：灵石 ${wb.stones} · 唤灵髓 ${wb.summonEssence} · 筑灵髓 ${wb.zhuLingEssence}`
        }</span>
      </div>
      <div
        class="daily-login-week-meter"
        role="progressbar"
        aria-valuemin="0"
        aria-valuemax="7"
        aria-valuenow="${wk}"
        aria-label="本周灵息礼已领天数"
      >
        <div class="daily-login-week-meter-fill" id="daily-login-week-meter-fill" style="width: ${Math.min(100, (wk / 7) * 100)}%"></div>
      </div>
      <div class="daily-login-strip" aria-hidden="true">${weekCells}</div>
      <p class="hint sm daily-login-streak-line">当前连签：<strong id="daily-login-streak-val">${state.dailyStreak}</strong> 日 · 今日 <strong>${today}</strong></p>
      <p class="hint sm daily-login-lifetime-line">
        <img class="daily-login-lifetime-ico" src="${UI_DAILY_LOGIN_LIFETIME_RIBBON}" alt="" width="20" height="20" loading="lazy" />
        <span>终身领取累计：<strong id="daily-login-lt-claims">${state.lifetimeStats.dailyLoginDayClaims}</strong> 次</span>
      </p>
      <div class="daily-login-reward-card">
        <p class="daily-login-reward-title">今日灵息礼（随连签提升）</p>
        <p class="hint sm">灵石 <strong id="daily-login-reward-stones">${prev.stones}</strong> · 唤灵髓 <strong id="daily-login-reward-essence">${prev.essence}</strong></p>
        <label class="daily-login-auto-row">
          <input type="checkbox" id="chk-daily-login-auto" data-ui-pref="autoClaimDailyLogin" ${state.uiPrefs.autoClaimDailyLogin ? "checked" : ""} />
          <img class="daily-login-auto-ico" src="${UI_DAILY_LOGIN_AUTO}" alt="" width="18" height="18" loading="lazy" />
          <span class="daily-login-auto-text">可领时自动领取（含满签额外奖励判定）</span>
        </label>
        <button type="button" class="btn ${canClaim ? "btn-primary" : ""}" id="btn-daily-login-claim" ${canClaim ? "" : "disabled"}>
          ${canClaim ? "领取今日灵息礼" : "今日已领取"}
        </button>
      </div>
    </section>`;
}

export function updateDailyLoginPanelReadouts(state: GameState, now: number): void {
  const autoChk = document.getElementById("chk-daily-login-auto") as HTMLInputElement | null;
  if (autoChk) autoChk.checked = state.uiPrefs.autoClaimDailyLogin;
  const today = toLocalYMD(now);
  const canClaim = canClaimDailyLoginReward(state, now);
  const prev = previewDailyLoginReward(state.dailyStreak);
  const wb = previewWeeklyFullBonus();
  const wk = weeklyLoginClaimCount(state);
  const streakEl = document.getElementById("daily-login-streak-val");
  if (streakEl) streakEl.textContent = String(state.dailyStreak);
  const ltClaims = document.getElementById("daily-login-lt-claims");
  if (ltClaims) ltClaims.textContent = String(state.lifetimeStats.dailyLoginDayClaims);
  const rs = document.getElementById("daily-login-reward-stones");
  if (rs) rs.textContent = String(prev.stones);
  const re = document.getElementById("daily-login-reward-essence");
  if (re) re.textContent = String(prev.essence);
  const wc = document.getElementById("daily-login-week-count");
  if (wc) wc.textContent = String(wk);
  const wkMeter = document.getElementById("daily-login-week-meter-fill");
  if (wkMeter) wkMeter.style.width = `${Math.min(100, (wk / 7) * 100)}%`;
  const wkMeterHost = document.querySelector(".daily-login-week-meter");
  if (wkMeterHost) {
    wkMeterHost.setAttribute("aria-valuenow", String(wk));
  }
  const bonusLine = document.getElementById("daily-login-week-bonus-line");
  if (bonusLine) {
    bonusLine.textContent = state.loginCalendarWeeklyBonusClaimed
      ? "本周满签额外奖励已领取。"
      : `满签额外：灵石 ${wb.stones} · 唤灵髓 ${wb.summonEssence} · 筑灵髓 ${wb.zhuLingEssence}`;
  }
  const btn = document.getElementById("btn-daily-login-claim") as HTMLButtonElement | null;
  if (btn) {
    btn.disabled = !canClaim;
    btn.className = `btn ${canClaim ? "btn-primary" : ""}`;
    btn.textContent = canClaim ? "领取今日灵息礼" : "今日已领取";
  }
  const weekDates = weekDatesMonToSun(now);
  document.querySelectorAll(".daily-login-day").forEach((el, i) => {
    const d = weekDates[i];
    if (!d) return;
    const isToday = d === today;
    const claimedInWeek = state.loginCalendarClaimedDates.includes(d);
    const isFuture = d > today;
    let cls = "daily-login-day";
    if (isToday) cls += " today";
    if (claimedInWeek) cls += " claimed-week";
    if (isFuture) cls += " future";
    if (isToday && state.dailyLoginClaimedDate === today) cls += " claimed";
    el.className = cls;
  });
}
