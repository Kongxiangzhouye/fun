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
  UI_OFFLINE_AUTO_STRATEGY_STEADY,
  UI_OFFLINE_AUTO_STRATEGY_BOOST,
  UI_OFFLINE_AUTO_STRATEGY_ESSENCE,
  UI_OFFLINE_AUTO_STRATEGY_SMART,
  UI_OFFLINE_AUTO_STRATEGY_STATUS,
  UI_OFFLINE_DECISION_GO,
  UI_OFFLINE_RESONANCE_NEXT_STACK,
  UI_OFFLINE_RESONANCE_NEXT_BONUS,
  UI_TIME_SEMANTIC_LIVE,
  UI_TIME_SEMANTIC_LOCKED,
  UI_OFFLINE_AUTO_REROLL_TOGGLE,
  UI_OFFLINE_AUTO_REROLL_BUDGET,
  UI_OFFLINE_PENDING_FALLBACK,
} from "./visualAssets";

function rerollHint(state: GameState): string {
  const pending = state.offlineAdventure.pending;
  if (!pending) return "当前无可重掷奇遇。";
  if (pending.rerolled) return "本轮奇遇已重掷，重掷机会已消耗。";
  return `可消耗 ${fmtDecimal(new Decimal(pending.rerollCostStones || "0"))} 灵石重掷一次。`;
}

function hasValidPendingOptions(pending: GameState["offlineAdventure"]["pending"]): boolean {
  if (!pending) return false;
  const options = pending.options as unknown;
  if (!Array.isArray(options) || options.length !== 3) return false;
  const expectedIds = ["instant", "boost", "essence"];
  return expectedIds.every((id, idx) => (options[idx] as { id?: string } | undefined)?.id === id);
}

interface OfflineAdventurePanelModel {
  pending: GameState["offlineAdventure"]["pending"];
  pendingVisualState: "ready" | "degraded" | "standby";
  pendingStatusLabel: string;
  pendingStatusClass: "status-badge--ready" | "status-badge--risk" | "status-badge--pending";
  pendingHintLine: string;
  boostLeftMs: number;
  boostMul: number;
  resLine: string;
  boostTag: string;
  rerollCost: string;
  canReroll: boolean;
  rerollHintLine: string;
  rerollIcon: string;
  autoRerollEnabled: boolean;
  autoRerollBudgetLabel: string;
  autoRerollBudgetValue: string;
  autoRerollStatusLine: string;
  autoRerollHintLine: string;
  instantPreview: string;
  boostPreview: string;
  essencePreview: string;
  instantDesc: string;
  boostDesc: string;
  essenceDesc: string;
  tabReadyLabel: string;
  tabBoostLabel: string;
  timeSemanticIcon: string;
  nextInstantLine: string;
  nextBoostLine: string;
  nextEssenceLine: string;
  autoPolicyLabel: string;
  autoStatusLabel: string;
  autoStatusClass: "status-badge--ready" | "status-badge--pending";
  autoTipLine: string;
  autoPolicyEnabled: boolean;
  autoPolicy: "steady" | "boost" | "essence" | "smart";
  choiceInstantTitle: string;
  choiceBoostTitle: string;
  choiceEssenceTitle: string;
  choiceInstantTag: string;
  choiceBoostTag: string;
  choiceEssenceTag: string;
  decisionState: "ready" | "standby";
  decisionTitle: string;
  decisionLine: string;
  decisionGoLabel: string;
  decisionIcon: string;
  decisionGo: "offline-adventure" | "battle-dungeon" | "estate-idle";
  decisionGoHub: "estate" | "battle";
  decisionGoSub: "idle" | "dungeon";
  decisionGoTarget: string;
}

function autoPolicyLabelZh(policy: "steady" | "boost" | "essence" | "smart"): string {
  if (policy === "boost") return "增益优先";
  if (policy === "essence") return "髓潮优先";
  if (policy === "smart") return "智能策略";
  return "稳态优先";
}

