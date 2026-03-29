import type { CardDef } from "./types";

export function starMult(stars: number): number {
  return 1 + stars * 0.12;
}

export function levelMult(level: number): number {
  return 1 + (level - 1) * 0.018;
}

/** 单张卡在卡组中的有效产出（线性部分） */
export function cardEffectiveProd(def: CardDef, owned: { stars: number; level: number }): number {
  return def.prod * starMult(owned.stars) * levelMult(owned.level);
}
