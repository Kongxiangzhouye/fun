import type { GameState, PetId, PetProgress, QoLFlags, SkillId } from "./types";

type VeinSave = GameState["vein"];
type SkillsSave = GameState["skills"];
type DungeonSave = GameState["dungeon"];
type GearInvSave = GameState["gearInventory"];
type EquippedSave = GameState["equippedGear"];
import { DECK_SIZE, DUNGEON_STAMINA_MAX } from "./types";
import { SAVE_VERSION, createInitialState } from "./state";
import { CARDS } from "./data/cards";
import { initRng, rollNewRngSeed, syncRngFromState } from "./rng";
import { ALL_PET_IDS } from "./data/pets";
import { MAX_PET_LEVEL } from "./systems/pets";
import { clampCombatHpToMax } from "./systems/combatHp";
import { normalizeSpiritGarden } from "./systems/spiritGarden";
import {
  emptyWeeklyBounty,
  currentWeekKey,
  normalizeWeeklyBounty,
  ensureWeeklyBountyWeek,
} from "./systems/weeklyBounty";
import { normalizeDaoMeridian } from "./systems/daoMeridian";
import { normalizeLifetimeStats, normalizePullChronicle } from "./systems/pullChronicle";
import { emptyCelestialStash, ensureCelestialStashWeek } from "./systems/celestialStash";

const KEY = "idle-gacha-realm-v1";

export interface SerializedState {
  version: number;
  spiritStones: string | number;
  peakSpiritStonesThisLife?: string | number;
  /** 仅兼容旧存档读取，不再写入 */
  tickets?: number;
  summonEssence?: number;
  daoEssence: number;
  zaoHuaYu?: number;
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
  /** 仅兼容旧存档读取，不再写入 */
  dailyClaimDate?: string | null;
  rngSeed?: string | number;
  rngState?: number;
  rngStateJson?: string;
  inGameHour?: number;
  inGameDay?: number;
  lifeStartInGameDay?: number;
  gameHourTickAccum?: number;
  fenTianCooldownUntil?: number;
  biGuanCooldownUntil?: number;
  qoL?: Partial<QoLFlags>;
  lastAutoGachaMs?: number;
  trueEndingSeen?: boolean;
  tutorialStep?: number;
  firstOpenTodayMs?: number;
  dailyStreak?: number;
  lastLoginCalendarDate?: string | null;
  dailyLoginTickDay?: string | null;
  dailyLoginClaimedDate?: string | null;
  spiritReservoirStored?: string;
  dailyFortune?: GameState["dailyFortune"];
  lastTunaMs?: number;
  vein?: VeinSave;
  pullsThisLife?: number;
  lingSha?: number;
  xuanTie?: number;
  salvageAuto?: { n?: boolean; r?: boolean; gearN?: boolean; gearR?: boolean };
  battleSkills?: Record<string, number>;
  wishResonance?: number;
  wishTicketsToday?: number;
  skills?: SkillsSave;
  activeSkillId?: SkillId | null;
  dungeon?: DungeonSave;
  gearInventory?: GearInvSave;
  equippedGear?: EquippedSave;
  nextGearInstanceId?: number;
  featureGuideDismissed?: string[];
  suppressFeatureGuides?: boolean;
  pets?: GameState["pets"];
  petPullsTotal?: number;
  spiritGarden?: GameState["spiritGarden"];
  weeklyBounty?: GameState["weeklyBounty"];
  celestialStash?: GameState["celestialStash"];
  daoMeridian?: number;
  pullChronicle?: GameState["pullChronicle"];
  lifetimeStats?: GameState["lifetimeStats"];
  combatHpCurrent?: number;
  dungeonSanctuaryMode?: boolean;
  dungeonPortalTargetWave?: number;
  dungeonSanctuaryAutoEnter?: boolean;
}

