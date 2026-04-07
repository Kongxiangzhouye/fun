import Decimal from "decimal.js";
import type { GameState } from "../types";
import { normalizeLifetimeStats } from "./pullChronicle";

/** 与每秒灵石挂钩的凝露比例（不计入主循环直接加钱） */
const FILL_MULT = 0.016;
const MAX_FILL_PER_SEC = new Decimal(2_800_000);

/** 与蓄灵池同进度解锁 */
export function idleLingShaDripUnlocked(state: GameState): boolean {
  return state.realmLevel >= 3 || state.totalPulls >= 3;
}

export function dripThreshold(state: GameState): Decimal {
  const rl = state.realmLevel;
  const rein = state.reincarnations;
  return new Decimal(1_800_000).plus(new Decimal(rl).mul(55_000)).plus(new Decimal(rein).mul(220_000));
}

export function dripPool(state: GameState): Decimal {
  return new Decimal(state.idleLingShaDripPool || "0");
}

/**
 * @param effectiveIps 在线为 ips；离线/闭关为 ips×mult
 */
export function tickIdleLingShaDrip(state: GameState, dt: number, effectiveIps: Decimal): void {
  if (!idleLingShaDripUnlocked(state) || dt <= 0) return;
  const raw = effectiveIps.mul(FILL_MULT);
  const rate = Decimal.min(raw, MAX_FILL_PER_SEC);
  const add = rate.mul(dt);
  if (add.lte(0)) return;
  state.idleLingShaDripPool = dripPool(state).plus(add).toString();
}

export function dripFillRatio(state: GameState): number {
  const th = dripThreshold(state);
  if (th.lte(0)) return 0;
  const r = dripPool(state).div(th).toNumber();
  return Math.max(0, Math.min(1, r));
}

export function canClaimIdleLingShaDrip(state: GameState): boolean {
  return dripPool(state).gte(dripThreshold(state));
}

/** 收取 1 份灵砂（消耗一管阈值进度）；返回实际到账灵砂数 */
export function claimIdleLingShaDrip(state: GameState): number {
  const th = dripThreshold(state);
  let pool = dripPool(state);
  if (pool.lt(th)) return 0;
  pool = pool.minus(th);
  state.idleLingShaDripPool = pool.toString();
  state.lingSha += 1;
  normalizeLifetimeStats(state);
  state.lifetimeStats.idleLingShaDripClaims += 1;
  return 1;
}

export function secondsToDripFull(state: GameState, incomePerSec: Decimal): number | null {
  if (!idleLingShaDripUnlocked(state)) return null;
  const th = dripThreshold(state);
  const cur = dripPool(state);
  if (cur.gte(th)) return 0;
  const rate = Decimal.min(incomePerSec.mul(FILL_MULT), MAX_FILL_PER_SEC);
  if (rate.lte(0)) return null;
  return Math.max(1, Math.ceil(th.minus(cur).div(rate).toNumber()));
}

const MAX_AUTO_DRIP_CLAIMS_PER_TICK = 400;

/**
 * 偏好开启且凝露≥一管时自动收取（可连续多次，直至不满管或达上限）。
 * 返回本帧实际收取的灵砂颗数。
 */
export function tryAutoClaimIdleLingShaDripIfPref(state: GameState): number {
  if (!state.uiPrefs.autoClaimIdleLingShaDrip) return 0;
  if (!idleLingShaDripUnlocked(state)) return 0;
  let n = 0;
  for (let i = 0; i < MAX_AUTO_DRIP_CLAIMS_PER_TICK && canClaimIdleLingShaDrip(state); i++) {
    if (claimIdleLingShaDrip(state) > 0) n += 1;
    else break;
  }
  return n;
}

export function formatIdleLingShaDripEtaLine(state: GameState, incomePerSec: Decimal): string {
  const ratio = dripFillRatio(state);
  if (ratio >= 1) return "涓滴已满，收取前不再累积。";
  const sec = secondsToDripFull(state, incomePerSec);
  if (sec == null) return "涓滴增速与当前灵石收益挂钩。";
  if (sec < 90) return `约 ${sec} 秒后凝满`;
  if (sec < 3600) return `约 ${Math.ceil(sec / 60)} 分钟后凝满`;
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  return m > 0 ? `约 ${h} 小时 ${m} 分钟后凝满` : `约 ${h} 小时后凝满`;
}
