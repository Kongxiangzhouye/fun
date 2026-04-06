import Decimal from "decimal.js";
import type { GameState } from "../types";
import { canAfford, subStones } from "../stones";
import { recordLingShaSpentLifetime, recordSpiritArrayUpgradeLifetime } from "./pullChronicle";

export const SPIRIT_ARRAY_MAX_LEVEL = 30;

/** 每级约 +0.4% 灵石/秒（与其它乘区叠乘） */
export function spiritArrayStoneMult(state: GameState): Decimal {
  const lv = Math.max(0, Math.min(SPIRIT_ARRAY_MAX_LEVEL, Math.floor(state.spiritArrayLevel ?? 0)));
  return new Decimal(1).plus(lv * 0.004);
}

export function spiritArrayStoneCost(level: number): Decimal {
  if (level >= SPIRIT_ARRAY_MAX_LEVEL) return new Decimal("Infinity");
  return new Decimal(Math.floor(150 * Math.pow(1.3, level)));
}

export function spiritArrayLingShaCost(level: number): number {
  if (level >= SPIRIT_ARRAY_MAX_LEVEL) return Infinity;
  return 5 + level * 2;
}

export function canUpgradeSpiritArray(state: GameState): boolean {
  const lv = state.spiritArrayLevel;
  if (lv >= SPIRIT_ARRAY_MAX_LEVEL) return false;
  const sc = spiritArrayStoneCost(lv);
  const lc = spiritArrayLingShaCost(lv);
  return canAfford(state, sc) && state.lingSha >= lc;
}

export function tryUpgradeSpiritArray(state: GameState): boolean {
  const lv = state.spiritArrayLevel;
  if (lv >= SPIRIT_ARRAY_MAX_LEVEL) return false;
  const sc = spiritArrayStoneCost(lv);
  const lc = spiritArrayLingShaCost(lv);
  if (!canAfford(state, sc) || state.lingSha < lc) return false;
  if (!subStones(state, sc)) return false;
  state.lingSha -= lc;
  recordLingShaSpentLifetime(state, lc);
  state.spiritArrayLevel = lv + 1;
  recordSpiritArrayUpgradeLifetime(state);
  return true;
}

/** 主循环：`uiPrefs.autoUpgradeSpiritArray` 时连续绘阵，返回本轮成功重数（0 表示未操作） */
export function tryAutoUpgradeSpiritArrayIfPref(state: GameState): number {
  if (!state.uiPrefs.autoUpgradeSpiritArray) return 0;
  let n = 0;
  let guard = 0;
  while (canUpgradeSpiritArray(state) && guard++ < 600) {
    if (!tryUpgradeSpiritArray(state)) break;
    n += 1;
  }
  return n;
}

export function normalizeSpiritArrayLevel(st: GameState): void {
  let lv = st.spiritArrayLevel;
  if (lv == null || !Number.isFinite(lv)) lv = 0;
  st.spiritArrayLevel = Math.max(0, Math.min(SPIRIT_ARRAY_MAX_LEVEL, Math.floor(lv)));
}
