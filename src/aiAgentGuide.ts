import type { GameState } from "./types";
import { computeNextBoostHint, type NextBoostHint } from "./nextBoostHint";
const SCRIPT_ID = "ai-agent-guide-data";
const ROOT_ID = "ai-agent-guide-root";

/** 与主界面主导航一致，供自动化按名路由 */
export type AiHubId = "character" | "cultivate" | "battle" | "estate";

export interface AiAgentNavigation {
  activeHub: AiHubId;
  estateSub: "idle" | "vein" | "array" | "garden";
  estateIdleSub: "core" | "well" | "away";
  battleSub: "dungeon" | "forge";
  cultivateSub: string;
  characterSub: string;
  gachaPool: "cards" | "gear";
}

export interface AiPrimaryAction {
  /** 与 `[data-next-boost-target]` 一致，可配合「下一步」浮标跳转 */
  target: string;
  /** 人类可读摘要 */
  label: string;
  detail: string;
  priority: number;
  claimStyle: boolean;
}

export interface AiAgentSnapshot {
  schema: "idle-gacha-ai-agent/v1";
  generatedAtMs: number;
  /** 存档版本，便于外部脚本判断兼容性 */
  saveVersion: number;
  tutorialStep: number;
  navigation: AiAgentNavigation;
  /** 当前最高优先级可执行建议；与 UI「下一步」浮标同源 */
  nextBoostHint: NextBoostHint | null;
  /** 建议优先执行的动作（通常与 nextBoostHint 一致；新手期例外） */
  primaryAction: AiPrimaryAction | null;
  /** 缩短决策链的静态提示（不改变数值） */
  loopHints: string[];
}

export interface AiAgentFeedback {
  /** 本会话内调用 getSnapshot / 读取桥接的次数 */
  sessionReads: number;
  lastReadAtMs: number | null;
  /** 上次快照中的 primary target */
  lastPrimaryTarget: string | null;
  /** 若存在 nextBoostHint，是否与 primaryAction.target 一致 */
  hintAlignedWithPrimary: boolean | null;
}

let sessionReads = 0;
let lastReadAtMs: number | null = null;
let lastPrimaryTarget: string | null = null;
let lastHintAligned: boolean | null = null;

function recordRead(nowMs: number, snap: AiAgentSnapshot): void {
  sessionReads += 1;
  lastReadAtMs = nowMs;
  lastPrimaryTarget = snap.primaryAction?.target ?? null;
  const h = snap.nextBoostHint;
  const p = snap.primaryAction;
  if (!h || !p) lastHintAligned = null;
  else lastHintAligned = h.scrollTarget === p.target;
}

export function getAiAgentFeedback(): AiAgentFeedback {
  return {
    sessionReads,
    lastReadAtMs,
    lastPrimaryTarget,
    hintAlignedWithPrimary: lastHintAligned,
  };
}

function buildPrimaryAction(state: GameState, hint: NextBoostHint | null): AiPrimaryAction | null {
  if (state.tutorialStep !== 0) {
    return {
      target: "tutorial",
      label: "完成新手引导",
      detail: `tutorialStep=${state.tutorialStep}，请按界面高亮与说明操作`,
      priority: 1000,
      claimStyle: false,
    };
  }
  if (!hint) return null;
  return {
    target: hint.scrollTarget,
    label: hint.title,
    detail: hint.detailLine,
    priority: hint.priority,
    claimStyle: hint.claimStyle,
  };
}

const LOOP_HINTS: string[] = [
  "优先处理「可领取」类（礼、悬赏、蓄灵池、涓滴），再考虑抽卡与升阶。",
  "十连与破境等资源节点：浮标会指向对应按钮附近的 data-next-boost-target。",
  "需要快速迭代时：跟随 primaryAction.target，与「下一步」按钮一致。",
];

export function buildAiAgentSnapshot(
  state: GameState,
  nowMs: number,
  cardPool: number,
  nav: AiAgentNavigation,
): AiAgentSnapshot {
  const hint = computeNextBoostHint(state, nowMs, cardPool);
  const primary = buildPrimaryAction(state, hint);
  return {
    schema: "idle-gacha-ai-agent/v1",
    generatedAtMs: nowMs,
    saveVersion: state.version,
    tutorialStep: state.tutorialStep,
    navigation: nav,
    nextBoostHint: hint,
    primaryAction: primary,
    loopHints: LOOP_HINTS,
  };
}

