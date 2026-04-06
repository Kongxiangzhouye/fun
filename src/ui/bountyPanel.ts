import type { GameState } from "../types";
import {
  WEEKLY_BOUNTY_TASKS,
  WEEKLY_BOUNTY_MILESTONES,
  ensureWeeklyBountyWeek,
  weeklyBountySnapshotBundle,
  weeklyBountyFeedbackState,
  formatWeeklyBountyObserveLine,
  countWeeklyBountyTasksCompleted,
  weeklyBountyMilestoneUiState,
  countClaimableWeeklyAll,
  type WeeklyBountyCardDeco,
  type WeeklyBountyTaskDisplayState,
} from "../systems/weeklyBounty";
import {
  UI_BOUNTY_CLAIM_ALL_DECO,
  UI_BOUNTY_FORGE_DECO,
  UI_BOUNTY_WAVES_DECO,
  UI_BOUNTY_PULLS_DECO,
  UI_BOUNTY_GARDEN_DECO,
  UI_BOUNTY_TUNA_DECO,
  UI_BOUNTY_REALM_DECO,
  UI_BOUNTY_STREAK_BADGE,
  UI_BOUNTY_COMPLETE_BADGE,
  UI_BOUNTY_PENDING_BADGE,
  UI_BOUNTY_OVERDUE_BADGE,
  UI_BOUNTY_WAVES_FOCUS_BADGE,
  UI_BOUNTY_WEEKLY_FOCUS_RIBBON,
  UI_BOUNTY_WEEKLY_NEXT_STEP_BADGE,
  UI_BOUNTY_SURGE_BADGE,
  UI_BOUNTY_CLAIM_ECHO_BADGE,
  UI_BOUNTY_LAST_DAY_ALERT_BADGE,
  UI_BOUNTY_MILESTONE_DECO,
  UI_BOUNTY_GO_ACTION,
  UI_BOUNTY_GO_FOCUS,
  UI_HEAD_BOUNTY,
  UI_WEEKLY_BOUNTY_STATE_SYNC,
} from "./visualAssets";

const BOUNTY_CARD_DECO_SRC: Record<WeeklyBountyCardDeco, string> = {
  waves: UI_BOUNTY_WAVES_DECO,
  pulls: UI_BOUNTY_PULLS_DECO,
  forge: UI_BOUNTY_FORGE_DECO,
  garden: UI_BOUNTY_GARDEN_DECO,
  tuna: UI_BOUNTY_TUNA_DECO,
  realm: UI_BOUNTY_REALM_DECO,
};

function bountyTaskView(taskState: WeeklyBountyTaskDisplayState): {
  statusClass: string;
  statusText: string;
  canClaim: boolean;
  buttonText: string;
} {
  if (taskState === "claimed") {
    return { statusClass: "claimed", statusText: "已领", canClaim: false, buttonText: "本周已领" };
  }
  if (taskState === "claimable") {
    return { statusClass: "claimable", statusText: "可领", canClaim: true, buttonText: "领取" };
  }
  if (taskState === "overdue") {
    return { statusClass: "overdue", statusText: "逾期可领", canClaim: true, buttonText: "立即领取" };
  }
  return { statusClass: "pending", statusText: "待完成", canClaim: false, buttonText: "未达成" };
}

function milestoneView(
  ui: ReturnType<typeof weeklyBountyMilestoneUiState>,
): { statusClass: string; statusText: string; canClaim: boolean; buttonText: string } {
  if (ui === "claimed") {
    return { statusClass: "claimed", statusText: "已领", canClaim: false, buttonText: "本周已领" };
  }
  if (ui === "claimable") {
    return { statusClass: "claimable", statusText: "可领", canClaim: true, buttonText: "领取" };
  }
  return { statusClass: "pending", statusText: "未达成", canClaim: false, buttonText: "未达成" };
}

