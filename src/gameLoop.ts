import Decimal from "decimal.js";
import type { GameState } from "./types";
import { ESSENCE_COST_SINGLE, ESSENCE_COST_GEAR_SINGLE, MAX_OFFLINE_SEC_BASE, TUNA_COOLDOWN_MS } from "./types";
import { incomePerSecondAt, realmBreakthroughCostForState } from "./economy";
import { totalCardsInPool } from "./storage";
import { tryCompleteAchievements } from "./achievements";
import { addStones, stones, subStones, canAfford } from "./stones";
import { tickInGameClock } from "./inGameClock";
import { earthOfflineCapMult, earthOfflineIncomeMult } from "./deckSynergy";
import { pullGearOne, pullOne } from "./gacha";
import { onGachaPulls, tickWishResonancePassive } from "./dailyRewards";
import { dungeonBossPrepSnapshot, requestBossChallenge, tickDungeon } from "./systems/dungeon";
import { tickCombatHpRegen } from "./systems/combatHp";
import { tickSkillTraining } from "./systems/skillTraining";
import { tryTuna, tunaCooldownLeftMs } from "./systems/tuna";
import { checkTrueEnding } from "./trueEnding";
import { tryAutoSalvageInventory } from "./systems/salvage";
import { ensureWeeklyBountyWeek, noteWeeklyBountyBreakthrough } from "./systems/weeklyBounty";
import { ensureCelestialStashWeek } from "./systems/celestialStash";
import { tickDailyLoginCalendar } from "./systems/dailyLoginCalendar";
import { tickDailyFortune } from "./systems/dailyFortune";
import { spiritReservoirUnlocked, tickSpiritReservoir } from "./systems/spiritReservoir";
import { tickEstateCommission } from "./systems/estateCommission";

const TICK_MAX_DT = 120;
const TICK_SEGMENT_SEC = 1;
const TICK_MAX_SEGMENTS = 240;
const OFFLINE_RESONANCE_GAIN_MULT = 0.28;
const AUTO_SALVAGE_INTERVAL_SEC = 2.5;

/** 当前存档离线收益秒上限（土系等可抬高） */
export function maxOfflineSec(state: GameState): number {
  return MAX_OFFLINE_SEC_BASE * earthOfflineCapMult(state);
}

/** `catchUpOffline` 返回值：用于离线摘要 UI */
export interface OfflineCatchUpSummary {
  stoneGain: Decimal;
  /** 实际参与结算的秒数（已 cap） */
  settledSec: number;
  /** 离开时长秒（未 cap） */
  rawAwaySec: number;
  /** 本次结算使用的离线上限秒 */
  capSec: number;
  wasCapped: boolean;
}

function tryAutoRealm(state: GameState, now: number): void {
  if (!state.qoL.autoRealm) return;
  const rb = realmBreakthroughCostForState(state);
  if (!canAfford(state, rb)) return;
  if (!subStones(state, rb)) return;
  state.realmLevel += 1;
  noteWeeklyBountyBreakthrough(state, now);
}

function tryAutoTuna(state: GameState, now: number): void {
  if (!state.qoL.autoTuna) return;
  if (tunaCooldownLeftMs(state, now) > 0) return;
  tryTuna(state, now);
}

function tryAutoGacha(state: GameState, now: number): void {
  if (!state.qoL.autoGacha) return;
  if (state.summonEssence < ESSENCE_COST_SINGLE) return;
  if (now - state.lastAutoGachaMs < 2800) return;
  state.lastAutoGachaMs = now;
  state.summonEssence -= ESSENCE_COST_SINGLE;
  pullOne(state);
  onGachaPulls(state, 1);
  tryCompleteAchievements(state);
}

function tryAutoGearForge(state: GameState, now: number): void {
  if (!state.autoGearForge) return;
  if (state.zhuLingEssence < ESSENCE_COST_GEAR_SINGLE) return;
  if (now - state.lastAutoGearForgeMs < 1200) return;
  state.lastAutoGearForgeMs = now;
  state.zhuLingEssence -= ESSENCE_COST_GEAR_SINGLE;
  const r = pullGearOne(state);
  if (!r.ok || !r.gear) {
    state.zhuLingEssence += ESSENCE_COST_GEAR_SINGLE;
    return;
  }
  tryCompleteAchievements(state);
}

