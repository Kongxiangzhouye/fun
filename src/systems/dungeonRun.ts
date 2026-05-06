import type {
  DungeonEnemyIntent,
  DungeonMob,
  DungeonRunCombatGrade,
  DungeonRunEnemy,
  DungeonRunEventOption,
  DungeonRunEventState,
  DungeonBossOmen,
  DungeonRunNode,
  DungeonRunNodeType,
  DungeonRunObjective,
  DungeonRunObjectiveKind,
  DungeonRunOpportunityAction,
  DungeonRunOutcome,
  DungeonRunRewardOption,
  DungeonRunRoutePlan,
  DungeonRunRouteChoice,
  DungeonRunEnemyRole,
  DungeonRunWarrant,
  DungeonRunWarrantKind,
  Element,
  GameState,
} from "../types";
import {
  DUNGEON_DODGE_IFRAMES_MS,
  DUNGEON_DODGE_STAMINA_COST,
  DUNGEON_STAMINA_MAX,
  DUNGEON_STAMINA_REGEN_PER_SEC,
  PLAYER_DUNGEON_HIT_INTERVAL_SEC,
} from "../types";
import { RUN_EVENTS } from "../data/runEvents";
import { getRunBlessing } from "../data/runBlessings";
import { nextRand01 } from "../rng";
import { elementDamageMultiplier } from "./elementCombat";
import { playerBattleElement } from "./playerElement";
import {
  playerAttack,
  playerCritChance,
  playerCritMult,
  playerDungeonAttackSpeedMult,
  playerMaxHp,
} from "./playerCombat";
import { noteWeeklyBountyWave } from "./weeklyBounty";
import { canAfford, subStones } from "../stones";
import {
  buildRunRewardOptions,
  dominantRunElement,
  grantRunCompletionRewards,
  applyRunReward as applyRunRewardImported,
  deckElementCountsForRun,
  runBlessingTotals,
  runBlessingElementCounts,
  runBuildVerbProfile,
} from "./runRewards";

export interface DungeonBossPrepSnapshot {
  phase: DungeonCombatPhase;
  req: number;
  kills: number;
  canChallenge: boolean;
  prepEssenceMult: number;
  challengeHint: string;
}

export type DungeonCombatPhase = "trash" | "boss_prep" | "boss_fight";

export const DUNGEON_DUEL_FEEDBACK = {
  comboHighStacks: 6,
  hitDecoComboThreshold: 3,
  critDecoComboThreshold: 6,
  comboChainDecoThreshold: 5,
  weakTriggerInitBaseMs: 700,
  weakTriggerInitRandMs: 1200,
  weakTriggerWindowBaseMs: 900,
  weakTriggerWindowRandMs: 1500,
  weakTriggerCooldownBaseMs: 5200,
  weakTriggerCooldownRandMs: 2600,
  weakTriggerChance: 0.5,
  duelFxHitMs: 140,
  duelFxHitDecoMs: 170,
  duelFxCritDecoMs: 260,
  duelFxGuardDecoMs: 320,
  duelFxWeaknessPingMs: 360,
  parryHitDecoIframesRemainMs: 180,
} as const;

export interface DungeonDamageFloat {
  nx: number;
  ny: number;
  text: string;
  cls: "dmg-out" | "dmg-out-crit" | "dmg-in" | "dmg-miss" | "dmg-special";
}

const damageFloatQueue: DungeonDamageFloat[] = [];
const EL_LIST: Element[] = ["metal", "wood", "water", "fire", "earth"];
const PERFECT_DODGE_WINDOW_MS = 760;
const COUNTER_STAGGER_MS = 1450;
const MAX_LOCKED_RUN_REWARDS = 2;
const BOSS_OMEN_MS = 4200;

export function runThreatRewardMult(state: GameState): number {
  return 1 + Math.min(0.65, Math.max(0, state.dungeon.runThreat) * 0.0065);
}

function runThreatEnemyMult(state: GameState): number {
  return 1 + Math.min(0.55, Math.max(0, state.dungeon.runThreat) * 0.0055);
}

function applyRunThreatDelta(state: GameState, delta: number): void {
  const d = state.dungeon;
  d.runThreat = Math.max(0, Math.min(100, d.runThreat + delta));
}

export function eventOptionCheckChance(state: GameState, opt: DungeonRunEventOption): number {
  if (!opt.checkElement) return 1;
  const deckCounts = deckElementCountsForRun(state);
  const blessingCounts = runBlessingElementCounts(state);
  const element = opt.checkElement;
  const dominantBonus = dominantRunElement(state) === element ? 0.1 : 0;
  return Math.max(0.18, Math.min(0.92, 0.42 + deckCounts[element] * 0.11 + blessingCounts[element] * 0.09 + dominantBonus));
}

function pushDamageFloat(
  nx: number,
  ny: number,
  text: string,
  cls: DungeonDamageFloat["cls"],
): void {
  damageFloatQueue.push({ nx, ny, text, cls });
}

export function drainDungeonDamageFloats(): DungeonDamageFloat[] {
  if (damageFloatQueue.length === 0) return [];
  return damageFloatQueue.splice(0, damageFloatQueue.length);
}

function randPick<T>(state: GameState, arr: readonly T[]): T {
  return arr[Math.floor(nextRand01(state) * arr.length)]!;
}

function nodeTitle(type: DungeonRunNodeType, idx: number): string {
  if (type === "boss") return "劫主镇域";
  if (type === "elite") return "精怪拦路";
  if (type === "event") return "秘境歧路";
  if (type === "rest") return "灵泉整息";
  return `第 ${idx + 1} 阵`;
}

function routeNodeTitle(type: DungeonRunNodeType): string {
  if (type === "elite") return "精英拦路";
  if (type === "event") return "秘境岔路";
  if (type === "rest") return "灵泉整息";
  return "妖影伏击";
}

function runEnemyRoleName(role: DungeonRunEnemyRole): string {
  if (role === "boss") return "首领";
  if (role === "guard") return "护卫";
  if (role === "drain") return "汲灵";
  if (role === "ranged") return "远程";
  return "近战";
}

export function runEnemyRoleTactic(role: DungeonRunEnemyRole): string {
  if (role === "guard") return "护卫：常结护势，心法技或终结压制可夺破甲战果。";
  if (role === "drain") return "汲灵：会夺筑灵髓，打断汲灵后返还更多资源。";
  if (role === "ranged") return "远程：攻势窗口更适合精准闪避，击破后补身法与体力。";
  if (role === "boss") return "首领：分阶段劫兆，按提示反制可破架势。";
  return "近战：攻势直接，稳住血线后可缴获护盾余劲。";
}

function bossOmenName(omen: DungeonBossOmen): string {
  if (omen === "heaven-strike") return "天坠";
  if (omen === "soul-drain") return "摄魂";
  if (omen === "inferno") return "劫焰";
  return "无";
}

function bossOmenCounterName(omen: DungeonBossOmen): string {
  if (omen === "heaven-strike") return "闪避";
  if (omen === "soul-drain") return "心法技";
  if (omen === "inferno") return "终结技";
  return "行动";
}

function clearBossOmen(state: GameState): void {
  const d = state.dungeon;
  d.runBossOmen = "none";
  d.runBossOmenUntilMs = 0;
}

function setBossOmen(state: GameState, omen: DungeonBossOmen, phase: number, now: number): void {
  const d = state.dungeon;
  const e = d.runEnemy;
  if (!e || e.role !== "boss" || omen === "none") return;
  d.runBossPhase = Math.max(d.runBossPhase, phase);
  d.runBossOmen = omen;
  d.runBossOmenUntilMs = now + BOSS_OMEN_MS;
  delayEnemyIntent(e, now, BOSS_OMEN_MS + 500);
  d.runLog = `首领劫兆：${bossOmenName(omen)}。${BOSS_OMEN_MS / 1000} 秒内用${bossOmenCounterName(omen)}反制。`;
  pushDamageFloat(0.54, 0.24, bossOmenName(omen), "dmg-special");
}

function routeAttuneBonusText(element: Element): string {
  if (element === "metal") return "契合金：终结 +18，筑灵髓小幅入袋。";
  if (element === "wood") return "契合木：回生并补少量筑灵髓。";
  if (element === "water") return "契合水：体力回流，战利品重掷 +1。";
  if (element === "earth") return "契合土：获得护盾，劫压下降。";
  return "契合火：战意升温，灵砂 +1。";
}

function routeScoutText(route: DungeonRunRouteChoice): string {
  if (route.scoutText) return route.scoutText;
  if (route.forecastEnemyRole && route.forecastEnemyElement) {
    return `探得敌势：${runElementName(route.forecastEnemyElement)}行${runEnemyRoleName(route.forecastEnemyRole)}。`;
  }
  if (route.nodeType === "event") return "探得秘境：可能出现资源交换、五行检定或风险挑战。";
  if (route.nodeType === "rest") return "探得灵泉：可恢复、淬印或蓄势。";
  return "探得妖影：短战后获得灵印草案。";
}

function routePlanLabel(plan?: DungeonRunRoutePlan): string {
  if (plan === "safe") return "稳阵";
  if (plan === "tempo") return "疾攻";
  if (plan === "risk") return "险搏";
  if (plan === "draft") return "探秘";
  return "行旅";
}

function routeBuildFitFor(state: GameState, route: DungeonRunRouteChoice): Pick<DungeonRunRouteChoice, "routeBuildFit" | "routeBuildHint"> {
  const top = runBuildVerbProfile(state)[0];
  const verb = top?.verb ?? "未成型";
  const count = top?.count ?? 0;
  if (count <= 0 || verb === "未成型") {
    return { routeBuildFit: "steady", routeBuildHint: "流派未成型：这条路线会帮你决定下一段构筑方向。" };
  }
  if (route.nodeType === "elite") {
    if (verb === "爆发" || verb === "终结" || verb === "破防") {
      return { routeBuildFit: "match", routeBuildHint: `${verb}流适合冲精英：更容易把高风险转成厚战利品。` };
    }
    if (verb === "护盾" || verb === "续航") {
      return { routeBuildFit: "steady", routeBuildHint: `${verb}流能吃住精英压力，但要留意劫压和敌方职责。` };
    }
    return { routeBuildFit: "risk", routeBuildHint: `${verb}流打精英收益高，但当前爆发/破防不足。` };
  }
  if (route.nodeType === "rest") {
    if (verb === "护盾" || verb === "续航") {
      return { routeBuildFit: "match", routeBuildHint: `${verb}流在灵泉可滚雪球，补状态后继续压线。` };
    }
    if (state.dungeon.playerHp < state.dungeon.playerMax * 0.55 || state.dungeon.runThreat >= 30) {
      return { routeBuildFit: "steady", routeBuildHint: "当前血量或劫压偏紧：整息能保住本局节奏。" };
    }
    return { routeBuildFit: "risk", routeBuildHint: `${verb}流选择整息会更稳，但会放慢战利品节奏。` };
  }
  if (route.nodeType === "event") {
    if (verb === "资源" || verb === "闪避") {
      return { routeBuildFit: "match", routeBuildHint: `${verb}流适合探秘：检定、重掷和战利品草案更值钱。` };
    }
    return { routeBuildFit: "steady", routeBuildHint: `${verb}流可用事件补缺口，寻找另一条战斗动词。` };
  }
  if (verb === "爆发" || verb === "终结" || verb === "破防" || verb === "闪避") {
    return { routeBuildFit: "match", routeBuildHint: `${verb}流适合直穿短战，快速兑现当前战斗按钮。` };
  }
  return { routeBuildFit: "steady", routeBuildHint: `${verb}流打普通战稳妥，继续补灵印形成二段路线。` };
}

function rewardVerbRoutePreference(verb: string): DungeonRunNodeType[] {
  if (verb === "爆发" || verb === "终结" || verb === "破防") return ["elite", "combat"];
  if (verb === "闪避" || verb === "资源" || verb === "构筑") return ["event", "combat"];
  if (verb === "护盾" || verb === "续航") return ["rest", "elite"];
  if (verb === "节奏") return ["combat", "event"];
  return ["combat", "event"];
}

function withRewardVerbRouteRecommendation(state: GameState, route: DungeonRunRouteChoice): DungeonRunRouteChoice {
  const d = state.dungeon;
  const verb = d.runRewardVerb;
  const streak = Math.max(0, Math.min(9, Math.floor(d.runRewardVerbStreak)));
  if (!verb || streak <= 0) return route;
  const preference = rewardVerbRoutePreference(verb);
  if (route.nodeType !== preference[0]) return route;

  const next = { ...route };
  const power = Math.max(1, Math.min(4, streak));
  const streakText = streak >= 2 ? `连选 x${streak}` : "刚起势";
  next.routeRecommend = true;
  next.routeBuildFit = "match";

  if (route.nodeType === "elite" || route.nodeType === "combat") {
    const finisher = 4 + power * 4;
    next.routeFinisherBonus = (next.routeFinisherBonus ?? 0) + finisher;
    if (route.nodeType === "combat") next.rewardZhuLingEssence = (next.rewardZhuLingEssence ?? 0) + power;
    next.routeRecommendHint = `${verb}${streakText}：顺势进战斗，开场终结 +${finisher}${route.nodeType === "combat" ? `、筑灵髓 +${power}` : ""}。`;
  } else if (route.nodeType === "event") {
    next.routeStyleBonus = (next.routeStyleBonus ?? 0) + 1;
    next.routeRerollBonus = Math.min(3, (next.routeRerollBonus ?? 0) + 1);
    next.routeRecommendHint = `${verb}${streakText}：先探秘扩草案，身法 +1、战利品重掷 +1。`;
  } else {
    const shieldPct = 0.04 + power * 0.02;
    next.routeShieldPct = (next.routeShieldPct ?? 0) + shieldPct;
    next.threatDelta = (next.threatDelta ?? 0) - (1 + power);
    next.routeRecommendHint = `${verb}${streakText}：先整息滚容错，护盾 +${Math.round(shieldPct * 100)}%、劫压 -${1 + power}。`;
  }

  return next;
}

function withRoutePledgeFit(state: GameState, route: DungeonRunRouteChoice): DungeonRunRouteChoice {
  const streak = Math.max(0, Math.min(9, Math.floor(state.dungeon.runRoutePledgeStreak)));
  if (streak <= 0 || !route.plan) return route;
  const next = { ...route };
  const power = Math.min(4, 1 + Math.floor(streak / 2));
  let payoff = "";
  if (route.plan === "tempo") {
    const style = power;
    const finisher = 6 + power * 4;
    next.routeStyleBonus = (next.routeStyleBonus ?? 0) + style;
    next.routeFinisherBonus = (next.routeFinisherBonus ?? 0) + finisher;
    payoff = `疾攻开场身法 +${style}、终结 +${finisher}`;
  } else if (route.plan === "risk") {
    const zhu = 3 + streak * 2;
    const finisher = 8 + power * 5;
    next.rewardZhuLingEssence = (next.rewardZhuLingEssence ?? 0) + zhu;
    next.rewardLingSha = (next.rewardLingSha ?? 0) + (streak >= 3 ? 1 : 0);
    next.routeFinisherBonus = (next.routeFinisherBonus ?? 0) + finisher;
    payoff = `险搏先取筑灵髓 +${zhu}、终结 +${finisher}${streak >= 3 ? "、灵砂 +1" : ""}`;
  } else if (route.plan === "safe") {
    const shieldPct = 0.04 + power * 0.02;
    const threatCut = 1 + power;
    next.routeShieldPct = (next.routeShieldPct ?? 0) + shieldPct;
    next.threatDelta = (next.threatDelta ?? 0) - threatCut;
    payoff = `稳阵额外护盾 ${Math.round(shieldPct * 100)}%、劫压 -${threatCut}`;
  } else {
    const zhu = 2 + streak * 2;
    next.rewardZhuLingEssence = (next.rewardZhuLingEssence ?? 0) + zhu;
    next.routeStyleBonus = (next.routeStyleBonus ?? 0) + 1;
    next.routeRerollBonus = Math.min(2, (next.routeRerollBonus ?? 0) + 1);
    payoff = `探秘先取筑灵髓 +${zhu}、身法 +1、重掷 +1`;
  }
  const pledgeHint = `承诺连段 x${streak} 放大${routePlanLabel(route.plan)}：${payoff}。`;
  next.routeBuildFit = next.routeBuildFit === "risk" ? "steady" : (next.routeBuildFit ?? "match");
  next.planPreview = next.planPreview ? `${next.planPreview} ${pledgeHint}` : pledgeHint;
  return next;
}

function appendRouteEchoHint(route: DungeonRunRouteChoice, hint: string, fit: "match" | "steady"): DungeonRunRouteChoice {
  const next = { ...route };
  next.routeEchoFit = fit === "match" ? "match" : (next.routeEchoFit ?? "steady");
  next.routeEchoHint = next.routeEchoHint ? `${next.routeEchoHint} ${hint}` : hint;
  return next;
}

function withEventEchoRouteFit(state: GameState, route: DungeonRunRouteChoice): DungeonRunRouteChoice {
  const d = state.dungeon;
  const plan = d.runEventEchoPlan;
  const power = Math.max(0, Math.min(3, Math.floor(d.runEventEchoPower ?? 0)));
  if (!plan || power <= 0 || !route.plan) return route;
  const label = routePlanLabel(plan);
  if (route.plan !== plan) {
    return appendRouteEchoHint(route, `${label}余势 x${power} 会保留到下一场；同风格路线可把它放大。`, route.routeEchoFit ?? "steady");
  }

  const next = appendRouteEchoHint(route, `${label}余势 x${power} 契合这条路线：选中后余势升阶，并立刻获得同风格布势。`, "match");
  next.routeRecommend = true;
  next.routeRecommendHint = next.routeRecommendHint
    ? `${next.routeRecommendHint} ${label}余势契合：选中后余势升阶。`
    : `${label}余势契合：选中后余势升阶。`;

  if (plan === "safe") {
    next.routeShieldPct = (next.routeShieldPct ?? 0) + 0.04 + power * 0.02;
    next.threatDelta = (next.threatDelta ?? 0) - (1 + power);
  } else if (plan === "tempo") {
    next.routeStyleBonus = (next.routeStyleBonus ?? 0) + power;
    next.routeFinisherBonus = (next.routeFinisherBonus ?? 0) + 6 + power * 4;
  } else if (plan === "risk") {
    next.rewardZhuLingEssence = (next.rewardZhuLingEssence ?? 0) + 3 + power * 3;
    next.routeFinisherBonus = (next.routeFinisherBonus ?? 0) + 8 + power * 4;
  } else {
    next.routeStyleBonus = (next.routeStyleBonus ?? 0) + 1;
    next.routeRerollBonus = Math.min(3, (next.routeRerollBonus ?? 0) + 1);
    next.rewardZhuLingEssence = (next.rewardZhuLingEssence ?? 0) + 2 + power * 2;
  }
  return next;
}

function eventBuildFitFor(state: GameState, opt: DungeonRunEventOption): Pick<DungeonRunEventOption, "eventBuildFit" | "eventBuildHint"> {
  const top = runBuildVerbProfile(state)[0];
  const verb = top?.verb ?? "未成型";
  const count = top?.count ?? 0;
  if (count <= 0 || verb === "未成型") {
    return {
      eventBuildFit: "steady",
      eventBuildHint: "流派未成型：这项事件会帮助你确定第一条战斗路线。",
    };
  }

  const isRisk = opt.eventPlan === "risk" || opt.riskCombat || (opt.costHpPct ?? 0) >= 0.16;
  const isSafe = opt.eventPlan === "safe" || (opt.healPct ?? 0) > 0 || (opt.eventShieldPct ?? 0) > 0 || (opt.shieldPct ?? 0) > 0;
  const isDraft = opt.eventPlan === "draft" || opt.rewardDraft || (opt.eventRerollBonus ?? 0) > 0;
  const isTempo = opt.eventPlan === "tempo" || (opt.eventFinisherBonus ?? 0) > 0 || (opt.eventStyleBonus ?? 0) > 0;
  const givesResource =
    (opt.rewardSummonEssence ?? 0) > 0 ||
    (opt.rewardZhuLingEssence ?? 0) > 0 ||
    (opt.rewardLingSha ?? 0) > 0 ||
    (opt.rewardXuanTie ?? 0) > 0;

  if (verb === "爆发" || verb === "终结" || verb === "破防") {
    if (isRisk || isTempo || opt.checkElement === "fire" || opt.checkElement === "metal") {
      return {
        eventBuildFit: "match",
        eventBuildHint: `${verb}流适合把事件转成节奏：拿身法、终结或风险战利品。`,
      };
    }
    if (isSafe) {
      return {
        eventBuildFit: "risk",
        eventBuildHint: `${verb}流选择保守项会更稳，但会放慢击杀和奖励滚动。`,
      };
    }
  }

  if (verb === "闪避") {
    if (opt.checkElement === "water" || isDraft || (opt.eventStyleBonus ?? 0) > 0) {
      return {
        eventBuildFit: "match",
        eventBuildHint: "闪避流适合检定、重掷和身法奖励，能继续扩大反制窗口。",
      };
    }
    if (isRisk) {
      return {
        eventBuildFit: "risk",
        eventBuildHint: "闪避流可以赌风险，但当前收益更依赖身法与重掷衔接。",
      };
    }
  }

  if (verb === "护盾" || verb === "续航") {
    if (isSafe || opt.checkElement === "earth" || opt.checkElement === "wood") {
      return {
        eventBuildFit: "match",
        eventBuildHint: `${verb}流适合稳阵事件：回血、架盾后更容易吃住精英压力。`,
      };
    }
    if (isRisk && state.dungeon.playerHp < state.dungeon.playerMax * 0.62) {
      return {
        eventBuildFit: "risk",
        eventBuildHint: `${verb}流当前血线偏紧，风险选项会消耗你的容错。`,
      };
    }
  }

  if (verb === "资源") {
    if (isDraft || givesResource) {
      return {
        eventBuildFit: "match",
        eventBuildHint: "资源流适合把事件换成材料、重掷或战利品草案。",
      };
    }
    if (isRisk) {
      return {
        eventBuildFit: "risk",
        eventBuildHint: "资源流走风险可抬高回报，但要确认血量与劫压撑得住。",
      };
    }
  }

  return {
    eventBuildFit: "steady",
    eventBuildHint: `${verb}流可用这项事件补缺口，选择后观察下一场路线。`,
  };
}

function withEventBuildHints(state: GameState, event: DungeonRunEventState): DungeonRunEventState {
  return {
    ...event,
    options: event.options.map((opt) => ({ ...opt, ...eventBuildFitFor(state, opt) })),
  };
}

function eventOptionMatchesScoutElement(opt: DungeonRunEventOption, element: Element): boolean {
  if (opt.checkElement === element) return true;
  if (!opt.rewardBlessingId) return false;
  return getRunBlessing(opt.rewardBlessingId)?.element === element;
}

function runEventScoutScore(event: DungeonRunEventState, element: Element): number {
  return event.options.reduce((score, opt) => {
    if (opt.checkElement === element) return score + 4;
    if (opt.rewardBlessingId && getRunBlessing(opt.rewardBlessingId)?.element === element) return score + 3;
    return score;
  }, 0);
}

function pickRunEventForNode(state: GameState, node: DungeonRunNode): DungeonRunEventState {
  const element = node.forecastEnemyElement;
  if (!element) return randPick(state, RUN_EVENTS);
  const matches = RUN_EVENTS.map((event) => ({ event, score: runEventScoutScore(event, element) })).filter((x) => x.score > 0);
  if (matches.length === 0) return randPick(state, RUN_EVENTS);
  const total = matches.reduce((sum, x) => sum + x.score, 0);
  let roll = nextRand01(state) * total;
  for (const match of matches) {
    roll -= match.score;
    if (roll <= 0) return match.event;
  }
  return matches[matches.length - 1]!.event;
}

function withEventScoutHints(event: DungeonRunEventState, element?: Element): DungeonRunEventState {
  if (!element) return event;
  return {
    ...event,
    options: event.options.map((opt) =>
      eventOptionMatchesScoutElement(opt, element)
        ? { ...opt, eventScoutHint: `侦察命中：呼应${runElementName(element)}行探查，检定或灵印收益更可预期。` }
        : opt,
    ),
  };
}

function routeForecastFor(state: GameState, nodeType: DungeonRunNodeType): Pick<DungeonRunRouteChoice, "forecastEnemyRole" | "forecastEnemyElement" | "scoutText"> {
  if (nodeType === "event") {
    const element = randPick(state, EL_LIST);
    return { forecastEnemyElement: element, scoutText: `探得秘境：偏${runElementName(element)}行检定，可能换资源或赌风险。` };
  }
  if (nodeType === "rest") {
    return { scoutText: "探得灵泉：可回血、蓄终结，或换一次战利品草案。" };
  }
  const role =
    nodeType === "elite"
      ? randPick(state, ["guard", "drain"] as const)
      : randPick(state, ["melee", "ranged", "guard", "drain"] as const);
  const element = randPick(state, EL_LIST);
  return {
    forecastEnemyRole: role,
    forecastEnemyElement: element,
    scoutText: `探得敌势：${runElementName(element)}行${runEnemyRoleName(role)}。`,
  };
}

function makeRouteChoice(
  id: string,
  title: string,
  desc: string,
  nodeType: DungeonRunNodeType,
  extra: Omit<DungeonRunRouteChoice, "id" | "title" | "desc" | "nodeType"> = {},
): DungeonRunRouteChoice {
  return { id, title, desc, nodeType, ...extra };
}

