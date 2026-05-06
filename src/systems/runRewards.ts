import type { DungeonRunEnemyRole, DungeonRunRewardOption, Element, GameState } from "../types";
import { RUN_BLESSINGS, blessingIdsForElement, getRunBlessing } from "../data/runBlessings";
import { getCard } from "../data/cards";
import { addStones } from "../stones";
import { nextRand01 } from "../rng";

const RUN_ELEMENTS: Element[] = ["metal", "wood", "water", "fire", "earth"];
const ELEMENT_ZH: Record<Element, string> = {
  metal: "金",
  wood: "木",
  water: "水",
  fire: "火",
  earth: "土",
};

function roleReadPrizeName(role: DungeonRunEnemyRole | null | undefined): string {
  if (role === "guard") return "护卫识破手札";
  if (role === "drain") return "汲灵识破手札";
  if (role === "ranged") return "远程识破手札";
  if (role === "melee") return "近战识破手札";
  return "职责识破手札";
}

function rewardEdgeBonus(tier: DungeonRunRewardOption["synergyTier"], major: boolean): { hits: number; damagePct: number } {
  if (tier === "triple") return { hits: 4, damagePct: 0.08 };
  if (tier === "pair") return { hits: 3, damagePct: 0.06 };
  if (major) return { hits: 3, damagePct: 0.05 };
  if (tier === "dominant") return { hits: 2, damagePct: 0.04 };
  return { hits: 1, damagePct: 0.03 };
}

function runThreatRewardMult(state: GameState): number {
  return 1 + Math.min(0.65, Math.max(0, state.dungeon.runThreat) * 0.0065);
}

function uniquePush<T>(arr: T[], v: T): void {
  if (!arr.includes(v)) arr.push(v);
}

export function deckElementCountsForRun(state: GameState): Record<Element, number> {
  const out: Record<Element, number> = { metal: 0, wood: 0, water: 0, fire: 0, earth: 0 };
  for (const id of state.deck) {
    if (!id) continue;
    const owned = state.owned[id];
    if (!owned) continue;
    const def = getCard(id);
    if (def) out[def.element] += 1;
  }
  return out;
}

export function dominantRunElement(state: GameState): Element {
  const counts = deckElementCountsForRun(state);
  let best: Element = "fire";
  for (const e of ["metal", "wood", "water", "fire", "earth"] as Element[]) {
    if (counts[e] > counts[best]) best = e;
  }
  return counts[best] > 0 ? best : "fire";
}

export function runBlessingTotals(state: GameState): {
  atkPct: number;
  hpPct: number;
  shieldPct: number;
  critPct: number;
  dodgeRefund: number;
  skillHastePct: number;
  rewardPct: number;
} {
  const out = {
    atkPct: 0,
    hpPct: 0,
    shieldPct: 0,
    critPct: 0,
    dodgeRefund: 0,
    skillHastePct: 0,
    rewardPct: 0,
  };
  for (const id of state.dungeon.runBlessings) {
    const b = getRunBlessing(id);
    if (!b) continue;
    out.atkPct += b.atkPct ?? 0;
    out.hpPct += b.hpPct ?? 0;
    out.shieldPct += b.shieldPct ?? 0;
    out.critPct += b.critPct ?? 0;
    out.dodgeRefund += b.dodgeRefund ?? 0;
    out.skillHastePct += b.skillHastePct ?? 0;
    out.rewardPct += b.rewardPct ?? 0;
  }
  const resonances = runBlessingElementCounts(state);
  for (const element of RUN_ELEMENTS) {
    if (resonances[element] < 2) continue;
    if (element === "metal") {
      out.atkPct += 0.12;
      out.critPct += 0.04;
    } else if (element === "wood") {
      out.hpPct += 0.12;
      out.rewardPct += 0.04;
    } else if (element === "water") {
      out.dodgeRefund += 8;
      out.skillHastePct += 0.1;
    } else if (element === "fire") {
      out.atkPct += 0.08;
      out.critPct += 0.08;
    } else if (element === "earth") {
      out.hpPct += 0.06;
      out.shieldPct += 0.14;
    }
    if (resonances[element] >= 3) out.rewardPct += 0.08;
  }
  return out;
}

export function runBlessingElementCounts(state: GameState): Record<Element, number> {
  const out: Record<Element, number> = { metal: 0, wood: 0, water: 0, fire: 0, earth: 0 };
  for (const id of state.dungeon.runBlessings) {
    const b = getRunBlessing(id);
    if (b?.element) out[b.element] += 1;
  }
  return out;
}

export function runResonanceLines(state: GameState): string[] {
  const counts = runBlessingElementCounts(state);
  const lines: string[] = [];
  for (const element of RUN_ELEMENTS) {
    const n = counts[element];
    if (n < 2) continue;
    const suffix = n >= 3 ? " · 三印加成" : "";
    if (element === "metal") lines.push(`${ELEMENT_ZH[element]}鸣：破防与暴击提升${suffix}`);
    else if (element === "wood") lines.push(`${ELEMENT_ZH[element]}鸣：生命与结算提升${suffix}`);
    else if (element === "water") lines.push(`${ELEMENT_ZH[element]}鸣：闪避返体与心法加速${suffix}`);
    else if (element === "fire") lines.push(`${ELEMENT_ZH[element]}鸣：爆发与暴击提升${suffix}`);
    else lines.push(`${ELEMENT_ZH[element]}鸣：生命与护盾提升${suffix}`);
  }
  return lines;
}

