import type { GameState } from "./types";
import { REINCARNATION_REALM_REQ } from "./types";
import { countUniqueOwned } from "./state";
import { totalCardsInPool } from "./storage";

/** 灵脉页「下一探索」短句，增强目标感（纯文案，不改数值） */
export function explorationHints(state: GameState): string[] {
  const out: string[] = [];
  const pool = totalCardsInPool();
  const n = countUniqueOwned(state);
  if (n < pool) {
    out.push(`图鉴 ${n}/${pool}：新卡略增全局灵石（有上限）。`);
  }
  const v = state.vein.huiLing + state.vein.guYuan + state.vein.lingXi + state.vein.gongMing;
  if (v < 12) {
    out.push("洞府四线可与升卡并行，轮回不重置洞府。");
  }
  const filled = state.deck.filter(Boolean).length;
  if (filled >= 1 && filled < 4) {
    out.push("多上阵可叠汇流与境界加护；五行≥三有灵脉。");
  }
  if (state.reincarnations === 0 && state.realmLevel >= 8 && state.realmLevel < REINCARNATION_REALM_REQ) {
    out.push(`境界 ${REINCARNATION_REALM_REQ} 重可入轮回阁换道韵。`);
  }
  return out.slice(0, 4);
}