function buildRunRouteChoices(state: GameState): DungeonRunRouteChoice[] {
  const d = state.dungeon;
  const depth = d.runNodeIndex + 1;
  const restAttune: Element = d.runThreat >= 28 ? "earth" : "wood";
  const pool: DungeonRunRouteChoice[] = [
    makeRouteChoice("route:event", "探查秘境", "进入事件节点：资源交换、五行检定或恢复强化。", "event", {
      threatDelta: 7,
      attuneElement: "water",
      attuneBonusText: routeAttuneBonusText("water"),
      plan: "draft",
      planPreview: "探秘布势：保留选择空间，先得 1 点身法，战利品重掷 +1。",
      routeStyleBonus: 1,
      routeRerollBonus: 1,
      ...routeForecastFor(state, "event"),
    }),
    makeRouteChoice("route:combat", "直穿妖影", "进入普通战斗：稳定拿一场灵印与筑灵髓。", "combat", {
      rewardZhuLingEssence: 3 + depth,
      threatDelta: 4,
      attuneElement: "metal",
      attuneBonusText: routeAttuneBonusText("metal"),
      plan: "tempo",
      planPreview: "疾攻布势：开战前身法 +2，终结 +10。",
      routeStyleBonus: 2,
      routeFinisherBonus: 10,
      ...routeForecastFor(state, "combat"),
    }),
    makeRouteChoice("route:elite", "挑战精英", "进入更危险的精英战，敌人更硬，但胜利后的奖励更厚。", "elite", {
      rewardLingSha: 2,
      riskEnemyPowerPct: 0.18,
      threatDelta: 16,
      attuneElement: "fire",
      attuneBonusText: routeAttuneBonusText("fire"),
      plan: "risk",
      planPreview: "险搏布势：开战前身法 +3，终结 +18；精英胜利奖励更厚。",
      routeStyleBonus: 3,
      routeFinisherBonus: 18,
      ...routeForecastFor(state, "elite"),
    }),
    makeRouteChoice("route:rest", "灵泉整息", "恢复生命与体力，并获得一次偏防守的灵印机会。", "rest", {
      healPct: 0.24,
      staminaPct: 0.45,
      rewardBlessingId: "earth_bulwark",
      threatDelta: -14,
      attuneElement: restAttune,
      attuneBonusText: routeAttuneBonusText(restAttune),
      plan: "safe",
      planPreview: "稳阵布势：入泉前架起护盾，下一段更难被打断节奏。",
      routeShieldPct: 0.14,
      ...routeForecastFor(state, "rest"),
    }),
  ];
  const fittedPool = pool.map((route) => {
    const echoed = withEventEchoRouteFit(state, withRouteEchoFit(state, route));
    return withRoutePledgeFit(state, withRewardVerbRouteRecommendation(state, { ...echoed, ...routeBuildFitFor(state, echoed) }));
  });
  const recommendedPool = fittedPool.filter((route) => route.routeRecommend);
  const firstPool = recommendedPool.length > 0 ? recommendedPool : fittedPool;
  const firstChoice = firstPool[Math.floor(nextRand01(state) * firstPool.length)]!;
  const first = fittedPool.findIndex((route) => route.id === firstChoice.id);
  const out = [fittedPool[first]!];
  const secondRecommended = recommendedPool.find((route) => route.id !== firstChoice.id);
  if (secondRecommended) out.push(secondRecommended);
  for (let i = 1; out.length < 2 && i <= fittedPool.length; i += 1) {
    const c = fittedPool[(first + i) % fittedPool.length]!;
    if (!out.some((x) => x.id === c.id)) out.push(c);
  }
  if (d.playerHp < d.playerMax * 0.42 && !out.some((x) => x.nodeType === "rest")) {
    out[1] = fittedPool.find((x) => x.nodeType === "rest")!;
  }
  if (d.runBlessings.length >= 2 && !out.some((x) => x.nodeType === "elite") && nextRand01(state) < 0.55) {
    out[1] = fittedPool.find((x) => x.nodeType === "elite")!;
  }
  return out;
}

function withRouteEchoFit(state: GameState, route: DungeonRunRouteChoice): DungeonRunRouteChoice {
  const d = state.dungeon;
  const role = d.runRoleEcho;
  const power = Math.max(0, Math.min(3, Math.floor(d.runRoleEchoPower)));
  if (!role || power <= 0) return route;
  const next = { ...route };
  const combatRoute = route.nodeType === "combat" || route.nodeType === "elite";
  if (!combatRoute) {
    next.routeEchoFit = "steady";
    next.routeEchoHint = `${runRoleEchoName(role)} x${power} 会保留到下一场战斗；这条路线先调整资源与状态。`;
    return next;
  }
  next.routeEchoFit = "match";
  if (role === "guard") {
    const finisher = 4 + power * 3;
    next.routeFinisherBonus = (next.routeFinisherBonus ?? 0) + finisher;
    next.routeEchoHint = `破甲残响 x${power} 契合战斗路线：本战开局追击，并额外终结 +${finisher}。`;
  } else if (role === "drain") {
    const zhu = 3 + power * 3;
    next.rewardZhuLingEssence = (next.rewardZhuLingEssence ?? 0) + zhu;
    next.threatDelta = (next.threatDelta ?? 0) - power;
    next.routeEchoHint = `返灵残响 x${power} 契合战斗路线：先夺回筑灵髓 +${zhu}，劫压 ${-power}。`;
  } else if (role === "ranged") {
    next.routeStyleBonus = (next.routeStyleBonus ?? 0) + power;
    next.staminaPct = (next.staminaPct ?? 0) + 0.08 + power * 0.03;
    next.routeEchoHint = `身法残响 x${power} 契合战斗路线：身法 +${power}，入战前补体力。`;
  } else {
    const shieldPct = 0.04 + power * 0.025;
    next.routeShieldPct = (next.routeShieldPct ?? 0) + shieldPct;
    next.routeEchoHint = `护身残响 x${power} 契合战斗路线：入战前额外护盾 ${Math.round(shieldPct * 100)}%。`;
  }
  return next;
}

function runRoleEchoName(role: DungeonRunEnemyRole): string {
  if (role === "guard") return "破甲残响";
  if (role === "drain") return "返灵残响";
  if (role === "ranged") return "身法残响";
  if (role === "boss") return "镇域残响";
  return "护身残响";
}

function clearRunRewardLocks(state: GameState): void {
  state.dungeon.runLockedRewardIds = [];
}

function currentRewardDraftContext(state: GameState): { boss: boolean; elite: boolean } {
  const d = state.dungeon;
  if (d.runOpeningDraft) return { boss: false, elite: false };
  const node = d.runNodes[d.runNodeIndex];
  return { boss: node?.type === "boss", elite: node?.type === "elite" };
}

function rebuildRunRewardOptionsWithLocks(state: GameState, locked: DungeonRunRewardOption[]): DungeonRunRewardOption[] {
  const { boss, elite } = currentRewardDraftContext(state);
  const out: DungeonRunRewardOption[] = [];
  const pushUnique = (opt: DungeonRunRewardOption): void => {
    if (out.length >= 3 || out.some((x) => x.id === opt.id)) return;
    out.push(opt);
  };
  for (const opt of locked) pushUnique(opt);
  for (let i = 0; i < 8 && out.length < 3; i += 1) {
    for (const opt of buildRunRewardOptions(state, boss, elite)) {
      pushUnique(opt);
      if (out.length >= 3) break;
    }
  }
  return out;
}

function makeRunNodes(state: GameState): DungeonRunNode[] {
  const types: DungeonRunNodeType[] = ["combat", "event", "combat", "elite", "rest", "boss"];
  return types.map((type, i) => ({
    id: `run-${Date.now().toString(36)}-${i}-${Math.floor(nextRand01(state) * 9999)}`,
    type,
    title: nodeTitle(type, i),
    cleared: false,
  }));
}

function makeRunWarrant(state: GameState): DungeonRunWarrant {
  const dom = dominantRunElement(state);
  if (dom === "metal") {
    return {
      kind: "counter_moves",
      title: "斩隙悬赏",
      desc: "完成 3 次反制或破绽连携。",
      target: 3,
      progress: 0,
      completed: false,
      rewardZhuLingEssence: 16,
      rewardLingSha: 2,
      rewardFinisherCharge: 35,
    };
  }
  if (dom === "wood") {
    return {
      kind: "clear_nodes",
      title: "回春悬赏",
      desc: "清理 4 个行旅节点。",
      target: 4,
      progress: 0,
      completed: false,
      rewardZhuLingEssence: 20,
      rewardLingSha: 1,
      rewardThreatDelta: -6,
    };
  }
  if (dom === "water") {
    return {
      kind: "counter_moves",
      title: "流影悬赏",
      desc: "完成 2 次闪避/心法反制。",
      target: 2,
      progress: 0,
      completed: false,
      rewardZhuLingEssence: 12,
      rewardLingSha: 1,
      rewardRerolls: 1,
    };
  }
  if (dom === "earth") {
    return {
      kind: "elite_routes",
      title: "镇山悬赏",
      desc: "挑战 1 次精英路线或击破精英节点。",
      target: 1,
      progress: 0,
      completed: false,
      rewardZhuLingEssence: 14,
      rewardLingSha: 2,
      rewardThreatDelta: -8,
    };
  }
  return {
    kind: "finishers",
    title: "焚战悬赏",
    desc: "释放 2 次终结技。",
    target: 2,
    progress: 0,
    completed: false,
    rewardZhuLingEssence: 14,
    rewardLingSha: 2,
    rewardFinisherCharge: 25,
  };
}

function progressRunWarrant(state: GameState, kind: DungeonRunWarrantKind, amount = 1): string {
  const d = state.dungeon;
  const w = d.runWarrant;
  if (!w || w.completed || w.kind !== kind) return "";
  w.progress = Math.min(w.target, w.progress + amount);
  if (w.progress < w.target) return "";
  w.completed = true;
  state.zhuLingEssence += w.rewardZhuLingEssence;
  state.lingSha += w.rewardLingSha;
  d.runEssenceGained += w.rewardZhuLingEssence;
  if (w.rewardFinisherCharge) d.runFinisherCharge = Math.min(100, d.runFinisherCharge + w.rewardFinisherCharge);
  if (w.rewardRerolls) d.runRewardRerolls = Math.min(2, d.runRewardRerolls + w.rewardRerolls);
  if (w.rewardThreatDelta) applyRunThreatDelta(state, w.rewardThreatDelta);
  const prizePower = Math.max(1, Math.min(3, Math.ceil(w.target / 2)));
  d.runWarrantPrize = Math.max(d.runWarrantPrize, prizePower);
  d.runWarrantPrizeLast = `悬赏兑券 x${prizePower} 已蓄：下一次战利品三选一会额外兑现。`;
  pushDamageFloat(0.47, 0.24, "悬赏", "dmg-special");
  return `悬赏完成：${w.title}，筑灵髓 +${w.rewardZhuLingEssence}，灵砂 +${w.rewardLingSha}${w.rewardFinisherCharge ? `，终结 +${w.rewardFinisherCharge}` : ""}${w.rewardRerolls ? `，重掷 +${w.rewardRerolls}` : ""}${w.rewardThreatDelta ? `，劫压 ${w.rewardThreatDelta > 0 ? "+" : ""}${w.rewardThreatDelta}` : ""}。${d.runWarrantPrizeLast}`;
}

function appendRunLine(state: GameState, line: string): void {
  if (!line) return;
  const d = state.dungeon;
  d.runLog = d.runLog ? `${d.runLog} ${line}` : line;
}

function enemyName(element: Element, role: DungeonRunEnemy["role"]): string {
  const el: Record<Element, string> = {
    metal: "金",
    wood: "木",
    water: "水",
    fire: "火",
    earth: "土",
  };
  const roleName: Record<DungeonRunEnemy["role"], string> = {
    melee: "裂爪",
    ranged: "符箭",
    guard: "甲卫",
    drain: "汲灵",
    boss: "劫主",
  };
  return `${el[element]}脉${roleName[role]}`;
}

function nextIntent(state: GameState, enemy: DungeonRunEnemy, now: number): void {
  const roll = nextRand01(state);
  let intent: DungeonEnemyIntent = "attack";
  if (enemy.role === "guard" && roll < 0.38) intent = "guard";
  else if (enemy.role === "drain" && roll < 0.42) intent = "drain";
  else if (enemy.role === "ranged" && roll < 0.72) intent = "attack";
  else if (enemy.role === "boss" && roll < 0.28) intent = "enrage";
  else if (roll < 0.2) intent = "guard";
  enemy.intent = intent;
  enemy.intentPower = Math.max(1, Math.round(enemy.maxHp * enemyIntentPowerPct(enemy.role, intent)));
  enemy.intentAtMs = now + enemyIntentDelayMs(enemy.role, intent) + nextRand01(state) * 500;
  enemy.nextIntentAtMs = enemy.intentAtMs + 700;
}

function enemyIntentDelayMs(role: DungeonRunEnemyRole, intent: DungeonEnemyIntent): number {
  if (role === "boss") return intent === "enrage" ? 1900 : 1750;
  if (role === "ranged") return intent === "attack" ? 1700 : 2150;
  if (role === "guard") return intent === "guard" ? 2500 : 2300;
  if (role === "drain") return intent === "drain" ? 2250 : 2350;
  return 2300;
}

function enemyIntentPowerPct(role: DungeonRunEnemyRole, intent: DungeonEnemyIntent): number {
  if (intent === "attack") {
    if (role === "ranged") return 0.145;
    if (role === "boss") return 0.14;
    if (role === "melee") return 0.13;
    return 0.11;
  }
  if (intent === "guard") return role === "guard" ? 0.11 : 0.08;
  if (intent === "drain") return role === "drain" ? 0.12 : 0.08;
  return role === "boss" ? 0.12 : 0.09;
}

function enemyAttackDamageMult(role: DungeonRunEnemyRole): number {
  if (role === "ranged") return 1.18;
  if (role === "melee") return 1.08;
  if (role === "boss") return 1.16;
  if (role === "guard") return 0.92;
  if (role === "drain") return 0.88;
  return 1;
}

function runRoleReadName(role: DungeonRunEnemyRole): string {
  if (role === "guard") return "护卫识破";
  if (role === "drain") return "汲灵识破";
  if (role === "ranged") return "远程识破";
  if (role === "boss") return "首领识破";
  return "近战识破";
}

function noteRunRoleRead(state: GameState, role: DungeonRunEnemyRole, action: DungeonRunOpportunityAction): string {
  if (role === "boss") return "";
  const d = state.dungeon;
  const streak = d.runRoleReadRole === role ? Math.min(9, Math.max(0, d.runRoleReadStreak) + 1) : 1;
  d.runRoleReadRole = role;
  d.runRoleReadStreak = streak;
  d.runRoleReadPeak = Math.max(d.runRoleReadPeak, streak);
  const label = runRoleReadName(role);
  if (streak <= 1) {
    d.runRoleReadLast = `${label} x1：继续反制同类职责可滚起识破奖励。`;
    return d.runRoleReadLast;
  }
  const hits = streak >= 4 ? 2 : 1;
  const pct = Math.min(0.24, 0.055 + streak * 0.018);
  const finisher = 4 + streak * 3;
  d.runTacticalEdgeHits = Math.min(9, d.runTacticalEdgeHits + hits);
  d.runTacticalEdgeDamagePct = Math.max(d.runTacticalEdgeDamagePct, pct);
  d.runTacticalEdgeLabel = label;
  d.runFinisherCharge = Math.min(100, d.runFinisherCharge + finisher);
  let extra = `追击 +${hits}，终结 +${finisher}`;
  if (role === "drain") {
    applyRunThreatDelta(state, -1);
    extra += "，劫压 -1";
  } else if (role === "ranged") {
    d.stamina = Math.min(DUNGEON_STAMINA_MAX, d.stamina + 6 + streak * 2);
    extra += `，体力 +${6 + streak * 2}`;
  } else if (role === "guard") {
    d.runShield = Math.min(d.playerMax, d.runShield + Math.floor(d.playerMax * (0.018 + streak * 0.006)));
    extra += "，护盾回稳";
  } else {
    const heal = Math.floor(d.playerMax * (0.012 + streak * 0.004));
    d.playerHp = Math.min(d.playerMax, d.playerHp + heal);
    state.combatHpCurrent = d.playerHp;
    extra += `，生命 +${heal}`;
  }
  if (streak >= 3) bankRoleEcho(state, role, false);
  d.runRoleReadLast = `${label} x${streak}：${opportunityActionLabel(action)}读透职责，${extra}。`;
  pushDamageFloat(0.48, 0.2, `识破${streak}`, "dmg-special");
  return d.runRoleReadLast;
}

function breakRunRoleRead(state: GameState, reason: string): string {
  const d = state.dungeon;
  const streak = Math.max(0, Math.floor(d.runRoleReadStreak));
  if (streak <= 0) return "";
  d.runRoleReadRole = null;
  d.runRoleReadStreak = 0;
  d.runRoleReadLast = `职责识破断势：${reason}，止于 x${streak}。`;
  return d.runRoleReadLast;
}

function bankRunRoleReadPrize(state: GameState, defeatedRole: DungeonRunEnemyRole): string {
  const d = state.dungeon;
  const peak = Math.max(d.runRoleReadPeak, d.runRoleReadStreak);
  const role = d.runRoleReadRole ?? (defeatedRole === "boss" ? null : defeatedRole);
  d.runRoleReadRole = null;
  d.runRoleReadStreak = 0;
  d.runRoleReadPeak = 0;
  if (!role || role === "boss" || peak < 2) return "";
  const power = Math.min(3, Math.max(1, Math.floor(peak / 2)));
  d.runRoleReadPrizeRole = role;
  d.runRoleReadPrizePower = Math.max(d.runRoleReadPrizePower, power);
  d.runRoleReadPrizeLast = `${runRoleReadName(role)}手札 x${d.runRoleReadPrizePower} 已整理：下一次战利品三选一会带入读怪收益。`;
  pushDamageFloat(0.5, 0.2, `手札${d.runRoleReadPrizePower}`, "dmg-special");
  return d.runRoleReadPrizeLast;
}

function applyRoleCounterBonus(state: GameState, action: DungeonRunOpportunityAction, now: number): string {
  const d = state.dungeon;
  const e = d.runEnemy;
  if (!e) return "";
  const depth = Math.max(1, d.runNodeIndex + 1);
  if (e.role === "ranged" && action === "dodge") {
    d.stamina = Math.min(DUNGEON_STAMINA_MAX, d.stamina + 14);
    d.runFinisherCharge = Math.min(100, d.runFinisherCharge + 10);
    delayEnemyIntent(e, now, 1850);
    const styleLine = gainRunStyle(state, 1, "贴身追射");
    const readLine = noteRunRoleRead(state, e.role, action);
    return `远程破绽：贴身追射，体力 +14，终结 +10。 ${styleLine}${readLine ? ` ${readLine}` : ""}`;
  }
  if (e.role === "guard" && (action === "skill" || action === "finisher")) {
    const zhu = Math.floor((3 + depth) * runThreatRewardMult(state));
    state.zhuLingEssence += zhu;
    d.runEssenceGained += zhu;
    d.runFinisherCharge = Math.min(100, d.runFinisherCharge + (action === "finisher" ? 12 : 8));
    e.block = 0;
    delayEnemyIntent(e, now, action === "finisher" ? 2100 : 1700);
    pushDamageFloat(0.58, 0.32, "卸甲", "dmg-special");
    const readLine = noteRunRoleRead(state, e.role, action);
    return `护卫破绽：卸甲入袋，筑灵髓 +${zhu}，终结 +${action === "finisher" ? 12 : 8}。${readLine ? ` ${readLine}` : ""}`;
  }
  if (e.role === "drain" && action === "skill") {
    const zhu = Math.floor((5 + depth * 2) * runThreatRewardMult(state));
    state.zhuLingEssence += zhu;
    state.lingSha += 1;
    d.runEssenceGained += zhu;
    applyRunThreatDelta(state, -2);
    delayEnemyIntent(e, now, 1850);
    pushDamageFloat(0.58, 0.32, "截流", "dmg-special");
    const readLine = noteRunRoleRead(state, e.role, action);
    return `汲灵破绽：截流返灵，筑灵髓 +${zhu}，灵砂 +1，劫压 -2。${readLine ? ` ${readLine}` : ""}`;
  }
  return "";
}

function opportunityActionLabel(action: DungeonRunOpportunityAction): string {
  if (action === "dodge") return "闪避";
  if (action === "skill") return "心法技";
  return "终结技";
}

function scheduleNextRunOpportunity(state: GameState, now: number): void {
  const d = state.dungeon;
  const node = d.runNodes[d.runNodeIndex];
  const base = node?.type === "elite" ? 3200 : node?.type === "boss" ? 5200 : 4200;
  d.runOpportunityNextAtMs = now + base + Math.floor(nextRand01(state) * 2400);
}

function bankPledgeReprisal(state: GameState, brokenPledge: number, title: string): string {
  const d = state.dungeon;
  if (brokenPledge < 2) return "";
  const power = Math.min(3, Math.max(1, Math.floor(brokenPledge / 2)));
  d.runPledgeReprisal = Math.max(d.runPledgeReprisal, power);
  d.runPledgeReprisalLast = `破誓反打 x${power} 已蓄：下一场开局战机可夺回节奏。`;
  d.runRoutePledgeLast = `承诺断连：${title}未完成，破誓反打 x${power} 已蓄。`;
  return ` 破誓反打 x${power} 已蓄，下一场开局可抢回节奏。`;
}

function applyPledgeReprisalStart(state: GameState, enemy: DungeonRunEnemy, now: number): string {
  const d = state.dungeon;
  const power = Math.max(0, Math.min(3, Math.floor(d.runPledgeReprisal)));
  if (power <= 0) return "";
  const action: DungeonRunOpportunityAction =
    d.runFinisherCharge >= 80 ? "finisher" : enemy.intent === "guard" || enemy.intent === "drain" ? "skill" : "dodge";
  d.runOpportunity = {
    action,
    title: "破誓反打",
    desc: `承诺断连留下的逆势窗口，${opportunityActionLabel(action)}命中可降劫压、夺回追击节奏。`,
    untilMs: now + 6500 + power * 500,
    rewardZhuLingEssence: 4 + power * 5,
    rewardFinisherCharge: action === "finisher" ? 6 + power * 4 : 14 + power * 7,
    rewardStamina: action === "dodge" ? 14 + power * 5 : 8 + power * 3,
    damagePct: 0.82 + power * 0.22,
    source: "pledge_reprisal",
    sourcePower: power,
  };
  d.runOpportunityNextAtMs = Math.max(d.runOpportunityNextAtMs, d.runOpportunity.untilMs + 2800);
  d.runPledgeReprisalLast = `破誓反打 x${power} 开局出现：${opportunityActionLabel(action)}夺回节奏。`;
  pushDamageFloat(0.52, 0.24, `反${power}`, "dmg-special");
  return d.runPledgeReprisalLast;
}

function rewardVerbSurgeAction(verb: string, enemy: DungeonRunEnemy): DungeonRunOpportunityAction {
  if (verb === "闪避") return "dodge";
  if (verb === "爆发" || verb === "终结") return "finisher";
  if (verb === "破防" || verb === "护盾" || verb === "续航") return "skill";
  return enemy.intent === "attack" ? "dodge" : "skill";
}

function eventEchoOpportunityAction(plan: DungeonRunRoutePlan, enemy: DungeonRunEnemy): DungeonRunOpportunityAction {
  if (plan === "safe") return enemy.intent === "attack" ? "dodge" : "skill";
  if (plan === "tempo") return "skill";
  if (plan === "risk") return enemy.intent === "attack" ? "dodge" : "skill";
  return enemy.intent === "attack" ? "dodge" : "skill";
}

function buildEventEchoOpportunityDesc(plan: DungeonRunRoutePlan, action: DungeonRunOpportunityAction): string {
  const label = routePlanLabel(plan);
  if (plan === "safe") return `${label}余势护住开局，${opportunityActionLabel(action)}命中可补盾回血并稳住劫压。`;
  if (plan === "tempo") return `${label}余势推高节奏，${opportunityActionLabel(action)}命中可接身法、终结和追击。`;
  if (plan === "risk") return `${label}余势压进敌阵，${opportunityActionLabel(action)}命中可把风险转成战意和筑灵髓。`;
  return `${label}余势铺开草案，${opportunityActionLabel(action)}命中可补重掷、终结和筑灵髓。`;
}

function isActionWeaveOpenerText(text: string): boolean {
  return text.includes("涓囪薄鐏靛") || text.includes("万象灵契");
}

function applyRewardVerbSurgeStart(state: GameState, enemy: DungeonRunEnemy, now: number): string {
  const d = state.dungeon;
  if (d.runOpportunity) return "";
  const verb = d.runRewardVerbSurge;
  const power = Math.max(0, Math.min(3, Math.floor(d.runRewardVerbSurgePower)));
  if (!verb || power <= 0) return "";
  const action = rewardVerbSurgeAction(verb, enemy);
  d.runOpportunity = {
    action,
    title: `${verb}开战`,
    desc: `战利品连选滚起的开局窗口，${opportunityActionLabel(action)}命中后把${verb}流派直接接进战斗。`,
    untilMs: now + 5600 + power * 550,
    rewardZhuLingEssence: 3 + power * 4,
    rewardFinisherCharge: action === "finisher" ? 8 + power * 5 : 12 + power * 6,
    rewardStamina: action === "dodge" ? 12 + power * 6 : 6 + power * 3,
    damagePct: 0.68 + power * 0.2,
    source: "reward_verb_surge",
    sourcePower: power,
    sourceVerb: verb,
  };
  d.runOpportunityNextAtMs = Math.max(d.runOpportunityNextAtMs, d.runOpportunity.untilMs + 2600);
  d.runRewardVerbSurgeLast = `${verb}开战 x${power} 出现：${opportunityActionLabel(action)}命中接入流派爆点。`;
  pushDamageFloat(0.5, 0.24, `${verb}${power}`, "dmg-special");
  return d.runRewardVerbSurgeLast;
}

