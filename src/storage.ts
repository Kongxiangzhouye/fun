import type { GameState, OfflineAdventureOptionState, PetId, PetProgress, QoLFlags, SkillId, UiPrefs } from "./types";
import { DECK_SIZE, DUNGEON_STAMINA_MAX, type GearInventorySortMode } from "./types";
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
import {
  normalizeGearPullChronicle,
  normalizeLifetimeStats,
  normalizePullChronicle,
  syncMaxGearRarityFromInventoryAndChronicle,
} from "./systems/pullChronicle";
import { emptyCelestialStash, ensureCelestialStashWeek } from "./systems/celestialStash";
import { normalizeSpiritArrayLevel } from "./systems/spiritArray";
import { buildEssenceOptionForSettledSec, normalizeOfflineAdventureState } from "./systems/offlineAdventure";
import { normalizeGearGrade } from "./systems/gearCraft";
import { legacyGearRank5ToRank9 } from "./ui/gearVisualTier";
import { normalizeEstateCommissionState } from "./systems/estateCommission";

type VeinSave = GameState["vein"];
type SkillsSave = GameState["skills"];
type DungeonSave = GameState["dungeon"];
type GearInvSave = GameState["gearInventory"];
type EquippedSave = GameState["equippedGear"];
type GearSlotEnhanceSave = GameState["gearSlotEnhance"];

/** 旧版单键存档（首次启动时迁移到槽位 0） */
const LEGACY_KEY = "idle-gacha-realm-v1";
const ACTIVE_SLOT_KEY = "idle-gacha-realm-active-slot";
/** 各槽位用户备注（仅存本机，不随导出存档字符串迁移） */
const SLOT_LABELS_KEY = "idle-gacha-realm-slot-labels";

/** 本地存档位数量（0 起算索引） */
export const SAVE_SLOT_COUNT = 3;
/** 存档位备注最大字符数 */
export const SAVE_SLOT_LABEL_MAX = 20;

export type SaveLoadResult<T> = { ok: true; value: T } | { ok: false; error: string };

function storageKeyForSlot(slot: number): string {
  return `idle-gacha-realm-v1-slot-${slot}`;
}

function isValidSaveSlot(slot: number): boolean {
  return Number.isInteger(slot) && slot >= 0 && slot < SAVE_SLOT_COUNT;
}

let slotsMigrationChecked = false;

/** 将旧单文件存档迁入槽 0，并保证存在激活槽位索引 */
function ensureSaveSlotsMigrated(): void {
  if (slotsMigrationChecked) return;
  slotsMigrationChecked = true;
  if (typeof localStorage === "undefined") return;
  try {
    const legacy = localStorage.getItem(LEGACY_KEY);
    const hasSlotData = (): boolean => {
      for (let i = 0; i < SAVE_SLOT_COUNT; i++) {
        if (localStorage.getItem(storageKeyForSlot(i))) return true;
      }
      return false;
    };
    if (legacy && !hasSlotData()) {
      localStorage.setItem(storageKeyForSlot(0), legacy);
      localStorage.setItem(ACTIVE_SLOT_KEY, "0");
      localStorage.removeItem(LEGACY_KEY);
    } else if (legacy) {
      localStorage.removeItem(LEGACY_KEY);
    }
    if (!localStorage.getItem(ACTIVE_SLOT_KEY)) {
      localStorage.setItem(ACTIVE_SLOT_KEY, "0");
    }
  } catch {
    /* ignore */
  }
}

function normalizeGearInventorySort(raw: unknown): GearInventorySortMode {
  if (raw === "rarity" || raw === "ilvl" || raw === "slot" || raw === "name") return raw;
  return "rarity";
}

function normalizeMasterVolume(raw: unknown): number {
  if (raw == null || !Number.isFinite(Number(raw))) return 0.85;
  return Math.max(0, Math.min(1, Number(raw)));
}

