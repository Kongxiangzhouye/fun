import Decimal from "decimal.js";
import type { GameState } from "./types";
import { DECK_SIZE, LEVEL_COST_BASE, LEVEL_COST_GAMMA, MAX_CARD_LEVEL } from "./types";
import { getCard } from "./data/cards";
import { idleLingXiFactor } from "./inGameClock";
import { starMult } from "./cardStats";
import { computeDeckProdDecimal } from "./deckSynergy";
import { veinGuYuanDiscount, veinHuiLingMult, veinLingXiMult } from "./systems/veinCultivation";
import { stoneIncomeBonusFromSkills } from "./systems/battleSkills";
import { petStoneIncomeMult } from "./systems/pets";
import { daoMeridianStoneMult } from "./systems/daoMeridian";
import { dailyFortuneStoneMult } from "./systems/dailyFortune";
import { spiritArrayStoneMult } from "./systems/spiritArray";
import { spiritTideStoneMult } from "./systems/spiritTide";
import { offlineAdventureBoostMult } from "./systems/offlineAdventure";

/** 境界基础灵石/秒（指数成长，后期靠轮回与元升级） */
export function realmBaseIncome(realmLevel: number): Decimal {
  return new Decimal(0.35).mul(new Decimal(1.12).pow(realmLevel - 1));
}

/** 境界突破消耗 */
export function realmBreakthroughCost(realmLevel: number): Decimal {
  return new Decimal(Math.floor(80 * Math.pow(1.55, realmLevel)));
}

/** 含洞府「固元」减免的破境消耗 */
export function realmBreakthroughCostForState(state: GameState): Decimal {
  const raw = realmBreakthroughCost(state.realmLevel);
  const d = veinGuYuanDiscount(state.vein.guYuan);
  return raw.mul(new Decimal(1).minus(d));
}