function bankRunEventEcho(state: GameState, opt: DungeonRunEventOption): string {
  const d = state.dungeon;
  const plan = opt.eventPlan;
  if (!plan) return "";
  let power = 1;
  if (opt.checkElement) power += 1;
  if (opt.riskCombat || opt.rewardDraft) power += 1;
  if ((opt.eventStyleBonus ?? 0) >= 2 || (opt.eventFinisherBonus ?? 0) >= 18 || (opt.eventShieldPct ?? 0) >= 0.1) {
    power += 1;
  }
  power = Math.max(1, Math.min(3, power));
  d.runEventEchoPlan = plan;
  d.runEventEchoPower = Math.max(d.runEventEchoPower, power);
  d.runEventEchoLast = `${routePlanLabel(plan)}余势 x${d.runEventEchoPower} 已蓄：下一战开局兑现。`;
  return d.runEventEchoLast;
}

function applyRunEventEchoStart(state: GameState, enemy: DungeonRunEnemy, now: number): string {
  const d = state.dungeon;
  const plan = d.runEventEchoPlan;
  const power = Math.max(0, Math.min(3, Math.floor(d.runEventEchoPower)));
  if (!plan || power <= 0) return "";
  d.runEventEchoPlan = "";
  d.runEventEchoPower = 0;
  const label = routePlanLabel(plan);
  let line = "";
  if (plan === "safe") {
    const shield = Math.floor(d.playerMax * (0.08 + power * 0.035));
    const heal = Math.floor(d.playerMax * (0.025 + power * 0.012));
    d.runShield = Math.min(d.playerMax, d.runShield + shield);
    d.playerHp = Math.min(d.playerMax, d.playerHp + heal);
    state.combatHpCurrent = d.playerHp;
    applyRunThreatDelta(state, -2 - power);
    line = `${label}余势 x${power} 兑现：护盾 +${shield}，回血 +${heal}，劫压 -${2 + power}。`;
  } else if (plan === "tempo") {
    const finisher = 10 + power * 8;
    d.runStyleStreak = Math.min(12, d.runStyleStreak + power);
    d.runStylePeak = Math.max(d.runStylePeak, d.runStyleStreak);
    d.runFinisherCharge = Math.min(100, d.runFinisherCharge + finisher);
    d.runTacticalEdgeHits = Math.min(9, d.runTacticalEdgeHits + power);
    d.runTacticalEdgeDamagePct = Math.max(d.runTacticalEdgeDamagePct, 0.06 + power * 0.02);
    d.runTacticalEdgeLabel = "疾攻余势";
    line = `${label}余势 x${power} 兑现：身法 +${power}，终结 +${finisher}，追击 +${power}。`;
  } else if (plan === "risk") {
    const dmg = Math.max(1, Math.floor(enemy.maxHp * (0.035 + power * 0.018)));
    const zhu = Math.floor((3 + power * 4) * runThreatRewardMult(state));
    enemy.hp -= dmg;
    enemy.enrage = Math.min(0.9, enemy.enrage + power * 0.04);
    state.zhuLingEssence += zhu;
    d.runEssenceGained += zhu;
    d.runTacticalEdgeHits = Math.min(9, d.runTacticalEdgeHits + 1 + power);
    d.runTacticalEdgeDamagePct = Math.max(d.runTacticalEdgeDamagePct, 0.1 + power * 0.025);
    d.runTacticalEdgeLabel = "险搏余势";
    applyRunThreatDelta(state, 2);
    line = `${label}余势 x${power} 兑现：开局重创 ${dmg}，筑灵髓 +${zhu}，追击 +${1 + power}，劫压 +2。`;
  } else {
    const finisher = 6 + power * 6;
    const zhu = 2 + power * 3;
    d.runRewardRerolls = Math.min(2, d.runRewardRerolls + 1);
    d.runFinisherCharge = Math.min(100, d.runFinisherCharge + finisher);
    d.runTacticalEdgeHits = Math.min(9, d.runTacticalEdgeHits + power);
    d.runTacticalEdgeDamagePct = Math.max(d.runTacticalEdgeDamagePct, 0.05 + power * 0.02);
    d.runTacticalEdgeLabel = "探秘余势";
    state.zhuLingEssence += zhu;
    d.runEssenceGained += zhu;
    line = `${label}余势 x${power} 兑现：重掷 +1，终结 +${finisher}，筑灵髓 +${zhu}，追击 +${power}。`;
  }
  d.runEventEchoLast = line;
  if (!d.runOpportunity && !d.runRewardVerbSurge) {
    const action = eventEchoOpportunityAction(plan, enemy);
    d.runOpportunity = {
      action,
      title: `${label}余势`,
      desc: buildEventEchoOpportunityDesc(plan, action),
      untilMs: now + 5200 + power * 500,
      rewardZhuLingEssence: 3 + power * 3,
      rewardFinisherCharge: 8 + power * 5,
      rewardStamina: action === "dodge" ? 16 + power * 4 : 8 + power * 3,
      damagePct: 0.58 + power * 0.16,
      source: "event_echo",
      sourcePower: power,
      sourceVerb: plan,
    };
    d.runOpportunityNextAtMs = Math.max(d.runOpportunityNextAtMs, d.runOpportunity.untilMs + 2500);
    line = `${line} ${label}战机出现：${opportunityActionLabel(action)}可把余势打成主动节奏。`;
    d.runEventEchoLast = line;
  }
  pushDamageFloat(0.46, 0.24, `${label}${power}`, "dmg-special");
  syncEnemyBars(state);
  if (enemy.hp <= 0) completeCombatNode(state, now);
  return line;
}

function buildRunOpportunity(state: GameState, now: number): void {
  const d = state.dungeon;
  const e = d.runEnemy;
  if (!e || d.runOpportunity || now < d.runOpportunityNextAtMs) return;
  if (e.role === "boss" && d.runBossOmen !== "none") return;
  let action: DungeonRunOpportunityAction = "dodge";
  let title = "贴锋战机";
  let desc = "敌方攻势露出空门，闪避可夺身位。";
  if (e.intent === "guard" || e.intent === "drain") {
    action = "skill";
    title = e.intent === "guard" ? "护势松动" : "汲灵逆流";
    desc = e.intent === "guard" ? "护势正在成形，心法技可震开防线。" : "灵流倒卷，心法技可截断汲灵。";
  } else if ((e.intent === "enrage" || e.hp / Math.max(1, e.maxHp) <= 0.35) && d.runFinisherCharge >= 100) {
    action = "finisher";
    title = "阵眼显形";
    desc = "敌方阵眼短暂暴露，终结技可夺取额外战果。";
  }
  const depth = Math.max(1, d.runNodeIndex + 1);
  d.runOpportunity = {
    action,
    title,
    desc,
    untilMs: now + (e.role === "boss" ? 3800 : 3300),
    rewardZhuLingEssence: 3 + depth,
    rewardFinisherCharge: action === "finisher" ? 0 : 16,
    rewardStamina: action === "dodge" ? 18 : 8,
    damagePct: action === "finisher" ? 1.12 : 0.58,
  };
}

function expireRunOpportunity(state: GameState, now: number): void {
  const d = state.dungeon;
  if (!d.runOpportunity || now <= d.runOpportunity.untilMs) return;
  if (d.runOpportunity.source === "pledge_reprisal") {
    d.runPledgeReprisal = 0;
    d.runPledgeReprisalLast = "破誓反打错过：断连余势散去。";
    d.runRoutePledgeLast = d.runPledgeReprisalLast;
  } else if (d.runOpportunity.source === "reward_verb_surge") {
    const isActionWeaveOpener = isActionWeaveOpenerText(d.runActionWeavePrizeLast) || isActionWeaveOpenerText(d.runRewardVerbSurgeLast);
    d.runRewardVerbSurge = "";
    d.runRewardVerbSurgePower = 0;
    if (isActionWeaveOpener) {
      d.runActionWeaveMask = 0;
      d.runActionWeaveLast = "三式开战错过：万象灵契散去，本场万象三式进度清空。";
      d.runRewardVerbSurgeLast = d.runActionWeaveLast;
    } else {
      d.runRewardVerbSurgeLast = "流派开战错过：连选爆点散去。";
    }
  } else if (d.runOpportunity.source === "counter_tempo_rebound") {
    d.runCounterTempoLast = "破招回响错过：断连余势散去。";
  }
  d.runOpportunity = null;
  scheduleNextRunOpportunity(state, now);
}

function resolveRunOpportunity(state: GameState, action: DungeonRunOpportunityAction, now: number): string {
  const d = state.dungeon;
  const e = d.runEnemy;
  const opp = d.runOpportunity;
  if (!e || !opp || now > opp.untilMs || opp.action !== action) return "";
  d.runOpportunity = null;
  scheduleNextRunOpportunity(state, now);
  const dmg = Math.max(1, Math.floor(playerRunDamage(state) * opp.damagePct));
  e.hp -= dmg;
  state.zhuLingEssence += opp.rewardZhuLingEssence;
  d.runEssenceGained += opp.rewardZhuLingEssence;
  d.runFinisherCharge = Math.min(100, d.runFinisherCharge + opp.rewardFinisherCharge);
  d.stamina = Math.min(DUNGEON_STAMINA_MAX, d.stamina + opp.rewardStamina);
  d.duelFervor = Math.min(100, d.duelFervor + 14);
  const styleLine = gainRunStyle(state, action === "finisher" ? 3 : 2, "命中战机");
  let reprisalLine = "";
  if (opp.source === "pledge_reprisal") {
    const power = Math.max(1, Math.min(3, Math.floor(opp.sourcePower ?? d.runPledgeReprisal ?? 1)));
    const threatCut = 2 + power * 2;
    d.runPledgeReprisal = 0;
    d.runTacticalEdgeHits = Math.min(9, d.runTacticalEdgeHits + 1 + power);
    d.runTacticalEdgeDamagePct = Math.max(d.runTacticalEdgeDamagePct, 0.08 + power * 0.03);
    d.runTacticalEdgeLabel = "破誓追击";
    applyRunThreatDelta(state, -threatCut);
    d.runPledgeReprisalLast = `破誓反打兑现 x${power}：劫压 -${threatCut}，追击 +${1 + power}。`;
    d.runRoutePledgeLast = d.runPledgeReprisalLast;
    reprisalLine = ` 破誓兑现：劫压 -${threatCut}，追击 +${1 + power}。`;
  } else if (opp.source === "reward_verb_surge") {
    const power = Math.max(1, Math.min(3, Math.floor(opp.sourcePower ?? d.runRewardVerbSurgePower ?? 1)));
    const verb = opp.sourceVerb || d.runRewardVerbSurge || d.runRewardVerb || "流派";
    const isActionWeaveOpener = isActionWeaveOpenerText(d.runActionWeavePrizeLast) || isActionWeaveOpenerText(d.runRewardVerbSurgeLast);
    d.runRewardVerbSurge = "";
    d.runRewardVerbSurgePower = 0;
    d.runTacticalEdgeHits = Math.min(9, d.runTacticalEdgeHits + 1 + power);
    d.runTacticalEdgeDamagePct = Math.max(d.runTacticalEdgeDamagePct, 0.08 + power * 0.025);
    d.runTacticalEdgeLabel = `${verb}开战`;
    if (verb === "续航") {
      const heal = Math.floor(d.playerMax * (0.04 + power * 0.025));
      d.playerHp = Math.min(d.playerMax, d.playerHp + heal);
      state.combatHpCurrent = d.playerHp;
      reprisalLine = ` ${verb}开战：回生 +${heal}，追击 +${1 + power}。`;
    } else if (verb === "护盾") {
      const shield = Math.floor(d.playerMax * (0.05 + power * 0.035));
      d.runShield = Math.min(d.playerMax, d.runShield + shield);
      reprisalLine = ` ${verb}开战：护盾 +${shield}，追击 +${1 + power}。`;
    } else if (verb === "破防") {
      e.block = Math.max(0, e.block - (90 + power * 55));
      reprisalLine = ` ${verb}开战：破护 ${90 + power * 55}，追击 +${1 + power}。`;
    } else if (verb === "闪避") {
      d.dodgeIframesUntil = Math.max(d.dodgeIframesUntil, now + 450 + power * 180);
      d.stamina = Math.min(DUNGEON_STAMINA_MAX, d.stamina + 6 + power * 5);
      reprisalLine = ` ${verb}开战：无影 ${Math.round((450 + power * 180) / 100) / 10}s，追击 +${1 + power}。`;
    } else {
      d.duelFervor = Math.min(100, d.duelFervor + 8 + power * 6);
      reprisalLine = ` ${verb}开战：战意 +${8 + power * 6}，追击 +${1 + power}。`;
    }
    d.runRewardVerbSurgeLast = `${verb}开战兑现 x${power}：追击 +${1 + power}。`;
    if (isActionWeaveOpener) {
      const weaveZhu = 2 + power * 3;
      const weaveFinisher = action === "finisher" ? 0 : 6 + power * 3;
      d.runActionWeaveMask = d.runActionWeaveMask | runActionWeaveBit(action);
      state.zhuLingEssence += weaveZhu;
      d.runEssenceGained += weaveZhu;
      d.runFinisherCharge = Math.min(100, d.runFinisherCharge + weaveFinisher);
      d.duelFervor = Math.min(100, d.duelFervor + 6 + power * 4);
      d.runTacticalEdgeHits = Math.min(9, d.runTacticalEdgeHits + 1 + power);
      d.runTacticalEdgeDamagePct = Math.max(d.runTacticalEdgeDamagePct, 0.08 + power * 0.025);
      d.runTacticalEdgeLabel = "三式开战";
      d.runActionWeaveLast = `三式开战命中：${opportunityActionLabel(action)}已接入万象三式，筑灵髓 +${weaveZhu}${weaveFinisher > 0 ? `，终结 +${weaveFinisher}` : ""}。`;
      d.runRewardVerbSurgeLast = `${verb}开战兑现 x${power}：万象灵契接入三式，追击 +${2 + power}。`;
      reprisalLine += ` 三式开战：${opportunityActionLabel(action)}已入式，筑灵髓 +${weaveZhu}${weaveFinisher > 0 ? `，终结 +${weaveFinisher}` : ""}。`;
    }
    reprisalLine += bankRouteRecommendOpenerFlow(state, verb, power);
  } else if (opp.source === "event_echo") {
    const power = Math.max(1, Math.min(3, Math.floor(opp.sourcePower ?? 1)));
    const plan = (opp.sourceVerb === "safe" || opp.sourceVerb === "tempo" || opp.sourceVerb === "risk" || opp.sourceVerb === "draft" ? opp.sourceVerb : "tempo") as DungeonRunRoutePlan;
    const label = routePlanLabel(plan);
    d.runTacticalEdgeHits = Math.min(9, d.runTacticalEdgeHits + 1 + power);
    d.runTacticalEdgeDamagePct = Math.max(d.runTacticalEdgeDamagePct, 0.07 + power * 0.025);
    d.runTacticalEdgeLabel = `${label}余势`;
    if (plan === "safe") {
      const shield = Math.floor(d.playerMax * (0.03 + power * 0.02));
      const heal = Math.floor(d.playerMax * (0.018 + power * 0.01));
      d.runShield = Math.min(d.playerMax, d.runShield + shield);
      d.playerHp = Math.min(d.playerMax, d.playerHp + heal);
      state.combatHpCurrent = d.playerHp;
      applyRunThreatDelta(state, -power);
      reprisalLine = ` ${label}余势命中：护盾 +${shield}，回生 +${heal}，劫压 -${power}，追击 +${1 + power}。`;
    } else if (plan === "risk") {
      const zhu = Math.floor((2 + power * 4) * runThreatRewardMult(state));
      state.zhuLingEssence += zhu;
      d.runEssenceGained += zhu;
      d.duelFervor = Math.min(100, d.duelFervor + 10 + power * 5);
      reprisalLine = ` ${label}余势命中：筑灵髓 +${zhu}，战意 +${10 + power * 5}，追击 +${1 + power}。`;
    } else if (plan === "draft") {
      const zhu = 2 + power * 3;
      state.zhuLingEssence += zhu;
      d.runEssenceGained += zhu;
      d.runRewardRerolls = Math.min(3, d.runRewardRerolls + 1);
      reprisalLine = ` ${label}余势命中：筑灵髓 +${zhu}，重掷 +1，追击 +${1 + power}。`;
    } else {
      const finisher = 6 + power * 6;
      d.runStyleStreak = Math.min(12, d.runStyleStreak + power);
      d.runStylePeak = Math.max(d.runStylePeak, d.runStyleStreak);
      d.runFinisherCharge = Math.min(100, d.runFinisherCharge + finisher);
      d.duelFervor = Math.min(100, d.duelFervor + 8 + power * 4);
      reprisalLine = ` ${label}余势命中：身法 +${power}，终结 +${finisher}，战意 +${8 + power * 4}，追击 +${1 + power}。`;
    }
  }
  if (opp.source === "counter_tempo_rebound") {
    const power = Math.max(1, Math.min(3, Math.floor(opp.sourcePower ?? 1)));
    const chase = 1 + power;
    const shield = Math.floor(d.playerMax * (0.025 + power * 0.015));
    d.runTacticalEdgeHits = Math.min(9, d.runTacticalEdgeHits + chase);
    d.runTacticalEdgeDamagePct = Math.max(d.runTacticalEdgeDamagePct, 0.08 + power * 0.025);
    d.runTacticalEdgeLabel = "破招回响";
    d.duelFervor = Math.min(100, d.duelFervor + 8 + power * 7);
    d.runShield = Math.min(d.playerMax, d.runShield + shield);
    d.runCounterTempoLast = `破招回响兑现 x${power}：追击 +${chase}，护盾 +${shield}，战意 +${8 + power * 7}。`;
    reprisalLine = ` 破招回响：追击 +${chase}，护盾 +${shield}。`;
  }
  pushDamageFloat(0.5, 0.24, "战机", "dmg-special");
  pushDamageFloat(0.57, 0.36, `+${dmg}`, "dmg-special");
  const line = `${opp.title}：${opportunityActionLabel(action)}命中战机，追伤 ${dmg}，筑灵髓 +${opp.rewardZhuLingEssence}${opp.rewardFinisherCharge > 0 ? `，终结 +${opp.rewardFinisherCharge}` : ""}${opp.rewardStamina > 0 ? `，体力 +${opp.rewardStamina}` : ""}。${reprisalLine}${styleLine ? ` ${styleLine}` : ""}`;
  if (e.hp <= 0) {
    completeCombatNode(state, now);
  } else {
    syncEnemyBars(state);
  }
  return line;
}

function bankRouteRecommendOpenerFlow(state: GameState, verb: string, power: number): string {
  const d = state.dungeon;
  const routeStreak = Math.max(0, Math.min(9, Math.floor(d.runRouteRecommendStreak ?? 0)));
  if (routeStreak < 2) return "";
  const flowVerb = verb || d.runRewardVerb || "顺势";
  const flowStreak = Math.min(9, Math.max(d.runRewardVerbStreak, 1 + routeStreak + Math.max(1, power)));
  const hits = Math.min(5, 1 + Math.max(1, power));
  const reroll = power >= 2 ? 1 : 0;
  d.runRewardVerb = flowVerb;
  d.runRewardVerbStreak = flowStreak;
  d.runRewardVerbPeak = Math.max(d.runRewardVerbPeak, flowStreak);
  d.runTacticalEdgeHits = Math.min(9, d.runTacticalEdgeHits + hits);
  d.runTacticalEdgeDamagePct = Math.max(d.runTacticalEdgeDamagePct, 0.08 + power * 0.02);
  d.runTacticalEdgeLabel = `${flowVerb}顺势`;
  if (reroll > 0) d.runRewardRerolls = Math.min(3, d.runRewardRerolls + reroll);
  d.runRouteRecommendLast = `顺势开战续航 x${routeStreak}：${flowVerb}路线权重提升到连选 x${flowStreak}，追击 +${hits}${reroll ? "，重掷 +1" : ""}。`;
  return ` 顺势续航：${flowVerb}连选 x${flowStreak}，追击 +${hits}${reroll ? "，重掷 +1" : ""}。`;
}

function makeRunObjective(
  kind: DungeonRunObjectiveKind,
  title: string,
  desc: string,
  target: number,
  now: number,
  depth: number,
  timeLimitMs?: number,
): DungeonRunObjective {
  const tempoReward =
    kind === "fast_kill"
      ? { rewardFinisherCharge: 22, rewardRerolls: 1 }
      : kind === "perfect_dodge"
        ? { rewardFinisherCharge: 18, rewardStyle: 2 }
        : kind === "skill_counter"
          ? { rewardFinisherCharge: 16, rewardShieldPct: 0.1 }
          : { rewardRerolls: 1, rewardThreatDelta: -3 };
  return {
    kind,
    title,
    desc,
    target,
    progress: 0,
    rewardZhuLingEssence: 5 + depth * 2,
    rewardLingSha: kind === "fast_kill" || kind === "finisher" ? 2 : 1,
    ...tempoReward,
    completed: false,
    startedAtMs: now,
    timeLimitMs,
  };
}

function applyScoutedObjectiveBonus(obj: DungeonRunObjective, node: DungeonRunNode, enemy: DungeonRunEnemy, depth: number): DungeonRunObjective {
  if (!node.forecastEnemyRole && !node.forecastEnemyElement) return obj;
  const roleText = node.forecastEnemyRole ? runEnemyRoleName(node.forecastEnemyRole) : runEnemyRoleName(enemy.role);
  const elementText = node.forecastEnemyElement ? runElementName(node.forecastEnemyElement) : runElementName(enemy.element);
  return {
    ...obj,
    title: `预判${obj.title}`,
    desc: `侦察已锁定${elementText}行${roleText}：${obj.desc} 完成后额外获得重掷与节奏奖励。`,
    rewardZhuLingEssence: obj.rewardZhuLingEssence + 4 + depth,
    rewardLingSha: obj.rewardLingSha + (node.type === "elite" ? 2 : 1),
    rewardFinisherCharge: Math.min(60, (obj.rewardFinisherCharge ?? 0) + 8),
    rewardRerolls: Math.min(2, (obj.rewardRerolls ?? 0) + 1),
    rewardThreatDelta: Math.min(-4, obj.rewardThreatDelta ?? -5),
    scoutRole: node.forecastEnemyRole ?? enemy.role,
    scoutElement: node.forecastEnemyElement ?? enemy.element,
  };
}

function buildCombatObjective(state: GameState, node: DungeonRunNode, enemy: DungeonRunEnemy, now: number): DungeonRunObjective {
  const depth = state.dungeon.runNodeIndex + 1;
  if (node.type === "boss") {
    return makeRunObjective("skill_counter", "破劫节奏", "用心法技打断首领意图 2 次。", 2, now, depth);
  }
  const planned = routePlanObjective(state, node, enemy, now, depth);
  if (planned) return planned;
  if (node.forecastEnemyRole || node.forecastEnemyElement) {
    const base =
      enemy.role === "guard" || enemy.role === "drain"
        ? makeRunObjective("skill_counter", "破势", "用心法技反制敌方护势或汲灵。", 1, now, depth)
        : enemy.role === "ranged"
          ? makeRunObjective("perfect_dodge", "贴近", "精准闪避 1 次攻势窗口。", 1, now, depth)
          : node.type === "elite"
            ? makeRunObjective("finisher", "斩将", "在本战使用 1 次终结技。", 1, now, depth)
            : makeRunObjective("fast_kill", "速破", "在 18 秒内击败敌人。", 1, now, depth, 18000);
    return applyScoutedObjectiveBonus(base, node, enemy, depth);
  }
  if (node.type === "elite") {
    return makeRunObjective("finisher", "斩将夺势", "在本战使用 1 次终结技。", 1, now, depth);
  }
  if (enemy.role === "guard" || enemy.role === "drain") {
    return makeRunObjective("skill_counter", "截断术路", "用心法技反制敌方护势或汲灵。", 1, now, depth);
  }
  if (enemy.role === "ranged") {
    return makeRunObjective("perfect_dodge", "贴身化劲", "精准闪避 1 次攻势窗口。", 1, now, depth);
  }
  return nextRand01(state) < 0.5
    ? makeRunObjective("fast_kill", "速破阵眼", "在 18 秒内击败敌人。", 1, now, depth, 18000)
    : makeRunObjective("perfect_dodge", "以身试锋", "精准闪避 1 次攻势窗口。", 1, now, depth);
}

