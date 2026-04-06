import type { GameState, Rarity } from "../types";
import { getCard } from "../data/cards";

function lingShaFromRarity(r: Rarity, stars: number): number {
  const base = { N: 2, R: 5, SR: 14, SSR: 35, UR: 90 }[r] ?? 2;
  return base + Math.floor(stars * 2);
}

export function xuanTieFromRarity(r: Rarity, enhance: number): number {
  const base = { N: 3, R: 8, SR: 20, SSR: 45, UR: 120 }[r] ?? 3;
  return base + enhance * 2;
}

/** 分解/被替换销毁时的玄铁折算（与 `salvageGear` 一致） */
export function xuanTieFromGearPiece(g: { rarity: Rarity; enhanceLevel: number }): number {
  return xuanTieFromRarity(g.rarity, g.enhanceLevel);
}

/** 分解灵卡：移除持有，获得灵砂 */
export function salvageCard(state: GameState, defId: string): { ok: boolean; msg: string; gain?: number } {
  const o = state.owned[defId];
  if (!o) return { ok: false, msg: "未持有此卡" };
  for (let i = 0; i < state.deck.length; i++) {
    if (state.deck[i] === defId) return { ok: false, msg: "请先从阵位卸下" };
  }
  const def = getCard(defId);
  if (!def) return { ok: false, msg: "无效灵卡" };
  const gain = lingShaFromRarity(def.rarity, o.stars);
  delete state.owned[defId];
  state.lingSha += gain;
  return { ok: true, msg: `分解获得灵砂 +${gain}`, gain };
}

/** 切换装备锁定（会话内持久于存档） */
export function toggleGearLock(state: GameState, instanceId: string): { ok: boolean; msg: string } {
  const g = state.gearInventory[instanceId];
  if (!g) return { ok: false, msg: "无此装备" };
  g.locked = !g.locked;
  return { ok: true, msg: g.locked ? "已锁定" : "已解锁" };
}

/** 分解装备：移除背包中的实例 */
export function salvageGear(state: GameState, instanceId: string): { ok: boolean; msg: string; gain?: number } {
  const g = state.gearInventory[instanceId];
  if (!g) return { ok: false, msg: "无此装备" };
  if (g.locked) return { ok: false, msg: "已锁定，请先解锁再分解" };
  if (
    state.equippedGear.weapon === instanceId ||
    state.equippedGear.body === instanceId ||
    state.equippedGear.ring === instanceId
  ) {
    return { ok: false, msg: "请先卸下" };
  }
  const gain = xuanTieFromRarity(g.rarity, g.enhanceLevel);
  delete state.gearInventory[instanceId];
  state.xuanTie += gain;
  return { ok: true, msg: `分解获得玄铁 +${gain}`, gain };
}

function isGearEquipped(state: GameState, instanceId: string): boolean {
  return (
    state.equippedGear.weapon === instanceId ||
    state.equippedGear.body === instanceId ||
    state.equippedGear.ring === instanceId
  );
}

/** 按设置自动分解仓库中未上阵的低品灵卡 / 装备（节流由调用方控制） */
export function tryAutoSalvageInventory(state: GameState): void {
  const p = state.salvageAuto;
  if (p.n || p.r) {
    const inDeck = new Set(state.deck.filter(Boolean) as string[]);
    const ids = [...Object.keys(state.owned)];
    for (const id of ids) {
      const def = getCard(id);
      if (!def || inDeck.has(id)) continue;
      if (def.rarity === "N" && p.n) salvageCard(state, id);
      else if (def.rarity === "R" && p.r) salvageCard(state, id);
    }
  }
  if (p.gearN || p.gearR) {
    const gids = [...Object.keys(state.gearInventory)];
    for (const id of gids) {
      if (isGearEquipped(state, id)) continue;
      const g = state.gearInventory[id];
      if (!g) continue;
      if (g.locked) continue;
      if (g.rarity === "N" && p.gearN) salvageGear(state, id);
      else if (g.rarity === "R" && p.gearR) salvageGear(state, id);
    }
  }
}
