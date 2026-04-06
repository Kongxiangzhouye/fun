import Decimal from "decimal.js";
import type {
  EstateCommissionActive,
  EstateCommissionOffer,
  EstateCommissionReward,
  EstateCommissionState,
  EstateCommissionType,
  GameState,
} from "../types";
import { addStones } from "../stones";

const COMMISSION_TYPES: EstateCommissionType[] = ["resource", "combat", "cultivation"];
const ESTATE_REFRESH_COOLDOWN_MS = 45_000;
const ESTATE_REFRESH_LIMIT_PER_CYCLE = 3;
const ESTATE_STREAK_THRESHOLDS = [2, 4, 7] as const;

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
  return {
    offer: null,
    active: null,
    refreshCount: 0,
    streak: 0,
    lastSuccessType: null,
    refreshCooldownUntilMs: 0,
  };
}

export function ensureEstateCommissionOffer(state: GameState, now: number): void {
  if (!state.estateCommission) state.estateCommission = createEmptyEstateCommissionState();
  if (state.estateCommission.active || state.estateCommission.offer) return;
  const tp = nextType(now + state.reincarnations + state.estateCommission.refreshCount * 17);
  state.estateCommission.offer = buildOfferByType(state, now, tp);
}

export function refreshEstateCommissionOffer(state: GameState, now: number): boolean {
  const result = getEstateCommissionRefreshStatus(state, now);
  if (!result.canRefresh) return false;
  state.spiritStones = Decimal.max(new Decimal(state.spiritStones).sub(result.costStones), 0).toFixed(0);
  state.estateCommission.refreshCooldownUntilMs = now + ESTATE_REFRESH_COOLDOWN_MS;
  state.estateCommission.refreshCount = Math.max(0, state.estateCommission.refreshCount) + 1;
  const tp = nextType(now + state.estateCommission.refreshCount * 31);
  state.estateCommission.offer = buildOfferByType(state, now, tp);
  return true;
}

function estateStreakBonusRate(streak: number): number {
  const safe = Math.max(0, Math.floor(streak));
  return Math.min(0.6, safe * 0.04);
}

function estateSpecializationBonusRate(streak: number): number {
  const safe = Math.max(0, Math.floor(streak));
  return Math.min(0.2, safe * 0.03);
}

function applyEstateRewardBonus(
  reward: EstateCommissionReward,
  type: EstateCommissionType,
  streak: number,
  lastSuccessType: EstateCommissionType | null,
): EstateCommissionReward {
  const streakRate = estateStreakBonusRate(streak);
  const specializationRate = lastSuccessType === type ? estateSpecializationBonusRate(streak) : 0;
  const stonesMult = 1 + streakRate + (type === "resource" ? specializationRate : 0);
  const summonMult = 1 + streakRate + (type === "cultivation" ? specializationRate : 0);
  const zhuLingMult = 1 + streakRate + (type === "combat" ? specializationRate : 0);
  return {
    spiritStones: new Decimal(reward.spiritStones).mul(stonesMult).toFixed(0),
    summonEssence: Math.max(0, Math.floor(reward.summonEssence * summonMult)),
    zhuLingEssence: Math.max(0, Math.floor(reward.zhuLingEssence * zhuLingMult)),
  };
}

export type EstateCommissionRefreshBlockReason =
  | "none"
  | "active"
  | "cooldown"
  | "insufficient_stones"
  | "limit_reached";

export interface EstateCommissionRefreshStatus {
  canRefresh: boolean;
  reason: EstateCommissionRefreshBlockReason;
  costStones: string;
  cooldownLeftMs: number;
  refreshUsed: number;
  refreshLimit: number;
}