function tryAutoBossChallenge(state: GameState, now: number): void {
  if (!state.autoBossChallenge) return;
  if (!state.dungeon.active) return;
  if (!state.dungeonDeferBoss) return;
  if (state.dungeon.wave % 5 !== 0) return;
  if (now - state.lastAutoBossChallengeMs < 500) return;
  const snap = dungeonBossPrepSnapshot(state);
  if (!snap.canChallenge) return;
  state.lastAutoBossChallengeMs = now;
  requestBossChallenge(state);
}

type AutoSchedulerKey = "realm" | "tuna" | "gacha" | "forge" | "boss";

const AUTO_SCHEDULERS: Record<AutoSchedulerKey, (state: GameState, now: number) => void> = {
  realm: tryAutoRealm,
  tuna: tryAutoTuna,
  gacha: tryAutoGacha,
  forge: tryAutoGearForge,
  boss: tryAutoBossChallenge,
};

function runAutoSchedulers(state: GameState, now: number): void {
  for (const key of ["realm", "tuna", "gacha", "forge", "boss"] as const) {
    AUTO_SCHEDULERS[key](state, now);
  }
}

/** 系统时间回调：时间倒流不扣资源（见设计案 §B） */
export function applyTick(state: GameState, now: number): void {
  if (now < state.lastTick) {
    state.lastTick = now;
    return;
  }
  ensureWeeklyBountyWeek(state, now);
  ensureCelestialStashWeek(state, now);
  tickDailyLoginCalendar(state, now);
  tickDailyFortune(state, now);
  tickEstateCommission(state, now);
  const elapsedSec = Math.max(0, (now - state.lastTick) / 1000);
  if (elapsedSec <= 0) return;
  let remainSec = Math.min(TICK_MAX_DT, elapsedSec);
  let segments = 0;
  while (remainSec > 1e-6 && segments < TICK_MAX_SEGMENTS) {
    const dt = Math.min(TICK_SEGMENT_SEC, remainSec);
    // 仅推进已处理的时间，避免大间隔时丢失剩余进度。
    state.lastTick += dt * 1000;
    const tickNow = state.lastTick;
    state.playtimeSec += dt;
    state.lifePlaytimeSec += dt;
    tickInGameClock(state, dt);
    tickWishResonancePassive(state, dt);
    tickSkillTraining(state, dt);
    tickCombatHpRegen(state, dt);
    tickDungeon(state, dt, tickNow);
    const ips = incomePerSecondAt(state, totalCardsInPool(), tickNow);
    if (spiritReservoirUnlocked(state)) tickSpiritReservoir(state, dt, ips);
    addStones(state, ips.mul(dt));
    if (state.autoSalvageAccumSec == null || !Number.isFinite(state.autoSalvageAccumSec)) state.autoSalvageAccumSec = 0;
    state.autoSalvageAccumSec += dt;
    const autoSalvageRuns = Math.floor(state.autoSalvageAccumSec / AUTO_SALVAGE_INTERVAL_SEC);
    if (autoSalvageRuns > 0) {
      state.autoSalvageAccumSec -= autoSalvageRuns * AUTO_SALVAGE_INTERVAL_SEC;
      if (state.autoSalvageAccumSec < 1e-9) state.autoSalvageAccumSec = 0;
      for (let i = 0; i < autoSalvageRuns; i++) {
      tryAutoSalvageInventory(state);
      }
    }
    remainSec -= dt;
    segments += 1;
  }
  runAutoSchedulers(state, state.lastTick);
  tryCompleteAchievements(state);
  checkTrueEnding(state);
}

/** 离线结算与闭关跳时共用的灵石与被动推进（不含 `lastTick`） */
function applyOfflineLikeProgress(
  state: GameState,
  dt: number,
  stoneGain: Decimal,
  ips: Decimal,
  mult: number,
): void {
  if (spiritReservoirUnlocked(state)) tickSpiritReservoir(state, dt, ips.mul(mult));
  addStones(state, stoneGain);
  state.playtimeSec += dt;
  state.lifePlaytimeSec += dt;
  tickInGameClock(state, dt);
  tickWishResonancePassive(state, dt, OFFLINE_RESONANCE_GAIN_MULT);
  tickSkillTraining(state, dt);
  if (!state.dungeon.active) tickCombatHpRegen(state, dt);
  tryCompleteAchievements(state);
  checkTrueEnding(state);
}

function nextWeeklyBoundaryMs(now: number): number {
  const d = new Date(now);
  const day = d.getDay();
  const diffToMon = day === 0 ? 1 : 8 - day;
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() + diffToMon).getTime();
}

