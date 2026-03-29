import Decimal from "decimal.js";
import type { GameState } from "../types";
import { canAfford, subStones } from "../stones";

export type VeinKind = "huiLing" | "guYuan" | "lingXi" | "gongMing";

export const VEIN_MAX_LEVEL = 80;

/** 汇灵：全局灵石效率 */
export function veinHuiLingMult(level: number): number {
  return 1 + level * 0.017;
}

/** 固元：降低破境灵石消耗（上限约 45%） */
export function veinGuYuanDiscount(level: number): number {
  return Math.min(0.45, level * 0.009);
}

/** 灵息：放大挂机灵石（叠乘于全局灵息）；每级增幅略高于汇灵线，便于长期感知成长 */
export function veinLingXiMult(level: number): number {
  return 1 + level * 0.022;
}

/**
 * 共鸣（洞府第四条）：聚灵共鸣点累积速度乘区；与法篆叠乘。
 * 每级 +0.4%，上限 +32%（约 80 级满），避免后期与法篆叠乘过于离谱。
 */
export function veinGongMingResonanceMult(level: number): number {
  return 1 + Math.min(0.32, level * 0.004);
}

export function huiLingUpgradeCost(level: number): Decimal {
  return new Decimal(22).mul(new Decimal(1.62).pow(level));
}

export function guYuanUpgradeCost(level: number): number {
  return Math.floor(6 + 7 * Math.pow(1.7, level));
}

export function lingXiUpgradeCost(level: number): Decimal {
  return new Decimal(35).mul(new Decimal(1.55).pow(level));
}

export function gongMingUpgradeCost(level: number): Decimal {
  return new Decimal(28).mul(new Decimal(1.54).pow(level));
}

export function buyVeinUpgrade(state: GameState, kind: VeinKind): boolean {
  const cur = state.vein[kind];
  if (cur >= VEIN_MAX_LEVEL) return false;
  if (kind === "huiLing") {
    const c = huiLingUpgradeCost(cur);
    if (!canAfford(state, c)) return false;
    if (!subStones(state, c)) return false;
  } else if (kind === "guYuan") {
    const c = guYuanUpgradeCost(cur);
    if (state.daoEssence < c) return false;
    state.daoEssence -= c;
  } else if (kind === "lingXi") {
    const c = lingXiUpgradeCost(cur);
    if (!canAfford(state, c)) return false;
    if (!subStones(state, c)) return false;
  } else {
    const c = gongMingUpgradeCost(cur);
    if (!canAfford(state, c)) return false;
    if (!subStones(state, c)) return false;
  }
  state.vein[kind] = cur + 1;
  return true;
}

export const VEIN_TITLES: Record<VeinKind, string> = {
  huiLing: "汇灵",
  guYuan: "固元",
  lingXi: "灵息",
  gongMing: "共鸣",
};

export const VEIN_DESC: Record<VeinKind, string> = {
  huiLing: "全局灵石效率乘区。",
  guYuan: "耗道韵强化，降低破境灵石；并微量增厚幻域护体。",
  lingXi: "在汇灵之后再叠灵石乘区（约每级 +2.2%，与汇灵叠乘）。",
  gongMing: "加快聚灵共鸣累积（与法篆叠乘，满级约 +32%）。",
};
