import type { GameState } from "../types";
import {
  WEEKLY_BOUNTY_TASKS,
  weeklyBountyProgress,
  isWeeklyBountyComplete,
  isWeeklyBountyClaimed,
  currentWeekKey,
  ensureWeeklyBountyWeek,
  countClaimableWeeklyBounties,
  type WeeklyBountyCardDeco,
} from "../systems/weeklyBounty";
import {
  UI_BOUNTY_CLAIM_ALL_DECO,
  UI_BOUNTY_FORGE_DECO,
  UI_BOUNTY_WAVES_DECO,
  UI_BOUNTY_PULLS_DECO,
  UI_BOUNTY_GARDEN_DECO,
  UI_BOUNTY_TUNA_DECO,
  UI_BOUNTY_REALM_DECO,
  UI_HEAD_BOUNTY,
} from "./visualAssets";

const BOUNTY_CARD_DECO_SRC: Record<WeeklyBountyCardDeco, string> = {
  waves: UI_BOUNTY_WAVES_DECO,
  pulls: UI_BOUNTY_PULLS_DECO,
  forge: UI_BOUNTY_FORGE_DECO,
  garden: UI_BOUNTY_GARDEN_DECO,
  tuna: UI_BOUNTY_TUNA_DECO,
  realm: UI_BOUNTY_REALM_DECO,
};

export function renderBountyPanel(state: GameState, now: number): string {
  ensureWeeklyBountyWeek(state, now);
  const wk = currentWeekKey(now);
  const claimableN = countClaimableWeeklyBounties(state, now);
  const rows = WEEKLY_BOUNTY_TASKS.map((t) => {
    const prog = weeklyBountyProgress(state, t);
    const done = isWeeklyBountyComplete(state, t);
    const claimed = isWeeklyBountyClaimed(state, t.id);
    const pct = Math.min(100, (100 * prog) / t.target);
    const canClaim = done && !claimed;
    const deco = `<img class="bounty-task-deco" src="${BOUNTY_CARD_DECO_SRC[t.cardDeco]}" alt="" width="22" height="22" loading="lazy" />`;
    return `
      <div class="bounty-card" data-bounty-task="${t.id}">
        <div class="bounty-card-head">
          <div class="bounty-card-head-left">
            ${deco}
            <h3>${t.title}</h3>
          </div>
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
      <div class="bounty-claim-all-row">
        <button type="button" class="btn btn-primary bounty-claim-all-btn" id="btn-bounty-claim-all" ${claimableN > 0 ? "" : "disabled"}>
          <img class="bounty-claim-all-ico" src="${UI_BOUNTY_CLAIM_ALL_DECO}" alt="" width="20" height="20" loading="lazy" />
          <span id="bounty-claim-all-lbl">一键领取可领悬赏（${claimableN}）</span>
        </button>
      </div>
      <div class="bounty-grid">${rows}</div>
    </section>`;
}

/** 主循环刷新进度条与按钮（无需整页 render） */
export function updateBountyPanelReadouts(state: GameState, now: number): void {
  ensureWeeklyBountyWeek(state, now);
  const wkEl = document.querySelector(".bounty-week-line strong");
  if (wkEl) wkEl.textContent = currentWeekKey(now);
  const claimAllBtn = document.getElementById("btn-bounty-claim-all") as HTMLButtonElement | null;
  const claimAllLbl = document.getElementById("bounty-claim-all-lbl");
  const cn = countClaimableWeeklyBounties(state, now);
  if (claimAllBtn) claimAllBtn.disabled = cn <= 0;
  if (claimAllLbl) claimAllLbl.textContent = `一键领取可领悬赏（${cn}）`;
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
