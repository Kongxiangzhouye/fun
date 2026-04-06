import type { CardDef, GameState, GearItem, Rarity } from "./types";
import { rarityRank } from "./data/rarityRank";
import { CARDS } from "./data/cards";
import { ensureOwned } from "./state";
import { nextRand01 } from "./rng";
import { addStones } from "./stones";
import { metalGachaBonusStones } from "./deckSynergy";
import { generateRandomGear, gearItemPower, slotEnhanceLevel } from "./systems/gearCraft";
import { xuanTieFromGearPiece } from "./systems/salvage";
import { noteWeeklyBountyCardPulls, noteWeeklyBountyGearForges } from "./systems/weeklyBounty";
import {
  pushGearPullChronicle,
  pushPullChronicle,
  noteGearForgePull,
  recordCardStarUpLifetime,
  recordCardTenPullSessionLifetime,
  recordGearTenPullSessionLifetime,
  recordMaxGearForgedRarity,
} from "./systems/pullChronicle";
import { daoMeridianLuckFlat } from "./systems/daoMeridian";
import { effectiveGearSrPityMax, GEAR_SR_PITY_MAX_BASE } from "./systems/gearGachaTier";
import { pickRarityByWeights01 } from "./systems/rarityDraw";

/** 铸灵珍品+保底基准长度（高阶会缩短，见 effectiveGearSrPityMax） */
export const GEAR_SR_PITY_MAX = GEAR_SR_PITY_MAX_BASE;
export { effectiveGearSrPityMax };

/** 基础概率（单抽），会被 meta.gachaLuck 略微提升高稀有 */
const BASE_WEIGHT: Record<Rarity, number> = {
  N: 520,
  R: 280,
  SR: 120,
  SSR: 68,
  UR: 12,
};

const CARD_POOL_BY_RARITY: Record<Rarity, CardDef[]> = {
  N: CARDS.filter((c) => c.rarity === "N"),
  R: CARDS.filter((c) => c.rarity === "R"),
  SR: CARDS.filter((c) => c.rarity === "SR"),
  SSR: CARDS.filter((c) => c.rarity === "SSR"),
  UR: CARDS.filter((c) => c.rarity === "UR"),
};

/** 天极保底计数上限（与 UI 保底条一致） */
export const UR_PITY_MAX = 90;
const SSR_SOFT_START = 65;

function luckFactor(state: GameState): number {
  return 1 + state.meta.gachaLuck * 0.02 + daoMeridianLuckFlat(state);
}

function pickRarity(state: GameState): Rarity {
  const luck = luckFactor(state);
  const w: Record<Rarity, number> = {
    N: BASE_WEIGHT.N / luck,
    R: BASE_WEIGHT.R / Math.pow(luck, 0.3),
    SR: BASE_WEIGHT.SR * Math.pow(luck, 0.5),
    SSR: BASE_WEIGHT.SSR * Math.pow(luck, 0.7),
    UR: BASE_WEIGHT.UR * Math.pow(luck, 0.9),
  };

  const soft = state.pitySsrSoft;
  if (soft >= SSR_SOFT_START) {
    const bump = 1 + (soft - SSR_SOFT_START + 1) * 0.08;
    w.SSR *= bump;
    w.UR *= 1 + (soft - SSR_SOFT_START) * 0.03;
  }

  if (state.pityUr >= UR_PITY_MAX - 1) {
    return "UR";
  }

  return pickRarityByWeights01(w, nextRand01(state));
}

function randomCardOfRarity(state: GameState, rarity: Rarity): CardDef {
  const pool = CARD_POOL_BY_RARITY[rarity];
  if (pool.length <= 0) {
    const fallback = CARD_POOL_BY_RARITY.N;
    const fi = Math.floor(nextRand01(state) * fallback.length);
    return fallback[Math.min(fi, fallback.length - 1)]!;
  }
  const idx = Math.floor(nextRand01(state) * pool.length);
  return pool[Math.min(idx, pool.length - 1)]!;
}

function compensationLingShaForMaxStarDup(rarity: Rarity): number {
  switch (rarity) {
    case "SR":
      return 2;
    case "SSR":
      return 5;
    case "UR":
      return 12;
    default:
      return 0;
  }
}

export interface PullResult {
  card: CardDef;
  isNew: boolean;
  duplicateStars: boolean;
}

export type GearReplaceExpectation = "upgrade" | "even" | "downgrade";

