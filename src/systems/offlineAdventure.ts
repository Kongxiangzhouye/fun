import Decimal from "decimal.js";
import type { GameState, OfflineAdventureOptionState } from "../types";
import { addStones } from "../stones";

export const OFFLINE_ADVENTURE_TRIGGER_SEC = 45 * 60;
const BOOST_DURATION_SEC = 2 * 3600;

function mkOptions(state: GameState, settledSec: number): [OfflineAdventureOptionState, OfflineAdventureOptionState] {
  const hrs = Math.max(0.5, settledSec / 3600);
  const stoneBase = new Decimal(state.spiritStones || "0");
  const instantStones = Decimal.max(
    120,
    stoneBase.mul(0.012).plus(new Decimal(90).mul(hrs)).toDecimalPlaces(0, Decimal.ROUND_FLOOR),
  );
  const instantEssence = Math.max(1, Math.floor(1 + settledSec / 2700));
  const boostMult = Math.min(1.65, 1.22 + Math.min(0.26, settledSec / 10800));
  const instant: OfflineAdventureOptionState = {
    id: "instant",
    title: "灵脉馈赠",
    desc: "立即获得一笔灵石与唤灵髓，适合立刻冲刺破境与抽卡。",
    instantStones: instantStones.toFixed(0),
    instantEssence,
    boostMult: 1,
    boostDurationSec: 0,
  };
  const boost: OfflineAdventureOptionState = {
    id: "boost",
    title: "静修余韵",
    desc: "激活限时挂机增益，持续期间每秒灵石收益提高。",
    instantStones: "0",
    instantEssence: 0,
    boostMult,
    boostDurationSec: BOOST_DURATION_SEC,
  };
  return [instant, boost];
}

export function maybeQueueOfflineAdventure(state: GameState, settledSec: number, now: number): boolean {
  if (settledSec < OFFLINE_ADVENTURE_TRIGGER_SEC) return false;
  if (state.offlineAdventure.pending) return false;
  state.offlineAdventure.pending = {
    triggeredAtMs: now,
    settledSec,
    options: mkOptions(state, settledSec),
  };
  return true;
}

export function chooseOfflineAdventureOption(state: GameState, optionId: "instant" | "boost", now: number): boolean {
  const pending = state.offlineAdventure.pending;
  if (!pending) return false;
  const picked = pending.options.find((op) => op.id === optionId);
  if (!picked) return false;
  if (picked.instantStones !== "0") addStones(state, new Decimal(picked.instantStones));
  if (picked.instantEssence > 0) state.summonEssence += picked.instantEssence;
  if (picked.boostDurationSec > 0 && picked.boostMult > 1) {
    const base = Math.max(now, state.offlineAdventure.activeBoostUntilMs);
    state.offlineAdventure.activeBoostUntilMs = base + picked.boostDurationSec * 1000;
    state.offlineAdventure.activeBoostMult = Math.max(state.offlineAdventure.activeBoostMult, picked.boostMult);
  }
  state.offlineAdventure.pending = null;
  return true;
}

export function offlineAdventureBoostMult(state: GameState, now: number): number {
  const oa = state.offlineAdventure;
  if (!oa || oa.activeBoostUntilMs <= now) return 1;
  return Math.max(1, oa.activeBoostMult || 1);
}

export function offlineAdventureBoostLeftMs(state: GameState, now: number): number {
  const oa = state.offlineAdventure;
  if (!oa) return 0;
  return Math.max(0, oa.activeBoostUntilMs - now);
}

