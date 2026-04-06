import type { CardDef, GameState, GearItem, Rarity } from "./types";
import { RARITY_ORDER_DESC, rarityRank } from "./data/rarityRank";
import { CARDS } from "./data/cards";
import { ensureOwned } from "./state";
import { nextRand01 } from "./rng";
import { addStones } from "./stones";
import { metalGachaBonusStones } from "./deckSynergy";
import { generateRandomGear, gearItemPower } from "./systems/gearCraft";
import { xuanTieFromGearPiece } from "./systems/salvage";
import { noteWeeklyBountyCardPulls, noteWeeklyBountyGearForges } from "./systems/weeklyBounty";
import {
  pushGearPullChronicle,
  pushPullChronicle,
  noteGearForgePull,
  recordMaxGearForgedRarity,
} from "./systems/pullChronicle";
import { daoMeridianLuckFlat } from "./systems/daoMeridian";
import { effectiveGearSrPityMax, GEAR_SR_PITY_MAX_BASE } from "./systems/gearGachaTier";

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

  const total = w.N + w.R + w.SR + w.SSR + w.UR;
  let r = nextRand01(state) * total;
  for (const ra of RARITY_ORDER_DESC) {
    r -= w[ra];
    if (r <= 0) return ra;
  }
  return "N";
}

function randomCardOfRarity(state: GameState, rarity: Rarity): CardDef {
  const pool = CARDS.filter((c) => c.rarity === rarity);
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
 */
function finalizeGearPull(state: GameState, g: GearItem): void {
  const slot = g.slot;
  const curId = state.equippedGear[slot];
  if (!curId) {
    state.gearInventory[g.instanceId] = g;
    state.equippedGear[slot] = g.instanceId;
  } else {
    const cur = state.gearInventory[curId];
    if (!cur) {
      state.gearInventory[g.instanceId] = g;
      state.equippedGear[slot] = g.instanceId;
    } else {
      const np = gearItemPower(g);
      const cp = gearItemPower(cur);
      if (np > cp) {
        state.xuanTie += xuanTieFromGearPiece(cur);
        delete state.gearInventory[curId];
        state.gearInventory[g.instanceId] = g;
        state.equippedGear[slot] = g.instanceId;
      } else {
        state.xuanTie += Math.max(1, Math.floor(xuanTieFromGearPiece(g) * 0.35));
      }
    }
  }
  state.gearPityPulls += 1;
  if (rarityRank(g.rarity) >= rarityRank("SR")) {
    state.gearPityPulls = 0;
  }
  noteGearForgePull(state, 1);
  noteWeeklyBountyGearForges(state, 1);
  recordMaxGearForgedRarity(state, g.rarity);
  pushGearPullChronicle(state, {
    baseId: g.baseId,
    rarity: g.rarity,
    displayName: g.displayName,
  });
}

function applyPullToState(state: GameState, card: CardDef): PullResult {
  const had = !!state.owned[card.id];
  const o = ensureOwned(state, card.id);
  state.codexUnlocked.add(card.id);
  let duplicateStars = false;
  if (had) {
    if (o.stars < 5) {
      o.stars += 1;
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
export function pullGearOne(state: GameState): { ok: true; gear: GearItem } | { ok: false; msg: string } {
  const maxP = effectiveGearSrPityMax(state);
  const forceSrPlus = state.gearPityPulls >= maxP - 1;
  const g = forceSrPlus ? generateRandomGear(state, pickPityGearRarity(state)) : generateRandomGear(state);
  finalizeGearPull(state, g);
  return { ok: true, gear: g };
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
    return out;
  }
  const g = generateRandomGear(state, pickPityGearRarity(state));
  finalizeGearPull(state, g);
  out.push(g);
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
    return out;
  }
  const rarity = pickRarity(state);
  const finalRarity: Rarity = rarityRank(rarity) >= rarityRank("SR") ? rarity : "SR";
  out.push(applyPullToState(state, randomCardOfRarity(state, finalRarity)));
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
  const wSr = 120;
  const wSsr = 68;
  const wUr = 12;
  const t = wSr + wSsr + wUr;
  let r = nextRand01(state) * t;
  r -= wUr;
  if (r <= 0) return "UR";
  r -= wSsr;
  if (r <= 0) return "SSR";
  return "SR";
}
