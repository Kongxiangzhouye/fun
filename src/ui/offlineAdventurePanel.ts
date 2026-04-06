import Decimal from "decimal.js";
import type { GameState } from "../types";
import { fmtDecimal } from "../stones";
import {
  describeOfflineAdventureResonanceRule,
  offlineAdventureBoostLeftMs,
  offlineAdventureBoostMult,
  previewOfflineAdventureResonance,
} from "../systems/offlineAdventure";
import {
  UI_OFFLINE_SUMMARY_BADGE,
  UI_OFFLINE_RESONANCE_CHAIN,
  UI_OFFLINE_RESONANCE_INSTANT,
  UI_OFFLINE_RESONANCE_BOOST,
  UI_OFFLINE_RESONANCE_ESSENCE,
  UI_OFFLINE_EVENT_OPTION_SAFE,
  UI_OFFLINE_EVENT_OPTION_RISK,
  UI_OFFLINE_EVENT_OPTION_ESSENCE,
  UI_OFFLINE_REROLL,
  UI_OFFLINE_REROLL_READY,
  UI_OFFLINE_REROLL_LOCKED,
  UI_OFFLINE_REROLL_COST,
  UI_OFFLINE_READOUT_SYNC,
  UI_TIME_SEMANTIC_LIVE,
  UI_TIME_SEMANTIC_LOCKED,
} from "./visualAssets";

function rerollHint(state: GameState): string {
  const pending = state.offlineAdventure.pending;
  if (!pending) return "当前无可重掷奇遇。";
  if (pending.rerolled) return "本轮奇遇已重掷，重掷机会已消耗。";
  return `可消耗 ${fmtDecimal(new Decimal(pending.rerollCostStones || "0"))} 灵石重掷一次。`;
}

interface OfflineAdventurePanelModel {
  pending: GameState["offlineAdventure"]["pending"];
  boostLeftMs: number;
  boostMul: number;
  resLine: string;
  boostTag: string;
  rerollCost: string;
  canReroll: boolean;
  rerollHintLine: string;
  rerollIcon: string;
  instantPreview: string;
  boostPreview: string;
  essencePreview: string;
  instantDesc: string;
  boostDesc: string;
  essenceDesc: string;
  tabReadyLabel: string;
  tabBoostLabel: string;
  timeSemanticIcon: string;
}

function buildOfflineAdventurePanelModel(
  state: GameState,
  now: number,
  offlineResonanceTypeZh: (type: "instant" | "boost" | "essence" | null) => string,
): OfflineAdventurePanelModel {
  const pending = state.offlineAdventure.pending;
  const boostLeftMs = offlineAdventureBoostLeftMs(state, now);
  const boostMul = offlineAdventureBoostMult(state, now);
  const instantPreview = previewOfflineAdventureResonance(state, "instant");
  const boostPreview = previewOfflineAdventureResonance(state, "boost");
  const essencePreview = previewOfflineAdventureResonance(state, "essence");
  const resType = state.offlineAdventure.resonanceType;
  const resStacks = state.offlineAdventure.resonanceStacks;
  const resLine =
    resType && resStacks > 0
      ? `当前连选：${offlineResonanceTypeZh(resType)}（${resStacks} 层） · ${describeOfflineAdventureResonanceRule(resType, resStacks)}`
      : "当前连选：无（首次选择将从 1 层起步）";
  const boostTag = boostLeftMs > 0 ? `当前增益 ×${boostMul.toFixed(2)}（剩余约 ${Math.ceil(boostLeftMs / 60000)} 分）` : "当前无挂机增益";
  const rerollCost = pending?.rerollCostStones || "0";
  const canReroll = !!pending && !pending.rerolled;
  const instantDesc = pending
    ? `即时获得 ${fmtDecimal(new Decimal(pending.options[0].instantStones))} 灵石 + ${pending.options[0].instantEssence} 唤灵髓。`
    : "离线达到阈值后可选择立即资源奖励。";
  const boostDesc = pending
    ? `挂机收益 ×${pending.options[1].boostMult.toFixed(2)}，持续 ${Math.ceil(pending.options[1].boostDurationSec / 60)} 分钟。`
    : "离线达到阈值后可选择限时挂机增益。";
  const essenceDesc = pending
    ? `唤灵髓 +${pending.options[2].instantEssence}，筑灵髓 +${pending.options[2].zhuLingBonus ?? 0}（无灵石、无挂机增益）。`
    : "离线达到阈值后可选择双髓补给。";
  return {
    pending,
    boostLeftMs,
    boostMul,
    resLine,
    boostTag,
    rerollCost,
    canReroll,
    rerollHintLine: rerollHint(state),
    rerollIcon: canReroll ? UI_OFFLINE_REROLL_READY : UI_OFFLINE_REROLL_LOCKED,
    instantPreview: instantPreview.summary,
    boostPreview: boostPreview.summary,
    essencePreview: essencePreview.summary,
    instantDesc,
    boostDesc,
    essenceDesc,
    tabReadyLabel: pending ? "可结算" : "待触发",
    tabBoostLabel: boostLeftMs > 0 ? "增益生效中" : "增益未激活",
    timeSemanticIcon: boostLeftMs > 0 ? UI_TIME_SEMANTIC_LIVE : UI_TIME_SEMANTIC_LOCKED,
  };
}

