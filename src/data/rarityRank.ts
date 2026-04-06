import type { Rarity } from "../types";

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