const POWER_COMPARE_EPSILON = 1e-6;

function stablePowerDelta(nextPower: number, currentPower: number): number {
  const delta = nextPower - currentPower;
  if (Math.abs(delta) < POWER_COMPARE_EPSILON) return 0;
  return Math.round(delta * 10000) / 10000;
}

/** 用于抽卡演出：取本批最高稀有度 */
export function highestRarityInPulls(results: PullResult[]): Rarity {
  let best: Rarity = "N";
  let bestRank = rarityRank(best);
  for (const r of results) {
    const rr = rarityRank(r.card.rarity);
    if (rr > bestRank) {
      best = r.card.rarity;
      bestRank = rr;
    }
  }
  return best;
}

/**
 * 境界铸灵：无背包，新装仅能与当前部位比对战力——战力更高则替换并分解旧装；更低或相等则销毁新装并返少量玄铁。
 * 返回本次新装是否成功装备（用于前端决定是否播放演出）。
 */
function finalizeGearPull(state: GameState, g: GearItem): {
  equipped: boolean;
  salvagedXuanTie: number;
  replaceExpectation: GearReplaceExpectation;
  powerDelta: number;
} {
  const slot = g.slot;
  const curId = state.equippedGear[slot];
  if (!curId) {
    state.gearInventory[g.instanceId] = g;
    state.equippedGear[slot] = g.instanceId;
    return commitGearPullMeta(state, g, {
      equipped: true,
      salvagedXuanTie: 0,
      replaceExpectation: "upgrade",
      powerDelta: 0,
    });
  } else {
    const cur = state.gearInventory[curId];
    if (!cur) {
      state.gearInventory[g.instanceId] = g;
      state.equippedGear[slot] = g.instanceId;
      return commitGearPullMeta(state, g, {
        equipped: true,
        salvagedXuanTie: 0,
        replaceExpectation: "upgrade",
        powerDelta: 0,
      });
    } else {
      const slotLv = slotEnhanceLevel(state, slot);
      const np = gearItemPower(g, slotLv);
      const cp = gearItemPower(cur, slotLv);
      const powerDelta = stablePowerDelta(np, cp);
      const replaceExpectation: GearReplaceExpectation =
        powerDelta > 0 ? "upgrade" : powerDelta < 0 ? "downgrade" : "even";
      if (cur.locked) {
        const gain = Math.max(1, Math.floor(xuanTieFromGearPiece(g) * 0.35));
        state.xuanTie += gain;
        return commitGearPullMeta(state, g, { equipped: false, salvagedXuanTie: gain, replaceExpectation, powerDelta });
      } else if (np > cp + POWER_COMPARE_EPSILON) {
        const gain = xuanTieFromGearPiece(cur);
        state.xuanTie += gain;
        delete state.gearInventory[curId];
        state.gearInventory[g.instanceId] = g;
        state.equippedGear[slot] = g.instanceId;
        return commitGearPullMeta(state, g, { equipped: true, salvagedXuanTie: gain, replaceExpectation, powerDelta });
      } else {
        const gain = Math.max(1, Math.floor(xuanTieFromGearPiece(g) * 0.35));
        state.xuanTie += gain;
        return commitGearPullMeta(state, g, { equipped: false, salvagedXuanTie: gain, replaceExpectation, powerDelta });
      }
    }
  }
}

function commitGearPullMeta(
  state: GameState,
  g: GearItem,
  result: {
    equipped: boolean;
    salvagedXuanTie: number;
    replaceExpectation: GearReplaceExpectation;
    powerDelta: number;
  },
): { equipped: boolean; salvagedXuanTie: number; replaceExpectation: GearReplaceExpectation; powerDelta: number } {
  state.gearPityPulls += 1;
  if (rarityRank(g.rarity) >= rarityRank("SR")) {
    state.gearPityPulls = 0;
  }
  noteGearForgePull(state, 1);
  noteWeeklyBountyGearForges(state, 1);
  recordMaxGearForgedRarity(state, g.rarity, g.gearGrade);
  pushGearPullChronicle(state, {
    baseId: g.baseId,
    rarity: g.rarity,
    gearTier: g.gearTier,
    displayName: g.displayName,
  });
  return result;
}

