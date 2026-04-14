import Decimal from "decimal.js";
import type { GameState } from "./types";
import { ESSENCE_COST_GEAR_SINGLE, ESSENCE_COST_SINGLE, MAX_CARD_LEVEL, REINCARNATION_REALM_REQ } from "./types";
import { incomePerSecond, realmBreakthroughCostForState, upgradeCardLevelCost, upgradeCardLingShaCost } from "./economy";
import { canAfford } from "./stones";
import { canClaimDailyLoginReward } from "./systems/dailyLoginCalendar";
import { countClaimableWeeklyAll } from "./systems/weeklyBounty";
import { canClaimSpiritReservoir, spiritReservoirUnlocked } from "./systems/spiritReservoir";
import { canClaimIdleLingShaDrip, idleLingShaDripUnlocked } from "./systems/idleLingShaDrip";
import { canUpgradeSpiritArray } from "./systems/spiritArray";
import { battleSkillPullCost } from "./systems/battleSkills";
import {
  gongMingUpgradeCost,
  guYuanUpgradeCost,
  huiLingUpgradeCost,
  lingXiUpgradeCost,
  VEIN_MAX_LEVEL,
  VEIN_TITLES,
  type VeinKind,
} from "./systems/veinCultivation";
import { nextDaoMeridianCost } from "./systems/daoMeridian";
import { canReincarnate, metaUpgradeCost } from "./systems/reincarnation";
import { getUiUnlocks } from "./uiUnlocks";
import { fmtDecimal } from "./stones";

export interface NextBoostHint {
  /** 与 DOM `data-next-boost-target` 对应 */
  scrollTarget: string;
  /** 主标题（按钮大字） */
  title: string;
  /** 一行说明（可选） */
  detailLine: string;
  /** 排序权重（越高越优先） */
  priority: number;
  /** 是否视为「可领取」类（用于强调样式） */
  claimStyle: boolean;
}

const VEIN_SCAN: VeinKind[] = ["huiLing", "lingXi", "gongMing", "guYuan"];

const META_ORDER: (keyof GameState["meta"])[] = ["idleMult", "gachaLuck", "deckSlots", "ticketRegen", "stoneMult"];

function veinAffordable(state: GameState, kind: VeinKind): boolean {
  const cur = state.vein[kind];
  if (cur >= VEIN_MAX_LEVEL) return false;
  if (kind === "huiLing") return canAfford(state, huiLingUpgradeCost(cur));
  if (kind === "guYuan") return state.daoEssence >= guYuanUpgradeCost(cur);
  if (kind === "lingXi") return canAfford(state, lingXiUpgradeCost(cur));
  return canAfford(state, gongMingUpgradeCost(cur));
}

function pickAffordableVein(state: GameState): VeinKind | null {
  for (const k of VEIN_SCAN) {
    if (veinAffordable(state, k)) return k;
  }
  return null;
}

function pickAffordableMeta(state: GameState): keyof GameState["meta"] | null {
  for (const k of META_ORDER) {
    const lv = state.meta[k];
    const maxed = k === "deckSlots" ? lv >= 2 : lv >= 20;
    if (maxed) continue;
    const cost = metaUpgradeCost(k, lv);
    if (state.daoEssence >= cost) return k;
  }
  return null;
}

function bestCardLevelUp(
  state: GameState,
  pool: number,
): { defId: string; level: number; stone: Decimal; lingSha: number } | null {
  let best: { defId: string; level: number; stone: Decimal; lingSha: number; dIps: Decimal } | null = null;
  const ips0 = incomePerSecond(state, pool);
  for (const defId of Object.keys(state.owned)) {
    const o = state.owned[defId];
    if (!o || o.level >= MAX_CARD_LEVEL) continue;
    const stone = upgradeCardLevelCost(o.level);
    const lingSha = upgradeCardLingShaCost(o.level);
    if (!canAfford(state, stone) || state.lingSha < lingSha) continue;
    const next: GameState = {
      ...state,
      owned: {
        ...state.owned,
        [defId]: { ...o, level: o.level + 1 },
      },
    };
    const dIps = Decimal.max(0, incomePerSecond(next, pool).minus(ips0));
    if (!best || dIps.gt(best.dIps)) {
      best = { defId, level: o.level, stone, lingSha, dIps };
    }
  }
  if (!best) return null;
  return { defId: best.defId, level: best.level, stone: best.stone, lingSha: best.lingSha };
}

/**
 * 返回当前最值得一键前往的「下一步成长」提示；无可用目标时返回 null。
 * 刻意忽略每秒剧烈波动的量（如共鸣条、战斗内读数），仅使用离散状态与可重复判定。
 */
