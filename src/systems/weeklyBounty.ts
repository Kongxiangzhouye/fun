import type { GameState } from "../types";
import { addStones } from "../stones";
import { normalizeLifetimeStats } from "./pullChronicle";

/** 以本地时区周一 0 点所在日历日为一周 key */
export function currentWeekKey(now: number): string {
  const d = new Date(now);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  const mon = new Date(d.getFullYear(), d.getMonth(), diff);
  return `${mon.getFullYear()}-${String(mon.getMonth() + 1).padStart(2, "0")}-${String(mon.getDate()).padStart(2, "0")}`;
}

export type WeeklyBountyKind =
  | "waves"
  | "cardPulls"
  | "gearForges"
  | "gardenHarvests"
  | "tuna"
  | "breakthroughs"
  | "estateCompletions";

/** 周常悬赏卡片角标（与 `bountyPanel` / `public/assets/ui/bounty-*-deco.svg` 对应） */
export type WeeklyBountyCardDeco = "waves" | "pulls" | "forge" | "garden" | "tuna" | "realm" | "estate";

export interface WeeklyBountyTaskDef {
  id: string;
  title: string;
  desc: string;
  target: number;
  kind: WeeklyBountyKind;
  rewardStones: number;
  rewardEssence: number;
  /** 悬赏卡片标题旁小图标 */
  cardDeco: WeeklyBountyCardDeco;
}

/** 本周累计「已达成」悬赏条目数的里程奖励（2/4/6 条；灵石 + 唤灵髓 + 筑灵髓） */
export interface WeeklyBountyMilestoneDef {
  id: string;
  title: string;
  desc: string;
  /** 需要本周已有多少条悬赏达到目标进度 */
  threshold: number;
  rewardStones: number;
  rewardSummonEssence: number;
  rewardZhuLingEssence: number;
}

export const WEEKLY_BOUNTY_MILESTONES: WeeklyBountyMilestoneDef[] = [
  {
    id: "wb_ms_2",
    title: "里程 · 贰",
    desc: "本周累计达成 2 条悬赏进度",
    threshold: 2,
    rewardStones: 220,
    rewardSummonEssence: 10,
    rewardZhuLingEssence: 8,
  },
  {
    id: "wb_ms_4",
    title: "里程 · 肆",
    desc: "本周累计达成 4 条悬赏进度",
    threshold: 4,
    rewardStones: 380,
    rewardSummonEssence: 18,
    rewardZhuLingEssence: 14,
  },
  {
    id: "wb_ms_6",
    title: "里程 · 陆",
    desc: "本周累计达成 6 条悬赏进度",
    threshold: 6,
    rewardStones: 560,
    rewardSummonEssence: 26,
    rewardZhuLingEssence: 22,
  },
];

export const WEEKLY_BOUNTY_TASKS: WeeklyBountyTaskDef[] = [
  {
    id: "wb_waves",
    title: "幻域清剿",
    desc: "本周累计在幻域击溃 12 波",
    target: 12,
    kind: "waves",
    rewardStones: 420,
    rewardEssence: 16,
    cardDeco: "waves",
  },
  {
    id: "wb_pulls",
    title: "唤引修行",
    desc: "本周灵卡唤引 10 次",
    target: 10,
    kind: "cardPulls",
    rewardStones: 220,
    rewardEssence: 12,
    cardDeco: "pulls",
  },
  {
    id: "wb_forge",
    title: "铸灵功课",
    desc: "本周铸灵 8 次",
    target: 8,
    kind: "gearForges",
    rewardStones: 200,
    rewardEssence: 14,
    cardDeco: "forge",
  },
  {
    id: "wb_garden",
    title: "灵田收成",
    desc: "本周灵田收获 4 次",
    target: 4,
    kind: "gardenHarvests",
    rewardStones: 160,
    rewardEssence: 10,
    cardDeco: "garden",
  },
  {
    id: "wb_tuna",
    title: "吐纳功课",
    desc: "本周吐纳 8 次",
    target: 8,
    kind: "tuna",
    rewardStones: 130,
    rewardEssence: 8,
    cardDeco: "tuna",
  },
  {
    id: "wb_realm",
    title: "破境精进",
    desc: "本周破境 2 次",
    target: 2,
    kind: "breakthroughs",
    rewardStones: 320,
    rewardEssence: 18,
    cardDeco: "realm",
  },
  {
    id: "wb_estate",
    title: "洞府委托",
    desc: "本周完成洞府委托 4 次",
    target: 4,
    kind: "estateCompletions",
    rewardStones: 260,
    rewardEssence: 14,
    cardDeco: "estate",
  },
];

