import Decimal from "decimal.js";
import type { GameState } from "../types";
import { fmtDecimal } from "../stones";
import {
  estateCommissionTimeLeftMs,
  getEstateCommissionRefreshStatus,
  getEstateCommissionStreakPreview,
} from "../systems/estateCommission";
import {
  UI_ESTATE_COMMISSION_RESOURCE,
  UI_ESTATE_COMMISSION_COMBAT,
  UI_ESTATE_COMMISSION_CULTIVATION,
  UI_ESTATE_COMMISSION_AUTO_QUEUE_ON,
  UI_ESTATE_COMMISSION_AUTO_QUEUE_OFF,
  UI_ESTATE_COMMISSION_AUTO_STRATEGY_ANY,
  UI_ESTATE_COMMISSION_AUTO_STRATEGY_SAME,
  UI_ESTATE_COMMISSION_AUTO_FEEDBACK,
  UI_ESTATE_COMMISSION_AUTO_NEXT,
  UI_ESTATE_COMMISSION_AUTO_RENEW_ON,
  UI_ESTATE_COMMISSION_AUTO_RENEW_OFF,
  UI_ESTATE_COMMISSION_STREAK,
  UI_ESTATE_COMMISSION_REFRESH_COOLDOWN,
  UI_ESTATE_COMMISSION_REFRESH_BLOCKED,
  UI_ESTATE_COMMISSION_AUTO_SETTLE,
  UI_WEEKLY_BOUNTY_STATE_SYNC,
} from "./visualAssets";

function ecTypeZh(tp: string): string {
  return tp === "resource" ? "资源" : tp === "combat" ? "战斗" : "养成";
}

function autoQueuePolicyLine(state: GameState): string {
  const ec = state.estateCommission;
  return ec.autoQueueStrategy === "same-type"
    ? "自动队列策略：同类型续签（下一单需与本次完成类型一致）"
    : "自动队列策略：任意类型续签（结算后直接续接）";
}

function autoQueueNextLine(state: GameState): string {
  const ec = state.estateCommission;
  if (!ec.autoQueueEnabled) return "下一单预览：自动队列关闭";
  if (ec.active) {
    if (ec.autoQueueStrategy === "same-type") return `下一单预览：等待与当前类型一致（${ecTypeZh(ec.active.offer.type)}）`;
    return "下一单预览：当前策略允许任意类型";
  }
  if (ec.offer) return `下一单预览：${ec.offer.title}（${ecTypeZh(ec.offer.type)}）`;
  if (ec.autoQueueLastOfferTitle) {
    return `下一单预览：${ec.autoQueueLastOfferTitle}（${ecTypeZh(ec.autoQueueLastOfferType ?? "resource")}）`;
  }
  return "下一单预览：暂未生成";
}

function autoQueueFeedbackLine(state: GameState): string {
  const ec = state.estateCommission;
  if (!ec.autoQueueEnabled) return "托管反馈：自动队列未启用。";
  if (ec.autoQueueLastResult === "accepted") {
    return ec.autoQueueLastOfferTitle
      ? `托管反馈：已自动续单「${ec.autoQueueLastOfferTitle}」。`
      : "托管反馈：已自动续单。";
  }
  if (ec.autoQueueLastResult === "blocked_type") {
    return ec.autoQueueLastOfferType
      ? `托管反馈：未续单（策略限制，下一单为${ecTypeZh(ec.autoQueueLastOfferType)}）。`
      : "托管反馈：未续单（策略限制）。";
  }
  if (ec.autoQueueLastResult === "blocked_offer_missing") return "托管反馈：未续单（未生成下一单）。";
  return "托管反馈：等待当前委托结算后判定。";
}

function autoQueueRenewStatusLine(state: GameState): string {
  const ec = state.estateCommission;
  if (!ec.autoQueueEnabled) return "自动续单：已关闭";
  if (ec.autoQueueLastResult === "accepted") return "自动续单：最近一次已成功续接";
  if (ec.autoQueueLastResult === "blocked_type") return "自动续单：策略限制（同类型未命中）";
  if (ec.autoQueueLastResult === "blocked_offer_missing") return "自动续单：待生成下一单";
  return "自动续单：待当前委托结算后判定";
}

