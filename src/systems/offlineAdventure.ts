import Decimal from "decimal.js";
import type { GameState, OfflineAdventureOptionState } from "../types";
import { addStones } from "../stones";
import { normalizeLifetimeStats } from "./pullChronicle";

export const OFFLINE_ADVENTURE_TRIGGER_SEC = 45 * 60;
const BOOST_DURATION_SEC = 2 * 3600;
const RESONANCE_STACK_CAP = 6;

export interface OfflineAdventureResonancePreview {
  type: "instant" | "boost" | "essence";
  nextStacks: number;
  summary: string;
}

function nextResonanceStacks(state: GameState, type: "instant" | "boost" | "essence"): number {
  const sameType = state.offlineAdventure.resonanceType === type;
  const base = sameType ? state.offlineAdventure.resonanceStacks + 1 : 1;
  return Math.max(1, Math.min(RESONANCE_STACK_CAP, base));
}

function instantResonanceBonus(stacks: number): { stoneMult: number; essenceFlat: number } {
  const step = Math.max(0, stacks - 1);
  return {
    stoneMult: 1 + Math.min(0.15, step * 0.03),
    essenceFlat: Math.floor(step / 2),
  };
}

function boostResonanceBonus(stacks: number): { boostMultFlat: number; durationSecFlat: number } {
  const step = Math.max(0, stacks - 1);
  return {
    boostMultFlat: Math.min(0.08, step * 0.02),
    durationSecFlat: Math.min(24 * 60, step * 8 * 60),
  };
}

function essenceResonanceBonus(stacks: number): { essenceMult: number } {
  const step = Math.max(0, stacks - 1);
  return {
    essenceMult: 1 + Math.min(0.5, step * 0.1),
  };
}

export function describeOfflineAdventureResonanceRule(type: "instant" | "boost" | "essence", stacks: number): string {
  if (type === "instant") {
    const bonus = instantResonanceBonus(stacks);
    const stonePct = Math.round((bonus.stoneMult - 1) * 100);
    return `连选层数 ${stacks}：灵石 +${stonePct}%` + (bonus.essenceFlat > 0 ? `，额外 +${bonus.essenceFlat} 唤灵髓` : "");
  }
  if (type === "boost") {
    const bonus = boostResonanceBonus(stacks);
    return `连选层数 ${stacks}：倍率额外 +${bonus.boostMultFlat.toFixed(2)}，时长 +${Math.floor(bonus.durationSecFlat / 60)} 分`;
  }
  const bonus = essenceResonanceBonus(stacks);
  return `连选层数 ${stacks}：双髓 +${Math.round((bonus.essenceMult - 1) * 100)}%`;
}

export function previewOfflineAdventureResonance(
  state: GameState,
  type: "instant" | "boost" | "essence",
): OfflineAdventureResonancePreview {
  const nextStacks = nextResonanceStacks(state, type);
  return {
    type,
    nextStacks,
    summary: describeOfflineAdventureResonanceRule(type, nextStacks),
  };
}

/** 供旧档二选一 pending 迁移为第三项「髓潮归元」 */
export function buildEssenceOptionForSettledSec(settledSec: number): OfflineAdventureOptionState {
  const hrs = Math.max(0.5, settledSec / 3600);
  const instantEssence = Math.max(28, Math.floor(18 + settledSec / 95 + hrs * 6));
  const zhuLingBonus = Math.max(10, Math.floor(7 + settledSec / 220 + hrs * 4));
  return {
    id: "essence",
    title: "髓潮归元",
    desc: "唤灵髓与筑灵髓一并涌至，适合冲刺唤引与铸灵。",
    instantStones: "0",
    instantEssence,
    boostMult: 1,
    boostDurationSec: 0,
    zhuLingBonus,
  };
}

