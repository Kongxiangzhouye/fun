import Decimal from "decimal.js";
import type { GameState } from "./types";

export function stones(state: GameState): Decimal {
  return new Decimal(state.spiritStones || "0");
}

export function setStones(state: GameState, d: Decimal): void {
  state.spiritStones = d.toString();
}

export function addStones(state: GameState, amount: Decimal | number | string): void {
  const d = amount instanceof Decimal ? amount : new Decimal(amount);
  setStones(state, stones(state).add(d));
  bumpPeakIfNeeded(state);
}

/** 直接写入（如读档）；不更新峰值 */
export function setStonesRaw(state: GameState, s: string): void {
  state.spiritStones = s;
}

export function subStones(state: GameState, amount: Decimal | number | string): boolean {
  const d = amount instanceof Decimal ? amount : new Decimal(amount);
  if (stones(state).lt(d)) return false;
  setStones(state, stones(state).sub(d));
  return true;
}

export function canAfford(state: GameState, amount: Decimal | number | string): boolean {
  return stones(state).gte(new Decimal(amount));
}

function bumpPeakIfNeeded(state: GameState): void {
  const cur = stones(state);
  const peak = new Decimal(state.peakSpiritStonesThisLife || "0");
  if (cur.gt(peak)) state.peakSpiritStonesThisLife = cur.toString();
}

export function fmtDecimal(d: Decimal): string {
  if (!d.isFinite()) return "—";
  const n = d.toNumber();
  if (d.abs().gte("1e21")) return d.toExponential(2);
  if (n >= 1e9) return (n / 1e9).toFixed(2) + "B";
  if (n >= 1e6) return (n / 1e6).toFixed(2) + "M";
  if (n >= 1e3) return (n / 1e3).toFixed(2) + "K";
  if (n >= 100) return n.toFixed(0);
  if (n >= 10) return n.toFixed(1);
  return d.toFixed(2);
}
