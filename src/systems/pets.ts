import Decimal from "decimal.js";
import type { GameState, PetId } from "../types";
import { normalizeLifetimeStats } from "./pullChronicle";
import { getPetDef, PET_DEFS, PET_RARITY_POWER, type PetDef } from "../data/pets";

/** 与策划一致：累计通关幻域波次 ≥ 此值后开放灵宠池 */
export const PET_SYSTEM_UNLOCK_WAVES = 15;

export const MAX_PET_LEVEL = 60;

/** 单次唤灵消耗唤灵髓 */
export const PET_PULL_COST = 42;

export function petSystemUnlocked(state: GameState): boolean {
  return state.dungeon.totalWavesCleared >= PET_SYSTEM_UNLOCK_WAVES;
}

export function ownedPetIds(state: GameState): PetId[] {
  return Object.keys(state.pets).filter((id) => state.pets[id as PetId] != null) as PetId[];
}

export function petOwned(state: GameState, id: PetId): boolean {
  return state.pets[id] != null;
}

export function xpToNextPetLevel(level: number): number {
  if (level >= MAX_PET_LEVEL) return 0;
  return 16 + level * 3;
}

export function petFeedCost(level: number): number {
  return 8 + Math.floor(Math.max(1, level) * 0.9);
}

export function petFeedXpGain(level: number): number {
  return 16 + Math.floor(Math.max(1, level) * 1.2);
}

function clampPetProgress(p: { level: number; xp: number }): void {
  p.level = Math.min(MAX_PET_LEVEL, Math.max(1, Math.floor(p.level)));
  p.xp = Math.max(0, Math.floor(p.xp));
  if (p.level >= MAX_PET_LEVEL) p.xp = 0;
}

function sqrtLv(level: number): number {
  return Math.sqrt(Math.min(MAX_PET_LEVEL, Math.max(1, level)));
}

function rarityP(def: PetDef): number {
  return PET_RARITY_POWER[def.rarity] * def.power;
}

/** 单宠对灵石乘区的因子 (1+bonus) */
function stoneFactorFromPet(def: PetDef, level: number): Decimal {
  const s = sqrtLv(level);
  const R = rarityP(def);
  if (def.bonusKind === "all") {
    const b = 0.0024 * R * s * def.allSplit;
    return new Decimal(1).plus(b);
  }
  if (def.bonusKind === "stone") {
    const b = 0.0024 * R * s;
    return new Decimal(1).plus(b);
  }
  return new Decimal(1);
}

function dungeonAddFromPet(def: PetDef, level: number): number {
  const s = sqrtLv(level);
  const R = rarityP(def);
  if (def.bonusKind === "all") {
    return 0.003 * R * s * def.allSplit;
  }
  if (def.bonusKind === "dungeon_atk") {
    return 0.003 * R * s;
  }
  return 0;
}

/** 幻域护体：与装备 def_flat、心法等合并为 playerDefenseRating */
function defenseFlatFromPet(def: PetDef, level: number): number {
  const s = sqrtLv(level);
  const R = rarityP(def);
  if (def.bonusKind === "all") {
    return 8 + R * s * def.allSplit * 1.8;
  }
  if (def.bonusKind === "dungeon_def") {
    return 18 + R * s * 3.8;
  }
  return 0;
}

function essenceFactorFromPet(def: PetDef, level: number): number {
  const s = sqrtLv(level);
  const R = rarityP(def);
  if (def.bonusKind === "all") {
    return 1 + 0.0018 * R * s * def.allSplit;
  }
  if (def.bonusKind === "essence_find") {
    return 1 + 0.0018 * R * s;
  }
  return 1;
}

/** 单卡界面：当前等级下该灵宠单独贡献（全局中与其他已结缘灵宠叠乘/加算） */
export function petBonusPreviewLine(def: PetDef, level: number): string {
  if (def.bonusKind === "all") {
    const st = stoneFactorFromPet(def, level).minus(1).times(100).toFixed(2);
    const dng = (dungeonAddFromPet(def, level) * 100).toFixed(2);
    const defn = defenseFlatFromPet(def, level).toFixed(1);
    const ess = essenceFactorFromPet(def, level);
    return `灵石约 +${st}% · 幻域攻 +${dng}% · 护体 +${defn} · 噬髓 ×${ess.toFixed(4)}（万象瑞兽分项）`;
  }
  if (def.bonusKind === "stone") {
    return `灵石汇流 ×${stoneFactorFromPet(def, level).toFixed(4)}`;
  }
  if (def.bonusKind === "dungeon_atk") {
    return `幻域攻加算 +${(dungeonAddFromPet(def, level) * 100).toFixed(2)}%`;
  }
  if (def.bonusKind === "dungeon_def") {
    return `护体 +${defenseFlatFromPet(def, level).toFixed(1)}（幻域受击减免）`;
  }
  return `噬髓叠乘 ×${essenceFactorFromPet(def, level).toFixed(4)}（与装备叠乘）`;
}

/** 全局：所有已邂逅灵宠叠乘 */
export function petStoneIncomeMult(state: GameState): Decimal {
  if (!petSystemUnlocked(state)) return new Decimal(1);
  let m = new Decimal(1);
  for (const id of ownedPetIds(state)) {
    const def = getPetDef(id);
    const pr = state.pets[id];
    if (!def || !pr) continue;
    m = m.mul(stoneFactorFromPet(def, pr.level));
  }
  return m;
}