export interface RunBuildVerbProfile {
  verb: string;
  hint: string;
  count: number;
  primary: boolean;
}

function rewardCombatProfile(blessingId?: string): { combatVerb: string; combatHint: string } {
  if (!blessingId) return { combatVerb: "资源", combatHint: "抽卡、筑灵与结算推进" };
  const b = getRunBlessing(blessingId);
  if (!b) return { combatVerb: "构筑", combatHint: "补强本局灵印路线" };
  if (blessingId === "metal_execution") return { combatVerb: "终结", combatHint: "终结技斩杀与资源收益" };
  if (blessingId === "water_mirror") return { combatVerb: "闪避", combatHint: "闪避反击与心法回转" };
  if (blessingId === "fire_overheat") return { combatVerb: "爆发", combatHint: "心法技与终结技爆发" };
  if (blessingId === "wood_lifebloom") return { combatVerb: "续航", combatHint: "心法技治疗与生命上限" };
  if (blessingId === "earth_stoneheart") return { combatVerb: "护盾", combatHint: "护盾和首领容错" };
  if (b.element === "metal") return { combatVerb: "破防", combatHint: "普攻削护势，终结更锋利" };
  if (b.element === "wood") return { combatVerb: "续航", combatHint: "战后回血与结算收益" };
  if (b.element === "water") return { combatVerb: "闪避", combatHint: "闪避体力返还与反制节奏" };
  if (b.element === "fire") return { combatVerb: "爆发", combatHint: "暴击、战意和爆发节奏" };
  if (b.element === "earth") return { combatVerb: "护盾", combatHint: "开场护盾与生命厚度" };
  return { combatVerb: "节奏", combatHint: "通用行旅节奏收益" };
}

function rewardVerbName(verb: string): string {
  return verb || "构筑";
}

function bankRouteRecommendRewardSurge(state: GameState, verb: string): string {
  const d = state.dungeon;
  const streak = Math.max(0, Math.min(9, Math.floor(d.runRouteRecommendStreak ?? 0)));
  if (streak < 2) return "";
  const power = Math.max(1, Math.min(3, Math.floor((streak + 1) / 2)));
  const surgeVerb = verb && verb !== "璧勬簮" && verb !== "资源" ? verb : "顺势";
  d.runRewardVerbSurge = d.runRewardVerbSurge || surgeVerb;
  d.runRewardVerbSurgePower = Math.max(d.runRewardVerbSurgePower, power);
  d.runRewardVerbSurgeLast = `顺势开战 x${d.runRewardVerbSurgePower} 已蓄：下一场开局出现${rewardVerbName(d.runRewardVerbSurge)}战机，接住推荐路线余势。`;
  return `顺势开战 x${d.runRewardVerbSurgePower}`;
}

export function runBuildVerbProfile(state: GameState): RunBuildVerbProfile[] {
  const byVerb = new Map<string, { verb: string; hint: string; count: number }>();
  for (const id of state.dungeon.runBlessings) {
    const profile = rewardCombatProfile(id);
    const cur = byVerb.get(profile.combatVerb);
    if (cur) cur.count += 1;
    else byVerb.set(profile.combatVerb, { verb: profile.combatVerb, hint: profile.combatHint, count: 1 });
  }
  if (byVerb.size === 0) {
    return [{ verb: "未成型", hint: "选择开局灵印后形成战斗路线", count: 0, primary: true }];
  }
  return [...byVerb.values()]
    .sort((a, b) => b.count - a.count || a.verb.localeCompare(b.verb, "zh-Hans-CN"))
    .map((x, idx) => ({ ...x, primary: idx === 0 }));
}

