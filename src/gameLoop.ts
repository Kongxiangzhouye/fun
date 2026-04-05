import Decimal from "decimal.js";
import type { GameState } from "./types";
import { ESSENCE_COST_SINGLE, MAX_OFFLINE_SEC_BASE } from "./types";
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

const TICK_MAX_DT = 120;
let autoSalvageAccumSec = 0;
const OFFLINE_RESONANCE_GAIN_MULT = 0.28;

function maxOfflineSec(state: GameState): number {
  return MAX_OFFLINE_SEC_BASE * earthOfflineCapMult(state);
}

function tryAutoRealm(state: GameState): void {
  if (!state.qoL.autoRealm) return;
  const rb = realmBreakthroughCostForState(state);
  if (!canAfford(state, rb)) return;
  if (!subStones(state, rb)) return;
  state.realmLevel += 1;
  noteWeeklyBountyBreakthrough(state);
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
  addStones(state, ips.mul(dt));
  tryAutoRealm(state);
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

export function catchUpOffline(state: GameState, now: number): Decimal {
  if (now < state.lastTick) {
    state.lastTick = now;
    return new Decimal(0);
  }
  const raw = (now - state.lastTick) / 1000;
  const cap = maxOfflineSec(state);
  const dt = Math.min(cap, Math.max(0, raw));
  if (dt < 1) return new Decimal(0);
  const ips = incomePerSecond(state, totalCardsInPool());
  const mult = earthOfflineIncomeMult(state);
  const gained = ips.mul(dt).mul(mult);
  addStones(state, gained);
  state.lastTick = now;
  state.playtimeSec += dt;
  tickInGameClock(state, dt);
  tickWishResonancePassive(state, dt, OFFLINE_RESONANCE_GAIN_MULT);
  tickSkillTraining(state, dt);
  if (!state.dungeon.active) tickCombatHpRegen(state, dt);
  tryCompleteAchievements(state);
  checkTrueEnding(state);
  return gained;
}

/** 闭关令 / 合法跳时：按离线规则瞬间结算 */
export function fastForward(state: GameState, seconds: number): Decimal {
  if (seconds <= 0) return new Decimal(0);
  const dt = Math.min(seconds, maxOfflineSec(state));
  const ips = incomePerSecond(state, totalCardsInPool());
  const mult = earthOfflineIncomeMult(state);
  const gained = ips.mul(dt).mul(mult);
  addStones(state, gained);
  state.playtimeSec += dt;
  tickInGameClock(state, dt);
  tickWishResonancePassive(state, dt, OFFLINE_RESONANCE_GAIN_MULT);
  tickSkillTraining(state, dt);
  if (!state.dungeon.active) tickCombatHpRegen(state, dt);
  tryCompleteAchievements(state);
  checkTrueEnding(state);
  return gained;
}
