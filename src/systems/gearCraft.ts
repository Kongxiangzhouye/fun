import type { GameState, GearAffixRoll, GearItem, GearStatKey, Rarity } from "../types";
import { nextRand01 } from "../rng";
import { GEAR_BASES, getGearBase, maxAffixCount, maxEnhanceLevel } from "../data/gearBases";

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
    text: (v) => `噬髓 唤灵髓发现 ${v.toFixed(1)}%`,
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

function pickRarity(state: GameState): Rarity {
  const r = nextRand01(state);
  if (r < 0.38) return "N";
  if (r < 0.68) return "R";
  if (r < 0.88) return "SR";
  if (r < 0.97) return "SSR";
  return "UR";
}

function rollTier(state: GameState): number {
  return 1 + Math.min(4, Math.floor(nextRand01(state) * 5));
}

function fillMods(
  state: GameState,
  templates: AffixTemplate[],
  count: number,
  ilvl: number,
  rarity: Rarity,
  used: Set<string>,
): GearAffixRoll[] {
  const out: GearAffixRoll[] = [];
  const pool = templates.filter((t) => !used.has(t.groupId));
  for (let i = 0; i < count && pool.length > 0; i++) {
    const pick = pool.splice(Math.floor(nextRand01(state) * pool.length), 1)[0]!;
    used.add(pick.groupId);
    const tier = rollTier(state);
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
  const rarity = forceRarity ?? pickRarity(state);
  const base = GEAR_BASES[Math.floor(nextRand01(state) * GEAR_BASES.length)]!;
  const b = getGearBase(base.id)!;
  const ilvl = Math.floor(b.baseItemLevel + state.realmLevel * 0.9 + state.skills.combat.level * 0.4);
  const counts = maxAffixCount(rarity);
  const usedP = new Set<string>();
  const usedS = new Set<string>();
  const prefixes = fillMods(state, PREFIXES, counts.p, ilvl, rarity, usedP);
  const suffixes = fillMods(state, SUFFIXES, counts.s, ilvl, rarity, usedS);
  const id = `gear_${state.nextGearInstanceId++}`;
  return {
    instanceId: id,
    baseId: base.id,
    displayName: `${b.name}`,
    slot: b.slot,
    rarity,
    itemLevel: ilvl,
    enhanceLevel: 0,
    refineLevel: 0,
    prefixes,
    suffixes,
  };
}

/** UR：消耗另一件同基底同 UR 提升精炼（资质相同） */
export function tryRefineUr(
  state: GameState,
  targetId: string,
  consumeId: string,
): { ok: boolean; msg: string } {
  if (targetId === consumeId) return { ok: false, msg: "不能消耗自身" };
  const a = state.gearInventory[targetId];
  const b = state.gearInventory[consumeId];
  if (!a || !b) return { ok: false, msg: "装备不存在" };
  if (a.rarity !== "UR" || b.rarity !== "UR") return { ok: false, msg: "仅天极可精炼" };
  if (a.baseId !== b.baseId) return { ok: false, msg: "需同基底资质" };
  delete state.gearInventory[consumeId];
  if (state.equippedGear.weapon === consumeId) state.equippedGear.weapon = null;
  if (state.equippedGear.body === consumeId) state.equippedGear.body = null;
  if (state.equippedGear.ring === consumeId) state.equippedGear.ring = null;
  a.refineLevel += 1;
  return { ok: true, msg: "精炼成功" };
}

export function xuanTieEnhanceCost(enhanceLevel: number): number {
  return 4 + enhanceLevel * 3;
}

export function enhanceGear(state: GameState, id: string): { ok: boolean; msg: string } {
  const g = state.gearInventory[id];
  if (!g) return { ok: false, msg: "无此装备" };
  const max = maxEnhanceLevel(g.rarity);
  if (g.enhanceLevel >= max) return { ok: false, msg: "强化已达上限" };
  const cost = xuanTieEnhanceCost(g.enhanceLevel);
  if (state.xuanTie < cost) return { ok: false, msg: "玄铁不足" };
  state.xuanTie -= cost;
  g.enhanceLevel += 1;
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

export function unequipGear(state: GameState, slot: "weapon" | "body" | "ring"): void {
  state.equippedGear[slot] = null;
}
