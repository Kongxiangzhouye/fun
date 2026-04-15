import type { GameState } from "../types";
import { canClaimSpiritReservoir, spiritReservoirUnlocked } from "./spiritReservoir";
import { canClaimIdleLingShaDrip, idleLingShaDripUnlocked } from "./idleLingShaDrip";

/** 蓄灵 / 涓滴「可收取」累计秒：用于 UI 门槛，避免刚有一点进度就提示 */
export function tickClaimableIdleAccum(state: GameState, dt: number): void {
  if (!(dt > 0) || !Number.isFinite(dt)) return;
  if (spiritReservoirUnlocked(state) && canClaimSpiritReservoir(state)) {
    if (state.reservoirClaimableAccumSec == null || !Number.isFinite(state.reservoirClaimableAccumSec)) {
      state.reservoirClaimableAccumSec = 0;
    }
    state.reservoirClaimableAccumSec += dt;
  } else {
    state.reservoirClaimableAccumSec = 0;
  }
  if (idleLingShaDripUnlocked(state) && canClaimIdleLingShaDrip(state)) {
    if (state.dripClaimableAccumSec == null || !Number.isFinite(state.dripClaimableAccumSec)) {
      state.dripClaimableAccumSec = 0;
    }
    state.dripClaimableAccumSec += dt;
  } else {
    state.dripClaimableAccumSec = 0;
  }
}