function mkOptions(state: GameState, settledSec: number): [
  OfflineAdventureOptionState,
  OfflineAdventureOptionState,
  OfflineAdventureOptionState,
] {
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
  const essence = buildEssenceOptionForSettledSec(settledSec);
  return [instant, boost, essence];
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

export function chooseOfflineAdventureOption(
  state: GameState,
  optionId: "instant" | "boost" | "essence",
  now: number,
): boolean {
  const pending = state.offlineAdventure.pending;
  if (!pending) return false;
  const picked = pending.options.find((op) => op.id === optionId);
  if (!picked) return false;
  const stacks = nextResonanceStacks(state, optionId);
  let instantStones = new Decimal(picked.instantStones || "0");
  let instantEssence = picked.instantEssence;
  let zhuLingBonus = picked.zhuLingBonus ?? 0;
  let boostMult = picked.boostMult;
  let boostDurationSec = picked.boostDurationSec;
  if (optionId === "instant") {
    const b = instantResonanceBonus(stacks);
    instantStones = instantStones.mul(b.stoneMult).toDecimalPlaces(0, Decimal.ROUND_FLOOR);
    instantEssence += b.essenceFlat;
  } else if (optionId === "boost") {
    const b = boostResonanceBonus(stacks);
    boostMult += b.boostMultFlat;
    boostDurationSec += b.durationSecFlat;
  } else {
    const b = essenceResonanceBonus(stacks);
    instantEssence = Math.floor(instantEssence * b.essenceMult);
    zhuLingBonus = Math.floor(zhuLingBonus * b.essenceMult);
  }
  if (!instantStones.isZero()) addStones(state, instantStones);
  if (instantEssence > 0) state.summonEssence += instantEssence;
  if (zhuLingBonus > 0) state.zhuLingEssence += zhuLingBonus;
  if (boostDurationSec > 0 && boostMult > 1) {
    const active = state.offlineAdventure.activeBoostUntilMs > now;
    const currentMult = Math.max(1, state.offlineAdventure.activeBoostMult || 1);
    if (!active) {
      state.offlineAdventure.activeBoostUntilMs = now + boostDurationSec * 1000;
      state.offlineAdventure.activeBoostMult = boostMult;
    } else if (boostMult >= currentMult) {
      state.offlineAdventure.activeBoostUntilMs += boostDurationSec * 1000;
      state.offlineAdventure.activeBoostMult = boostMult;
    }
  }
  if (picked.id === "boost") {
    normalizeLifetimeStats(state);
    state.lifetimeStats.offlineAdventureBoostPicks += 1;
  }
  state.offlineAdventure.pending = null;
  state.offlineAdventure.resonanceType = optionId;
  state.offlineAdventure.resonanceStacks = stacks;
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

export function normalizeOfflineAdventureState(state: GameState, now: number): void {
  const oa = state.offlineAdventure;
  if (!oa) {
    state.offlineAdventure = {
      pending: null,
      activeBoostUntilMs: 0,
      activeBoostMult: 1,
      resonanceType: null,
      resonanceStacks: 0,
    };
    return;
  }
  if (!Number.isFinite(oa.activeBoostUntilMs)) oa.activeBoostUntilMs = 0;
  if (!Number.isFinite(oa.activeBoostMult) || oa.activeBoostMult < 1) oa.activeBoostMult = 1;
  if (oa.activeBoostUntilMs <= now) {
    oa.activeBoostUntilMs = 0;
    oa.activeBoostMult = 1;
  }
  if (oa.resonanceType !== "instant" && oa.resonanceType !== "boost" && oa.resonanceType !== "essence") {
    oa.resonanceType = null;
  }
  if (!Number.isFinite(oa.resonanceStacks) || oa.resonanceStacks < 0) oa.resonanceStacks = 0;
  oa.resonanceStacks = Math.max(0, Math.min(RESONANCE_STACK_CAP, Math.floor(oa.resonanceStacks)));
  if (!oa.pending) return;
  const p = oa.pending;
  if (!Number.isFinite(p.triggeredAtMs) || !Number.isFinite(p.settledSec) || !Array.isArray(p.options) || p.options.length !== 3) {
    oa.pending = null;
    return;
  }
}
