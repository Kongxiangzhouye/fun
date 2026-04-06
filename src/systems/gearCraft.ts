import type { GameState, GearAffixRoll, GearItem, GearSlot, GearStatKey, Rarity } from "../types";
import { xuanTieFromGearPiece } from "./salvage";
import { GEAR_GRADE_MAX } from "../types";
import { nextRand01 } from "../rng";
import { rarityRank } from "../data/rarityRank";
import { ALL_GEAR_SLOTS, GEAR_BASES, getGearBase, maxAffixCount, maxEnhanceLevel } from "../data/gearBases";
import { gearForgeAscensionLevel, gearForgeIlvlBonus, rollGearRarityForForge } from "./gearGachaTier";
import { gearVisualTierFor } from "../ui/gearVisualTier";

/** 单件装备战力（与顶栏综合战力不同：仅用于同部位替换比对） */
export function gearItemPower(g: GearItem, slotEnhanceLevel = 0): number {
  const rr = rarityRank(g.rarity);
  const grade = Math.max(1, Math.min(GEAR_GRADE_MAX, g.gearGrade ?? 1 + rr * 8));
  let affixSum = 0;
  for (const a of [...g.prefixes, ...g.suffixes]) affixSum += a.value;
  return (
    g.itemLevel * 10 +
    rr * 220 +
    grade * 6 +
    affixSum * 2 +
    Math.max(0, Math.floor(slotEnhanceLevel)) * 22 +
    (g.rarity === "UR" ? g.refineLevel * 55 : 0)
  );
}

export function slotEnhanceLevel(state: GameState, slot: GearSlot): number {
  const raw = state.gearSlotEnhance?.[slot] ?? 0;
  return Math.max(0, Math.floor(Number.isFinite(raw) ? raw : 0));
}

/** 存档迁移：缺省时由稀有度推导筑灵阶 */
export function normalizeGearGrade(g: GearItem): void {
  if (g.gearGrade != null && Number.isFinite(g.gearGrade) && g.gearGrade >= 1) {
    g.gearGrade = Math.min(GEAR_GRADE_MAX, Math.max(1, Math.floor(g.gearGrade)));
    g.gearTier = gearVisualTierFor(g.rarity, g.gearGrade);
    return;
  }
  const rr = rarityRank(g.rarity);
  g.gearGrade = Math.min(GEAR_GRADE_MAX, Math.max(1, rr * 9 + 4));
  g.gearTier = gearVisualTierFor(g.rarity, g.gearGrade);
}

interface AffixTemplate {
  groupId: string;
  stat: GearStatKey;
  roll: (tier: number, ilvl: number, r: Rarity) => number;
  text: (v: number) => string;
}

function findAffixTemplate(groupId: string, stat: GearStatKey): AffixTemplate | null {
  const all = [...PREFIXES, ...SUFFIXES];
  for (const t of all) {
    if (t.groupId === groupId && t.stat === stat) return t;
  }
  return null;
}

const PREFIXES: AffixTemplate[] = [
  {
    groupId: "phys",
    stat: "atk_flat",
    roll: (t, il) => 3 + t * 4 + il * 0.2,
    text: (v) => `锋锐 攻击 +${v.toFixed(0)}`,
  },
  {
    groupId: "vit",
    stat: "life_flat",
    roll: (t, il) => 15 + t * 12 + il * 1.2,
    text: (v) => `根骨 生命 +${v.toFixed(0)}`,
  },
  {
    groupId: "armor",
    stat: "def_flat",
    roll: (t, il) => 6 + t * 5 + il * 0.35,
    text: (v) => `铁壁 护体 +${v.toFixed(0)}`,
  },
  {
    groupId: "ed",
    stat: "atk_inc",
    roll: (t, il) => 4 + t * 3 + il * 0.08,
    text: (v) => `劲力 攻击提高 ${v.toFixed(1)}%`,
  },
  {
    groupId: "hun",
    stat: "essence_find",
    roll: (t, il) => 3 + t * 2 + il * 0.05,
    text: (v) => `噬髓 筑灵髓发现 ${v.toFixed(1)}%`,
  },
];

const SUFFIXES: AffixTemplate[] = [
  {
    groupId: "res",
    stat: "res_all",
    roll: (t, il) => 2 + t * 1.5 + il * 0.03,
    text: (v) => `全相抗性 +${v.toFixed(1)}%`,
  },
  {
    groupId: "crit",
    stat: "crit_chance",
    roll: (t, il) => 1.2 + t * 0.9 + il * 0.02,
    text: (v) => `洞察 暴击率 +${v.toFixed(2)}%`,
  },
  {
    groupId: "cm",
    stat: "crit_mult",
    roll: (t, il) => 6 + t * 4 + il * 0.1,
    text: (v) => `破灭 暴击伤害 +${v.toFixed(1)}%`,
  },
  {
    groupId: "vit2",
    stat: "life_flat",
    roll: (t, il) => 10 + t * 10 + il * 0.9,
    text: (v) => `灵络 生命 +${v.toFixed(0)}`,
  },
  {
    groupId: "ward",
    stat: "def_flat",
    roll: (t, il) => 4 + t * 4 + il * 0.28,
    text: (v) => `罡衣 护体 +${v.toFixed(0)}`,
  },
];

/** 筑灵阶越高，词条 tier 越容易Roll到高位 */
function rollAffixTier(state: GameState, gearGrade: number): number {
  const base = 1 + Math.min(7, Math.floor(gearGrade / 6));
  const jitter = Math.floor(nextRand01(state) * 3);
  return Math.min(8, Math.max(1, base + jitter - 1));
}

