import Decimal from "decimal.js";
import type { GameState } from "../types";
import { addStones } from "../stones";
import { normalizeLifetimeStats } from "./pullChronicle";

/** 与当前每秒灵石挂钩的额外蓄存比例（不计入主循环直接加钱，避免双计） */
const FILL_MULT = 0.09;

/** 手动收取蓄灵池后的最短间隔（ms），防止连点 */
export const SPIRIT_RESERVOIR_CLAIM_COOLDOWN_MS = 60_000;

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

export function claimSpiritReservoir(state: GameState, nowMs: number = Date.now()): Decimal {
  const cur = reservoirStored(state);
  if (cur.lte(0)) return new Decimal(0);
  addStones(state, cur);
  state.spiritReservoirStored = "0";
  state.spiritReservoirClaimCooldownUntilMs = nowMs + SPIRIT_RESERVOIR_CLAIM_COOLDOWN_MS;
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

/** 收取按钮是否可点（含收取冷却） */
export function canClaimSpiritReservoir(state: GameState, nowMs: number = Date.now()): boolean {
  if (!reservoirStored(state).gt(0)) return false;
  const until = state.spiritReservoirClaimCooldownUntilMs ?? 0;
  return !(Number.isFinite(until) && until > nowMs);
}

/** 偏好开启且池内已达上限时自动收取一次；否则返回 null */
export function tryAutoClaimSpiritReservoirIfFull(state: GameState): Decimal | null {
  if (!state.uiPrefs.autoClaimSpiritReservoir) return null;
  if (!spiritReservoirUnlocked(state)) return null;
  const cap = reservoirCap(state);
  if (cap.lte(0)) return null;
  if (reservoirStored(state).lt(cap)) return null;
  const got = claimSpiritReservoir(state);
  return got.gt(0) ? got : null;
}

/** 按当前灵石/秒推算距离蓄灵池蓄满还需秒数；已满返回 0；无增速返回 null */
export function secondsToReservoirFull(state: GameState, incomePerSec: Decimal): number | null {
  if (!spiritReservoirUnlocked(state)) return null;
  const cap = reservoirCap(state);
  const cur = reservoirStored(state);
  if (cur.gte(cap)) return 0;
  const rate = incomePerSec.mul(FILL_MULT);
  if (rate.lte(0)) return null;
  return Math.max(1, Math.ceil(cap.minus(cur).div(rate).toNumber()));
}

/** 蓄灵池蓄满 ETA 一行文案（供面板与实时读数共用） */
export function formatSpiritReservoirEtaLine(state: GameState, incomePerSec: Decimal): string {
  const ratio = reservoirFillRatio(state);
  if (ratio >= 1) return "蓄灵已满，收取前不再累积。";
  const sec = secondsToReservoirFull(state, incomePerSec);
  if (sec == null) return "蓄灵增速与当前灵石收益挂钩。";
  if (sec < 90) return `约 ${sec} 秒后蓄满`;
  if (sec < 3600) return `约 ${Math.ceil(sec / 60)} 分钟后蓄满`;
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  return m > 0 ? `约 ${h} 小时 ${m} 分钟后蓄满` : `约 ${h} 小时后蓄满`;
}
