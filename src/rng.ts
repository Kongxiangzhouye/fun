import seedrandom from "seedrandom";
import type { GameState } from "./types";

/** 默认 Arc4 算法带 state()，用于序列化存盘 */
type Arc4State = seedrandom.State.Arc4;
type StatefulArc4Rng = seedrandom.StatefulPRNG<Arc4State>;
let cachedRng: StatefulArc4Rng | null = null;

export function syncRngFromState(state: GameState): void {
  if (state.rngStateJson) {
    try {
      const parsed = JSON.parse(state.rngStateJson) as Arc4State;
      cachedRng = seedrandom("", { state: parsed });
    } catch {
      cachedRng = seedrandom(state.rngSeed, { state: true });
      state.rngStateJson = JSON.stringify(cachedRng.state());
    }
  } else {
    cachedRng = seedrandom(state.rngSeed, { state: true });
    state.rngStateJson = JSON.stringify(cachedRng.state());
  }
}

/** 固定种子 PRNG：抽卡/战利品唯一入口，禁止 Math.random */
export function nextRand01(state: GameState): number {
  if (!cachedRng) syncRngFromState(state);
  const v = cachedRng!();
  state.rngStateJson = JSON.stringify(cachedRng!.state());
  return v;
}

export function rollNewRngSeed(): string {
  return `${Date.now()}_${performance.now().toFixed(3)}`;
}

export function initRng(state: GameState, seed: string): void {
  state.rngSeed = seed;
  state.rngStateJson = "";
  cachedRng = seedrandom(seed, { state: true });
  state.rngStateJson = JSON.stringify(cachedRng.state());
}

/** 轮回 / 新档时重_roll 种子 */
export function reseedRng(state: GameState): void {
  const s = `${state.rngSeed}_re_${rollNewRngSeed()}`;
  initRng(state, s);
}