function routePlanObjective(
  state: GameState,
  node: DungeonRunNode,
  enemy: DungeonRunEnemy,
  now: number,
  depth: number,
): DungeonRunObjective | null {
  const plan = node.routePlan;
  if (!plan) return null;
  if (plan === "tempo") {
    return {
      ...makeRunObjective("fast_kill", "疾攻承诺", "路线承诺：在 16 秒内击败敌人，兑现疾攻布势。", 1, now, depth, 16000),
      rewardZhuLingEssence: 9 + depth * 3,
      rewardFinisherCharge: 30,
      rewardStyle: 2,
      routePlan: plan,
      scoutRole: node.forecastEnemyRole ?? enemy.role,
      scoutElement: node.forecastEnemyElement ?? enemy.element,
    };
  }
  if (plan === "risk") {
    return {
      ...makeRunObjective("finisher", "险搏承诺", "路线承诺：在高压战中使用 1 次终结技，把风险转成厚战利品。", 1, now, depth),
      rewardZhuLingEssence: 8 + depth * 3,
      rewardLingSha: 3,
      rewardFinisherCharge: 12,
      rewardRerolls: 1,
      rewardThreatDelta: -4,
      routePlan: plan,
      scoutRole: node.forecastEnemyRole ?? enemy.role,
      scoutElement: node.forecastEnemyElement ?? enemy.element,
    };
  }
  if (plan === "safe") {
    const kind: DungeonRunObjectiveKind = enemy.role === "guard" || enemy.role === "drain" ? "skill_counter" : "perfect_dodge";
    return {
      ...makeRunObjective(kind, "稳阵承诺", "路线承诺：用反制稳住开局，降低劫压并架起护身余势。", 1, now, depth),
      rewardShieldPct: 0.18,
      rewardThreatDelta: -7,
      rewardStyle: 1,
      routePlan: plan,
      scoutRole: node.forecastEnemyRole ?? enemy.role,
      scoutElement: node.forecastEnemyElement ?? enemy.element,
    };
  }
  return {
    ...makeRunObjective("perfect_dodge", "探秘承诺", "路线承诺：用身法试探敌势，换取重掷和下一段构筑空间。", 1, now, depth),
    rewardRerolls: 1,
    rewardStyle: 2,
    routePlan: plan,
    scoutRole: node.forecastEnemyRole ?? enemy.role,
    scoutElement: node.forecastEnemyElement ?? enemy.element,
  };
}

function spawnEnemyForNode(state: GameState, node: DungeonRunNode, now: number): void {
  const d = state.dungeon;
  const depth = d.runNodeIndex + 1 + d.runsCompleted * 0.55;
  const role =
    node.forecastEnemyRole ??
    (node.type === "boss"
      ? "boss"
      : node.type === "elite"
        ? randPick(state, ["guard", "drain"] as const)
        : randPick(state, ["melee", "ranged", "guard", "drain"] as const));
  const element = node.forecastEnemyElement ?? randPick(state, EL_LIST);
  const hpMult =
    (node.type === "boss" ? 3.8 : node.type === "elite" ? 1.75 : 1) *
    (1 + (node.riskEnemyPowerPct ?? 0)) *
    runThreatEnemyMult(state);
  const hp = Math.floor((74 + depth * 34 + state.realmLevel * 9) * hpMult);
  const enemy: DungeonRunEnemy = {
    id: `${node.id}-enemy`,
    name: enemyName(element, role),
    role,
    element,
    hp,
    maxHp: hp,
    intent: "attack",
    intentPower: 1,
    intentAtMs: now + 1800,
    nextIntentAtMs: now + 2500,
    block: 0,
    enrage: 0,
  };
  nextIntent(state, enemy, now);
  d.runEnemy = enemy;
  d.runOpportunity = null;
  scheduleNextRunOpportunity(state, now);
  if (node.type === "boss") {
    d.runBossPosture = 0;
    d.runBossPostureMax = 100;
    d.runBossBreaks = 0;
    d.runBossPhase = 1;
    d.runBossOmenStreak = 0;
    d.runBossOmenPeak = 0;
    d.runBossOmenLast = "";
    setBossOmen(state, "heaven-strike", 1, now);
  } else {
    d.runBossPosture = 0;
    d.runBossPostureMax = 0;
    d.runBossBreaks = 0;
    d.runBossPhase = 0;
    d.runBossOmen = "none";
    d.runBossOmenUntilMs = 0;
    d.runBossOmenStreak = 0;
  }
  d.runObjective = buildCombatObjective(state, node, enemy, now);
  d.monsterHp = enemy.hp;
  d.monsterMax = enemy.maxHp;
  d.mobs = [runEnemyToMob(enemy, d.nextMobId++)];
  d.packSize = 1;
  d.packKilled = 0;
  d.inMelee = true;
  d.attackVisualMode = "aoe";
  d.runInCombat = true;
  if (node.type === "boss" && d.runBossOmen !== "none") {
    d.runLog = `${enemy.name} 现身。${d.runLog}`;
  } else {
    d.runLog = `${enemy.name} 现身：留意它的下一招。`;
  }
  const totals = runBlessingTotals(state);
  d.runShield = Math.max(d.runShield, Math.floor(d.playerMax * totals.shieldPct));
  appendRunLine(state, applyPledgeReprisalStart(state, enemy, now));
  appendRunLine(state, applyRunEventEchoStart(state, enemy, now));
  if (!state.dungeon.runEnemy) return;
  appendRunLine(state, applyRewardVerbSurgeStart(state, enemy, now));
  appendRunLine(state, applyRoleEchoStart(state, enemy, now));
}

function runEnemyToMob(enemy: DungeonRunEnemy, id: number): DungeonMob {
  return {
    id,
    x: 0.58,
    y: 0.45,
    hp: enemy.hp,
    maxHp: enemy.maxHp,
    element: enemy.element,
    isBoss: enemy.role === "boss",
    mobKind: enemy.role === "boss" ? 7 : 1,
    bossEpithet: enemy.role === "boss" ? "镇域" : undefined,
    dodge: 0,
    attackRange: 0.05,
    attackInterval: 2.2,
    moveSpeedMul: 1,
    mobRole: enemy.role === "ranged" ? "ranged" : "melee",
  };
}

function syncEnemyBars(state: GameState): void {
  const d = state.dungeon;
  const e = d.runEnemy;
  if (!e) {
    d.monsterHp = 0;
    d.monsterMax = 0;
    d.mobs = [];
    return;
  }
  d.monsterHp = e.hp;
  d.monsterMax = e.maxHp;
  if (d.mobs[0]) {
    d.mobs[0].hp = e.hp;
    d.mobs[0].maxHp = e.maxHp;
  }
}

function buildRestEvent(state: GameState): DungeonRunEventState {
  const d = state.dungeon;
  const heal = Math.floor(d.playerMax * 0.42);
  const shield = Math.floor(d.playerMax * 0.18);
  return {
    id: `rest-${d.runNodeIndex}`,
    title: "灵泉整息",
    body: "泉心只稳一息：保命、淬印、蓄势三条路各有代价，下一段行旅会立刻承接这次选择。",
    options: [
      {
        id: "rest-heal",
        title: "回息固本",
        desc: `恢复 ${heal} 生命，并压低 8 点劫压。适合残血稳进首领。`,
        healPct: 0.42,
        threatDelta: -8,
        eventPlan: "safe",
        eventPreview: "稳阵：回血并额外架盾，下一战更难被打断。",
        eventShieldPct: 0.12,
      },
      {
        id: "rest-draft",
        title: "淬炼灵印",
        desc: "不回血，转入一次三选一战利品；劫压 +4。适合补成套共鸣或赌高阶构筑。",
        rewardDraft: true,
        threatDelta: 4,
        eventPlan: "draft",
        eventPreview: "探秘：直接补一次战利品草案，并获得 1 次重掷。",
        eventRerollBonus: 1,
      },
      {
        id: "rest-ready",
        title: "蓄势入阵",
        desc: `体力恢复 60%，终结充能 +45，获得 ${shield} 护盾和 8 筑灵髓。`,
        staminaPct: 0.6,
        finisherCharge: 45,
        shieldPct: 0.18,
        rewardZhuLingEssence: 8,
        eventPlan: "tempo",
        eventPreview: "疾攻：入阵前身法 +2，让下一场更容易滚起连段。",
        eventStyleBonus: 2,
      },
    ],
  };
}

function buildLastStandEvent(state: GameState, incoming: number): DungeonRunEventState {
  const d = state.dungeon;
  const heal = Math.floor(d.playerMax * 0.34);
  const shield = Math.floor(d.playerMax * 0.22);
  const counterPct = d.runFinisherCharge >= 70 ? 0.18 : 0.12;
  return {
    id: "last-stand",
    title: "逆命一息",
    body: `这一击本应断送行旅（${incoming} 伤害）。本局仅一次：选择代价，把失败推回战场。`,
    options: [
      {
        id: "last-stand-heal",
        title: "护心回息",
        desc: `恢复 ${heal} 生命，获得 ${shield} 护盾，但劫压 +14。`,
        healPct: 0.34,
        shieldPct: 0.22,
        threatDelta: 14,
        reviveCombat: true,
        eventPlan: "safe",
        eventPreview: "稳阵：续战前额外留住一点身法，争取反打窗口。",
        eventStyleBonus: 1,
      },
      {
        id: "last-stand-counter",
        title: "燃命反斩",
        desc: `只保留一线生机，立刻反击敌人最大生命 ${Math.round(counterPct * 100)}%，终结 +55，劫压 +20。`,
        enemyDamagePct: counterPct,
        finisherCharge: 55,
        threatDelta: 20,
        reviveCombat: true,
        eventPlan: "risk",
        eventPreview: "险搏：燃命后身法 +3，立刻逼出下一次终结机会。",
        eventStyleBonus: 3,
      },
      {
        id: "last-stand-guard",
        title: "碎印守魂",
        desc: "扣除 1 战势并清空连携，恢复 24% 生命，体力补满，劫压 +8。",
        healPct: 0.24,
        staminaPct: 1,
        threatDelta: 8,
        reviveCombat: true,
        eventPlan: "safe",
        eventPreview: "稳阵：保命续战，额外架起一层护势。",
        eventShieldPct: 0.12,
      },
    ],
  };
}

function buildBossBreakEvent(state: GameState, reason: string): DungeonRunEventState {
  const d = state.dungeon;
  const depth = Math.max(1, d.runNodeIndex + 1);
  const breakNo = Math.max(1, d.runBossBreaks);
  const plunderZhu = Math.floor((10 + depth * 2 + breakNo * 4) * runThreatRewardMult(state));
  const shield = Math.floor(d.playerMax * 0.22);
  const chasePct = 0.08 + Math.min(0.06, breakNo * 0.015);
  return {
    id: `boss-break-${breakNo}`,
    title: "镇域破绽",
    body: `${reason}打穿首领架势，镇域短暂松开。选择这次破绽的兑现方向，然后立刻续战。`,
    options: [
      {
        id: "boss-break-chase",
        title: "乘破追斩",
        desc: `立刻斩入首领最大生命 ${Math.round(chasePct * 100)}%，终结 +18，劫压 +4。`,
        enemyDamagePct: chasePct,
        finisherCharge: 18,
        threatDelta: 4,
        reviveCombat: true,
        eventPlan: "risk",
        eventPreview: "险搏：把破绽直接换成斩杀进度，适合爆发或终结流。",
        eventStyleBonus: 2,
      },
      {
        id: "boss-break-guard",
        title: "镇息护身",
        desc: `获得 ${shield} 护盾，恢复 12% 生命，并压低 6 点劫压。`,
        healPct: 0.12,
        shieldPct: 0.22,
        threatDelta: -6,
        reviveCombat: true,
        eventPlan: "safe",
        eventPreview: "稳阵：把破绽换成容错，适合护盾、续航或残血局。",
        eventShieldPct: 0.08,
      },
      {
        id: "boss-break-plunder",
        title: "夺取镇物",
        desc: `获得 ${plunderZhu} 筑灵髓、1 灵砂和 1 次战利品重掷。`,
        rewardZhuLingEssence: plunderZhu,
        rewardLingSha: 1,
        reviveCombat: true,
        eventPlan: "draft",
        eventPreview: "探秘：把破绽换成局内资源和结算选择空间。",
        eventRerollBonus: 1,
      },
    ],
  };
}

function startCurrentNode(state: GameState, now: number): void {
  const d = state.dungeon;
  const node = d.runNodes[d.runNodeIndex];
  if (!node) {
    finishRun(state, true);
    return;
  }
  d.runPendingRewards = [];
  d.runPendingEvent = null;
  d.runPendingRoutes = [];
  d.runEnemy = null;
  d.runObjective = null;
  d.runOpportunity = null;
  d.runInCombat = false;
  if (node.type === "event") {
    const src = pickRunEventForNode(state, node);
    const baseEvent = { ...src, options: src.options.map((x) => ({ ...x })) };
    d.runPendingEvent = withEventBuildHints(state, withEventScoutHints(baseEvent, node.forecastEnemyElement));
    const scoutLine = node.forecastEnemyElement ? `侦察命中：偏${runElementName(node.forecastEnemyElement)}行。` : "";
    d.runLog = `遭遇：${d.runPendingEvent.title}${scoutLine ? ` ${scoutLine}` : ""}`;
    return;
  }
  if (node.type === "rest") {
    d.runPendingEvent = withEventBuildHints(state, buildRestEvent(state));
    d.runLog = "灵泉整息：选择本局下一段的恢复、构筑或爆发节奏。";
    return;
  }
  spawnEnemyForNode(state, node, now);
}

export function canEnterDungeon(state: GameState, _now: number): boolean {
  return !state.dungeon.active;
}

export function canEnterAtWave(_state: GameState, w: number): boolean {
  return Number.isFinite(w) && w >= 1;
}

export function dungeonFrontierWave(state: GameState): number {
  return Math.max(1, state.dungeon.maxWaveRecord + 1);
}

export function enterDungeon(state: GameState, _startWave?: number): boolean {
  const d = state.dungeon;
  if (d.active) return false;
  const now = Date.now();
  damageFloatQueue.length = 0;
  d.active = true;
  d.runInCombat = false;
  d.wave = Math.max(1, d.maxWaveRecord + 1);
  d.runNodes = makeRunNodes(state);
  d.runNodeIndex = 0;
  d.runBlessings = [];
  d.runThreat = 0;
  d.runLastGrade = "none";
  d.runLastScore = 0;
  d.runRewardRerolls = 1;
  d.runOpeningDraft = true;
  d.runCounterChain = 0;
  d.runCounterTempoStreak = 0;
  d.runCounterTempoPeak = 0;
  d.runCounterTempoLast = "";
  d.runCounterTempoPrize = 0;
  d.runCounterTempoPrizeLast = "";
  d.runClutchPrize = 0;
  d.runClutchPrizeLast = "";
  d.runMomentum = 0;
  d.runStyleStreak = 0;
  d.runStylePeak = 0;
  d.runActionWeaveMask = 0;
  d.runActionWeaveStreak = 0;
  d.runActionWeavePeak = 0;
  d.runActionWeaveLast = "";
  d.runActionWeavePrize = 0;
  d.runActionWeavePrizeLast = "";
  d.runLastStandUsed = false;
  d.runBossPosture = 0;
  d.runBossPostureMax = 0;
  d.runBossBreaks = 0;
  d.runBossPhase = 0;
  d.runBossOmen = "none";
  d.runBossOmenUntilMs = 0;
  d.runBossOmenStreak = 0;
  d.runBossOmenPeak = 0;
  d.runBossOmenLast = "";
  d.runLastOutcome = "none";
  d.runLastDurationSec = 0;
  d.runLastKills = 0;
  d.runLastEssence = 0;
  d.runLastThreat = 0;
  d.runLastBlessingCount = 0;
  d.runLastSummary = "";
  d.runPendingRewards = [];
  d.runPendingEvent = null;
  d.runPendingRoutes = [];
  d.runLockedRewardIds = [];
  d.runEnemy = null;
  d.runObjective = null;
  d.runObjectiveStreak = 0;
  d.runObjectivePeak = 0;
  d.runTacticalEdgeHits = 0;
  d.runTacticalEdgeDamagePct = 0;
  d.runTacticalEdgeLabel = "";
  d.runTacticalEdgeLastEcho = "";
  d.runTacticalEdgeChain = 0;
  d.runTacticalEdgePrize = 0;
  d.runRoleEcho = null;
  d.runRoleEchoPower = 0;
  d.runRoleEchoLast = "";
  d.runRoleReadRole = null;
  d.runRoleReadStreak = 0;
  d.runRoleReadPeak = 0;
  d.runRoleReadLast = "";
  d.runRoleReadPrizeRole = null;
  d.runRoleReadPrizePower = 0;
  d.runRoleReadPrizeLast = "";
  d.runRoutePledgeStreak = 0;
  d.runRoutePledgePeak = 0;
  d.runRoutePledgeLast = "";
  d.runPledgeReprisal = 0;
  d.runPledgeReprisalLast = "";
  d.runRewardVerb = "";
  d.runRewardVerbStreak = 0;
  d.runRewardVerbPeak = 0;
  d.runRewardVerbLast = "";
  d.runRewardVerbSurge = "";
  d.runRewardVerbSurgePower = 0;
  d.runRewardVerbSurgeLast = "";
  d.runEventEchoPlan = "";
  d.runEventEchoPower = 0;
  d.runEventEchoLast = "";
  d.runWarrant = makeRunWarrant(state);
  d.runWarrantPrize = 0;
  d.runWarrantPrizeLast = "";
  d.runOpportunity = null;
  d.runOpportunityNextAtMs = 0;
  d.runShield = 0;
  d.runSkillCooldownUntil = 0;
  d.runFinisherCharge = 0;
  d.runSkillQueued = false;
  d.runFervorQueued = false;
  d.runFinisherQueued = false;
  d.runKills = 0;
  d.runEssenceGained = 0;
  d.sessionKills = 0;
  d.sessionEssence = 0;
  d.sessionEnterAtMs = now;
  d.playerMax = playerMaxHp(state);
  d.playerHp = Math.min(state.combatHpCurrent || d.playerMax, d.playerMax);
  if (d.playerHp <= 0) d.playerHp = d.playerMax;
  d.stamina = DUNGEON_STAMINA_MAX;
  d.dodgeIframesUntil = now + 650;
  d.playerAttackAccum = 0;
  d.duelComboStacks = 0;
  d.duelFervor = 0;
  d.pendingToast = null;
  d.pendingKillToast = null;
  clearRunRewardLocks(state);
  d.runPendingRewards = buildRunRewardOptions(state, false);
  d.runLog = "选择开局灵印，确定本局第一段构筑方向。";
  return true;
}

export function leaveDungeon(state: GameState): void {
  const d = state.dungeon;
  state.combatHpCurrent = Math.max(1, d.playerHp || state.combatHpCurrent);
  d.active = false;
  d.runInCombat = false;
  d.runEnemy = null;
  d.runPendingRewards = [];
  d.runPendingEvent = null;
  d.runPendingRoutes = [];
  d.runLockedRewardIds = [];
  d.runOpeningDraft = false;
  d.runCounterChain = 0;
  d.runCounterTempoStreak = 0;
  d.runCounterTempoPeak = 0;
  d.runCounterTempoLast = "";
  d.runCounterTempoPrize = 0;
  d.runCounterTempoPrizeLast = "";
  d.runClutchPrize = 0;
  d.runClutchPrizeLast = "";
  d.runMomentum = 0;
  d.runStyleStreak = 0;
  d.runStylePeak = 0;
  d.runActionWeaveMask = 0;
  d.runActionWeaveStreak = 0;
  d.runActionWeavePeak = 0;
  d.runActionWeaveLast = "";
  d.runActionWeavePrize = 0;
  d.runActionWeavePrizeLast = "";
  d.runLastStandUsed = false;
  d.runBossPosture = 0;
  d.runBossPostureMax = 0;
  d.runBossBreaks = 0;
  d.runBossPhase = 0;
  d.runBossOmen = "none";
  d.runBossOmenUntilMs = 0;
  d.runBossOmenStreak = 0;
  d.runBossOmenPeak = 0;
  d.runBossOmenLast = "";
  d.runObjective = null;
  d.runObjectiveStreak = 0;
  d.runObjectivePeak = 0;
  d.runTacticalEdgeHits = 0;
  d.runTacticalEdgeDamagePct = 0;
  d.runTacticalEdgeLabel = "";
  d.runTacticalEdgeLastEcho = "";
  d.runTacticalEdgeChain = 0;
  d.runTacticalEdgePrize = 0;
  d.runRoleEcho = null;
  d.runRoleEchoPower = 0;
  d.runRoleEchoLast = "";
  d.runRoleReadRole = null;
  d.runRoleReadStreak = 0;
  d.runRoleReadPeak = 0;
  d.runRoleReadLast = "";
  d.runRoleReadPrizeRole = null;
  d.runRoleReadPrizePower = 0;
  d.runRoleReadPrizeLast = "";
  d.runRoutePledgeStreak = 0;
  d.runRoutePledgePeak = 0;
  d.runRoutePledgeLast = "";
  d.runPledgeReprisal = 0;
  d.runPledgeReprisalLast = "";
  d.runRewardVerb = "";
  d.runRewardVerbStreak = 0;
  d.runRewardVerbPeak = 0;
  d.runRewardVerbLast = "";
  d.runRewardVerbSurge = "";
  d.runRewardVerbSurgePower = 0;
  d.runRewardVerbSurgeLast = "";
  d.runEventEchoPlan = "";
  d.runEventEchoPower = 0;
  d.runEventEchoLast = "";
  d.runWarrant = null;
  d.runOpportunity = null;
  d.runOpportunityNextAtMs = 0;
  d.runFervorQueued = false;
  d.mobs = [];
  d.pendingToast = "已暂离幻域行旅。";
}

export function queueDungeonDodge(state: GameState): void {
  if (!state.dungeon.active) return;
  state.dungeon.dodgeQueued = true;
}

export function queueDungeonSkill(state: GameState): void {
  if (!state.dungeon.active) return;
  state.dungeon.runSkillQueued = true;
}

export function queueDungeonFervor(state: GameState): void {
  if (!state.dungeon.active) return;
  state.dungeon.runFervorQueued = true;
}

export function queueDungeonFinisher(state: GameState): void {
  if (!state.dungeon.active) return;
  state.dungeon.runFinisherQueued = true;
}

export function applyRunRewardChoice(state: GameState, rewardId: string): boolean {
  const d = state.dungeon;
  const reward = d.runPendingRewards.find((x) => x.id === rewardId);
  const blessing = reward?.blessingId ? getRunBlessing(reward.blessingId) : undefined;
  const prevElementCount = blessing?.element ? runBlessingElementCounts(state)[blessing.element] : 0;
  const wasOpeningDraft = d.runOpeningDraft;
  const ok = (applyRunRewardImported as (state: GameState, rewardId: string) => boolean)(state, rewardId);
  if (!ok) return false;
  clearRunRewardLocks(state);
  const now = Date.now();
  let resonanceLine = "";
  const warrantLine = !wasOpeningDraft && reward?.blessingId ? progressRunWarrant(state, "blessing_picks") : "";
  if (blessing?.element) {
    const nextElementCount = runBlessingElementCounts(state)[blessing.element];
    if (prevElementCount < 3 && nextElementCount >= 3) {
      resonanceLine = applyResonanceSurge(state, blessing.element, 3, now);
    } else if (prevElementCount < 2 && nextElementCount >= 2) {
      resonanceLine = applyResonanceSurge(state, blessing.element, 2, now);
    }
  }
  if (state.dungeon.runOpeningDraft) {
    state.dungeon.runOpeningDraft = false;
    startCurrentNode(state, now);
    if (resonanceLine) state.dungeon.runLog = resonanceLine;
    return true;
  }
  advanceAfterChoice(state, now);
  if (resonanceLine) state.dungeon.runLog = resonanceLine;
  appendRunLine(state, warrantLine);
  return true;
}

export function toggleRunRewardLock(state: GameState, rewardId: string): boolean {
  const d = state.dungeon;
  if (!d.active || d.runPendingRewards.length === 0) return false;
  if (!d.runPendingRewards.some((x) => x.id === rewardId)) return false;
  const idx = d.runLockedRewardIds.indexOf(rewardId);
  if (idx >= 0) {
    d.runLockedRewardIds.splice(idx, 1);
    d.runLog = "已解除战利品锁定。";
    return true;
  }
  if (d.runLockedRewardIds.length >= MAX_LOCKED_RUN_REWARDS) {
    d.runLog = "最多锁定 2 项，至少留 1 项给重掷替换。";
    return true;
  }
  d.runLockedRewardIds.push(rewardId);
  d.runLog = "已锁定战利品：重掷时保留此项。";
  return true;
}

export function rerollRunRewardChoices(state: GameState): boolean {
  const d = state.dungeon;
  if (!d.active || d.runPendingRewards.length === 0 || d.runRewardRerolls <= 0) return false;
  const locked = d.runPendingRewards.filter((x) => d.runLockedRewardIds.includes(x.id)).slice(0, MAX_LOCKED_RUN_REWARDS);
  if (locked.length >= d.runPendingRewards.length) {
    d.runLog = "已锁定全部战利品，无法重掷。";
    return false;
  }
  d.runRewardRerolls -= 1;
  d.runLockedRewardIds = locked.map((x) => x.id);
  d.runPendingRewards = rebuildRunRewardOptionsWithLocks(state, locked);
  d.runLog = d.runOpeningDraft
    ? `重掷开局灵印：保留 ${locked.length} 项，剩余 ${d.runRewardRerolls} 次。`
    : `重掷战利品：保留 ${locked.length} 项，剩余 ${d.runRewardRerolls} 次。`;
  return true;
}