function autoQueueRenewIcon(state: GameState): string {
  const ec = state.estateCommission;
  if (!ec.autoQueueEnabled) return UI_ESTATE_COMMISSION_AUTO_RENEW_OFF;
  if (ec.autoQueueLastResult === "blocked_type") return UI_ESTATE_COMMISSION_AUTO_RENEW_OFF;
  return UI_ESTATE_COMMISSION_AUTO_RENEW_ON;
}

function autoQueueRenewBadgeClass(state: GameState): string {
  const ec = state.estateCommission;
  if (!ec.autoQueueEnabled || ec.autoQueueLastResult === "blocked_type") return "status-badge--pending";
  return "status-badge--ready";
}

export function renderEstateCommissionPanel(
  state: GameState,
  now: number,
  fmtOfflineDurationSec: (sec: number) => string,
): string {
  const ec = state.estateCommission;
  const ecActive = ec.active;
  const ecOffer = ec.offer;
  const ecReady = !!(ecActive && ecActive.completedAtMs != null);
  const ecRemainSec = Math.ceil(estateCommissionTimeLeftMs(state, now) / 1000);
  const ecRefresh = getEstateCommissionRefreshStatus(state, now);
  const ecStreak = getEstateCommissionStreakPreview(state);
  const ecRefreshReason =
    ecRefresh.reason === "active"
      ? "活动中不可刷新"
      : ecRefresh.reason === "cooldown"
        ? `冷却中（约 ${Math.ceil(ecRefresh.cooldownLeftMs / 1000)} 息）`
        : ecRefresh.reason === "insufficient_stones"
          ? `灵石不足（需 ${fmtDecimal(new Decimal(ecRefresh.costStones))}）`
          : ecRefresh.reason === "limit_reached"
            ? "本轮刷新次数已用尽"
            : `可刷新（消耗 ${fmtDecimal(new Decimal(ecRefresh.costStones))} 灵石）`;
  const commissionIconByType: Record<string, string> = {
    resource: UI_ESTATE_COMMISSION_RESOURCE,
    combat: UI_ESTATE_COMMISSION_COMBAT,
    cultivation: UI_ESTATE_COMMISSION_CULTIVATION,
  };
  const ecFocusType = ecActive?.offer.type ?? ecOffer?.type ?? "resource";
  const ecFocusIcon = commissionIconByType[ecFocusType] ?? UI_ESTATE_COMMISSION_RESOURCE;
  return `<section class="panel estate-commission-panel">
      <div class="panel-title-art-row panel-title-art-row--sub">
        <img class="panel-title-art-icon" src="${ecFocusIcon}" alt="" width="24" height="24" loading="lazy" />
        <h2>洞府委托</h2>
      </div>
      <p class="hint sm">当前仅可同时进行 1 个委托。离线归来会按时长自动判定完成，可直接结算。</p>
      <label class="estate-commission-auto-settle-row">
        <input type="checkbox" id="chk-estate-auto-settle" data-ui-pref="autoSettleEstateCommission" ${state.uiPrefs.autoSettleEstateCommission ? "checked" : ""} />
        <img class="estate-commission-auto-settle-ico" src="${UI_ESTATE_COMMISSION_AUTO_SETTLE}" alt="" width="18" height="18" loading="lazy" />
        <span class="estate-commission-auto-settle-text">委托到期可自动结算领奖（无需开启托管连签）</span>
      </label>
      <div class="estate-commission-streak-row">
        <span class="estate-commission-pill">
          <img src="${UI_ESTATE_COMMISSION_STREAK}" alt="" width="16" height="16" loading="lazy" />
          当前连携 +${(ecStreak.bonusRate * 100).toFixed(0)}%（连续 ${ecStreak.streak} 次）
        </span>
        <span class="estate-commission-pill">
          <img src="${UI_WEEKLY_BOUNTY_STATE_SYNC}" alt="" width="16" height="16" loading="lazy" />
          ${
            ecStreak.nextThreshold == null
              ? "已达连携高阶阈值"
              : `下一档 ${ecStreak.nextThreshold} 连携（再成功 ${ecStreak.toNextThreshold} 次）`
          }
        </span>
      </div>
      <p class="hint sm estate-commission-spec-line" id="estate-commission-spec-line">${
        ecStreak.specializationType
          ? `专精路径：${ecTypeZh(ecStreak.specializationType)}（同类型额外 +${(ecStreak.specializationRate * 100).toFixed(0)}%）`
          : "专精路径：未锁定（连续完成同类型委托可建立专精）"
      }</p>
      <div class="estate-commission-auto-row">
        <button
          class="btn estate-commission-auto-toggle ${ec.autoQueueEnabled ? "btn-primary" : ""}"
          type="button"
          data-estate-commission-auto-toggle="${ec.autoQueueEnabled ? "0" : "1"}"
        >
          <img src="${ec.autoQueueEnabled ? UI_ESTATE_COMMISSION_AUTO_QUEUE_ON : UI_ESTATE_COMMISSION_AUTO_QUEUE_OFF}" alt="" width="14" height="14" loading="lazy" />
          托管连签：${ec.autoQueueEnabled ? "已开启" : "已关闭"}
        </button>
        <div class="estate-commission-auto-strategy">
          <button
            class="btn estate-commission-auto-strategy-btn ${ec.autoQueueStrategy === "same-type" ? "btn-primary" : ""}"
            type="button"
            data-estate-commission-auto-strategy="same-type"
            ${ec.autoQueueEnabled ? "" : "disabled"}
          >
            <img src="${UI_ESTATE_COMMISSION_AUTO_STRATEGY_SAME}" alt="" width="14" height="14" loading="lazy" />
            同类型
          </button>
          <button
            class="btn estate-commission-auto-strategy-btn ${ec.autoQueueStrategy === "any-type" ? "btn-primary" : ""}"
            type="button"
            data-estate-commission-auto-strategy="any-type"
            ${ec.autoQueueEnabled ? "" : "disabled"}
          >
            <img src="${UI_ESTATE_COMMISSION_AUTO_STRATEGY_ANY}" alt="" width="14" height="14" loading="lazy" />
            任意类型
          </button>
        </div>
      </div>
      <p class="hint sm estate-commission-auto-tip" id="estate-commission-auto-tip">${
        ec.autoQueueEnabled
          ? ec.autoQueueStrategy === "same-type"
            ? "托管已开启：仅在下一单与本次完成类型一致时自动接取。"
            : "托管已开启：结算后将自动接取下一单（不限类型）。"
          : "托管已关闭：结算后需手动接取下一单。"
      }</p>
      <div class="estate-commission-auto-state-strip" data-estate-auto-state="${ec.autoQueueEnabled ? "enabled" : "disabled"}">
        <span class="status-badge ${ec.autoQueueEnabled ? "status-badge--ready" : "status-badge--pending"}" id="estate-commission-auto-open-state">
          <img src="${ec.autoQueueEnabled ? UI_ESTATE_COMMISSION_AUTO_QUEUE_ON : UI_ESTATE_COMMISSION_AUTO_QUEUE_OFF}" alt="" width="14" height="14" loading="lazy" />
          托管：${ec.autoQueueEnabled ? "已开启" : "已关闭"}
        </span>
        <span class="status-badge ${autoQueueRenewBadgeClass(state)}" id="estate-commission-auto-renew-state">
          <img src="${autoQueueRenewIcon(state)}" alt="" width="14" height="14" loading="lazy" />
          ${autoQueueRenewStatusLine(state)}
        </span>
      </div>
      <div class="estate-commission-auto-info-block">
        <p class="hint sm estate-commission-auto-policy" id="estate-commission-auto-policy">
          <img src="${UI_ESTATE_COMMISSION_AUTO_FEEDBACK}" alt="" width="14" height="14" loading="lazy" />
          ${autoQueuePolicyLine(state)}
        </p>
        <p class="hint sm estate-commission-auto-next" id="estate-commission-auto-next">
          <img src="${UI_ESTATE_COMMISSION_AUTO_NEXT}" alt="" width="14" height="14" loading="lazy" />
          ${autoQueueNextLine(state)}
        </p>
        <p class="hint sm estate-commission-auto-feedback" id="estate-commission-auto-feedback">
          <img src="${UI_ESTATE_COMMISSION_AUTO_FEEDBACK}" alt="" width="14" height="14" loading="lazy" />
          ${autoQueueFeedbackLine(state)}
        </p>
      </div>
      ${
        ecActive
          ? `<div class="estate-commission-card ${ecReady ? "is-ready" : ""}">
              <div class="estate-commission-card-head">
                <strong>${ecActive.offer.title}</strong>
                <span id="estate-commission-status" class="status-badge ${ecReady ? "status-badge--ready" : "status-badge--pending"}">${
                  ecReady ? "已完成" : "进行中"
                }</span>
              </div>
              <p class="hint sm">${ecActive.offer.desc}</p>
              <p class="hint sm" id="estate-commission-timer">类型：${ecTypeZh(ecActive.offer.type)} · ${
                ecReady ? "可立即结算" : `剩余约 ${fmtOfflineDurationSec(ecRemainSec)}`
              }</p>
              <p class="hint sm">奖励：灵石 ${fmtDecimal(new Decimal(ecActive.offer.reward.spiritStones))} · 唤灵髓 +${ecActive.offer.reward.summonEssence} · 筑灵髓 +${ecActive.offer.reward.zhuLingEssence}</p>
              <div class="btn-row">
                <button id="btn-estate-commission-settle" class="btn btn-primary" type="button" data-estate-commission-settle="1" ${ecReady ? "" : "disabled"}>完成结算</button>
                <button class="btn" type="button" data-estate-commission-abandon="1">放弃委托</button>
              </div>
            </div>`
          : ecOffer
            ? `<div class="estate-commission-card">
                <div class="estate-commission-card-head">
                  <strong>${ecOffer.title}</strong>
                  <span class="status-badge status-badge--info">待接取</span>
                </div>
                <p class="hint sm">${ecOffer.desc}</p>
                <p class="hint sm">类型：${ecTypeZh(ecOffer.type)} · 时长 ${fmtOfflineDurationSec(ecOffer.durationSec)}</p>
                <p class="hint sm">奖励：灵石 ${fmtDecimal(new Decimal(ecOffer.reward.spiritStones))} · 唤灵髓 +${ecOffer.reward.summonEssence} · 筑灵髓 +${ecOffer.reward.zhuLingEssence}</p>
                <p class="hint sm estate-commission-refresh-line" id="estate-commission-refresh-line">
                  <img src="${ecRefresh.reason === "none" || ecRefresh.reason === "cooldown" ? UI_ESTATE_COMMISSION_REFRESH_COOLDOWN : UI_ESTATE_COMMISSION_REFRESH_BLOCKED}" alt="" width="14" height="14" loading="lazy" />
                  ${ecRefreshReason} · 已用 ${ecRefresh.refreshUsed}/${ecRefresh.refreshLimit}
                </p>
                <div class="btn-row">
                  <button class="btn btn-primary" type="button" data-estate-commission-accept="1">接取委托</button>
                  <button class="btn" type="button" data-estate-commission-refresh="1" ${ecRefresh.canRefresh ? "" : "disabled"}>刷新委托</button>
                </div>
              </div>`
            : `<p class="hint sm">暂无可接委托，稍后可刷新。</p>`
      }
    </section>`;
}