/** 当周全部条目均已领取时，终身累计「清满周」次数（每周最多 +1） */
function maybeRecordWeeklyBountyFullWeek(state: GameState): void {
  normalizeLifetimeStats(state);
  if (WEEKLY_BOUNTY_TASKS.some((t) => !state.weeklyBounty.claimed.includes(t.id))) return;
  const wk = state.weeklyBounty.weekKey;
  const ls = state.lifetimeStats;
  if (ls.lastWeeklyBountyFullWeekKey === wk) return;
  ls.lastWeeklyBountyFullWeekKey = wk;
  ls.weeklyBountyFullWeeks += 1;
}

export function emptyWeeklyBounty(weekKey: string): GameState["weeklyBounty"] {
  return {
    weekKey,
    waves: 0,
    cardPulls: 0,
    gearForges: 0,
    gardenHarvests: 0,
    tuna: 0,
    breakthroughs: 0,
    estateCompletions: 0,
    claimed: [],
    milestoneClaimed: [],
  };
}

export function normalizeWeeklyBounty(st: GameState, now = Date.now()): void {
  const wk = currentWeekKey(now);
  if (!st.weeklyBounty || typeof st.weeklyBounty.weekKey !== "string") {
    st.weeklyBounty = emptyWeeklyBounty(wk);
    return;
  }
  for (const k of ["waves", "cardPulls", "gearForges", "gardenHarvests", "tuna", "breakthroughs", "estateCompletions"] as const) {
    const v = st.weeklyBounty[k];
    if (v == null || !Number.isFinite(v) || v < 0) st.weeklyBounty[k] = 0;
    else st.weeklyBounty[k] = Math.floor(v);
  }
  if (!Array.isArray(st.weeklyBounty.claimed)) st.weeklyBounty.claimed = [];
  if (!Array.isArray(st.weeklyBounty.milestoneClaimed)) st.weeklyBounty.milestoneClaimed = [];
  const taskIds = new Set(WEEKLY_BOUNTY_TASKS.map((t) => t.id));
  const seen = new Set<string>();
  st.weeklyBounty.claimed = st.weeklyBounty.claimed
    .filter((x) => typeof x === "string" && taskIds.has(x))
    .filter((id) => {
      if (seen.has(id)) return false;
      seen.add(id);
      return true;
    })
    .sort();
  const msIds = new Set(WEEKLY_BOUNTY_MILESTONES.map((m) => m.id));
  const seenMs = new Set<string>();
  st.weeklyBounty.milestoneClaimed = st.weeklyBounty.milestoneClaimed
    .filter((x) => typeof x === "string" && msIds.has(x))
    .filter((id) => {
      if (seenMs.has(id)) return false;
      seenMs.add(id);
      return true;
    })
    .sort();
  if (st.weeklyBounty.weekKey !== wk) {
    st.weeklyBounty = emptyWeeklyBounty(wk);
  }
}

/** 在周切换时重置进度（在 tick 与关键操作前调用） */
export function ensureWeeklyBountyWeek(state: GameState, now: number): void {
  normalizeWeeklyBounty(state, now);
  const wk = currentWeekKey(now);
  if (state.weeklyBounty.weekKey !== wk) {
    state.weeklyBounty = emptyWeeklyBounty(wk);
  }
}