export function applyRunRouteChoice(state: GameState, routeId: string): boolean {
  const d = state.dungeon;
  const route = d.runPendingRoutes.find((x) => x.id === routeId);
  if (!route) return false;
  const node = d.runNodes[d.runNodeIndex];
  if (!node || node.type === "boss") return false;
  node.type = route.nodeType;
  node.title = routeNodeTitle(route.nodeType);
  node.routePlan = route.plan;
  node.riskEnemyPowerPct = route.riskEnemyPowerPct ?? 0;
  node.forecastEnemyRole = route.forecastEnemyRole;
  node.forecastEnemyElement = route.forecastEnemyElement;
  if (route.rewardBlessingId && !d.runBlessings.includes(route.rewardBlessingId)) {
    d.runBlessings.push(route.rewardBlessingId);
  }
  state.zhuLingEssence += route.rewardZhuLingEssence ?? 0;
  state.lingSha += route.rewardLingSha ?? 0;
  applyRunThreatDelta(state, route.threatDelta ?? 0);
  if (route.healPct) {
    d.playerHp = Math.min(d.playerMax, d.playerHp + Math.floor(d.playerMax * route.healPct));
    state.combatHpCurrent = d.playerHp;
  }
  if (route.staminaPct) {
    d.stamina = Math.min(DUNGEON_STAMINA_MAX, d.stamina + DUNGEON_STAMINA_MAX * route.staminaPct);
  }
  d.runStyleStreak = 0;
  d.runStylePeak = 0;
  d.runActionWeaveMask = 0;
  d.runActionWeaveLast = "";
  const planLine = applyRunRoutePlan(state, route);
  const attuneLine = applyRunRouteAttunement(state, route);
  const recommendLine = applyRunRouteRecommendationFollow(state, route);
  const eventEchoRouteLine = applyRunEventEchoRouteFollow(state, route);
  const warrantLine = route.nodeType === "elite" ? progressRunWarrant(state, "elite_routes") : "";
  d.runPendingRoutes = [];
  const routeLine = `选择路线：${route.title}。${routeScoutText(route)}${planLine ? ` ${planLine}` : ""}${attuneLine ? ` ${attuneLine}` : ""}${recommendLine ? ` ${recommendLine}` : ""}${eventEchoRouteLine ? ` ${eventEchoRouteLine}` : ""}`;
  d.runLog = routeLine;
  startCurrentNode(state, Date.now());
  if (d.runLog !== routeLine) d.runLog = `${routeLine} ${d.runLog}`;
  appendRunLine(state, warrantLine);
  return true;
}

function applyRunRouteRecommendationFollow(state: GameState, route: DungeonRunRouteChoice): string {
  const d = state.dungeon;
  if (!route.routeRecommend) {
    if (d.runRouteRecommendStreak > 0) {
      d.runRouteRecommendLast = `顺势转向：已断开推荐路线 x${d.runRouteRecommendStreak}，改走${route.title}。`;
    }
    d.runRouteRecommendStreak = 0;
    return "";
  }

  d.runRouteRecommendStreak = Math.min(9, d.runRouteRecommendStreak + 1);
  d.runRouteRecommendPeak = Math.max(d.runRouteRecommendPeak, d.runRouteRecommendStreak);
  const power = Math.max(1, Math.min(4, d.runRouteRecommendStreak));
  const verb = d.runRewardVerb || "顺势";
  const hits = 1 + power;
  d.runTacticalEdgeHits = Math.min(9, d.runTacticalEdgeHits + hits);
  d.runTacticalEdgeDamagePct = Math.max(d.runTacticalEdgeDamagePct, 0.06 + power * 0.018);
  d.runTacticalEdgeLabel = `${verb}顺势`;
  d.duelFervor = Math.min(100, d.duelFervor + 6 + power * 4);
  if (route.nodeType === "event") {
    d.runRewardRerolls = Math.min(3, d.runRewardRerolls + 1);
  } else if (route.nodeType === "rest") {
    d.stamina = Math.min(DUNGEON_STAMINA_MAX, d.stamina + 8 + power * 4);
  }
  d.runRouteRecommendLast = `${verb}顺势行旅 x${d.runRouteRecommendStreak}：追击 +${hits}，战意 +${6 + power * 4}${route.nodeType === "event" ? "，重掷 +1" : route.nodeType === "rest" ? `，体力 +${8 + power * 4}` : ""}。`;
  pushDamageFloat(0.54, 0.23, `顺${d.runRouteRecommendStreak}`, "dmg-special");
  return d.runRouteRecommendLast;
}

function applyRunEventEchoRouteFollow(state: GameState, route: DungeonRunRouteChoice): string {
  const d = state.dungeon;
  const plan = d.runEventEchoPlan;
  const power = Math.max(0, Math.min(3, Math.floor(d.runEventEchoPower ?? 0)));
  if (!plan || power <= 0 || route.plan !== plan) return "";
  const nextPower = Math.min(3, power + 1);
  d.runEventEchoPower = nextPower;
  const label = routePlanLabel(plan);
  let line = `${label}余势顺路 x${nextPower}：下一战开局兑现更强。`;
  if (plan === "safe") {
    const shield = Math.floor(d.playerMax * (0.03 + nextPower * 0.015));
    d.runShield = Math.min(d.playerMax, d.runShield + shield);
    applyRunThreatDelta(state, -nextPower);
    line = `${label}余势顺路 x${nextPower}：护盾 +${shield}，劫压 -${nextPower}，下一战继续兑现。`;
  } else if (plan === "tempo") {
    const finisher = 5 + nextPower * 5;
    d.runFinisherCharge = Math.min(100, d.runFinisherCharge + finisher);
    d.runStyleStreak = Math.min(12, d.runStyleStreak + 1);
    d.runStylePeak = Math.max(d.runStylePeak, d.runStyleStreak);
    line = `${label}余势顺路 x${nextPower}：终结 +${finisher}，身法 +1，下一战继续兑现。`;
  } else if (plan === "risk") {
    const zhu = Math.floor((3 + nextPower * 3) * runThreatRewardMult(state));
    state.zhuLingEssence += zhu;
    d.runEssenceGained += zhu;
    d.duelFervor = Math.min(100, d.duelFervor + 8 + nextPower * 4);
    line = `${label}余势顺路 x${nextPower}：筑灵髓 +${zhu}，战意 +${8 + nextPower * 4}，下一战继续兑现。`;
  } else {
    const zhu = 2 + nextPower * 2;
    state.zhuLingEssence += zhu;
    d.runEssenceGained += zhu;
    d.runRewardRerolls = Math.min(3, d.runRewardRerolls + 1);
    line = `${label}余势顺路 x${nextPower}：筑灵髓 +${zhu}，重掷 +1，下一战继续兑现。`;
  }
  d.runEventEchoLast = line;
  pushDamageFloat(0.5, 0.24, `${label}${nextPower}`, "dmg-special");
  return line;
}

function applyRunRouteAttunement(state: GameState, route: DungeonRunRouteChoice): string {
  const d = state.dungeon;
  if (!route.attuneElement || dominantRunElement(state) !== route.attuneElement) return "";
  const depth = Math.max(1, d.runNodeIndex + 1);
  const element = route.attuneElement;
  if (element === "metal") {
    const zhu = 2 + depth;
    d.runFinisherCharge = Math.min(100, d.runFinisherCharge + 18);
    state.zhuLingEssence += zhu;
    d.runEssenceGained += zhu;
    pushDamageFloat(0.46, 0.28, "金契", "dmg-special");
    return `金行契合：终结 +18，筑灵髓 +${zhu}。`;
  }
  if (element === "wood") {
    const heal = Math.floor(d.playerMax * 0.1);
    const zhu = 2 + Math.floor(depth / 2);
    d.playerHp = Math.min(d.playerMax, d.playerHp + heal);
    state.combatHpCurrent = d.playerHp;
    state.zhuLingEssence += zhu;
    d.runEssenceGained += zhu;
    pushDamageFloat(0.46, 0.28, "木契", "dmg-special");
    return `木行契合：回生 ${heal}，筑灵髓 +${zhu}。`;
  }
  if (element === "water") {
    d.stamina = Math.min(DUNGEON_STAMINA_MAX, d.stamina + 20);
    d.runRewardRerolls = Math.min(2, d.runRewardRerolls + 1);
    pushDamageFloat(0.46, 0.28, "水契", "dmg-special");
    return "水行契合：体力 +20，重掷 +1。";
  }
  if (element === "earth") {
    const shield = Math.floor(d.playerMax * 0.15);
    d.runShield += shield;
    applyRunThreatDelta(state, -3);
    pushDamageFloat(0.46, 0.28, "土契", "dmg-special");
    return `土行契合：护盾 +${shield}，劫压 -3。`;
  }
  d.duelFervor = Math.min(100, d.duelFervor + 22);
  state.lingSha += 1;
  pushDamageFloat(0.46, 0.28, "火契", "dmg-special");
  return "火行契合：战意 +22，灵砂 +1。";
}

function applyRunRoutePlan(state: GameState, route: DungeonRunRouteChoice): string {
  const d = state.dungeon;
  const parts: string[] = [];
  if ((route.routeStyleBonus ?? 0) > 0) {
    d.runStyleStreak = Math.min(12, d.runStyleStreak + route.routeStyleBonus!);
    d.runStylePeak = Math.max(d.runStylePeak, d.runStyleStreak);
    parts.push(`身法 +${route.routeStyleBonus}`);
  }
  if ((route.routeFinisherBonus ?? 0) > 0) {
    d.runFinisherCharge = Math.min(100, d.runFinisherCharge + route.routeFinisherBonus!);
    parts.push(`终结 +${route.routeFinisherBonus}`);
  }
  if ((route.routeShieldPct ?? 0) > 0) {
    const shield = Math.floor(d.playerMax * route.routeShieldPct!);
    d.runShield += shield;
    parts.push(`护盾 +${shield}`);
  }
  if ((route.routeRerollBonus ?? 0) > 0) {
    d.runRewardRerolls = Math.min(2, d.runRewardRerolls + route.routeRerollBonus!);
    parts.push(`重掷 +${route.routeRerollBonus}`);
  }
  if (parts.length === 0) return "";
  pushDamageFloat(0.48, 0.26, routePlanLabel(route.plan), "dmg-special");
  return `${routePlanLabel(route.plan)}布势：${parts.join("，")}。`;
}

function applyRunEventPlan(state: GameState, opt: DungeonRunEventOption): string {
  const d = state.dungeon;
  const parts: string[] = [];
  if ((opt.eventStyleBonus ?? 0) > 0) {
    d.runStyleStreak = Math.min(12, d.runStyleStreak + opt.eventStyleBonus!);
    d.runStylePeak = Math.max(d.runStylePeak, d.runStyleStreak);
    parts.push(`身法 +${opt.eventStyleBonus}`);
  }
  if ((opt.eventFinisherBonus ?? 0) > 0) {
    d.runFinisherCharge = Math.min(100, d.runFinisherCharge + opt.eventFinisherBonus!);
    parts.push(`终结 +${opt.eventFinisherBonus}`);
  }
  if ((opt.eventShieldPct ?? 0) > 0) {
    const shield = Math.floor(d.playerMax * opt.eventShieldPct!);
    d.runShield += shield;
    parts.push(`护盾 +${shield}`);
  }
  if ((opt.eventRerollBonus ?? 0) > 0) {
    d.runRewardRerolls = Math.min(2, d.runRewardRerolls + opt.eventRerollBonus!);
    parts.push(`重掷 +${opt.eventRerollBonus}`);
  }
  if (parts.length === 0) return "";
  pushDamageFloat(0.46, 0.26, routePlanLabel(opt.eventPlan), "dmg-special");
  return `${routePlanLabel(opt.eventPlan)}事件：${parts.join("，")}。`;
}

export function applyRunEventChoice(state: GameState, optionId: string): boolean {
  const d = state.dungeon;
  const ev = d.runPendingEvent;
  if (!ev) return false;
  const opt = ev.options.find((x) => x.id === optionId);
  if (!opt) return false;
  const now = Date.now();
  if (opt.costHpPct) {
    d.playerHp = Math.max(1, d.playerHp - Math.floor(d.playerMax * opt.costHpPct));
  }
  if (opt.costStones) {
    if (!canAfford(state, opt.costStones)) {
      d.runLog = "灵石不足，无法选择这条路。";
      return false;
    }
    subStones(state, opt.costStones);
  }
  if (opt.checkElement) {
    const chance = eventOptionCheckChance(state, opt);
    if (nextRand01(state) > chance) {
      const hpLoss = Math.floor(d.playerMax * (opt.checkFailHpPct ?? 0.12));
      d.playerHp = Math.max(1, d.playerHp - hpLoss);
      state.combatHpCurrent = d.playerHp;
      state.zhuLingEssence += opt.checkFailZhuLingEssence ?? 2;
      applyRunThreatDelta(state, opt.checkFailThreatDelta ?? 10);
      d.runPendingEvent = null;
      d.runLog = `五行检定失手：成功率 ${Math.round(chance * 100)}%，生命 -${hpLoss}，劫压上升。`;
      markNodeClearedAndAdvance(state, now);
      return true;
    }
    d.runLog = `五行检定成功：成功率 ${Math.round(chance * 100)}%，取得事件奖励。`;
  }
  if (opt.rewardBlessingId && !d.runBlessings.includes(opt.rewardBlessingId)) {
    d.runBlessings.push(opt.rewardBlessingId);
  }
  state.summonEssence += opt.rewardSummonEssence ?? 0;
  state.zhuLingEssence += opt.rewardZhuLingEssence ?? 0;
  state.lingSha += opt.rewardLingSha ?? 0;
  state.xuanTie += opt.rewardXuanTie ?? 0;
  applyRunThreatDelta(state, opt.threatDelta ?? (opt.riskCombat ? 12 : 0));
  if (opt.healPct) {
    d.playerHp = Math.min(d.playerMax, d.playerHp + Math.floor(d.playerMax * opt.healPct));
  }
  if (opt.staminaPct) {
    d.stamina = Math.min(DUNGEON_STAMINA_MAX, d.stamina + DUNGEON_STAMINA_MAX * opt.staminaPct);
  }
  if (opt.finisherCharge) {
    d.runFinisherCharge = Math.min(100, d.runFinisherCharge + opt.finisherCharge);
  }
  if (opt.shieldPct) {
    d.runShield += Math.floor(d.playerMax * opt.shieldPct);
  }
  const eventPlanLine = applyRunEventPlan(state, opt);
  if (opt.enemyDamagePct && d.runEnemy) {
    const e = d.runEnemy;
    const dmg = Math.max(1, Math.floor(e.maxHp * opt.enemyDamagePct));
    e.hp -= dmg;
    pushDamageFloat(0.56, 0.35, `逆${dmg}`, "dmg-special");
    if (e.hp <= 0) {
      d.runPendingEvent = null;
      completeCombatNode(state, now);
      return true;
    }
    syncEnemyBars(state);
  }
  state.combatHpCurrent = d.playerHp;
  d.runLog = opt.checkElement ? `${d.runLog} ${opt.title}` : `事件选择：${opt.title}`;
  appendRunLine(state, eventPlanLine);
  appendRunLine(state, bankRunEventEcho(state, opt));
  const eventResultLine = d.runLog;
  d.runPendingEvent = null;
  if (opt.reviveCombat) {
    if (optionId === "last-stand-guard") {
      d.runMomentum = Math.max(0, d.runMomentum - 1);
      appendRunLine(state, breakRunCounterTempo(state, "逆命守势"));
    }
    d.runInCombat = true;
    if (d.runEnemy) delayEnemyIntent(d.runEnemy, now, 1800);
    const reviveLabel = ev.id.startsWith("boss-break") ? "破绽续战" : "逆命续战";
    d.runLog = `${reviveLabel}：${opt.title}。`;
    return true;
  }
  if (opt.rewardDraft) {
    clearRunRewardLocks(state);
    d.runPendingRewards = buildRunRewardOptions(state, false);
    d.runLog = `${eventResultLine} 整息淬印：${opt.title}，选择一份战利品后继续行旅。`;
    return true;
  }
  if (opt.riskCombat) {
    spawnEnemyForNode(state, { id: `risk-${now}`, type: "elite", title: "试招", cleared: false }, now);
    d.runLog = `${eventResultLine} ${d.runLog}`;
  } else {
    markNodeClearedAndAdvance(state, now);
    d.runLog = `${eventResultLine} ${d.runLog}`;
  }
  return true;
}

function markNodeClearedAndAdvance(state: GameState, now: number): void {
  const d = state.dungeon;
  const node = d.runNodes[d.runNodeIndex];
  if (node) node.cleared = true;
  d.maxWaveRecord = Math.max(d.maxWaveRecord, d.runNodeIndex + 1 + d.runsCompleted * 6);
  d.totalWavesCleared = Math.max(d.totalWavesCleared, d.maxWaveRecord);
  noteWeeklyBountyWave(state, now);
  d.runNodeIndex += 1;
  d.wave = d.maxWaveRecord + 1;
  if (d.runNodeIndex >= d.runNodes.length - 1) {
    startCurrentNode(state, now);
    return;
  }
  d.runPendingRewards = [];
  d.runPendingEvent = null;
  d.runPendingRoutes = buildRunRouteChoices(state);
  clearRunRewardLocks(state);
  d.runLog = "阵眼已破，选择下一段行旅路线。";
}

function advanceAfterChoice(state: GameState, now: number): void {
  markNodeClearedAndAdvance(state, now);
}

function runElementName(element: Element): string {
  if (element === "metal") return "金";
  if (element === "wood") return "木";
  if (element === "water") return "水";
  if (element === "earth") return "土";
  return "火";
}

function applyResonanceSurge(state: GameState, element: Element, tier: 2 | 3, now: number): string {
  const d = state.dungeon;
  const major = tier >= 3;
  const name = `${runElementName(element)}鸣${major ? "三印" : "共振"}`;
  let line = "";
  if (element === "metal") {
    const charge = major ? 55 : 32;
    d.runFinisherCharge = Math.min(100, d.runFinisherCharge + charge);
    if (d.runEnemy) d.runEnemy.block = 0;
    if (d.runEnemy?.role === "boss") strikeBossPosture(state, major ? 38 : 24, now, name);
    line = `${name}：破尽护势，终结 +${charge}`;
  } else if (element === "wood") {
    const heal = Math.floor(d.playerMax * (major ? 0.24 : 0.14));
    d.playerHp = Math.min(d.playerMax, d.playerHp + heal);
    state.combatHpCurrent = d.playerHp;
    const zhu = major ? 8 : 4;
    state.zhuLingEssence += zhu;
    d.runEssenceGained += zhu;
    line = `${name}：回生 ${heal}，筑灵髓 +${zhu}`;
  } else if (element === "water") {
    const stamina = major ? 60 : 35;
    d.stamina = Math.min(DUNGEON_STAMINA_MAX, d.stamina + stamina);
    d.dodgeIframesUntil = Math.max(d.dodgeIframesUntil, now + (major ? 1400 : 900));
    d.runSkillCooldownUntil = Math.min(d.runSkillCooldownUntil, now + 900);
    line = `${name}：体力 +${stamina}，身法回流`;
  } else if (element === "earth") {
    const shield = Math.floor(d.playerMax * (major ? 0.34 : 0.2));
    d.runShield += shield;
    applyRunThreatDelta(state, major ? -6 : -3);
    line = `${name}：护盾 +${shield}，劫压 ${major ? "-6" : "-3"}`;
  } else {
    const fervor = major ? 80 : 45;
    d.duelFervor = Math.min(100, d.duelFervor + fervor);
    if (d.runEnemy) applyDamageToEnemy(state, playerRunDamage(state) * (major ? 1.05 : 0.6), "鸣");
    line = `${name}：战意 +${fervor}${d.runEnemy ? "，爆燃追击" : ""}`;
  }
  pushDamageFloat(0.5, 0.26, name, "dmg-special");
  return line;
}

function captureRunSettlement(state: GameState, outcome: Exclude<DungeonRunOutcome, "none">, summary: string): void {
  const d = state.dungeon;
  const startedAt = d.sessionEnterAtMs > 0 ? d.sessionEnterAtMs : Date.now();
  d.runLastOutcome = outcome;
  d.runLastDurationSec = Math.max(0, Math.floor((Date.now() - startedAt) / 1000));
  d.runLastKills = Math.max(0, Math.floor(d.runKills));
  d.runLastEssence = Math.max(0, Math.floor(d.runEssenceGained));
  d.runLastThreat = Math.max(0, Math.min(100, Math.floor(d.runThreat)));
  d.runLastBlessingCount = Math.max(0, d.runBlessings.length);
  d.runLastSummary = summary;
}

function finishRun(state: GameState, victory: boolean): void {
  const d = state.dungeon;
  d.active = false;
  d.runInCombat = false;
  d.runEnemy = null;
  d.runPendingRewards = [];
  d.runPendingEvent = null;
  d.runPendingRoutes = [];
  d.runLockedRewardIds = [];
  d.runOpeningDraft = false;
  d.runCounterChain = 0;
  d.runCounterTempoStreak = 0;
  d.runCounterTempoPeak = 0;
  d.runCounterTempoLast = "";
  d.runCounterTempoPrize = 0;
  d.runCounterTempoPrizeLast = "";
  d.runClutchPrize = 0;
  d.runClutchPrizeLast = "";
  d.runStyleStreak = 0;
  d.runStylePeak = 0;
  d.runActionWeaveMask = 0;
  d.runActionWeaveStreak = 0;
  d.runActionWeavePeak = 0;
  d.runActionWeaveLast = "";
  d.runActionWeavePrize = 0;
  d.runActionWeavePrizeLast = "";
  d.runBossOmen = "none";
  d.runBossOmenUntilMs = 0;
  d.runBossPhase = 0;
  d.runBossOmenStreak = 0;
  d.runBossOmenPeak = 0;
  d.runBossOmenLast = "";
  d.runObjective = null;
  d.runObjectiveStreak = 0;
  d.runObjectivePeak = 0;
  d.runTacticalEdgeHits = 0;
  d.runTacticalEdgeDamagePct = 0;
  d.runTacticalEdgeLabel = "";
  d.runTacticalEdgeLastEcho = "";
  d.runTacticalEdgeChain = 0;
  d.runTacticalEdgePrize = 0;
  d.runRoleEcho = null;
  d.runRoleEchoPower = 0;
  d.runRoleEchoLast = "";
  d.runRoleReadRole = null;
  d.runRoleReadStreak = 0;
  d.runRoleReadPeak = 0;
  d.runRoleReadLast = "";
  d.runRoleReadPrizeRole = null;
  d.runRoleReadPrizePower = 0;
  d.runRoleReadPrizeLast = "";
  d.runRoutePledgeStreak = 0;
  d.runRoutePledgePeak = 0;
  d.runRoutePledgeLast = "";
  d.runPledgeReprisal = 0;
  d.runPledgeReprisalLast = "";
  d.runRewardVerb = "";
  d.runRewardVerbStreak = 0;
  d.runRewardVerbPeak = 0;
  d.runRewardVerbLast = "";
  d.runRewardVerbSurge = "";
  d.runRewardVerbSurgePower = 0;
  d.runRewardVerbSurgeLast = "";
  d.runEventEchoPlan = "";
  d.runEventEchoPower = 0;
  d.runEventEchoLast = "";
  d.runWarrant = null;
  d.runOpportunity = null;
  d.runOpportunityNextAtMs = 0;
  d.mobs = [];
  state.combatHpCurrent = Math.max(1, d.playerHp);
  if (victory) {
    d.runsCompleted += 1;
    const msg = grantRunCompletionRewards(state);
    d.pendingToast = msg;
    captureRunSettlement(state, "victory", msg);
  } else {
    d.runsFailed += 1;
    const msg = "行旅失败：保留本局已入袋资源，回灵府整息后可立刻再战。";
    d.pendingToast = msg;
    captureRunSettlement(state, "defeat", msg);
  }
}

function playerRunDamage(state: GameState): number {
  const d = state.dungeon;
  const totals = runBlessingTotals(state);
  const pEl = playerBattleElement(state);
  const e = d.runEnemy;
  const elem = e ? elementDamageMultiplier(pEl, e.element) : 1;
  const crit = nextRand01(state) < playerCritChance(state) + totals.critPct ? playerCritMult(state) : 1;
  const nodeMomentum = 1 + Math.max(0, d.runNodeIndex) * 0.035;
  return playerAttack(state) * (1 + totals.atkPct) * elem * crit * nodeMomentum;
}

function applyFervorSurge(state: GameState, raw: number, label: string): { raw: number; label: string } {
  const d = state.dungeon;
  const e = d.runEnemy;
  if (!e || d.duelFervor < 100) return { raw, label };
  d.duelFervor = 0;
  const dom = dominantRunElement(state);
  let mult = 1.25;
  let surge = "战";
  if (dom === "metal") {
    e.block = 0;
    mult = 1.38;
    surge = "战·金";
    d.runLog = "金势战意：破尽护势，下一击加深。";
  } else if (dom === "wood") {
    const heal = Math.floor(d.playerMax * 0.1);
    d.playerHp = Math.min(d.playerMax, d.playerHp + heal);
    mult = 1.12;
    surge = "战·木";
    d.runLog = `木势战意：回生 ${heal} 生命，并带出追击。`;
  } else if (dom === "water") {
    d.stamina = Math.min(DUNGEON_STAMINA_MAX, d.stamina + 30);
    mult = 1.18;
    surge = "战·水";
    d.runLog = "水势战意：回流体力，身法更顺。";
  } else if (dom === "earth") {
    const shield = Math.floor(d.playerMax * 0.12);
    d.runShield += shield;
    mult = 1.18;
    surge = "战·土";
    d.runLog = `土势战意：护盾 +${shield}，稳住阵脚。`;
  } else {
    mult = 1.62;
    surge = "战·火";
    d.runLog = "火势战意：爆燃一击。";
  }
  d.runFinisherCharge = Math.min(100, d.runFinisherCharge + 12);
  pushDamageFloat(0.46, 0.34, surge, "dmg-special");
  return { raw: raw * mult, label: label || surge };
}