export interface SerializedState {
  version: number;
  spiritStones: string | number;
  peakSpiritStonesThisLife?: string | number;
  /** 仅兼容旧存档读取，不再写入 */
  tickets?: number;
  summonEssence?: number;
  zhuLingEssence?: number;
  daoEssence: number;
  zaoHuaYu?: number;
  realmLevel: number;
  totalPulls: number;
  pityUr: number;
  pitySsrSoft: number;
  gearPityPulls?: number;
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
  lastAutoGearForgeMs?: number;
  lastAutoBossChallengeMs?: number;
  autoSalvageAccumSec?: number;
  trueEndingSeen?: boolean;
  tutorialStep?: number;
  firstOpenTodayMs?: number;
  dailyStreak?: number;
  lastLoginCalendarDate?: string | null;
  dailyLoginTickDay?: string | null;
  dailyLoginClaimedDate?: string | null;
  spiritReservoirStored?: string;
  dailyFortune?: GameState["dailyFortune"];
  offlineAdventure?: GameState["offlineAdventure"];
  estateCommission?: GameState["estateCommission"];
  spiritArrayLevel?: number;
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
  gearSlotEnhance?: Partial<GearSlotEnhanceSave>;
  nextGearInstanceId?: number;
  gearInventorySort?: GameState["gearInventorySort"];
  featureGuideDismissed?: string[];
  suppressFeatureGuides?: boolean;
  uiPrefs?: Partial<UiPrefs>;
  pets?: GameState["pets"];
  petPullsTotal?: number;
  spiritGarden?: GameState["spiritGarden"];
  weeklyBounty?: GameState["weeklyBounty"];
  celestialStash?: GameState["celestialStash"];
  daoMeridian?: number;
  pullChronicle?: GameState["pullChronicle"];
  gearPullChronicle?: GameState["gearPullChronicle"];
  lifetimeStats?: GameState["lifetimeStats"];
  combatHpCurrent?: number;
  dungeonSanctuaryMode?: boolean;
  dungeonPortalTargetWave?: number;
  dungeonSanctuaryAutoEnter?: boolean;
  dungeonDeferBoss?: boolean;
  autoGearForge?: boolean;
  autoBossChallenge?: boolean;
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
  if (d.attackVisualMode !== "aoe" && d.attackVisualMode !== "none") {
    d.attackVisualMode = "none";
  }
  if (d.interWaveCooldownUntil == null || !Number.isFinite(d.interWaveCooldownUntil)) d.interWaveCooldownUntil = 0;
  if (d.essenceThisWave == null || !Number.isFinite(d.essenceThisWave)) d.essenceThisWave = 0;
  if (d.pendingToast === undefined) d.pendingToast = null;
  if (d.pendingKillToast === undefined) d.pendingKillToast = null;
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
  if (d.duelComboStacks == null || !Number.isFinite(d.duelComboStacks)) d.duelComboStacks = 0;
  d.duelComboStacks = Math.max(0, Math.floor(d.duelComboStacks));
  if (d.duelWeakUntilMs == null || !Number.isFinite(d.duelWeakUntilMs)) d.duelWeakUntilMs = 0;
  if (d.duelWeakNextAtMs == null || !Number.isFinite(d.duelWeakNextAtMs)) d.duelWeakNextAtMs = 0;
  if (d.duelFervor == null || !Number.isFinite(d.duelFervor)) d.duelFervor = 0;
  d.duelFervor = Math.max(0, Math.min(100, d.duelFervor));
  if (d.duelElemSurgeCounter == null || !Number.isFinite(d.duelElemSurgeCounter)) d.duelElemSurgeCounter = 0;
  d.duelElemSurgeCounter = Math.max(0, Math.floor(d.duelElemSurgeCounter));
  if (d.bossPrepKills == null || !Number.isFinite(d.bossPrepKills)) d.bossPrepKills = 0;
  d.bossPrepKills = Math.max(0, Math.floor(d.bossPrepKills));
  if (d.bossPrepChallengeReady == null) d.bossPrepChallengeReady = false;
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
    zhuLingEssence: state.zhuLingEssence,
    daoEssence: state.daoEssence,
    zaoHuaYu: state.zaoHuaYu,
    realmLevel: state.realmLevel,
    totalPulls: state.totalPulls,
    pityUr: state.pityUr,
    pitySsrSoft: state.pitySsrSoft,
    gearPityPulls: state.gearPityPulls,
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
    lastAutoGearForgeMs: state.lastAutoGearForgeMs,
    lastAutoBossChallengeMs: state.lastAutoBossChallengeMs,
    autoSalvageAccumSec: state.autoSalvageAccumSec,
    trueEndingSeen: state.trueEndingSeen,
    tutorialStep: state.tutorialStep,
    firstOpenTodayMs: state.firstOpenTodayMs,
    dailyStreak: state.dailyStreak,
    lastLoginCalendarDate: state.lastLoginCalendarDate,
    dailyLoginTickDay: state.dailyLoginTickDay,
    dailyLoginClaimedDate: state.dailyLoginClaimedDate,
    spiritReservoirStored: state.spiritReservoirStored,
    dailyFortune: { ...state.dailyFortune },
    offlineAdventure: state.offlineAdventure
      ? {
          pending: state.offlineAdventure.pending
            ? {
                triggeredAtMs: state.offlineAdventure.pending.triggeredAtMs,
                settledSec: state.offlineAdventure.pending.settledSec,
                options: state.offlineAdventure.pending.options.map((op) => ({ ...op })) as [
                  OfflineAdventureOptionState,
                  OfflineAdventureOptionState,
                  OfflineAdventureOptionState,
                ],
              }
            : null,
          activeBoostUntilMs: state.offlineAdventure.activeBoostUntilMs,
          activeBoostMult: state.offlineAdventure.activeBoostMult,
        }
      : { pending: null, activeBoostUntilMs: 0, activeBoostMult: 1 },
    estateCommission: {
      offer: state.estateCommission.offer ? { ...state.estateCommission.offer, reward: { ...state.estateCommission.offer.reward } } : null,
      active: state.estateCommission.active
        ? {
            ...state.estateCommission.active,
            offer: {
              ...state.estateCommission.active.offer,
              reward: { ...state.estateCommission.active.offer.reward },
            },
          }
        : null,
      refreshCount: state.estateCommission.refreshCount,
    },
    spiritArrayLevel: state.spiritArrayLevel,
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
    gearSlotEnhance: state.gearSlotEnhance,
    nextGearInstanceId: state.nextGearInstanceId,
    gearInventorySort: state.gearInventorySort,
    featureGuideDismissed: [...state.featureGuideDismissed],
    suppressFeatureGuides: state.suppressFeatureGuides,
    uiPrefs: { ...state.uiPrefs },
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
      gearForges: state.weeklyBounty.gearForges,
      gardenHarvests: state.weeklyBounty.gardenHarvests,
      tuna: state.weeklyBounty.tuna,
      breakthroughs: state.weeklyBounty.breakthroughs,
      claimed: [...state.weeklyBounty.claimed],
      milestoneClaimed: [...state.weeklyBounty.milestoneClaimed],
    },
    celestialStash: {
      weekKey: state.celestialStash.weekKey,
      purchased: [...state.celestialStash.purchased],
    },
    daoMeridian: state.daoMeridian,
    pullChronicle: state.pullChronicle.map((e) => ({ ...e })),
    gearPullChronicle: state.gearPullChronicle.map((e) => ({ ...e })),
    lifetimeStats: { ...state.lifetimeStats },
    combatHpCurrent: state.combatHpCurrent,
    dungeonSanctuaryMode: state.dungeonSanctuaryMode,
    dungeonPortalTargetWave: state.dungeonPortalTargetWave,
    dungeonSanctuaryAutoEnter: state.dungeonSanctuaryAutoEnter,
    dungeonDeferBoss: state.dungeonDeferBoss,
    autoGearForge: state.autoGearForge,
    autoBossChallenge: state.autoBossChallenge,
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
  st.zhuLingEssence =
    data.zhuLingEssence !== undefined && data.zhuLingEssence !== null && Number.isFinite(data.zhuLingEssence)
      ? Math.max(0, Math.floor(data.zhuLingEssence))
      : 0;
  st.daoEssence = data.daoEssence ?? 0;
  st.zaoHuaYu = data.zaoHuaYu ?? 0;
  st.realmLevel = Math.max(1, data.realmLevel ?? 1);
  st.totalPulls = data.totalPulls ?? 0;
  st.pityUr = data.pityUr ?? 0;
  st.pitySsrSoft = data.pitySsrSoft ?? 0;
  st.gearPityPulls =
    data.gearPityPulls != null && Number.isFinite(data.gearPityPulls)
      ? Math.max(0, Math.floor(data.gearPityPulls))
      : 0;
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
  if (data.offlineAdventure && typeof data.offlineAdventure === "object") {
    const oa = data.offlineAdventure;
    const activeBoostUntilMs = Number.isFinite(oa.activeBoostUntilMs)
      ? Math.max(0, Math.floor(oa.activeBoostUntilMs))
      : 0;
    const activeBoostMult =
      Number.isFinite(oa.activeBoostMult) && oa.activeBoostMult >= 1 ? Math.max(1, Number(oa.activeBoostMult)) : 1;
    let pending: GameState["offlineAdventure"]["pending"] = null;
    if (oa.pending && typeof oa.pending === "object" && Array.isArray(oa.pending.options) && oa.pending.options.length >= 2) {
      const rawOpts = oa.pending.options.slice(0, 3);
      const picked = rawOpts.map((op) => {
        const idRaw = op.id === "boost" ? "boost" : op.id === "essence" ? "essence" : "instant";
        const zl = (op as { zhuLingBonus?: unknown }).zhuLingBonus;
        const zhuLingBonus =
          idRaw === "essence" && Number.isFinite(zl) ? Math.max(0, Math.floor(Number(zl))) : undefined;
        return {
          id: idRaw,
          title: typeof op.title === "string" ? op.title : "",
          desc: typeof op.desc === "string" ? op.desc : "",
          instantStones: op.instantStones != null ? String(op.instantStones) : "0",
          instantEssence: Number.isFinite(op.instantEssence) ? Math.max(0, Math.floor(Number(op.instantEssence))) : 0,
          boostMult: Number.isFinite(op.boostMult) ? Math.max(1, Number(op.boostMult)) : 1,
          boostDurationSec: Number.isFinite(op.boostDurationSec) ? Math.max(0, Math.floor(Number(op.boostDurationSec))) : 0,
          ...(zhuLingBonus !== undefined ? { zhuLingBonus } : {}),
        } as OfflineAdventureOptionState;
      });
      const settledSec = Number.isFinite(oa.pending.settledSec) ? Math.max(0, Number(oa.pending.settledSec)) : 0;
      while (picked.length < 3) {
        picked.push(buildEssenceOptionForSettledSec(settledSec));
      }
      pending = {
        triggeredAtMs: Number.isFinite(oa.pending.triggeredAtMs) ? Math.max(0, Math.floor(oa.pending.triggeredAtMs)) : 0,
        settledSec,
        options: [picked[0]!, picked[1]!, picked[2]!],
      };
    }
    st.offlineAdventure = {
      pending,
      activeBoostUntilMs,
      activeBoostMult,
    };
  } else {
    st.offlineAdventure = { pending: null, activeBoostUntilMs: 0, activeBoostMult: 1 };
  }
  normalizeOfflineAdventureState(st, Date.now());
  if (data.estateCommission && typeof data.estateCommission === "object") {
    st.estateCommission = {
      offer: data.estateCommission.offer ?? null,
      active: data.estateCommission.active ?? null,
      refreshCount:
        data.estateCommission.refreshCount != null && Number.isFinite(data.estateCommission.refreshCount)
          ? Math.max(0, Math.floor(data.estateCommission.refreshCount))
          : 0,
    };
  }
  normalizeEstateCommissionState(st, Date.now());
  if (data.spiritArrayLevel != null && Number.isFinite(data.spiritArrayLevel)) {
    st.spiritArrayLevel = Math.floor(data.spiritArrayLevel);
  }
  normalizeSpiritArrayLevel(st);
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
  st.lastAutoGearForgeMs = data.lastAutoGearForgeMs ?? 0;
  st.lastAutoBossChallengeMs = data.lastAutoBossChallengeMs ?? 0;
  st.autoSalvageAccumSec =
    data.autoSalvageAccumSec != null && Number.isFinite(data.autoSalvageAccumSec)
      ? Math.max(0, data.autoSalvageAccumSec)
      : 0;
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
  for (const g of Object.values(st.gearInventory)) {
    if (g) normalizeGearGrade(g);
  }
  if (data.equippedGear) {
    st.equippedGear = { ...st.equippedGear, ...data.equippedGear };
  }
  if (data.gearSlotEnhance && typeof data.gearSlotEnhance === "object") {
    st.gearSlotEnhance = { ...st.gearSlotEnhance, ...data.gearSlotEnhance };
  }
  // 兼容旧存档：将旧的“装备强化等级”迁移到对应槽位强化。
  for (const [slot, id] of Object.entries(st.equippedGear)) {
    if (!id) continue;
    const g = st.gearInventory[id];
    if (!g) continue;
    const legacyLv = Math.max(0, Math.floor(g.enhanceLevel ?? 0));
    const key = slot as keyof typeof st.gearSlotEnhance;
    st.gearSlotEnhance[key] = Math.max(st.gearSlotEnhance[key] ?? 0, legacyLv);
  }
  for (const slot of Object.keys(st.gearSlotEnhance) as (keyof typeof st.gearSlotEnhance)[]) {
    const lv = st.gearSlotEnhance[slot];
    st.gearSlotEnhance[slot] = Math.max(0, Math.floor(Number.isFinite(lv) ? lv : 0));
  }
  for (const g of Object.values(st.gearInventory)) {
    if (!g) continue;
    g.enhanceLevel = 0;
  }
  st.nextGearInstanceId = Math.max(st.nextGearInstanceId, data.nextGearInstanceId ?? 1);
  st.gearInventorySort = normalizeGearInventorySort(data.gearInventorySort);

  st.featureGuideDismissed = Array.isArray(data.featureGuideDismissed)
    ? [...data.featureGuideDismissed]
    : [];
  st.suppressFeatureGuides = data.suppressFeatureGuides ?? false;
  st.uiPrefs = {
    reduceMotion: !!data.uiPrefs?.reduceMotion,
    compactNumbers: data.uiPrefs?.compactNumbers !== false,
    soundMuted: !!data.uiPrefs?.soundMuted,
    masterVolume: normalizeMasterVolume(data.uiPrefs?.masterVolume),
  };

  if (data.pets && typeof data.pets === "object") {
    st.pets = { ...st.pets, ...data.pets };
  }
  st.petPullsTotal = data.petPullsTotal ?? 0;
  if (data.spiritGarden && Array.isArray(data.spiritGarden.plots)) {
    st.spiritGarden = {
      plots: data.spiritGarden.plots.map((p) => ({
        crop: p.crop ?? null,
        plantedAtMs: p.plantedAtMs ?? 0,
        lastCrop: (p as { lastCrop?: unknown }).lastCrop ?? null,
      })) as GameState["spiritGarden"]["plots"],
      totalHarvests: Math.max(0, Math.floor(data.spiritGarden.totalHarvests ?? 0)),
    };
  }
  normalizeSpiritGarden(st);
  if (data.weeklyBounty && typeof data.weeklyBounty.weekKey === "string") {
    st.weeklyBounty = {
      weekKey: data.weeklyBounty.weekKey,
      waves: data.weeklyBounty.waves ?? 0,
      cardPulls: data.weeklyBounty.cardPulls ?? 0,
      gearForges: data.weeklyBounty.gearForges ?? 0,
      gardenHarvests: data.weeklyBounty.gardenHarvests ?? 0,
      tuna: data.weeklyBounty.tuna ?? 0,
      breakthroughs: data.weeklyBounty.breakthroughs ?? 0,
      claimed: Array.isArray(data.weeklyBounty.claimed) ? [...data.weeklyBounty.claimed] : [],
      milestoneClaimed: Array.isArray(data.weeklyBounty.milestoneClaimed)
        ? [...data.weeklyBounty.milestoneClaimed]
        : [],
    };
  } else {
    st.weeklyBounty = emptyWeeklyBounty(currentWeekKey(st.lastTick));
  }
  normalizeWeeklyBounty(st);
  const syncNow = Date.now();
  ensureWeeklyBountyWeek(st, syncNow);
  if (data.celestialStash && typeof data.celestialStash.weekKey === "string") {
    st.celestialStash = {
      weekKey: data.celestialStash.weekKey,
      purchased: Array.isArray(data.celestialStash.purchased) ? [...data.celestialStash.purchased] : [],
    };
  } else {
    st.celestialStash = emptyCelestialStash(currentWeekKey(st.lastTick));
  }
  ensureCelestialStashWeek(st, syncNow);
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
  if (data.gearPullChronicle && Array.isArray(data.gearPullChronicle)) {
    st.gearPullChronicle = data.gearPullChronicle.map((e) => ({
      atMs: e.atMs ?? 0,
      baseId: e.baseId ?? "",
      gearTier:
        Number.isFinite((e as { gearTier?: unknown }).gearTier) && Number((e as { gearTier?: unknown }).gearTier) >= 1
          ? Math.max(1, Math.min(9, Math.floor(Number((e as { gearTier?: unknown }).gearTier))))
          : e.rarity === "UR"
            ? 7
            : e.rarity === "SSR"
              ? 6
              : e.rarity === "SR"
                ? 4
                : e.rarity === "R"
                  ? 2
                  : 1,
      rarity: e.rarity ?? "N",
      displayName: e.displayName ?? "",
    })) as GameState["gearPullChronicle"];
  }
  normalizeGearPullChronicle(st);
  if (data.lifetimeStats && typeof data.lifetimeStats === "object") {
    st.lifetimeStats = {
      dungeonEssenceIntGained: Math.max(0, Math.floor(data.lifetimeStats.dungeonEssenceIntGained ?? 0)),
      celestialStashBuys: Math.max(0, Math.floor(data.lifetimeStats.celestialStashBuys ?? 0)),
      spiritReservoirClaims: Math.max(0, Math.floor(data.lifetimeStats.spiritReservoirClaims ?? 0)),
      dailyFortuneRolls: Math.max(0, Math.floor(data.lifetimeStats.dailyFortuneRolls ?? 0)),
      gearForgesTotal: Math.max(0, Math.floor(data.lifetimeStats.gearForgesTotal ?? 0)),
      maxGearRarityRankForged: Math.max(
        0,
        (() => {
          const raw = Math.floor(data.lifetimeStats.maxGearRarityRankForged ?? 0);
          return raw <= 4 ? legacyGearRank5ToRank9(raw) : Math.min(8, raw);
        })(),
      ),
      weeklyBountyFullWeeks: Math.max(0, Math.floor(data.lifetimeStats.weeklyBountyFullWeeks ?? 0)),
      lastWeeklyBountyFullWeekKey:
        typeof data.lifetimeStats.lastWeeklyBountyFullWeekKey === "string"
          ? data.lifetimeStats.lastWeeklyBountyFullWeekKey
          : "",
      offlineAdventureBoostPicks: Math.max(0, Math.floor(data.lifetimeStats.offlineAdventureBoostPicks ?? 0)),
    };
  }
  normalizeLifetimeStats(st);
  syncMaxGearRarityFromInventoryAndChronicle(st);
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
  st.dungeonDeferBoss = data.dungeonDeferBoss !== undefined && data.dungeonDeferBoss !== null ? !!data.dungeonDeferBoss : true;
  st.autoGearForge = data.autoGearForge !== undefined && data.autoGearForge !== null ? !!data.autoGearForge : false;
  st.autoBossChallenge =
    data.autoBossChallenge !== undefined && data.autoBossChallenge !== null ? !!data.autoBossChallenge : false;
  clampCombatHpToMax(st);

  normalizePetsState(st);
  normalizeDungeonState(st);

  applyRngMigrate(st, data);
  st.version = SAVE_VERSION;
  return st;
}

