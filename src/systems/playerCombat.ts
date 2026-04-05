import type { Element, GameState, GearItem, GearStatKey } from "../types";
import {
  DECK_SIZE,
  PLAYER_DUNGEON_HIT_INTERVAL_SEC,
  PLAYER_DEFENSE_K_BASE,
  PLAYER_DEFENSE_K_PER_REALM,
  PLAYER_DEFENSE_K_PER_WAVE,
} from "../types";
import { getCard } from "../data/cards";
import {
  critChanceBonusFromSkills,
  critMultBonusFromSkills,
  defenseFlatBonusFromSkills,
} from "./battleSkills";
import { petDungeonDefenseFlat, petEssenceFindMult } from "./pets";
import { daoMeridianHpMult } from "./daoMeridian";

/** 与 deckSynergy.elementCounts 同规则，避免与 deckSynergy ↔ playerCombat 循环依赖 */
function deckSlotElementCounts(state: GameState): Record<Element, number> {
  const counts: Record<Element, number> = { metal: 0, wood: 0, water: 0, fire: 0, earth: 0 };
  const n = Math.min(DECK_SIZE, 4 + state.meta.deckSlots);
  for (let i = 0; i < n; i++) {
    const id = state.deck[i];
    if (!id) continue;
    const c = getCard(id);
    if (c) counts[c.element]++;
  }
  return counts;
}

/** 厚土 / 溯流灵脉：加算护体（与装备、洞府等合并） */
function deckDefenseFlatBonus(state: GameState): number {
  const c = deckSlotElementCounts(state);
  let d = 0;
  if (c.earth >= 3) d += 12 + c.earth * 2.5;
  if (c.water >= 3) d += 7 + c.water * 1.8;
  return d;
}

function modMult(g: GearItem): number {
  let m = 1 + g.enhanceLevel * 0.012;
  if (g.rarity === "UR") m *= 1 + g.refineLevel * 0.024;
  return m;
}

function sumGearMods(items: GearItem[], key: GearStatKey): number {
  let s = 0;
  for (const g of items) {
    const mm = modMult(g);
    for (const a of [...g.prefixes, ...g.suffixes]) {
      if (a.stat === key) s += a.value * mm;
    }
  }
  return s;
}

export function collectEquippedGear(state: GameState): GearItem[] {
  const out: GearItem[] = [];
  const ids = [state.equippedGear.weapon, state.equippedGear.body, state.equippedGear.ring];
  for (const id of ids) {
    if (id && state.gearInventory[id]) out.push(state.gearInventory[id]!);
  }
  return out;
}

export function combatSkillLevel(state: GameState): number {
  return state.skills.combat.level;
}

export function playerAttack(state: GameState): number {
  const g = collectEquippedGear(state);
  const flat = sumGearMods(g, "atk_flat");
  const inc = sumGearMods(g, "atk_inc") / 100;
  const base = state.realmLevel * 4 + combatSkillLevel(state) * 3 + flat;
  return Math.max(1, base * (1 + inc));
}

export function playerMaxHp(state: GameState): number {
  const g = collectEquippedGear(state);
  const life = sumGearMods(g, "life_flat");
  const base = 100 + state.realmLevel * 12 + combatSkillLevel(state) * 6 + life;
  return Math.max(10, Math.floor(base * daoMeridianHpMult(state)));
}

export function playerCritChance(state: GameState): number {
  const g = collectEquippedGear(state);
  const fromGear = sumGearMods(g, "crit_chance") / 100;
  return Math.min(0.75, fromGear + critChanceBonusFromSkills(state));
}

export function playerCritMult(state: GameState): number {
  const g = collectEquippedGear(state);
  const fromGear = sumGearMods(g, "crit_mult") / 100;
  return 1.5 + fromGear + critMultBonusFromSkills(state);
}

export function essenceFindMult(state: GameState): number {
  const g = collectEquippedGear(state);
  const fromGear = 1 + sumGearMods(g, "essence_find") / 100;
  return fromGear * petEssenceFindMult(state);
}

/** 装备词条：全相抗性合计（% 面数值之和） */
export function playerResAllSum(state: GameState): number {
  const g = collectEquippedGear(state);
  return sumGearMods(g, "res_all");
}