function pendingVisualMeta(
  mode: "ready" | "degraded" | "standby",
): {
  label: string;
  klass: "status-badge--ready" | "status-badge--risk" | "status-badge--pending";
  hint: string;
} {
  if (mode === "ready") {
    return {
      label: "奇遇待处理",
      klass: "status-badge--ready",
      hint: "已生成离线奇遇，可在本面板手动处理或交由自动策略处理。",
    };
  }
  if (mode === "degraded") {
    return {
      label: "异常待降级",
      klass: "status-badge--risk",
      hint: "检测到异常 pending 快照，已切换为安全降级展示；可稍后刷新或继续其它玩法。",
    };
  }
  return {
    label: "等待触发",
    klass: "status-badge--pending",
    hint: "当前无待结算奇遇，达到离线阈值后将生成三选一。",
  };
}

function buildOfflineAdventurePanelModel(
  state: GameState,
  now: number,
  offlineResonanceTypeZh: (type: "instant" | "boost" | "essence" | null) => string,
): OfflineAdventurePanelModel {
  const rawPending = state.offlineAdventure.pending;
  const pendingValid = hasValidPendingOptions(rawPending);
  const pending = pendingValid ? rawPending : null;
  const pendingVisualState: "ready" | "degraded" | "standby" = rawPending
    ? pendingValid
      ? "ready"
      : "degraded"
    : "standby";
  const pendingMeta = pendingVisualMeta(pendingVisualState);
  const pendingStatusLabel = pendingMeta.label;
  const pendingStatusClass = pendingMeta.klass;
  const pendingHintLine = pendingMeta.hint;
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
  const autoPolicyEnabled = !!state.offlineAdventure.autoPolicyEnabled;
  const autoPolicy =
    state.offlineAdventure.autoPolicy === "boost" ||
    state.offlineAdventure.autoPolicy === "essence" ||
    state.offlineAdventure.autoPolicy === "smart"
      ? state.offlineAdventure.autoPolicy
      : "steady";
  const autoPolicyLabel = `自动结算：${autoPolicyEnabled ? "开启" : "关闭"} · 当前策略：${
    autoPolicyLabelZh(autoPolicy)
  }`;
  const autoStatusLabel = autoPolicyEnabled ? (pending ? "自动结算待执行" : "自动结算待命") : "自动结算关闭";
  const autoStatusClass: "status-badge--ready" | "status-badge--pending" =
    autoPolicyEnabled && pending ? "status-badge--ready" : "status-badge--pending";
  const autoTipLine = autoPolicyEnabled
    ? pending
      ? "检测到待结算奇遇，将按当前策略自动结算。"
      : "当前无待结算奇遇，下一次离线触发后将自动结算。"
    : "点击下方策略按钮可开启自动结算；再次点击当前策略可关闭。";
  const autoRerollEnabled = !!state.offlineAdventure.autoRerollEnabled;
  const autoRerollBudgetValue = state.offlineAdventure.autoRerollBudgetStones || "0";
  const autoRerollBudgetLabel = `预算上限：${fmtDecimal(new Decimal(autoRerollBudgetValue || "0"))} 灵石`;
  const autoRerollStatusLine = autoRerollEnabled ? "自动重掷开启" : "自动重掷关闭";
  const autoRerollHintLine = pending
    ? pending.rerolled
      ? "当前 pending 已重掷过一次；本轮不再自动重掷。"
      : `本轮重掷成本 ${fmtDecimal(new Decimal(rerollCost))}，仅在不超预算时自动重掷。`
    : "等待离线奇遇后自动按预算判定是否重掷。";
  const choiceInstantTitle = pending ? pending.options[0].title : "稳态回收";
  const choiceBoostTitle = pending ? pending.options[1].title : "静修余韵";
  const choiceEssenceTitle = pending ? pending.options[2].title : "髓潮归元";
  const choiceInstantTag = pending ? "可选" : "等待离线奇遇";
  const choiceBoostTag = boostLeftMs > 0 ? "生效中" : "可触发";
  const choiceEssenceTag = pending ? "髓潮可领" : "髓潮待命";
  let decisionState: "ready" | "standby" = "standby";
  let decisionTitle = "推荐动作：等待下一次离线奇遇";
  let decisionLine = "当前无待结算奇遇，达到离线阈值后此处将更新推荐动作。";
  let decisionGoLabel = "前往离线奇遇";
  let decisionIcon = UI_OFFLINE_AUTO_STRATEGY_SMART;
  let decisionGo: "offline-adventure" | "battle-dungeon" | "estate-idle" = "offline-adventure";
  let decisionGoHub: "estate" | "battle" = "estate";
  let decisionGoSub: "idle" | "dungeon" = "idle";
  let decisionGoTarget = "#offline-adventure-panel";
  if (pending) {
    decisionState = "ready";
    if (autoPolicy === "boost") {
      decisionTitle = "推荐动作：优先领取静修余韵";
      decisionIcon = UI_OFFLINE_AUTO_STRATEGY_BOOST;
    } else if (autoPolicy === "essence") {
      decisionTitle = "推荐动作：优先领取髓潮归元";
      decisionIcon = UI_OFFLINE_AUTO_STRATEGY_ESSENCE;
    } else if (autoPolicy === "smart") {
      decisionTitle = "推荐动作：智能策略建议先处理当前奇遇";
      decisionIcon = UI_OFFLINE_AUTO_STRATEGY_SMART;
    } else {
      decisionTitle = "推荐动作：优先领取稳态回收";
      decisionIcon = UI_OFFLINE_AUTO_STRATEGY_STEADY;
    }
    decisionLine = autoPolicyEnabled
      ? "自动结算已开启；如需改选可先切换策略，再手动确认本轮奇遇。"
      : "自动结算未开启；建议先手动处理本轮奇遇，再决定是否开启自动策略。";
    decisionGoLabel = "前往离线奇遇面板";
  } else if (boostLeftMs > 0) {
    decisionState = "ready";
    decisionTitle = "推荐动作：前往幻域推进高收益阶段";
    decisionLine = `离线增益生效中（×${boostMul.toFixed(2)}），建议前往「历练·筑灵 > 幻域·战斗」吃满增益窗口。`;
    decisionGoLabel = "前往幻域·战斗";
    decisionIcon = UI_OFFLINE_AUTO_STRATEGY_BOOST;
    decisionGo = "battle-dungeon";
    decisionGoHub = "battle";
    decisionGoSub = "dungeon";
    decisionGoTarget = "#dungeon-panel";
  } else {
    decisionState = "standby";
    decisionTitle = "推荐动作：先维持灵脉成长节奏";
    decisionLine = "当前无待结算奇遇且无离线增益，建议回到灵脉页准备下一轮离线触发。";
    decisionGoLabel = "前往灵脉·境界升级";
    decisionIcon = UI_OFFLINE_AUTO_STRATEGY_STEADY;
    decisionGo = "estate-idle";
    decisionGoHub = "estate";
    decisionGoSub = "idle";
    decisionGoTarget = "#offline-adventure-panel";
  }
  return {
    pending,
    pendingVisualState,
    pendingStatusLabel,
    pendingStatusClass,
    pendingHintLine,
    boostLeftMs,
    boostMul,
    resLine,
    boostTag,
    rerollCost,
    canReroll,
    rerollHintLine: rerollHint(state),
    rerollIcon: canReroll ? UI_OFFLINE_REROLL_READY : UI_OFFLINE_REROLL_LOCKED,
    autoRerollEnabled,
    autoRerollBudgetLabel,
    autoRerollBudgetValue,
    autoRerollStatusLine,
    autoRerollHintLine,
    instantPreview: instantPreview.summary,
    boostPreview: boostPreview.summary,
    essencePreview: essencePreview.summary,
    instantDesc,
    boostDesc,
    essenceDesc,
    tabReadyLabel: pending ? "可结算" : "待触发",
    tabBoostLabel: boostLeftMs > 0 ? "增益生效中" : "增益未激活",
    timeSemanticIcon: boostLeftMs > 0 ? UI_TIME_SEMANTIC_LIVE : UI_TIME_SEMANTIC_LOCKED,
    nextInstantLine: `${offlineResonanceTypeZh("instant")}·下一档 ${instantPreview.nextStacks} 层：${instantPreview.summary}`,
    nextBoostLine: `${offlineResonanceTypeZh("boost")}·下一档 ${boostPreview.nextStacks} 层：${boostPreview.summary}`,
    nextEssenceLine: `${offlineResonanceTypeZh("essence")}·下一档 ${essencePreview.nextStacks} 层：${essencePreview.summary}`,
    autoPolicyLabel,
    autoStatusLabel,
    autoStatusClass,
    autoTipLine,
    autoPolicyEnabled,
    autoPolicy,
    choiceInstantTitle,
    choiceBoostTitle,
    choiceEssenceTitle,
    choiceInstantTag,
    choiceBoostTag,
    choiceEssenceTag,
    decisionState,
    decisionTitle,
    decisionLine,
    decisionGoLabel,
    decisionIcon,
    decisionGo,
    decisionGoHub,
    decisionGoSub,
    decisionGoTarget,
  };
}