function applyOfflineAutoTuna(state: GameState, startMs: number, endMs: number): void {
  if (!state.qoL.autoTuna) return;
  if (endMs <= startMs) return;
  let nextMs = state.lastTunaMs > 0 ? state.lastTunaMs + TUNA_COOLDOWN_MS : startMs;
  if (nextMs < startMs) {
    const skip = Math.floor((startMs - nextMs) / TUNA_COOLDOWN_MS);
    nextMs += skip * TUNA_COOLDOWN_MS;
    while (nextMs < startMs) nextMs += TUNA_COOLDOWN_MS;
  }
  while (nextMs <= endMs) {
    tryTuna(state, nextMs);
    nextMs += TUNA_COOLDOWN_MS;
  }
}

interface OfflineLikeAdvanceResult {
  gained: Decimal;
  settledSec: number;
}

function nextOfflineBoostBoundaryMs(state: GameState, cursorMs: number): number {
  const until = state.offlineAdventure.activeBoostUntilMs;
  if (!Number.isFinite(until) || until <= cursorMs) return Number.POSITIVE_INFINITY;
  return until;
}

function advanceOfflineLikeTimeline(
  state: GameState,
  startMs: number,
  settledSec: number,
  finalWeekSyncMs: number,
): OfflineLikeAdvanceResult {
  if (settledSec <= 1e-6) return { gained: new Decimal(0), settledSec: 0 };
  let gained = new Decimal(0);
  let remainSec = settledSec;
  let cursorMs = startMs;
  ensureWeeklyBountyWeek(state, cursorMs);
  ensureCelestialStashWeek(state, cursorMs);
  while (remainSec > 1e-6) {
    const weekBoundaryMs = nextWeeklyBoundaryMs(cursorMs);
    const boostBoundaryMs = nextOfflineBoostBoundaryMs(state, cursorMs);
    const boundaryMs = Math.min(weekBoundaryMs, boostBoundaryMs);
    const segSec = Math.min(remainSec, Math.max(0, (boundaryMs - cursorMs) / 1000));
    if (segSec <= 1e-6) {
      ensureWeeklyBountyWeek(state, boundaryMs);
      ensureCelestialStashWeek(state, boundaryMs);
      cursorMs = boundaryMs;
      continue;
    }
    const ips = incomePerSecondAt(state, totalCardsInPool(), cursorMs);
    const mult = earthOfflineIncomeMult(state);
    const segGain = ips.mul(segSec).mul(mult);
    applyOfflineLikeProgress(state, segSec, segGain, ips, mult);
    const segStart = cursorMs;
    const segEnd = cursorMs + segSec * 1000;
    applyOfflineAutoTuna(state, segStart, segEnd);
    gained = gained.add(segGain);
    cursorMs = segEnd;
    remainSec -= segSec;
    ensureWeeklyBountyWeek(state, cursorMs);
    ensureCelestialStashWeek(state, cursorMs);
  }
  ensureWeeklyBountyWeek(state, finalWeekSyncMs);
  ensureCelestialStashWeek(state, finalWeekSyncMs);
  return { gained, settledSec };
}

export function catchUpOffline(state: GameState, now: number): OfflineCatchUpSummary {
  const empty = (rawAway: number): OfflineCatchUpSummary => ({
    stoneGain: new Decimal(0),
    settledSec: 0,
    rawAwaySec: Math.max(0, rawAway),
    capSec: 0,
    wasCapped: false,
  });
  if (now < state.lastTick) {
    state.lastTick = now;
    tickEstateCommission(state, now);
    return empty(0);
  }
  const raw = (now - state.lastTick) / 1000;
  const cap = maxOfflineSec(state);
  const dt = Math.min(cap, Math.max(0, raw));
  if (dt < 1) {
    tickEstateCommission(state, now);
    return empty(raw);
  }
  const advanced = advanceOfflineLikeTimeline(state, state.lastTick, dt, now);
  state.lastTick = now;
  tickEstateCommission(state, now);
  return {
    stoneGain: advanced.gained,
    settledSec: advanced.settledSec,
    rawAwaySec: raw,
    capSec: cap,
    wasCapped: raw > cap + 1e-6,
  };
}

/** 闭关令 / 合法跳时：按离线规则瞬间结算 */
export function fastForward(state: GameState, seconds: number, now = Date.now()): Decimal {
  if (seconds <= 0) return new Decimal(0);
  const dt = Math.min(seconds, maxOfflineSec(state));
  if (dt <= 1e-6) return new Decimal(0);
  const advanced = advanceOfflineLikeTimeline(state, state.lastTick, dt, now);
  tickEstateCommission(state, now);
  return advanced.gained;
}
