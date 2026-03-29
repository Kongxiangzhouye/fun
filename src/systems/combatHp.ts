import type { GameState } from "../types";
import { playerMaxHp } from "./playerCombat";

/** 接战/被怪贴脸时：每秒恢复最大生命比例（慢） */
const REGEN_IN_MELEE = 0.0035;
/** 非接战（含非幻域、幻域游走/波间）：每秒恢复最大生命比例（更快） */
const REGEN_OUT_OF_MELEE = 0.012;

export function clampCombatHpToMax(state: GameState): void {
  const mx = playerMaxHp(state);
  if (state.combatHpCurrent == null || !Number.isFinite(state.combatHpCurrent)) {
    state.combatHpCurrent = mx;
    return;
  }
  state.combatHpCurrent = Math.max(0, Math.min(mx, state.combatHpCurrent));
}

/** 主循环：当前生命随时间恢复（上限随装备/境界变）；接战时慢、非接战时快 */
export function tickCombatHpRegen(state: GameState, dt: number): void {
  if (dt <= 0) return;
  clampCombatHpToMax(state);
  const mx = playerMaxHp(state);
  if (state.combatHpCurrent >= mx) return;
  const inMelee = state.dungeon.active && state.dungeon.inMelee;
  const sanctuary = state.dungeonSanctuaryMode && !state.dungeon.active;
  const rate = sanctuary ? 0.055 : inMelee ? REGEN_IN_MELEE : REGEN_OUT_OF_MELEE;
  state.combatHpCurrent = Math.min(mx, state.combatHpCurrent + mx * rate * dt);
}