function executeFervorSurge(state: GameState, now: number): boolean {
  const d = state.dungeon;
  const e = d.runEnemy;
  if (!e) return false;
  if (d.duelFervor < 100) {
    d.runLog = "Fervor is not full yet.";
    return false;
  }
  const beforeLog = d.runLog;
  const surged = applyFervorSurge(state, playerRunDamage(state) * 1.08, "");
  const surgeLine = d.runLog !== beforeLog ? d.runLog : "";
  if (!state.dungeon.runEnemy) return true;
  d.runStyleStreak = Math.min(12, d.runStyleStreak + 1);
  d.runStylePeak = Math.max(d.runStylePeak, d.runStyleStreak);
  d.runFinisherCharge = Math.min(100, d.runFinisherCharge + 10);
  applyDamageToEnemy(state, surged.raw, surged.label);
  if (!state.dungeon.runEnemy) return true;
  if (surgeLine) d.runLog = surgeLine;
  appendRunLine(state, resolveRunOpportunity(state, "finisher", now));
  if (state.dungeon.runEnemy?.role === "boss") {
    strikeBossPosture(state, 24, now, "fervor surge");
  }
  return true;
}

function triggerComboFlourish(state: GameState, stacks: number, now: number): boolean {
  const d = state.dungeon;
  const e = d.runEnemy;
  if (!e || stacks <= 0 || stacks % 8 !== 0) return false;
  const dom = dominantRunElement(state);
  let line = "";
  let bonusDmg = 0;
  if (dom === "metal") {
    e.block = 0;
    bonusDmg = playerRunDamage(state) * 0.42;
    if (e.role === "boss") strikeBossPosture(state, 18, now, "金锋连击");
    if (!state.dungeon.runEnemy) return true;
    line = `金锋连击 ${stacks}：破防追斩。`;
  } else if (dom === "wood") {
    const heal = Math.floor(d.playerMax * 0.06);
    d.playerHp = Math.min(d.playerMax, d.playerHp + heal);
    state.combatHpCurrent = d.playerHp;
    state.zhuLingEssence += 2;
    d.runEssenceGained += 2;
    bonusDmg = playerRunDamage(state) * 0.24;
    line = `青木连击 ${stacks}：回生 ${heal}，筑灵髓 +2。`;
  } else if (dom === "water") {
    d.stamina = Math.min(DUNGEON_STAMINA_MAX, d.stamina + 18);
    d.dodgeIframesUntil = Math.max(d.dodgeIframesUntil, now + 650);
    d.runSkillCooldownUntil = Math.min(d.runSkillCooldownUntil, now + 900);
    bonusDmg = playerRunDamage(state) * 0.3;
    line = `流云连击 ${stacks}：体力 +18，身法回流。`;
  } else if (dom === "earth") {
    const shield = Math.floor(d.playerMax * 0.09);
    d.runShield += shield;
    applyRunThreatDelta(state, -1);
    bonusDmg = playerRunDamage(state) * 0.28;
    line = `厚土连击 ${stacks}：护盾 +${shield}，劫压 -1。`;
  } else {
    d.duelFervor = Math.min(100, d.duelFervor + 18);
    bonusDmg = playerRunDamage(state) * 0.62;
    line = `焚火连击 ${stacks}：战意 +18，爆燃追击。`;
  }
  const dmg = Math.max(1, Math.floor(bonusDmg));
  e.hp -= dmg;
  d.runLog = line;
  pushDamageFloat(0.5, 0.25, `连击${stacks}`, "dmg-special");
  pushDamageFloat(0.56, 0.36, `+${dmg}`, "dmg-special");
  if (e.hp <= 0) {
    completeCombatNode(state, now);
    return true;
  }
  syncEnemyBars(state);
  return true;
}

function applyTacticalEdgeElementEcho(state: GameState, raw: number, pct: number): { raw: number; label: string; line: string } {
  const d = state.dungeon;
  const e = d.runEnemy;
  const dom = dominantRunElement(state);
  if (dom === "metal") {
    let cut = 0;
    if (e) {
      cut = Math.min(e.block, Math.max(1, Math.floor(raw * (0.3 + pct * 0.35))));
      e.block = Math.max(0, e.block - cut);
      if (cut > 0) pushDamageFloat(0.47, 0.28, `破${cut}`, "dmg-special");
    }
    return { raw: raw * 1.04, label: "追·金", line: cut > 0 ? `金追击：破护 ${cut}，追斩加深。` : "金追击：护势已空，追斩加深。" };
  }
  if (dom === "wood") {
    const heal = Math.max(1, Math.floor(d.playerMax * (0.012 + Math.min(0.018, pct * 0.04))));
    d.playerHp = Math.min(d.playerMax, d.playerHp + heal);
    state.combatHpCurrent = d.playerHp;
    pushDamageFloat(0.44, 0.33, `生${heal}`, "dmg-special");
    return { raw, label: "追·木", line: `木追击：回生 ${heal}，续住血线。` };
  }
  if (dom === "water") {
    d.stamina = Math.min(DUNGEON_STAMINA_MAX, d.stamina + 7);
    d.dodgeIframesUntil = Math.max(d.dodgeIframesUntil, Date.now() + 180);
    pushDamageFloat(0.45, 0.36, "体+7", "dmg-miss");
    return { raw, label: "追·水", line: "水追击：体力 +7，短暂流转护身。" };
  }
  if (dom === "earth") {
    const shield = Math.max(1, Math.floor(d.playerMax * (0.014 + Math.min(0.022, pct * 0.035))));
    d.runShield = Math.min(d.playerMax, d.runShield + shield);
    pushDamageFloat(0.45, 0.34, `盾${shield}`, "dmg-special");
    return { raw, label: "追·土", line: `土追击：护盾 +${shield}，稳住阵脚。` };
  }
  d.duelFervor = Math.min(100, d.duelFervor + 5);
  pushDamageFloat(0.46, 0.3, "战+5", "dmg-special");
  return { raw: raw * 1.1, label: "追·火", line: "火追击：战意 +5，爆燃加深。" };
}

function progressTacticalEdgeChain(state: GameState): string {
  const d = state.dungeon;
  d.runTacticalEdgeChain = Math.min(3, d.runTacticalEdgeChain + 1);
  if (d.runTacticalEdgeChain < 3) return "";
  d.runTacticalEdgeChain = 0;
  d.runFinisherCharge = Math.min(100, d.runFinisherCharge + 14);
  d.duelFervor = Math.min(100, d.duelFervor + 12);
  d.runTacticalEdgePrize = Math.min(3, d.runTacticalEdgePrize + 1);
  const styleLine = gainRunStyle(state, 1, "追击链");
  pushDamageFloat(0.55, 0.2, "追链", "dmg-special");
  return `追击链成：终结 +14，战意 +12，下次战利品注入链印。${styleLine ? ` ${styleLine}` : ""}`;
}

function consumeTacticalEdge(state: GameState, raw: number, label: string): { raw: number; label: string } {
  const d = state.dungeon;
  if (d.runTacticalEdgeHits <= 0 || d.runTacticalEdgeDamagePct <= 0) return { raw, label };
  const pct = Math.max(0, Math.min(0.75, d.runTacticalEdgeDamagePct));
  const echo = applyTacticalEdgeElementEcho(state, raw, pct);
  const chainLine = progressTacticalEdgeChain(state);
  d.runTacticalEdgeLastEcho = chainLine ? `${echo.line} ${chainLine}` : echo.line;
  d.runTacticalEdgeHits = Math.max(0, d.runTacticalEdgeHits - 1);
  if (d.runTacticalEdgeHits <= 0) {
    d.runTacticalEdgeDamagePct = 0;
    d.runTacticalEdgeLabel = "";
  }
  pushDamageFloat(0.52, 0.24, `追+${Math.round(pct * 100)}%`, "dmg-special");
  return { raw: echo.raw * (1 + pct), label: label ? `${label}追` : echo.label };
}

function applyDamageToEnemy(state: GameState, raw: number, label = ""): void {
  const d = state.dungeon;
  const e = d.runEnemy;
  if (!e) return;
  const edged = consumeTacticalEdge(state, raw, label);
  raw = edged.raw;
  label = edged.label;
  const blocked = Math.min(e.block, raw * 0.8);
  e.block = Math.max(0, e.block - blocked);
  const dmg = Math.max(1, raw - blocked);
  e.hp -= dmg;
  d.duelComboStacks += 1;
  d.duelFervor = Math.min(100, d.duelFervor + 8);
  d.runFinisherCharge = Math.min(100, d.runFinisherCharge + 10);
  pushDamageFloat(0.52, 0.42, `${label}${Math.round(dmg)}`, raw > dmg ? "dmg-special" : "dmg-out");
  if (e.hp > 0 && triggerComboFlourish(state, d.duelComboStacks, Date.now())) {
    if (!state.dungeon.runEnemy) return;
  }
  if (e.hp <= 0) completeCombatNode(state, Date.now());
  else syncEnemyBars(state);
}

function strikeBossPosture(state: GameState, amount: number, now: number, reason: string): boolean {
  const d = state.dungeon;
  const e = d.runEnemy;
  if (!e || e.role !== "boss" || d.runBossPostureMax <= 0) return false;
  d.runBossPosture = Math.min(d.runBossPostureMax, d.runBossPosture + amount);
  pushDamageFloat(0.58, 0.34, `势-${amount}`, "dmg-special");
  if (d.runBossPosture < d.runBossPostureMax) {
    d.runLog = `${reason}：首领架势 ${d.runBossPosture}/${d.runBossPostureMax}。`;
    return false;
  }
  d.runBossPosture = 0;
  d.runBossBreaks += 1;
  d.runBossPostureMax = Math.min(180, d.runBossPostureMax + 24);
  e.block = 0;
  e.enrage = Math.max(0, e.enrage - 0.35);
  delayEnemyIntent(e, now, 2200);
  const dmg = Math.max(1, Math.floor(e.maxHp * (0.1 + Math.min(0.08, d.runBossBreaks * 0.02))));
  const zhu = Math.floor((6 + d.runBossBreaks * 3) * runThreatRewardMult(state));
  e.hp -= dmg;
  state.zhuLingEssence += zhu;
  d.runEssenceGained += zhu;
  d.runFinisherCharge = Math.min(100, d.runFinisherCharge + 28);
  d.runLog = `首领破势：${reason}打穿镇域架势，造成 ${dmg} 伤害，筑灵髓 +${zhu}，终结 +28。`;
  pushDamageFloat(0.54, 0.28, "破势", "dmg-special");
  pushDamageFloat(0.58, 0.38, `+${zhu}`, "dmg-special");
  if (e.hp <= 0) completeCombatNode(state, now);
  else {
    d.runInCombat = false;
    d.runPendingEvent = withEventBuildHints(state, buildBossBreakEvent(state, reason));
    syncEnemyBars(state);
  }
  return true;
}

function gainRunStyle(state: GameState, amount: number, label: string): string {
  const d = state.dungeon;
  const before = Math.max(0, d.runStyleStreak);
  d.runStyleStreak = Math.min(12, before + amount);
  d.runStylePeak = Math.max(d.runStylePeak, d.runStyleStreak);
  const beforeTier = Math.floor(before / 3);
  const afterTier = Math.floor(d.runStyleStreak / 3);
  if (afterTier <= beforeTier) {
    pushDamageFloat(0.48, 0.24, `身法+${amount}`, "dmg-special");
    return `${label}：身法连段 +${amount}（${d.runStyleStreak}/12）。`;
  }
  const zhu = 2 + afterTier + Math.floor(Math.max(0, d.runNodeIndex) / 2);
  state.zhuLingEssence += zhu;
  d.runEssenceGained += zhu;
  d.stamina = Math.min(DUNGEON_STAMINA_MAX, d.stamina + 6 + afterTier * 2);
  d.runFinisherCharge = Math.min(100, d.runFinisherCharge + 6 + afterTier * 2);
  pushDamageFloat(0.48, 0.24, `身法${d.runStyleStreak}`, "dmg-special");
  pushDamageFloat(0.56, 0.34, `+${zhu}`, "dmg-special");
  return `${label}：身法连段 ${d.runStyleStreak}/12，筑灵髓 +${zhu}，体力回流，终结 +${6 + afterTier * 2}。`;
}

function runActionWeaveBit(action: DungeonRunOpportunityAction): number {
  return action === "dodge" ? 1 : action === "skill" ? 2 : 4;
}

function runActionWeaveProgress(mask: number): string {
  const marks = [
    mask & 1 ? "闪" : "·",
    mask & 2 ? "心" : "·",
    mask & 4 ? "终" : "·",
  ];
  return marks.join("");
}

function runActionWeaveMissing(mask: number): string {
  const missing = [];
  if (!(mask & 1)) missing.push("闪避");
  if (!(mask & 2)) missing.push("心法");
  if (!(mask & 4)) missing.push("终结");
  return missing.join("、");
}

function noteRunActionWeave(state: GameState, action: DungeonRunOpportunityAction): string {
  const d = state.dungeon;
  const before = Math.max(0, Math.min(7, Math.floor(d.runActionWeaveMask)));
  const next = before | runActionWeaveBit(action);
  if (next !== 7) {
    d.runActionWeaveMask = next;
    d.runActionWeaveLast = `万象三式：${runActionWeaveProgress(next)}，补齐${runActionWeaveMissing(next)}触发连携。`;
    return d.runActionWeaveLast;
  }

  d.runActionWeaveMask = 0;
  d.runActionWeaveStreak = Math.min(9, Math.max(0, Math.floor(d.runActionWeaveStreak)) + 1);
  d.runActionWeavePeak = Math.max(d.runActionWeavePeak, d.runActionWeaveStreak);
  d.runActionWeavePrize = Math.min(3, Math.max(0, Math.floor(d.runActionWeavePrize ?? 0)) + 1);
  const depth = Math.max(1, d.runNodeIndex + 1);
  const streak = d.runActionWeaveStreak;
  const zhu = 4 + depth + streak * 2;
  const stamina = 12 + streak * 4;
  const finisher = Math.min(32, 8 + streak * 5);
  const hits = Math.min(7, 2 + streak);
  const pct = Math.min(0.18, 0.06 + streak * 0.02);
  state.zhuLingEssence += zhu;
  d.runEssenceGained += zhu;
  d.stamina = Math.min(DUNGEON_STAMINA_MAX, d.stamina + stamina);
  d.runFinisherCharge = Math.min(100, d.runFinisherCharge + finisher);
  d.duelFervor = Math.min(100, d.duelFervor + 8 + streak * 4);
  d.runTacticalEdgeHits = Math.min(9, d.runTacticalEdgeHits + hits);
  d.runTacticalEdgeDamagePct = Math.max(d.runTacticalEdgeDamagePct, pct);
  d.runTacticalEdgeLabel = "万象三式";
  d.runActionWeaveLast = `万象三式 x${streak}：筑灵髓 +${zhu}，体力 +${stamina}，终结 +${finisher}，追击 +${hits}，三式灵契 +1。`;
  pushDamageFloat(0.5, 0.18, `三式${streak}`, "dmg-special");
  pushDamageFloat(0.58, 0.28, `+${zhu}`, "dmg-special");
  return d.runActionWeaveLast;
}

function trimRunStyle(state: GameState, amount: number): void {
  const d = state.dungeon;
  if (d.runStyleStreak <= 0) return;
  d.runStyleStreak = Math.max(0, d.runStyleStreak - amount);
}

function applyElementFinisherBonus(
  state: GameState,
  suppress: boolean,
  now: number,
): { multBonus: number; postureBonus: number; styleBonus: number; line: string } {
  const d = state.dungeon;
  const e = d.runEnemy;
  if (!e) return { multBonus: 0, postureBonus: 0, styleBonus: 0, line: "" };
  const dom = dominantRunElement(state);
  if (dom === "metal") {
    const cut = Math.max(e.block, Math.floor(e.maxHp * 0.08));
    e.block = 0;
    e.enrage = Math.max(0, e.enrage - 0.12);
    pushDamageFloat(0.48, 0.26, "金断", "dmg-special");
    return {
      multBonus: suppress ? 0.42 : 0.3,
      postureBonus: 26,
      styleBonus: 1,
      line: `金系终结：破尽护势，额外斩势 ${cut}，首领架势受损。`,
    };
  }
  if (dom === "wood") {
    const heal = Math.floor(d.playerMax * (suppress ? 0.16 : 0.12));
    d.playerHp = Math.min(d.playerMax, d.playerHp + heal);
    state.combatHpCurrent = d.playerHp;
    state.zhuLingEssence += 3;
    d.runEssenceGained += 3;
    pushDamageFloat(0.48, 0.26, "青生", "dmg-special");
    return {
      multBonus: 0.16,
      postureBonus: 12,
      styleBonus: 1,
      line: `木系终结：回生 ${heal}，筑灵髓 +3，续住下一轮攻势。`,
    };
  }
  if (dom === "water") {
    d.stamina = Math.min(DUNGEON_STAMINA_MAX, d.stamina + 30);
    d.dodgeIframesUntil = Math.max(d.dodgeIframesUntil, now + (suppress ? 1200 : 900));
    delayEnemyIntent(e, now, suppress ? 1500 : 1000);
    pushDamageFloat(0.48, 0.26, "流转", "dmg-special");
    return {
      multBonus: 0.22,
      postureBonus: 16,
      styleBonus: 2,
      line: "水系终结：体力 +30，短暂无敌并延后敌方攻势。",
    };
  }
  if (dom === "earth") {
    const shield = Math.floor(d.playerMax * (suppress ? 0.2 : 0.15));
    d.runShield = Math.min(d.playerMax, d.runShield + shield);
    applyRunThreatDelta(state, -2);
    pushDamageFloat(0.48, 0.26, "厚土", "dmg-special");
    return {
      multBonus: 0.18,
      postureBonus: 20,
      styleBonus: 1,
      line: `土系终结：护盾 +${shield}，劫压 -2，稳住失败边缘。`,
    };
  }
  d.duelFervor = Math.min(100, d.duelFervor + (suppress ? 24 : 18));
  pushDamageFloat(0.48, 0.26, "焚尽", "dmg-special");
  return {
    multBonus: suppress ? 0.62 : 0.48,
    postureBonus: 14,
    styleBonus: 1,
    line: `火系终结：爆发加深，战意 +${suppress ? 24 : 18}。`,
  };
}

function noteRunCounter(state: GameState, now: number): void {
  const d = state.dungeon;
  const e = d.runEnemy;
  if (!e) return;
  const tempoLine = rewardRunCounterTempo(state);
  d.runCounterChain = Math.min(2, d.runCounterChain + 1);
  appendRunLine(state, progressRunWarrant(state, "counter_moves"));
  appendRunLine(state, tempoLine);
  if (d.runCounterChain < 2) {
    pushDamageFloat(0.5, 0.28, "连携+1", "dmg-special");
    return;
  }
  d.runCounterChain = 0;
  const bonus = Math.max(1, playerRunDamage(state) * 0.82);
  const zhu = 3 + Math.max(0, d.runNodeIndex);
  e.hp -= bonus;
  state.zhuLingEssence += zhu;
  d.runEssenceGained += zhu;
  d.runFinisherCharge = Math.min(100, d.runFinisherCharge + 15);
  d.runLog = `破绽连携：追击 ${Math.round(bonus)}，筑灵髓 +${zhu}。`;
  pushDamageFloat(0.56, 0.28, "破绽", "dmg-special");
  if (e.hp <= 0) completeCombatNode(state, now);
  else syncEnemyBars(state);
}

function rewardRunCounterTempo(state: GameState): string {
  const d = state.dungeon;
  const streak = Math.min(9, Math.max(0, d.runCounterTempoStreak) + 1);
  d.runCounterTempoStreak = streak;
  d.runCounterTempoPeak = Math.max(d.runCounterTempoPeak, streak);
  const finisher = 4 + Math.min(18, streak * 3);
  d.runFinisherCharge = Math.min(100, d.runFinisherCharge + finisher);
  let line = `破招连势 x${streak}：终结 +${finisher}`;
  if (streak >= 2) {
    const edgeHits = streak >= 5 ? 2 : 1;
    const edgePct = Math.min(0.24, 0.08 + streak * 0.018);
    d.runTacticalEdgeHits = Math.min(9, d.runTacticalEdgeHits + edgeHits);
    d.runTacticalEdgeDamagePct = Math.max(d.runTacticalEdgeDamagePct, edgePct);
    d.runTacticalEdgeLabel = "破招追击";
    line += `，追击 +${edgeHits}`;
  }
  if (streak >= 3) {
    d.runMomentum = Math.min(3, d.runMomentum + 1);
    line += "，战势 +1";
  }
  if (streak >= 4) {
    const shield = Math.max(6, Math.floor(d.playerMax * (0.035 + streak * 0.006)));
    d.runShield = Math.min(d.playerMax, d.runShield + shield);
    line += `，护盾 +${shield}`;
  }
  if (streak >= 6) {
    d.duelFervor = Math.min(100, d.duelFervor + 18);
    line += "，战意 +18";
  }
  d.runCounterTempoLast = `${line}。`;
  pushDamageFloat(0.5, 0.22, `破招${streak}`, "dmg-special");
  return d.runCounterTempoLast;
}

function bankCounterTempoRebound(state: GameState, streak: number, reason: string, now: number): string {
  const d = state.dungeon;
  if (
    streak < 3 ||
    !d.active ||
    !d.runInCombat ||
    !d.runEnemy ||
    d.runOpportunity ||
    d.runPendingRewards.length > 0 ||
    d.runPendingRoutes.length > 0 ||
    d.runPendingEvent
  ) {
    return "";
  }
  const power = Math.max(1, Math.min(3, Math.floor(streak / 2)));
  const action: DungeonRunOpportunityAction = d.runFinisherCharge >= 75 ? "finisher" : "skill";
  const untilMs = now + 3600 + power * 450;
  d.runOpportunity = {
    action,
    title: "破招回响",
    desc:
      action === "finisher"
        ? `连势被${reason}打断，余威反卷。立刻终结可把断连转成追击。`
        : `连势被${reason}打断，余威反卷。立刻心法技可把断连转成追击。`,
    untilMs,
    rewardZhuLingEssence: 3 + power * 4,
    rewardFinisherCharge: action === "finisher" ? 8 + power * 5 : 14 + power * 6,
    rewardStamina: 8 + power * 5,
    damagePct: 0.62 + power * 0.18,
    source: "counter_tempo_rebound",
    sourcePower: power,
  };
  d.runOpportunityNextAtMs = Math.max(d.runOpportunityNextAtMs, untilMs + 2400);
  return `破招回响 x${power} 出现：${action === "finisher" ? "终结技" : "心法技"}可反卷断连。`;
}

function breakRunCounterTempo(state: GameState, reason: string, now = Date.now()): string {
  const d = state.dungeon;
  const streak = Math.max(0, Math.floor(d.runCounterTempoStreak));
  if (streak <= 0) {
    d.runCounterChain = 0;
    return "";
  }
  d.runCounterTempoStreak = 0;
  d.runCounterChain = 0;
  const reboundLine = bankCounterTempoRebound(state, streak, reason, now);
  d.runCounterTempoLast = `破招断连：${reason}，止于 x${streak}。${reboundLine ? ` ${reboundLine}` : ""}`;
  return d.runCounterTempoLast;
}

function bankRunCounterTempoPrize(state: GameState): string {
  const d = state.dungeon;
  const peak = Math.max(d.runCounterTempoPeak, d.runCounterTempoStreak);
  d.runCounterTempoStreak = 0;
  d.runCounterTempoPeak = 0;
  d.runCounterChain = 0;
  if (peak < 2) return "";
  const prize = Math.min(3, Math.max(1, Math.floor(peak / 2)));
  d.runCounterTempoPrize = Math.max(d.runCounterTempoPrize, prize);
  d.runCounterTempoPrizeLast = `破招战利品 x${d.runCounterTempoPrize} 已注入：下一次奖励选择会带入追击节奏。`;
  pushDamageFloat(0.52, 0.2, `战利${d.runCounterTempoPrize}`, "dmg-special");
  return d.runCounterTempoPrizeLast;
}

function bankRunClutchPrize(state: GameState): string {
  const d = state.dungeon;
  const hpPct = d.playerMax > 0 ? d.playerHp / d.playerMax : 1;
  if (hpPct > 0.35 && !(d.runLastStandUsed && hpPct <= 0.5)) return "";
  const power = d.runLastStandUsed && hpPct <= 0.5 ? 3 : hpPct <= 0.15 ? 3 : hpPct <= 0.25 ? 2 : 1;
  d.runClutchPrize = Math.max(d.runClutchPrize, power);
  d.runClutchPrizeLast = `险境翻盘 x${d.runClutchPrize} 已蓄：下一次战利品三选一会返还护命节奏。`;
  pushDamageFloat(0.48, 0.2, `翻盘${d.runClutchPrize}`, "dmg-special");
  return d.runClutchPrizeLast;
}

function delayEnemyIntent(enemy: DungeonRunEnemy, now: number, extraMs = COUNTER_STAGGER_MS): void {
  enemy.intentAtMs = Math.max(enemy.intentAtMs, now + extraMs);
  enemy.nextIntentAtMs = enemy.intentAtMs + 700;
}

function rewardBossOmenChain(
  state: GameState,
  omen: DungeonBossOmen,
  action: "dodge" | "skill" | "finisher",
): string {
  const d = state.dungeon;
  d.runBossOmenStreak = Math.min(3, Math.max(0, d.runBossOmenStreak) + 1);
  d.runBossOmenPeak = Math.max(d.runBossOmenPeak, d.runBossOmenStreak);
  const streak = d.runBossOmenStreak;
  const omenLabel = bossOmenName(omen);
  if (streak <= 1) {
    d.runBossOmenLast = `${omenLabel}反制连破 x1：继续读招可滚起镇域追击。`;
    return d.runBossOmenLast;
  }
  const edgeHits = Math.min(5, (action === "finisher" ? 2 : 1) + streak);
  const edgePct = Math.min(0.22, 0.07 + streak * 0.035);
  const shield = Math.max(8, Math.floor(d.playerMax * (0.025 + streak * 0.018)));
  const threatCut = Math.min(6, 2 + streak);
  d.runTacticalEdgeHits = Math.min(9, d.runTacticalEdgeHits + edgeHits);
  d.runTacticalEdgeDamagePct = Math.max(d.runTacticalEdgeDamagePct, edgePct);
  d.runTacticalEdgeLabel = "劫兆追击";
  d.runShield = Math.min(d.playerMax, d.runShield + shield);
  d.runFinisherCharge = Math.min(100, d.runFinisherCharge + (streak >= 3 ? 14 : 6));
  if (streak >= 3) d.duelFervor = Math.min(100, d.duelFervor + 28);
  applyRunThreatDelta(state, -threatCut);
  d.runBossOmenLast = `劫兆连破 x${streak}：追击 +${edgeHits}，护盾 +${shield}，劫压 -${threatCut}${
    streak >= 3 ? "，战意 +28" : ""
  }。`;
  pushDamageFloat(0.54, 0.22, `连破${streak}`, "dmg-special");
  return d.runBossOmenLast;
}

