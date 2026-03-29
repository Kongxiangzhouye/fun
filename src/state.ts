import type { GameState, OwnedCard } from "./types";
import { DECK_SIZE } from "./types";

export const SAVE_VERSION = 1;

export function createInitialState(): GameState {
  const now = Date.now();
  return {
    version: SAVE_VERSION,
    spiritStones: 0,
    tickets: 3,
    daoEssence: 0,
    realmLevel: 1,
    totalPulls: 0,
    pityUr: 0,
    pitySsrSoft: 0,
    owned: {},
    deck: Array.from({ length: DECK_SIZE }, () => null),
    codexUnlocked: new Set(),
    reincarnations: 0,
    meta: {
      idleMult: 0,
      gachaLuck: 0,
      deckSlots: 0,
      ticketRegen: 0,
      stoneMult: 0,
    },
    achievementsDone: new Set(),
    lastTick: now,
    playtimeSec: 0,
    dailyClaimDate: null,
  };
}

export function ensureOwned(state: GameState, defId: string): OwnedCard {
  let o = state.owned[defId];
  if (!o) {
    o = { defId, stars: 0, level: 1 };
    state.owned[defId] = o;
  }
  return o;
}

export function countUniqueOwned(state: GameState): number {
  return Object.keys(state.owned).length;
}
