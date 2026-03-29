import type { GameState } from "../types";
import { REINCARNATION_REALM_REQ, DECK_SIZE } from "../types";

/** 轮回：重置进度类数据，保留道韵与元升级、成就、图鉴记录可简化：我们保留 codex 作为“曾经拥有”用于展示，但 owned 清空？ 
 * 设计：轮回清空灵石、境界、卡牌、卡组、抽卡券、保底计数；给予道韵；保留成就与元升级与轮回次数累计
 */
export function canReincarnate(state: GameState): boolean {
  return state.realmLevel >= REINCARNATION_REALM_REQ;
}

export function daoEssenceGainOnReincarnate(state: GameState): number {
  const base = 1 + Math.floor(Math.pow(state.realmLevel, 0.85) * 0.5);
  const cardBonus = Math.floor(Object.keys(state.owned).length * 0.15);
  return base + cardBonus;
}

export function performReincarnate(state: GameState): void {
  const gain = daoEssenceGainOnReincarnate(state);
  state.daoEssence += gain;
  state.reincarnations += 1;

  state.spiritStones = 0;
  state.realmLevel = 1;
  state.tickets = 3 + state.meta.ticketRegen;
  state.owned = {};
  state.deck = Array.from({ length: DECK_SIZE }, () => null);
  state.pityUr = 0;
  state.pitySsrSoft = 0;
  // 图鉴可选保留：保留“曾见过”的集合，玩家仍有收集目标
  // state.codexUnlocked 保留
}

export const META_COST_BASE = [8, 10, 12, 15, 18];

export function metaUpgradeCost(kind: keyof GameState["meta"], level: number): number {
  const bases: Record<keyof GameState["meta"], number> = {
    idleMult: 10,
    gachaLuck: 12,
    deckSlots: 25,
    ticketRegen: 15,
    stoneMult: 14,
  };
  const b = bases[kind];
  return Math.floor(b * Math.pow(1.65, level));
}

export function buyMeta(state: GameState, kind: keyof GameState["meta"]): boolean {
  const cur = state.meta[kind];
  if (kind === "deckSlots" && cur >= 2) return false;
  if (cur >= 20) return false;
  const cost = metaUpgradeCost(kind, cur);
  if (state.daoEssence < cost) return false;
  state.daoEssence -= cost;
  state.meta[kind] = cur + 1;
  return true;
}