function normalizeDungeonState(st: GameState): void {
  const d = st.dungeon;
  if (d.packSize == null || !(d.packSize >= 1)) d.packSize = 1;
  if (d.packKilled == null || d.packKilled < 0) d.packKilled = 0;
  if (d.sessionKills == null || d.sessionKills < 0) d.sessionKills = 0;
  if (d.sessionEssence == null || d.sessionEssence < 0) d.sessionEssence = 0;
  if (d.essenceRemainder == null || !Number.isFinite(d.essenceRemainder)) d.essenceRemainder = 0;
  d.essenceRemainder = Math.max(0, d.essenceRemainder);
  if (d.playerX == null || !Number.isFinite(d.playerX)) d.playerX = 0.5;
  if (d.playerY == null || !Number.isFinite(d.playerY)) d.playerY = 0.5;
  if (d.nextMobId == null || d.nextMobId < 1) d.nextMobId = 1;
  if (!Array.isArray(d.mobs)) d.mobs = [];
  /** 旧存档：单怪逻辑 → 单只 mob 接入地图 */
  if (d.active && d.mobs.length === 0 && d.monsterMax > 0 && d.monsterHp > 0) {
    d.mobs = [
      {
        id: d.nextMobId++,
        x: 0.62,
        y: 0.48,
        hp: d.monsterHp,
        maxHp: d.monsterMax,
        element: "metal",
        isBoss: false,
        mobKind: 0,
        dodge: 0.08,
        attackRange: 0.045,
        attackInterval: 1.15,
        moveSpeedMul: 1,
      },
    ];
  }
  for (const m of d.mobs) {
    if (!m.element) m.element = "metal";
    if (m.isBoss == null) m.isBoss = false;
    if (m.mobKind == null || !Number.isFinite(m.mobKind)) m.mobKind = Math.abs((m.id * 7) % 8);
    if (m.dodge == null || !Number.isFinite(m.dodge)) m.dodge = 0.08;
    if (m.attackRange == null || !Number.isFinite(m.attackRange)) m.attackRange = 0.045;
    if (m.attackInterval == null || !Number.isFinite(m.attackInterval)) m.attackInterval = 1.15;
    if (m.moveSpeedMul == null || !Number.isFinite(m.moveSpeedMul)) m.moveSpeedMul = 1;
  }
  if (!Array.isArray(d.walkable)) d.walkable = [];
  if (d.mapW == null || d.mapW < 1) d.mapW = 0;
  if (d.mapH == null || d.mapH < 1) d.mapH = 0;
  if (d.maxWaveRecord == null || d.maxWaveRecord < 0) d.maxWaveRecord = d.totalWavesCleared ?? 0;
  if (!d.waveCheckpoint || typeof d.waveCheckpoint !== "object") d.waveCheckpoint = {};
  {
    const frontier = Math.max(1, d.maxWaveRecord + 1);
    if (d.entryWave == null || d.entryWave < 1) d.entryWave = frontier;
    else if (d.entryWave > frontier) d.entryWave = frontier;
    else if (d.entryWave < frontier) {
      const ck = d.waveCheckpoint[d.entryWave];
      if (!ck || !Array.isArray(ck.mobs) || !ck.mobs.some((m) => m.hp > 0)) d.entryWave = frontier;
    }
  }
  if (d.attackAnimPhase == null) d.attackAnimPhase = 0;
  if (d.inMelee == null) d.inMelee = false;
  if (d.attackVisualMode !== "aoe" && d.attackVisualMode !== "single" && d.attackVisualMode !== "none") {
    d.attackVisualMode = "none";
  }
  if (d.interWaveCooldownUntil == null || !Number.isFinite(d.interWaveCooldownUntil)) d.interWaveCooldownUntil = 0;
  if (d.essenceThisWave == null || !Number.isFinite(d.essenceThisWave)) d.essenceThisWave = 0;
  if (d.pendingToast === undefined) d.pendingToast = null;
  if (d.pendingDeathPresentation == null) d.pendingDeathPresentation = false;
  if (d.waveEntrySpawnX == null || !Number.isFinite(d.waveEntrySpawnX)) d.waveEntrySpawnX = 0.5;
  if (d.waveEntrySpawnY == null || !Number.isFinite(d.waveEntrySpawnY)) d.waveEntrySpawnY = 0.5;
  if (d.bossDodgeVisual == null) d.bossDodgeVisual = false;
  if (d.stamina == null || !Number.isFinite(d.stamina)) d.stamina = DUNGEON_STAMINA_MAX;
  d.stamina = Math.max(0, Math.min(DUNGEON_STAMINA_MAX, d.stamina));
  if (d.dodgeIframesUntil == null || !Number.isFinite(d.dodgeIframesUntil)) d.dodgeIframesUntil = 0;
  d.dodgeQueued = !!d.dodgeQueued;
  if (d.playerMoveLockUntil == null || !Number.isFinite(d.playerMoveLockUntil)) d.playerMoveLockUntil = 0;
  if (d.playerLastMoveNx == null || !Number.isFinite(d.playerLastMoveNx)) d.playerLastMoveNx = 0;
  if (d.playerLastMoveNy == null || !Number.isFinite(d.playerLastMoveNy)) d.playerLastMoveNy = 0;
  if (d.rewardModeRepeat == null) d.rewardModeRepeat = false;
  if (d.autoEnterConsumed == null) d.autoEnterConsumed = false;
  if (d.playerAttackAccum == null || !Number.isFinite(d.playerAttackAccum)) d.playerAttackAccum = 0;
  if (d.playerAttackTargetMobId == null || !Number.isFinite(d.playerAttackTargetMobId)) d.playerAttackTargetMobId = 0;
  if (d.sessionEnterAtMs == null || !Number.isFinite(d.sessionEnterAtMs)) d.sessionEnterAtMs = 0;
  /** 旧存档进本中无计时：从当前时刻起算，避免本局用时为 0 */
  if (d.active && d.sessionEnterAtMs <= 0) d.sessionEnterAtMs = Date.now();
}

