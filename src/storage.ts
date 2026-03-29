import type { GameState } from "./types";
import { DECK_SIZE } from "./types";
import { SAVE_VERSION, createInitialState } from "./state";
import { CARDS } from "./data/cards";

const KEY = "idle-gacha-realm-v1";

export interface SerializedState {
  version: number;
  spiritStones: number;
  tickets: number;
  daoEssence: number;
  realmLevel: number;
  totalPulls: number;
  pityUr: number;
  pitySsrSoft: number;
  owned: Record<string, { defId: string; stars: number; level: number }>;
  deck: (string | null)[];
  codexUnlocked: string[];
  reincarnations: number;
  meta: GameState["meta"];
  achievementsDone: string[];
  lastTick: number;
  playtimeSec: number;
  dailyClaimDate: string | null;
}

export function serialize(state: GameState): string {
  const s: SerializedState = {
    version: SAVE_VERSION,
    spiritStones: state.spiritStones,
    tickets: state.tickets,
    daoEssence: state.daoEssence,
    realmLevel: state.realmLevel,
    totalPulls: state.totalPulls,
    pityUr: state.pityUr,
    pitySsrSoft: state.pitySsrSoft,
    owned: state.owned,
    deck: state.deck,
    codexUnlocked: [...state.codexUnlocked],
    reincarnations: state.reincarnations,
    meta: { ...state.meta },
    achievementsDone: [...state.achievementsDone],
    lastTick: state.lastTick,
    playtimeSec: state.playtimeSec,
    dailyClaimDate: state.dailyClaimDate,
  };
  return JSON.stringify(s);
}

export function deserialize(json: string): GameState {
  let data: SerializedState;
  try {
    data = JSON.parse(json) as SerializedState;
  } catch {
    return createInitialState();
  }
  const st = createInitialState();
  if (data.version !== SAVE_VERSION) {
    return migrate(data, st);
  }
  st.spiritStones = data.spiritStones ?? 0;
  st.tickets = data.tickets ?? 3;
  st.daoEssence = data.daoEssence ?? 0;
  st.realmLevel = Math.max(1, data.realmLevel ?? 1);
  st.totalPulls = data.totalPulls ?? 0;
  st.pityUr = data.pityUr ?? 0;
  st.pitySsrSoft = data.pitySsrSoft ?? 0;
  st.owned = data.owned ?? {};
  st.deck = data.deck?.length ? [...data.deck] : st.deck;
  while (st.deck.length < DECK_SIZE) st.deck.push(null);
  st.deck.length = DECK_SIZE;
  st.codexUnlocked = new Set(data.codexUnlocked ?? []);
  st.reincarnations = data.reincarnations ?? 0;
  st.meta = { ...st.meta, ...data.meta };
  st.achievementsDone = new Set(data.achievementsDone ?? []);
  st.lastTick = data.lastTick ?? Date.now();
  st.playtimeSec = data.playtimeSec ?? 0;
  st.dailyClaimDate = data.dailyClaimDate ?? null;
  return st;
}

function migrate(_old: Partial<SerializedState>, fresh: GameState): GameState {
  return fresh;
}

export function saveGame(state: GameState): void {
  try {
    localStorage.setItem(KEY, serialize(state));
  } catch {
    /* ignore */
  }
}

export function loadGame(): GameState {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return deserialize(raw);
  } catch {
    /* ignore */
  }
  return createInitialState();
}

export function exportSave(state: GameState): string {
  return btoa(unescape(encodeURIComponent(serialize(state))));
}

export function importSave(b64: string): GameState | null {
  try {
    const json = decodeURIComponent(escape(atob(b64)));
    return deserialize(json);
  } catch {
    return null;
  }
}

export function totalCardsInPool(): number {
  return CARDS.length;
}
