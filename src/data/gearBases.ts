import type { GearSlot, Rarity } from "../types";

export interface GearBaseDef {
  id: string;
  name: string;
  slot: GearSlot;
  /** 基底物品等级，影响词条 roll 区间 */
  baseItemLevel: number;
}

export const ALL_GEAR_SLOTS: GearSlot[] = [
  "weapon",
  "body",
  "ring",
  "slot4",
  "slot5",
  "slot6",
  "slot7",
  "slot8",
  "slot9",
  "slot10",
  "slot11",
  "slot12",
];

export const GEAR_SLOT_LABEL: Record<GearSlot, string> = {
  weapon: "武器",
  body: "衣甲",
  ring: "指环",
  slot4: "头盔",
  slot5: "护肩",
  slot6: "护手",
  slot7: "腰带",
  slot8: "护腿",
  slot9: "战靴",
  slot10: "项链",
  slot11: "手镯",
  slot12: "护符",
};

export const GEAR_BASES: GearBaseDef[] = [
  { id: "blade_wrought", name: "锻纹剑", slot: "weapon", baseItemLevel: 12 },
  { id: "robe_scholar", name: "学者袍", slot: "body", baseItemLevel: 12 },
  { id: "ring_moon", name: "月痕指环", slot: "ring", baseItemLevel: 12 },
  { id: "spear_cloud", name: "穿云枪", slot: "weapon", baseItemLevel: 12 },
  { id: "boots_void", name: "虚行靴", slot: "body", baseItemLevel: 12 },
  { id: "helm_guard", name: "玄铁盔", slot: "slot4", baseItemLevel: 12 },
  { id: "pauldron_drake", name: "苍鳞肩", slot: "slot5", baseItemLevel: 12 },
  { id: "glove_sigil", name: "印纹护手", slot: "slot6", baseItemLevel: 12 },
  { id: "belt_jade", name: "碧玉束带", slot: "slot7", baseItemLevel: 12 },
  { id: "greaves_cloud", name: "流云护腿", slot: "slot8", baseItemLevel: 12 },
  { id: "boots_star", name: "踏星战靴", slot: "slot9", baseItemLevel: 12 },
  { id: "necklace_spirit", name: "凝灵项链", slot: "slot10", baseItemLevel: 12 },
  { id: "bracelet_tide", name: "潮汐手镯", slot: "slot11", baseItemLevel: 12 },
  { id: "amulet_sun", name: "曜日护符", slot: "slot12", baseItemLevel: 12 },
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