export function getEstateCommissionRefreshStatus(state: GameState, now: number): EstateCommissionRefreshStatus {
  if (!state.estateCommission) state.estateCommission = createEmptyEstateCommissionState();
  const ec = state.estateCommission;
  const refreshUsed = Math.max(0, ec.refreshCount);
  const refreshLimit = ESTATE_REFRESH_LIMIT_PER_CYCLE;
  const cooldownLeftMs = Math.max(0, Math.floor((ec.refreshCooldownUntilMs ?? 0) - now));
  const costStones = new Decimal(90 + refreshUsed * 65).toFixed(0);
  if (ec.active) return { canRefresh: false, reason: "active", costStones, cooldownLeftMs, refreshUsed, refreshLimit };
  if (refreshUsed >= refreshLimit) {
    return { canRefresh: false, reason: "limit_reached", costStones, cooldownLeftMs, refreshUsed, refreshLimit };
  }
  if (cooldownLeftMs > 0) {
    return { canRefresh: false, reason: "cooldown", costStones, cooldownLeftMs, refreshUsed, refreshLimit };
  }
  if (new Decimal(state.spiritStones).lt(costStones)) {
    return { canRefresh: false, reason: "insufficient_stones", costStones, cooldownLeftMs, refreshUsed, refreshLimit };
  }
  return { canRefresh: true, reason: "none", costStones, cooldownLeftMs, refreshUsed, refreshLimit };
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
  const nextStreak = Math.max(0, Math.floor(state.estateCommission.streak)) + 1;
  const reward = applyEstateRewardBonus(
    active.offer.reward,
    active.offer.type,
    nextStreak,
    state.estateCommission.lastSuccessType,
  );
  if (reward.spiritStones !== "0") addStones(state, new Decimal(reward.spiritStones));
  state.summonEssence += Math.max(0, Math.floor(reward.summonEssence));
  state.zhuLingEssence += Math.max(0, Math.floor(reward.zhuLingEssence));
  state.estateCommission.streak = nextStreak;
  state.estateCommission.lastSuccessType = active.offer.type;
  state.estateCommission.refreshCount = 0;
  state.estateCommission.refreshCooldownUntilMs = 0;
  state.estateCommission.active = null;
  return true;
}

export function abandonEstateCommission(state: GameState, now: number): boolean {
  if (!state.estateCommission?.active) return false;
  state.estateCommission.active = null;
  state.estateCommission.streak = Math.max(0, Math.floor(state.estateCommission.streak) - 1);
  state.estateCommission.lastSuccessType = null;
  const tp = nextType(now + state.estateCommission.refreshCount * 7 + 13);
  state.estateCommission.offer = buildOfferByType(state, now, tp);
  return true;
}

export interface EstateCommissionStreakPreview {
  streak: number;
  bonusRate: number;
  nextThreshold: number | null;
  toNextThreshold: number;
  specializationType: EstateCommissionType | null;
  specializationRate: number;
}

export function getEstateCommissionStreakPreview(state: GameState): EstateCommissionStreakPreview {
  if (!state.estateCommission) state.estateCommission = createEmptyEstateCommissionState();
  const streak = Math.max(0, Math.floor(state.estateCommission.streak));
  const nextThreshold = ESTATE_STREAK_THRESHOLDS.find((v) => v > streak) ?? null;
  return {
    streak,
    bonusRate: estateStreakBonusRate(streak),
    nextThreshold,
    toNextThreshold: nextThreshold == null ? 0 : nextThreshold - streak,
    specializationType: state.estateCommission.lastSuccessType,
    specializationRate: estateSpecializationBonusRate(streak),
  };
}

export function normalizeEstateCommissionState(state: GameState, now: number): void {
  if (!state.estateCommission) {
    state.estateCommission = createEmptyEstateCommissionState();
  }
  if (!Number.isFinite(state.estateCommission.refreshCount) || state.estateCommission.refreshCount < 0) {
    state.estateCommission.refreshCount = 0;
  }
  if (!Number.isFinite(state.estateCommission.streak) || state.estateCommission.streak < 0) {
    state.estateCommission.streak = 0;
  }
  if (
    state.estateCommission.lastSuccessType !== "resource" &&
    state.estateCommission.lastSuccessType !== "combat" &&
    state.estateCommission.lastSuccessType !== "cultivation"
  ) {
    state.estateCommission.lastSuccessType = null;
  }
  if (
    !Number.isFinite(state.estateCommission.refreshCooldownUntilMs) ||
    state.estateCommission.refreshCooldownUntilMs < 0
  ) {
    state.estateCommission.refreshCooldownUntilMs = 0;
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

