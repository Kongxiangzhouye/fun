import Decimal from "decimal.js";
import type { GameState } from "../types";
import { REINCARNATION_REALM_REQ, DECK_SIZE, DUNGEON_STAMINA_MAX } from "../types";
import { reseedRng } from "../rng";
import { playerMaxHp } from "./playerCombat";

export function canReincarnate(state: GameState): boolean {
  return state.realmLevel >= REINCARNATION_REALM_REQ;
}

/** 道韵：按本轮峰值灵石 log10 对数结算（设计案 §2） */
export function daoEssenceGainOnReincarnate(state: GameState): number {
  const peak = new Decimal(state.peakSpiritStonesThisLife || "0");
  let logPart = 0;
  if (peak.gt(1)) {
    logPart = Math.max(0, Math.floor(peak.log(10).times(3.8).toNumber()));
  }
  const cardBonus = Math.floor(Object.keys(state.owned).length * 0.28);
  return Math.max(3, logPart + cardBonus);
}

export function performReincarnate(state: GameState): void {
  const gain = daoEssenceGainOnReincarnate(state);
  state.daoEssence += gain;
  state.reincarnations += 1;

  state.lifeStartInGameDay = state.inGameDay;
  state.spiritStones = "0";
  state.peakSpiritStonesThisLife = "0";
  state.realmLevel = 1;
  state.summonEssence = 80 + state.meta.ticketRegen * 24;
  state.owned = {};
  state.deck = Array.from({ length: DECK_SIZE }, () => null);
  state.gearInventory = {};
  state.equippedGear = { weapon: null, body: null, ring: null };
  state.nextGearInstanceId = 1;
  state.skills = {
    combat: { level: 1, xp: 0 },
    gathering: { level: 1, xp: 0 },
    arcana: { level: 1, xp: 0 },
  };
  state.activeSkillId = "combat";
  state.dungeon = {
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
    vortexKillStreak: 0,
    vortexStreakExpireAt: 0,
    vortexLeylineX: 0.5,
    vortexLeylineY: 0.5,
    vortexLeylineRadiusNorm: 0.088,
    vortexLeylineKind: "fury",
    vortexLeylineMoveAt: 0,
  };
  state.lingSha = 0;
  state.xuanTie = 0;
  state.battleSkills = {};
  state.lastTunaMs = 0;
  state.pityUr = 0;
  state.pitySsrSoft = 0;
  state.gearPityPulls = 0;
  state.pullsThisLife = 0;
  state.wishResonance = 0;
  state.combatHpCurrent = playerMaxHp(state);
  state.dungeonSanctuaryMode = false;
  state.dungeonPortalTargetWave = 0;
  reseedRng(state);
}

export const META_COST_BASE = [8, 10, 12, 15, 18];

export function metaUpgradeCost(kind: keyof GameState["meta"], level: number): number {
  const bases: Record<keyof GameState["meta"], number> = {
    idleMult: 8,
    gachaLuck: 9,
    deckSlots: 18,
    ticketRegen: 10,
    stoneMult: 10,
  };
  const b = bases[kind];
  return Math.floor(b * Math.pow(1.52, level));
}

export function buyMeta(state: GameState, kind: keyof GameState["meta"]): boolean {
  const cur = state.meta[kind];
  if (kind === "deckSlots" && cur >= 2) return false;
  if (cur >= 20) return false;
  const cost = metaUpgradeCost(kind, cur);
  if (state.daoEssence < cost) return false;
  state.daoEssence -= cost;
  state.meta[kind] = cur + 1;
  return true;
}