function deserializeStrict(json: string): SaveLoadResult<GameState> {
  let data: SerializedState;
  try {
    data = JSON.parse(json) as SerializedState;
  } catch {
    return { ok: false, error: "存档内容不是有效 JSON。" };
  }
  if (!data || typeof data !== "object") {
    return { ok: false, error: "存档格式无效：缺少对象结构。" };
  }
  if (!Number.isFinite(data.version ?? NaN) || (data.version ?? 0) < 1) {
    return { ok: false, error: "存档版本字段无效。" };
  }
  const realmOk = Number.isFinite(data.realmLevel ?? NaN) && Number(data.realmLevel) >= 1;
  const pullsOk = Number.isFinite(data.totalPulls ?? NaN) && Number(data.totalPulls) >= 0;
  const stonesOk =
    typeof data.spiritStones === "string" ||
    (typeof data.spiritStones === "number" && Number.isFinite(data.spiritStones));
  if (!realmOk || !pullsOk || !stonesOk) {
    return { ok: false, error: "存档缺少核心字段或字段类型不正确。" };
  }
  return { ok: true, value: deserialize(json) };
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
  st.gearPityPulls =
    data.gearPityPulls != null && Number.isFinite(data.gearPityPulls)
      ? Math.max(0, Math.floor(data.gearPityPulls))
      : 0;
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
  st.lastAutoGearForgeMs = 0;
  st.lastAutoBossChallengeMs = 0;
  st.autoSalvageAccumSec = 0;
  st.autoGearForge = false;
  st.autoBossChallenge = false;
  st.estateCommission = { offer: null, active: null, refreshCount: 0 };
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

export function getActiveSlotIndex(): number {
  ensureSaveSlotsMigrated();
  try {
    const v = localStorage.getItem(ACTIVE_SLOT_KEY);
    const n = v != null ? parseInt(v, 10) : 0;
    if (Number.isFinite(n) && n >= 0 && n < SAVE_SLOT_COUNT) return n;
  } catch {
    /* ignore */
  }
  return 0;
}

function setActiveSlotIndex(slot: number): void {
  if (slot < 0 || slot >= SAVE_SLOT_COUNT) return;
  try {
    localStorage.setItem(ACTIVE_SLOT_KEY, String(slot));
  } catch {
    /* ignore */
  }
}

function sanitizeSlotLabel(raw: string): string {
  return raw
    .replace(/[\x00-\x1f\x7f]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, SAVE_SLOT_LABEL_MAX);
}

/** 读取某槽用户备注（本机 meta，可为空字符串） */
export function getSlotLabel(slot: number): string {
  ensureSaveSlotsMigrated();
  if (slot < 0 || slot >= SAVE_SLOT_COUNT) return "";
  try {
    const raw = localStorage.getItem(SLOT_LABELS_KEY);
    if (!raw) return "";
    const o = JSON.parse(raw) as Record<string, unknown>;
    if (!o || typeof o !== "object") return "";
    const v = o[String(slot)];
    return typeof v === "string" ? sanitizeSlotLabel(v) : "";
  } catch {
    return "";
  }
}

/** 写入某槽备注；空字符串则清除该槽条目 */
export function setSlotLabel(slot: number, label: string): void {
  ensureSaveSlotsMigrated();
  if (slot < 0 || slot >= SAVE_SLOT_COUNT) return;
  try {
    const cleaned = sanitizeSlotLabel(label);
    const o: Record<string, string> = {};
    const prev = localStorage.getItem(SLOT_LABELS_KEY);
    if (prev) {
      try {
        const parsed = JSON.parse(prev) as Record<string, unknown>;
        if (parsed && typeof parsed === "object") {
          for (let i = 0; i < SAVE_SLOT_COUNT; i++) {
            const vv = parsed[String(i)];
            if (typeof vv === "string") {
              const s = sanitizeSlotLabel(vv);
              if (s) o[String(i)] = s;
            }
          }
        }
      } catch {
        /* ignore */
      }
    }
    if (cleaned === "") delete o[String(slot)];
    else o[String(slot)] = cleaned;
    if (Object.keys(o).length === 0) localStorage.removeItem(SLOT_LABELS_KEY);
    else localStorage.setItem(SLOT_LABELS_KEY, JSON.stringify(o));
  } catch {
    /* ignore */
  }
}

/** 用于存档页展示：不反序列化完整 GameState */
export function peekSlotSummary(slot: number): { empty: boolean; realmLevel?: number; playtimeSec?: number } {
  ensureSaveSlotsMigrated();
  if (slot < 0 || slot >= SAVE_SLOT_COUNT) return { empty: true };
  try {
    const raw = localStorage.getItem(storageKeyForSlot(slot));
    if (!raw) return { empty: true };
    const data = JSON.parse(raw) as { realmLevel?: number; playtimeSec?: number };
    return {
      empty: false,
      realmLevel: Math.max(1, Math.floor(data.realmLevel ?? 1)),
      playtimeSec: Math.max(0, Math.floor(data.playtimeSec ?? 0)),
    };
  } catch {
    return { empty: true };
  }
}

/** 将内存中的进度写入指定槽（用于复制；不切换激活槽） */
export function copyCurrentToSlot(target: number, current: GameState): void {
  ensureSaveSlotsMigrated();
  if (!isValidSaveSlot(target)) return;
  try {
    localStorage.setItem(storageKeyForSlot(target), serialize(current));
  } catch {
    /* ignore */
  }
}

/**
 * 先刷写当前槽，再切换激活槽并载入目标槽（空槽则新开局）。
 * 返回新的 GameState，调用方应替换全局 `state` 并重绘。
 */
export function switchToSaveSlot(slot: number, current: GameState): SaveLoadResult<GameState> {
  ensureSaveSlotsMigrated();
  if (!isValidSaveSlot(slot)) return { ok: false, error: "目标存档位不存在或索引非法。" };
  const from = getActiveSlotIndex();
  if (slot === from) return { ok: true, value: current };
  try {
    const raw = localStorage.getItem(storageKeyForSlot(slot));
    let nextState: GameState;
    if (raw) {
      const parsed = deserializeStrict(raw);
      if (!parsed.ok) {
        return { ok: false, error: `目标槽位存档损坏：${parsed.error}` };
      }
      nextState = parsed.value;
    } else {
      nextState = createInitialState();
    }
    localStorage.setItem(storageKeyForSlot(from), serialize(current));
    setActiveSlotIndex(slot);
    return { ok: true, value: nextState };
  } catch {
    return { ok: false, error: "存档位切换失败：本地存储写入异常。" };
  }
}

export function saveGame(state: GameState): void {
  try {
    ensureSaveSlotsMigrated();
    const slot = getActiveSlotIndex();
    localStorage.setItem(storageKeyForSlot(slot), serialize(state));
  } catch {
    /* ignore */
  }
}

export function loadGame(): GameState {
  ensureSaveSlotsMigrated();
  try {
    const slot = getActiveSlotIndex();
    const raw = localStorage.getItem(storageKeyForSlot(slot));
    if (raw) return deserialize(raw);
  } catch {
    /* ignore */
  }
  return createInitialState();
}

function encodeUtf8Base64(input: string): string {
  const bytes = new TextEncoder().encode(input);
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin);
}