export function renderOfflineAdventurePanel(
  state: GameState,
  now: number,
  offlineBoostRenewRuleText: () => string,
  offlineResonanceTypeZh: (type: "instant" | "boost" | "essence" | null) => string,
): string {
  const vm = buildOfflineAdventurePanelModel(state, now, offlineResonanceTypeZh);
  return `<section class="panel offline-event-panel" id="offline-adventure-panel" data-offline-panel="adventure">
      <div class="panel-title-art-row panel-title-art-row--sub">
        <img class="panel-title-art-icon" src="${UI_OFFLINE_SUMMARY_BADGE}" alt="" width="24" height="24" loading="lazy" />
        <h2>离线奇遇三选一</h2>
      </div>
      <p class="hint sm offline-panel-summary" id="offline-panel-summary"><img src="${vm.timeSemanticIcon}" alt="" width="14" height="14" loading="lazy" />离线达阈值会生成三选一；灵脉/髓潮奖励立即到账，静修增益在持续时间后自动失效。${vm.boostTag}</p>
      <div class="offline-pending-state-chip" data-offline-pending-state="${vm.pendingVisualState}">
        <span class="status-badge ${vm.pendingStatusClass}" id="offline-pending-status-badge">
          <img src="${UI_OFFLINE_PENDING_FALLBACK}" alt="" width="14" height="14" loading="lazy" />
          <span>${vm.pendingStatusLabel}</span>
        </span>
        <p class="hint sm offline-pending-hint-line" id="offline-pending-hint-line">${vm.pendingHintLine}</p>
      </div>
      <p class="hint sm offline-resonance-line" id="offline-resonance-line">
        <img src="${UI_OFFLINE_RESONANCE_CHAIN}" alt="" width="14" height="14" loading="lazy" />
        <span>${vm.resLine}</span>
      </p>
      <div class="offline-resonance-next-grid">
        <p class="hint sm offline-resonance-next-line" id="offline-resonance-next-instant">
          <img src="${UI_OFFLINE_RESONANCE_NEXT_STACK}" alt="" width="14" height="14" loading="lazy" />
          <span>${vm.nextInstantLine}</span>
        </p>
        <p class="hint sm offline-resonance-next-line" id="offline-resonance-next-boost">
          <img src="${UI_OFFLINE_RESONANCE_NEXT_BONUS}" alt="" width="14" height="14" loading="lazy" />
          <span>${vm.nextBoostLine}</span>
        </p>
        <p class="hint sm offline-resonance-next-line" id="offline-resonance-next-essence">
          <img src="${UI_OFFLINE_RESONANCE_NEXT_STACK}" alt="" width="14" height="14" loading="lazy" />
          <span>${vm.nextEssenceLine}</span>
        </p>
      </div>
      <p class="hint sm offline-boost-rule-line" id="offline-boost-rule-line"><img src="${UI_OFFLINE_READOUT_SYNC}" alt="" width="14" height="14" loading="lazy" />${offlineBoostRenewRuleText()}</p>
      <div
        class="offline-control-surface offline-decision-panel"
        id="offline-decision-panel"
        data-offline-decision-state="${vm.decisionState}"
        data-offline-decision-recommend="${vm.autoPolicy}"
      >
        <p class="hint sm offline-decision-title" id="offline-decision-title">
          <img src="${vm.decisionIcon}" alt="" width="14" height="14" loading="lazy" />
          <span>${vm.decisionTitle}</span>
        </p>
        <p class="hint sm offline-decision-line" id="offline-decision-line">${vm.decisionLine}</p>
        <button
          type="button"
          id="offline-decision-go-btn"
          class="btn btn-primary offline-decision-go-btn offline-decision-go-btn--${vm.decisionGo}"
          data-offline-go="${vm.decisionGo}"
          data-offline-go-hub="${vm.decisionGoHub}"
          data-offline-go-sub="${vm.decisionGoSub}"
          data-offline-go-target="${vm.decisionGoTarget}"
          ${vm.decisionState === "ready" ? "" : "disabled"}
        >
          <img src="${UI_OFFLINE_DECISION_GO}" alt="" width="14" height="14" loading="lazy" />
          <span id="offline-decision-go-label">${vm.decisionGoLabel}</span>
        </button>
      </div>
      <div class="offline-control-surface offline-auto-config" data-offline-auto-state="${vm.pending ? "ready" : "standby"}">
        <div class="offline-auto-config-head">
          <p class="hint sm offline-auto-config-title">
            <img src="${UI_OFFLINE_AUTO_STRATEGY_STATUS}" alt="" width="14" height="14" loading="lazy" />
            离线奇遇自动选择策略
          </p>
          <span class="status-badge ${vm.autoStatusClass}" id="offline-auto-status-badge">${vm.autoStatusLabel}</span>
        </div>
        <div class="offline-auto-strategy-row" role="group" aria-label="离线奇遇自动策略">
          <button id="offline-auto-strategy-steady" class="btn offline-auto-strategy-btn ${vm.autoPolicyEnabled && vm.autoPolicy === "steady" ? "btn-primary" : ""}" type="button" data-offline-auto-strategy="steady">
            <img src="${UI_OFFLINE_AUTO_STRATEGY_STEADY}" alt="" width="14" height="14" loading="lazy" />
            稳态优先
          </button>
          <button id="offline-auto-strategy-boost" class="btn offline-auto-strategy-btn ${vm.autoPolicyEnabled && vm.autoPolicy === "boost" ? "btn-primary" : ""}" type="button" data-offline-auto-strategy="boost">
            <img src="${UI_OFFLINE_AUTO_STRATEGY_BOOST}" alt="" width="14" height="14" loading="lazy" />
            增益优先
          </button>
          <button id="offline-auto-strategy-essence" class="btn offline-auto-strategy-btn ${vm.autoPolicyEnabled && vm.autoPolicy === "essence" ? "btn-primary" : ""}" type="button" data-offline-auto-strategy="essence">
            <img src="${UI_OFFLINE_AUTO_STRATEGY_ESSENCE}" alt="" width="14" height="14" loading="lazy" />
            髓潮优先
          </button>
          <button id="offline-auto-strategy-smart" class="btn offline-auto-strategy-btn ${vm.autoPolicyEnabled && vm.autoPolicy === "smart" ? "btn-primary" : ""}" type="button" data-offline-auto-strategy="smart">
            <img src="${UI_OFFLINE_AUTO_STRATEGY_SMART}" alt="" width="14" height="14" loading="lazy" />
            智能策略
          </button>
        </div>
        <p class="hint sm offline-auto-policy-line" id="offline-auto-policy-line">${vm.autoPolicyLabel}</p>
        <p class="hint sm offline-auto-tip-line" id="offline-auto-tip-line">${vm.autoTipLine}</p>
        <div
          class="offline-auto-reroll-block"
          id="offline-auto-reroll-block"
          data-offline-auto-reroll-enabled="${vm.autoRerollEnabled ? "1" : "0"}"
          data-offline-auto-reroll-budget="${vm.autoRerollBudgetValue}"
        >
          <button class="btn offline-auto-reroll-toggle" id="offline-auto-reroll-toggle" type="button" data-offline-auto-reroll-toggle="1" aria-pressed="${vm.autoRerollEnabled ? "true" : "false"}">
            <img src="${UI_OFFLINE_AUTO_REROLL_TOGGLE}" alt="" width="14" height="14" loading="lazy" />
            自动重掷预算
            <span class="status-badge ${vm.autoRerollEnabled ? "status-badge--ready" : "status-badge--pending"}" id="offline-auto-reroll-status">${vm.autoRerollStatusLine}</span>
          </button>
          <p class="hint sm offline-auto-reroll-budget" id="offline-auto-reroll-budget">
            <img src="${UI_OFFLINE_AUTO_REROLL_BUDGET}" alt="" width="14" height="14" loading="lazy" />
            <span>${vm.autoRerollBudgetLabel}</span>
          </p>
          <label class="hint sm offline-auto-reroll-budget-input-row" for="offline-auto-reroll-budget-input">
            预算上限
            <input
              id="offline-auto-reroll-budget-input"
              class="offline-auto-reroll-budget-input"
              data-offline-auto-reroll-budget-input="1"
              type="number"
              min="0"
              step="10"
              inputmode="numeric"
              value="${vm.autoRerollBudgetValue}"
            />
          </label>
          <p class="hint sm offline-auto-reroll-hint" id="offline-auto-reroll-hint">${vm.autoRerollHintLine}</p>
        </div>
      </div>
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
              <span id="offline-choice-title-instant">${vm.choiceInstantTitle}</span>
            </span>
            <span class="recommend-tag" id="offline-choice-tag-instant">${vm.choiceInstantTag}</span>
          </div>
          <p class="hint sm offline-choice-desc">${vm.instantDesc}</p>
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
              <span id="offline-choice-title-boost">${vm.choiceBoostTitle}</span>
            </span>
            <span class="status-badge ${vm.boostLeftMs > 0 ? "status-badge--ready" : "status-badge--pending"}" id="offline-choice-tag-boost">${vm.choiceBoostTag}</span>
          </div>
          <p class="hint sm offline-choice-desc">${vm.boostDesc}</p>
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
              <span id="offline-choice-title-essence">${vm.choiceEssenceTitle}</span>
            </span>
            <span class="recommend-tag" id="offline-choice-tag-essence">${vm.choiceEssenceTag}</span>
          </div>
          <p class="hint sm offline-choice-desc">${vm.essenceDesc}</p>
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
  const instantCard = cards[0] as HTMLElement | undefined;
  if (instantCard) {
    instantCard.classList.toggle("is-recommended", !!vm.pending);
  }
  const card1Desc = cards[0]?.querySelector(".offline-choice-desc");
  const card2Desc = cards[1]?.querySelector(".offline-choice-desc");
  const card3Desc = cards[2]?.querySelector(".offline-choice-desc");
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
      vm.boostTag;
  }
  const resonanceLine = document.getElementById("offline-resonance-line");
  const pendingStatusBadge = document.getElementById("offline-pending-status-badge");
  const pendingHintLine = document.getElementById("offline-pending-hint-line");
  const pendingStateChip = document.querySelector(".offline-pending-state-chip");
  if (resonanceLine) {
    const t = resonanceLine.querySelector("span");
    if (t) {
      t.textContent = vm.resLine;
    }
  }
  const boostRuleLine = document.getElementById("offline-boost-rule-line");
  if (boostRuleLine) {
    boostRuleLine.innerHTML =
      `<img src="${UI_OFFLINE_READOUT_SYNC}" alt="" width="14" height="14" loading="lazy" />` +
      offlineBoostRenewRuleText();
  }
  const nextInstant = document.getElementById("offline-resonance-next-instant");
  const nextBoost = document.getElementById("offline-resonance-next-boost");
  const nextEssence = document.getElementById("offline-resonance-next-essence");
  const autoStatusBadge = document.getElementById("offline-auto-status-badge");
  const autoPolicyLine = document.getElementById("offline-auto-policy-line");
  const autoTipLine = document.getElementById("offline-auto-tip-line");
  const autoConfig = document.querySelector(".offline-auto-config");
  if (autoConfig) {
    autoConfig.setAttribute("data-offline-auto-state", vm.pending ? "ready" : "standby");
  }
  const choiceTitleInstant = document.getElementById("offline-choice-title-instant");
  const choiceTitleBoost = document.getElementById("offline-choice-title-boost");
  const choiceTitleEssence = document.getElementById("offline-choice-title-essence");
  const choiceTagInstant = document.getElementById("offline-choice-tag-instant");
  const choiceTagBoost = document.getElementById("offline-choice-tag-boost");
  const choiceTagEssence = document.getElementById("offline-choice-tag-essence");
  const decisionPanel = document.getElementById("offline-decision-panel");
  const decisionTitleEl = document.getElementById("offline-decision-title");
  const decisionTitle = decisionTitleEl?.querySelector("span");
  const decisionLine = document.getElementById("offline-decision-line");
  const decisionGoBtn = document.getElementById("offline-decision-go-btn") as HTMLButtonElement | null;
  const decisionGoLabel = document.getElementById("offline-decision-go-label");
  const autoBtns = document.querySelectorAll("[data-offline-auto-strategy]");
  const autoRerollBlock = document.getElementById("offline-auto-reroll-block");
  const autoRerollToggle = document.getElementById("offline-auto-reroll-toggle");
  const autoRerollStatus = document.getElementById("offline-auto-reroll-status");
  const autoRerollBudget = document.getElementById("offline-auto-reroll-budget");
  const autoRerollBudgetInput = document.getElementById("offline-auto-reroll-budget-input") as HTMLInputElement | null;
  const autoRerollHint = document.getElementById("offline-auto-reroll-hint");
  autoBtns.forEach((btn) => {
    const strategy = (btn as HTMLElement).dataset.offlineAutoStrategy;
    const shouldActive = vm.autoPolicyEnabled && strategy === vm.autoPolicy;
    btn.classList.toggle("btn-primary", shouldActive);
  });
  if (autoStatusBadge) {
    autoStatusBadge.textContent = vm.autoStatusLabel;
    autoStatusBadge.classList.toggle("status-badge--ready", vm.autoStatusClass === "status-badge--ready");
    autoStatusBadge.classList.toggle("status-badge--pending", vm.autoStatusClass === "status-badge--pending");
  }
  if (autoPolicyLine) autoPolicyLine.textContent = vm.autoPolicyLabel;
  if (autoTipLine) autoTipLine.textContent = vm.autoTipLine;
  if (pendingStateChip) pendingStateChip.setAttribute("data-offline-pending-state", vm.pendingVisualState);
  if (pendingHintLine) pendingHintLine.textContent = vm.pendingHintLine;
  if (pendingStatusBadge) {
    pendingStatusBadge.classList.toggle("status-badge--ready", vm.pendingStatusClass === "status-badge--ready");
    pendingStatusBadge.classList.toggle("status-badge--risk", vm.pendingStatusClass === "status-badge--risk");
    pendingStatusBadge.classList.toggle("status-badge--pending", vm.pendingStatusClass === "status-badge--pending");
    const pendingStatusText = pendingStatusBadge.querySelector("span");
    if (pendingStatusText) pendingStatusText.textContent = vm.pendingStatusLabel;
  }
  if (autoRerollBlock) {
    autoRerollBlock.setAttribute("data-offline-auto-reroll-enabled", vm.autoRerollEnabled ? "1" : "0");
    autoRerollBlock.setAttribute("data-offline-auto-reroll-budget", vm.autoRerollBudgetValue);
  }
  if (autoRerollToggle) {
    autoRerollToggle.setAttribute("aria-pressed", vm.autoRerollEnabled ? "true" : "false");
  }
  if (autoRerollStatus) {
    autoRerollStatus.textContent = vm.autoRerollStatusLine;
    autoRerollStatus.classList.toggle("status-badge--ready", vm.autoRerollEnabled);
    autoRerollStatus.classList.toggle("status-badge--pending", !vm.autoRerollEnabled);
  }
  if (autoRerollBudget) {
    const autoRerollBudgetText = autoRerollBudget.querySelector("span");
    if (autoRerollBudgetText) autoRerollBudgetText.textContent = vm.autoRerollBudgetLabel;
  }
  if (autoRerollBudgetInput) autoRerollBudgetInput.value = vm.autoRerollBudgetValue;
  if (autoRerollHint) autoRerollHint.textContent = vm.autoRerollHintLine;
  if (choiceTitleInstant) choiceTitleInstant.textContent = vm.choiceInstantTitle;
  if (choiceTitleBoost) choiceTitleBoost.textContent = vm.choiceBoostTitle;
  if (choiceTitleEssence) choiceTitleEssence.textContent = vm.choiceEssenceTitle;
  if (choiceTagInstant) choiceTagInstant.textContent = vm.choiceInstantTag;
  if (choiceTagBoost) {
    choiceTagBoost.textContent = vm.choiceBoostTag;
    choiceTagBoost.classList.toggle("status-badge--ready", vm.boostLeftMs > 0);
    choiceTagBoost.classList.toggle("status-badge--pending", vm.boostLeftMs <= 0);
  }
  if (choiceTagEssence) choiceTagEssence.textContent = vm.choiceEssenceTag;
  if (decisionPanel) {
    decisionPanel.setAttribute("data-offline-decision-state", vm.decisionState);
    decisionPanel.setAttribute("data-offline-decision-recommend", vm.autoPolicy);
  }
  const decisionTitleIcon = decisionTitleEl?.querySelector("img");
  if (decisionTitleIcon instanceof HTMLImageElement) {
    decisionTitleIcon.src = vm.decisionIcon;
  }
  if (decisionTitle) decisionTitle.textContent = vm.decisionTitle;
  if (decisionLine) decisionLine.textContent = vm.decisionLine;
  if (decisionGoBtn) {
    decisionGoBtn.disabled = vm.decisionState !== "ready";
    decisionGoBtn.dataset.offlineGo = vm.decisionGo;
    decisionGoBtn.dataset.offlineGoHub = vm.decisionGoHub;
    decisionGoBtn.dataset.offlineGoSub = vm.decisionGoSub;
    decisionGoBtn.dataset.offlineGoTarget = vm.decisionGoTarget;
    decisionGoBtn.className = `btn btn-primary offline-decision-go-btn offline-decision-go-btn--${vm.decisionGo}`;
  }
  if (decisionGoLabel) decisionGoLabel.textContent = vm.decisionGoLabel;
  if (nextInstant) {
    const t = nextInstant.querySelector("span");
    if (t) t.textContent = vm.nextInstantLine;
  }
  if (nextBoost) {
    const t = nextBoost.querySelector("span");
    if (t) t.textContent = vm.nextBoostLine;
  }
  if (nextEssence) {
    const t = nextEssence.querySelector("span");
    if (t) t.textContent = vm.nextEssenceLine;
  }
}