function normalizePetsState(st: GameState): void {
  const incoming = st.pets && typeof st.pets === "object" ? st.pets : {};
  const next: Partial<Record<PetId, PetProgress>> = {};
  for (const key of Object.keys(incoming)) {
    if (!ALL_PET_IDS.includes(key as PetId)) continue;
    const p = incoming[key as PetId];
    if (!p || typeof p.level !== "number") continue;
    let level = Math.max(1, Math.floor(p.level));
    let xp = Math.max(0, Math.floor(p.xp ?? 0));
    if (level > MAX_PET_LEVEL) {
      level = MAX_PET_LEVEL;
      xp = 0;
    }
    next[key as PetId] = { level, xp };
  }
  st.pets = next;
  st.petPullsTotal = Math.max(0, st.petPullsTotal ?? 0);
  delete (st as unknown as { activePetId?: unknown }).activePetId;
}

function legacySeedFrom(data: Partial<SerializedState>): string {
  const a = (data.totalPulls ?? 0) * 9973;
  const b = (data.realmLevel ?? 1) * 131071;
  const s = (a ^ b ^ 0x9e3779b9) >>> 0;
  return String(s === 0 ? 0x6eed0e9d : s);
}

function toStoneString(v: string | number | undefined, fallback = "0"): string {
  if (v === undefined || v === null) return fallback;
  if (typeof v === "number") {
    if (!Number.isFinite(v)) return fallback;
    return String(v);
  }
  return v || fallback;
}