function countForKind(state: GameState, kind: WeeklyBountyKind): number {
  switch (kind) {
    case "waves":
      return state.weeklyBounty.waves;
    case "cardPulls":
      return state.weeklyBounty.cardPulls;
    case "gearForges":
      return state.weeklyBounty.gearForges;
    case "gardenHarvests":
      return state.weeklyBounty.gardenHarvests;
    case "tuna":
      return state.weeklyBounty.tuna;
    case "breakthroughs":
      return state.weeklyBounty.breakthroughs;
    case "estateCompletions":
      return state.weeklyBounty.estateCompletions;
    default:
      return 0;
  }
}

export function weeklyBountyProgress(state: GameState, def: WeeklyBountyTaskDef): number {
  return Math.min(def.target, countForKind(state, def.kind));
}

export function isWeeklyBountyComplete(state: GameState, def: WeeklyBountyTaskDef): boolean {
  return countForKind(state, def.kind) >= def.target;
}

export function isWeeklyBountyClaimed(state: GameState, taskId: string): boolean {
  return state.weeklyBounty.claimed.includes(taskId);
}

/** 本周已有多少条悬赏达到目标进度（未领也可计入） */
export function countWeeklyBountyTasksCompleted(state: GameState): number {
  return WEEKLY_BOUNTY_TASKS.filter((t) => isWeeklyBountyComplete(state, t)).length;
}

export type WeeklyBountyMilestoneUiState = "pending" | "claimable" | "claimed";

export function weeklyBountyMilestoneUiState(
  state: GameState,
  def: WeeklyBountyMilestoneDef,
  now: number,
): WeeklyBountyMilestoneUiState {
  ensureWeeklyBountyWeek(state, now);
  if (state.weeklyBounty.milestoneClaimed.includes(def.id)) return "claimed";
  return countWeeklyBountyTasksCompleted(state) >= def.threshold ? "claimable" : "pending";
}

export function isWeeklyBountyMilestoneClaimed(state: GameState, id: string): boolean {
  return state.weeklyBounty.milestoneClaimed.includes(id);
}

export type WeeklyBountyTaskState = "pending" | "claimable" | "claimed";
export type WeeklyBountyTaskDisplayState = WeeklyBountyTaskState | "overdue";

export type WeeklyBountyGoAction =
  | "dungeon"
  | "card_pull"
  | "gear_forge"
  | "garden"
  | "tuna"
  | "breakthrough"
  | "estate_commission";

export interface WeeklyBountyNextAction {
  taskId: string;
  action: WeeklyBountyGoAction;
  title: string;
  reason: string;
  progress: number;
  target: number;
  priority: number;
}

export interface WeeklyBountySnapshotBundle {
  snapshot: WeeklyBountySnapshot;
  nextAction: WeeklyBountyNextAction | null;
}

export function weeklyBountyTaskState(state: GameState, def: WeeklyBountyTaskDef): WeeklyBountyTaskState {
  if (isWeeklyBountyClaimed(state, def.id)) return "claimed";
  return isWeeklyBountyComplete(state, def) ? "claimable" : "pending";
}

function isLastDayOfWeek(now: number): boolean {
  return new Date(now).getDay() === 0;
}

export interface WeeklyBountyTaskSnapshot {
  id: string;
  state: WeeklyBountyTaskDisplayState;
  progress: number;
}

export interface WeeklyBountySnapshot {
  tasks: WeeklyBountyTaskSnapshot[];
  taskMap: Map<string, WeeklyBountyTaskSnapshot>;
}

/** 统一周常条目状态口径：pending / claimable / claimed / overdue。 */
export function weeklyBountySnapshot(state: GameState, now: number): WeeklyBountySnapshot {
  ensureWeeklyBountyWeek(state, now);
  const overdueGate = isLastDayOfWeek(now);
  const tasks = WEEKLY_BOUNTY_TASKS.map((def) => {
    const base = weeklyBountyTaskState(state, def);
    const displayState: WeeklyBountyTaskDisplayState = base === "claimable" && overdueGate ? "overdue" : base;
    return {
      id: def.id,
      state: displayState,
      progress: weeklyBountyProgress(state, def),
    };
  });
  return {
    tasks,
    taskMap: new Map(tasks.map((x) => [x.id, x])),
  };
}