/** 幻域：玩家闪避率（0–1），怪物命中时期望按 (1−闪避) 受伤 */
export function playerDungeonDodgeChance(state: GameState): number {
  return Math.min(0.22, 0.003 * state.realmLevel + 0.002 * combatSkillLevel(state));
}

/** 幻域：玩家攻击距离乘数（叠在基础接战半径上） */
export function playerDungeonAttackRangeMult(state: GameState): number {
  return Math.min(1.4, 1 + 0.0025 * combatSkillLevel(state) + 0.0008 * state.realmLevel);
}

/** 幻域：玩家攻击速度乘数（叠在持续伤害上）；成长已压低，避免前期过快 */
export function playerDungeonAttackSpeedMult(state: GameState): number {
  return Math.min(1.38, 1 + 0.0055 * combatSkillLevel(state) + 0.0018 * state.realmLevel);
}

/**
 * 幻域：攻速折算为「每秒约多少次攻击」（基准间隔 1.5s，攻速缩短间隔）。
 * 实际伤害为离散命中，本值用于界面与期望秒伤。
 */
export function playerDungeonSustainedDamageMult(state: GameState): number {
  return playerDungeonAttackSpeedMult(state) / PLAYER_DUNGEON_HIT_INTERVAL_SEC;
}

/** 期望秒伤（离散命中：攻 × 暴期望 × 攻速 / 基准间隔；不含五行相克） */
export function playerExpectedDps(state: GameState): number {
  const atk = playerAttack(state);
  const cc = playerCritChance(state);
  const cm = playerCritMult(state);
  const cf = (1 - cc) + cc * cm;
  return (atk * cf * playerDungeonAttackSpeedMult(state)) / PLAYER_DUNGEON_HIT_INTERVAL_SEC;
}

/** 顶栏展示用综合战力（用于体现角色攻防成长趋势） */
export function playerCombatPower(state: GameState): number {
  const atk = playerAttack(state);
  const dps = playerExpectedDps(state);
  const hp = playerMaxHp(state);
  const def = playerDefenseRating(state);
  const cc = playerCritChance(state);
  const cm = playerCritMult(state);
  const dodge = playerDungeonDodgeChance(state);
  const score =
    dps * 3.2 +
    atk * 1.4 +
    hp * 0.9 +
    def * 7.5 +
    cc * 220 +
    Math.max(0, cm - 1) * 180 +
    dodge * 240;
  return Math.max(1, Math.floor(score));
}

/** 用于木系等：以「修行时长」替代已移除的周天概念 */
export function woodAdventureDays(state: GameState): number {
  return Math.max(1, 1 + Math.floor(state.playtimeSec / 240));
}

/**
 * 幻域护体：装备 def_flat、境界、战艺、洞府固元、轮回、卡组溯流/厚土、心法、灵宠等合并为单一「护体值」。
 * 受击乘区：K/(K+护体)，K 随波次与境界略升。
 */
export function playerDefenseRating(state: GameState): number {
  const g = collectEquippedGear(state);
  const gearDef = sumGearMods(g, "def_flat");
  const realm = state.realmLevel * 1.05;
  const combat = combatSkillLevel(state) * 0.7;
  const guYuan = state.vein.guYuan * 0.55;
  const reinc = state.reincarnations * 2.2;
  const deck = deckDefenseFlatBonus(state);
  const skills = defenseFlatBonusFromSkills(state);
  const pets = petDungeonDefenseFlat(state);
  return Math.max(0, gearDef + realm + combat + guYuan + reinc + deck + skills + pets);
}

/** 幻域内怪物对玩家造成伤害的乘区（1≈无减免；越小受伤越少） */
export function playerIncomingDamageMult(state: GameState, wave: number): number {
  const def = playerDefenseRating(state);
  const K =
    PLAYER_DEFENSE_K_BASE +
    Math.max(0, wave) * PLAYER_DEFENSE_K_PER_WAVE +
    Math.max(0, state.realmLevel) * PLAYER_DEFENSE_K_PER_REALM;
  const m = K / (K + def);
  return Math.max(0.22, Math.min(1, m));
}
