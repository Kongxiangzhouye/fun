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
} from "./visualAssets";

function rerollHint(state: GameState): string {
  const pending = state.offlineAdventure.pending;
  if (!pending) return "当前无可重掷奇遇。";
  if (pending.rerolled) return "本轮奇遇已重掷，重掷机会已消耗。";
  return `可消耗 ${fmtDecimal(new Decimal(pending.rerollCostStones || "0"))} 灵石重掷一次。`;
}

export function renderOfflineAdventurePanel(
  state: GameState,
  now: number,
  offlineBoostRenewRuleText: () => string,
  offlineResonanceTypeZh: (type: "instant" | "boost" | "essence" | null) => string,
): string {
  const oaPending = state.offlineAdventure.pending;
  const oaBoostLeftMs = offlineAdventureBoostLeftMs(state, now);
  const oaBoostMul = offlineAdventureBoostMult(state, now);
  const oaInstantPreview = previewOfflineAdventureResonance(state, "instant");
  const oaBoostPreview = previewOfflineAdventureResonance(state, "boost");
  const oaEssencePreview = previewOfflineAdventureResonance(state, "essence");
  const oaResType = state.offlineAdventure.resonanceType;
  const oaResStacks = state.offlineAdventure.resonanceStacks;
  const oaResLine =
    oaResType && oaResStacks > 0
      ? `当前连选：${offlineResonanceTypeZh(oaResType)}（${oaResStacks} 层） · ${describeOfflineAdventureResonanceRule(oaResType, oaResStacks)}`
      : "当前连选：无（首次选择将从 1 层起步）";
  const oaBoostTag =
    oaBoostLeftMs > 0 ? `当前增益 ×${oaBoostMul.toFixed(2)}（剩余约 ${Math.ceil(oaBoostLeftMs / 60000)} 分）` : "当前无挂机增益";
  const rerollCost = oaPending?.rerollCostStones || "0";
  const canReroll = !!oaPending && !oaPending.rerolled;
  const rerollIcon = canReroll ? UI_OFFLINE_REROLL_READY : UI_OFFLINE_REROLL_LOCKED;
  return `<section class="panel offline-event-panel">
      <div class="panel-title-art-row panel-title-art-row--sub">
        <img class="panel-title-art-icon" src="${UI_OFFLINE_SUMMARY_BADGE}" alt="" width="24" height="24" loading="lazy" />
        <h2>离线奇遇三选一</h2>
      </div>
      <p class="hint sm" id="offline-panel-summary">离线达阈值会生成三选一；灵脉/髓潮奖励立即到账，静修增益在持续时间后自动失效。${oaBoostTag}</p>
      <p class="hint sm offline-resonance-line" id="offline-resonance-line">
        <img src="${UI_OFFLINE_RESONANCE_CHAIN}" alt="" width="14" height="14" loading="lazy" />
        <span>${oaResLine}</span>
      </p>
      <p class="hint sm offline-boost-rule-line" id="offline-boost-rule-line">${offlineBoostRenewRuleText()}</p>
      <div class="offline-reroll-row">
        <span class="hint sm offline-reroll-hint" id="offline-reroll-hint">
          <img src="${UI_OFFLINE_REROLL_COST}" alt="" width="14" height="14" loading="lazy" />
          ${rerollHint(state)}
        </span>
        <button class="btn ${canReroll ? "btn-primary" : ""}" type="button" data-offline-reroll="1" ${canReroll ? "" : "disabled"}>
          <img src="${UI_OFFLINE_REROLL}" alt="" width="14" height="14" loading="lazy" />
          重掷一次（耗 ${fmtDecimal(new Decimal(rerollCost))}）
          <img src="${rerollIcon}" alt="" width="14" height="14" loading="lazy" />
        </button>
      </div>
      <div class="offline-choice-tabs" role="tablist" aria-label="离线奇遇选项">
        <button type="button" class="offline-choice-tab is-active" aria-selected="true">${oaPending ? "可结算" : "待触发"}</button>
        <button type="button" class="offline-choice-tab" aria-selected="false">${oaBoostLeftMs > 0 ? "增益生效中" : "增益未激活"}</button>
      </div>
      <div class="offline-choice-grid">
        <article class="offline-choice-card ${oaPending ? "is-recommended" : ""}">
          <div class="offline-choice-head">
            <span class="status-badge status-badge--ready">
              <img src="${UI_OFFLINE_EVENT_OPTION_SAFE}" alt="" width="14" height="14" loading="lazy" />
              ${oaPending ? oaPending.options[0].title : "稳态回收"}
            </span>
            <span class="recommend-tag">${oaPending ? "可选" : "等待离线奇遇"}</span>
          </div>
          <p class="hint sm">${
            oaPending
              ? `即时获得 ${fmtDecimal(new Decimal(oaPending.options[0].instantStones))} 灵石 + ${oaPending.options[0].instantEssence} 唤灵髓。`
              : "离线达到阈值后可选择立即资源奖励。"
          }</p>
          <p class="hint sm offline-resonance-preview">
            <img src="${UI_OFFLINE_RESONANCE_INSTANT}" alt="" width="14" height="14" loading="lazy" />
            <span>${oaInstantPreview.summary}</span>
          </p>
          <button class="btn btn-primary" type="button" data-offline-choice="instant" ${oaPending ? "" : "disabled"}>选择本项</button>
        </article>
        <article class="offline-choice-card">
          <div class="offline-choice-head">
            <span class="status-badge status-badge--risk">
              <img src="${UI_OFFLINE_EVENT_OPTION_RISK}" alt="" width="14" height="14" loading="lazy" />
              ${oaPending ? oaPending.options[1].title : "静修余韵"}
            </span>
            <span class="status-badge ${oaBoostLeftMs > 0 ? "status-badge--ready" : "status-badge--pending"}">${
              oaBoostLeftMs > 0 ? "生效中" : "可触发"
            }</span>
          </div>
          <p class="hint sm">${
            oaPending
              ? `挂机收益 ×${oaPending.options[1].boostMult.toFixed(2)}，持续 ${Math.ceil(oaPending.options[1].boostDurationSec / 60)} 分钟。`
              : "离线达到阈值后可选择限时挂机增益。"
          }</p>
          <p class="hint sm offline-resonance-preview">
            <img src="${UI_OFFLINE_RESONANCE_BOOST}" alt="" width="14" height="14" loading="lazy" />
            <span>${oaBoostPreview.summary}</span>
          </p>
          <button class="btn" type="button" data-offline-choice="boost" ${oaPending ? "" : "disabled"}>选择本项</button>
        </article>
        <article class="offline-choice-card">
          <div class="offline-choice-head">
            <span class="status-badge status-badge--ready">
              <img src="${UI_OFFLINE_EVENT_OPTION_ESSENCE}" alt="" width="14" height="14" loading="lazy" />
              ${oaPending ? oaPending.options[2].title : "髓潮归元"}
            </span>
            <span class="recommend-tag">髓潮</span>
          </div>
          <p class="hint sm">${
            oaPending
              ? `唤灵髓 +${oaPending.options[2].instantEssence}，筑灵髓 +${oaPending.options[2].zhuLingBonus ?? 0}（无灵石、无挂机增益）。`
              : "离线达到阈值后可选择双髓补给。"
          }</p>
          <p class="hint sm offline-resonance-preview">
            <img src="${UI_OFFLINE_RESONANCE_ESSENCE}" alt="" width="14" height="14" loading="lazy" />
            <span>${oaEssencePreview.summary}</span>
          </p>
          <button class="btn" type="button" data-offline-choice="essence" ${oaPending ? "" : "disabled"}>选择本项</button>
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
  const oaPending = state.offlineAdventure.pending;
  const oaBoostLeftMs = offlineAdventureBoostLeftMs(state, now);
  const oaBoostMul = offlineAdventureBoostMult(state, now);
  const oaInstantPreview = previewOfflineAdventureResonance(state, "instant");
  const oaBoostPreview = previewOfflineAdventureResonance(state, "boost");
  const oaEssencePreview = previewOfflineAdventureResonance(state, "essence");
  const oaResType = state.offlineAdventure.resonanceType;
  const oaResStacks = state.offlineAdventure.resonanceStacks;
  const tabs = document.querySelectorAll(".offline-choice-tab");
  if (tabs[0]) tabs[0].textContent = oaPending ? "可结算" : "待触发";
  if (tabs[1]) tabs[1].textContent = oaBoostLeftMs > 0 ? "增益生效中" : "增益未激活";
  const btnInstant = document.querySelector("[data-offline-choice='instant']") as HTMLButtonElement | null;
  const btnBoost = document.querySelector("[data-offline-choice='boost']") as HTMLButtonElement | null;
  const btnEssence = document.querySelector("[data-offline-choice='essence']") as HTMLButtonElement | null;
  if (btnInstant) btnInstant.disabled = !oaPending;
  if (btnBoost) btnBoost.disabled = !oaPending;
  if (btnEssence) btnEssence.disabled = !oaPending;
  const rerollBtn = document.querySelector("[data-offline-reroll='1']") as HTMLButtonElement | null;
  if (rerollBtn) {
    rerollBtn.disabled = !oaPending || !!oaPending.rerolled;
    rerollBtn.className = `btn ${oaPending && !oaPending.rerolled ? "btn-primary" : ""}`;
    rerollBtn.innerHTML =
      `<img src="${UI_OFFLINE_REROLL}" alt="" width="14" height="14" loading="lazy" />` +
      `重掷一次（耗 ${fmtDecimal(new Decimal(oaPending?.rerollCostStones || "0"))}）` +
      `<img src="${oaPending && !oaPending.rerolled ? UI_OFFLINE_REROLL_READY : UI_OFFLINE_REROLL_LOCKED}" alt="" width="14" height="14" loading="lazy" />`;
  }
  const rerollHintEl = document.getElementById("offline-reroll-hint");
  if (rerollHintEl) {
    rerollHintEl.innerHTML =
      `<img src="${UI_OFFLINE_REROLL_COST}" alt="" width="14" height="14" loading="lazy" />` +
      rerollHint(state);
  }
  const cards = document.querySelectorAll(".offline-choice-card");
  const card1Desc = cards[0]?.querySelector(".hint.sm");
  const card2Desc = cards[1]?.querySelector(".hint.sm");
  const card3Desc = cards[2]?.querySelector(".hint.sm");
  const card1Res = cards[0]?.querySelector(".offline-resonance-preview");
  const card2Res = cards[1]?.querySelector(".offline-resonance-preview");
  const card3Res = cards[2]?.querySelector(".offline-resonance-preview");
  if (card1Desc) {
    card1Desc.textContent = oaPending
      ? `即时获得 ${fmtDecimal(new Decimal(oaPending.options[0].instantStones))} 灵石 + ${oaPending.options[0].instantEssence} 唤灵髓。`
      : "离线达到阈值后可选择立即资源奖励。";
  }
  if (card2Desc) {
    card2Desc.textContent = oaPending
      ? `挂机收益 ×${oaPending.options[1].boostMult.toFixed(2)}，持续 ${Math.ceil(oaPending.options[1].boostDurationSec / 60)} 分钟。`
      : "离线达到阈值后可选择限时挂机增益。";
  }
  if (card3Desc) {
    card3Desc.textContent = oaPending
      ? `唤灵髓 +${oaPending.options[2].instantEssence}，筑灵髓 +${oaPending.options[2].zhuLingBonus ?? 0}（无灵石、无挂机增益）。`
      : "离线达到阈值后可选择双髓补给。";
  }
  const card1ResText = card1Res?.querySelector("span");
  const card2ResText = card2Res?.querySelector("span");
  const card3ResText = card3Res?.querySelector("span");
  if (card1ResText) card1ResText.textContent = oaInstantPreview.summary;
  if (card2ResText) card2ResText.textContent = oaBoostPreview.summary;
  if (card3ResText) card3ResText.textContent = oaEssencePreview.summary;
  const panelHint = document.getElementById("offline-panel-summary");
  if (panelHint) {
    panelHint.textContent =
      `离线达阈值会生成三选一；灵脉/髓潮奖励立即到账，静修增益在持续时间后自动失效。` +
      (oaBoostLeftMs > 0
        ? `当前增益 ×${oaBoostMul.toFixed(2)}（剩余约 ${Math.ceil(oaBoostLeftMs / 60000)} 分）`
        : "当前无挂机增益");
  }
  const resonanceLine = document.getElementById("offline-resonance-line");
  if (resonanceLine) {
    const t = resonanceLine.querySelector("span");
    if (t) {
      t.textContent =
        oaResType && oaResStacks > 0
          ? `当前连选：${offlineResonanceTypeZh(oaResType)}（${oaResStacks} 层） · ${describeOfflineAdventureResonanceRule(oaResType, oaResStacks)}`
          : "当前连选：无（首次选择将从 1 层起步）";
    }
  }
  const boostRuleLine = document.getElementById("offline-boost-rule-line");
  if (boostRuleLine) boostRuleLine.textContent = offlineBoostRenewRuleText();
}
