import type { GameState, QoLFlags } from "./types";
import { MAX_CARD_LEVEL } from "./types";
import { upgradeCardLevelCost, upgradeCardLingShaCost } from "./economy";
import { canAfford, subStones } from "./stones";

const COSTS: Record<keyof QoLFlags, number> = {
  tenPull: 1,
  bulkLevel: 3,
  autoRealm: 5,
  autoGacha: 10,
  autoTuna: 4,
};

export function qoLCost(kind: keyof QoLFlags): number {
  return COSTS[kind];
}

export function buyQoL(state: GameState, kind: keyof QoLFlags): boolean {
  if (state.qoL[kind]) return false;
  const c = COSTS[kind];
  if (state.zaoHuaYu < c) return false;
  state.zaoHuaYu -= c;
  state.qoL[kind] = true;
  return true;
}

/** 【袖里乾坤】所有卡牌尽量升级 */
export function bulkUpgradeAllCards(state: GameState): void {
  if (!state.qoL.bulkLevel) return;
  let guard = 0;
  let changed = true;
  while (changed && guard++ < 50000) {
    changed = false;
    for (const id of Object.keys(state.owned)) {
      const o = state.owned[id]!;
      if (o.level >= MAX_CARD_LEVEL) continue;
      const c = upgradeCardLevelCost(o.level);
      const ls = upgradeCardLingShaCost(o.level);
      if (canAfford(state, c) && state.lingSha >= ls && subStones(state, c)) {
        state.lingSha -= ls;
        o.level += 1;
        changed = true;
      }
    }
  }
}