export function renderBountyPanel(state: GameState, now: number): string {
  ensureWeeklyBountyWeek(state, now);
  const wk = state.weeklyBounty.weekKey;
  const isLastDayOfWeek = new Date(now).getDay() === 0;
  const fb = weeklyBountyFeedbackState(state, now);
  const doneCount = countWeeklyBountyTasksCompleted(state);
  const claimableN = countClaimableWeeklyAll(state, now);
  const bountyBundle = weeklyBountySnapshotBundle(state, now);
  const nextAction = bountyBundle.nextAction;
  const taskSnapshots = bountyBundle.snapshot.taskMap;
  const rows = WEEKLY_BOUNTY_TASKS.map((t) => {
    const snap = taskSnapshots.get(t.id);
    const prog = snap?.progress ?? 0;
    const taskState = snap?.state ?? "pending";
    const view = bountyTaskView(taskState);
    const pct = Math.min(100, (100 * prog) / t.target);
    const isFocus = nextAction?.taskId === t.id;
    const deco = `<img class="bounty-task-deco" src="${BOUNTY_CARD_DECO_SRC[t.cardDeco]}" alt="" width="22" height="22" loading="lazy" />`;
    return `
      <div class="bounty-card ${isFocus ? "is-focus" : ""}" data-bounty-task="${t.id}">
        <div class="bounty-card-head">
          <div class="bounty-card-head-left">
            ${deco}
            <h3>${t.title}</h3>
          </div>
          <span class="bounty-status ${view.statusClass}">${view.statusText}</span>
        </div>
        <p class="hint sm">${t.desc}</p>
        <div class="bounty-bar-wrap"><div class="bounty-bar"><div class="bounty-bar-fill" style="width:${pct}%"></div></div>
        <span class="bounty-bar-lbl">${prog} / ${t.target}</span></div>
        <p class="hint sm bounty-reward">奖励：灵石 <strong>${t.rewardStones}</strong> · 唤灵髓 <strong>${t.rewardEssence}</strong></p>
        <button type="button" class="btn ${view.canClaim ? "btn-primary" : ""}" data-bounty-claim="${t.id}" ${view.canClaim ? "" : "disabled"}>
          ${view.buttonText}
        </button>
        <button type="button" class="btn bounty-go-btn ${isFocus ? "btn-primary" : ""}" data-bounty-go="${isFocus && nextAction ? nextAction.action : ""}" ${isFocus && nextAction ? "" : "disabled"}>
          <img class="bounty-go-ico" src="${isFocus ? UI_BOUNTY_GO_FOCUS : UI_BOUNTY_GO_ACTION}" alt="" width="14" height="14" loading="lazy" />
          去执行
        </button>
      </div>`;
  }).join("");

  const milestoneRows = WEEKLY_BOUNTY_MILESTONES.map((m) => {
    const ui = weeklyBountyMilestoneUiState(state, m, now);
    const mv = milestoneView(ui);
    const pct = Math.min(100, (100 * doneCount) / m.threshold);
    return `
      <div class="bounty-milestone-card" data-bounty-milestone="${m.id}">
        <div class="bounty-card-head">
          <div class="bounty-card-head-left">
            <img class="bounty-task-deco" src="${UI_BOUNTY_MILESTONE_DECO}" alt="" width="22" height="22" loading="lazy" />
            <h3>${m.title}</h3>
          </div>
          <span class="bounty-status ${mv.statusClass}">${mv.statusText}</span>
        </div>
        <p class="hint sm">${m.desc}</p>
        <div class="bounty-bar-wrap"><div class="bounty-bar"><div class="bounty-bar-fill" style="width:${pct}%"></div></div>
        <span class="bounty-bar-lbl">${Math.min(doneCount, m.threshold)} / ${m.threshold}</span></div>
        <p class="hint sm bounty-reward">奖励：灵石 <strong>${m.rewardStones}</strong> · 唤灵髓 <strong>${m.rewardSummonEssence}</strong> · 筑灵髓 <strong>${m.rewardZhuLingEssence}</strong></p>
        <button type="button" class="btn ${mv.canClaim ? "btn-primary" : ""}" data-bounty-milestone-claim="${m.id}" ${mv.canClaim ? "" : "disabled"}>
          ${mv.buttonText}
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
      <p class="hint sm bounty-week-line"><img class="bounty-week-focus-ribbon-ico" src="${UI_BOUNTY_WEEKLY_FOCUS_RIBBON}" alt="" width="72" height="18" loading="lazy" /><img class="bounty-week-focus-ico" src="${UI_BOUNTY_WAVES_FOCUS_BADGE}" alt="" width="16" height="16" loading="lazy" />当前周次：<strong>${wk}</strong>${isLastDayOfWeek ? `<img class="bounty-last-day-alert-badge" src="${UI_BOUNTY_LAST_DAY_ALERT_BADGE}" alt="本周最后一天提示" width="18" height="18" loading="lazy" />` : ""}</p>
      <div class="bounty-next-target" id="bounty-next-target">
        <span class="bounty-next-target-kicker">本周建议目标</span>
        <strong id="bounty-next-target-title">${nextAction ? `${nextAction.title}（${nextAction.progress}/${nextAction.target}）` : "本周任务已全部完成"}</strong>
        <span class="hint sm" id="bounty-next-target-reason">${nextAction ? nextAction.reason : "可等待下周刷新，或清理其他模块目标。"}</span>
        <button type="button" class="btn btn-primary" id="btn-bounty-go-next" data-bounty-go="${nextAction?.action ?? ""}" ${nextAction ? "" : "disabled"}>
          <img class="bounty-go-ico" src="${nextAction ? UI_BOUNTY_GO_FOCUS : UI_BOUNTY_GO_ACTION}" alt="" width="14" height="14" loading="lazy" />
          去执行
        </button>
      </div>
      <div class="bounty-feedback-row">
        <span class="bounty-feedback-pill">
          <img class="bounty-feedback-ico bounty-feedback-next-step-ico" src="${UI_BOUNTY_WEEKLY_NEXT_STEP_BADGE}" alt="" width="18" height="18" loading="lazy" />
          <img class="bounty-feedback-ico" src="${UI_BOUNTY_PENDING_BADGE}" alt="" width="18" height="18" loading="lazy" />
          <span id="bounty-feedback-pending">待完成 ${fb.pending} / ${fb.total}</span>
        </span>
        <span class="bounty-feedback-pill">
          <img class="bounty-feedback-ico" src="${UI_BOUNTY_STREAK_BADGE}" alt="" width="18" height="18" loading="lazy" />
          <span id="bounty-feedback-claimable">可领 ${fb.claimReady} / ${fb.total}</span>
          <img class="bounty-feedback-ico bounty-feedback-surge-ico ${fb.claimReady > 0 ? "is-on" : ""}" src="${UI_BOUNTY_SURGE_BADGE}" alt="" width="18" height="18" loading="lazy" />
        </span>
        <span class="bounty-feedback-pill ${fb.claimed >= fb.total ? "is-ready" : ""}">
          <img class="bounty-feedback-ico" src="${UI_BOUNTY_COMPLETE_BADGE}" alt="" width="18" height="18" loading="lazy" />
          <span id="bounty-feedback-claimed">已领 ${fb.claimed} / ${fb.total}</span>
        </span>
        <span class="bounty-feedback-pill bounty-feedback-pill--overdue ${fb.hasOverdue ? "is-overdue" : ""}">
          <img class="bounty-feedback-ico" src="${UI_BOUNTY_OVERDUE_BADGE}" alt="" width="18" height="18" loading="lazy" />
          <span id="bounty-feedback-overdue">${fb.hasOverdue ? `逾期 ${fb.overdue} / ${fb.total}` : "进度正常"}</span>
        </span>
      </div>
      <p class="hint sm bounty-observe-line" id="bounty-feedback-observe"><img class="bounty-observe-ico" src="${UI_WEEKLY_BOUNTY_STATE_SYNC}" alt="" width="16" height="16" loading="lazy" /><span id="bounty-feedback-observe-text">状态校验：${formatWeeklyBountyObserveLine(fb)}</span></p>
      <div class="bounty-milestone-block">
        <h3 class="bounty-milestone-heading">
          <img class="bounty-milestone-heading-ico" src="${UI_BOUNTY_MILESTONE_DECO}" alt="" width="22" height="22" loading="lazy" />
          本周里程（已达成 <strong id="bounty-milestone-done-count">${doneCount}</strong> / 6 条）
        </h3>
        <p class="hint sm bounty-milestone-hint">按本周已达成进度的悬赏条目数解锁；与单条悬赏领取顺序无关。</p>
        <div class="bounty-milestone-grid">${milestoneRows}</div>
      </div>
      <div class="bounty-claim-all-row">
        <button type="button" class="btn btn-primary bounty-claim-all-btn" id="btn-bounty-claim-all" ${claimableN > 0 ? "" : "disabled"}>
          <img class="bounty-claim-all-ico" src="${UI_BOUNTY_CLAIM_ALL_DECO}" alt="" width="20" height="20" loading="lazy" />
          <img class="bounty-claim-all-ico bounty-claim-all-echo-ico" src="${UI_BOUNTY_CLAIM_ECHO_BADGE}" alt="" width="16" height="16" loading="lazy" />
          <span id="bounty-claim-all-lbl">一键领取可领奖励（悬赏+里程 ${claimableN}）</span>
        </button>
      </div>
      <div class="bounty-grid">${rows}</div>
    </section>`;
}

/** 主循环刷新进度条与按钮（无需整页 render） */
export function updateBountyPanelReadouts(state: GameState, now: number): void {
  ensureWeeklyBountyWeek(state, now);
  const wkEl = document.querySelector(".bounty-week-line strong");
  if (wkEl) wkEl.textContent = state.weeklyBounty.weekKey;
  const weekLineEl = document.querySelector(".bounty-week-line");
  const shouldShowLastDayBadge = new Date(now).getDay() === 0;
  const existingLastDayBadge = weekLineEl?.querySelector(".bounty-last-day-alert-badge") as HTMLImageElement | null;
  if (weekLineEl && shouldShowLastDayBadge && !existingLastDayBadge) {
    const badge = document.createElement("img");
    badge.className = "bounty-last-day-alert-badge";
    badge.src = UI_BOUNTY_LAST_DAY_ALERT_BADGE;
    badge.alt = "本周最后一天提示";
    badge.width = 18;
    badge.height = 18;
    badge.loading = "lazy";
    weekLineEl.appendChild(badge);
  } else if (!shouldShowLastDayBadge && existingLastDayBadge) {
    existingLastDayBadge.remove();
  }
  const claimAllBtn = document.getElementById("btn-bounty-claim-all") as HTMLButtonElement | null;
  const claimAllLbl = document.getElementById("bounty-claim-all-lbl");
  const fb = weeklyBountyFeedbackState(state, now);
  const bountyBundle = weeklyBountySnapshotBundle(state, now);
  const nextAction = bountyBundle.nextAction;
  const cn = countClaimableWeeklyAll(state, now);
  const doneCount = countWeeklyBountyTasksCompleted(state);
  const doneEl = document.getElementById("bounty-milestone-done-count");
  if (doneEl) doneEl.textContent = String(doneCount);
  const taskSnapshots = bountyBundle.snapshot.taskMap;
  if (claimAllBtn) claimAllBtn.disabled = cn <= 0;
  if (claimAllLbl) claimAllLbl.textContent = `一键领取可领奖励（悬赏+里程 ${cn}）`;
  const pendingLbl = document.getElementById("bounty-feedback-pending");
  if (pendingLbl) pendingLbl.textContent = `待完成 ${fb.pending} / ${fb.total}`;
  const claimableLbl = document.getElementById("bounty-feedback-claimable");
  if (claimableLbl) claimableLbl.textContent = `可领 ${fb.claimReady} / ${fb.total}`;
  const surgeIco = document.querySelector(".bounty-feedback-surge-ico");
  if (surgeIco) surgeIco.classList.toggle("is-on", fb.claimReady > 0);
  const claimedLbl = document.getElementById("bounty-feedback-claimed");
  if (claimedLbl) claimedLbl.textContent = `已领 ${fb.claimed} / ${fb.total}`;
  const claimPill = claimedLbl?.closest(".bounty-feedback-pill");
  if (claimPill) claimPill.classList.toggle("is-ready", fb.claimed >= fb.total);
  const overdueLbl = document.getElementById("bounty-feedback-overdue");
  if (overdueLbl) overdueLbl.textContent = fb.hasOverdue ? `逾期 ${fb.overdue} / ${fb.total}` : "进度正常";
  const overduePill = overdueLbl?.closest(".bounty-feedback-pill");
  if (overduePill) overduePill.classList.toggle("is-overdue", fb.hasOverdue);
  const observeLbl = document.getElementById("bounty-feedback-observe");
  const observeTextEl = document.getElementById("bounty-feedback-observe-text");
  if (observeTextEl) observeTextEl.textContent = `状态校验：${formatWeeklyBountyObserveLine(fb)}`;
  else if (observeLbl) observeLbl.textContent = `状态校验：${formatWeeklyBountyObserveLine(fb)}`;
  const nextTitle = document.getElementById("bounty-next-target-title");
  const nextReason = document.getElementById("bounty-next-target-reason");
  const nextBtn = document.getElementById("btn-bounty-go-next") as HTMLButtonElement | null;
  if (nextTitle) {
    nextTitle.textContent = nextAction
      ? `${nextAction.title}（${nextAction.progress}/${nextAction.target}）`
      : "本周任务已全部完成";
  }
  if (nextReason) {
    nextReason.textContent = nextAction ? nextAction.reason : "可等待下周刷新，或清理其他模块目标。";
  }
  if (nextBtn) {
    nextBtn.disabled = !nextAction;
    nextBtn.dataset.bountyGo = nextAction?.action ?? "";
    const icon = nextBtn.querySelector(".bounty-go-ico") as HTMLImageElement | null;
    if (icon) icon.src = nextAction ? UI_BOUNTY_GO_FOCUS : UI_BOUNTY_GO_ACTION;
  }
  for (const t of WEEKLY_BOUNTY_TASKS) {
    const snap = taskSnapshots.get(t.id);
    const prog = snap?.progress ?? 0;
    const taskState = snap?.state ?? "pending";
    const view = bountyTaskView(taskState);
    const pct = Math.min(100, (100 * prog) / t.target);
    const card = document.querySelector(`[data-bounty-task="${t.id}"]`);
    if (!card) continue;
    const focus = nextAction?.taskId === t.id;
    card.classList.toggle("is-focus", focus);
    const fill = card.querySelector(".bounty-bar-fill") as HTMLElement | null;
    if (fill) fill.style.width = `${pct}%`;
    const lbl = card.querySelector(".bounty-bar-lbl");
    if (lbl) lbl.textContent = `${prog} / ${t.target}`;
    const status = card.querySelector(".bounty-status");
    if (status) {
      status.className = `bounty-status ${view.statusClass}`;
      status.textContent = view.statusText;
    }
    const btn = card.querySelector("[data-bounty-claim]") as HTMLButtonElement | null;
    if (btn) {
      btn.disabled = !view.canClaim;
      btn.className = `btn ${view.canClaim ? "btn-primary" : ""}`;
      btn.textContent = view.buttonText;
    }
    const goBtn = card.querySelector(".bounty-go-btn") as HTMLButtonElement | null;
    if (goBtn) {
      goBtn.disabled = !focus || !nextAction;
      goBtn.className = `btn bounty-go-btn ${focus ? "btn-primary" : ""}`;
      goBtn.dataset.bountyGo = focus && nextAction ? nextAction.action : "";
      const icon = goBtn.querySelector(".bounty-go-ico") as HTMLImageElement | null;
      if (icon) icon.src = focus ? UI_BOUNTY_GO_FOCUS : UI_BOUNTY_GO_ACTION;
    }
  }
  for (const m of WEEKLY_BOUNTY_MILESTONES) {
    const ui = weeklyBountyMilestoneUiState(state, m, now);
    const mv = milestoneView(ui);
    const pct = Math.min(100, (100 * doneCount) / m.threshold);
    const card = document.querySelector(`[data-bounty-milestone="${m.id}"]`);
    if (!card) continue;
    const fill = card.querySelector(".bounty-bar-fill") as HTMLElement | null;
    if (fill) fill.style.width = `${pct}%`;
    const lbl = card.querySelector(".bounty-bar-lbl");
    if (lbl) lbl.textContent = `${Math.min(doneCount, m.threshold)} / ${m.threshold}`;
    const status = card.querySelector(".bounty-status");
    if (status) {
      status.className = `bounty-status ${mv.statusClass}`;
      status.textContent = mv.statusText;
    }
    const btn = card.querySelector("[data-bounty-milestone-claim]") as HTMLButtonElement | null;
    if (btn) {
      btn.disabled = !mv.canClaim;
      btn.className = `btn ${mv.canClaim ? "btn-primary" : ""}`;
      btn.textContent = mv.buttonText;
    }
  }
}

/** 主循环高频刷新入口（仅在面板可见时执行）。 */
export function refreshBountyPanelLiveIfVisible(state: GameState, now: number, isVisible: boolean): boolean {
  if (!isVisible) return false;
  updateBountyPanelReadouts(state, now);
  return true;
}
