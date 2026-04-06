import Decimal from "decimal.js";
import type { GameState } from "../types";
import { addStones } from "../stones";
import { normalizeLifetimeStats } from "./pullChronicle";

/** 与当前每秒灵石挂钩的额外蓄存比例（不计入主循环直接加钱，避免双计） */
const FILL_MULT = 0.09;

/** 解锁：与 UI tabSpiritReservoir 条件一致 */
export function spiritReservoirUnlocked(state: GameState): boolean {
  return state.realmLevel >= 3 || state.totalPulls >= 3;
}

export function reservoirCap(state: GameState): Decimal {
  const rl = state.realmLevel;
  const rein = state.reincarnations;
  return new Decimal(7200).plus(new Decimal(rl).mul(520)).plus(new Decimal(rein).mul(3200));
}

export function reservoirStored(state: GameState): Decimal {
  return new Decimal(state.spiritReservoirStored || "0");
}

/**
 * @param effectiveIps 在线为 ips；离线/闭关为 ips×mult
 */
export function tickSpiritReservoir(state: GameState, dt: number, effectiveIps: Decimal): void {
  if (!spiritReservoirUnlocked(state) || dt <= 0) return;
  const cap = reservoirCap(state);
  if (cap.lte(0)) return;
  const fill = effectiveIps.mul(FILL_MULT).mul(dt);
  if (fill.lte(0)) return;
  let cur = reservoirStored(state);
  cur = Decimal.min(cap, cur.plus(fill));
  state.spiritReservoirStored = cur.toString();
}

export function claimSpiritReservoir(state: GameState): Decimal {
  const cur = reservoirStored(state);
  if (cur.lte(0)) return new Decimal(0);
  addStones(state, cur);
  state.spiritReservoirStored = "0";
  normalizeLifetimeStats(state);
  state.lifetimeStats.spiritReservoirClaims += 1;
  return cur;
}

export function reservoirFillRatio(state: GameState): number {
  const cap = reservoirCap(state);
  if (cap.lte(0)) return 0;
  const r = reservoirStored(state).div(cap).toNumber();
  return Math.max(0, Math.min(1, r));
}

/** 收取按钮是否可点 */
export function canClaimSpiritReservoir(state: GameState): boolean {
  return reservoirStored(state).gt(0);
}