/** 兼容旧调用：返回周常任务快照列表。 */
export function weeklyBountyTaskSnapshots(state: GameState, now: number): WeeklyBountyTaskSnapshot[] {
  return weeklyBountySnapshot(state, now).tasks;
}

function normalizeWeeklyBountyEventNow(nowMs?: number): number {
  return Number.isFinite(nowMs) ? (nowMs as number) : Date.now();
}

export function noteWeeklyBountyWave(state: GameState, nowMs?: number): void {
  ensureWeeklyBountyWeek(state, normalizeWeeklyBountyEventNow(nowMs));
  state.weeklyBounty.waves += 1;
}

export function noteWeeklyBountyCardPulls(state: GameState, n: number, nowMs?: number): void {
  ensureWeeklyBountyWeek(state, normalizeWeeklyBountyEventNow(nowMs));
  state.weeklyBounty.cardPulls += Math.max(0, Math.floor(n));
}

export function noteWeeklyBountyGearForges(state: GameState, n: number, nowMs?: number): void {
  ensureWeeklyBountyWeek(state, normalizeWeeklyBountyEventNow(nowMs));
  state.weeklyBounty.gearForges += Math.max(0, Math.floor(n));
}

export function noteWeeklyBountyGardenHarvest(state: GameState, nowMs?: number): void {
  ensureWeeklyBountyWeek(state, normalizeWeeklyBountyEventNow(nowMs));
  state.weeklyBounty.gardenHarvests += 1;
}

export function noteWeeklyBountyTuna(state: GameState, nowMs?: number): void {
  ensureWeeklyBountyWeek(state, normalizeWeeklyBountyEventNow(nowMs));
  state.weeklyBounty.tuna += 1;
}

export function noteWeeklyBountyBreakthrough(state: GameState, nowMs?: number): void {
  ensureWeeklyBountyWeek(state, normalizeWeeklyBountyEventNow(nowMs));
  state.weeklyBounty.breakthroughs += 1;
}

export function noteWeeklyBountyEstateCompletion(state: GameState, nowMs?: number): void {
  ensureWeeklyBountyWeek(state, normalizeWeeklyBountyEventNow(nowMs));
  state.weeklyBounty.estateCompletions += 1;
}

/** 领取单个悬赏；成功返回 true */
export function claimWeeklyBountyTask(state: GameState, taskId: string, now: number): boolean {
  ensureWeeklyBountyWeek(state, now);
  const def = WEEKLY_BOUNTY_TASKS.find((t) => t.id === taskId);
  if (!def) return false;
  const base = weeklyBountyTaskState(state, def);
  if (!(base === "claimable")) return false;
  state.weeklyBounty.claimed.push(taskId);
  state.weeklyBounty.claimed.sort();
  if (def.rewardStones > 0) addStones(state, def.rewardStones);
  if (def.rewardEssence > 0) state.summonEssence += def.rewardEssence;
  maybeRecordWeeklyBountyFullWeek(state);
  return true;
}

/** 领取单个里程奖励 */
export function claimWeeklyBountyMilestone(state: GameState, milestoneId: string, now: number): boolean {
  ensureWeeklyBountyWeek(state, now);
  const def = WEEKLY_BOUNTY_MILESTONES.find((m) => m.id === milestoneId);
  if (!def) return false;
  if (state.weeklyBounty.milestoneClaimed.includes(milestoneId)) return false;
  if (countWeeklyBountyTasksCompleted(state) < def.threshold) return false;
  state.weeklyBounty.milestoneClaimed.push(milestoneId);
  state.weeklyBounty.milestoneClaimed.sort();
  if (def.rewardStones > 0) addStones(state, def.rewardStones);
  if (def.rewardSummonEssence > 0) state.summonEssence += def.rewardSummonEssence;
  if (def.rewardZhuLingEssence > 0) state.zhuLingEssence += def.rewardZhuLingEssence;
  return true;
}