export function renderOfflineAdventurePanel(
  state: GameState,
  now: number,
  offlineBoostRenewRuleText: () => string,
  offlineResonanceTypeZh: (type: "instant" | "boost" | "essence" | null) => string,
): string {
  const vm = buildOfflineAdventurePanelModel(state, now, offlineResonanceTypeZh);
  return `<section class="panel offline-event-panel">
      <div class="panel-title-art-row panel-title-art-row--sub">
        <img class="panel-title-art-icon" src="${UI_OFFLINE_SUMMARY_BADGE}" alt="" width="24" height="24" loading="lazy" />
        <h2>离线奇遇三选一</h2>
      </div>
      <p class="hint sm offline-panel-summary" id="offline-panel-summary"><img src="${vm.timeSemanticIcon}" alt="" width="14" height="14" loading="lazy" />离线达阈值会生成三选一；灵脉/髓潮奖励立即到账，静修增益在持续时间后自动失效。${vm.boostTag}</p>
      <p class="hint sm offline-resonance-line" id="offline-resonance-line">
        <img src="${UI_OFFLINE_RESONANCE_CHAIN}" alt="" width="14" height="14" loading="lazy" />
        <span>${vm.resLine}</span>
      </p>
      <p class="hint sm offline-boost-rule-line" id="offline-boost-rule-line"><img src="${UI_OFFLINE_READOUT_SYNC}" alt="" width="14" height="14" loading="lazy" />${offlineBoostRenewRuleText()}</p>
      <div class="offline-reroll-row">
        <span class="hint sm offline-reroll-hint" id="offline-reroll-hint">
          <img src="${UI_OFFLINE_REROLL_COST}" alt="" width="14" height="14" loading="lazy" />
          ${vm.rerollHintLine}
        </span>
        <button class="btn ${vm.canReroll ? "btn-primary" : ""}" type="button" data-offline-reroll="1" ${vm.canReroll ? "" : "disabled"}>
          <img src="${UI_OFFLINE_REROLL}" alt="" width="14" height="14" loading="lazy" />
          重掷一次（耗 ${fmtDecimal(new Decimal(vm.rerollCost))}）
          <img src="${vm.rerollIcon}" alt="" width="14" height="14" loading="lazy" />
        </button>
      </div>
      <div class="offline-choice-tabs" role="tablist" aria-label="离线奇遇选项">
        <button type="button" class="offline-choice-tab is-active" aria-selected="true">${vm.tabReadyLabel}</button>
        <button type="button" class="offline-choice-tab" aria-selected="false">${vm.tabBoostLabel}</button>
      </div>
      <div class="offline-choice-grid">
        <article class="offline-choice-card ${vm.pending ? "is-recommended" : ""}">
          <div class="offline-choice-head">
            <span class="status-badge status-badge--ready">
              <img src="${UI_OFFLINE_EVENT_OPTION_SAFE}" alt="" width="14" height="14" loading="lazy" />
              ${vm.pending ? vm.pending.options[0].title : "稳态回收"}
            </span>
            <span class="recommend-tag">${vm.pending ? "可选" : "等待离线奇遇"}</span>
          </div>
          <p class="hint sm">${vm.instantDesc}</p>
          <p class="hint sm offline-resonance-preview">
            <img src="${UI_OFFLINE_RESONANCE_INSTANT}" alt="" width="14" height="14" loading="lazy" />
            <span>${vm.instantPreview}</span>
          </p>
          <button class="btn btn-primary" type="button" data-offline-choice="instant" ${vm.pending ? "" : "disabled"}>选择本项</button>
        </article>
        <article class="offline-choice-card">
          <div class="offline-choice-head">
            <span class="status-badge status-badge--risk">
              <img src="${UI_OFFLINE_EVENT_OPTION_RISK}" alt="" width="14" height="14" loading="lazy" />
              ${vm.pending ? vm.pending.options[1].title : "静修余韵"}
            </span>
            <span class="status-badge ${vm.boostLeftMs > 0 ? "status-badge--ready" : "status-badge--pending"}">${
              vm.boostLeftMs > 0 ? "生效中" : "可触发"
            }</span>
          </div>
          <p class="hint sm">${vm.boostDesc}</p>
          <p class="hint sm offline-resonance-preview">
            <img src="${UI_OFFLINE_RESONANCE_BOOST}" alt="" width="14" height="14" loading="lazy" />
            <span>${vm.boostPreview}</span>
          </p>
          <button class="btn" type="button" data-offline-choice="boost" ${vm.pending ? "" : "disabled"}>选择本项</button>
        </article>
        <article class="offline-choice-card">
          <div class="offline-choice-head">
            <span class="status-badge status-badge--ready">
              <img src="${UI_OFFLINE_EVENT_OPTION_ESSENCE}" alt="" width="14" height="14" loading="lazy" />
              ${vm.pending ? vm.pending.options[2].title : "髓潮归元"}
            </span>
            <span class="recommend-tag">髓潮</span>
          </div>
          <p class="hint sm">${vm.essenceDesc}</p>
          <p class="hint sm offline-resonance-preview">
            <img src="${UI_OFFLINE_RESONANCE_ESSENCE}" alt="" width="14" height="14" loading="lazy" />
            <span>${vm.essencePreview}</span>
          </p>
          <button class="btn" type="button" data-offline-choice="essence" ${vm.pending ? "" : "disabled"}>选择本项</button>
        </article>
      </div>
    </section>`;
}

