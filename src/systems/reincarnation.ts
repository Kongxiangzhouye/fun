import Decimal from "decimal.js";
import type { GameState } from "../types";
import { REINCARNATION_REALM_REQ, DECK_SIZE } from "../types";
import { reseedRng } from "../rng";
import { emptyDungeon } from "../state";
import { playerMaxHp } from "./playerCombat";
import { createEmptyEstateCommissionState } from "./estateCommission";
import { normalizeLifetimeStats, recordDaoEssenceSpentLifetime } from "./pullChronicle";

export function canReincarnate(state: GameState): boolean {
  return state.realmLevel >= REINCARNATION_REALM_REQ;
}

/** 道韵分解（与 `daoEssenceGainOnReincarnate` 同源） */
export interface DaoEssenceGainBreakdown {
  /** 本轮灵石峰值对数项 */
  peakLogPart: number;
  /** 持有卡数量加成（向下取整） */
  cardBonus: number;
  ownedCardCount: number;
  /** 保底道韵 */
  floorMin: number;
  total: number;
}

export function daoEssenceGainBreakdown(state: GameState): DaoEssenceGainBreakdown {
  const peak = new Decimal(state.peakSpiritStonesThisLife || "0");
  let peakLogPart = 0;
  if (peak.gt(1)) {
    peakLogPart = Math.max(0, Math.floor(peak.log(10).times(3.8).toNumber()));
  }
  const ownedCardCount = Object.keys(state.owned).length;
  const cardBonus = Math.floor(ownedCardCount * 0.28);
  const floorMin = 3;
  const total = Math.max(floorMin, peakLogPart + cardBonus);
  return { peakLogPart, cardBonus, ownedCardCount, floorMin, total };
}

/** 道韵：按本轮峰值灵石 log10 对数结算（设计案 §2） */
export function daoEssenceGainOnReincarnate(state: GameState): number {
  return daoEssenceGainBreakdown(state).total;
}

export function performReincarnate(state: GameState): void {
  const gain = daoEssenceGainOnReincarnate(state);
  state.daoEssence += gain;
  state.reincarnations += 1;
  state.lifePlaytimeSec = 0;

  state.lifeStartInGameDay = state.inGameDay;
  state.spiritStones = "0";
  state.peakSpiritStonesThisLife = "0";
  state.realmLevel = 1;
  state.summonEssence = 80 + state.meta.ticketRegen * 24;
  state.zhuLingEssence = 28 + state.meta.ticketRegen * 10;
  state.owned = {};
  state.deck = Array.from({ length: DECK_SIZE }, () => null);
  state.gearInventory = {};
  state.equippedGear = {
    weapon: null,
    body: null,
    ring: null,
    slot4: null,
    slot5: null,
    slot6: null,
    slot7: null,
    slot8: null,
    slot9: null,
    slot10: null,
    slot11: null,
    slot12: null,
  };
  state.gearSlotEnhance = {
    weapon: 0,
    body: 0,
    ring: 0,
    slot4: 0,
    slot5: 0,
    slot6: 0,
    slot7: 0,
    slot8: 0,
    slot9: 0,
    slot10: 0,
    slot11: 0,
    slot12: 0,
  };
  state.nextGearInstanceId = 1;
  state.skills = {
    combat: { level: 1, xp: 0 },
    gathering: { level: 1, xp: 0 },
    arcana: { level: 1, xp: 0 },
  };
  state.activeSkillId = "combat";
  state.dungeon = emptyDungeon();
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
  state.dungeonDeferBoss = true;
  // 轮回净化：离线奇遇与委托状态必须回到初始，避免旧档残留影响新周目。
  state.offlineAdventure.pending = null;
  state.offlineAdventure.activeBoostUntilMs = 0;
  state.offlineAdventure.activeBoostMult = 1;
  state.offlineAdventure.resonanceType = null;
  state.offlineAdventure.resonanceStacks = 0;
  state.offlineAdventure.lastAutoSettleReceipt = null;
  state.estateCommission = createEmptyEstateCommissionState();
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
  recordDaoEssenceSpentLifetime(state, cost);
  state.meta[kind] = cur + 1;
  normalizeLifetimeStats(state);
  state.lifetimeStats.metaUpgrades += 1;
  return true;
}

const META_AUTO_ORDER: (keyof GameState["meta"])[] = ["idleMult", "gachaLuck", "deckSlots", "ticketRegen", "stoneMult"];

/** 主循环：`uiPrefs.autoBuyMeta` 时多轮按顺序尝试 `buyMeta`，返回本轮成功次数 */
export function tryAutoBuyMetaIfPref(state: GameState): number {
  if (!state.uiPrefs.autoBuyMeta) return 0;
  let total = 0;
  let roundGuard = 0;
  while (roundGuard++ < 400) {
    let progressed = false;
    for (const k of META_AUTO_ORDER) {
      if (buyMeta(state, k)) {
        total += 1;
        progressed = true;
      }
    }
    if (!progressed) break;
  }
  return total;
}
