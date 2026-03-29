import Decimal from "decimal.js";
import type { GameState } from "./types";
import { TRUE_ENDING_REALM, TRUE_ENDING_STONE_THRESHOLD } from "./types";
import { CARDS } from "./data/cards";
import { stones } from "./stones";

export function trueEndingEligible(state: GameState): boolean {
  const fullCodex = state.codexUnlocked.size >= CARDS.length;
  const realmOk = state.realmLevel >= TRUE_ENDING_REALM;
  const stoneOk = stones(state).gte(TRUE_ENDING_STONE_THRESHOLD);
  return (fullCodex && realmOk) || stoneOk;
}

/** 检测并标记飞升（UI 由 main 轮询 trueEndingSeen） */
export function checkTrueEnding(state: GameState): void {
  if (state.trueEndingSeen) return;
  if (trueEndingEligible(state)) {
    state.trueEndingSeen = true;
    state.zaoHuaYu += 3;
  }
}
