import type { GameState } from "../types";
import { BATTLE_SKILLS, getBattleSkill } from "../data/battleSkills";
import { nextRand01 } from "../rng";

const PULL_COST_ESSENCE = 28;

export function battleSkillPullCost(): number {
  return PULL_COST_ESSENCE;
}

/** 随机领悟或升级已有心法 */
export function pullBattleSkill(state: GameState): { ok: boolean; msg: string; id?: string } {
  if (state.summonEssence < PULL_COST_ESSENCE) {
    return { ok: false, msg: "唤灵髓不足" };
  }
  state.summonEssence -= PULL_COST_ESSENCE;
  const roll = nextRand01(state);
  const pick = BATTLE_SKILLS[Math.floor(roll * BATTLE_SKILLS.length)]!;
  const cur = state.battleSkills[pick.id] ?? 0;
  state.battleSkills[pick.id] = Math.min(20, cur + 1);
  return { ok: true, msg: cur === 0 ? `领悟「${pick.name}」` : `「${pick.name}」精进至 Lv.${state.battleSkills[pick.id]}`, id: pick.id };
}

export function dungeonAtkBonusFromSkills(state: GameState): number {
  let s = 0;
  for (const def of BATTLE_SKILLS) {
    const lv = state.battleSkills[def.id] ?? 0;
    if (lv <= 0) continue;
    s += lv * def.dungeonAtkBonusPerLevel;
  }
  return s;
}

export function stoneIncomeBonusFromSkills(state: GameState): number {
  let s = 0;
  for (const def of BATTLE_SKILLS) {
    const lv = state.battleSkills[def.id] ?? 0;
    if (lv <= 0) continue;
    s += lv * def.stoneIncomeBonusPerLevel;
  }
  return s;
}

/** 幻域唤灵髓掉落加算乘区（与 essence_find 叠乘：总倍率 × (1+本值)） */
export function dungeonEssenceBonusFromSkills(state: GameState): number {
  let s = 0;
  for (const def of BATTLE_SKILLS) {
    const lv = state.battleSkills[def.id] ?? 0;
    if (lv <= 0) continue;
    s += lv * def.dungeonEssenceBonusPerLevel;
  }
  return s;
}

/** 暴击率加算（绝对值，与装备叠加以再受 75% 上限） */
export function critChanceBonusFromSkills(state: GameState): number {
  let s = 0;
  for (const def of BATTLE_SKILLS) {
    const lv = state.battleSkills[def.id] ?? 0;
    if (lv <= 0) continue;
    s += lv * def.critChancePerLevel;
  }
  return s;
}

/** 暴伤倍率加算（加在基础 1.5+装备 之上） */
export function critMultBonusFromSkills(state: GameState): number {
  let s = 0;
  for (const def of BATTLE_SKILLS) {
    const lv = state.battleSkills[def.id] ?? 0;
    if (lv <= 0) continue;
    s += lv * def.critMultPerLevel;
  }
  return s;
}

/** 幻域护体加算（与装备 def_flat、洞府固元等合并为 playerDefenseRating） */
export function defenseFlatBonusFromSkills(state: GameState): number {
  let s = 0;
  for (const def of BATTLE_SKILLS) {
    const lv = state.battleSkills[def.id] ?? 0;
    if (lv <= 0) continue;
    s += lv * def.defenseFlatPerLevel;
  }
  return s;
}

/** 幻域移动速度乘区：1 + 加算比例，有下限防止过慢 */
export function dungeonPlayerMoveSpeedMult(state: GameState): number {
  let s = 0;
  for (const def of BATTLE_SKILLS) {
    const lv = state.battleSkills[def.id] ?? 0;
    if (lv <= 0) continue;
    s += lv * def.dungeonMoveSpeedPerLevel;
  }
  return Math.max(0.45, 1 + s);
}

export function describeBattleSkillLevels(state: GameState): string {
  const parts: string[] = [];
  for (const def of BATTLE_SKILLS) {
    const lv = state.battleSkills[def.id] ?? 0;
    if (lv > 0) parts.push(`${def.name} Lv.${lv}`);
  }
  return parts.length ? parts.join(" · ") : "尚未领悟";
}
