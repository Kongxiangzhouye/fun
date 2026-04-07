import type { GameState, Rarity } from "../types";
import { nextRand01 } from "../rng";
import { daoMeridianLuckFlat } from "./daoMeridian";
import { pickRarityByWeights01 } from "./rarityDraw";

/** 与历史 UI/注释对齐的珍品+保底基准（实际有效值随铸灵阶缩短） */
export const GEAR_SR_PITY_MAX_BASE = 36;

/**
 * 稀有度插值用「基准阶」：1…12 与原 12 阶封顶曲线一致；12 阶之后仍继续升阶，稀有度用 overflow 缓慢右移。
 * （不再作为铸灵阶上限使用。）
 */
export const GEAR_FORGE_TIER_SOFT = 12;

/** @deprecated 使用 GEAR_FORGE_TIER_SOFT；保留导出以免外部旧引用报错 */
export const GEAR_FORGE_TIER_MAX = GEAR_FORGE_TIER_SOFT;

const SCORE_PER_TIER = 18;

/** 珍品保底缩短：仅前若干阶继续缩短，之后恒为下限（与 effectiveGearSrPityMax 一致） */
const PITY_TIER_SUB_CAP = 14;

/** 综合境界、幻域深度、累计铸灵的成长积分（仅用于铸灵阶位） */
export function gearForgeScore(state: GameState): number {
  const r = Math.max(1, state.realmLevel);
  const w = Math.max(0, state.dungeon.maxWaveRecord);
  const f = state.lifetimeStats.gearForgesTotal;
  return (r - 1) * 2.4 + w * 0.32 + f * 0.125;
}

/** 境界铸灵阶（无上限）：越高则稀有度/装等倾向越好，珍品保底在达到缩短下限前略缩短 */
export function gearForgeAscensionLevel(state: GameState): number {
  const s = gearForgeScore(state);
  const t = 1 + Math.floor(s / SCORE_PER_TIER);
  return Math.max(1, t);
}

function gearLuckFactor(state: GameState): number {
  return 1 + state.meta.gachaLuck * 0.02 + daoMeridianLuckFlat(state);
}

/** 与 roll 同分布的原始权重（供抽卡页概率展示） */
export function gearForgeRarityWeightsRaw(state: GameState, tier: number): Record<Rarity, number> {
  const t = Math.max(1, Math.floor(tier));
  const soft = GEAR_FORGE_TIER_SOFT;
  const u =
    soft <= 1 ? 0 : Math.min(1, Math.max(0, (Math.min(t, soft) - 1) / (soft - 1)));
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

  const over = Math.max(0, t - soft);
  if (over > 0) {
    const s = Math.log1p(over);
    wN /= 1 + s * 0.18;
    wR /= 1 + s * 0.14;
    wSr *= 1 + s * 0.1;
    wSsr *= 1 + s * 0.12;
    wUr *= 1 + s * 0.14;
  }

  return { N: wN, R: wR, SR: wSr, SSR: wSsr, UR: wUr };
}

/** 随铸灵阶与灵窍运气偏移的稀有度（仅铸灵池调用） */
export function rollGearRarityForForge(state: GameState, tier: number): Rarity {
  const wMap = gearForgeRarityWeightsRaw(state, tier);
  return pickRarityByWeights01(wMap, nextRand01(state));
}

/** 随阶提高装等加成（阶位可超过 12，装等持续随阶上升） */
export function gearForgeIlvlBonus(tier: number): number {
  const t0 = Math.max(1, Math.floor(tier));
  return Math.floor(Math.max(0, t0 - 1) * 2.2);
}

/** 珍品+保底最大唤数：高阶略缩短，下限 22 */
export function effectiveGearSrPityMax(state: GameState): number {
  const t = gearForgeAscensionLevel(state);
  return Math.max(22, GEAR_SR_PITY_MAX_BASE - Math.min(t - 1, PITY_TIER_SUB_CAP));
}

/** 抽卡页一行说明 */
export function describeGearForgeTierLine(state: GameState): string {
  const t = gearForgeAscensionLevel(state);
  const s = gearForgeScore(state);
  const pm = effectiveGearSrPityMax(state);
  const nextAt = t * SCORE_PER_TIER;
  return `境界铸灵第 ${t} 阶 · 成长积分 ${s.toFixed(1)} / ${nextAt.toFixed(0)} 升下一阶（境界、幻域、累计铸灵）· 珍品+保底最长 ${pm} 唤`;
}
