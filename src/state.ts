import type { GameState, OwnedCard, SkillId } from "./types";
import { DECK_SIZE, DUNGEON_STAMINA_MAX } from "./types";
import { initRng, rollNewRngSeed } from "./rng";
import { playerMaxHp } from "./systems/playerCombat";
import { emptyGardenPlots } from "./systems/spiritGarden";
import { emptyWeeklyBounty, currentWeekKey } from "./systems/weeklyBounty";
import { emptyCelestialStash } from "./systems/celestialStash";

export const SAVE_VERSION = 37;

const emptySkills = (): GameState["skills"] => ({
  combat: { level: 1, xp: 0 },
  gathering: { level: 1, xp: 0 },
  arcana: { level: 1, xp: 0 },
});

const emptyDungeon = (): GameState["dungeon"] => ({
  active: false,
  wave: 1,
  monsterHp: 0,
  monsterMax: 0,
  playerHp: 0,
  playerMax: 0,
  deathCooldownUntil: 0,
  totalWavesCleared: 0,
  monsterAttackAccum: 0,
  playerAttackAccum: 0,
  playerAttackTargetMobId: 0,
  packSize: 1,
  packKilled: 0,
  sessionKills: 0,
  sessionEssence: 0,
  essenceRemainder: 0,
  playerX: 0.5,
  playerY: 0.5,
  mobs: [],
  nextMobId: 1,
  walkable: [],
  mapW: 0,
  mapH: 0,
  maxWaveRecord: 0,
  entryWave: 1,
  attackAnimPhase: 0,
  inMelee: false,
  attackVisualMode: "none",
  interWaveCooldownUntil: 0,
  essenceThisWave: 0,
  pendingToast: null,
  pendingDeathPresentation: false,
  waveCheckpoint: {},
  waveEntrySpawnX: 0.5,
  waveEntrySpawnY: 0.5,
  bossDodgeVisual: false,
  stamina: DUNGEON_STAMINA_MAX,
  dodgeIframesUntil: 0,
  dodgeQueued: false,
  playerMoveLockUntil: 0,
  playerLastMoveNx: 0,
  playerLastMoveNy: 0,
  rewardModeRepeat: false,
  autoEnterConsumed: false,
  sessionEnterAtMs: 0,
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
    gearPityPulls: 0,
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
    dailyLoginTickDay: null,
    dailyLoginClaimedDate: null,
    lastTunaMs: 0,
    skills: emptySkills(),
    activeSkillId: "combat" as SkillId | null,
    dungeon: emptyDungeon(),
    gearInventory: {},
    equippedGear: { weapon: null, body: null, ring: null },
    nextGearInstanceId: 1,
    gearInventorySort: "rarity",
    pets: {},
    petPullsTotal: 0,
    spiritGarden: { plots: emptyGardenPlots(), totalHarvests: 0 },
    weeklyBounty: emptyWeeklyBounty(currentWeekKey(now)),
    celestialStash: emptyCelestialStash(currentWeekKey(now)),
    spiritReservoirStored: "0",
    dailyFortune: { calendarDay: "", fortuneId: "fd_he" },
    spiritArrayLevel: 0,
    daoMeridian: 0,
    pullChronicle: [],
    gearPullChronicle: [],
    lifetimeStats: {
      dungeonEssenceIntGained: 0,
      celestialStashBuys: 0,
      spiritReservoirClaims: 0,
      dailyFortuneRolls: 0,
      gearForgesTotal: 0,
      maxGearRarityRankForged: 0,
    },
    combatHpCurrent: 100,
    dungeonSanctuaryMode: false,
    dungeonPortalTargetWave: 0,
    dungeonSanctuaryAutoEnter: false,
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
