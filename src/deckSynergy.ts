import Decimal from "decimal.js";
import type { Element, GameState } from "./types";
import { DECK_SIZE } from "./types";
import { getCard } from "./data/cards";
import { cardEffectiveProd } from "./cardStats";
import { woodAdventureDays } from "./systems/playerCombat";

function effectiveSlots(state: GameState): number {
  return Math.min(DECK_SIZE, 4 + state.meta.deckSlots);
}

export function elementCounts(state: GameState): Record<Element, number> {
  const counts: Record<Element, number> = { metal: 0, wood: 0, water: 0, fire: 0, earth: 0 };
  const n = effectiveSlots(state);
  for (let i = 0; i < n; i++) {
    const id = state.deck[i];
    if (!id) continue;
    const c = getCard(id);
    if (c) counts[c.element]++;
  }
  return counts;
}

export function fireSynergyActive(state: GameState): boolean {
  return elementCounts(state).fire >= 3;
}

export function metalSynergyActive(state: GameState): boolean {
  return elementCounts(state).metal >= 3;
}

export function earthSynergyActive(state: GameState): boolean {
  return elementCounts(state).earth >= 3;
}

/** 木系：以修行时长为「岁序」替代已移除的周天概念 */
export function woodLifeDays(state: GameState): number {
  return woodAdventureDays(state);
}

function woodScaling(state: GameState): Decimal {
  const c = elementCounts(state).wood;
  if (c < 3) return new Decimal(1);
  const d = woodLifeDays(state);
  return new Decimal(1).plus(new Decimal(d).ln().times(0.08).plus(0.02 * d));
}

/** 金系：抽卡返利强度（与金属性卡总战力挂钩） */
export function metalGachaBonusStones(state: GameState): Decimal {
  if (!metalSynergyActive(state)) return new Decimal(0);
  let sum = 0;
  const n = effectiveSlots(state);
  for (let i = 0; i < n; i++) {
    const id = state.deck[i];
    if (!id) continue;
    const def = getCard(id);
    const o = state.owned[id];
    if (!def || def.element !== "metal" || !o) continue;
    sum += cardEffectiveProd(def, o);
  }
  return new Decimal(sum).mul(18).add(120);
}

/** 土系：离线秒上限倍率 */
export function earthOfflineCapMult(state: GameState): number {
  return earthSynergyActive(state) ? 2 : 1;
}

/** 土系：离线灵石倍率 */
export function earthOfflineIncomeMult(state: GameState): number {
  return earthSynergyActive(state) ? 1.45 : 1;
}

/** 焚天：等价挂机小时数 */
export function fenTianHours(state: GameState): number {
  const n = effectiveSlots(state);
  let fireStars = 0;
  let fireN = 0;
  for (let i = 0; i < n; i++) {
    const id = state.deck[i];
    if (!id) continue;
    const def = getCard(id);
    const o = state.owned[id];
    if (!def || def.element !== "fire" || !o) continue;
    fireN++;
    fireStars += o.stars;
  }
  if (fireN < 3) return 0;
  return 1.2 + fireN * 0.35 + (fireStars / Math.max(1, fireN)) * 0.15;
}

/** 焚天 CD（毫秒） */
export function fenTianCooldownMs(state: GameState): number {
  const n = elementCounts(state).fire;
  return Math.max(35_000, 150_000 - n * 12_000);
}

/**
 * 卡组灵石/秒（卡牌部分）：水系指数链、木系岁月、非水线性加总
 */
export function computeDeckProdDecimal(state: GameState): Decimal {
  const slots = effectiveSlots(state);
  const woodM = woodScaling(state);

  type SlotInfo = { defId: string; element: Element; base: number };
  const order: SlotInfo[] = [];
  for (let i = 0; i < slots; i++) {
    const id = state.deck[i];
    if (!id) continue;
    const def = getCard(id);
    const o = state.owned[id];
    if (!def || !o) continue;
    let base = cardEffectiveProd(def, o);
    if (def.element === "wood" && elementCounts(state).wood >= 3) {
      base *= woodM.toNumber();
    }
    order.push({ defId: id, element: def.element, base });
  }

  let nonWater = new Decimal(0);
  let waterChain: Decimal | null = null;

  for (const s of order) {
    if (s.element !== "water") {
      nonWater = nonWater.add(s.base);
      continue;
    }
    const b = new Decimal(s.base);
    if (waterChain === null) {
      waterChain = b;
    } else {
      waterChain = b.mul(waterChain.pow(1.05));
    }
  }

  const waterPart = waterChain ?? new Decimal(0);
  return nonWater.add(waterPart);
}

/** 卡组页展示的灵脉一句话 */
export function deckSynergySummary(state: GameState): string {
  const c = elementCounts(state);
  const parts: string[] = [];
  if (c.fire >= 3) parts.push("焚天");
  if (c.water >= 3) parts.push("溯流（护体）");
  if (c.wood >= 3) parts.push("岁木");
  if (c.metal >= 3) parts.push("剑虹");
  if (c.earth >= 3) parts.push("厚土（护体）");
  if (parts.length === 0) {
    return "未激活灵脉（同系≥3 张上阵）。详情见图鉴·札记。";
  }
  return "灵脉：" + parts.join("、") + "。";
}
