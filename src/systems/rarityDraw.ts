import type { Rarity } from "../types";
import { RARITY_ORDER_DESC } from "../data/rarityRank";

/** 按稀有度权重与一次 [0,1) 随机数抽样（高稀有优先扣权）。 */
export function pickRarityByWeights01(weights: Record<Rarity, number>, roll01: number): Rarity {
  const total = Math.max(0, weights.N + weights.R + weights.SR + weights.SSR + weights.UR);
  if (total <= 0) return "N";
  let r = roll01 * total;
  for (const ra of RARITY_ORDER_DESC) {
    r -= weights[ra];
    if (r <= 0) return ra;
  }
  return "N";
}