function applyPullToState(state: GameState, card: CardDef): PullResult {
  const had = !!state.owned[card.id];
  const o = ensureOwned(state, card.id);
  state.codexUnlocked.add(card.id);
  let duplicateStars = false;
  if (had) {
    if (o.stars < 5) {
      o.stars += 1;
      recordCardStarUpLifetime(state);
      duplicateStars = true;
    } else {
      state.lingSha += compensationLingShaForMaxStarDup(card.rarity);
    }
  }
  state.totalPulls += 1;
  noteWeeklyBountyCardPulls(state, 1);
  state.pityUr += 1;
  state.pitySsrSoft += 1;
  if (card.rarity === "UR") {
    state.pityUr = 0;
  }
  if (card.rarity === "SSR" || card.rarity === "UR") {
    state.pitySsrSoft = 0;
  }
  const metal = metalGachaBonusStones(state);
  if (metal.gt(0)) {
    addStones(state, metal);
  }
  pushPullChronicle(state, { defId: card.id, rarity: card.rarity, isNew: !had });
  return { card, isNew: !had, duplicateStars };
}

export function pullOne(state: GameState): PullResult {
  const rarity = pickRarity(state);
  const card = randomCardOfRarity(state, rarity);
  return applyPullToState(state, card);
}

/** 境界铸灵单抽：仅装备，不占灵卡 UR/SSR 保底计数；另有珍品+独立保底（随铸灵阶缩短） */
export function pullGearOne(
  state: GameState,
): {
  ok: true;
  gear: GearItem;
  equipped: boolean;
  salvagedXuanTie: number;
  replaceExpectation: GearReplaceExpectation;
  powerDelta: number;
} | { ok: false; msg: string } {
  const maxP = effectiveGearSrPityMax(state);
  const forceSrPlus = state.gearPityPulls >= maxP - 1;
  const g = forceSrPlus ? generateRandomGear(state, pickPityGearRarity(state)) : generateRandomGear(state);
  const result = finalizeGearPull(state, g);
  return {
    ok: true,
    gear: g,
    equipped: result.equipped,
    salvagedXuanTie: result.salvagedXuanTie,
    replaceExpectation: result.replaceExpectation,
    powerDelta: result.powerDelta,
  };
}

/** 十铸：前 9 次正常；若前 9 次无珍品+，第 10 次必为珍品+（与灵卡十连逻辑对齐） */
export function pullGearTen(state: GameState): GearItem[] {
  const out: GearItem[] = [];
  for (let i = 0; i < 9; i++) {
    const r = pullGearOne(state);
    if (!r.ok || !r.gear) break;
    out.push(r.gear);
  }
  if (out.length < 9) return out;
  const hasSrPlus = out.some((g) => rarityRank(g.rarity) >= rarityRank("SR"));
  if (hasSrPlus) {
    const r = pullGearOne(state);
    if (r.ok && r.gear) out.push(r.gear);
    if (out.length === 10) recordGearTenPullSessionLifetime(state);
    return out;
  }
  const g = generateRandomGear(state, pickPityGearRarity(state));
  finalizeGearPull(state, g);
  out.push(g);
  if (out.length === 10) recordGearTenPullSessionLifetime(state);
  return out;
}

export function pullTen(state: GameState): PullResult[] {
  const out: PullResult[] = [];
  for (let i = 0; i < 9; i++) {
    out.push(pullOne(state));
  }
  const hasSrOrBetter = out.some((r) => rarityRank(r.card.rarity) >= rarityRank("SR"));
  if (hasSrOrBetter) {
    out.push(pullOne(state));
  } else {
    const rarity = pickRarity(state);
    const finalRarity: Rarity = rarityRank(rarity) >= rarityRank("SR") ? rarity : "SR";
    out.push(applyPullToState(state, randomCardOfRarity(state, finalRarity)));
  }
  recordCardTenPullSessionLifetime(state);
  return out;
}

export function urPityRemaining(state: GameState): number {
  return Math.max(0, UR_PITY_MAX - state.pityUr);
}

/** 境界铸灵距珍品+保底剩余唤数（与 gearPityPulls 同步；有效上限随铸灵阶变） */
export function gearSrPityRemaining(state: GameState): number {
  return Math.max(0, effectiveGearSrPityMax(state) - state.gearPityPulls);
}

/** 保底触发时在 SR/SSR/UR 间加权（与灵卡高稀有权重比例相近） */
function pickPityGearRarity(state: GameState): Rarity {
  return pickRarityByWeights01(
    {
      N: 0,
      R: 0,
      SR: 120,
      SSR: 68,
      UR: 12,
    },
    nextRand01(state),
  );
}