function snapshotJson(snap: AiAgentSnapshot): string {
  return JSON.stringify(snap);
}

/** 嵌入 HTML 时避免 `</script>` 截断 */
function jsonForScriptEmbed(snap: AiAgentSnapshot): string {
  return snapshotJson(snap).replace(/</g, "\\u003c");
}

/** 供 DOM 解析：隐藏 script[type="application/json"] + data 属性 */
export function renderAiAgentHiddenMarkup(snap: AiAgentSnapshot): string {
  const primary = snap.primaryAction?.target ?? "";
  const priLabel = snap.primaryAction?.label ?? "";
  const tut = String(snap.tutorialStep);
  const json = jsonForScriptEmbed(snap);
  return `
<div id="${ROOT_ID}" class="ai-agent-guide-root" aria-hidden="true"
  data-ai-schema="${snap.schema}"
  data-ai-tutorial-step="${tut}"
  data-ai-primary-target="${escapeAttr(primary)}"
  data-ai-primary-label="${escapeAttr(priLabel)}"
  data-ai-hub="${snap.navigation.activeHub}"
  data-ai-cultivate-sub="${snap.navigation.cultivateSub}"
  data-ai-estate-sub="${snap.navigation.estateSub}"
></div>
<script type="application/json" id="${SCRIPT_ID}">${json}</script>`.trim();
}

function escapeAttr(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");
}

export type IdleGachaAiBridge = {
  getSnapshot: () => AiAgentSnapshot;
  getFeedback: () => AiAgentFeedback;
  /** 自动化轮询时可调用，用于累计 sessionReads 并刷新对齐统计 */
  markRead: () => void;
};

let lastSnap: AiAgentSnapshot | null = null;

export function installAiAgentBridge(snap: AiAgentSnapshot): void {
  lastSnap = snap;
  const w = window as unknown as { __IDLE_GACHA_AI__?: IdleGachaAiBridge };
  const bridge: IdleGachaAiBridge = {
    getSnapshot: () => {
      if (!lastSnap) throw new Error("ai agent snapshot not ready");
      recordRead(Date.now(), lastSnap);
      return lastSnap;
    },
    getFeedback: () => getAiAgentFeedback(),
    markRead: () => {
      if (!lastSnap) return;
      recordRead(Date.now(), lastSnap);
    },
  };
  w.__IDLE_GACHA_AI__ = bridge;

  if (typeof window.dispatchEvent === "function") {
    try {
      window.dispatchEvent(new CustomEvent<AiAgentSnapshot>("idle-gacha-ai-snapshot", { detail: snap }));
    } catch {
      /* ignore */
    }
  }
}

/** 单元测试或外部脚本：直接从页面读取 JSON */
export function readAiSnapshotFromDocument(): AiAgentSnapshot | null {
  const el = document.getElementById(SCRIPT_ID);
  if (!el || el.textContent == null || el.textContent.trim() === "") return null;
  try {
    return JSON.parse(el.textContent) as AiAgentSnapshot;
  } catch {
    return null;
  }
}

/** 局部刷新（如仅更新「下一步」浮标）时同步隐藏 JSON，避免与 window 桥接漂移 */
export function updateAiAgentGuideDom(snap: AiAgentSnapshot): void {
  installAiAgentBridge(snap);
  const root = document.getElementById(ROOT_ID);
  if (root) {
    const primary = snap.primaryAction?.target ?? "";
    const priLabel = snap.primaryAction?.label ?? "";
    root.dataset.aiSchema = snap.schema;
    root.dataset.aiTutorialStep = String(snap.tutorialStep);
    root.dataset.aiPrimaryTarget = primary;
    root.dataset.aiPrimaryLabel = priLabel;
    root.dataset.aiHub = snap.navigation.activeHub;
    root.dataset.aiCultivateSub = snap.navigation.cultivateSub;
    root.dataset.aiEstateSub = snap.navigation.estateSub;
  }
  const scr = document.getElementById(SCRIPT_ID);
  if (scr) scr.textContent = snapshotJson(snap);
}