export function serialize(state: GameState): string {
  const s: SerializedState = {
    version: SAVE_VERSION,
    spiritStones: state.spiritStones,
    peakSpiritStonesThisLife: state.peakSpiritStonesThisLife,
    summonEssence: state.summonEssence,
    daoEssence: state.daoEssence,
    zaoHuaYu: state.zaoHuaYu,
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
    rngSeed: state.rngSeed,
    rngStateJson: state.rngStateJson,
    inGameHour: state.inGameHour,
    inGameDay: state.inGameDay,
    lifeStartInGameDay: state.lifeStartInGameDay,
    gameHourTickAccum: state.gameHourTickAccum,
    fenTianCooldownUntil: state.fenTianCooldownUntil,
    biGuanCooldownUntil: state.biGuanCooldownUntil,
    qoL: { ...state.qoL },
    lastAutoGachaMs: state.lastAutoGachaMs,
    trueEndingSeen: state.trueEndingSeen,
    tutorialStep: state.tutorialStep,
    firstOpenTodayMs: state.firstOpenTodayMs,
    dailyStreak: state.dailyStreak,
    lastLoginCalendarDate: state.lastLoginCalendarDate,
    dailyLoginTickDay: state.dailyLoginTickDay,
    dailyLoginClaimedDate: state.dailyLoginClaimedDate,
    spiritReservoirStored: state.spiritReservoirStored,
    dailyFortune: { ...state.dailyFortune },
    lastTunaMs: state.lastTunaMs,
    vein: { ...state.vein },
    pullsThisLife: state.pullsThisLife,
    lingSha: state.lingSha,
    xuanTie: state.xuanTie,
    salvageAuto: { ...state.salvageAuto },
    battleSkills: { ...state.battleSkills },
    wishResonance: state.wishResonance,
    skills: state.skills,
    activeSkillId: state.activeSkillId,
    dungeon: state.dungeon,
    gearInventory: state.gearInventory,
    equippedGear: state.equippedGear,
    nextGearInstanceId: state.nextGearInstanceId,
    featureGuideDismissed: [...state.featureGuideDismissed],
    suppressFeatureGuides: state.suppressFeatureGuides,
    pets: { ...state.pets },
    petPullsTotal: state.petPullsTotal,
    spiritGarden: {
      plots: state.spiritGarden.plots.map((p) => ({ ...p })),
      totalHarvests: state.spiritGarden.totalHarvests,
    },
    weeklyBounty: {
      weekKey: state.weeklyBounty.weekKey,
      waves: state.weeklyBounty.waves,
      cardPulls: state.weeklyBounty.cardPulls,
      gardenHarvests: state.weeklyBounty.gardenHarvests,
      tuna: state.weeklyBounty.tuna,
      breakthroughs: state.weeklyBounty.breakthroughs,
      claimed: [...state.weeklyBounty.claimed],
    },
    celestialStash: {
      weekKey: state.celestialStash.weekKey,
      purchased: [...state.celestialStash.purchased],
    },
    daoMeridian: state.daoMeridian,
    pullChronicle: state.pullChronicle.map((e) => ({ ...e })),
    lifetimeStats: { ...state.lifetimeStats },
    combatHpCurrent: state.combatHpCurrent,
    dungeonSanctuaryMode: state.dungeonSanctuaryMode,
    dungeonPortalTargetWave: state.dungeonPortalTargetWave,
    dungeonSanctuaryAutoEnter: state.dungeonSanctuaryAutoEnter,
  };
  return JSON.stringify(s);
}

function applyRngMigrate(st: GameState, data: Partial<SerializedState>): void {
  const seedStr =
    data.rngSeed !== undefined && data.rngSeed !== null
      ? String(data.rngSeed)
      : legacySeedFrom(data);
  if (data.rngStateJson && typeof data.rngStateJson === "string") {
    st.rngSeed = seedStr;
    st.rngStateJson = data.rngStateJson;
    syncRngFromState(st);
    return;
  }
  if (data.rngState !== undefined && typeof data.rngState === "number") {
    initRng(st, seedStr);
    return;
  }
  initRng(st, seedStr);
}

