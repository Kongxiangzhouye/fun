import type { Rarity } from "../types";

/** 凡品 → 天极（与 `rarityRank` 返回值一致） */
export const RARITY_ORDER_ASC: readonly Rarity[] = ["N", "R", "SR", "SSR", "UR"];

/** 天极 → 凡品（从高稀有先扣权重的加权抽取） */
export const RARITY_ORDER_DESC: readonly Rarity[] = ["UR", "SSR", "SR", "R", "N"];

/** 灵卡/铸灵共用的稀有度序（凡品 0 … 天极 4） */
export function rarityRank(r: Rarity): number {
  switch (r) {
    case "N":
      return 0;
    case "R":
      return 1;
    case "SR":
      return 2;
    case "SSR":
      return 3;
    case "UR":
      return 4;
    default:
      return 0;
  }
}