export function computeNextBoostHint(state: GameState, nowMs: number, pool: number): NextBoostHint | null {
  if (state.tutorialStep !== 0) return null;

  const u = getUiUnlocks(state);

  if (u.tabDailyLogin && canClaimDailyLoginReward(state, nowMs)) {
    return {
      scrollTarget: "daily-login",
      title: "领取灵息礼",
      detailLine: "今日奖励尚未领取",
      priority: 100,
      claimStyle: true,
    };
  }

  if (u.tabBounty && countClaimableWeeklyAll(state, nowMs) > 0) {
    const n = countClaimableWeeklyAll(state, nowMs);
    return {
      scrollTarget: "bounty-claim",
      title: "周常悬赏可领",
      detailLine: n > 1 ? `共 ${n} 条奖励待领取` : "悬赏或里程奖励可领取",
      priority: 96,
      claimStyle: true,
    };
  }

  if (u.tabSpiritReservoir && spiritReservoirUnlocked(state) && canClaimSpiritReservoir(state)) {
    return {
      scrollTarget: "spirit-reservoir",
      title: "收取蓄灵池",
      detailLine: "池内已有灵石可并入账",
      priority: 92,
      claimStyle: true,
    };
  }

  if (u.tabSpiritReservoir && idleLingShaDripUnlocked(state) && canClaimIdleLingShaDrip(state)) {
    return {
      scrollTarget: "ling-sha-drip",
      title: "收取灵砂涓滴",
      detailLine: "凝露已满，可领 1 灵砂",
      priority: 91,
      claimStyle: true,
    };
  }

  const rb = realmBreakthroughCostForState(state);
  const canBreak = canAfford(state, rb);
  if (canBreak && !state.qoL.autoRealm) {
    return {
      scrollTarget: "realm-break",
      title: "境界可破境",
      detailLine: `消耗 ${fmtDecimal(rb)} 灵石`,
      priority: 88,
      claimStyle: false,
    };
  }

  if (u.tabGear && state.zhuLingEssence >= ESSENCE_COST_GEAR_SINGLE && !state.autoGearForge) {
    return {
      scrollTarget: "gacha-gear",
      title: "境界铸灵可单铸",
      detailLine: `筑灵髓 ≥ ${ESSENCE_COST_GEAR_SINGLE}`,
      priority: 82,
      claimStyle: false,
    };
  }

  if (state.summonEssence >= ESSENCE_COST_SINGLE && !state.qoL.autoGacha) {
    return {
      scrollTarget: "gacha-card",
      title: "灵卡池可单抽",
      detailLine: `唤灵髓 ≥ ${ESSENCE_COST_SINGLE}`,
      priority: 80,
      claimStyle: false,
    };
  }

  if (u.tabBattleSkills && state.summonEssence >= battleSkillPullCost() && !state.uiPrefs.autoPullBattleSkill) {
    return {
      scrollTarget: "battle-skill-pull",
      title: "心法可领悟",
      detailLine: `唤灵髓 ≥ ${battleSkillPullCost()}`,
      priority: 78,
      claimStyle: false,
    };
  }

  if (u.tabSpiritArray && canUpgradeSpiritArray(state) && !state.uiPrefs.autoUpgradeSpiritArray) {
    return {
      scrollTarget: "spirit-array-up",
      title: "纳灵阵图可绘阵",
      detailLine: "灵石与灵砂足够时可升一重",
      priority: 76,
      claimStyle: false,
    };
  }

  const veinPick = u.tabVein ? pickAffordableVein(state) : null;
  if (veinPick && !state.uiPrefs.autoUpgradeVein) {
    const t = VEIN_TITLES[veinPick];
    return {
      scrollTarget: `vein-${veinPick}`,
      title: `洞府·${t}可强化`,
      detailLine: "资源足够时可立即升级",
      priority: 72,
      claimStyle: false,
    };
  }

  const metaPick = u.tabMeta ? pickAffordableMeta(state) : null;
  if (metaPick && !state.uiPrefs.autoBuyMeta) {
    const titles: Record<keyof GameState["meta"], string> = {
      idleMult: "灵脉共鸣",
      gachaLuck: "祈愿加护",
      deckSlots: "额外槽位",
      ticketRegen: "轮回赠髓",
      stoneMult: "灵石心印",
    };
    const lv = state.meta[metaPick];
    const cost = metaUpgradeCost(metaPick, lv);
    return {
      scrollTarget: `meta-${metaPick}`,
      title: `元强化·${titles[metaPick]}`,
      detailLine: `道韵 ${cost} 可强化`,
      priority: 68,
      claimStyle: false,
    };
  }

  if (u.tabDaoMeridian) {
    const cost = nextDaoMeridianCost(state);
    if (cost != null && state.daoEssence >= cost && !state.uiPrefs.autoBuyDaoMeridian) {
      return {
        scrollTarget: "dao-meridian-panel",
        title: "道韵灵窍可贯通",
        detailLine: `下一层需 ${cost} 道韵`,
        priority: 66,
        claimStyle: false,
      };
    }
  }

  const cardUp = u.tabTrain ? bestCardLevelUp(state, pool) : null;
  if (cardUp && !state.qoL.bulkLevel) {
    return {
      scrollTarget: "deck-panel",
      title: "灵卡可升阶",
      detailLine: `灵石 ${fmtDecimal(cardUp.stone)} · 灵砂 ${cardUp.lingSha}`,
      priority: 64,
      claimStyle: false,
    };
  }

  if (u.tabMeta && canReincarnate(state)) {
    return {
      scrollTarget: "rein",
      title: `境界 ${REINCARNATION_REALM_REQ} 重·可入轮回`,
      detailLine: "结算道韵与元强化进度",
      priority: 55,
      claimStyle: false,
    };
  }

  return null;
}

export function scrollToNextBoostTarget(target: string): void {
  const el = document.querySelector(`[data-next-boost-target="${target}"]`) as HTMLElement | null;
  if (!el) return;
  el.scrollIntoView({ behavior: "smooth", block: "center" });
  el.classList.add("next-boost-jump-flash");
  window.setTimeout(() => el.classList.remove("next-boost-jump-flash"), 900);
}
