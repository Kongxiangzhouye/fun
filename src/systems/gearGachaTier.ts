import type { GameState, Rarity } from "../types";
import { RARITY_ORDER_DESC } from "../data/rarityRank";
import { nextRand01 } from "../rng";
import { daoMeridianLuckFlat } from "./daoMeridian";

/** 与历史 UI/注释对齐的珍品+保底基准（实际有效值随铸灵阶缩短） */
export const GEAR_SR_PITY_MAX_BASE = 36;

/** 铸灵阶上限（随积分升阶） */
export const GEAR_FORGE_TIER_MAX = 12;

const SCORE_PER_TIER = 18;

/** 综合境界、幻域深度、累计铸灵的成长积分（仅用于铸灵阶位） */
export function gearForgeScore(state: GameState): number {
  const r = Math.max(1, state.realmLevel);
  const w = Math.max(0, state.dungeon.maxWaveRecord);
  const f = state.lifetimeStats.gearForgesTotal;
  return (r - 1) * 2.4 + w * 0.32 + f * 0.11;
}

/** 境界铸灵阶 1…MAX，越高则稀有度/装等倾向越好，珍品保底越短 */
export function gearForgeAscensionLevel(state: GameState): number {
  const s = gearForgeScore(state);
  const t = 1 + Math.floor(s / SCORE_PER_TIER);
  return Math.min(GEAR_FORGE_TIER_MAX, Math.max(1, t));
}

function gearLuckFactor(state: GameState): number {
  return 1 + state.meta.gachaLuck * 0.02 + daoMeridianLuckFlat(state);
}

/** 随铸灵阶与灵窍运气偏移的稀有度（仅铸灵池调用） */
export function rollGearRarityForForge(state: GameState, tier: number): Rarity {
  const u = GEAR_FORGE_TIER_MAX <= 1 ? 0 : Math.min(1, Math.max(0, (tier - 1) / (GEAR_FORGE_TIER_MAX - 1)));
  const n0 = 0.38;
  const r0 = 0.3;
  const sr0 = 0.2;
  const ssr0 = 0.09;
  const ur0 = 0.03;
  const n1 = 0.1;
  const r1 = 0.22;
  const sr1 = 0.3;
  const ssr1 = 0.25;
  const ur1 = 0.13;
  let wN = n0 + (n1 - n0) * u;
  let wR = r0 + (r1 - r0) * u;
  let wSr = sr0 + (sr1 - sr0) * u;
  let wSsr = ssr0 + (ssr1 - ssr0) * u;
  let wUr = ur0 + (ur1 - ur0) * u;

  const luck = gearLuckFactor(state);
  wN /= luck;
  wR /= Math.pow(luck, 0.28);
  wSr *= Math.pow(luck, 0.48);
  wSsr *= Math.pow(luck, 0.62);
  wUr *= Math.pow(luck, 0.78);

  const total = wN + wR + wSr + wSsr + wUr;
  let r = nextRand01(state) * total;
  const wMap: Record<Rarity, number> = { N: wN, R: wR, SR: wSr, SSR: wSsr, UR: wUr };
  for (const ra of RARITY_ORDER_DESC) {
    r -= wMap[ra];
    if (r <= 0) return ra;
  }
  return "N";
}

/** 随阶提高装等加成（增量成长感） */
export function gearForgeIlvlBonus(tier: number): number {
  return Math.floor(Math.max(0, tier - 1) * 2.2);
}

/** 珍品+保底最大唤数：高阶略缩短，下限 22 */
export function effectiveGearSrPityMax(state: GameState): number {
  const t = gearForgeAscensionLevel(state);
  return Math.max(22, GEAR_SR_PITY_MAX_BASE - (t - 1));
}

/** 抽卡页一行说明 */
export function describeGearForgeTierLine(state: GameState): string {
  const t = gearForgeAscensionLevel(state);
  const s = gearForgeScore(state);
  const pm = effectiveGearSrPityMax(state);
  if (t >= GEAR_FORGE_TIER_MAX) {
    return `境界铸灵第 ${t} 阶（已满）· 当前珍品+保底最长 ${pm} 唤`;
  }
  const nextAt = t * SCORE_PER_TIER;
  return `境界铸灵第 ${t} 阶 · 成长积分 ${s.toFixed(1)} / ${nextAt.toFixed(0)}（境界、幻域、累计铸灵）· 珍品+保底最长 ${pm} 唤`;
}