export function buildRunRewardOptions(state: GameState, boss = false, elite = false): DungeonRunRewardOption[] {
  let ids: string[] = [];
  const resonanceIds: string[] = [];
  const eliteMajorIds: string[] = [];
  const dom = dominantRunElement(state);
  const owned = state.dungeon.runBlessings;
  const elementCounts = runBlessingElementCounts(state);
  for (const id of blessingIdsForElement(dom)) {
    if (!owned.includes(id)) uniquePush(ids, id);
  }
  for (const b of RUN_BLESSINGS) {
    if (ids.length >= 6) break;
    if (!b.element || elementCounts[b.element] !== 1 || owned.includes(b.id)) continue;
    uniquePush(ids, b.id);
    uniquePush(resonanceIds, b.id);
  }
  if (elite) {
    for (const b of RUN_BLESSINGS) {
      if (ids.length >= 7) break;
      if (b.rarity !== "major" || owned.includes(b.id)) continue;
      uniquePush(ids, b.id);
      uniquePush(eliteMajorIds, b.id);
    }
  }
  for (const b of RUN_BLESSINGS) {
    if (ids.length >= 6) break;
    if (!owned.includes(b.id)) uniquePush(ids, b.id);
  }
  const rewardVerb = state.dungeon.runRewardVerb;
  const rewardVerbStreak = Math.max(0, Math.min(9, Math.floor(state.dungeon.runRewardVerbStreak ?? 0)));
  if (rewardVerb && rewardVerbStreak >= 2) {
    const matching: string[] = RUN_BLESSINGS.filter(
      (b) => !owned.includes(b.id) && rewardCombatProfile(b.id).combatVerb === rewardVerb,
    ).map((b) => b.id);
    ids = [...matching, ...ids.filter((id) => !matching.includes(id))];
  }
  const blessingIds: string[] = [];
  if (resonanceIds.length > 0) {
    const resonanceStart = Math.floor(nextRand01(state) * resonanceIds.length);
    uniquePush(blessingIds, resonanceIds[resonanceStart]!);
  }
  if (eliteMajorIds.length > 0) {
    const eliteStart = Math.floor(nextRand01(state) * eliteMajorIds.length);
    uniquePush(blessingIds, eliteMajorIds[eliteStart]!);
  }
  const start = Math.floor(nextRand01(state) * Math.max(1, ids.length));
  for (let i = 0; i < ids.length && blessingIds.length < 2; i += 1) {
    const id = ids[(start + i) % ids.length];
    if (id) uniquePush(blessingIds, id);
  }
  const depth = Math.max(1, state.dungeon.runNodeIndex + 1);
  const tacticalPrize = Math.max(0, Math.min(3, Math.floor(state.dungeon.runTacticalEdgePrize ?? 0)));
  const counterTempoPrize = Math.max(0, Math.min(3, Math.floor(state.dungeon.runCounterTempoPrize ?? 0)));
  const clutchPrize = Math.max(0, Math.min(3, Math.floor(state.dungeon.runClutchPrize ?? 0)));
  const actionWeavePrize = Math.max(0, Math.min(3, Math.floor(state.dungeon.runActionWeavePrize ?? 0)));
  const warrantPrize = Math.max(0, Math.min(3, Math.floor(state.dungeon.runWarrantPrize ?? 0)));
  const roleReadPrizeRole = state.dungeon.runRoleReadPrizeRole;
  const roleReadPrizePower = Math.max(0, Math.min(3, Math.floor(state.dungeon.runRoleReadPrizePower ?? 0)));
  const rewards: DungeonRunRewardOption[] = blessingIds.map((id) => {
    const b = getRunBlessing(id)!;
    const combat = rewardCombatProfile(id);
    const currentElementCount = b.element ? elementCounts[b.element] : 0;
    const completesTriple = !!b.element && currentElementCount >= 2;
    const completesPair = !!b.element && currentElementCount === 1;
    const reinforcesDominant = !!b.element && b.element === dom;
    const synergyTier = completesTriple ? "triple" : completesPair ? "pair" : b.rarity === "major" ? "major" : reinforcesDominant ? "dominant" : undefined;
    const edge = rewardEdgeBonus(synergyTier, b.rarity === "major");
    const draftHint = completesTriple
      ? `${ELEMENT_ZH[b.element!]}系三印：选后立刻触发高阶共鸣。`
      : completesPair
        ? `${ELEMENT_ZH[b.element!]}系成套：选后开启二印共鸣。`
        : reinforcesDominant
          ? `${ELEMENT_ZH[b.element!]}主势补强：更稳定地滚起本局核心动词。`
          : b.rarity === "major"
            ? "高阶灵印：单张强度高，适合转向或补短板。"
            : "补充一枚灵印，扩展后续构筑空间。";
    return {
      id: `blessing:${id}`,
      kind: "blessing",
      title: b.name,
      desc: b.desc,
      blessingId: id,
      combatVerb: combat.combatVerb,
      combatHint: combat.combatHint,
      draftHint,
      synergyTier,
      pickZhuLingBonus: completesTriple ? 6 + depth : completesPair ? 3 + depth : b.rarity === "major" ? 2 + depth : 0,
      pickFinisherBonus: completesTriple ? 24 : completesPair ? 14 : reinforcesDominant ? 8 : 0,
      pickTacticalEdgeHits: edge.hits,
      pickTacticalEdgeDamagePct: edge.damagePct,
      pickRerollBonus: completesTriple ? 1 : 0,
      pickThreatDelta: b.rarity === "major" && !elite ? 2 : undefined,
    };
  });
  if (tacticalPrize > 0) {
    const prizeZhu = 4 + depth * 2 + tacticalPrize * 3;
    const prizeFinisher = Math.min(32, 10 + tacticalPrize * 6);
    const prizeHits = Math.min(6, 2 + tacticalPrize * 2);
    const prizePct = Math.min(0.14, 0.05 + tacticalPrize * 0.02);
    const prizeHint = `追击链印 x${tacticalPrize}：选择后额外筑灵髓 +${prizeZhu}、终结 +${prizeFinisher}、追击 +${prizeHits}。`;
    for (const reward of rewards) {
      reward.pickZhuLingBonus = (reward.pickZhuLingBonus ?? 0) + prizeZhu;
      reward.pickFinisherBonus = (reward.pickFinisherBonus ?? 0) + prizeFinisher;
      reward.pickTacticalEdgeHits = (reward.pickTacticalEdgeHits ?? 0) + prizeHits;
      reward.pickTacticalEdgeDamagePct = Math.max(reward.pickTacticalEdgeDamagePct ?? 0, prizePct);
      reward.draftHint = reward.draftHint ? `${reward.draftHint} ${prizeHint}` : prizeHint;
    }
  }
  rewards.push({
    id: boss ? "essence:boss" : "essence:node",
    kind: "essence",
    title: boss ? "首领遗髓" : elite ? "精英残髓" : "阵眼余髓",
    desc: boss
      ? "获得大量唤灵髓、筑灵髓与灵砂。"
      : elite
        ? "获得更多筑灵髓与灵砂，适合补强高风险行旅。"
        : "获得唤灵髓与筑灵髓，立刻推进抽卡构筑。",
    summonEssence: boss ? 26 + depth * 3 : elite ? 12 + depth : 8 + depth,
    zhuLingEssence: boss ? 34 + depth * 4 : elite ? 18 + depth * 3 : 10 + depth * 2,
    lingSha: boss ? 10 + Math.floor(depth / 2) : elite ? 5 : 3,
    pickTacticalEdgeHits: boss ? 4 : elite ? 3 : 2,
    pickTacticalEdgeDamagePct: boss ? 0.07 : elite ? 0.05 : 0.03,
    ...rewardCombatProfile(),
  });
  if (tacticalPrize > 0) {
    const reward = rewards[rewards.length - 1]!;
    const prizeZhu = 4 + depth * 2 + tacticalPrize * 3;
    const prizeFinisher = Math.min(32, 10 + tacticalPrize * 6);
    const prizeHits = Math.min(6, 2 + tacticalPrize * 2);
    const prizePct = Math.min(0.14, 0.05 + tacticalPrize * 0.02);
    reward.pickZhuLingBonus = (reward.pickZhuLingBonus ?? 0) + prizeZhu;
    reward.pickFinisherBonus = (reward.pickFinisherBonus ?? 0) + prizeFinisher;
    reward.pickTacticalEdgeHits = (reward.pickTacticalEdgeHits ?? 0) + prizeHits;
    reward.pickTacticalEdgeDamagePct = Math.max(reward.pickTacticalEdgeDamagePct ?? 0, prizePct);
    reward.draftHint = `追击链印 x${tacticalPrize}：选择后额外筑灵髓 +${prizeZhu}、终结 +${prizeFinisher}、追击 +${prizeHits}。`;
  }
  const tacticalStreak = Math.max(0, Math.min(5, Math.floor(state.dungeon.runObjectiveStreak)));
  if (tacticalStreak >= 2) {
    const edgeZhu = 2 + depth + tacticalStreak * 2;
    const edgeFinisher = Math.min(28, tacticalStreak * 5);
    const edgeReroll = tacticalStreak >= 4 ? 1 : 0;
    const edgeHits = Math.min(5, 1 + tacticalStreak);
    const edgePct = Math.min(0.1, 0.03 + tacticalStreak * 0.01);
    for (const reward of rewards) {
      reward.pickZhuLingBonus = (reward.pickZhuLingBonus ?? 0) + edgeZhu;
      reward.pickFinisherBonus = (reward.pickFinisherBonus ?? 0) + edgeFinisher;
      reward.pickTacticalEdgeHits = (reward.pickTacticalEdgeHits ?? 0) + edgeHits;
      reward.pickTacticalEdgeDamagePct = Math.max(reward.pickTacticalEdgeDamagePct ?? 0, edgePct);
      if (edgeReroll > 0) reward.pickRerollBonus = (reward.pickRerollBonus ?? 0) + edgeReroll;
      const edgeHint = `战术锋芒 x${tacticalStreak}：选后额外筑灵髓 +${edgeZhu}、终结 +${edgeFinisher}、追击 +${edgeHits}${edgeReroll ? "、重掷 +1" : ""}。`;
      reward.draftHint = reward.draftHint ? `${reward.draftHint} ${edgeHint}` : edgeHint;
    }
  }
  const pledgeStreak = Math.max(0, Math.min(9, Math.floor(state.dungeon.runRoutePledgeStreak)));
  if (pledgeStreak >= 2) {
    const pledgeZhu = 3 + depth + pledgeStreak * 2;
    const pledgeFinisher = Math.min(30, pledgeStreak * 4);
    const pledgeHits = Math.min(6, 1 + pledgeStreak);
    const pledgePct = Math.min(0.12, 0.04 + pledgeStreak * 0.01);
    const pledgeReroll = pledgeStreak >= 4 ? 1 : 0;
    for (const reward of rewards) {
      reward.pickZhuLingBonus = (reward.pickZhuLingBonus ?? 0) + pledgeZhu;
      reward.pickFinisherBonus = (reward.pickFinisherBonus ?? 0) + pledgeFinisher;
      reward.pickTacticalEdgeHits = (reward.pickTacticalEdgeHits ?? 0) + pledgeHits;
      reward.pickTacticalEdgeDamagePct = Math.max(reward.pickTacticalEdgeDamagePct ?? 0, pledgePct);
      if (pledgeReroll > 0) reward.pickRerollBonus = (reward.pickRerollBonus ?? 0) + pledgeReroll;
      const pledgeHint = `承诺连段 x${pledgeStreak}：选后额外筑灵髓 +${pledgeZhu}、终结 +${pledgeFinisher}、追击 +${pledgeHits}${pledgeReroll ? "、重掷 +1" : ""}。`;
      reward.draftHint = reward.draftHint ? `${reward.draftHint} ${pledgeHint}` : pledgeHint;
    }
  }
  const recommendStreak = Math.max(0, Math.min(9, Math.floor(state.dungeon.runRouteRecommendStreak)));
  if (recommendStreak >= 2) {
    const routeZhu = 2 + depth + recommendStreak * 2;
    const routeFinisher = Math.min(26, 6 + recommendStreak * 4);
    const routeHits = Math.min(6, 1 + recommendStreak);
    const routePct = Math.min(0.13, 0.04 + recommendStreak * 0.012);
    const routeReroll = recommendStreak >= 3 ? 1 : 0;
    for (const reward of rewards) {
      reward.pickZhuLingBonus = (reward.pickZhuLingBonus ?? 0) + routeZhu;
      reward.pickFinisherBonus = (reward.pickFinisherBonus ?? 0) + routeFinisher;
      reward.pickTacticalEdgeHits = (reward.pickTacticalEdgeHits ?? 0) + routeHits;
      reward.pickTacticalEdgeDamagePct = Math.max(reward.pickTacticalEdgeDamagePct ?? 0, routePct);
      if (routeReroll > 0) reward.pickRerollBonus = Math.min(2, (reward.pickRerollBonus ?? 0) + routeReroll);
      const routeHint = `顺势行旅 x${recommendStreak}：选后额外筑灵髓 +${routeZhu}、终结 +${routeFinisher}、追击 +${routeHits}${routeReroll ? "、重掷 +1" : ""}。`;
      reward.draftHint = reward.draftHint ? `${reward.draftHint} ${routeHint}` : routeHint;
    }
  }
  if (rewardVerb && rewardVerbStreak >= 2) {
    const verbZhu = 2 + depth + rewardVerbStreak * 2;
    const verbFinisher = Math.min(24, rewardVerbStreak * 4);
    const verbHits = Math.min(5, rewardVerbStreak);
    const verbPct = Math.min(0.11, 0.04 + rewardVerbStreak * 0.01);
    const verbReroll = rewardVerbStreak >= 5 ? 1 : 0;
    for (const reward of rewards) {
      const match = reward.combatVerb === rewardVerb;
      const zhu = verbZhu + (match ? rewardVerbStreak : 0);
      const finisher = verbFinisher + (match ? 8 : 0);
      const hits = verbHits + (match ? 1 : 0);
      reward.pickZhuLingBonus = (reward.pickZhuLingBonus ?? 0) + zhu;
      reward.pickFinisherBonus = (reward.pickFinisherBonus ?? 0) + finisher;
      reward.pickTacticalEdgeHits = (reward.pickTacticalEdgeHits ?? 0) + hits;
      reward.pickTacticalEdgeDamagePct = Math.max(reward.pickTacticalEdgeDamagePct ?? 0, verbPct + (match ? 0.03 : 0));
      if (verbReroll > 0 || match) reward.pickRerollBonus = Math.min(2, (reward.pickRerollBonus ?? 0) + verbReroll + (match ? 1 : 0));
      if (match && !reward.synergyTier) reward.synergyTier = "dominant";
      const verbHint = `${rewardVerbName(rewardVerb)}连选 x${rewardVerbStreak}：选后额外筑灵髓 +${zhu}、终结 +${finisher}、追击 +${hits}${match ? "，同流派重掷 +1" : verbReroll ? "，重掷 +1" : ""}。`;
      reward.draftHint = reward.draftHint ? `${reward.draftHint} ${verbHint}` : verbHint;
    }
  }
  if (counterTempoPrize > 0) {
    const tempoZhu = 3 + depth * 2 + counterTempoPrize * 4;
    const tempoFinisher = Math.min(34, 8 + counterTempoPrize * 8);
    const tempoHits = Math.min(7, 1 + counterTempoPrize * 2);
    const tempoPct = Math.min(0.18, 0.06 + counterTempoPrize * 0.025);
    const tempoReroll = counterTempoPrize >= 3 ? 1 : 0;
    for (const reward of rewards) {
      reward.pickZhuLingBonus = (reward.pickZhuLingBonus ?? 0) + tempoZhu;
      reward.pickFinisherBonus = (reward.pickFinisherBonus ?? 0) + tempoFinisher;
      reward.pickTacticalEdgeHits = (reward.pickTacticalEdgeHits ?? 0) + tempoHits;
      reward.pickTacticalEdgeDamagePct = Math.max(reward.pickTacticalEdgeDamagePct ?? 0, tempoPct);
      if (tempoReroll > 0) reward.pickRerollBonus = Math.min(2, (reward.pickRerollBonus ?? 0) + tempoReroll);
      const tempoHint = `破招战利品 x${counterTempoPrize}：选后额外筑灵髓 +${tempoZhu}、终结 +${tempoFinisher}、追击 +${tempoHits}${tempoReroll ? "、重掷 +1" : ""}。`;
      reward.draftHint = reward.draftHint ? `${reward.draftHint} ${tempoHint}` : tempoHint;
    }
  }
  if (clutchPrize > 0) {
    const clutchZhu = 3 + depth + clutchPrize * 4;
    const clutchFinisher = Math.min(32, 8 + clutchPrize * 7);
    const clutchHits = Math.min(6, 1 + clutchPrize * 2);
    const clutchPct = Math.min(0.17, 0.05 + clutchPrize * 0.025);
    const clutchReroll = clutchPrize >= 2 ? 1 : 0;
    const clutchThreat = -clutchPrize;
    for (const reward of rewards) {
      reward.pickZhuLingBonus = (reward.pickZhuLingBonus ?? 0) + clutchZhu;
      reward.pickFinisherBonus = (reward.pickFinisherBonus ?? 0) + clutchFinisher;
      reward.pickTacticalEdgeHits = (reward.pickTacticalEdgeHits ?? 0) + clutchHits;
      reward.pickTacticalEdgeDamagePct = Math.max(reward.pickTacticalEdgeDamagePct ?? 0, clutchPct);
      if (clutchReroll > 0) reward.pickRerollBonus = Math.min(2, (reward.pickRerollBonus ?? 0) + clutchReroll);
      reward.pickThreatDelta = Math.min(0, reward.pickThreatDelta ?? 0) + clutchThreat;
      const clutchHint = `险境翻盘 x${clutchPrize}：选后额外筑灵髓 +${clutchZhu}、终结 +${clutchFinisher}、追击 +${clutchHits}、劫压 ${clutchThreat}${clutchReroll ? "、重掷 +1" : ""}。`;
      reward.draftHint = reward.draftHint ? `${reward.draftHint} ${clutchHint}` : clutchHint;
    }
  }
  if (roleReadPrizeRole && roleReadPrizePower > 0) {
    const readZhu = 2 + depth + roleReadPrizePower * 3;
    const readFinisher = Math.min(28, 6 + roleReadPrizePower * 7);
    const readHits = Math.min(6, 1 + roleReadPrizePower * 2);
    const readPct = Math.min(0.16, 0.05 + roleReadPrizePower * 0.025);
    const readReroll = roleReadPrizePower >= 3 || roleReadPrizeRole === "ranged" ? 1 : 0;
    const readThreatDelta = roleReadPrizeRole === "drain" ? -roleReadPrizePower : 0;
    const name = roleReadPrizeName(roleReadPrizeRole);
    for (const reward of rewards) {
      reward.pickZhuLingBonus = (reward.pickZhuLingBonus ?? 0) + readZhu;
      reward.pickFinisherBonus = (reward.pickFinisherBonus ?? 0) + readFinisher;
      reward.pickTacticalEdgeHits = (reward.pickTacticalEdgeHits ?? 0) + readHits;
      reward.pickTacticalEdgeDamagePct = Math.max(reward.pickTacticalEdgeDamagePct ?? 0, readPct);
      if (readReroll > 0) reward.pickRerollBonus = Math.min(2, (reward.pickRerollBonus ?? 0) + readReroll);
      if (readThreatDelta !== 0) reward.pickThreatDelta = (reward.pickThreatDelta ?? 0) + readThreatDelta;
      const readHint = `${name} x${roleReadPrizePower}：选后额外筑灵髓 +${readZhu}、终结 +${readFinisher}、追击 +${readHits}${readThreatDelta ? `、劫压 ${readThreatDelta}` : ""}${readReroll ? "、重掷 +1" : ""}。`;
      reward.draftHint = reward.draftHint ? `${reward.draftHint} ${readHint}` : readHint;
    }
  }
  if (actionWeavePrize > 0) {
    const weaveZhu = 4 + depth + actionWeavePrize * 4;
    const weaveFinisher = Math.min(34, 8 + actionWeavePrize * 8);
    const weaveHits = Math.min(7, 2 + actionWeavePrize * 2);
    const weavePct = Math.min(0.18, 0.06 + actionWeavePrize * 0.025);
    const weaveReroll = actionWeavePrize >= 2 ? 1 : 0;
    for (const reward of rewards) {
      reward.pickZhuLingBonus = (reward.pickZhuLingBonus ?? 0) + weaveZhu;
      reward.pickFinisherBonus = (reward.pickFinisherBonus ?? 0) + weaveFinisher;
      reward.pickTacticalEdgeHits = (reward.pickTacticalEdgeHits ?? 0) + weaveHits;
      reward.pickTacticalEdgeDamagePct = Math.max(reward.pickTacticalEdgeDamagePct ?? 0, weavePct);
      if (weaveReroll > 0) reward.pickRerollBonus = Math.min(2, (reward.pickRerollBonus ?? 0) + weaveReroll);
      const weaveHint = `万象灵契 x${actionWeavePrize}：选后额外筑灵髓 +${weaveZhu}、终结 +${weaveFinisher}、追击 +${weaveHits}${weaveReroll ? "、重掷 +1" : ""}。`;
      reward.draftHint = reward.draftHint ? `${reward.draftHint} ${weaveHint}` : weaveHint;
    }
  }
  if (warrantPrize > 0) {
    const warrantZhu = 5 + depth * 2 + warrantPrize * 4;
    const warrantFinisher = Math.min(34, 10 + warrantPrize * 7);
    const warrantHits = Math.min(7, 2 + warrantPrize * 2);
    const warrantPct = Math.min(0.18, 0.06 + warrantPrize * 0.025);
    const warrantReroll = warrantPrize >= 2 ? 1 : 0;
    const warrantThreat = -warrantPrize;
    for (const reward of rewards) {
      reward.pickZhuLingBonus = (reward.pickZhuLingBonus ?? 0) + warrantZhu;
      reward.pickFinisherBonus = (reward.pickFinisherBonus ?? 0) + warrantFinisher;
      reward.pickTacticalEdgeHits = (reward.pickTacticalEdgeHits ?? 0) + warrantHits;
      reward.pickTacticalEdgeDamagePct = Math.max(reward.pickTacticalEdgeDamagePct ?? 0, warrantPct);
      if (warrantReroll > 0) reward.pickRerollBonus = Math.min(2, (reward.pickRerollBonus ?? 0) + warrantReroll);
      reward.pickThreatDelta = (reward.pickThreatDelta ?? 0) + warrantThreat;
      const warrantHint = `悬赏兑券 x${warrantPrize}：选后额外筑灵髓 +${warrantZhu}、终结 +${warrantFinisher}、追击 +${warrantHits}、劫压 ${warrantThreat}${warrantReroll ? "、重掷 +1" : ""}。`;
      reward.draftHint = reward.draftHint ? `${reward.draftHint} ${warrantHint}` : warrantHint;
    }
  }
  return rewards.slice(0, 3);
}

