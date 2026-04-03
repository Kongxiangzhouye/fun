import type { GameState, PetId, PetProgress, QoLFlags, SkillId } from "./types";

type VeinSave = GameState["vein"];
type SkillsSave = GameState["skills"];
type GearInvSave = GameState["gearInventory"];
type EquippedSave = GameState["equippedGear"];
import { DECK_SIZE } from "./types";

/** 仅兼容旧存档读取 `dungeon` 以迁移 combatReferenceWave */
interface LegacyDungeonBlob {
  maxWaveRecord?: number;
}
import { SAVE_VERSION, createInitialState } from "./state";
import { CARDS } from "./data/cards";
import { initRng, rollNewRngSeed, syncRngFromState } from "./rng";
import { ALL_PET_IDS } from "./data/pets";
import { MAX_PET_LEVEL } from "./systems/pets";
import { clampCombatHpToMax } from "./systems/combatHp";

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
  /** 仅兼容 v22 及以前 */
  dungeon?: LegacyDungeonBlob;
  combatReferenceWave?: number;
  gearInventory?: GearInvSave;
  equippedGear?: EquippedSave;
  nextGearInstanceId?: number;
  featureGuideDismissed?: string[];
  suppressFeatureGuides?: boolean;
  pets?: GameState["pets"];
  petPullsTotal?: number;
  combatHpCurrent?: number;
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
    combatReferenceWave: state.combatReferenceWave,
    gearInventory: state.gearInventory,
    equippedGear: state.equippedGear,
    nextGearInstanceId: state.nextGearInstanceId,
    featureGuideDismissed: [...state.featureGuideDismissed],
    suppressFeatureGuides: state.suppressFeatureGuides,
    pets: { ...state.pets },
    petPullsTotal: state.petPullsTotal,
    combatHpCurrent: state.combatHpCurrent,
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
  {
    const legacy = data.dungeon as LegacyDungeonBlob | undefined;
    const fromLegacy = legacy?.maxWaveRecord != null && Number.isFinite(legacy.maxWaveRecord) ? Math.max(1, Math.floor(legacy.maxWaveRecord)) : null;
    if (data.combatReferenceWave != null && Number.isFinite(data.combatReferenceWave)) {
      st.combatReferenceWave = Math.max(1, Math.floor(data.combatReferenceWave));
    } else if (fromLegacy != null) {
      st.combatReferenceWave = fromLegacy;
    }
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
  st.combatHpCurrent =
    data.combatHpCurrent !== undefined && data.combatHpCurrent !== null && Number.isFinite(data.combatHpCurrent)
      ? data.combatHpCurrent
      : st.combatHpCurrent;
  clampCombatHpToMax(st);

  normalizePetsState(st);

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
