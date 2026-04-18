import type { GameState } from "../types";
import { canClaimIdleLingShaDrip, idleLingShaDripUnlocked } from "./idleLingShaDrip";

/** 灵砂涓滴「可收取」累计秒：用于「下一步」提示门槛 */
export function tickClaimableIdleAccum(state: GameState, dt: number): void {
  if (!(dt > 0) || !Number.isFinite(dt)) return;
  if (idleLingShaDripUnlocked(state) && canClaimIdleLingShaDrip(state)) {
    if (state.dripClaimableAccumSec == null || !Number.isFinite(state.dripClaimableAccumSec)) {
      state.dripClaimableAccumSec = 0;
    }
    state.dripClaimableAccumSec += dt;
  } else {
    state.dripClaimableAccumSec = 0;
  }
}
