import type { GameState } from "../types";
import {
  WEEKLY_BOUNTY_TASKS,
  weeklyBountyProgress,
  isWeeklyBountyComplete,
  isWeeklyBountyClaimed,
  currentWeekKey,
  ensureWeeklyBountyWeek,
} from "../systems/weeklyBounty";
import { UI_HEAD_BOUNTY } from "./visualAssets";

export function renderBountyPanel(state: GameState, now: number): string {
  const wk = currentWeekKey(now);
  const rows = WEEKLY_BOUNTY_TASKS.map((t) => {
    const prog = weeklyBountyProgress(state, t);
    const done = isWeeklyBountyComplete(state, t);
    const claimed = isWeeklyBountyClaimed(state, t.id);
    const pct = Math.min(100, (100 * prog) / t.target);
    const canClaim = done && !claimed;
    return `
      <div class="bounty-card" data-bounty-task="${t.id}">
        <div class="bounty-card-head">
          <h3>${t.title}</h3>
          <span class="bounty-status ${claimed ? "claimed" : done ? "done" : "prog"}">${claimed ? "已领" : done ? "可领" : "进行中"}</span>
        </div>
        <p class="hint sm">${t.desc}</p>
        <div class="bounty-bar-wrap"><div class="bounty-bar"><div class="bounty-bar-fill" style="width:${pct}%"></div></div>
        <span class="bounty-bar-lbl">${prog} / ${t.target}</span></div>
        <p class="hint sm bounty-reward">奖励：灵石 <strong>${t.rewardStones}</strong> · 唤灵髓 <strong>${t.rewardEssence}</strong></p>
        <button type="button" class="btn ${canClaim ? "btn-primary" : ""}" data-bounty-claim="${t.id}" ${canClaim ? "" : "disabled"}>
          ${claimed ? "本周已领" : canClaim ? "领取" : "未达成"}
        </button>
      </div>`;
  }).join("");

  return `
    <section class="panel bounty-panel">
      <div class="panel-title-art-row">
        <img class="panel-title-art-icon" src="${UI_HEAD_BOUNTY}" alt="" width="28" height="28" loading="lazy" />
        <h2>周常悬赏</h2>
      </div>
      <p class="hint">每周一（本地时间）刷新进度与领取状态。完成条目可领取灵石与唤灵髓。</p>
      <p class="hint sm bounty-week-line">当前周次：<strong>${wk}</strong></p>
      <div class="bounty-grid">${rows}</div>
    </section>`;
}

/** 主循环刷新进度条与按钮（无需整页 render） */
export function updateBountyPanelReadouts(state: GameState, now: number): void {
  ensureWeeklyBountyWeek(state, now);
  const wkEl = document.querySelector(".bounty-week-line strong");
  if (wkEl) wkEl.textContent = currentWeekKey(now);
  for (const t of WEEKLY_BOUNTY_TASKS) {
    const prog = weeklyBountyProgress(state, t);
    const done = isWeeklyBountyComplete(state, t);
    const claimed = isWeeklyBountyClaimed(state, t.id);
    const pct = Math.min(100, (100 * prog) / t.target);
    const canClaim = done && !claimed;
    const card = document.querySelector(`[data-bounty-task="${t.id}"]`);
    if (!card) continue;
    const fill = card.querySelector(".bounty-bar-fill") as HTMLElement | null;
    if (fill) fill.style.width = `${pct}%`;
    const lbl = card.querySelector(".bounty-bar-lbl");
    if (lbl) lbl.textContent = `${prog} / ${t.target}`;
    const status = card.querySelector(".bounty-status");
    if (status) {
      status.className = `bounty-status ${claimed ? "claimed" : done ? "done" : "prog"}`;
      status.textContent = claimed ? "已领" : done ? "可领" : "进行中";
    }
    const btn = card.querySelector("[data-bounty-claim]") as HTMLButtonElement | null;
    if (btn) {
      btn.disabled = !canClaim;
      btn.className = `btn ${canClaim ? "btn-primary" : ""}`;
      btn.textContent = claimed ? "本周已领" : canClaim ? "领取" : "未达成";
    }
  }
}