function decodeUtf8Base64(input: string): string {
  const bin = atob(input);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
}

function normalizeBase64Input(input: string): string {
  let out = input.replace(/-/g, "+").replace(/_/g, "/").replace(/\s+/g, "");
  const rem = out.length % 4;
  if (rem !== 0) out += "=".repeat(4 - rem);
  return out;
}

export function exportSave(state: GameState): string {
  return encodeUtf8Base64(serialize(state));
}

export function importSave(b64: string): SaveLoadResult<GameState> {
  const raw = b64.trim();
  if (!raw) return { ok: false, error: "导入内容为空。" };
  const normalized = normalizeBase64Input(raw);
  try {
    const json = decodeUtf8Base64(normalized);
    return deserializeStrict(json);
  } catch {
    // Fallback for older exports using escape/unescape based encoding.
    try {
      const legacy = decodeURIComponent(escape(atob(normalized)));
      return deserializeStrict(legacy);
    } catch {
      return { ok: false, error: "字符串无法解码为有效存档。" };
    }
  }
}

export function totalCardsInPool(): number {
  return CARDS.length;
}

/** 删除本地存档并生成全新灵识（立即写回存档位） */
export function clearSaveAndNewGame(): GameState {
  ensureSaveSlotsMigrated();
  const slot = getActiveSlotIndex();
  try {
    localStorage.removeItem(storageKeyForSlot(slot));
  } catch {
    /* ignore */
  }
  const st = createInitialState();
  saveGame(st);
  return st;
}
