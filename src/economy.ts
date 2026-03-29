import type { CardDef, Element, GameState } from "./types";
import { DECK_SIZE, LEVEL_COST_BASE, LEVEL_COST_GAMMA, MAX_CARD_LEVEL } from "./types";
import { getCard } from "./data/cards";
import { countUniqueOwned } from "./state";

/** 境界基础灵石/秒（指数成长，后期靠轮回与元升级） */
export function realmBaseIncome(realmLevel: number): number {
  return 0.35 * Math.pow(1.12, realmLevel - 1);
}

/** 境界突破消耗 */
export function realmBreakthroughCost(realmLevel: number): number {
  return Math.floor(80 * Math.pow(1.55, realmLevel));
}

/** 元素共鸣：卡组中同元素 ≥3 张时，该元素每张额外 +5% 产出（最多 +25% 来自该机制） */
export function elementSynergyMultiplier(deckIds: (string | null)[]): number {
  const counts: Record<Element, number> = {
    metal: 0,
    wood: 0,
    water: 0,
    fire: 0,
    earth: 0,
  };
  for (const id of deckIds) {
    if (!id) continue;
    const c = getCard(id);
    if (c) counts[c.element]++;
  }
  let bonus = 0;
  for (const n of Object.values(counts)) {
    if (n >= 3) {
      const extra = n - 2;
      bonus += Math.min(0.25, extra * 0.05);
    }
  }
  return 1 + bonus;
}

/** 图鉴收集度：每拥有 1 张不同卡 +0.3% 全局灵石（上限 15%） */
export function codexBonusPct(uniqueCards: number, totalCardsInPool: number): number {
  const pct = (uniqueCards / Math.max(1, totalCardsInPool)) * 15;
  return Math.min(15, pct);
}

function starMult(stars: number): number {
  return 1 + stars * 0.12;
}

function levelMult(level: number): number {
  return 1 + (level - 1) * 0.018;
}

/** 单张卡在卡组中的有效产出 */
export function cardEffectiveProd(def: CardDef, owned: { stars: number; level: number }): number {
  return def.prod * starMult(owned.stars) * levelMult(owned.level);
}

/** 卡组境界加成总和（百分比，加算） */
export function deckRealmBonusSum(state: GameState): number {
  let sum = 0;
  const slots = effectiveDeckSlots(state);
  for (let i = 0; i < slots; i++) {
    const id = state.deck[i];
    if (!id) continue;
    const def = getCard(id);
    const o = state.owned[id];
    if (!def || !o) continue;
    const sm = starMult(o.stars);
    sum += def.realmBonusPct * sm;
  }
  return sum;
}

export function effectiveDeckSlots(state: GameState): number {
  return Math.min(DECK_SIZE, 4 + state.meta.deckSlots);
}

/** 灵石/秒 */
export function incomePerSecond(state: GameState, totalCardsInPool: number): number {
  const base = realmBaseIncome(state.realmLevel);
  const realmExtraPct = deckRealmBonusSum(state) / 100;
  const realmMult = 1 + realmExtraPct;
  const codex = 1 + codexBonusPct(countUniqueOwned(state), totalCardsInPool) / 100;
  const elem = elementSynergyMultiplier(state.deck);
  const metaIdle = 1 + state.meta.idleMult * 0.08;
  const metaStone = 1 + state.meta.stoneMult * 0.06;
  const rein = 1 + state.reincarnations * 0.04;

  let deckProd = 0;
  const slots = effectiveDeckSlots(state);
  for (let i = 0; i < slots; i++) {
    const id = state.deck[i];
    if (!id) continue;
    const def = getCard(id);
    const o = state.owned[id];
    if (!def || !o) continue;
    deckProd += cardEffectiveProd(def, o);
  }

  return base * realmMult * codex * elem * metaIdle * metaStone * rein + deckProd;
}

export function upgradeCardLevelCost(level: number): number {
  if (level >= MAX_CARD_LEVEL) return Infinity;
  return Math.floor(LEVEL_COST_BASE * Math.pow(level, LEVEL_COST_GAMMA));
}
