import type { GameState } from "../types";
import { addStones } from "../stones";

/** 以本地时区周一 0 点所在日历日为一周 key */
export function currentWeekKey(now: number): string {
  const d = new Date(now);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  const mon = new Date(d.getFullYear(), d.getMonth(), diff);
  return `${mon.getFullYear()}-${String(mon.getMonth() + 1).padStart(2, "0")}-${String(mon.getDate()).padStart(2, "0")}`;
}

export type WeeklyBountyKind = "waves" | "cardPulls" | "gearForges" | "gardenHarvests" | "tuna" | "breakthroughs";

export interface WeeklyBountyTaskDef {
  id: string;
  title: string;
  desc: string;
  target: number;
  kind: WeeklyBountyKind;
  rewardStones: number;
  rewardEssence: number;
  /** 悬赏卡片标题旁小图标 */
  cardDeco?: "forge";
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
  },
  {
    id: "wb_pulls",
    title: "唤引修行",
    desc: "本周灵卡唤引 10 次",
    target: 10,
    kind: "cardPulls",
    rewardStones: 220,
    rewardEssence: 12,
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
  },
  {
    id: "wb_tuna",
    title: "吐纳功课",
    desc: "本周吐纳 8 次",
    target: 8,
    kind: "tuna",
    rewardStones: 130,
    rewardEssence: 8,
  },
  {
    id: "wb_realm",
    title: "破境精进",
    desc: "本周破境 2 次",
    target: 2,
    kind: "breakthroughs",
    rewardStones: 320,
    rewardEssence: 18,
  },
];

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

export function normalizeWeeklyBounty(st: GameState): void {
  const now = Date.now();
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
  st.weeklyBounty.claimed = st.weeklyBounty.claimed.filter((x) => typeof x === "string");
}

/** 在周切换时重置进度（在 tick 与关键操作前调用） */
export function ensureWeeklyBountyWeek(state: GameState, now: number): void {
  normalizeWeeklyBounty(state);
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

export function noteWeeklyBountyWave(state: GameState): void {
  ensureWeeklyBountyWeek(state, Date.now());
  state.weeklyBounty.waves += 1;
}

export function noteWeeklyBountyCardPulls(state: GameState, n: number): void {
  ensureWeeklyBountyWeek(state, Date.now());
  state.weeklyBounty.cardPulls += Math.max(0, Math.floor(n));
}

export function noteWeeklyBountyGearForges(state: GameState, n: number): void {
  ensureWeeklyBountyWeek(state, Date.now());
  state.weeklyBounty.gearForges += Math.max(0, Math.floor(n));
}

export function noteWeeklyBountyGardenHarvest(state: GameState): void {
  ensureWeeklyBountyWeek(state, Date.now());
  state.weeklyBounty.gardenHarvests += 1;
}

export function noteWeeklyBountyTuna(state: GameState): void {
  ensureWeeklyBountyWeek(state, Date.now());
  state.weeklyBounty.tuna += 1;
}

export function noteWeeklyBountyBreakthrough(state: GameState): void {
  ensureWeeklyBountyWeek(state, Date.now());
  state.weeklyBounty.breakthroughs += 1;
}

/** 领取单个悬赏；成功返回 true */
export function claimWeeklyBountyTask(state: GameState, taskId: string, now: number): boolean {
  ensureWeeklyBountyWeek(state, now);
  const def = WEEKLY_BOUNTY_TASKS.find((t) => t.id === taskId);
  if (!def) return false;
  if (state.weeklyBounty.claimed.includes(taskId)) return false;
  if (!isWeeklyBountyComplete(state, def)) return false;
  state.weeklyBounty.claimed.push(taskId);
  if (def.rewardStones > 0) addStones(state, def.rewardStones);
  if (def.rewardEssence > 0) state.summonEssence += def.rewardEssence;
  return true;
}

/** 当前周可一键领取的条目数（已达成且未领） */
export function countClaimableWeeklyBounties(state: GameState, now: number): number {
  ensureWeeklyBountyWeek(state, now);
  let n = 0;
  for (const def of WEEKLY_BOUNTY_TASKS) {
    if (isWeeklyBountyClaimed(state, def.id)) continue;
    if (isWeeklyBountyComplete(state, def)) n += 1;
  }
  return n;
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
    if (state.weeklyBounty.claimed.includes(def.id)) continue;
    if (!isWeeklyBountyComplete(state, def)) continue;
    state.weeklyBounty.claimed.push(def.id);
    if (def.rewardStones > 0) {
      addStones(state, def.rewardStones);
      rewardStones += def.rewardStones;
    }
    if (def.rewardEssence > 0) {
      state.summonEssence += def.rewardEssence;
      rewardEssence += def.rewardEssence;
    }
    claimed += 1;
  }
  return { claimed, rewardStones, rewardEssence };
}
