import type { Rarity } from "../types";

const RARITY_ZH: Record<Rarity, string> = {
  N: "凡品",
  R: "灵品",
  SR: "珍品",
  SSR: "绝品",
  UR: "天极",
};

export function rarityZh(r: Rarity): string {
  return RARITY_ZH[r] ?? r;
}
