import Decimal from "decimal.js";
import type { GameState } from "./types";
import { ESSENCE_COST_SINGLE, MAX_OFFLINE_SEC_BASE, TUNA_COOLDOWN_MS } from "./types";
import { incomePerSecond, realmBreakthroughCostForState } from "./economy";
import { totalCardsInPool } from "./storage";
import { tryCompleteAchievements } from "./achievements";
import { addStones, stones, subStones, canAfford } from "./stones";
import { tickInGameClock } from "./inGameClock";
import { earthOfflineCapMult, earthOfflineIncomeMult } from "./deckSynergy";
import { pullOne } from "./gacha";
import { onGachaPulls, tickWishResonancePassive } from "./dailyRewards";
import { tickDungeon } from "./systems/dungeon";
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

const TICK_MAX_DT = 120;
let autoSalvageAccumSec = 0;
const OFFLINE_RESONANCE_GAIN_MULT = 0.28;

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
  const elapsedSec = Math.max(0, (now - state.lastTick) / 1000);
  if (elapsedSec <= 0) return;
  const dt = Math.min(TICK_MAX_DT, elapsedSec);
  // 仅推进已处理的时间，避免大间隔时丢失剩余进度。
  state.lastTick += dt * 1000;
  const tickNow = state.lastTick;
  state.playtimeSec += dt;
  tickInGameClock(state, dt);
  tickWishResonancePassive(state, dt);
  tickSkillTraining(state, dt);
  tickCombatHpRegen(state, dt);
  tickDungeon(state, dt, tickNow);
  const ips = incomePerSecond(state, totalCardsInPool());
  if (spiritReservoirUnlocked(state)) tickSpiritReservoir(state, dt, ips);
  addStones(state, ips.mul(dt));
  tryAutoRealm(state, tickNow);
  tryAutoTuna(state, tickNow);
  tryAutoGacha(state, tickNow);
  autoSalvageAccumSec += dt;
  if (autoSalvageAccumSec >= 2.5) {
    autoSalvageAccumSec = 0;
    tryAutoSalvageInventory(state);
  }
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
    return empty(0);
  }
  const raw = (now - state.lastTick) / 1000;
  const cap = maxOfflineSec(state);
  const dt = Math.min(cap, Math.max(0, raw));
  if (dt < 1) return empty(raw);
  const ips = incomePerSecond(state, totalCardsInPool());
  const mult = earthOfflineIncomeMult(state);
  let gained = new Decimal(0);
  let remainSec = dt;
  let cursorMs = state.lastTick;
  ensureWeeklyBountyWeek(state, cursorMs);
  while (remainSec > 1e-6) {
    const boundaryMs = nextWeeklyBoundaryMs(cursorMs);
    const segSec = Math.min(remainSec, Math.max(0, (boundaryMs - cursorMs) / 1000));
    if (segSec <= 1e-6) {
      ensureWeeklyBountyWeek(state, boundaryMs);
      cursorMs = boundaryMs;
      continue;
    }
    const segGain = ips.mul(segSec).mul(mult);
    applyOfflineLikeProgress(state, segSec, segGain, ips, mult);
    const segStart = cursorMs;
    const segEnd = cursorMs + segSec * 1000;
    applyOfflineAutoTuna(state, segStart, segEnd);
    gained = gained.add(segGain);
    cursorMs = segEnd;
    remainSec -= segSec;
    ensureWeeklyBountyWeek(state, cursorMs);
  }
  state.lastTick = now;
  ensureWeeklyBountyWeek(state, now);
  return {
    stoneGain: gained,
    settledSec: dt,
    rawAwaySec: raw,
    capSec: cap,
    wasCapped: raw > cap + 1e-6,
  };
}

/** 闭关令 / 合法跳时：按离线规则瞬间结算 */
export function fastForward(state: GameState, seconds: number): Decimal {
  if (seconds <= 0) return new Decimal(0);
  const dt = Math.min(seconds, maxOfflineSec(state));
  const ips = incomePerSecond(state, totalCardsInPool());
  const mult = earthOfflineIncomeMult(state);
  const gained = ips.mul(dt).mul(mult);
  applyOfflineLikeProgress(state, dt, gained, ips, mult);
  return gained;
}
