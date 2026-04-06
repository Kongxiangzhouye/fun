import type { GearItem, GearRarityTier, Rarity } from "../types";

export const GEAR_TIER_LABELS = [
  "凡品",
  "下品",
  "中品",
  "上品",
  "极品",
  "仙品",
  "完美",
  "先天",
  "至宝",
] as const;

const RARITY_BASE_TIER: Record<Rarity, number> = {
  N: 1,
  R: 2,
  SR: 4,
  SSR: 6,
  UR: 7,
};

export function gearVisualTierFor(rarity: Rarity, gearGrade: number): GearRarityTier {
  const base = RARITY_BASE_TIER[rarity] ?? 1;
  const normalizedGrade = Number.isFinite(gearGrade) ? Math.max(1, Math.floor(gearGrade)) : 1;
  const gradeBonus = Math.min(2, Math.floor((normalizedGrade - 1) / 16));
  return Math.min(9, Math.max(1, base + gradeBonus)) as GearRarityTier;
}

export function gearVisualTier(item: Pick<GearItem, "rarity" | "gearGrade" | "gearTier">): GearRarityTier {
  if (Number.isFinite(item.gearTier)) {
    return Math.max(1, Math.min(9, Math.floor(item.gearTier))) as GearRarityTier;
  }
  return gearVisualTierFor(item.rarity, item.gearGrade);
}

/** 旧档 5 档统计（0..4）到新 9 品阶统计（0..8）映射 */
export function legacyGearRank5ToRank9(rank: number): number {
  const r = Math.max(0, Math.min(4, Math.floor(rank)));
  return [0, 2, 4, 6, 8][r] ?? 0;
}

export function gearTierRank(tier: number): number {
  return Math.max(0, Math.min(8, Math.floor(tier) - 1));
}

export function gearTierLabel(tier: number): string {
  const idx = Math.max(1, Math.min(9, Math.floor(tier))) - 1;
  return GEAR_TIER_LABELS[idx] ?? GEAR_TIER_LABELS[0];
}

export function gearTierClass(tier: number): string {
  const normalized = Math.max(1, Math.min(9, Math.floor(tier)));
  return `gear-tier-${normalized}`;
}