/** 当前周可一键领取的悬赏条目数（仅任务条，不含里程） */
export function countClaimableWeeklyBounties(state: GameState, now: number): number {
  return weeklyBountyFeedbackState(state, now).claimReady;
}

/** 可领取的里程档位数 */
export function countClaimableWeeklyMilestones(state: GameState, now: number): number {
  ensureWeeklyBountyWeek(state, now);
  let n = 0;
  for (const def of WEEKLY_BOUNTY_MILESTONES) {
    if (weeklyBountyMilestoneUiState(state, def, now) === "claimable") n += 1;
  }
  return n;
}

/** 任务悬赏 + 里程：一键可领总条数 */
export function countClaimableWeeklyAll(state: GameState, now: number): number {
  return countClaimableWeeklyBounties(state, now) + countClaimableWeeklyMilestones(state, now);
}

/** 一键领取全部可领悬赏与里程；返回领取条数与奖励合计（用于 UI 提示） */
export function claimAllCompletableWeeklyBounties(
  state: GameState,
  now: number,
): {
  claimedTasks: number;
  claimedMilestones: number;
  rewardStones: number;
  rewardSummonEssence: number;
  rewardZhuLingEssence: number;
} {
  ensureWeeklyBountyWeek(state, now);
  let claimedTasks = 0;
  let claimedMilestones = 0;
  let rewardStones = 0;
  let rewardSummonEssence = 0;
  let rewardZhuLingEssence = 0;
  for (const def of WEEKLY_BOUNTY_TASKS) {
    if (!claimWeeklyBountyTask(state, def.id, now)) continue;
    if (def.rewardStones > 0) rewardStones += def.rewardStones;
    if (def.rewardEssence > 0) rewardSummonEssence += def.rewardEssence;
    claimedTasks += 1;
  }
  for (const def of WEEKLY_BOUNTY_MILESTONES) {
    if (!claimWeeklyBountyMilestone(state, def.id, now)) continue;
    if (def.rewardStones > 0) rewardStones += def.rewardStones;
    rewardSummonEssence += def.rewardSummonEssence;
    rewardZhuLingEssence += def.rewardZhuLingEssence;
    claimedMilestones += 1;
  }
  return { claimedTasks, claimedMilestones, rewardStones, rewardSummonEssence, rewardZhuLingEssence };
}

export interface WeeklyBountyFeedbackState {
  total: number;
  completed: number;
  pending: number;
  claimed: number;
  claimable: number;
  claimReady: number;
  overdue: number;
  hasOverdue: boolean;
  consistent: boolean;
  weekKey: string;
  expectedWeekKey: string;
  weekAligned: boolean;
}

/** UI 反馈闭环：统一“进度→可领→已领”数量口径。 */
export function weeklyBountyFeedbackState(state: GameState, now: number): WeeklyBountyFeedbackState {
  ensureWeeklyBountyWeek(state, now);
  const snapshots = weeklyBountySnapshot(state, now).tasks;
  let completed = 0;
  let pending = 0;
  let claimed = 0;
  let claimable = 0;
  let overdue = 0;
  for (const task of snapshots) {
    const taskState = task.state;
    if (taskState === "claimed") {
      claimed += 1;
      completed += 1;
    } else if (taskState === "claimable" || taskState === "overdue") {
      completed += 1;
      if (taskState === "overdue") overdue += 1;
      else claimable += 1;
    } else {
      pending += 1;
    }
  }
  const total = snapshots.length;
  const claimReady = claimable + overdue;
  const hasOverdue = overdue > 0;
  const expectedWeekKey = currentWeekKey(now);
  const weekKey = state.weeklyBounty.weekKey;
  const weekAligned = weekKey === expectedWeekKey;
  const consistent =
    pending + claimReady + claimed === total &&
    completed === claimReady + claimed &&
    (hasOverdue ? overdue <= claimReady : true) &&
    weekAligned;
  return { total, completed, pending, claimed, claimable, claimReady, overdue, hasOverdue, consistent, weekKey, expectedWeekKey, weekAligned };
}