function counterBossOmen(state: GameState, action: "dodge" | "skill" | "finisher", now: number): string {
  const d = state.dungeon;
  const e = d.runEnemy;
  if (!e || e.role !== "boss" || d.runBossOmen === "none" || now > d.runBossOmenUntilMs) return "";
  const omen = d.runBossOmen;
  const ok =
    (omen === "heaven-strike" && action === "dodge") ||
    (omen === "soul-drain" && action === "skill") ||
    (omen === "inferno" && action === "finisher");
  if (!ok) return "";
  clearBossOmen(state);
  delayEnemyIntent(e, now, 1700);
  d.runFinisherCharge = Math.min(100, d.runFinisherCharge + (action === "finisher" ? 18 : 26));
  const zhu = 5 + d.runBossPhase * 3;
  state.zhuLingEssence += zhu;
  d.runEssenceGained += zhu;
  strikeBossPosture(state, action === "finisher" ? 52 : 36, now, `${bossOmenName(omen)}反制`);
  const warrantLine = progressRunWarrant(state, "boss_omens");
  const styleLine = gainRunStyle(state, action === "finisher" ? 3 : 2, `${bossOmenName(omen)}反制`);
  const chainLine = rewardBossOmenChain(state, omen, action);
  pushDamageFloat(0.54, 0.24, "反制", "dmg-special");
  return `${bossOmenName(omen)}反制：筑灵髓 +${zhu}，终结 +${action === "finisher" ? 18 : 26}。${
    styleLine ? ` ${styleLine}` : ""
  }${chainLine ? ` ${chainLine}` : ""}${warrantLine ? ` ${warrantLine}` : ""}`;
}

function updateBossPhaseAndOmen(state: GameState, now: number): void {
  const d = state.dungeon;
  const e = d.runEnemy;
  if (!e || e.role !== "boss" || d.runBossOmen !== "none") return;
  const pct = e.hp / Math.max(1, e.maxHp);
  if (d.runBossPhase < 2 && pct <= 0.66) {
    setBossOmen(state, "soul-drain", 2, now);
  } else if (d.runBossPhase < 3 && pct <= 0.33) {
    setBossOmen(state, "inferno", 3, now);
  }
}

function resolveBossOmenFailure(state: GameState, now: number): boolean {
  const d = state.dungeon;
  const e = d.runEnemy;
  if (!e || e.role !== "boss" || d.runBossOmen === "none" || now < d.runBossOmenUntilMs) return false;
  const omen = d.runBossOmen;
  clearBossOmen(state);
  if (d.runBossOmenStreak > 0) {
    d.runBossOmenLast = `劫兆断连：${bossOmenName(omen)}未反制，连破止于 x${d.runBossOmenStreak}。`;
  } else {
    d.runBossOmenLast = `劫兆失手：${bossOmenName(omen)}未反制。`;
  }
  d.runBossOmenStreak = 0;
  if (omen === "heaven-strike") {
    const incoming = Math.floor(d.playerMax * 0.18 * (1 + e.enrage));
    const shielded = Math.min(d.runShield, incoming);
    d.runShield -= shielded;
    d.playerHp -= incoming - shielded;
    d.duelComboStacks = 0;
    d.runLog = `天坠落定：护盾抵消 ${shielded}，生命损失 ${incoming - shielded}。`;
    pushDamageFloat(0.48, 0.48, `-${Math.max(0, incoming - shielded)}`, incoming > shielded ? "dmg-in" : "dmg-miss");
  } else if (omen === "soul-drain") {
    const drain = Math.min(state.zhuLingEssence, 10 + d.runNodeIndex * 2);
    state.zhuLingEssence -= drain;
    e.hp = Math.min(e.maxHp, e.hp + drain * 7);
    e.block += Math.floor(e.maxHp * 0.07);
    d.runLog = `摄魂成形：被夺走 ${drain} 筑灵髓，首领回稳并结盾。`;
    pushDamageFloat(0.54, 0.35, "摄魂", "dmg-special");
  } else if (omen === "inferno") {
    e.enrage += 0.22;
    e.block += Math.floor(e.maxHp * 0.12);
    applyRunThreatDelta(state, 6);
    d.runLog = "劫焰爆开：首领伤害上升，劫压 +6。";
    pushDamageFloat(0.54, 0.35, "劫焰", "dmg-special");
  }
  if (d.playerHp <= 0) {
    if (!d.runLastStandUsed) {
      d.runLastStandUsed = true;
      d.playerHp = 1;
      state.combatHpCurrent = 1;
      d.runInCombat = false;
      d.runPendingEvent = withEventBuildHints(state, buildLastStandEvent(state, 0));
      d.runLog = "濒死逆命：选择一次救场代价，决定这局是否还能翻盘。";
      delayEnemyIntent(e, now, 2200);
      syncEnemyBars(state);
      return true;
    }
    finishRun(state, false);
    return true;
  }
  delayEnemyIntent(e, now, 900);
  syncEnemyBars(state);
  return true;
}

function objectiveRewardParts(state: GameState, obj: DungeonRunObjective): string[] {
  const d = state.dungeon;
  const parts = [`筑灵髓 +${obj.rewardZhuLingEssence}`, `灵砂 +${obj.rewardLingSha}`];
  if ((obj.rewardFinisherCharge ?? 0) > 0) parts.push(`终结 +${obj.rewardFinisherCharge}`);
  if ((obj.rewardRerolls ?? 0) > 0) parts.push(`重掷 +${obj.rewardRerolls}`);
  if ((obj.rewardShieldPct ?? 0) > 0) parts.push(`护盾 +${Math.floor(d.playerMax * obj.rewardShieldPct!)}`);
  if ((obj.rewardStyle ?? 0) > 0) parts.push(`身法 +${obj.rewardStyle}`);
  if ((obj.rewardThreatDelta ?? 0) !== 0) parts.push(`劫压 ${obj.rewardThreatDelta! > 0 ? "+" : ""}${obj.rewardThreatDelta}`);
  return parts;
}

function progressRunObjective(state: GameState, kind: DungeonRunObjectiveKind, amount = 1, now = Date.now()): string {
  const d = state.dungeon;
  const obj = d.runObjective;
  if (!obj || obj.completed || obj.failed || obj.kind !== kind) return "";
  if (obj.timeLimitMs && now - obj.startedAtMs > obj.timeLimitMs) return "";
  obj.progress = Math.min(obj.target, obj.progress + amount);
  if (obj.progress < obj.target) return "";
  obj.completed = true;
  d.runObjectiveStreak = Math.min(5, d.runObjectiveStreak + 1);
  d.runObjectivePeak = Math.max(d.runObjectivePeak, d.runObjectiveStreak);
  const streak = d.runObjectiveStreak;
  const depth = Math.max(1, d.runNodeIndex + 1);
  const streakZhu = streak > 1 ? Math.floor((3 + depth) * (streak - 1) * runThreatRewardMult(state)) : 0;
  const streakFinisher = streak > 1 ? Math.min(30, 6 * (streak - 1)) : 0;
  const streakFervor = 16 + Math.min(24, streak * 4);
  const edgeHits = Math.min(8, 2 + streak);
  const edgePct = Math.min(0.55, 0.16 + streak * 0.04);
  d.runTacticalEdgeHits = Math.max(d.runTacticalEdgeHits, edgeHits);
  d.runTacticalEdgeDamagePct = Math.max(d.runTacticalEdgeDamagePct, edgePct);
  d.runTacticalEdgeLabel = streak >= 3 ? "锋芒追击" : "战术追击";
  applyRunThreatDelta(state, obj.rewardThreatDelta ?? -5);
  state.zhuLingEssence += obj.rewardZhuLingEssence + streakZhu;
  state.lingSha += obj.rewardLingSha;
  d.runEssenceGained += obj.rewardZhuLingEssence + streakZhu;
  if ((obj.rewardFinisherCharge ?? 0) > 0 || streakFinisher > 0) {
    d.runFinisherCharge = Math.min(100, d.runFinisherCharge + (obj.rewardFinisherCharge ?? 0) + streakFinisher);
  }
  if ((obj.rewardRerolls ?? 0) > 0) d.runRewardRerolls = Math.min(2, d.runRewardRerolls + obj.rewardRerolls!);
  if ((obj.rewardShieldPct ?? 0) > 0) d.runShield = Math.min(d.playerMax, d.runShield + Math.floor(d.playerMax * obj.rewardShieldPct!));
  if ((obj.rewardStyle ?? 0) > 0) {
    d.runStyleStreak = Math.min(12, d.runStyleStreak + obj.rewardStyle!);
    d.runStylePeak = Math.max(d.runStylePeak, d.runStyleStreak);
  }
  d.duelFervor = Math.min(100, d.duelFervor + streakFervor);
  const pledgeLine = completeRoutePledge(state, obj);
  const streakText =
    streak > 1
      ? ` 战术锋芒 x${streak}：筑灵髓 +${streakZhu}${streakFinisher > 0 ? `，终结 +${streakFinisher}` : ""}，战意 +${streakFervor}。`
      : ` 战意 +${streakFervor}。`;
  const edgeText = ` 追击 ${edgeHits} 击 +${Math.round(edgePct * 100)}%。`;
  const pledgeText = pledgeLine ? ` ${pledgeLine}` : "";
  const line = `战术达成：${obj.title}。${objectiveRewardParts(state, obj).join("；")}。${streakText}${edgeText}${pledgeText}`;
  d.runLog = line;
  pushDamageFloat(0.5, 0.32, "战术", "dmg-special");
  pushDamageFloat(0.56, 0.28, `锋${streak}`, "dmg-special");
  if ((obj.rewardFinisherCharge ?? 0) > 0 || streakFinisher > 0) {
    pushDamageFloat(0.58, 0.3, `终+${(obj.rewardFinisherCharge ?? 0) + streakFinisher}`, "dmg-special");
  }
  return line;
}

function completeRoutePledge(state: GameState, obj: DungeonRunObjective): string {
  const plan = obj.routePlan;
  if (!plan) return "";
  const d = state.dungeon;
  d.runRoutePledgeStreak = Math.min(9, d.runRoutePledgeStreak + 1);
  d.runRoutePledgePeak = Math.max(d.runRoutePledgePeak, d.runRoutePledgeStreak);
  const streak = d.runRoutePledgeStreak;
  let line = "";
  if (plan === "tempo") {
    const hits = Math.min(6, 2 + streak);
    const pct = Math.min(0.18, 0.06 + streak * 0.02);
    d.runTacticalEdgeHits = Math.min(9, d.runTacticalEdgeHits + hits);
    d.runTacticalEdgeDamagePct = Math.max(d.runTacticalEdgeDamagePct, pct);
    d.runTacticalEdgeLabel = "承诺追击";
    d.runFinisherCharge = Math.min(100, d.runFinisherCharge + 8 + streak * 3);
    line = `承诺连段 x${streak}：疾攻兑现，追击 +${hits}，终结 +${8 + streak * 3}。`;
  } else if (plan === "risk") {
    const zhu = Math.floor((4 + streak * 3) * runThreatRewardMult(state));
    state.zhuLingEssence += zhu;
    state.lingSha += 1;
    d.runEssenceGained += zhu;
    d.runRewardRerolls = Math.min(2, d.runRewardRerolls + (streak >= 2 ? 1 : 0));
    line = `承诺连段 x${streak}：险搏兑现，筑灵髓 +${zhu}，灵砂 +1${streak >= 2 ? "，重掷 +1" : ""}。`;
  } else if (plan === "safe") {
    const shield = Math.floor(d.playerMax * (0.08 + Math.min(0.08, streak * 0.02)));
    d.runShield = Math.min(d.playerMax, d.runShield + shield);
    applyRunThreatDelta(state, -2 - Math.min(3, streak));
    line = `承诺连段 x${streak}：稳阵兑现，护盾 +${shield}，劫压 -${2 + Math.min(3, streak)}。`;
  } else {
    const zhu = 3 + streak * 2;
    state.zhuLingEssence += zhu;
    d.runEssenceGained += zhu;
    d.runRewardRerolls = Math.min(2, d.runRewardRerolls + 1);
    line = `承诺连段 x${streak}：探秘兑现，筑灵髓 +${zhu}，重掷 +1。`;
  }
  d.runRoutePledgeLast = line;
  pushDamageFloat(0.54, 0.2, `承${streak}`, "dmg-special");
  return line;
}

function expireRunObjective(state: GameState, now: number): void {
  const d = state.dungeon;
  const obj = d.runObjective;
  if (!obj || obj.completed || obj.failed || !obj.timeLimitMs) return;
  if (now - obj.startedAtMs <= obj.timeLimitMs) return;
  obj.failed = true;
  const brokenStreak = d.runObjectiveStreak;
  d.runObjectiveStreak = 0;
  d.runTacticalEdgeHits = 0;
  d.runTacticalEdgeDamagePct = 0;
  d.runTacticalEdgeLabel = "";
  d.runTacticalEdgeLastEcho = "";
  d.runTacticalEdgeChain = 0;
  const brokenPledge = obj.routePlan ? d.runRoutePledgeStreak : 0;
  if (obj.routePlan) {
    d.runRoutePledgeStreak = 0;
    d.runRoutePledgeLast = `承诺断连：${obj.title}未完成。`;
  }
  const reprisalText = bankPledgeReprisal(state, brokenPledge, obj.title);
  applyRunThreatDelta(state, 3);
  d.runMomentum = Math.max(0, d.runMomentum - 1);
  trimRunStyle(state, 2);
  d.runLog = `战术失手：${obj.title}，劫压 +3${brokenStreak > 1 ? `，锋芒断在 x${brokenStreak}` : ""}${brokenPledge > 0 ? `，承诺断在 x${brokenPledge}` : ""}。${reprisalText}`;
  pushDamageFloat(0.5, 0.32, "失手", "dmg-special");
}

function settleMissedRunObjective(state: GameState): string {
  const d = state.dungeon;
  const obj = d.runObjective;
  if (!obj || obj.completed || obj.failed) return "";
  obj.failed = true;
  const brokenStreak = d.runObjectiveStreak;
  d.runObjectiveStreak = 0;
  d.runTacticalEdgeHits = 0;
  d.runTacticalEdgeDamagePct = 0;
  d.runTacticalEdgeLabel = "";
  d.runTacticalEdgeLastEcho = "";
  d.runTacticalEdgeChain = 0;
  const brokenPledge = obj.routePlan ? d.runRoutePledgeStreak : 0;
  if (obj.routePlan) {
    d.runRoutePledgeStreak = 0;
    d.runRoutePledgeLast = `承诺旁落：${obj.title}未完成。`;
  }
  const reprisalText = bankPledgeReprisal(state, brokenPledge, obj.title);
  if (brokenStreak <= 0 && brokenPledge <= 0) return `战术旁落：${obj.title}未完成。`;
  applyRunThreatDelta(state, 1);
  return `战术旁落：${obj.title}未完成${brokenStreak > 0 ? `，锋芒断在 x${brokenStreak}` : ""}${brokenPledge > 0 ? `，承诺断在 x${brokenPledge}` : ""}，劫压 +1。${reprisalText}`;
}

function combatGradeLabel(grade: DungeonRunCombatGrade): string {
  if (grade === "s") return "S";
  if (grade === "a") return "A";
  if (grade === "b") return "B";
  if (grade === "c") return "C";
  return "-";
}

function settleCombatGrade(state: GameState, boss: boolean): string {
  const d = state.dungeon;
  const hpPct = d.playerMax > 0 ? d.playerHp / d.playerMax : 0;
  const staminaPct = d.stamina / DUNGEON_STAMINA_MAX;
  const objectiveBonus = d.runObjective?.completed ? 18 : 0;
  const comboBonus = Math.min(12, d.duelComboStacks * 1.2);
  const styleBonus = Math.min(10, d.runStylePeak * 1.35);
  const threatBonus = Math.min(10, d.runThreat * 0.1);
  const bossBonus = boss ? 4 : 0;
  const score = Math.max(
    0,
    Math.min(100, Math.floor(34 + hpPct * 24 + staminaPct * 12 + objectiveBonus + comboBonus + styleBonus + threatBonus + bossBonus)),
  );
  const grade: DungeonRunCombatGrade = score >= 88 ? "s" : score >= 76 ? "a" : score >= 62 ? "b" : "c";
  const bonusPct = grade === "s" ? 0.46 : grade === "a" ? 0.3 : grade === "b" ? 0.16 : 0.06;
  const depth = Math.max(1, d.runNodeIndex + 1);
  const zhuBonus = Math.max(1, Math.floor((8 + depth * 3) * bonusPct * runThreatRewardMult(state)));
  const shaBonus = grade === "s" ? 3 : grade === "a" ? 2 : grade === "b" ? 1 : 0;
  state.zhuLingEssence += zhuBonus;
  state.lingSha += shaBonus;
  d.runEssenceGained += zhuBonus;
  d.runLastGrade = grade;
  d.runLastScore = score;
  if (grade === "s") d.runRewardRerolls = Math.min(2, d.runRewardRerolls + 1);
  pushDamageFloat(0.54, 0.3, `评${combatGradeLabel(grade)}`, "dmg-special");
  return `评分 ${combatGradeLabel(grade)}(${score})：筑灵髓 +${zhuBonus}${shaBonus > 0 ? `，灵砂 +${shaBonus}` : ""}${d.runStylePeak > 0 ? `，身法峰值 ${d.runStylePeak}` : ""}`;
}

function advanceRunMomentum(state: GameState): string {
  const d = state.dungeon;
  const objectiveDone = !!d.runObjective?.completed;
  let gain = 0;
  if (d.runLastGrade === "s") gain += 2;
  else if (d.runLastGrade === "a") gain += 1;
  if (objectiveDone) gain += 1;
  if (gain <= 0) {
    if (d.runLastGrade === "c" && !objectiveDone) d.runMomentum = Math.max(0, d.runMomentum - 1);
    return d.runLastGrade === "c" && !objectiveDone ? "战势 -1" : "";
  }
  d.runMomentum = Math.min(3, d.runMomentum + Math.min(2, gain));
  if (d.runMomentum < 3) return `战势 +${Math.min(2, gain)}（${d.runMomentum}/3）`;
  d.runMomentum = 0;
  const depth = Math.max(1, d.runNodeIndex + 1);
  const zhu = Math.floor((10 + depth * 3) * runThreatRewardMult(state));
  state.zhuLingEssence += zhu;
  state.lingSha += 1;
  d.runEssenceGained += zhu;
  d.runRewardRerolls = Math.min(2, d.runRewardRerolls + 1);
  d.runFinisherCharge = Math.min(100, d.runFinisherCharge + 35);
  applyRunThreatDelta(state, -4);
  pushDamageFloat(0.5, 0.24, "乘胜", "dmg-special");
  pushDamageFloat(0.56, 0.34, `+${zhu}`, "dmg-special");
  return `乘胜追击：筑灵髓 +${zhu}，灵砂 +1，重掷 +1，终结 +35，劫压 -4`;
}

function applyEnemyRoleTrophy(state: GameState, role: DungeonRunEnemyRole, elite: boolean, boss: boolean): string {
  const d = state.dungeon;
  const depth = Math.max(1, d.runNodeIndex + 1);
  if (role === "guard") {
    const zhu = Math.floor((4 + depth * 2 + (elite ? 4 : 0)) * runThreatRewardMult(state));
    const finisher = elite ? 24 : 16;
    state.zhuLingEssence += zhu;
    d.runEssenceGained += zhu;
    d.runFinisherCharge = Math.min(100, d.runFinisherCharge + finisher);
    bankRoleEcho(state, role, elite);
    pushDamageFloat(0.58, 0.28, "破甲", "dmg-special");
    return `护卫战果：破甲灵纹，筑灵髓 +${zhu}，终结 +${finisher}，下场留破甲残响。`;
  }
  if (role === "drain") {
    const zhu = Math.floor((8 + depth * 2) * runThreatRewardMult(state));
    state.zhuLingEssence += zhu;
    state.lingSha += 1;
    d.runEssenceGained += zhu;
    applyRunThreatDelta(state, -3);
    bankRoleEcho(state, role, elite);
    pushDamageFloat(0.58, 0.28, "返灵", "dmg-special");
    return `汲灵战果：夺回灵髓，筑灵髓 +${zhu}，灵砂 +1，劫压 -3，下场留返灵残响。`;
  }
  if (role === "ranged") {
    const styleLine = gainRunStyle(state, 2, "远程战果");
    d.stamina = Math.min(DUNGEON_STAMINA_MAX, d.stamina + 18);
    d.runFinisherCharge = Math.min(100, d.runFinisherCharge + 8);
    bankRoleEcho(state, role, elite);
    return `${styleLine} 贴身追击：体力 +18，终结 +8，下场留身法残响。`;
  }
  if (role === "boss" || boss) {
    state.lingSha += 2;
    d.runRewardRerolls = Math.min(2, d.runRewardRerolls + 1);
    d.runFinisherCharge = Math.min(100, d.runFinisherCharge + 25);
    pushDamageFloat(0.58, 0.28, "镇域", "dmg-special");
    return "首领战果：镇域余辉，灵砂 +2，重掷 +1，终结 +25。";
  }
  const shield = Math.max(8, Math.floor(d.playerMax * (elite ? 0.12 : 0.08)));
  const heal = Math.max(4, Math.floor(d.playerMax * 0.05));
  d.runShield = Math.min(d.playerMax, d.runShield + shield);
  d.playerHp = Math.min(d.playerMax, d.playerHp + heal);
  bankRoleEcho(state, role, elite);
  pushDamageFloat(0.58, 0.28, "护身", "dmg-special");
  return `近战战果：护身余劲，护盾 +${shield}，生命 +${heal}，下场留护身残响。`;
}

function bankRoleEcho(state: GameState, role: DungeonRunEnemyRole, elite: boolean): void {
  if (role === "boss") return;
  const d = state.dungeon;
  const nextPower = d.runRoleEcho === role ? d.runRoleEchoPower + 1 : 1;
  d.runRoleEcho = role;
  d.runRoleEchoPower = Math.min(3, nextPower + (elite ? 1 : 0));
  d.runRoleEchoLast = "";
}

function applyRoleEchoStart(state: GameState, enemy: DungeonRunEnemy, now: number): string {
  const d = state.dungeon;
  const role = d.runRoleEcho;
  const power = Math.max(0, Math.min(3, Math.floor(d.runRoleEchoPower)));
  if (!role || power <= 0) return "";
  d.runRoleEcho = null;
  d.runRoleEchoPower = 0;
  let line = "";
  if (role === "guard") {
    const hits = 1 + power;
    const pct = Math.min(0.12, 0.04 + power * 0.02);
    d.runTacticalEdgeHits = Math.min(9, d.runTacticalEdgeHits + hits);
    d.runTacticalEdgeDamagePct = Math.max(d.runTacticalEdgeDamagePct, pct);
    d.runTacticalEdgeLabel = "破甲残响";
    d.runFinisherCharge = Math.min(100, d.runFinisherCharge + 6 + power * 4);
    line = `破甲残响 x${power}：开局追击 +${hits}，终结 +${6 + power * 4}。`;
  } else if (role === "drain") {
    const zhu = Math.floor((4 + power * 4) * runThreatRewardMult(state));
    state.zhuLingEssence += zhu;
    d.runEssenceGained += zhu;
    applyRunThreatDelta(state, -power);
    line = `返灵残响 x${power}：筑灵髓 +${zhu}，劫压 -${power}。`;
  } else if (role === "ranged") {
    const stamina = 12 + power * 8;
    d.stamina = Math.min(DUNGEON_STAMINA_MAX, d.stamina + stamina);
    d.dodgeIframesUntil = Math.max(d.dodgeIframesUntil, now + 120 + power * 120);
    const styleLine = gainRunStyle(state, 1, "身法残响");
    line = `身法残响 x${power}：体力 +${stamina}，开局流转。${styleLine ? ` ${styleLine}` : ""}`;
  } else {
    const shield = Math.max(8, Math.floor(d.playerMax * (0.05 + power * 0.025)));
    const heal = Math.max(4, Math.floor(d.playerMax * (0.025 + power * 0.012)));
    d.runShield = Math.min(d.playerMax, d.runShield + shield);
    d.playerHp = Math.min(d.playerMax, d.playerHp + heal);
    state.combatHpCurrent = d.playerHp;
    line = `护身残响 x${power}：护盾 +${shield}，生命 +${heal}。`;
  }
  d.runRoleEchoLast = line;
  pushDamageFloat(0.5, 0.22, "残响", "dmg-special");
  if (enemy.role === "boss") d.runFinisherCharge = Math.min(100, d.runFinisherCharge + power * 4);
  return line;
}