export function deserialize(json: string): GameState {
  let data: SerializedState;
  try {
    data = JSON.parse(json) as SerializedState;
  } catch {
    return createInitialState();
  }
  const st = createInitialState();
  const ver = data.version ?? 1;

  if (ver < 4) {
    return migrateFromOlder(data, st);
  }

  st.spiritStones = toStoneString(data.spiritStones, "0");
  st.peakSpiritStonesThisLife = toStoneString(data.peakSpiritStonesThisLife, st.spiritStones);
  st.summonEssence =
    data.summonEssence !== undefined && data.summonEssence !== null
      ? data.summonEssence
      : Math.floor((data.tickets ?? 0) * 14) + 48;
  st.daoEssence = data.daoEssence ?? 0;
  st.zaoHuaYu = data.zaoHuaYu ?? 0;
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
  st.tutorialStep = data.tutorialStep ?? 0;
  st.firstOpenTodayMs = data.firstOpenTodayMs ?? Date.now();
  st.dailyStreak = data.dailyStreak ?? 1;
  st.lastLoginCalendarDate = data.lastLoginCalendarDate ?? null;
  st.dailyLoginTickDay = data.dailyLoginTickDay ?? null;
  st.dailyLoginClaimedDate = data.dailyLoginClaimedDate ?? null;
  st.spiritReservoirStored =
    data.spiritReservoirStored !== undefined && data.spiritReservoirStored !== null
      ? String(data.spiritReservoirStored)
      : "0";
  if (data.dailyFortune && typeof data.dailyFortune.fortuneId === "string") {
    st.dailyFortune = {
      calendarDay: typeof data.dailyFortune.calendarDay === "string" ? data.dailyFortune.calendarDay : "",
      fortuneId: data.dailyFortune.fortuneId,
    };
  }
  st.lastTunaMs = data.lastTunaMs ?? 0;
  st.vein = { huiLing: 0, guYuan: 0, lingXi: 0, gongMing: 0, ...(data.vein ?? {}) };
  if (st.vein.gongMing == null || !Number.isFinite(st.vein.gongMing)) st.vein.gongMing = 0;
  st.vein.gongMing = Math.max(0, Math.min(80, Math.floor(st.vein.gongMing)));
  st.pullsThisLife = data.pullsThisLife ?? 0;
  st.lingSha = data.lingSha ?? 0;
  st.xuanTie = data.xuanTie ?? 0;
  st.salvageAuto = {
    n: data.salvageAuto?.n ?? false,
    r: data.salvageAuto?.r ?? false,
    gearN: data.salvageAuto?.gearN ?? false,
    gearR: data.salvageAuto?.gearR ?? false,
  };
  st.battleSkills = data.battleSkills && typeof data.battleSkills === "object" ? { ...data.battleSkills } : {};
  st.wishResonance = data.wishResonance ?? 0;

  st.inGameHour = data.inGameHour ?? 3;
  st.inGameDay = Math.max(1, data.inGameDay ?? 1);
  st.lifeStartInGameDay = data.lifeStartInGameDay ?? 1;
  st.gameHourTickAccum = data.gameHourTickAccum ?? 0;
  st.fenTianCooldownUntil = data.fenTianCooldownUntil ?? 0;
  st.biGuanCooldownUntil = data.biGuanCooldownUntil ?? 0;
  st.qoL = {
    tenPull: data.qoL?.tenPull ?? false,
    bulkLevel: data.qoL?.bulkLevel ?? false,
    autoRealm: data.qoL?.autoRealm ?? false,
    autoGacha: data.qoL?.autoGacha ?? false,
    autoTuna: data.qoL?.autoTuna ?? false,
  };
  st.lastAutoGachaMs = data.lastAutoGachaMs ?? 0;
  st.trueEndingSeen = data.trueEndingSeen ?? false;

  if (data.skills) {
    const sk = data.skills;
    for (const k of ["combat", "gathering", "arcana"] as const) {
      if (sk[k]) {
        st.skills[k].level = Math.max(1, sk[k].level ?? 1);
        st.skills[k].xp = Math.max(0, sk[k].xp ?? 0);
      }
    }
  }
  st.activeSkillId =
    data.activeSkillId === "gathering" || data.activeSkillId === "arcana" || data.activeSkillId === "combat"
      ? data.activeSkillId
      : data.activeSkillId === null
        ? null
        : st.activeSkillId;
  if (data.dungeon) {
    st.dungeon = { ...st.dungeon, ...data.dungeon };
  }
  st.gearInventory = data.gearInventory && typeof data.gearInventory === "object" ? data.gearInventory : st.gearInventory;
  if (data.equippedGear) {
    st.equippedGear = { ...st.equippedGear, ...data.equippedGear };
  }
  st.nextGearInstanceId = Math.max(st.nextGearInstanceId, data.nextGearInstanceId ?? 1);

  st.featureGuideDismissed = Array.isArray(data.featureGuideDismissed)
    ? [...data.featureGuideDismissed]
    : [];
  st.suppressFeatureGuides = data.suppressFeatureGuides ?? false;

  if (data.pets && typeof data.pets === "object") {
    st.pets = { ...st.pets, ...data.pets };
  }
  st.petPullsTotal = data.petPullsTotal ?? 0;
  if (data.spiritGarden && Array.isArray(data.spiritGarden.plots)) {
    st.spiritGarden = {
      plots: data.spiritGarden.plots.map((p) => ({
        crop: p.crop ?? null,
        plantedAtMs: p.plantedAtMs ?? 0,
      })),
      totalHarvests: Math.max(0, Math.floor(data.spiritGarden.totalHarvests ?? 0)),
    };
  }
  normalizeSpiritGarden(st);
  if (data.weeklyBounty && typeof data.weeklyBounty.weekKey === "string") {
    st.weeklyBounty = {
      weekKey: data.weeklyBounty.weekKey,
      waves: data.weeklyBounty.waves ?? 0,
      cardPulls: data.weeklyBounty.cardPulls ?? 0,
      gardenHarvests: data.weeklyBounty.gardenHarvests ?? 0,
      tuna: data.weeklyBounty.tuna ?? 0,
      breakthroughs: data.weeklyBounty.breakthroughs ?? 0,
      claimed: Array.isArray(data.weeklyBounty.claimed) ? [...data.weeklyBounty.claimed] : [],
    };
  } else {
    st.weeklyBounty = emptyWeeklyBounty(currentWeekKey(st.lastTick));
  }
  normalizeWeeklyBounty(st);
  ensureWeeklyBountyWeek(st, Date.now());
  if (data.celestialStash && typeof data.celestialStash.weekKey === "string") {
    st.celestialStash = {
      weekKey: data.celestialStash.weekKey,
      purchased: Array.isArray(data.celestialStash.purchased) ? [...data.celestialStash.purchased] : [],
    };
  } else {
    st.celestialStash = emptyCelestialStash(currentWeekKey(st.lastTick));
  }
  ensureCelestialStashWeek(st, Date.now());
  if (data.daoMeridian != null && Number.isFinite(data.daoMeridian)) {
    st.daoMeridian = Math.floor(data.daoMeridian);
  }
  normalizeDaoMeridian(st);
  if (data.pullChronicle && Array.isArray(data.pullChronicle)) {
    st.pullChronicle = data.pullChronicle.map((e) => ({
      atMs: e.atMs ?? 0,
      defId: e.defId ?? "",
      rarity: e.rarity ?? "N",
      isNew: !!e.isNew,
    }));
  }
  normalizePullChronicle(st);
  if (data.lifetimeStats && typeof data.lifetimeStats === "object") {
    st.lifetimeStats = {
      dungeonEssenceIntGained: Math.max(0, Math.floor(data.lifetimeStats.dungeonEssenceIntGained ?? 0)),
      celestialStashBuys: Math.max(0, Math.floor(data.lifetimeStats.celestialStashBuys ?? 0)),
      spiritReservoirClaims: Math.max(0, Math.floor(data.lifetimeStats.spiritReservoirClaims ?? 0)),
      dailyFortuneRolls: Math.max(0, Math.floor(data.lifetimeStats.dailyFortuneRolls ?? 0)),
    };
  }
  normalizeLifetimeStats(st);
  st.combatHpCurrent =
    data.combatHpCurrent !== undefined && data.combatHpCurrent !== null && Number.isFinite(data.combatHpCurrent)
      ? data.combatHpCurrent
      : st.combatHpCurrent;
  st.dungeonSanctuaryMode = data.dungeonSanctuaryMode ?? false;
  st.dungeonPortalTargetWave =
    data.dungeonPortalTargetWave !== undefined && data.dungeonPortalTargetWave !== null && Number.isFinite(data.dungeonPortalTargetWave)
      ? Math.max(0, Math.floor(data.dungeonPortalTargetWave))
      : 0;
  /** 旧存档无此字段时默认自动（与更新前行为一致）；显式存盘后尊重玩家勾选 */
  st.dungeonSanctuaryAutoEnter =
    data.dungeonSanctuaryAutoEnter !== undefined && data.dungeonSanctuaryAutoEnter !== null
      ? !!data.dungeonSanctuaryAutoEnter
      : true;
  clampCombatHpToMax(st);

  normalizePetsState(st);
  normalizeDungeonState(st);

  applyRngMigrate(st, data);
  st.version = SAVE_VERSION;
  return st;
}

