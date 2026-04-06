import type { GameState } from "./types";
import { cycleActionRewardFactor, describeInGameUi, lingXiActiveFactor } from "./inGameClock";
import { addStones } from "./stones";
import { veinGongMingResonanceMult } from "./systems/veinCultivation";
import { normalizeLifetimeStats } from "./systems/pullChronicle";

export { describeInGameUi };

/**
 * 聚灵共鸣：随时间累积（applyTick、离线追赶、闭关快进均按同公式结算 dt），满百自动唤灵髓 +1，无次数上限；不可点击。
 */
/** 聚灵共鸣：共鸣点/秒（满 100 点 +1 唤灵髓） */
export function wishResonancePointsPerSecond(state: GameState): number {
  const ling = lingXiActiveFactor(state);
  const arc = 1 + state.skills.arcana.level * 0.009;
  const gongMing = veinGongMingResonanceMult(state.vein.gongMing);
  return (0.55 + 0.8 * ling) * 1.65 * arc * gongMing;
}

/** 由共鸣折算的期望唤灵髓/秒（长期平均） */
export function essenceIncomePerSecondFromResonance(state: GameState): number {
  return wishResonancePointsPerSecond(state) / 100;
}

export function tickWishResonancePassive(state: GameState, dtSec: number, gainMult = 1): void {
  if (dtSec <= 0) return;
  const rate = wishResonancePointsPerSecond(state) * Math.max(0, gainMult);
  state.wishResonance += rate * dtSec;
  while (state.wishResonance >= 100) {
    state.wishResonance -= 100;
    state.summonEssence += 1;
    normalizeLifetimeStats(state);
    state.lifetimeStats.resonanceEssencePayouts += 1;
  }
}

export function onGachaPulls(state: GameState, count: number): number {
  const ling = lingXiActiveFactor(state);
  const act = cycleActionRewardFactor(ling);
  let bonusTotal = 0;
  for (let i = 0; i < count; i++) {
    state.pullsThisLife += 1;
    if (state.pullsThisLife <= 12) {
      bonusTotal += Math.floor((14 + 38 * ling) * act);
    }
  }
  if (bonusTotal > 0) {
    addStones(state, bonusTotal);
  }
  let extraTen = 0;
  if (count === 10 && state.qoL.tenPull) {
    extraTen = Math.floor(80 + state.realmLevel * 12);
    addStones(state, extraTen);
  }
  return bonusTotal + extraTen;
}
