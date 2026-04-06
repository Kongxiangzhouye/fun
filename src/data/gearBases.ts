import type { Rarity } from "../types";

export interface GearBaseDef {
  id: string;
  name: string;
  slot: "weapon" | "body" | "ring";
  /** 基底物品等级，影响词条 roll 区间 */
  baseItemLevel: number;
}

export const GEAR_BASES: GearBaseDef[] = [
  { id: "blade_wrought", name: "锻纹剑", slot: "weapon", baseItemLevel: 12 },
  { id: "robe_scholar", name: "学者袍", slot: "body", baseItemLevel: 12 },
  { id: "ring_moon", name: "月痕指环", slot: "ring", baseItemLevel: 12 },
  { id: "spear_cloud", name: "穿云枪", slot: "weapon", baseItemLevel: 12 },
  { id: "boots_void", name: "虚行靴", slot: "body", baseItemLevel: 12 },
];

export function getGearBase(id: string): GearBaseDef | undefined {
  return GEAR_BASES.find((b) => b.id === id);
}

export function maxAffixCount(r: Rarity): { p: number; s: number } {
  if (r === "N" || r === "R") return { p: 1, s: 0 };
  if (r === "SR") return { p: 1, s: 1 };
  if (r === "SSR") return { p: 2, s: 2 };
  return { p: 3, s: 3 };
}

/** SSR 与当前养成线一致：强化等级上限与灵卡等级感对齐 */
export function maxEnhanceLevel(r: Rarity): number {
  if (r === "UR") return 40;
  if (r === "SSR") return 30;
  if (r === "SR") return 20;
  if (r === "R") return 15;
  return 10;
}