function completeCombatNode(state: GameState, now: number): void {
  const d = state.dungeon;
  const node = d.runNodes[d.runNodeIndex];
  const boss = node?.type === "boss";
  const elite = node?.type === "elite";
  const defeatedRole = d.runEnemy?.role ?? (boss ? "boss" : "melee");
  const objectiveLine = progressRunObjective(state, "fast_kill", 1, now);
  const missedObjectiveLine = objectiveLine ? "" : settleMissedRunObjective(state);
  const totals = runBlessingTotals(state);
  const zhu = Math.floor((boss ? 34 : 9 + d.runNodeIndex * 2) * (1 + totals.rewardPct) * runThreatRewardMult(state));
  state.zhuLingEssence += zhu;
  d.runEssenceGained += zhu;
  d.sessionEssence += zhu;
  d.sessionKills += 1;
  d.runKills += 1;
  const warrantLine = progressRunWarrant(state, "clear_nodes");
  const gradeLine = settleCombatGrade(state, boss);
  const momentumLine = advanceRunMomentum(state);
  const trophyLine = applyEnemyRoleTrophy(state, defeatedRole, !!elite, !!boss);
  const roleReadPrizeLine = bankRunRoleReadPrize(state, defeatedRole);
  const clutchPrizeLine = bankRunClutchPrize(state);
  const counterTempoPrizeLine = bankRunCounterTempoPrize(state);
  d.runInCombat = false;
  d.runEnemy = null;
  d.mobs = [];
  d.packKilled = 1;
  d.monsterHp = 0;
  d.monsterMax = 0;
  if (boss) {
    if (node) node.cleared = true;
    d.maxWaveRecord = Math.max(d.maxWaveRecord, d.runNodeIndex + 1 + d.runsCompleted * 6);
    d.totalWavesCleared = Math.max(d.totalWavesCleared, d.maxWaveRecord);
    noteWeeklyBountyWave(state, now);
    d.runNodeIndex += 1;
    finishRun(state, true);
    return;
  }
  if (state.dungeon.runBlessings.includes("wood_regrowth") || state.dungeon.runBlessings.includes("wood_lifebloom")) {
    d.playerHp = Math.min(d.playerMax, d.playerHp + Math.floor(d.playerMax * 0.08));
  }
  if (elite) {
    d.runRewardRerolls = Math.min(2, d.runRewardRerolls + 1);
    state.lingSha += 2;
  }
  d.runPendingRewards = buildRunRewardOptions(state, false, elite);
  clearRunRewardLocks(state);
  const momentumText = momentumLine ? ` ${momentumLine}。` : "";
  const warrantText = warrantLine ? ` ${warrantLine}` : "";
  const trophyText = trophyLine ? ` ${trophyLine}` : "";
  const roleReadPrizeText = roleReadPrizeLine ? ` ${roleReadPrizeLine}` : "";
  const clutchPrizeText = clutchPrizeLine ? ` ${clutchPrizeLine}` : "";
  const counterTempoPrizeText = counterTempoPrizeLine ? ` ${counterTempoPrizeLine}` : "";
  const objectiveText = objectiveLine ? ` ${objectiveLine}` : missedObjectiveLine ? ` ${missedObjectiveLine}` : "";
  d.runLog = elite
    ? `精英击破：筑灵髓 +${zhu}，灵砂 +2，重掷 +1。${gradeLine}。${momentumText}${objectiveText}${trophyText}${roleReadPrizeText}${clutchPrizeText}${warrantText} 选择强化战利品。`
    : `节点清理：筑灵髓 +${zhu}。${gradeLine}。${momentumText}${objectiveText}${trophyText}${roleReadPrizeText}${clutchPrizeText}${warrantText} 选择一项灵印或资源。`;
  appendRunLine(state, counterTempoPrizeLine);
  appendRunLine(state, roleReadPrizeLine);
  appendRunLine(state, clutchPrizeLine);
}

function processPlayerActions(state: GameState, now: number): void {
  const d = state.dungeon;
  const e = d.runEnemy;
  if (!e) return;
  const totals = runBlessingTotals(state);
  if (d.dodgeQueued) {
    d.dodgeQueued = false;
    if (d.stamina >= DUNGEON_DODGE_STAMINA_COST) {
      d.stamina -= DUNGEON_DODGE_STAMINA_COST;
      d.dodgeIframesUntil = now + DUNGEON_DODGE_IFRAMES_MS;
      d.stamina = Math.min(DUNGEON_STAMINA_MAX, d.stamina + totals.dodgeRefund);
      d.runFinisherCharge = Math.min(100, d.runFinisherCharge + 13);
      d.runLog = e.intent === "attack" ? "化劲成功：避开攻势并积蓄战意。" : "身法展开：获得短暂无敌。";
      pushDamageFloat(0.48, 0.5, "化劲", "dmg-miss");
      if (state.dungeon.runBlessings.includes("water_mirror")) {
        applyDamageToEnemy(state, playerRunDamage(state) * 0.55, "返 ");
      }
    } else {
      d.runLog = "体力不足，无法闪避。";
    }
  }
  if (d.runSkillQueued) {
    d.runSkillQueued = false;
    if (now < d.runSkillCooldownUntil) {
      d.runLog = "心法技尚在回息。";
    } else {
      const dom = dominantRunElement(state);
      const cd = Math.floor(6400 * (1 - Math.min(0.45, totals.skillHastePct)));
      d.runSkillCooldownUntil = now + cd;
      if (dom === "wood") {
        const heal = Math.floor(d.playerMax * (state.dungeon.runBlessings.includes("wood_lifebloom") ? 0.24 : 0.16));
        d.playerHp = Math.min(d.playerMax, d.playerHp + heal);
        applyDamageToEnemy(state, playerRunDamage(state) * 0.72, "生 ");
        d.runLog = `木系心法：恢复 ${heal} 生命并反击。`;
      } else if (dom === "earth") {
        const shield = Math.floor(d.playerMax * 0.22);
        d.runShield += shield;
        applyDamageToEnemy(state, playerRunDamage(state) * 0.65, "震 ");
        d.runLog = `土系心法：护盾 +${shield}。`;
      } else if (dom === "water") {
        d.dodgeIframesUntil = Math.max(d.dodgeIframesUntil, now + 900);
        d.stamina = Math.min(DUNGEON_STAMINA_MAX, d.stamina + 24);
        applyDamageToEnemy(state, playerRunDamage(state) * 0.78, "流 ");
        d.runLog = "水系心法：短暂无敌并回复体力。";
      } else if (dom === "metal") {
        e.block = Math.max(0, e.block - 9999);
        applyDamageToEnemy(state, playerRunDamage(state) * 1.05, "破 ");
        d.runLog = "金系心法：破开护势。";
      } else {
        applyDamageToEnemy(state, playerRunDamage(state) * 1.28, "焚 ");
        d.runLog = "火系心法：爆发伤害。";
      }
    }
  }
  if (d.runFinisherQueued) {
    d.runFinisherQueued = false;
    if (d.runFinisherCharge < 100) {
      d.runLog = "终结技尚未充满。";
    } else {
      d.runFinisherCharge = 0;
      const mult = state.dungeon.runBlessings.includes("metal_execution") ? 2.65 : 2.25;
      applyDamageToEnemy(state, playerRunDamage(state) * mult, "终 ");
      d.runLog = "终结技：斩开阵眼。";
    }
  }
}

function processPlayerActionsV2(state: GameState, now: number): void {
  const d = state.dungeon;
  const e = d.runEnemy;
  if (!e) return;
  const totals = runBlessingTotals(state);

  if (d.dodgeQueued) {
    d.dodgeQueued = false;
    if (d.stamina < DUNGEON_DODGE_STAMINA_COST) {
      d.runLog = "体力不足，无法闪避。";
    } else {
      d.stamina -= DUNGEON_DODGE_STAMINA_COST;
      d.dodgeIframesUntil = now + DUNGEON_DODGE_IFRAMES_MS;
      d.stamina = Math.min(DUNGEON_STAMINA_MAX, d.stamina + totals.dodgeRefund);
      d.runFinisherCharge = Math.min(100, d.runFinisherCharge + 13);
      const intentEtaMs = e.intentAtMs - now;
      const perfectDodge = e.intent === "attack" && intentEtaMs > 0 && intentEtaMs <= PERFECT_DODGE_WINDOW_MS;
      d.runLog = e.intent === "attack" ? "化劲成功：避开攻势并积蓄战意。" : "身法展开：获得短暂无敌。";
      pushDamageFloat(0.48, 0.5, perfectDodge ? "精准" : "化劲", "dmg-miss");
      const weaveLine = noteRunActionWeave(state, "dodge");
      const omenLine = counterBossOmen(state, "dodge", now);
      if (!state.dungeon.runEnemy) return;
      const opportunityLine = resolveRunOpportunity(state, "dodge", now);
      if (!state.dungeon.runEnemy) return;
      let objectiveLine = "";
      if (perfectDodge) {
        d.runFinisherCharge = Math.min(100, d.runFinisherCharge + 22);
        delayEnemyIntent(e, now);
        objectiveLine = progressRunObjective(state, "perfect_dodge", 1, now);
        applyDamageToEnemy(state, playerRunDamage(state) * 0.72, "反");
        d.runLog = "精准化劲：贴着攻势窗口闪开，立刻反击并大幅积蓄终结。";
        if (!state.dungeon.runEnemy) return;
        noteRunCounter(state, now);
        if (!state.dungeon.runEnemy) return;
        strikeBossPosture(state, 34, now, "精准化劲");
        if (!state.dungeon.runEnemy) return;
      }
      const roleCounterLine = applyRoleCounterBonus(state, "dodge", now);
      if (state.dungeon.runBlessings.includes("water_mirror")) {
        applyDamageToEnemy(state, playerRunDamage(state) * 0.55, "返");
        if (!state.dungeon.runEnemy) return;
      }
      if (omenLine) d.runLog = `${omenLine} ${d.runLog}`;
      appendRunLine(state, roleCounterLine);
      appendRunLine(state, weaveLine);
      appendRunLine(state, objectiveLine);
      appendRunLine(state, opportunityLine);
      if (perfectDodge) appendRunLine(state, gainRunStyle(state, 1, "精准化劲"));
    }
  }

  if (d.runSkillQueued) {
    d.runSkillQueued = false;
    if (now < d.runSkillCooldownUntil) {
      d.runLog = "心法技尚在回息。";
    } else {
      const dom = dominantRunElement(state);
      const cd = Math.floor(6400 * (1 - Math.min(0.45, totals.skillHastePct)));
      let counterLine = "";
      d.runSkillCooldownUntil = now + cd;
      const weaveLine = noteRunActionWeave(state, "skill");
      const omenLine = counterBossOmen(state, "skill", now);
      if (!state.dungeon.runEnemy) return;
      const opportunityLine = resolveRunOpportunity(state, "skill", now);
      if (!state.dungeon.runEnemy) return;
      if (e.intent === "guard") {
        e.block = 0;
        d.runFinisherCharge = Math.min(100, d.runFinisherCharge + 14);
        delayEnemyIntent(e, now);
        counterLine = "破开护势";
      } else if (e.intent === "drain") {
        d.runFinisherCharge = Math.min(100, d.runFinisherCharge + 18);
        delayEnemyIntent(e, now);
        counterLine = "打断汲灵";
      } else if (e.intent === "enrage") {
        e.enrage = Math.max(0, e.enrage - 0.18);
        delayEnemyIntent(e, now);
        counterLine = "压低劫火";
      }

      if (dom === "wood") {
        const heal = Math.floor(d.playerMax * (state.dungeon.runBlessings.includes("wood_lifebloom") ? 0.24 : 0.16));
        d.playerHp = Math.min(d.playerMax, d.playerHp + heal);
        applyDamageToEnemy(state, playerRunDamage(state) * (counterLine ? 0.92 : 0.72), "生");
        d.runLog = `木系心法：恢复 ${heal} 生命并反击。`;
      } else if (dom === "earth") {
        const shield = Math.floor(d.playerMax * 0.22);
        d.runShield += shield;
        applyDamageToEnemy(state, playerRunDamage(state) * (counterLine ? 0.85 : 0.65), "震");
        d.runLog = `土系心法：护盾 +${shield}。`;
      } else if (dom === "water") {
        d.dodgeIframesUntil = Math.max(d.dodgeIframesUntil, now + 900);
        d.stamina = Math.min(DUNGEON_STAMINA_MAX, d.stamina + 24);
        applyDamageToEnemy(state, playerRunDamage(state) * (counterLine ? 0.98 : 0.78), "流");
        d.runLog = "水系心法：短暂无敌并回复体力。";
      } else if (dom === "metal") {
        e.block = 0;
        applyDamageToEnemy(state, playerRunDamage(state) * (counterLine ? 1.32 : 1.05), "破");
        d.runLog = "金系心法：破开护势。";
      } else {
        applyDamageToEnemy(state, playerRunDamage(state) * (counterLine ? 1.5 : 1.28), "焚");
        d.runLog = "火系心法：爆发伤害。";
      }
      if (counterLine) d.runLog = `${counterLine}：${d.runLog}`;
      if (omenLine) d.runLog = `${omenLine} ${d.runLog}`;
      appendRunLine(state, applyRoleCounterBonus(state, "skill", now));
      appendRunLine(state, weaveLine);
      appendRunLine(state, counterLine ? progressRunObjective(state, "skill_counter", 1, now) : "");
      appendRunLine(state, opportunityLine);
      if (counterLine) appendRunLine(state, gainRunStyle(state, 1, counterLine));
      if (counterLine && state.dungeon.runEnemy) {
        noteRunCounter(state, now);
        if (!state.dungeon.runEnemy) return;
        strikeBossPosture(state, 42, now, counterLine);
      }
    }
  }

  if (d.runFervorQueued) {
    d.runFervorQueued = false;
    executeFervorSurge(state, now);
    if (!state.dungeon.runEnemy) return;
  }

  if (d.runFinisherQueued) {
    d.runFinisherQueued = false;
    if (d.runFinisherCharge < 100) {
      d.runLog = "终结技尚未充满。";
    } else {
      d.runFinisherCharge = 0;
      const weaveLine = noteRunActionWeave(state, "finisher");
      const omenLine = counterBossOmen(state, "finisher", now);
      if (!state.dungeon.runEnemy) return;
      const opportunityLine = resolveRunOpportunity(state, "finisher", now);
      if (!state.dungeon.runEnemy) return;
      const suppress = e.intent === "guard" || e.intent === "enrage" || e.hp / Math.max(1, e.maxHp) <= 0.35;
      if (suppress) {
        e.block = 0;
        e.enrage = Math.max(0, e.enrage - 0.3);
        delayEnemyIntent(e, now, 1800);
      }
      const elementFinisher = applyElementFinisherBonus(state, suppress, now);
      if (!state.dungeon.runEnemy) return;
      const roleSuppress = e.role === "guard" || e.role === "boss";
      const mult =
        (state.dungeon.runBlessings.includes("metal_execution") ? 2.65 : 2.25) +
        (suppress ? 0.45 : 0) +
        (roleSuppress ? 0.22 : 0) +
        elementFinisher.multBonus;
      const objectiveLine = progressRunObjective(state, "finisher", 1, now);
      const warrantLine = progressRunWarrant(state, "finishers");
      applyDamageToEnemy(state, playerRunDamage(state) * mult, "终");
      d.runLog = suppress ? "终结压制：斩断护势或劫火，打出重创。" : "终结技：斩开阵眼。";
      if (omenLine) d.runLog = `${omenLine} ${d.runLog}`;
      appendRunLine(state, applyRoleCounterBonus(state, "finisher", now));
      appendRunLine(state, weaveLine);
      appendRunLine(state, opportunityLine);
      appendRunLine(state, elementFinisher.line);
      appendRunLine(state, objectiveLine);
      appendRunLine(state, warrantLine);
      if (elementFinisher.postureBonus > 0 && state.dungeon.runEnemy) {
        strikeBossPosture(state, elementFinisher.postureBonus, now, "element finisher");
      }
      if (elementFinisher.styleBonus > 0) appendRunLine(state, gainRunStyle(state, elementFinisher.styleBonus, "element finisher"));
      appendRunLine(state, gainRunStyle(state, suppress ? 2 : 1, suppress ? "终结压制" : "终结收势"));
      if (suppress && state.dungeon.runEnemy) {
        noteRunCounter(state, now);
        if (!state.dungeon.runEnemy) return;
        strikeBossPosture(state, 70, now, "终结压制");
      } else if (state.dungeon.runEnemy) {
        strikeBossPosture(state, 26, now, "终结余威");
      }
    }
  }
}

function processEnemyIntent(state: GameState, now: number): void {
  const d = state.dungeon;
  const e = d.runEnemy;
  if (!e || now < e.intentAtMs) return;
  const counterTempoBreakLine = breakRunCounterTempo(state, "敌方意图生效", now);
  const roleReadBreakLine = breakRunRoleRead(state, "敌方意图生效");
  trimRunStyle(state, e.intent === "attack" ? 2 : 1);
  if (e.intent === "guard") {
    const block = Math.floor(e.maxHp * (e.role === "guard" ? 0.22 : 0.15));
    e.block += block;
    if (e.role === "guard") e.enrage = Math.min(0.55, e.enrage + 0.04);
    d.runLog = e.role === "guard" ? `${e.name} 结成厚甲护势，拖慢你的斩杀节奏。` : `${e.name} 结成护势。`;
    pushDamageFloat(0.56, 0.36, "护势", "dmg-special");
  } else if (e.intent === "drain") {
    const drain = Math.min(state.zhuLingEssence, (e.role === "drain" ? 6 : 3) + d.runNodeIndex);
    state.zhuLingEssence -= drain;
    e.hp = Math.min(e.maxHp, e.hp + drain * (e.role === "drain" ? 7 : 4));
    if (e.role === "drain") applyRunThreatDelta(state, 2);
    d.runLog = e.role === "drain" ? `${e.name} 汲走 ${drain} 筑灵髓并抬升劫压。` : `${e.name} 汲走 ${drain} 筑灵髓。`;
    pushDamageFloat(0.52, 0.36, "汲灵", "dmg-special");
  } else if (e.intent === "enrage") {
    e.enrage += e.role === "boss" ? 0.14 : 0.12;
    e.block += Math.floor(e.maxHp * (e.role === "boss" ? 0.1 : 0.08));
    d.runLog = `${e.name} 劫火上涌，下一轮更危险。`;
    pushDamageFloat(0.52, 0.36, "劫火", "dmg-special");
  } else {
    const base = (10 + d.runNodeIndex * 4 + state.realmLevel * 1.4) * (1 + e.enrage) * runThreatEnemyMult(state) * enemyAttackDamageMult(e.role);
    const incoming = Math.floor(base * elementDamageMultiplier(e.element, playerBattleElement(state)));
    if (now < d.dodgeIframesUntil) {
      d.runLog = "化劲避开了攻势。";
      pushDamageFloat(0.48, 0.52, "闪避", "dmg-miss");
    } else {
      const shielded = Math.min(d.runShield, incoming);
      d.runShield -= shielded;
      const hpDmg = incoming - shielded;
      d.playerHp -= hpDmg;
      d.duelComboStacks = 0;
      if (hpDmg > 0) d.runStyleStreak = 0;
      pushDamageFloat(0.48, 0.52, `-${Math.max(0, hpDmg)}`, hpDmg > 0 ? "dmg-in" : "dmg-miss");
      d.runLog = shielded > 0 ? `护盾抵消 ${shielded}，生命损失 ${hpDmg}。` : `受到 ${hpDmg} 伤害。`;
      if (d.playerHp <= 0) {
        if (!d.runLastStandUsed) {
          d.runLastStandUsed = true;
          d.playerHp = 1;
          state.combatHpCurrent = 1;
          d.runInCombat = false;
          appendRunLine(state, breakRunCounterTempo(state, "濒死逆命"));
          d.runPendingEvent = withEventBuildHints(state, buildLastStandEvent(state, hpDmg));
          d.runLog = "濒死逆命：选择一次救场代价，决定这局是否还能翻盘。";
          pushDamageFloat(0.48, 0.42, "逆命", "dmg-special");
          delayEnemyIntent(e, now, 2200);
          syncEnemyBars(state);
          return;
        }
        finishRun(state, false);
        return;
      }
    }
  }
  appendRunLine(state, counterTempoBreakLine);
  appendRunLine(state, roleReadBreakLine);
  nextIntent(state, e, now);
  syncEnemyBars(state);
}

export function tickDungeon(state: GameState, dt: number, now: number): void {
  const d = state.dungeon;
  if (!d.active || dt <= 0 || d.runPendingRewards.length > 0 || d.runPendingEvent || d.runPendingRoutes.length > 0) {
    return;
  }
  if (!d.runEnemy) return;
  d.playerMax = Math.max(d.playerMax, playerMaxHp(state));
  d.playerHp = Math.max(0, Math.min(d.playerMax, d.playerHp));
  d.stamina = Math.min(DUNGEON_STAMINA_MAX, d.stamina + DUNGEON_STAMINA_REGEN_PER_SEC * dt);
  expireRunOpportunity(state, now);
  expireRunObjective(state, now);
  buildRunOpportunity(state, now);
  processPlayerActionsV2(state, now);
  if (!d.active || !d.runEnemy || d.runPendingRewards.length > 0 || d.runPendingEvent || d.runPendingRoutes.length > 0) return;
  updateBossPhaseAndOmen(state, now);
  if (!d.active || !d.runEnemy || d.runPendingRewards.length > 0 || d.runPendingEvent || d.runPendingRoutes.length > 0) return;
  const interval = Math.max(0.35, PLAYER_DUNGEON_HIT_INTERVAL_SEC / playerDungeonAttackSpeedMult(state));
  d.playerAttackAccum += dt;
  while (d.playerAttackAccum >= interval && d.runEnemy) {
    d.playerAttackAccum -= interval;
    applyDamageToEnemy(state, playerRunDamage(state), "");
    if (d.runPendingRewards.length > 0 || d.runPendingEvent || d.runPendingRoutes.length > 0) return;
  }
  if (!d.active || !d.runEnemy || d.runPendingRewards.length > 0 || d.runPendingEvent || d.runPendingRoutes.length > 0) return;
  if (resolveBossOmenFailure(state, now)) return;
  if (!d.active || !d.runEnemy || d.runPendingRewards.length > 0 || d.runPendingEvent || d.runPendingRoutes.length > 0) return;
  processEnemyIntent(state, now);
  state.combatHpCurrent = Math.max(0, d.playerHp);
}

export function dungeonCombatPhase(state: GameState): DungeonCombatPhase {
  const node = state.dungeon.runNodes[state.dungeon.runNodeIndex];
  if (node?.type === "boss") return "boss_fight";
  if (node?.type === "elite") return "boss_prep";
  return "trash";
}

export function dungeonBossPrepSnapshot(state: GameState): DungeonBossPrepSnapshot {
  const node = state.dungeon.runNodes[state.dungeon.runNodeIndex];
  const canChallenge = node?.type === "boss" && !!state.dungeon.runEnemy;
  return {
    phase: dungeonCombatPhase(state),
    req: 1,
    kills: state.dungeon.runKills,
    canChallenge,
    prepEssenceMult: 1,
    challengeHint: canChallenge ? "首领已在场：用闪避、心法技和终结技抓住窗口。" : "行旅推进后会自然抵达首领。",
  };
}

export function requestBossChallenge(_state: GameState): { ok: boolean; msg: string } {
  return { ok: false, msg: "新版幻域会沿路线自然抵达首领，不再需要手动切换前哨。" };
}

export function playerEngageRadiusNorm(_state: GameState): number {
  return 0.075;
}

export function playerAttackDiskOuterRadiusNormForUi(_state: GameState): number {
  return 0.09;
}

export function countMobsInEngageRange(state: GameState): number {
  return state.dungeon.runEnemy ? 1 : 0;
}

export function totalAliveMobHpSum(stateOrDungeon: GameState | GameState["dungeon"]): number {
  const d = "dungeon" in stateOrDungeon ? stateOrDungeon.dungeon : stateOrDungeon;
  return d.runEnemy ? Math.max(0, d.runEnemy.hp) : d.mobs.reduce((s, m) => s + Math.max(0, m.hp), 0);
}

export function currentBossMob(stateOrDungeon: GameState["dungeon"] | GameState): DungeonMob | null {
  const d = "dungeon" in stateOrDungeon ? stateOrDungeon.dungeon : stateOrDungeon;
  return d.mobs.find((m) => m.isBoss && m.hp > 0) ?? null;
}

export function bossDisplayTitle(m: DungeonMob): string {
  return m.bossEpithet ? `${m.bossEpithet}劫主` : "幻域劫主";
}

export function describeMobBattleRole(m: DungeonMob): string {
  if (m.isBoss) return "首领";
  return m.mobRole === "ranged" ? "远程" : "近战";
}

export function essenceRewardTotalFloat(wave: number, state: GameState, isBoss = false, _repeatMode = false): number {
  const totals = runBlessingTotals(state);
  return (8 + wave * 2.4) * (isBoss ? 2.2 : 1) * (1 + totals.rewardPct);
}

export function essenceRewardForWave(wave: number, state: GameState, isBoss = false): number {
  return Math.max(1, Math.floor(essenceRewardTotalFloat(wave, state, isBoss)));
}

export function packSizeForWave(wave: number): number {
  return wave % 6 === 0 ? 1 : 1 + (wave % 3);
}

export function describeWaveProfile(wave: number): string {
  if (wave % 6 === 0) return "行旅首领";
  if (wave % 3 === 0) return "精英节点";
  return "短局战斗";
}

export function dungeonEntryFeeEssence(): number {
  return 0;
}

export function dungeonEntryFeeForSelectedWave(): number {
  return 0;
}

export function tryAutoEnterFromSanctuaryPortal(_state?: GameState, _now?: number): boolean {
  return false;
}