function fillMods(
  state: GameState,
  templates: AffixTemplate[],
  count: number,
  ilvl: number,
  rarity: Rarity,
  gearGrade: number,
  used: Set<string>,
): GearAffixRoll[] {
  const out: GearAffixRoll[] = [];
  const pool = templates.filter((t) => !used.has(t.groupId));
  for (let i = 0; i < count && pool.length > 0; i++) {
    const pick = pool.splice(Math.floor(nextRand01(state) * pool.length), 1)[0]!;
    used.add(pick.groupId);
    const tier = rollAffixTier(state, gearGrade);
    const val = pick.roll(tier, ilvl, rarity);
    out.push({
      groupId: pick.groupId,
      stat: pick.stat,
      tier,
      value: val,
      text: pick.text(val),
    });
  }
  return out;
}

export function generateRandomGear(state: GameState, forceRarity?: Rarity): GearItem {
  const forgeTier = gearForgeAscensionLevel(state);
  const rarity = forceRarity ?? rollGearRarityForForge(state, forgeTier);
  // 槽位等权：12 个部位等概率，再在该部位基底池内随机。
  const slot = ALL_GEAR_SLOTS[Math.floor(nextRand01(state) * ALL_GEAR_SLOTS.length)]!;
  const slotBases = GEAR_BASES.filter((x) => x.slot === slot);
  const basePool = slotBases.length > 0 ? slotBases : GEAR_BASES;
  const base = basePool[Math.floor(nextRand01(state) * basePool.length)]!;
  const b = getGearBase(base.id)!;
  const ilvl = Math.floor(
    b.baseItemLevel + state.realmLevel * 0.9 + state.skills.combat.level * 0.4 + gearForgeIlvlBonus(forgeTier),
  );
  const rr = rarityRank(rarity);
  const gearGrade = Math.min(
    GEAR_GRADE_MAX,
    Math.max(
      1,
      rr * 9 + 1 + Math.floor(nextRand01(state) * 10) + Math.floor(ilvl / 28) + Math.floor(forgeTier * 0.35),
    ),
  );
  const counts = maxAffixCount(rarity);
  const usedP = new Set<string>();
  const usedS = new Set<string>();
  const prefixes = fillMods(state, PREFIXES, counts.p, ilvl, rarity, gearGrade, usedP);
  const suffixes = fillMods(state, SUFFIXES, counts.s, ilvl, rarity, gearGrade, usedS);
  const id = `gear_${state.nextGearInstanceId++}`;
  const gearTier = gearVisualTierFor(rarity, gearGrade);
  return {
    instanceId: id,
    baseId: base.id,
    displayName: `${b.name}`,
    slot: b.slot,
    rarity,
    gearTier,
    gearGrade,
    itemLevel: ilvl,
    enhanceLevel: 0,
    refineLevel: 0,
    prefixes,
    suffixes,
    locked: false,
  };
}

/** UR：消耗另一件同基底同 UR 提升精炼（资质相同） */
export function tryRefineUr(
  state: GameState,
  targetId: string,
  consumeId: string,
): { ok: boolean; msg: string } {
  const isEquipped = (id: string): boolean => Object.values(state.equippedGear).some((v) => v === id);
  if (targetId === consumeId) return { ok: false, msg: "不能消耗自身" };
  const a = state.gearInventory[targetId];
  const b = state.gearInventory[consumeId];
  if (!a || !b) return { ok: false, msg: "装备不存在" };
  if (a.rarity !== "UR" || b.rarity !== "UR") return { ok: false, msg: "仅天极可精炼" };
  if (a.baseId !== b.baseId) return { ok: false, msg: "需同基底资质" };
  if (b.locked) return { ok: false, msg: "消耗件已锁定，请先解锁" };
  if (isEquipped(consumeId)) return { ok: false, msg: "请先卸下消耗件" };
  delete state.gearInventory[consumeId];
  a.refineLevel += 1;
  return { ok: true, msg: "精炼成功" };
}

export function xuanTieEnhanceCost(enhanceLevel: number): number {
  return 4 + enhanceLevel * 3;
}

export function enhanceGear(state: GameState, id: string): { ok: boolean; msg: string } {
  const g = state.gearInventory[id];
  if (!g) return { ok: false, msg: "无此装备" };
  const curLv = slotEnhanceLevel(state, g.slot);
  const max = maxEnhanceLevel(g.rarity);
  if (curLv >= max) return { ok: false, msg: "强化已达上限" };
  const cost = xuanTieEnhanceCost(curLv);
  if (state.xuanTie < cost) return { ok: false, msg: "玄铁不足" };
  state.xuanTie -= cost;
  state.gearSlotEnhance[g.slot] = curLv + 1;
  for (const m of [...g.prefixes, ...g.suffixes]) {
    m.value *= 1.035;
    const tpl = findAffixTemplate(m.groupId, m.stat);
    if (tpl) m.text = tpl.text(m.value);
  }
  return { ok: true, msg: "强化成功" };
}

export function equipGear(state: GameState, instanceId: string): { ok: boolean; msg: string } {
  const g = state.gearInventory[instanceId];
  if (!g) return { ok: false, msg: "无此装备" };
  state.equippedGear[g.slot] = instanceId;
  return { ok: true, msg: "已装备" };
}

/** 无背包：卸下视为拆解该件并获得玄铁（与分解规则一致）；已锁定则无法卸下 */
export function unequipGear(state: GameState, slot: GearSlot): boolean {
  const id = state.equippedGear[slot];
  if (!id) return false;
  const g = state.gearInventory[id];
  if (!g) {
    state.equippedGear[slot] = null;
    return true;
  }
  if (g.locked) return false;
  state.xuanTie += xuanTieFromGearPiece(g);
  delete state.gearInventory[id];
  state.equippedGear[slot] = null;
  return true;
}
