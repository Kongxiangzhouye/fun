import type { CardDef, GameState, Rarity } from "./types";
import { CARDS } from "./data/cards";
import { ensureOwned } from "./state";

/** 基础概率（单抽），会被 meta.gachaLuck 略微提升高稀有 */
const BASE_WEIGHT: Record<Rarity, number> = {
  N: 520,
  R: 280,
  SR: 120,
  SSR: 68,
  UR: 12,
};

const UR_PITY_MAX = 90;
const SSR_SOFT_START = 65;

function luckFactor(state: GameState): number {
  return 1 + state.meta.gachaLuck * 0.02;
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

  // 软保底：65 抽后 SSR 权重递增
  const soft = state.pitySsrSoft;
  if (soft >= SSR_SOFT_START) {
    const bump = 1 + (soft - SSR_SOFT_START + 1) * 0.08;
    w.SSR *= bump;
    w.UR *= 1 + (soft - SSR_SOFT_START) * 0.03;
  }

  // 硬保底：90 抽必 UR
  if (state.pityUr >= UR_PITY_MAX - 1) {
    return "UR";
  }

  const total = w.N + w.R + w.SR + w.SSR + w.UR;
  let r = Math.random() * total;
  const order: Rarity[] = ["UR", "SSR", "SR", "R", "N"];
  for (const ra of order) {
    r -= w[ra];
    if (r <= 0) return ra;
  }
  return "N";
}

function randomCardOfRarity(rarity: Rarity): CardDef {
  const pool = CARDS.filter((c) => c.rarity === rarity);
  return pool[Math.floor(Math.random() * pool.length)]!;
}

export interface PullResult {
  card: CardDef;
  isNew: boolean;
  duplicateStars: boolean;
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
    }
  }
  state.totalPulls += 1;
  state.pityUr += 1;
  state.pitySsrSoft += 1;
  if (card.rarity === "UR") {
    state.pityUr = 0;
  }
  if (card.rarity === "SSR" || card.rarity === "UR") {
    state.pitySsrSoft = 0;
  }
  return { card, isNew: !had, duplicateStars };
}

export function pullOne(state: GameState): PullResult {
  const rarity = pickRarity(state);
  const card = randomCardOfRarity(rarity);
  return applyPullToState(state, card);
}

export function pullTen(state: GameState): PullResult[] {
  const out: PullResult[] = [];
  for (let i = 0; i < 10; i++) {
    out.push(pullOne(state));
  }
  return out;
}

export function urPityRemaining(state: GameState): number {
  return Math.max(0, UR_PITY_MAX - state.pityUr);
}