/** 统一悬赏反馈文案，供 toast/调试信息复用，避免各处拼接口径漂移。 */
export function formatWeeklyBountyFeedbackLine(fb: WeeklyBountyFeedbackState): string {
  return `待完成 ${fb.pending}，可领 ${fb.claimReady}，已领 ${fb.claimed}/${fb.total}，逾期 ${fb.overdue}`;
}

/** 周常状态可观测行：用于面板调试与日志。 */
export function formatWeeklyBountyObserveLine(fb: WeeklyBountyFeedbackState): string {
  const align = fb.weekAligned ? "周键对齐" : `周键漂移(${fb.weekKey}!=${fb.expectedWeekKey})`;
  const consistency = fb.consistent ? "口径一致" : "口径异常";
  return `${consistency} · ${align}`;
}

function weeklyBountyTaskPriority(state: GameState, def: WeeklyBountyTaskDef, snap: WeeklyBountyTaskSnapshot | undefined): number {
  const prog = snap?.progress ?? 0;
  const done = prog >= def.target;
  if (isWeeklyBountyClaimed(state, def.id)) return -1000;
  let p = 0;
  if (done) p += 1200;
  if (snap?.state === "overdue") p += 350;
  const missing = Math.max(0, def.target - prog);
  p += Math.max(0, 200 - missing * 18);
  switch (def.kind) {
    case "waves":
      p += 120;
      break;
    case "breakthroughs":
      p += 80;
      break;
    case "estateCompletions":
      p += 105;
      break;
    case "gearForges":
      p += 55;
      break;
    case "cardPulls":
      p += 45;
      break;
    case "gardenHarvests":
      p += 35;
      break;
    case "tuna":
      p += 25;
      break;
    default:
      break;
  }
  return p;
}

function actionForTaskKind(kind: WeeklyBountyKind): WeeklyBountyGoAction {
  switch (kind) {
    case "waves":
      return "dungeon";
    case "cardPulls":
      return "card_pull";
    case "gearForges":
      return "gear_forge";
    case "gardenHarvests":
      return "garden";
    case "tuna":
      return "tuna";
    case "breakthroughs":
      return "breakthrough";
    case "estateCompletions":
      return "estate_commission";
    default:
      return "dungeon";
  }
}

function reasonForTask(def: WeeklyBountyTaskDef, progress: number): string {
  const left = Math.max(0, def.target - progress);
  if (left <= 0) return "已达成，建议立即领取奖励。";
  return `距离完成还差 ${left} 次。`;
}

export function weeklyBountyNextActionFromSnapshot(
  state: GameState,
  snapshot: WeeklyBountySnapshot,
): WeeklyBountyNextAction | null {
  const snapshots = snapshot.taskMap;
  let best: WeeklyBountyNextAction | null = null;
  for (const def of WEEKLY_BOUNTY_TASKS) {
    if (isWeeklyBountyClaimed(state, def.id)) continue;
    const snap = snapshots.get(def.id);
    const progress = snap?.progress ?? 0;
    const priority = weeklyBountyTaskPriority(state, def, snap);
    const next: WeeklyBountyNextAction = {
      taskId: def.id,
      action: actionForTaskKind(def.kind),
      title: def.title,
      reason: reasonForTask(def, progress),
      progress,
      target: def.target,
      priority,
    };
    if (!best || next.priority > best.priority) best = next;
  }
  return best;
}

export function weeklyBountySnapshotBundle(state: GameState, now: number): WeeklyBountySnapshotBundle {
  ensureWeeklyBountyWeek(state, now);
  const snapshot = weeklyBountySnapshot(state, now);
  return {
    snapshot,
    nextAction: weeklyBountyNextActionFromSnapshot(state, snapshot),
  };
}

export function weeklyBountyNextAction(state: GameState, now: number): WeeklyBountyNextAction | null {
  return weeklyBountySnapshotBundle(state, now).nextAction;
}
