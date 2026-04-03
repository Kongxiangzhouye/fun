import type { GameState, OwnedCard, SkillId } from "./types";
import { DECK_SIZE } from "./types";
import { initRng, rollNewRngSeed } from "./rng";
import { playerMaxHp } from "./systems/playerCombat";

export const SAVE_VERSION = 23;

const emptySkills = (): GameState["skills"] => ({
  combat: { level: 1, xp: 0 },
  gathering: { level: 1, xp: 0 },
  arcana: { level: 1, xp: 0 },
});

export function createInitialState(): GameState {
  const now = Date.now();
  const day = `${new Date(now).getFullYear()}-${String(new Date(now).getMonth() + 1).padStart(2, "0")}-${String(new Date(now).getDate()).padStart(2, "0")}`;
  const seed = rollNewRngSeed();
  const st: GameState = {
    version: SAVE_VERSION,
    spiritStones: "0",
    peakSpiritStonesThisLife: "0",
    summonEssence: 72,
    daoEssence: 0,
    zaoHuaYu: 0,
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
    rngSeed: "",
    rngStateJson: "",
    inGameHour: 3,
    inGameDay: 1,
    lifeStartInGameDay: 1,
    gameHourTickAccum: 0,
    fenTianCooldownUntil: 0,
    biGuanCooldownUntil: 0,
    qoL: {
      tenPull: false,
      bulkLevel: false,
      autoRealm: false,
      autoGacha: false,
      autoTuna: false,
    },
    lastAutoGachaMs: 0,
    trueEndingSeen: false,
    tutorialStep: 1,
    featureGuideDismissed: [],
    suppressFeatureGuides: false,
    vein: { huiLing: 0, guYuan: 0, lingXi: 0, gongMing: 0 },
    pullsThisLife: 0,
    lingSha: 0,
    xuanTie: 0,
    salvageAuto: { n: false, r: false, gearN: false, gearR: false },
    battleSkills: {},
    wishResonance: 0,
    firstOpenTodayMs: now,
    dailyStreak: 1,
    lastLoginCalendarDate: day,
    lastTunaMs: 0,
    skills: emptySkills(),
    activeSkillId: "combat" as SkillId | null,
    gearInventory: {},
    equippedGear: { weapon: null, body: null, ring: null },
    nextGearInstanceId: 1,
    pets: {},
    petPullsTotal: 0,
    combatHpCurrent: 100,
    combatReferenceWave: 1,
  };
  initRng(st, seed);
  st.combatHpCurrent = playerMaxHp(st);
  return st;
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