/** 全局：已邂逅灵宠攻加算求和 */
export function petDungeonAtkAdditive(state: GameState): number {
  if (!petSystemUnlocked(state)) return 0;
  let s = 0;
  for (const id of ownedPetIds(state)) {
    const def = getPetDef(id);
    const pr = state.pets[id];
    if (!def || !pr) continue;
    s += dungeonAddFromPet(def, pr.level);
  }
  return s;
}

/** 全局：灵宠提供的护体值（与装备、心法等合并） */
export function petDungeonDefenseFlat(state: GameState): number {
  if (!petSystemUnlocked(state)) return 0;
  let s = 0;
  for (const id of ownedPetIds(state)) {
    const def = getPetDef(id);
    const pr = state.pets[id];
    if (!def || !pr) continue;
    s += defenseFlatFromPet(def, pr.level);
  }
  return s;
}

/** 全局：已邂逅灵宠噬髓叠乘（不含装备） */
export function petEssenceFindMult(state: GameState): number {
  if (!petSystemUnlocked(state)) return 1;
  let m = 1;
  for (const id of ownedPetIds(state)) {
    const def = getPetDef(id);
    const pr = state.pets[id];
    if (!def || !pr) continue;
    m *= essenceFactorFromPet(def, pr.level);
  }
  return m;
}

/** 喂养：仅已邂逅 */
export function feedPet(state: GameState, id: PetId): boolean {
  if (!petSystemUnlocked(state)) return false;
  if (!petOwned(state, id)) return false;
  const p = state.pets[id]!;
  clampPetProgress(p);
  if (p.level >= MAX_PET_LEVEL) return false;
  const cost = petFeedCost(p.level);
  if (state.summonEssence < cost) return false;
  state.summonEssence -= cost;
  let xp = p.xp + petFeedXpGain(p.level);
  let level = p.level;
  while (level < MAX_PET_LEVEL) {
    const need = xpToNextPetLevel(level);
    if (need <= 0 || xp < need) break;
    xp -= need;
    level += 1;
  }
  if (level >= MAX_PET_LEVEL) {
    p.level = MAX_PET_LEVEL;
    p.xp = 0;
  } else {
    p.level = level;
    p.xp = xp;
  }
  normalizeLifetimeStats(state);
  state.lifetimeStats.petFeeds += 1;
  return true;
}

/** 连续喂养直至唤灵髓不足或已满级；返回成功次数 */
export function feedPetUntilBroke(state: GameState, id: PetId): number {
  let n = 0;
  while (feedPet(state, id)) n += 1;
  return n;
}

/**
 * 主循环用：`uiPrefs.autoFeedPets` 开启时，对已结缘灵宠 id 排序后依次 `feedPetUntilBroke`。
 * 返回本轮累计喂养成功次数；无操作或关闭偏好时返回 null。
 */
export function tryAutoFeedAllPetsIfPref(state: GameState): number | null {
  if (!state.uiPrefs.autoFeedPets) return null;
  if (!petSystemUnlocked(state)) return null;
  const ids = [...ownedPetIds(state)].sort();
  let total = 0;
  for (const id of ids) {
    total += feedPetUntilBroke(state, id);
  }
  return total > 0 ? total : null;
}

/** 重复邂逅或系统奖励：直接加灵契经验并可能升级 */
export function addPetXp(state: GameState, id: PetId, addXp: number): void {
  const p = state.pets[id];
  if (!p || addXp <= 0) return;
  clampPetProgress(p);
  if (p.level >= MAX_PET_LEVEL) return;
  let xp = p.xp + addXp;
  let level = p.level;
  while (level < MAX_PET_LEVEL) {
    const need = xpToNextPetLevel(level);
    if (need <= 0 || xp < need) break;
    xp -= need;
    level += 1;
  }
  if (level >= MAX_PET_LEVEL) {
    p.level = MAX_PET_LEVEL;
    p.xp = 0;
  } else {
    p.level = level;
    p.xp = xp;
  }
}

/** UI：灵宠加成总览（一行） */
export function describePetBonusesSummary(state: GameState): string {
  if (!petSystemUnlocked(state) || ownedPetIds(state).length === 0) {
    return "尚无结缘灵宠，请在唤灵池邂逅。";
  }
  const a = petDungeonAtkAdditive(state);
  const e = petEssenceFindMult(state);
  const st = petStoneIncomeMult(state).minus(1).times(100).toFixed(2);
  const df = petDungeonDefenseFlat(state);
  const defPart = df >= 0.05 ? ` · 护体 +${df.toFixed(1)}` : "";
  return `灵石汇流约 +${st}% · 幻域攻加算 +${(a * 100).toFixed(2)}%${defPart} · 噬髓叠乘 ×${e.toFixed(4)}（全局叠加）`;
}

/** 旧 UI 兼容：按单宠等级估算展示（图鉴用） */
export function petStoneBonusPctFromLevel(level: number): number {
  const s = sqrtLv(level);
  return 100 * 0.0024 * s;
}

export function petDungeonAtkBonusPctFromLevel(level: number): number {
  const s = sqrtLv(level);
  return 100 * 0.003 * s;
}

export function petEssenceBonusPctFromLevel(level: number): number {
  const s = sqrtLv(level);
  return 100 * 0.0018 * s;
}