export function updateEstateCommissionPanelReadouts(
  state: GameState,
  now: number,
  fmtOfflineDurationSec: (sec: number) => string,
): void {
  const ecActive = state.estateCommission.active;
  const statusEl = document.getElementById("estate-commission-status");
  const timerEl = document.getElementById("estate-commission-timer");
  const specLineEl = document.getElementById("estate-commission-spec-line");
  const refreshLineEl = document.getElementById("estate-commission-refresh-line");
  const settleBtn = document.getElementById("btn-estate-commission-settle") as HTMLButtonElement | null;
  const autoTipEl = document.getElementById("estate-commission-auto-tip");
  const autoPolicyEl = document.getElementById("estate-commission-auto-policy");
  const autoNextEl = document.getElementById("estate-commission-auto-next");
  const autoFeedbackEl = document.getElementById("estate-commission-auto-feedback");
  const autoOpenStateEl = document.getElementById("estate-commission-auto-open-state");
  const autoRenewStateEl = document.getElementById("estate-commission-auto-renew-state");
  const autoSettleChk = document.getElementById("chk-estate-auto-settle") as HTMLInputElement | null;
  if (autoSettleChk) autoSettleChk.checked = state.uiPrefs.autoSettleEstateCommission;
  const streak = getEstateCommissionStreakPreview(state);
  if (specLineEl) {
    specLineEl.textContent = streak.specializationType
      ? `专精路径：${ecTypeZh(streak.specializationType)}（同类型额外 +${(streak.specializationRate * 100).toFixed(0)}%）`
      : "专精路径：未锁定（连续完成同类型委托可建立专精）";
  }
  if (refreshLineEl) {
    const st = getEstateCommissionRefreshStatus(state, now);
    const tip =
      st.reason === "active"
        ? "活动中不可刷新"
        : st.reason === "cooldown"
          ? `冷却中（约 ${Math.ceil(st.cooldownLeftMs / 1000)} 息）`
          : st.reason === "insufficient_stones"
            ? `灵石不足（需 ${fmtDecimal(new Decimal(st.costStones))}）`
            : st.reason === "limit_reached"
              ? "本轮刷新次数已用尽"
              : `可刷新（消耗 ${fmtDecimal(new Decimal(st.costStones))} 灵石）`;
    refreshLineEl.textContent = `${tip} · 已用 ${st.refreshUsed}/${st.refreshLimit}`;
  }
  if (ecActive && statusEl && timerEl) {
    const ready = ecActive.completedAtMs != null;
    statusEl.textContent = ready ? "已完成" : "进行中";
    statusEl.classList.toggle("status-badge--ready", ready);
    statusEl.classList.toggle("status-badge--pending", !ready);
    const leftSec = Math.ceil(estateCommissionTimeLeftMs(state, now) / 1000);
    timerEl.textContent = `类型：${ecTypeZh(ecActive.offer.type)} · ${ready ? "可立即结算" : `剩余约 ${fmtOfflineDurationSec(leftSec)}`}`;
    if (settleBtn) settleBtn.disabled = !ready;
  }
  if (autoTipEl) {
    const ec = state.estateCommission;
    autoTipEl.textContent = ec.autoQueueEnabled
      ? ec.autoQueueStrategy === "same-type"
        ? "托管已开启：仅在下一单与本次完成类型一致时自动接取。"
        : "托管已开启：结算后将自动接取下一单（不限类型）。"
      : "托管已关闭：结算后需手动接取下一单。";
  }
  if (autoPolicyEl) {
    autoPolicyEl.innerHTML =
      `<img src="${UI_ESTATE_COMMISSION_AUTO_FEEDBACK}" alt="" width="14" height="14" loading="lazy" />` +
      autoQueuePolicyLine(state);
  }
  if (autoNextEl) {
    autoNextEl.innerHTML =
      `<img src="${UI_ESTATE_COMMISSION_AUTO_NEXT}" alt="" width="14" height="14" loading="lazy" />` +
      autoQueueNextLine(state);
  }
  if (autoFeedbackEl) {
    autoFeedbackEl.innerHTML =
      `<img src="${UI_ESTATE_COMMISSION_AUTO_FEEDBACK}" alt="" width="14" height="14" loading="lazy" />` +
      autoQueueFeedbackLine(state);
  }
  if (autoOpenStateEl) {
    autoOpenStateEl.classList.toggle("status-badge--ready", state.estateCommission.autoQueueEnabled);
    autoOpenStateEl.classList.toggle("status-badge--pending", !state.estateCommission.autoQueueEnabled);
    autoOpenStateEl.innerHTML =
      `<img src="${state.estateCommission.autoQueueEnabled ? UI_ESTATE_COMMISSION_AUTO_QUEUE_ON : UI_ESTATE_COMMISSION_AUTO_QUEUE_OFF}" alt="" width="14" height="14" loading="lazy" />` +
      `托管：${state.estateCommission.autoQueueEnabled ? "已开启" : "已关闭"}`;
  }
  if (autoRenewStateEl) {
    const ready = autoQueueRenewBadgeClass(state) === "status-badge--ready";
    autoRenewStateEl.classList.toggle("status-badge--ready", ready);
    autoRenewStateEl.classList.toggle("status-badge--pending", !ready);
    autoRenewStateEl.innerHTML =
      `<img src="${autoQueueRenewIcon(state)}" alt="" width="14" height="14" loading="lazy" />` +
      autoQueueRenewStatusLine(state);
  }
}