export function applyRunReward(state: GameState, rewardId: string): boolean {
  const d = state.dungeon;
  const opt = d.runPendingRewards.find((x) => x.id === rewardId);
  if (!opt) return false;
  if (opt.blessingId) uniquePush(d.runBlessings, opt.blessingId);
  state.summonEssence += opt.summonEssence ?? 0;
  state.zhuLingEssence += opt.zhuLingEssence ?? 0;
  state.lingSha += opt.lingSha ?? 0;
  state.xuanTie += opt.xuanTie ?? 0;
  if (opt.pickZhuLingBonus) {
    state.zhuLingEssence += opt.pickZhuLingBonus;
    d.runEssenceGained += opt.pickZhuLingBonus;
  }
  if (opt.pickFinisherBonus) d.runFinisherCharge = Math.min(100, d.runFinisherCharge + opt.pickFinisherBonus);
  if (opt.pickTacticalEdgeHits || opt.pickTacticalEdgeDamagePct) {
    d.runTacticalEdgeHits = Math.min(9, d.runTacticalEdgeHits + Math.max(0, Math.floor(opt.pickTacticalEdgeHits ?? 0)));
    d.runTacticalEdgeDamagePct = Math.max(d.runTacticalEdgeDamagePct, Math.max(0, Math.min(0.75, opt.pickTacticalEdgeDamagePct ?? 0)));
    if (d.runTacticalEdgeHits > 0 && d.runTacticalEdgeDamagePct > 0) d.runTacticalEdgeLabel = "构筑追击";
  }
  if (opt.pickRerollBonus) d.runRewardRerolls = Math.min(2, d.runRewardRerolls + opt.pickRerollBonus);
  if (opt.pickThreatDelta) d.runThreat = Math.max(0, Math.min(100, d.runThreat + opt.pickThreatDelta));
  const verb = opt.combatVerb || rewardCombatProfile(opt.blessingId).combatVerb;
  d.runRewardVerbStreak = verb && verb === d.runRewardVerb ? Math.min(9, d.runRewardVerbStreak + 1) : 1;
  d.runRewardVerb = verb;
  d.runRewardVerbPeak = Math.max(d.runRewardVerbPeak, d.runRewardVerbStreak);
  const verbStreak = d.runRewardVerbStreak;
  let verbStreakLine = "";
  if (verbStreak >= 2) {
    const flowZhu = 2 + verbStreak * 2;
    const flowFinisher = Math.min(22, 6 + verbStreak * 4);
    const flowHits = Math.min(5, 1 + verbStreak);
    state.zhuLingEssence += flowZhu;
    d.runEssenceGained += flowZhu;
    d.runFinisherCharge = Math.min(100, d.runFinisherCharge + flowFinisher);
    d.runTacticalEdgeHits = Math.min(9, d.runTacticalEdgeHits + flowHits);
    d.runTacticalEdgeDamagePct = Math.max(d.runTacticalEdgeDamagePct, Math.min(0.16, 0.06 + verbStreak * 0.015));
    d.runTacticalEdgeLabel = `${rewardVerbName(verb)}连选`;
    d.runRewardVerbLast = `${rewardVerbName(verb)}连选 x${verbStreak}：筑灵髓 +${flowZhu}，终结 +${flowFinisher}，追击 +${flowHits}。`;
    verbStreakLine = d.runRewardVerbLast;
    if (verbStreak >= 3) {
      const surgePower = Math.min(3, Math.max(1, Math.floor(verbStreak / 2)));
      d.runRewardVerbSurge = verb;
      d.runRewardVerbSurgePower = Math.max(d.runRewardVerbSurgePower, surgePower);
      d.runRewardVerbSurgeLast = `${rewardVerbName(verb)}开战 x${d.runRewardVerbSurgePower} 已蓄：下一场开局触发流派战机。`;
    }
  } else {
    d.runRewardVerbLast = `${rewardVerbName(verb)}流派起势：继续选择同类战利品会滚起连选。`;
  }
  const chainPrizeSpent = Math.max(0, Math.min(3, Math.floor(d.runTacticalEdgePrize ?? 0)));
  if (chainPrizeSpent > 0) d.runTacticalEdgePrize = 0;
  const counterTempoPrizeSpent = Math.max(0, Math.min(3, Math.floor(d.runCounterTempoPrize ?? 0)));
  if (counterTempoPrizeSpent > 0) {
    d.runCounterTempoPrize = 0;
    d.runCounterTempoPrizeLast = `破招战利品 x${counterTempoPrizeSpent} 已兑现。`;
  }
  const clutchPrizeSpent = Math.max(0, Math.min(3, Math.floor(d.runClutchPrize ?? 0)));
  if (clutchPrizeSpent > 0) {
    d.runClutchPrize = 0;
    d.runClutchPrizeLast = `险境翻盘 x${clutchPrizeSpent} 已兑现。`;
  }
  const roleReadPrizeSpent = d.runRoleReadPrizeRole && d.runRoleReadPrizePower > 0 ? Math.max(0, Math.min(3, Math.floor(d.runRoleReadPrizePower))) : 0;
  const roleReadPrizeNameSpent = roleReadPrizeSpent > 0 ? roleReadPrizeName(d.runRoleReadPrizeRole) : "";
  if (roleReadPrizeSpent > 0) {
    d.runRoleReadPrizeRole = null;
    d.runRoleReadPrizePower = 0;
    d.runRoleReadPrizeLast = `${roleReadPrizeNameSpent} x${roleReadPrizeSpent} 已兑现。`;
  }
  const actionWeavePrizeSpent = Math.max(0, Math.min(3, Math.floor(d.runActionWeavePrize ?? 0)));
  if (actionWeavePrizeSpent > 0) {
    d.runActionWeavePrize = 0;
    const surgePower = Math.max(1, Math.min(3, actionWeavePrizeSpent));
    d.runRewardVerbSurge = verb;
    d.runRewardVerbSurgePower = Math.max(d.runRewardVerbSurgePower, surgePower);
    d.runActionWeavePrizeLast = `万象灵契 x${actionWeavePrizeSpent} 已兑现：下一场触发${rewardVerbName(verb)}开战。`;
    d.runRewardVerbSurgeLast = d.runActionWeavePrizeLast;
  }
  const warrantPrizeSpent = Math.max(0, Math.min(3, Math.floor(d.runWarrantPrize ?? 0)));
  if (warrantPrizeSpent > 0) {
    d.runWarrantPrize = 0;
    d.runWarrantPrizeLast = `悬赏兑券 x${warrantPrizeSpent} 已兑现。`;
  }
  const routeRecommendSurgeLine = actionWeavePrizeSpent > 0 ? "" : bankRouteRecommendRewardSurge(state, verb);
  d.runPendingRewards = [];
  const draftParts = [
    opt.pickZhuLingBonus ? `筑灵髓 +${opt.pickZhuLingBonus}` : "",
    opt.pickFinisherBonus ? `终结 +${opt.pickFinisherBonus}` : "",
    opt.pickTacticalEdgeHits ? `追击 +${opt.pickTacticalEdgeHits}` : "",
    opt.pickTacticalEdgeDamagePct ? `追击伤害 +${Math.round(opt.pickTacticalEdgeDamagePct * 100)}%` : "",
    opt.pickRerollBonus ? `重掷 +${opt.pickRerollBonus}` : "",
    opt.pickThreatDelta ? `劫压 ${opt.pickThreatDelta > 0 ? "+" : ""}${opt.pickThreatDelta}` : "",
    chainPrizeSpent ? `链印兑现 x${chainPrizeSpent}` : "",
    counterTempoPrizeSpent ? `破招战利品 x${counterTempoPrizeSpent}` : "",
    clutchPrizeSpent ? `险境翻盘 x${clutchPrizeSpent}` : "",
    roleReadPrizeSpent ? `${roleReadPrizeNameSpent} x${roleReadPrizeSpent}` : "",
    actionWeavePrizeSpent ? `万象灵契 x${actionWeavePrizeSpent}` : "",
    warrantPrizeSpent ? `悬赏兑券 x${warrantPrizeSpent}` : "",
    routeRecommendSurgeLine,
    verbStreakLine,
  ].filter(Boolean);
  const draftBonus = draftParts.length > 0 ? `（构筑势能：${draftParts.join("，")}）` : "";
  d.runLog = `选择奖励：${opt.title}${draftBonus}`;
  return true;
}

export function grantRunCompletionRewards(state: GameState): string {
  const d = state.dungeon;
  const totals = runBlessingTotals(state);
  const mult = (1 + totals.rewardPct) * runThreatRewardMult(state);
  const depth = Math.max(1, d.runNodeIndex + 1);
  const stonesGain = Math.floor((220 + depth * 60 + d.runKills * 24) * mult);
  const summon = Math.floor((18 + depth * 3) * mult);
  const zhu = Math.floor((22 + depth * 4) * mult);
  const sha = Math.floor((6 + depth) * mult);
  addStones(state, stonesGain);
  state.summonEssence += summon;
  state.zhuLingEssence += zhu;
  state.lingSha += sha;
  d.runEssenceGained += zhu;
  return `行旅凯旋：灵石 +${stonesGain}，唤灵髓 +${summon}，筑灵髓 +${zhu}，灵砂 +${sha}`;
}