export function updateOfflineAdventurePanelReadouts(
  state: GameState,
  now: number,
  offlineBoostRenewRuleText: () => string,
  offlineResonanceTypeZh: (type: "instant" | "boost" | "essence" | null) => string,
): void {
  const vm = buildOfflineAdventurePanelModel(state, now, offlineResonanceTypeZh);
  const tabs = document.querySelectorAll(".offline-choice-tab");
  if (tabs[0]) tabs[0].textContent = vm.tabReadyLabel;
  if (tabs[1]) tabs[1].textContent = vm.tabBoostLabel;
  const btnInstant = document.querySelector("[data-offline-choice='instant']") as HTMLButtonElement | null;
  const btnBoost = document.querySelector("[data-offline-choice='boost']") as HTMLButtonElement | null;
  const btnEssence = document.querySelector("[data-offline-choice='essence']") as HTMLButtonElement | null;
  if (btnInstant) btnInstant.disabled = !vm.pending;
  if (btnBoost) btnBoost.disabled = !vm.pending;
  if (btnEssence) btnEssence.disabled = !vm.pending;
  const rerollBtn = document.querySelector("[data-offline-reroll='1']") as HTMLButtonElement | null;
  if (rerollBtn) {
    rerollBtn.disabled = !vm.pending || !vm.canReroll;
    rerollBtn.className = `btn ${vm.canReroll ? "btn-primary" : ""}`;
    rerollBtn.innerHTML =
      `<img src="${UI_OFFLINE_REROLL}" alt="" width="14" height="14" loading="lazy" />` +
      `重掷一次（耗 ${fmtDecimal(new Decimal(vm.rerollCost))}）` +
      `<img src="${vm.rerollIcon}" alt="" width="14" height="14" loading="lazy" />`;
  }
  const rerollHintEl = document.getElementById("offline-reroll-hint");
  if (rerollHintEl) {
    rerollHintEl.innerHTML =
      `<img src="${UI_OFFLINE_REROLL_COST}" alt="" width="14" height="14" loading="lazy" />` +
      vm.rerollHintLine;
  }
  const cards = document.querySelectorAll(".offline-choice-card");
  const card1Desc = cards[0]?.querySelector(".hint.sm");
  const card2Desc = cards[1]?.querySelector(".hint.sm");
  const card3Desc = cards[2]?.querySelector(".hint.sm");
  const card1Res = cards[0]?.querySelector(".offline-resonance-preview");
  const card2Res = cards[1]?.querySelector(".offline-resonance-preview");
  const card3Res = cards[2]?.querySelector(".offline-resonance-preview");
  if (card1Desc) {
    card1Desc.textContent = vm.instantDesc;
  }
  if (card2Desc) {
    card2Desc.textContent = vm.boostDesc;
  }
  if (card3Desc) {
    card3Desc.textContent = vm.essenceDesc;
  }
  const card1ResText = card1Res?.querySelector("span");
  const card2ResText = card2Res?.querySelector("span");
  const card3ResText = card3Res?.querySelector("span");
  if (card1ResText) card1ResText.textContent = vm.instantPreview;
  if (card2ResText) card2ResText.textContent = vm.boostPreview;
  if (card3ResText) card3ResText.textContent = vm.essencePreview;
  const panelHint = document.getElementById("offline-panel-summary");
  if (panelHint) {
    panelHint.innerHTML =
      `<img src="${vm.timeSemanticIcon}" alt="" width="14" height="14" loading="lazy" />` +
      `离线达阈值会生成三选一；灵脉/髓潮奖励立即到账，静修增益在持续时间后自动失效。` +
      (vm.boostLeftMs > 0
        ? `当前增益 ×${vm.boostMul.toFixed(2)}（剩余约 ${Math.ceil(vm.boostLeftMs / 60000)} 分）`
        : "当前无挂机增益");
  }
  const resonanceLine = document.getElementById("offline-resonance-line");
  if (resonanceLine) {
    const t = resonanceLine.querySelector("span");
    if (t) {
      t.textContent = vm.resLine;
    }
  }
  const boostRuleLine = document.getElementById("offline-boost-rule-line");
  if (boostRuleLine) boostRuleLine.textContent = offlineBoostRenewRuleText();
}
