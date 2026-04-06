import Decimal from "decimal.js";
import type {
  EstateCommissionActive,
  EstateCommissionOffer,
  EstateCommissionState,
  EstateCommissionType,
  GameState,
} from "../types";
import { addStones } from "../stones";

const COMMISSION_TYPES: EstateCommissionType[] = ["resource", "combat", "cultivation"];

function nextType(seed: number): EstateCommissionType {
  const idx = Math.abs(Math.floor(seed)) % COMMISSION_TYPES.length;
  return COMMISSION_TYPES[idx] ?? "resource";
}

function buildOfferByType(state: GameState, now: number, type: EstateCommissionType): EstateCommissionOffer {
  const realm = Math.max(1, state.realmLevel);
  const durationSec = type === "resource" ? 10 * 60 : type === "combat" ? 14 * 60 : 18 * 60;
  const stoneBase = new Decimal(220 + realm * 34);
  const summon = Math.max(1, Math.floor(1 + realm * 0.26));
  const zhuLing = Math.max(1, Math.floor(1 + realm * 0.2));
  const id = `ec_${type}_${Math.floor(now / 1000)}`;
  if (type === "combat") {
    return {
      id,
      type,
      title: "清剿灵障",
      desc: "派遣弟子清理洞府外环灵障，带回战利品。",
      durationSec,
      reward: { spiritStones: stoneBase.mul(1.2).toFixed(0), summonEssence: summon, zhuLingEssence: zhuLing + 2 },
    };
  }
  if (type === "cultivation") {
    return {
      id,
      type,
      title: "静室参修",
      desc: "封闭静室打坐参修，稳步凝练双髓。",
      durationSec,
      reward: { spiritStones: stoneBase.mul(0.95).toFixed(0), summonEssence: summon + 2, zhuLingEssence: zhuLing + 1 },
    };
  }
  return {
    id,
    type,
    title: "灵材采集",
    desc: "前往洞府矿脉采集灵材，快速换取灵石。",
    durationSec,
    reward: { spiritStones: stoneBase.mul(1.45).toFixed(0), summonEssence: summon, zhuLingEssence: zhuLing },
  };
}

export function createEmptyEstateCommissionState(): EstateCommissionState {
  return { offer: null, active: null, refreshCount: 0 };
}

export function ensureEstateCommissionOffer(state: GameState, now: number): void {
  if (!state.estateCommission) state.estateCommission = createEmptyEstateCommissionState();
  if (state.estateCommission.active || state.estateCommission.offer) return;
  const tp = nextType(now + state.reincarnations + state.estateCommission.refreshCount * 17);
  state.estateCommission.offer = buildOfferByType(state, now, tp);
}

export function refreshEstateCommissionOffer(state: GameState, now: number): boolean {
  if (!state.estateCommission) state.estateCommission = createEmptyEstateCommissionState();
  if (state.estateCommission.active) return false;
  state.estateCommission.refreshCount = Math.max(0, state.estateCommission.refreshCount) + 1;
  const tp = nextType(now + state.estateCommission.refreshCount * 31);
  state.estateCommission.offer = buildOfferByType(state, now, tp);
  return true;
}

export function acceptEstateCommission(state: GameState, now: number): boolean {
  ensureEstateCommissionOffer(state, now);
  const offer = state.estateCommission.offer;
  if (!offer || state.estateCommission.active) return false;
  const active: EstateCommissionActive = {
    offer,
    acceptedAtMs: now,
    dueAtMs: now + offer.durationSec * 1000,
    completedAtMs: null,
  };
  state.estateCommission.active = active;
  state.estateCommission.offer = null;
  return true;
}

export function tickEstateCommission(state: GameState, now: number): void {
  if (!state.estateCommission) state.estateCommission = createEmptyEstateCommissionState();
  const active = state.estateCommission.active;
  if (active && active.completedAtMs == null && now >= active.dueAtMs) {
    active.completedAtMs = now;
  }
  if (!active) ensureEstateCommissionOffer(state, now);
}

export function estateCommissionTimeLeftMs(state: GameState, now: number): number {
  const active = state.estateCommission?.active;
  if (!active || active.completedAtMs != null) return 0;
  return Math.max(0, active.dueAtMs - now);
}

export function settleEstateCommission(state: GameState): boolean {
  const active = state.estateCommission?.active;
  if (!active || active.completedAtMs == null) return false;
  const reward = active.offer.reward;
  if (reward.spiritStones !== "0") addStones(state, new Decimal(reward.spiritStones));
  state.summonEssence += Math.max(0, Math.floor(reward.summonEssence));
  state.zhuLingEssence += Math.max(0, Math.floor(reward.zhuLingEssence));
  state.estateCommission.active = null;
  return true;
}

export function abandonEstateCommission(state: GameState, now: number): boolean {
  if (!state.estateCommission?.active) return false;
  state.estateCommission.active = null;
  const tp = nextType(now + state.estateCommission.refreshCount * 7 + 13);
  state.estateCommission.offer = buildOfferByType(state, now, tp);
  return true;
}

export function normalizeEstateCommissionState(state: GameState, now: number): void {
  if (!state.estateCommission) {
    state.estateCommission = createEmptyEstateCommissionState();
  }
  if (!Number.isFinite(state.estateCommission.refreshCount) || state.estateCommission.refreshCount < 0) {
    state.estateCommission.refreshCount = 0;
  }
  const active = state.estateCommission.active;
  if (active) {
    if (!active.offer || !Number.isFinite(active.acceptedAtMs) || !Number.isFinite(active.dueAtMs)) {
      state.estateCommission.active = null;
    } else if (active.completedAtMs != null && !Number.isFinite(active.completedAtMs)) {
      active.completedAtMs = now;
    }
  }
  tickEstateCommission(state, now);
}

