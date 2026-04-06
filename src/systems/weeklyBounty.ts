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

export type WeeklyBountyKind = "waves" | "cardPulls" | "gearForges" | "gardenHarvests" | "tuna" | "breakthroughs";

/** 周常悬赏卡片角标（与 `bountyPanel` / `public/assets/ui/bounty-*-deco.svg` 对应） */
export type WeeklyBountyCardDeco = "waves" | "pulls" | "forge" | "garden" | "tuna" | "realm";

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
    claimed: [],
  };
}

export function normalizeWeeklyBounty(st: GameState, now = Date.now()): void {
  const wk = currentWeekKey(now);
  if (!st.weeklyBounty || typeof st.weeklyBounty.weekKey !== "string") {
    st.weeklyBounty = emptyWeeklyBounty(wk);
    return;
  }
  for (const k of ["waves", "cardPulls", "gearForges", "gardenHarvests", "tuna", "breakthroughs"] as const) {
    const v = st.weeklyBounty[k];
    if (v == null || !Number.isFinite(v) || v < 0) st.weeklyBounty[k] = 0;
    else st.weeklyBounty[k] = Math.floor(v);
  }
  if (!Array.isArray(st.weeklyBounty.claimed)) st.weeklyBounty.claimed = [];
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

export type WeeklyBountyTaskState = "pending" | "claimable" | "claimed";

export function weeklyBountyTaskState(state: GameState, def: WeeklyBountyTaskDef): WeeklyBountyTaskState {
  if (isWeeklyBountyClaimed(state, def.id)) return "claimed";
  return isWeeklyBountyComplete(state, def) ? "claimable" : "pending";
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

/** 领取单个悬赏；成功返回 true */
export function claimWeeklyBountyTask(state: GameState, taskId: string, now: number): boolean {
  ensureWeeklyBountyWeek(state, now);
  const def = WEEKLY_BOUNTY_TASKS.find((t) => t.id === taskId);
  if (!def) return false;
  if (weeklyBountyTaskState(state, def) !== "claimable") return false;
  state.weeklyBounty.claimed.push(taskId);
  state.weeklyBounty.claimed.sort();
  if (def.rewardStones > 0) addStones(state, def.rewardStones);
  if (def.rewardEssence > 0) state.summonEssence += def.rewardEssence;
  maybeRecordWeeklyBountyFullWeek(state);
  return true;
}

/** 当前周可一键领取的条目数（已达成且未领） */
export function countClaimableWeeklyBounties(state: GameState, now: number): number {
  return weeklyBountyFeedbackState(state, now).claimable;
}

/** 一键领取全部可领悬赏；返回领取条数与奖励合计（用于 UI 提示） */
export function claimAllCompletableWeeklyBounties(
  state: GameState,
  now: number,
): { claimed: number; rewardStones: number; rewardEssence: number } {
  ensureWeeklyBountyWeek(state, now);
  let claimed = 0;
  let rewardStones = 0;
  let rewardEssence = 0;
  for (const def of WEEKLY_BOUNTY_TASKS) {
    if (!claimWeeklyBountyTask(state, def.id, now)) continue;
    if (def.rewardStones > 0) rewardStones += def.rewardStones;
    if (def.rewardEssence > 0) rewardEssence += def.rewardEssence;
    claimed += 1;
  }
  return { claimed, rewardStones, rewardEssence };
}

export interface WeeklyBountyFeedbackState {
  total: number;
  completed: number;
  pending: number;
  claimed: number;
  claimable: number;
  overdue: number;
  hasOverdue: boolean;
  consistent: boolean;
}

/** UI 反馈闭环：统一“进度→可领→已领”数量口径。 */
export function weeklyBountyFeedbackState(state: GameState, now: number): WeeklyBountyFeedbackState {
  ensureWeeklyBountyWeek(state, now);
  let completed = 0;
  let pending = 0;
  let claimed = 0;
  let claimable = 0;
  for (const def of WEEKLY_BOUNTY_TASKS) {
    const taskState = weeklyBountyTaskState(state, def);
    if (taskState === "claimed") {
      claimed += 1;
      completed += 1;
    } else if (taskState === "claimable") {
      completed += 1;
      claimable += 1;
    } else {
      pending += 1;
    }
  }
  const total = WEEKLY_BOUNTY_TASKS.length;
  // overdue 表示“已达成但未领”，与 claimable 同口径，便于 UI/提示统一展示计数
  const overdue = claimable;
  const hasOverdue = overdue > 0;
  const consistent = pending + claimable + claimed === total && completed === claimable + claimed && overdue === claimable;
  return { total, completed, pending, claimed, claimable, overdue, hasOverdue, consistent };
}

/** 统一悬赏反馈文案，供 toast/调试信息复用，避免各处拼接口径漂移。 */
export function formatWeeklyBountyFeedbackLine(fb: WeeklyBountyFeedbackState): string {
  return `待完成 ${fb.pending}，可领 ${fb.claimable}，已领 ${fb.claimed}/${fb.total}，逾期 ${fb.overdue}`;
}