function migrateFromOlder(data: Partial<SerializedState>, st: GameState): GameState {
  const now = Date.now();
  const d = new Date(now);
  const day = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

  st.spiritStones = toStoneString(data.spiritStones, "0");
  st.peakSpiritStonesThisLife = st.spiritStones;
  st.summonEssence = Math.floor((data.tickets ?? 0) * 14) + 48;
  st.daoEssence = data.daoEssence ?? 0;
  st.zaoHuaYu = data.zaoHuaYu ?? 0;
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
  st.lastTick = data.lastTick ?? now;
  st.playtimeSec = data.playtimeSec ?? 0;

  const progressed = (data.totalPulls ?? 0) > 0 || Object.keys(st.owned).length > 0 || (data.realmLevel ?? 1) > 1;
  st.tutorialStep = progressed ? 0 : 1;

  st.inGameHour = data.inGameHour ?? 3;
  st.inGameDay = Math.max(1, data.inGameDay ?? 1);
  st.lifeStartInGameDay = 1;
  st.gameHourTickAccum = 0;
  st.fenTianCooldownUntil = 0;
  st.biGuanCooldownUntil = 0;
  st.qoL = { tenPull: false, bulkLevel: false, autoRealm: false, autoGacha: false, autoTuna: false };
  st.lastAutoGachaMs = 0;
  st.trueEndingSeen = false;
  st.vein = { huiLing: 0, guYuan: 0, lingXi: 0, gongMing: 0 };
  st.pullsThisLife = 0;
  st.wishResonance = 0;
  st.firstOpenTodayMs = now;
  st.dailyStreak = data.dailyStreak ?? 1;
  st.lastLoginCalendarDate = day;
  st.lastTunaMs = 0;

  const seed =
    data.rngSeed !== undefined && data.rngSeed !== null ? String(data.rngSeed) : legacySeedFrom(data);
  if (data.rngStateJson) {
    st.rngSeed = seed;
    st.rngStateJson = data.rngStateJson;
    syncRngFromState(st);
  } else if (data.rngState !== undefined) {
    initRng(st, seed);
  } else {
    initRng(st, seed === "0" ? rollNewRngSeed() : seed);
  }

  st.version = SAVE_VERSION;
  return st;
}

export function saveGame(state: GameState): void {
  try {
    state.version = SAVE_VERSION;
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

/** 删除本地存档并生成全新灵识（立即写回存档位） */
export function clearSaveAndNewGame(): GameState {
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
  const st = createInitialState();
  saveGame(st);
  return st;
}
