import type { CardDef, GameState, GearItem, Rarity } from "./types";
import { CARDS } from "./data/cards";
import { ensureOwned } from "./state";
import { nextRand01 } from "./rng";
import { addStones } from "./stones";
import { metalGachaBonusStones } from "./deckSynergy";
import { generateRandomGear } from "./systems/gearCraft";
import { noteWeeklyBountyCardPulls, noteWeeklyBountyGearForges } from "./systems/weeklyBounty";
import {
  pushGearPullChronicle,
  pushPullChronicle,
  noteGearForgePull,
  recordMaxGearForgedRarity,
} from "./systems/pullChronicle";
import { daoMeridianLuckFlat } from "./systems/daoMeridian";

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
/** 铸灵池：连续未出珍品+（SR 及以上）时触发；与灵卡天极计数独立 */
export const GEAR_SR_PITY_MAX = 36;
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
  const order: Rarity[] = ["UR", "SSR", "SR", "R", "N"];
  for (const ra of order) {
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

function rarityRank(rarity: Rarity): number {
  switch (rarity) {
    case "N":
      return 0;
    case "R":
      return 1;
    case "SR":
      return 2;
    case "SSR":
      return 3;
    case "UR":
      return 4;
    default:
      return 0;
  }
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
  const order: Rarity[] = ["N", "R", "SR", "SSR", "UR"];
  let best: Rarity = "N";
  for (const r of results) {
    if (order.indexOf(r.card.rarity) > order.indexOf(best)) best = r.card.rarity;
  }
  return best;
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

/** 铸灵池单抽：仅装备，不占灵卡 UR/SSR 保底计数；另有珍品+独立保底 */
export function pullGearOne(state: GameState): { ok: true; gear: GearItem } | { ok: false; msg: string } {
  if (Object.keys(state.gearInventory).length >= 80) {
    return { ok: false, msg: "背包装备已满" };
  }
  const forceSrPlus = state.gearPityPulls >= GEAR_SR_PITY_MAX - 1;
  const g = forceSrPlus ? generateRandomGear(state, pickPityGearRarity(state)) : generateRandomGear(state);
  state.gearInventory[g.instanceId] = g;
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
  return { ok: true, gear: g };
}

export function pullGearTen(state: GameState): GearItem[] {
  const out: GearItem[] = [];
  for (let i = 0; i < 10; i++) {
    if (Object.keys(state.gearInventory).length >= 80) break;
    const r = pullGearOne(state);
    if (!r.ok || !r.gear) break;
    out.push(r.gear);
  }
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

/** 铸灵池距珍品+保底剩余唤数（与 gearPityPulls 同步） */
export function gearSrPityRemaining(state: GameState): number {
  return Math.max(0, GEAR_SR_PITY_MAX - state.gearPityPulls);
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
