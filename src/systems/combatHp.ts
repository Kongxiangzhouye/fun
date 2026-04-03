import type { GameState } from "../types";
import { playerMaxHp } from "./playerCombat";

/** 每秒恢复最大生命比例（战斗外自然恢复） */
const REGEN_BASE = 0.012;

export function clampCombatHpToMax(state: GameState): void {
  const mx = playerMaxHp(state);
  if (state.combatHpCurrent == null || !Number.isFinite(state.combatHpCurrent)) {
    state.combatHpCurrent = mx;
    return;
  }
  state.combatHpCurrent = Math.max(0, Math.min(mx, state.combatHpCurrent));
}

/** 主循环：当前生命随时间恢复（上限随装备/境界变） */
export function tickCombatHpRegen(state: GameState, dt: number): void {
  if (dt <= 0) return;
  clampCombatHpToMax(state);
  const mx = playerMaxHp(state);
  if (state.combatHpCurrent >= mx) return;
  state.combatHpCurrent = Math.min(mx, state.combatHpCurrent + mx * REGEN_BASE * dt);
}