/** 图鉴收集度：每拥有 1 张不同卡 +0.3% 全局灵石（上限 15%） */
export function codexBonusPct(uniqueCards: number, totalCardsInPool: number): number {
  const pct = (uniqueCards / Math.max(1, totalCardsInPool)) * 15;
  return Math.min(15, pct);
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

/** 灵石/秒（五行构筑 + 洞府蕴灵；显式时间语义） */
export function incomePerSecondAt(state: GameState, totalCardsInPool: number, nowMs: number): Decimal {
  const now = nowMs;
  const vigBase = idleLingXiFactor(state) * veinLingXiMult(state.vein.lingXi);
  const vigFactor = new Decimal(vigBase);
  const base = realmBaseIncome(state.realmLevel);
  const realmExtraPct = deckRealmBonusSum(state) / 100;
  const realmMult = new Decimal(1).plus(realmExtraPct);
  const codex = new Decimal(1).plus(codexBonusPct(state.codexUnlocked.size, totalCardsInPool) / 100);
  const metaIdle = new Decimal(1).plus(state.meta.idleMult * 0.08);
  const metaStone = new Decimal(1).plus(state.meta.stoneMult * 0.06);
  const rein = new Decimal(1).plus(state.reincarnations * 0.06);
  const gather = new Decimal(1).plus(state.skills.gathering.level * 0.0045);
  const skillsStone = new Decimal(1).plus(stoneIncomeBonusFromSkills(state));

  const deckProd = computeDeckProdDecimal(state);
  const core = base.plus(deckProd);
  const hui = new Decimal(veinHuiLingMult(state.vein.huiLing));
  return core
    .mul(realmMult)
    .mul(codex)
    .mul(metaIdle)
    .mul(metaStone)
    .mul(rein)
    .mul(vigFactor)
    .mul(hui)
    .mul(gather)
    .mul(skillsStone)
    .mul(petStoneIncomeMult(state))
    .mul(daoMeridianStoneMult(state))
    .mul(dailyFortuneStoneMult(state))
    .mul(spiritArrayStoneMult(state))
    .mul(spiritTideStoneMult(state))
    .mul(offlineAdventureBoostMult(state, now));
}

/** 兼容旧调用：未传时间时使用当前时刻。 */
export function incomePerSecond(state: GameState, totalCardsInPool: number): Decimal {
  return incomePerSecondAt(state, totalCardsInPool, Date.now());
}

/** 每秒灵石拆成「境界基息」与「灵卡汇流」，便于界面展示成长来源 */
export function incomeBreakdownForDisplay(
  state: GameState,
  totalCardsInPool: number,
  nowMs = Date.now(),
): { total: Decimal; fromRealm: Decimal; fromDeck: Decimal } {
  const now = nowMs;
  const vigBase = idleLingXiFactor(state) * veinLingXiMult(state.vein.lingXi);
  const vigFactor = new Decimal(vigBase);
  const base = realmBaseIncome(state.realmLevel);
  const realmExtraPct = deckRealmBonusSum(state) / 100;
  const realmMult = new Decimal(1).plus(realmExtraPct);
  const codex = new Decimal(1).plus(codexBonusPct(state.codexUnlocked.size, totalCardsInPool) / 100);
  const metaIdle = new Decimal(1).plus(state.meta.idleMult * 0.08);
  const metaStone = new Decimal(1).plus(state.meta.stoneMult * 0.06);
  const rein = new Decimal(1).plus(state.reincarnations * 0.06);
  const gather = new Decimal(1).plus(state.skills.gathering.level * 0.0045);
  const deckProd = computeDeckProdDecimal(state);
  const hui = new Decimal(veinHuiLingMult(state.vein.huiLing));
  const skillsStone = new Decimal(1).plus(stoneIncomeBonusFromSkills(state));
  const mult = realmMult
    .mul(codex)
    .mul(metaIdle)
    .mul(metaStone)
    .mul(rein)
    .mul(vigFactor)
    .mul(hui)
    .mul(gather)
    .mul(skillsStone)
    .mul(petStoneIncomeMult(state));
  const meridian = daoMeridianStoneMult(state);
  const fortune = dailyFortuneStoneMult(state);
  const arr = spiritArrayStoneMult(state);
  const tide = spiritTideStoneMult(state);
  const fromRealm = base.mul(mult).mul(meridian).mul(fortune).mul(arr).mul(tide);
  const fromDeck = deckProd.mul(mult).mul(meridian).mul(fortune).mul(arr).mul(tide);
  const boosted = fromRealm.plus(fromDeck).mul(offlineAdventureBoostMult(state, now));
  const boostMul = offlineAdventureBoostMult(state, now);
  if (boostMul <= 1) return { total: boosted, fromRealm, fromDeck };
  const scale = boosted.div(fromRealm.plus(fromDeck));
  return { total: boosted, fromRealm: fromRealm.mul(scale), fromDeck: fromDeck.mul(scale) };
}

/** 每秒收益来源（3 项）：境界原息 / 灵卡原息 / 各类加成增益 */
export function incomeSourceBreakdownForDisplay(
  state: GameState,
  totalCardsInPool: number,
  nowMs = Date.now(),
): { total: Decimal; realmCore: Decimal; deckCore: Decimal; boostBonus: Decimal } {
  const total = incomePerSecondAt(state, totalCardsInPool, nowMs);
  const base = realmBaseIncome(state.realmLevel);
  const deckProd = computeDeckProdDecimal(state);
  const core = base.plus(deckProd);
  const realmCore = base;
  const deckCore = deckProd;
  const boostBonus = Decimal.max(0, total.minus(core));
  return { total, realmCore, deckCore, boostBonus };
}

export function upgradeCardLevelCost(level: number): Decimal {
  if (level >= MAX_CARD_LEVEL) return new Decimal("Infinity");
  return new Decimal(Math.floor(LEVEL_COST_BASE * Math.pow(level, LEVEL_COST_GAMMA)));
}

/** 灵卡升阶：灵砂消耗（与灵石同时支付） */
export function upgradeCardLingShaCost(level: number): number {
  if (level >= MAX_CARD_LEVEL) return 0;
  return Math.max(1, Math.floor(2 + level * 0.28));
}
