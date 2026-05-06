import assert from "node:assert/strict";
import { createInitialState } from "../state";
import { getRunBlessing } from "../data/runBlessings";
import { deserialize, serialize } from "../storage";
import type { DungeonRunEnemy, DungeonRunOpportunity } from "../types";
import {
  applyRunEventChoice,
  applyRunRewardChoice,
  applyRunRouteChoice,
  enterDungeon,
  eventOptionCheckChance,
  queueDungeonDodge,
  queueDungeonFervor,
  queueDungeonFinisher,
  queueDungeonSkill,
  rerollRunRewardChoices,
  runThreatRewardMult,
  toggleRunRewardLock,
  tickDungeon,
} from "../systems/dungeonRun";
import { playerMaxHp } from "../systems/playerCombat";
import { applyRunReward, buildRunRewardOptions, runBlessingTotals, runBuildVerbProfile, runResonanceLines } from "../systems/runRewards";

function tickUntilChoiceOrEnd(st: ReturnType<typeof createInitialState>, maxTicks = 1200): void {
  let now = Date.now();
  for (let i = 0; i < maxTicks; i += 1) {
    if (!st.dungeon.active) return;
    if (st.dungeon.runPendingRewards.length > 0 || st.dungeon.runPendingEvent || st.dungeon.runPendingRoutes.length > 0) return;
    if (i % 18 === 0) queueDungeonSkill(st);
    if (st.dungeon.runFinisherCharge >= 100) queueDungeonFinisher(st);
    tickDungeon(st, 0.25, now);
    now += 250;
  }
}

function resolveOneChoice(st: ReturnType<typeof createInitialState>): void {
  if (st.dungeon.runPendingRewards.length > 0) {
    const id = st.dungeon.runPendingRewards[0]!.id;
    assert.equal(applyRunRewardChoice(st, id), true, "reward choice should apply");
  } else if (st.dungeon.runPendingEvent) {
    const id = st.dungeon.runPendingEvent.options[0]!.id;
    assert.equal(applyRunEventChoice(st, id), true, "event choice should apply");
  } else if (st.dungeon.runPendingRoutes.length > 0) {
    const id = st.dungeon.runPendingRoutes[0]!.id;
    assert.equal(applyRunRouteChoice(st, id), true, "route choice should apply");
  }
}

function resolveOpeningDraft(st: ReturnType<typeof createInitialState>): void {
  assert.equal(st.dungeon.runOpeningDraft, true, "run should start with opening draft");
  assert.ok(st.dungeon.runPendingRewards.length > 0, "opening draft should offer rewards");
  assert.equal(applyRunRewardChoice(st, st.dungeon.runPendingRewards[0]!.id), true, "opening reward should apply");
  assert.equal(st.dungeon.runOpeningDraft, false, "opening draft should close after choice");
  assert.ok(st.dungeon.runEnemy, "opening draft should lead into first combat");
}

function makeStrongNewState(): ReturnType<typeof createInitialState> {
  const st = createInitialState();
  st.realmLevel = 35;
  st.skills.combat.level = 30;
  st.combatHpCurrent = playerMaxHp(st);
  st.spiritStones = "100000";
  return st;
}

function forceDominantDeck(st: ReturnType<typeof createInitialState>, cardId: string): void {
  st.owned[cardId] = { defId: cardId, stars: 0, level: 1 };
  st.deck = st.deck.map(() => null);
  st.deck[0] = cardId;
}

function runOldSaveResetSmoke(): void {
  const old = createInitialState();
  old.realmLevel = 99;
  old.totalPulls = 888;
  old.dungeon.maxWaveRecord = 77;
  const reset = deserialize(
    JSON.stringify({
      version: 112,
      spiritStones: "999999",
      daoEssence: 0,
      realmLevel: old.realmLevel,
      totalPulls: old.totalPulls,
      pityUr: 0,
      pitySsrSoft: 0,
      owned: {},
      deck: [],
      codexUnlocked: [],
      reincarnations: 0,
      meta: old.meta,
      achievementsDone: [],
      lastTick: Date.now(),
      playtimeSec: 0,
      dungeon: old.dungeon,
    }),
  );
  assert.equal(reset.version, 200, "old save should reset into new season version");
  assert.equal(reset.realmLevel, 1, "old realm should not migrate");
  assert.equal(reset.totalPulls, 0, "old pull count should not migrate");
  assert.equal(reset.dungeon.maxWaveRecord, 0, "old dungeon progress should not migrate");
}

function runDungeonStartRewardEventSmoke(): void {
  const st = makeStrongNewState();
  assert.equal(enterDungeon(st), true, "new run should start");
  assert.equal(st.dungeon.active, true, "run should be active");
  assert.equal(st.dungeon.runNodes.length, 6, "run should create six nodes");
  resolveOpeningDraft(st);
  assert.ok(st.dungeon.runEnemy, "first node should spawn an enemy");
  assert.ok(st.dungeon.runObjective, "combat should spawn a tactical objective");
  tickUntilChoiceOrEnd(st);
  assert.ok(st.dungeon.runPendingRewards.length > 0, "first combat should offer three rewards");
  resolveOneChoice(st);
  assert.ok(st.dungeon.runPendingRoutes.length > 0, "reward should open a route choice");
  resolveOneChoice(st);
  assert.ok(st.dungeon.runPendingEvent || st.dungeon.runEnemy || st.dungeon.runPendingRewards.length > 0, "route should lead into content");
}

function runDungeonVictorySmoke(): void {
  const st = makeStrongNewState();
  assert.equal(enterDungeon(st), true, "run should start");
  resolveOpeningDraft(st);
  for (let guard = 0; guard < 40 && st.dungeon.active; guard += 1) {
    tickUntilChoiceOrEnd(st);
    resolveOneChoice(st);
  }
  assert.equal(st.dungeon.active, false, "strong smoke character should finish the run");
  assert.equal(st.dungeon.runsCompleted, 1, "victory should increment completed runs");
  assert.equal(st.dungeon.runLastOutcome, "victory", "victory should write settlement outcome");
  assert.ok(st.dungeon.runLastSummary.length > 0, "victory settlement should keep summary text");
  assert.ok(st.dungeon.runLastDurationSec >= 0, "victory settlement should record duration");
  assert.ok(st.dungeon.runLastKills > 0, "victory settlement should record kills");
  assert.ok(st.dungeon.runLastEssence >= 0, "victory settlement should record gained essence");
  assert.ok(st.zhuLingEssence >= 0, "zhuLingEssence should stay non-negative");
  assert.ok(Number.isFinite(st.dungeon.runEssenceGained), "run essence should be finite");
}

function runDungeonDefeatSettlementSmoke(): void {
  const st = createInitialState();
  assert.equal(enterDungeon(st), true, "defeat settlement run should start");
  resolveOpeningDraft(st);
  const enemy = st.dungeon.runEnemy;
  assert.ok(enemy, "defeat settlement should have an enemy");
  enemy.hp = enemy.maxHp = 999999;
  enemy.intent = "attack";
  enemy.enrage = 40;
  const now = Date.now();
  enemy.intentAtMs = now;
  st.dungeon.dodgeIframesUntil = 0;
  st.dungeon.runShield = 0;
  st.dungeon.playerHp = 1;
  st.dungeon.runLastStandUsed = true;
  tickDungeon(st, 0.01, now);
  assert.equal(st.dungeon.active, false, "lethal intent should end the run");
  assert.equal(st.dungeon.runsFailed, 1, "defeat should increment failed runs");
  assert.equal(st.dungeon.runLastOutcome, "defeat", "defeat should write settlement outcome");
  assert.ok(st.dungeon.runLastSummary.length > 0, "defeat settlement should keep summary text");
  assert.ok(st.dungeon.runLastDurationSec >= 0, "defeat settlement should record duration");
}

function runLastStandSmoke(): void {
  const st = createInitialState();
  assert.equal(enterDungeon(st), true, "last stand run should start");
  resolveOpeningDraft(st);
  const enemy = st.dungeon.runEnemy;
  assert.ok(enemy, "last stand should have an enemy");
  enemy.hp = enemy.maxHp = 1000;
  enemy.intent = "attack";
  enemy.enrage = 30;
  const now = Date.now();
  enemy.intentAtMs = now;
  st.dungeon.dodgeIframesUntil = 0;
  st.dungeon.runShield = 0;
  st.dungeon.playerHp = 1;
  tickDungeon(st, 0.01, now);
  assert.equal(st.dungeon.active, true, "first lethal hit should not immediately end the run");
  assert.equal(st.dungeon.runLastStandUsed, true, "last stand should be marked used");
  assert.equal(st.dungeon.runPendingEvent?.id, "last-stand", "first lethal hit should open last stand event");
  assert.equal(st.dungeon.runInCombat, false, "last stand choice should pause combat ticking");
  assert.match(st.dungeon.runLog, /濒死逆命/, "last stand should be visible in log");

  const hpBefore = st.dungeon.playerHp;
  assert.equal(applyRunEventChoice(st, "last-stand-heal"), true, "last stand heal choice should apply");
  assert.equal(st.dungeon.runPendingEvent, null, "last stand choice should close event");
  assert.equal(st.dungeon.runInCombat, true, "last stand choice should resume combat");
  assert.ok(st.dungeon.playerHp > hpBefore, "last stand heal should restore hp");
  assert.ok(st.dungeon.runShield > 0, "last stand heal should grant shield");
  assert.match(st.dungeon.runLog, /逆命续战/, "last stand resume should be visible in log");

  st.dungeon.playerHp = 1;
  st.dungeon.runShield = 0;
  const nextEnemy = st.dungeon.runEnemy;
  assert.ok(nextEnemy, "enemy should still exist after last stand");
  nextEnemy.intent = "attack";
  nextEnemy.intentAtMs = now + 100;
  nextEnemy.enrage = 30;
  st.dungeon.dodgeIframesUntil = 0;
  tickDungeon(st, 0.01, now + 100);
  assert.equal(st.dungeon.active, false, "second lethal hit after last stand should fail the run");
  assert.equal(st.dungeon.runsFailed, 1, "post-last-stand defeat should increment failed runs");
}

function runIntentCounterSmoke(): void {
  const st = createInitialState();
  assert.equal(enterDungeon(st), true, "counter smoke run should start");
  resolveOpeningDraft(st);
  const now = Date.now();
  const enemy = st.dungeon.runEnemy;
  assert.ok(enemy, "counter smoke should have an enemy");
  enemy.intent = "attack";
  enemy.intentAtMs = now + 400;
  st.dungeon.runObjective = {
    kind: "perfect_dodge",
    title: "smoke perfect",
    desc: "smoke",
    target: 1,
    progress: 0,
    rewardZhuLingEssence: 3,
    rewardLingSha: 1,
    completed: false,
    startedAtMs: now,
  };
  const zhuBefore = st.zhuLingEssence;
  const finisherBefore = st.dungeon.runFinisherCharge;
  const hpBefore = enemy.hp;
  queueDungeonDodge(st);
  tickDungeon(st, 0.01, now);
  assert.ok(st.dungeon.runFinisherCharge >= 30, "perfect dodge should grant extra finisher charge");
  assert.ok((st.dungeon.runEnemy?.hp ?? 0) < hpBefore, "perfect dodge should counterattack");
  assert.equal(st.dungeon.runObjective.completed, true, "perfect dodge should complete objective");
  assert.ok(st.zhuLingEssence > zhuBefore, "objective should grant zhuLingEssence");

  const nextEnemy = st.dungeon.runEnemy;
  assert.ok(nextEnemy, "enemy should survive low-power counter smoke");
  nextEnemy.intent = "guard";
  nextEnemy.block = 40;
  st.dungeon.runObjective = {
    kind: "skill_counter",
    title: "smoke counter",
    desc: "smoke",
    target: 1,
    progress: 0,
    rewardZhuLingEssence: 3,
    rewardLingSha: 1,
    completed: false,
    startedAtMs: now,
  };
  queueDungeonSkill(st);
  tickDungeon(st, 0.01, now + 100);
  assert.equal(nextEnemy.block, 0, "skill should break guard intent");
  assert.match(st.dungeon.runLog, /破开护势|破绽连携/, "skill counter should be visible in log");
}

function runBlessingResonanceSmoke(): void {
  const st = createInitialState();
  st.dungeon.runBlessings = ["fire_cinder", "fire_overheat"];
  const totals = runBlessingTotals(st);
  assert.ok(totals.atkPct >= 0.28, "fire resonance should add attack");
  assert.ok(totals.critPct >= 0.16, "fire resonance should add crit");
  assert.ok(runResonanceLines(st).some((x) => x.includes("火鸣")), "fire resonance line should render");

  const rewardState = createInitialState();
  rewardState.dungeon.runBlessings = ["water_mirror"];
  const options = buildRunRewardOptions(rewardState);
  assert.ok(options.some((x) => x.blessingId === "water_flowstep"), "reward choices should help finish a resonance");
  assert.ok(options.every((x) => x.blessingId !== "water_mirror"), "reward choices should not repeat owned blessings");
}

function runResonanceSurgeSmoke(): void {
  const st = makeStrongNewState();
  assert.equal(enterDungeon(st), true, "resonance surge run should start");
  resolveOpeningDraft(st);
  st.dungeon.runBlessings = ["fire_cinder"];
  const enemy = st.dungeon.runEnemy;
  assert.ok(enemy, "resonance surge should have a combat to finish");
  enemy.hp = enemy.maxHp = 1;
  tickDungeon(st, 2, Date.now());
  assert.ok(st.dungeon.runPendingRewards.length > 0, "combat should open rewards before resonance surge");
  st.dungeon.duelFervor = 0;
  st.dungeon.runPendingRewards = [
    {
      id: "blessing:fire_overheat",
      kind: "blessing",
      title: "fire",
      desc: "smoke",
      blessingId: "fire_overheat",
    },
  ];
  assert.equal(applyRunRewardChoice(st, "blessing:fire_overheat"), true, "second fire blessing should apply");
  assert.ok(st.dungeon.runBlessings.includes("fire_overheat"), "chosen blessing should be stored");
  assert.ok(st.dungeon.duelFervor >= 45, "second matching blessing should trigger fire resonance fervor");
  assert.match(st.dungeon.runLog, /火鸣共振/, "resonance surge should be visible in log");

  const triple = makeStrongNewState();
  assert.equal(enterDungeon(triple), true, "triple resonance surge run should start");
  resolveOpeningDraft(triple);
  triple.dungeon.runBlessings = ["earth_bulwark", "earth_stoneheart"];
  const tripleEnemy = triple.dungeon.runEnemy;
  assert.ok(tripleEnemy, "triple resonance should have a combat to finish");
  tripleEnemy.hp = tripleEnemy.maxHp = 1;
  tickDungeon(triple, 2, Date.now());
  triple.dungeon.runPendingRewards = [
    {
      id: "blessing:void_spoil",
      kind: "blessing",
      title: "void",
      desc: "smoke",
      blessingId: "void_spoil",
    },
  ];
  assert.equal(applyRunRewardChoice(triple, "blessing:void_spoil"), true, "off-element blessing should not surge");
  assert.doesNotMatch(triple.dungeon.runLog, /土鸣三印/, "off-element reward should not fake a triple surge");
}

function runThreatPressureSmoke(): void {
  const eliteState = makeStrongNewState();
  assert.equal(enterDungeon(eliteState), true, "threat route run should start");
  resolveOpeningDraft(eliteState);
  eliteState.dungeon.runPendingRoutes = [
    {
      id: "smoke:elite",
      title: "smoke elite",
      desc: "smoke",
      nodeType: "elite",
      threatDelta: 16,
      riskEnemyPowerPct: 0.18,
    },
  ];
  const eliteThreatBefore = eliteState.dungeon.runThreat;
  assert.equal(applyRunRouteChoice(eliteState, "smoke:elite"), true, "elite route should apply");
  assert.ok(eliteState.dungeon.runThreat >= eliteThreatBefore + 16, "elite route should raise run threat");
  assert.ok(eliteState.dungeon.runThreat <= 100, "elite route threat should stay capped");
  assert.ok(eliteState.dungeon.runEnemy, "elite route should start a fight");

  const restState = makeStrongNewState();
  assert.equal(enterDungeon(restState), true, "rest route run should start");
  resolveOpeningDraft(restState);
  restState.dungeon.runThreat = 20;
  restState.dungeon.runPendingRoutes = [
    {
      id: "smoke:rest",
      title: "smoke rest",
      desc: "smoke",
      nodeType: "rest",
      threatDelta: -14,
      healPct: 0.2,
    },
  ];
  assert.equal(applyRunRouteChoice(restState, "smoke:rest"), true, "rest route should apply");
  assert.equal(restState.dungeon.runThreat, 6, "rest route should reduce run threat");

  const eventState = makeStrongNewState();
  assert.equal(enterDungeon(eventState), true, "event threat run should start");
  resolveOpeningDraft(eventState);
  eventState.dungeon.runPendingEvent = {
    id: "smoke:event",
    title: "smoke",
    body: "smoke",
    options: [{ id: "risk", title: "risk", desc: "smoke", riskCombat: true, threatDelta: 12 }],
  };
  const eventThreatBefore = eventState.dungeon.runThreat;
  assert.equal(applyRunEventChoice(eventState, "risk"), true, "risk event should apply");
  assert.equal(eventState.dungeon.runThreat, eventThreatBefore + 12, "risk event should raise run threat");
  assert.ok(eventState.dungeon.runThreat <= 100, "risk event threat should stay capped");
  eventState.dungeon.runThreat = 40;
  assert.ok(runThreatRewardMult(eventState) > 1.2, "high threat should improve rewards");
}

function runRestChoiceSmoke(): void {
  const healState = makeStrongNewState();
  assert.equal(enterDungeon(healState), true, "rest heal run should start");
  resolveOpeningDraft(healState);
  healState.dungeon.playerHp = Math.floor(healState.dungeon.playerMax * 0.3);
  healState.dungeon.runThreat = 20;
  healState.dungeon.runPendingRoutes = [{ id: "smoke:rest", title: "smoke rest", desc: "smoke", nodeType: "rest" }];
  assert.equal(applyRunRouteChoice(healState, "smoke:rest"), true, "rest route should apply");
  assert.equal(healState.dungeon.runPendingEvent?.id, "rest-0", "rest route should open rest choices");
  const hpBefore = healState.dungeon.playerHp;
  assert.equal(applyRunEventChoice(healState, "rest-heal"), true, "rest heal choice should apply");
  assert.ok(healState.dungeon.playerHp > hpBefore, "rest heal should restore hp");
  assert.ok(healState.dungeon.runThreat < 20, "rest heal should reduce threat");
  assert.ok(healState.dungeon.runPendingRoutes.length > 0 || healState.dungeon.runEnemy, "rest heal should advance the run");

  const draftState = makeStrongNewState();
  assert.equal(enterDungeon(draftState), true, "rest draft run should start");
  resolveOpeningDraft(draftState);
  draftState.dungeon.runPendingRoutes = [{ id: "smoke:rest", title: "smoke rest", desc: "smoke", nodeType: "rest" }];
  assert.equal(applyRunRouteChoice(draftState, "smoke:rest"), true, "rest route should apply for draft");
  assert.equal(applyRunEventChoice(draftState, "rest-draft"), true, "rest draft choice should apply");
  assert.ok(draftState.dungeon.runPendingRewards.length > 0, "rest draft should open reward choices");
  assert.equal(draftState.dungeon.runPendingEvent, null, "rest draft should close event before reward");
  assert.equal(applyRunRewardChoice(draftState, draftState.dungeon.runPendingRewards[0]!.id), true, "rest draft reward should apply");
  assert.ok(draftState.dungeon.runPendingRoutes.length > 0 || draftState.dungeon.runEnemy, "rest draft reward should advance the run");

  const readyState = makeStrongNewState();
  assert.equal(enterDungeon(readyState), true, "rest ready run should start");
  resolveOpeningDraft(readyState);
  readyState.dungeon.stamina = 20;
  readyState.dungeon.runFinisherCharge = 10;
  readyState.dungeon.runPendingRoutes = [{ id: "smoke:rest", title: "smoke rest", desc: "smoke", nodeType: "rest" }];
  assert.equal(applyRunRouteChoice(readyState, "smoke:rest"), true, "rest route should apply for ready");
  const shieldBefore = readyState.dungeon.runShield;
  assert.equal(applyRunEventChoice(readyState, "rest-ready"), true, "rest ready choice should apply");
  assert.ok(readyState.dungeon.stamina > 20, "rest ready should restore stamina");
  assert.ok(readyState.dungeon.runFinisherCharge >= 55, "rest ready should charge finisher");
  assert.ok(readyState.dungeon.runShield > shieldBefore, "rest ready should grant shield");
}

function runFervorSurgeSmoke(): void {
  const st = makeStrongNewState();
  assert.equal(enterDungeon(st), true, "fervor run should start");
  resolveOpeningDraft(st);
  const enemy = st.dungeon.runEnemy;
  assert.ok(enemy, "fervor run should spawn enemy");
  enemy.hp = enemy.maxHp = 999999;
  st.dungeon.duelFervor = 100;
  st.dungeon.runFinisherCharge = 0;
  const hpBefore = enemy.hp;
  queueDungeonFervor(st);
  tickDungeon(st, 2, Date.now());
  assert.ok((st.dungeon.runEnemy?.hp ?? hpBefore) < hpBefore, "fervor surge should deal damage");
  assert.ok(st.dungeon.duelFervor < 30, "fervor surge should consume the gauge and start rebuilding");
  assert.ok(st.dungeon.runFinisherCharge >= 20, "fervor surge should feed finisher charge");
  assert.ok(!st.dungeon.runFervorQueued, "fervor queue should be consumed");
}

function runComboFlourishSmoke(): void {
  const st = makeStrongNewState();
  assert.equal(enterDungeon(st), true, "combo flourish run should start");
  resolveOpeningDraft(st);
  const enemy = st.dungeon.runEnemy;
  assert.ok(enemy, "combo flourish should have an enemy");
  enemy.hp = enemy.maxHp = 999999;
  st.dungeon.duelComboStacks = 7;
  st.dungeon.duelFervor = 0;
  st.dungeon.runFinisherCharge = 0;
  const hpBefore = enemy.hp;
  tickDungeon(st, 2, Date.now());
  assert.ok(st.dungeon.duelComboStacks >= 8, "attack should advance combo to flourish threshold");
  assert.ok((st.dungeon.runEnemy?.hp ?? hpBefore) < hpBefore, "combo flourish should add damage");
  assert.ok(st.dungeon.duelFervor >= 26, "fire combo flourish should add fervor on top of hit gain");
  assert.match(st.dungeon.runLog, /连击 8|焚火连击/, "combo flourish should be visible in log");
}

function runCounterChainSmoke(): void {
  const st = makeStrongNewState();
  assert.equal(enterDungeon(st), true, "counter chain run should start");
  resolveOpeningDraft(st);
  const now = Date.now();
  const enemy = st.dungeon.runEnemy;
  assert.ok(enemy, "counter chain should have enemy");
  enemy.hp = enemy.maxHp = 999999;
  enemy.intent = "attack";
  enemy.intentAtMs = now + 360;
  queueDungeonDodge(st);
  tickDungeon(st, 0.01, now);
  assert.equal(st.dungeon.runCounterChain, 1, "perfect dodge should add one counter chain");
  assert.equal(st.dungeon.runCounterTempoStreak, 1, "perfect dodge should start counter tempo");

  const nextEnemy = st.dungeon.runEnemy;
  assert.ok(nextEnemy, "enemy should survive first counter");
  nextEnemy.intent = "guard";
  nextEnemy.block = 40;
  const zhuBefore = st.zhuLingEssence;
  const finisherBefore = st.dungeon.runFinisherCharge;
  queueDungeonSkill(st);
  tickDungeon(st, 0.01, now + 100);
  assert.equal(st.dungeon.runCounterChain, 0, "second counter should consume the chain");
  assert.equal(st.dungeon.runCounterTempoStreak, 2, "second counter should keep counter tempo");
  assert.ok(st.dungeon.runCounterTempoPeak >= 2, "counter tempo should record peak");
  assert.ok(st.dungeon.runFinisherCharge > finisherBefore, "counter tempo should grant finisher charge");
  assert.ok(st.dungeon.runTacticalEdgeHits > 0, "counter tempo x2 should arm tactical edge");
  assert.ok(st.zhuLingEssence > zhuBefore, "counter chain should grant zhuLingEssence");
  assert.match(st.dungeon.runLog, /破绽连携/, "counter chain should be visible in log");
  const breakingEnemy = st.dungeon.runEnemy;
  assert.ok(breakingEnemy, "enemy should survive counter tempo break setup");
  breakingEnemy.intent = "guard";
  breakingEnemy.intentAtMs = now + 300;
  tickDungeon(st, 0.01, now + 500);
  assert.equal(st.dungeon.runCounterTempoStreak, 0, "enemy intent should break counter tempo");
  assert.match(st.dungeon.runCounterTempoLast, /破招断连/, "counter tempo break should keep feedback");
}

function runCounterTempoPrizeSmoke(): void {
  const draft = makeStrongNewState();
  draft.dungeon.runCounterTempoPrize = 2;
  const rewards = buildRunRewardOptions(draft, false, false);
  assert.ok(rewards.length > 0, "counter tempo prize should build reward options");
  assert.ok(rewards.every((x) => (x.pickZhuLingBonus ?? 0) > 0), "counter tempo prize should add zhu to every reward");
  assert.ok(rewards.every((x) => (x.pickFinisherBonus ?? 0) >= 24), "counter tempo prize should add finisher to every reward");
  assert.ok(rewards.every((x) => (x.pickTacticalEdgeHits ?? 0) >= 5), "counter tempo prize should arm chase on every reward");
  assert.ok(rewards.some((x) => x.draftHint?.includes("破招战利品 x2")), "reward hints should explain counter tempo prize");
  draft.dungeon.runPendingRewards = rewards;
  assert.equal(applyRunReward(draft, rewards[0]!.id), true, "counter tempo prize reward should apply");
  assert.equal(draft.dungeon.runCounterTempoPrize, 0, "counter tempo prize should be spent on reward choice");
  assert.match(draft.dungeon.runCounterTempoPrizeLast, /破招战利品 x2 已兑现/, "spent counter tempo prize should leave feedback");

  const st = makeStrongNewState();
  assert.equal(enterDungeon(st), true, "counter tempo prize bank run should start");
  resolveOpeningDraft(st);
  const enemy = st.dungeon.runEnemy;
  assert.ok(enemy, "counter tempo prize bank should have enemy");
  enemy.hp = enemy.maxHp = 1;
  st.dungeon.runCounterTempoStreak = 4;
  st.dungeon.runCounterTempoPeak = 4;
  st.dungeon.playerAttackAccum = 999;
  tickDungeon(st, 0.01, Date.now());
  assert.ok(st.dungeon.runPendingRewards.length > 0, "combat clear should open rewards");
  assert.equal(st.dungeon.runCounterTempoPrize, 2, "combat clear should bank counter tempo prize from peak");
  assert.equal(st.dungeon.runCounterTempoStreak, 0, "banking prize should reset current counter tempo");
  assert.equal(st.dungeon.runCounterTempoPeak, 0, "banking prize should reset counter tempo peak for next combat");
}

function runClutchPrizeSmoke(): void {
  const draft = makeStrongNewState();
  draft.dungeon.runClutchPrize = 2;
  draft.dungeon.runNodeIndex = 2;
  const rewards = buildRunRewardOptions(draft, false, false);
  assert.ok(rewards.length > 0, "clutch prize should build reward options");
  assert.ok(rewards.every((x) => (x.pickZhuLingBonus ?? 0) >= 13), "clutch prize should add zhu to every reward");
  assert.ok(rewards.every((x) => (x.pickFinisherBonus ?? 0) >= 22), "clutch prize should add finisher to every reward");
  assert.ok(rewards.every((x) => (x.pickTacticalEdgeHits ?? 0) >= 5), "clutch prize should arm chase on every reward");
  assert.ok(rewards.every((x) => (x.pickThreatDelta ?? 0) <= -2), "clutch prize should reduce threat on every reward");
  assert.ok(rewards.some((x) => x.draftHint?.includes("险境翻盘 x2")), "reward hints should explain clutch prize");
  draft.dungeon.runPendingRewards = rewards;
  assert.equal(applyRunReward(draft, rewards[0]!.id), true, "clutch prize reward should apply");
  assert.equal(draft.dungeon.runClutchPrize, 0, "clutch prize should be spent on reward choice");
  assert.match(draft.dungeon.runClutchPrizeLast, /险境翻盘 x2 已兑现/, "spent clutch prize should leave feedback");

  const st = makeStrongNewState();
  assert.equal(enterDungeon(st), true, "clutch prize bank run should start");
  resolveOpeningDraft(st);
  const enemy = st.dungeon.runEnemy;
  assert.ok(enemy, "clutch prize bank should have enemy");
  enemy.hp = enemy.maxHp = 1;
  st.dungeon.playerHp = Math.floor(st.dungeon.playerMax * 0.2);
  st.dungeon.runLastStandUsed = false;
  st.dungeon.playerAttackAccum = 999;
  tickDungeon(st, 0.01, Date.now());
  assert.ok(st.dungeon.runPendingRewards.length > 0, "low-hp combat clear should open rewards");
  assert.equal(st.dungeon.runClutchPrize, 2, "low-hp combat clear should bank clutch prize");
  assert.match(st.dungeon.runClutchPrizeLast, /险境翻盘 x2/, "clutch bank should leave feedback");
}

function runCounterTempoReboundSmoke(): void {
  const st = makeStrongNewState();
  assert.equal(enterDungeon(st), true, "counter tempo rebound run should start");
  resolveOpeningDraft(st);
  const now = Date.now();
  const enemy = st.dungeon.runEnemy;
  assert.ok(enemy, "counter tempo rebound should have enemy");
  enemy.hp = enemy.maxHp = 999999;
  enemy.intent = "guard";
  enemy.intentAtMs = now - 10;
  st.dungeon.runCounterTempoStreak = 4;
  st.dungeon.runCounterTempoPeak = 4;
  st.dungeon.runOpportunity = null;
  st.dungeon.runOpportunityNextAtMs = now + 500;
  st.dungeon.runFinisherCharge = 0;
  st.dungeon.runSkillCooldownUntil = 0;
  const edgeBefore = st.dungeon.runTacticalEdgeHits;

  tickDungeon(st, 0.01, now);
  const rebound = st.dungeon.runOpportunity as DungeonRunOpportunity | null;
  assert.equal(st.dungeon.runCounterTempoStreak, 0, "enemy intent should break high counter tempo");
  assert.equal(rebound?.source, "counter_tempo_rebound", "break should bank a rebound opportunity");
  assert.equal(rebound?.action, "skill", "low finisher charge should ask for skill rebound");
  assert.match(st.dungeon.runCounterTempoLast, /破招回响/, "rebound should be visible in counter tempo feedback");

  queueDungeonSkill(st);
  tickDungeon(st, 0.01, now + 100);
  assert.equal(st.dungeon.runOpportunity, null, "skill should consume rebound opportunity");
  assert.ok(st.dungeon.runTacticalEdgeHits > edgeBefore, "rebound should arm tactical edge");
  assert.match(st.dungeon.runLog, /破招回响/, "rebound payoff should leave feedback in combat log");
}

function runBossPostureSmoke(): void {
  const st = makeStrongNewState();
  assert.equal(enterDungeon(st), true, "boss posture run should start");
  resolveOpeningDraft(st);
  const enemy = st.dungeon.runEnemy;
  assert.ok(enemy, "boss posture should have an enemy");
  enemy.role = "boss";
  enemy.hp = enemy.maxHp = 999999;
  enemy.intent = "guard";
  enemy.block = 60;
  st.dungeon.runBossPosture = 0;
  st.dungeon.runBossPostureMax = 100;
  st.dungeon.runBossBreaks = 0;
  const now = Date.now();
  queueDungeonSkill(st);
  tickDungeon(st, 0.01, now);
  assert.ok(st.dungeon.runBossPosture >= 42, "skill counter should damage boss posture");
  assert.equal(st.dungeon.runBossBreaks, 0, "first counter should not break full posture");

  const nextEnemy = st.dungeon.runEnemy;
  assert.ok(nextEnemy, "boss should survive posture setup");
  nextEnemy.intent = "enrage";
  nextEnemy.hp = nextEnemy.maxHp;
  st.dungeon.runSkillCooldownUntil = 0;
  st.dungeon.runBossPosture = 88;
  const zhuBefore = st.zhuLingEssence;
  const hpBefore = nextEnemy.hp;
  queueDungeonSkill(st);
  tickDungeon(st, 0.01, now + 1000);
  assert.equal(st.dungeon.runBossBreaks, 1, "counter should break boss posture when gauge fills");
  assert.equal(st.dungeon.runBossPosture, 0, "boss posture should reset after break");
  assert.ok(st.zhuLingEssence > zhuBefore, "boss posture break should grant zhuLingEssence");
  assert.ok((st.dungeon.runEnemy?.hp ?? hpBefore) < hpBefore, "boss posture break should deal damage");
  assert.match(st.dungeon.runLog, /首领破势/, "boss posture break should be visible in log");
}

function runBossBreakChoiceSmoke(): void {
  const st = makeStrongNewState();
  assert.equal(enterDungeon(st), true, "boss break choice run should start");
  resolveOpeningDraft(st);
  const enemy = st.dungeon.runEnemy;
  assert.ok(enemy, "boss break choice should have an enemy");
  st.dungeon.runNodes[st.dungeon.runNodeIndex]!.type = "boss";
  enemy.role = "boss";
  enemy.hp = enemy.maxHp = 999999;
  enemy.intent = "guard";
  enemy.intentAtMs = Date.now() + 999999;
  st.dungeon.runBossPosture = 88;
  st.dungeon.runBossPostureMax = 100;
  st.dungeon.runBossBreaks = 0;
  st.dungeon.runSkillCooldownUntil = 0;
  const zhuBeforeBreak = st.zhuLingEssence;
  queueDungeonSkill(st);
  tickDungeon(st, 0.01, Date.now());
  assert.equal(st.dungeon.runBossBreaks, 1, "boss posture break should increment break count");
  assert.equal(st.dungeon.runInCombat, false, "boss break choice should pause combat");
  assert.equal(st.dungeon.runPendingEvent?.id, "boss-break-1", "boss break should open a break choice event");
  assert.ok(st.zhuLingEssence > zhuBeforeBreak, "boss break should grant immediate essence");

  const zhuBeforeChoice = st.zhuLingEssence;
  const shaBeforeChoice = st.lingSha;
  const rerollBeforeChoice = st.dungeon.runRewardRerolls;
  assert.equal(applyRunEventChoice(st, "boss-break-plunder"), true, "boss break plunder should apply");
  assert.equal(st.dungeon.runPendingEvent, null, "boss break choice should close event");
  assert.equal(st.dungeon.runInCombat, true, "boss break choice should resume combat");
  assert.ok(st.dungeon.runEnemy, "boss should remain after plunder choice");
  assert.ok(st.zhuLingEssence > zhuBeforeChoice, "boss break plunder should grant essence");
  assert.ok(st.lingSha >= shaBeforeChoice + 1, "boss break plunder should grant ling sha");
  assert.ok(st.dungeon.runRewardRerolls >= rerollBeforeChoice + 1, "boss break plunder should grant a reroll");
  assert.match(st.dungeon.runLog, /破绽续战/, "boss break resume should use a break-specific log");
}

function runBossOmenSmoke(): void {
  const st = makeStrongNewState();
  assert.equal(enterDungeon(st), true, "boss omen run should start");
  resolveOpeningDraft(st);
  const enemy = st.dungeon.runEnemy;
  assert.ok(enemy, "boss omen should have an enemy");
  st.dungeon.runNodes[st.dungeon.runNodeIndex]!.type = "boss";
  enemy.role = "boss";
  enemy.maxHp = 999999;
  enemy.hp = Math.floor(enemy.maxHp * 0.65);
  enemy.intentAtMs = Date.now() + 999999;
  st.dungeon.runBossPhase = 1;
  st.dungeon.runBossPosture = 0;
  st.dungeon.runBossPostureMax = 999;
  st.dungeon.runBossOmen = "none";
  tickDungeon(st, 0.01, Date.now());
  assert.equal(st.dungeon.runBossPhase, 2, "boss should enter phase 2 below 66% hp");
  assert.equal(st.dungeon.runBossOmen, "soul-drain", "phase 2 should warn with soul-drain omen");
  assert.ok(st.dungeon.runBossOmenUntilMs > Date.now(), "boss omen should have a deadline");

  const zhuBefore = st.zhuLingEssence;
  queueDungeonSkill(st);
  tickDungeon(st, 0.01, Date.now() + 100);
  assert.notEqual(st.dungeon.runBossOmen, "soul-drain", "matching skill should clear the original soul-drain omen");
  assert.ok(st.zhuLingEssence > zhuBefore, "boss omen counter should grant zhuLingEssence");
  assert.ok(st.dungeon.runBossPosture > 0 || st.dungeon.runBossBreaks > 0, "boss omen counter should damage posture");
  assert.equal(st.dungeon.runBossOmenStreak, 1, "first boss omen counter should start a chain");

  const edgeBeforeChain = st.dungeon.runTacticalEdgeHits;
  const shieldBeforeChain = st.dungeon.runShield;
  st.dungeon.runBossOmen = "soul-drain";
  st.dungeon.runBossOmenUntilMs = Date.now() + 999999;
  st.dungeon.runSkillCooldownUntil = 0;
  queueDungeonSkill(st);
  tickDungeon(st, 0.01, Date.now() + 200);
  assert.equal(st.dungeon.runBossOmenStreak, 2, "second boss omen counter should build a chain");
  assert.ok(st.dungeon.runTacticalEdgeHits > edgeBeforeChain, "boss omen chain should arm chase");
  assert.ok(st.dungeon.runShield > shieldBeforeChain, "boss omen chain should grant shield");
  assert.match(st.dungeon.runBossOmenLast, /劫兆连破 x2/, "boss omen chain should leave readable feedback");

  const fail = makeStrongNewState();
  assert.equal(enterDungeon(fail), true, "boss omen failure run should start");
  resolveOpeningDraft(fail);
  const failEnemy = fail.dungeon.runEnemy;
  assert.ok(failEnemy, "boss omen failure should have an enemy");
  fail.dungeon.runNodes[fail.dungeon.runNodeIndex]!.type = "boss";
  failEnemy.role = "boss";
  failEnemy.hp = failEnemy.maxHp = 999999;
  failEnemy.intentAtMs = Date.now() + 999999;
  fail.dungeon.runBossPhase = 3;
  fail.dungeon.runBossPostureMax = 100;
  fail.dungeon.runBossOmenStreak = 2;
  fail.dungeon.runBossOmenPeak = 2;
  fail.dungeon.runBossOmen = "inferno";
  fail.dungeon.runBossOmenUntilMs = Date.now() - 1;
  const threatBefore = fail.dungeon.runThreat;
  tickDungeon(fail, 0.01, Date.now() + 10);
  assert.equal(fail.dungeon.runBossOmen, "none", "expired boss omen should clear after resolving");
  assert.equal(fail.dungeon.runBossOmenStreak, 0, "failed boss omen should break the chain");
  assert.match(fail.dungeon.runBossOmenLast, /断连/, "failed boss omen should explain chain loss");
  assert.ok(failEnemy.enrage > 0, "failed inferno omen should increase boss enrage");
  assert.ok(fail.dungeon.runThreat > threatBefore, "failed inferno omen should increase threat");
}

function runCombatGradeSmoke(): void {
  const st = makeStrongNewState();
  assert.equal(enterDungeon(st), true, "grade run should start");
  resolveOpeningDraft(st);
  const enemy = st.dungeon.runEnemy;
  assert.ok(enemy, "grade run should spawn enemy");
  enemy.hp = 1;
  enemy.maxHp = 1;
  st.dungeon.playerHp = st.dungeon.playerMax;
  st.dungeon.stamina = 100;
  st.dungeon.duelComboStacks = 8;
  st.dungeon.runThreat = 36;
  if (st.dungeon.runObjective) st.dungeon.runObjective.completed = true;
  const zhuBefore = st.zhuLingEssence;
  tickDungeon(st, 2, Date.now());
  assert.ok(st.dungeon.runPendingRewards.length > 0, "graded combat should still offer rewards");
  assert.notEqual(st.dungeon.runLastGrade, "none", "combat should record a grade");
  assert.ok(st.dungeon.runLastScore > 0, "combat grade should record a score");
  assert.ok(st.zhuLingEssence > zhuBefore, "combat grade should grant extra zhuLingEssence");
  assert.match(st.dungeon.runLog, /评分/, "combat log should show grade feedback");
}

function runMomentumSmoke(): void {
  const st = makeStrongNewState();
  assert.equal(enterDungeon(st), true, "momentum run should start");
  resolveOpeningDraft(st);
  const enemy = st.dungeon.runEnemy;
  assert.ok(enemy, "momentum run should spawn enemy");
  enemy.hp = 1;
  enemy.maxHp = 1;
  st.dungeon.runMomentum = 2;
  st.dungeon.playerHp = st.dungeon.playerMax;
  st.dungeon.stamina = 100;
  st.dungeon.duelComboStacks = 12;
  if (st.dungeon.runObjective) st.dungeon.runObjective.completed = true;
  const zhuBefore = st.zhuLingEssence;
  const rerollBefore = st.dungeon.runRewardRerolls;
  tickDungeon(st, 2, Date.now());
  assert.equal(st.dungeon.runMomentum, 0, "full momentum should be consumed by chase surge");
  assert.ok(st.zhuLingEssence > zhuBefore, "momentum surge should grant zhuLingEssence");
  assert.ok(st.dungeon.runRewardRerolls >= rerollBefore, "momentum surge should not reduce rerolls");
  assert.ok(st.dungeon.runFinisherCharge >= 35, "momentum surge should charge finisher");
  assert.match(st.dungeon.runLog, /乘胜追击/, "momentum surge should be visible in log");
}

function runElementCheckSmoke(): void {
  const weak = createInitialState();
  const strong = createInitialState();
  for (const id of ["n_iron_slag", "n_copper_coin", "r_bronze_bell"]) {
    strong.owned[id] = { defId: id, stars: 0, level: 1 };
  }
  strong.deck[0] = "n_iron_slag";
  strong.deck[1] = "n_copper_coin";
  strong.deck[2] = "r_bronze_bell";
  strong.dungeon.runBlessings = ["metal_sunder"];
  const check = {
    id: "metal_check",
    title: "metal",
    desc: "smoke",
    checkElement: "metal" as const,
    rewardBlessingId: "metal_execution",
  };
  assert.ok(eventOptionCheckChance(strong, check) > eventOptionCheckChance(weak, check), "matching deck should improve event check chance");
  assert.ok(eventOptionCheckChance(strong, check) <= 0.92, "event check chance should stay capped");

  const st = makeStrongNewState();
  assert.equal(enterDungeon(st), true, "element check run should start");
  resolveOpeningDraft(st);
  st.dungeon.runPendingEvent = {
    id: "smoke:check",
    title: "smoke",
    body: "smoke",
    options: [check],
  };
  assert.equal(applyRunEventChoice(st, "metal_check"), true, "element check event should resolve");
  assert.ok(st.dungeon.runPendingRoutes.length > 0 || st.dungeon.runEnemy, "element check should advance the run");
}

function runEventPlanSmoke(): void {
  const st = makeStrongNewState();
  assert.equal(enterDungeon(st), true, "event plan run should start");
  resolveOpeningDraft(st);
  st.dungeon.runStyleStreak = 0;
  st.dungeon.runStylePeak = 0;
  st.dungeon.runFinisherCharge = 0;
  st.dungeon.runShield = 0;
  st.dungeon.runRewardRerolls = 0;
  st.dungeon.runPendingEvent = {
    id: "smoke:event-plan",
    title: "smoke event",
    body: "smoke",
    options: [
      {
        id: "tempo-plan",
        title: "tempo",
        desc: "smoke",
        eventPlan: "tempo",
        eventPreview: "smoke preview",
        eventStyleBonus: 2,
        eventFinisherBonus: 15,
        eventShieldPct: 0.1,
        eventRerollBonus: 1,
        rewardZhuLingEssence: 4,
      },
    ],
  };
  const zhuBefore = st.zhuLingEssence;
  assert.equal(applyRunEventChoice(st, "tempo-plan"), true, "event plan choice should apply");
  assert.equal(st.dungeon.runPendingEvent, null, "event plan should close event");
  assert.ok(st.dungeon.runPendingRoutes.length > 0, "event plan should advance to route choice");
  assert.equal(st.dungeon.runStyleStreak, 2, "event plan should seed style streak");
  assert.equal(st.dungeon.runStylePeak, 2, "event plan should seed style peak");
  assert.ok(st.dungeon.runFinisherCharge >= 15, "event plan should charge finisher");
  assert.ok(st.dungeon.runShield > 0, "event plan should grant shield");
  assert.equal(st.dungeon.runRewardRerolls, 1, "event plan should grant a reroll");
  assert.ok(st.zhuLingEssence >= zhuBefore + 4, "event plan should keep normal event rewards");
  assert.equal(st.dungeon.runEventEchoPlan, "tempo", "event plan should bank a next-combat echo");
  assert.ok(st.dungeon.runEventEchoPower >= 2, "event echo should record useful power");
  const tempoRoute = st.dungeon.runPendingRoutes.find((x) => x.plan === "tempo");
  assert.ok(tempoRoute, "tempo event echo should keep a matching route visible");
  assert.equal(tempoRoute.routeRecommend, true, "matching event echo route should be recommended");
  assert.equal(tempoRoute.routeEchoFit, "match", "matching event echo route should be marked as a fit");
  assert.match(tempoRoute.routeEchoHint ?? "", /余势|浣欏娍/, "matching route should explain the event echo carry");
  assert.match(st.dungeon.runLog, /疾攻事件|身法/, "event plan should be visible in log");
}

function runEventEchoRouteFollowSmoke(): void {
  const st = makeStrongNewState();
  assert.equal(enterDungeon(st), true, "event echo route follow run should start");
  resolveOpeningDraft(st);
  st.dungeon.runEventEchoPlan = "tempo";
  st.dungeon.runEventEchoPower = 2;
  st.dungeon.runPendingRoutes = [
    {
      id: "smoke:tempo-follow",
      title: "tempo follow",
      desc: "smoke",
      nodeType: "event",
      plan: "tempo",
      routeRecommend: true,
      routeStyleBonus: 1,
    },
  ];
  const finisherBefore = st.dungeon.runFinisherCharge;
  assert.equal(applyRunRouteChoice(st, "smoke:tempo-follow"), true, "matching echo route should apply");
  assert.equal(st.dungeon.runPendingEvent != null, true, "event route should open an event without consuming echo");
  assert.equal(st.dungeon.runEventEchoPlan, "tempo", "non-combat matching route should keep event echo banked");
  assert.equal(st.dungeon.runEventEchoPower, 3, "matching route should upgrade event echo power");
  assert.ok(st.dungeon.runFinisherCharge > finisherBefore, "matching route should grant immediate tempo payoff");
  assert.ok(st.dungeon.runRouteRecommendStreak >= 1, "recommended event echo route should feed route streak");
  assert.match(st.dungeon.runEventEchoLast, /余势顺路|浣欏娍/, "route follow should leave readable echo feedback");
}

function runEventEchoSmoke(): void {
  const st = makeStrongNewState();
  assert.equal(enterDungeon(st), true, "event echo run should start");
  resolveOpeningDraft(st);
  st.dungeon.runPendingEvent = {
    id: "smoke:event-echo",
    title: "echo event",
    body: "smoke",
    options: [
      {
        id: "tempo-echo",
        title: "tempo echo",
        desc: "smoke",
        eventPlan: "tempo",
        eventStyleBonus: 2,
        eventFinisherBonus: 18,
      },
    ],
  };
  assert.equal(applyRunEventChoice(st, "tempo-echo"), true, "event echo choice should apply");
  assert.equal(st.dungeon.runEventEchoPlan, "tempo", "event should bank tempo echo");
  assert.ok(st.dungeon.runEventEchoPower >= 2, "event echo should record power");
  const finisherBeforeEcho = st.dungeon.runFinisherCharge;
  const edgeBeforeEcho = st.dungeon.runTacticalEdgeHits;
  st.dungeon.runPendingRoutes = [{ id: "smoke:event-echo-route", title: "echo route", desc: "smoke", nodeType: "combat" }];
  assert.equal(applyRunRouteChoice(st, "smoke:event-echo-route"), true, "event echo should start next combat");
  assert.equal(st.dungeon.runEventEchoPlan, "", "event echo should clear after combat start");
  assert.equal(st.dungeon.runEventEchoPower, 0, "event echo power should clear after combat start");
  assert.ok(st.dungeon.runFinisherCharge > finisherBeforeEcho, "tempo echo should add finisher tempo");
  assert.ok(st.dungeon.runTacticalEdgeHits > edgeBeforeEcho, "tempo echo should arm chase");
  assert.equal(st.dungeon.runOpportunity?.source, "event_echo", "event echo should create an immediate action window");
  assert.equal(st.dungeon.runOpportunity.action, "skill", "tempo echo should ask for a skill action");
  const echoEnemy = st.dungeon.runEnemy;
  assert.ok(echoEnemy, "event echo opportunity should have an enemy");
  echoEnemy.hp = echoEnemy.maxHp = 999999;
  const styleBeforeHit = st.dungeon.runStyleStreak;
  queueDungeonSkill(st);
  tickDungeon(st, 0.01, Date.now());
  assert.equal(st.dungeon.runOpportunity, null, "hitting event echo opportunity should consume it");
  assert.ok(st.dungeon.runStyleStreak > styleBeforeHit, "tempo echo hit should add style");
  assert.match(st.dungeon.runLog, /余势命中|浣欏娍/, "event echo hit should be visible in log");
  assert.match(st.dungeon.runEventEchoLast, /疾攻余势/, "event echo should leave readable feedback");
}

function runEventEchoOpportunitySaveRoundTripSmoke(): void {
  const st = makeStrongNewState();
  const now = Date.now();
  st.dungeon.active = true;
  st.dungeon.runInCombat = true;
  st.dungeon.runEnemy = {
    id: "smoke:echo-save-enemy",
    name: "save echo enemy",
    role: "boss",
    element: "fire",
    hp: 9999,
    maxHp: 9999,
    intent: "attack",
    intentPower: 20,
    intentAtMs: now + 3000,
    nextIntentAtMs: now + 6000,
    block: 0,
    enrage: 0,
  };
  st.dungeon.runOpportunity = {
    action: "skill",
    title: "save echo",
    desc: "save echo desc",
    untilMs: now + 12000,
    rewardZhuLingEssence: 7,
    rewardFinisherCharge: 18,
    rewardStamina: 9,
    damagePct: 0.8,
    source: "event_echo",
    sourcePower: 3,
    sourceVerb: "tempo",
  };
  const loaded = deserialize(serialize(st));
  assert.equal(loaded.dungeon.runOpportunity?.source, "event_echo", "event echo opportunity source should survive save round-trip");
  assert.equal(loaded.dungeon.runOpportunity?.sourcePower, 3, "event echo opportunity power should survive save round-trip");
  assert.equal(loaded.dungeon.runOpportunity?.sourceVerb, "tempo", "event echo opportunity plan should survive save round-trip");
}

function runRewardRerollSmoke(): void {
  const st = makeStrongNewState();
  assert.equal(enterDungeon(st), true, "reroll run should start");
  assert.equal(st.dungeon.runRewardRerolls, 1, "new run should start with one reward reroll");
  assert.equal(rerollRunRewardChoices(st), true, "reward reroll should apply");
  assert.equal(st.dungeon.runRewardRerolls, 0, "reward reroll should be consumed");
  assert.equal(st.dungeon.runPendingRewards.length, 3, "reward reroll should keep three choices");
  assert.equal(rerollRunRewardChoices(st), false, "reroll should fail when no charges remain");
  assert.equal(applyRunRewardChoice(st, st.dungeon.runPendingRewards[0]!.id), true, "opening draft reward should apply after reroll");

  const gradeState = makeStrongNewState();
  assert.equal(enterDungeon(gradeState), true, "grade reroll run should start");
  resolveOpeningDraft(gradeState);
  const enemy = gradeState.dungeon.runEnemy;
  assert.ok(enemy, "grade reroll run should spawn enemy");
  enemy.hp = enemy.maxHp = 1;
  gradeState.dungeon.runRewardRerolls = 1;
  gradeState.dungeon.playerHp = gradeState.dungeon.playerMax;
  gradeState.dungeon.stamina = 100;
  gradeState.dungeon.duelComboStacks = 12;
  gradeState.dungeon.runThreat = 80;
  if (gradeState.dungeon.runObjective) gradeState.dungeon.runObjective.completed = true;
  tickDungeon(gradeState, 2, Date.now());
  assert.equal(gradeState.dungeon.runLastGrade, "s", "strong combat should earn S grade");
  assert.equal(gradeState.dungeon.runRewardRerolls, 2, "S grade should refill reroll up to cap");
}

function runRewardDraftPlanSmoke(): void {
  const st = makeStrongNewState();
  st.dungeon.runBlessings = ["fire_cinder"];
  const rewards = buildRunRewardOptions(st, false, false);
  const pair = rewards.find((x) => x.blessingId === "fire_overheat");
  assert.ok(pair, "reward draft should surface a pairing fire blessing");
  assert.equal(pair.synergyTier, "pair", "pairing reward should be marked as a two-print resonance");
  assert.match(pair.draftHint ?? "", /成套|二印/, "pairing reward should explain the build consequence");
  assert.ok(pair.combatVerb, "pairing reward should expose a combat verb");
  assert.ok(pair.combatHint, "pairing reward should explain the affected combat action");
  assert.ok((pair.pickZhuLingBonus ?? 0) > 0, "pairing reward should carry an immediate draft bonus");
  assert.ok((pair.pickFinisherBonus ?? 0) > 0, "pairing reward should charge finisher as draft tempo");
  assert.ok((pair.pickTacticalEdgeHits ?? 0) > 0, "pairing reward should arm tactical edge tempo");
  assert.ok((pair.pickTacticalEdgeDamagePct ?? 0) > 0, "pairing reward should improve tactical edge damage");

  st.dungeon.runPendingRewards = [pair];
  st.dungeon.runFinisherCharge = 0;
  st.dungeon.runTacticalEdgeHits = 0;
  st.dungeon.runTacticalEdgeDamagePct = 0;
  const zhuBefore = st.zhuLingEssence;
  assert.equal(applyRunReward(st, pair.id), true, "draft reward should apply");
  assert.ok(st.dungeon.runBlessings.includes("fire_overheat"), "chosen reward should enter run blessings");
  const buildProfile = runBuildVerbProfile(st);
  assert.equal(buildProfile[0]?.verb, "爆发", "chosen fire rewards should define the run build identity");
  assert.ok((buildProfile[0]?.count ?? 0) >= 2, "build identity should count matching combat verbs");
  assert.ok(st.zhuLingEssence > zhuBefore, "draft bonus should grant zhu ling essence");
  assert.ok(st.dungeon.runFinisherCharge > 0, "draft bonus should charge finisher");
  assert.ok(st.dungeon.runTacticalEdgeHits > 0, "draft reward should arm tactical edge hits");
  assert.ok(st.dungeon.runTacticalEdgeDamagePct > 0, "draft reward should arm tactical edge damage");
  assert.equal(st.dungeon.runTacticalEdgeLabel, "构筑追击", "draft reward should label build chase");
  assert.match(st.dungeon.runLog, /构筑势能/, "draft bonus should be visible in log");
  assert.match(st.dungeon.runLog, /追击/, "draft bonus log should mention tactical edge");
}

function runRewardLockRerollSmoke(): void {
  const st = makeStrongNewState();
  assert.equal(enterDungeon(st), true, "lock reroll run should start");
  assert.equal(st.dungeon.runPendingRewards.length, 3, "opening draft should have three choices");
  const locked = st.dungeon.runPendingRewards[1]!;
  assert.equal(toggleRunRewardLock(st, locked.id), true, "reward lock should toggle on");
  assert.deepEqual(st.dungeon.runLockedRewardIds, [locked.id], "locked reward id should be stored");
  assert.equal(rerollRunRewardChoices(st), true, "reroll with a lock should apply");
  assert.equal(st.dungeon.runRewardRerolls, 0, "locked reroll should still consume a charge");
  assert.ok(st.dungeon.runPendingRewards.some((x) => x.id === locked.id && x.title === locked.title), "locked reward should survive reroll");
  assert.deepEqual(st.dungeon.runLockedRewardIds, [locked.id], "locked reward id should survive reroll");
  assert.equal(toggleRunRewardLock(st, locked.id), true, "reward lock should toggle off");
  assert.deepEqual(st.dungeon.runLockedRewardIds, [], "unlock should clear lock id");
  assert.equal(applyRunRewardChoice(st, locked.id), true, "locked reward should still be selectable after unlock");
  assert.deepEqual(st.dungeon.runLockedRewardIds, [], "choosing a reward should clear locks");
}

function runRouteScoutingAndAttunementSmoke(): void {
  const st = makeStrongNewState();
  assert.equal(enterDungeon(st), true, "route scouting run should start");
  resolveOpeningDraft(st);
  st.dungeon.runPendingRoutes = [
    {
      id: "smoke:fire-route",
      title: "smoke fire",
      desc: "smoke",
      nodeType: "combat",
      attuneElement: "fire",
      attuneBonusText: "smoke attune",
      forecastEnemyRole: "guard",
      forecastEnemyElement: "water",
      scoutText: "smoke scout",
      plan: "tempo",
      planPreview: "smoke plan",
      routeStyleBonus: 2,
      routeFinisherBonus: 10,
    },
  ];
  const fervorBefore = st.dungeon.duelFervor;
  const shaBefore = st.lingSha;
  st.dungeon.runStyleStreak = 5;
  st.dungeon.runStylePeak = 5;
  st.dungeon.runFinisherCharge = 0;
  assert.equal(applyRunRouteChoice(st, "smoke:fire-route"), true, "scouted attuned route should apply");
  assert.ok(st.dungeon.runEnemy, "scouted combat route should start combat");
  assert.equal(st.dungeon.runEnemy?.role, "guard", "route forecast should control enemy role");
  assert.equal(st.dungeon.runEnemy?.element, "water", "route forecast should control enemy element");
  assert.ok(st.dungeon.duelFervor > fervorBefore, "dominant fire should gain route attunement fervor");
  assert.ok(st.lingSha > shaBefore, "dominant fire should gain route attunement lingSha");
  assert.equal(st.dungeon.runStyleStreak, 2, "route plan should reset previous style and seed the next combat");
  assert.equal(st.dungeon.runStylePeak, 2, "route plan should seed style peak for the next combat");
  assert.ok(st.dungeon.runFinisherCharge >= 10, "route plan should charge finisher");
  assert.match(st.dungeon.runLog, /smoke scout|火行契合/, "route log should include scout and attunement feedback");
}

function runRouteBuildFitSmoke(): void {
  const st = makeStrongNewState();
  assert.equal(enterDungeon(st), true, "route build fit run should start");
  resolveOpeningDraft(st);
  st.dungeon.runBlessings = ["fire_cinder", "fire_overheat"];
  const enemy = st.dungeon.runEnemy;
  assert.ok(enemy, "route build fit should have an enemy");
  enemy.hp = enemy.maxHp = 1;
  tickDungeon(st, 2, Date.now());
  assert.ok(st.dungeon.runPendingRewards.length > 0, "combat should offer rewards before routes");
  assert.equal(applyRunRewardChoice(st, st.dungeon.runPendingRewards[0]!.id), true, "reward choice should advance to routes");
  assert.ok(st.dungeon.runPendingRoutes.length > 0, "next route choices should be generated");
  assert.ok(st.dungeon.runPendingRoutes.every((x) => x.routeBuildHint), "routes should explain fit to current build");
  const elite = st.dungeon.runPendingRoutes.find((x) => x.nodeType === "elite");
  if (elite) {
    assert.equal(elite.routeBuildFit, "match", "explosive build should mark elite route as a match");
  }
}

function runRouteEchoFitSmoke(): void {
  const st = makeStrongNewState();
  assert.equal(enterDungeon(st), true, "route echo fit run should start");
  resolveOpeningDraft(st);
  st.dungeon.runRoleEcho = "guard";
  st.dungeon.runRoleEchoPower = 2;
  const enemy = st.dungeon.runEnemy;
  assert.ok(enemy, "route echo fit should have an enemy");
  enemy.hp = enemy.maxHp = 1;
  tickDungeon(st, 2, Date.now());
  assert.ok(st.dungeon.runPendingRewards.length > 0, "route echo fit should offer rewards");
  assert.equal(applyRunRewardChoice(st, st.dungeon.runPendingRewards[0]!.id), true, "route echo reward should apply");
  assert.ok(st.dungeon.runPendingRoutes.length > 0, "route echo should generate route choices");
  assert.ok(st.dungeon.runPendingRoutes.every((x) => x.routeEchoHint), "pending role echo should annotate every route");
  assert.ok(st.dungeon.runPendingRoutes.some((x) => x.routeEchoHint?.includes("残响")), "route echo hint should mention residual tempo");
  const combat = st.dungeon.runPendingRoutes.find((x) => x.nodeType === "combat" || x.nodeType === "elite");
  if (combat) {
    assert.equal(combat.routeEchoFit, "match", "combat route should mark guard echo as a match");
    assert.ok((combat.routeFinisherBonus ?? 0) >= 10, "guard echo should improve combat route finisher tempo");
  }
}

function runRewardVerbRouteRecommendationSmoke(): void {
  const st = makeStrongNewState();
  assert.equal(enterDungeon(st), true, "reward route recommendation run should start");
  resolveOpeningDraft(st);
  const enemy = st.dungeon.runEnemy;
  assert.ok(enemy, "reward route recommendation should have an enemy");
  enemy.hp = enemy.maxHp = 1;
  tickDungeon(st, 2, Date.now());
  st.dungeon.runPendingRewards = [
    {
      id: "smoke:burst-route",
      kind: "essence",
      title: "smoke burst route",
      desc: "smoke",
      combatVerb: "爆发",
      combatHint: "smoke",
      zhuLingEssence: 1,
    },
  ];
  assert.equal(applyRunRewardChoice(st, "smoke:burst-route"), true, "burst reward should apply and open routes");
  assert.ok(st.dungeon.runPendingRoutes.length > 0, "burst reward should generate route choices");
  const recommended = st.dungeon.runPendingRoutes.find((route) => route.routeRecommend);
  assert.ok(recommended, "reward verb should mark a recommended route");
  assert.equal(recommended.nodeType, "elite", "burst reward should recommend the elite payoff route");
  assert.match(recommended.routeRecommendHint ?? "", /爆发/, "recommended route should explain the reward verb");
  assert.equal(recommended.routeBuildFit, "match", "recommended route should mark build fit as a match");
  assert.ok((recommended.routeFinisherBonus ?? 0) > 18, "recommended route should add an immediate tempo payoff");
  const fervorBefore = st.dungeon.duelFervor;
  assert.equal(applyRunRouteChoice(st, recommended.id), true, "recommended route should be selectable");
  assert.equal(st.dungeon.runRouteRecommendStreak, 1, "following a recommended route should start route recommendation streak");
  assert.match(st.dungeon.runRouteRecommendLast, /顺势行旅 x1/, "recommended route should leave readable streak feedback");
  assert.ok(st.dungeon.runTacticalEdgeHits > 0, "recommended route follow should arm tactical edge");
  assert.ok(st.dungeon.duelFervor > fervorBefore, "recommended route follow should add immediate fervor");

  st.dungeon.runPendingRoutes = [{ id: "smoke:turn-away", title: "smoke turn away", desc: "smoke", nodeType: "event" }];
  assert.equal(applyRunRouteChoice(st, "smoke:turn-away"), true, "non-recommended route should remain selectable");
  assert.equal(st.dungeon.runRouteRecommendStreak, 0, "turning away should break recommendation streak");
  assert.match(st.dungeon.runRouteRecommendLast, /顺势转向/, "turning away should leave readable feedback");
}

function runRouteRecommendRewardSmoke(): void {
  const st = makeStrongNewState();
  st.dungeon.runRouteRecommendStreak = 3;
  st.dungeon.runRouteRecommendPeak = 3;
  st.dungeon.runNodeIndex = 2;
  const rewards = buildRunRewardOptions(st, false, false);
  assert.ok(rewards.length > 0, "route recommendation reward smoke should build reward options");
  assert.ok(rewards.every((x) => (x.pickZhuLingBonus ?? 0) >= 11), "route recommendation streak should add zhu ling to every reward");
  assert.ok(rewards.every((x) => (x.pickFinisherBonus ?? 0) >= 18), "route recommendation streak should add finisher tempo");
  assert.ok(rewards.every((x) => (x.pickTacticalEdgeHits ?? 0) >= 4), "route recommendation streak should arm chase hits");
  assert.ok(rewards.every((x) => (x.pickTacticalEdgeDamagePct ?? 0) >= 0.076), "route recommendation streak should raise chase damage floor");
  assert.ok(rewards.every((x) => (x.pickRerollBonus ?? 0) >= 1), "route recommendation streak should add a reroll at three stacks");
  assert.ok(rewards.some((x) => x.draftHint?.includes("顺势行旅 x3")), "reward hints should explain route recommendation payoff");

  st.dungeon.runPendingRewards = rewards;
  const zhuBefore = st.zhuLingEssence;
  const rerollsBefore = st.dungeon.runRewardRerolls;
  assert.equal(applyRunReward(st, rewards[0]!.id), true, "route recommendation reward should apply");
  assert.ok(st.zhuLingEssence > zhuBefore, "route recommendation reward should pay zhu ling essence");
  assert.ok(st.dungeon.runFinisherCharge >= 18, "route recommendation reward should add finisher tempo");
  assert.ok(st.dungeon.runTacticalEdgeHits >= 4, "route recommendation reward should arm tactical edge");
  assert.ok(st.dungeon.runRewardRerolls > rerollsBefore, "route recommendation reward should grant a reroll");
  assert.ok(st.dungeon.runRewardVerbSurge, "route recommendation reward should bank an opening surge");
  assert.ok(st.dungeon.runRewardVerbSurgePower >= 2, "route recommendation reward surge should scale with streak");
  assert.match(st.dungeon.runRewardVerbSurgeLast, /顺势开战/, "route recommendation reward should explain opening surge");

  const opener = makeStrongNewState();
  assert.equal(enterDungeon(opener), true, "route recommendation opener run should start");
  resolveOpeningDraft(opener);
  opener.dungeon.runRouteRecommendStreak = 3;
  opener.dungeon.runRouteRecommendPeak = 3;
  opener.dungeon.runPendingRewards = [
    {
      id: "smoke:route-surge",
      kind: "essence",
      title: "smoke route surge",
      desc: "smoke",
      combatVerb: "爆发",
      combatHint: "smoke",
      pickZhuLingBonus: 11,
      pickFinisherBonus: 18,
      pickTacticalEdgeHits: 4,
      pickRerollBonus: 1,
    },
  ];
  assert.equal(applyRunReward(opener, "smoke:route-surge"), true, "route surge reward should apply");
  assert.equal(opener.dungeon.runRewardVerbSurge, "爆发", "route surge should carry picked reward verb");
  assert.ok(opener.dungeon.runRewardVerbSurgePower >= 2, "route surge should bank a strong opener");
  opener.dungeon.runEnemy = null;
  opener.dungeon.runInCombat = false;
  opener.dungeon.runPendingRoutes = [{ id: "smoke:route-surge-combat", title: "smoke combat", desc: "smoke", nodeType: "combat", routeRecommend: true }];
  assert.equal(applyRunRouteChoice(opener, "smoke:route-surge-combat"), true, "route surge combat should start");
  assert.equal(opener.dungeon.runOpportunity?.source, "reward_verb_surge", "route surge should become opening opportunity");
  assert.equal(opener.dungeon.runOpportunity?.sourceVerb, "爆发", "opening opportunity should preserve reward verb");
  const openerEnemy = opener.dungeon.runEnemy as DungeonRunEnemy | null;
  assert.ok(openerEnemy, "route surge opener should have an enemy");
  openerEnemy.hp = openerEnemy.maxHp = 999999;
  const flowStreakBefore = opener.dungeon.runRewardVerbStreak;
  const flowRerollsBefore = opener.dungeon.runRewardRerolls;
  const openerAction = opener.dungeon.runOpportunity.action;
  if (openerAction === "dodge") {
    opener.dungeon.stamina = 100;
    queueDungeonDodge(opener);
  } else if (openerAction === "skill") {
    opener.dungeon.runSkillCooldownUntil = 0;
    queueDungeonSkill(opener);
  } else {
    opener.dungeon.runFinisherCharge = 100;
    queueDungeonFinisher(opener);
  }
  tickDungeon(opener, 0.01, Date.now());
  assert.equal(opener.dungeon.runRewardVerbSurge, "", "resolved route surge should be spent");
  assert.ok(opener.dungeon.runRewardVerbStreak > flowStreakBefore, "resolved route surge should raise next route verb flow");
  assert.ok(opener.dungeon.runRewardRerolls >= flowRerollsBefore, "resolved route surge should not lose reward rerolls");
  assert.match(opener.dungeon.runRouteRecommendLast, /顺势开战续航|椤哄娍寮€鎴?/, "resolved route surge should write route continuation feedback");
}

function runRoutePlanObjectiveSmoke(): void {
  const tempo = makeStrongNewState();
  assert.equal(enterDungeon(tempo), true, "route plan objective run should start");
  resolveOpeningDraft(tempo);
  tempo.dungeon.runPendingRoutes = [
    {
      id: "smoke:tempo-plan",
      title: "smoke tempo",
      desc: "smoke",
      nodeType: "combat",
      plan: "tempo",
      routeStyleBonus: 2,
      routeFinisherBonus: 10,
    },
  ];
  assert.equal(applyRunRouteChoice(tempo, "smoke:tempo-plan"), true, "tempo route should apply");
  assert.equal(tempo.dungeon.runObjective?.routePlan, "tempo", "tempo route should stamp objective with route plan");
  assert.equal(tempo.dungeon.runObjective?.kind, "fast_kill", "tempo route should force a fast kill commitment");
  assert.match(tempo.dungeon.runObjective?.title ?? "", /疾攻/, "tempo objective should name the route commitment");
  const enemy = tempo.dungeon.runEnemy;
  assert.ok(enemy, "tempo route should spawn an enemy");
  enemy.hp = enemy.maxHp = 1;
  const zhuBefore = tempo.zhuLingEssence;
  tempo.dungeon.runRoutePledgeStreak = 1;
  tickDungeon(tempo, 2, Date.now());
  assert.ok(tempo.zhuLingEssence > zhuBefore, "completed tempo commitment should pay rewards");
  assert.equal(tempo.dungeon.runRoutePledgeStreak, 2, "completed route commitment should build pledge streak");
  assert.equal(tempo.dungeon.runRoutePledgePeak, 2, "completed route commitment should update pledge peak");
  assert.match(tempo.dungeon.runRoutePledgeLast, /承诺连段 x2|疾攻兑现/, "completed route commitment should write pledge feedback");
  assert.ok(tempo.dungeon.runTacticalEdgeHits > 0, "tempo pledge streak should arm chase tempo");
  assert.match(tempo.dungeon.runLog, /疾攻承诺|战术达成/, "tempo route commitment should be visible in log");

  const risk = makeStrongNewState();
  assert.equal(enterDungeon(risk), true, "risk route objective run should start");
  resolveOpeningDraft(risk);
  risk.dungeon.runPendingRoutes = [
    {
      id: "smoke:risk-plan",
      title: "smoke risk",
      desc: "smoke",
      nodeType: "elite",
      plan: "risk",
      routeFinisherBonus: 18,
    },
  ];
  assert.equal(applyRunRouteChoice(risk, "smoke:risk-plan"), true, "risk route should apply");
  assert.equal(risk.dungeon.runObjective?.routePlan, "risk", "risk route should stamp objective with route plan");
  assert.equal(risk.dungeon.runObjective?.kind, "finisher", "risk route should force a finisher commitment");
  assert.match(risk.dungeon.runObjective?.desc ?? "", /路线承诺/, "risk objective should explain route promise");

  const fail = makeStrongNewState();
  assert.equal(enterDungeon(fail), true, "route pledge failure run should start");
  resolveOpeningDraft(fail);
  fail.dungeon.runRoutePledgeStreak = 2;
  fail.dungeon.runRoutePledgePeak = 2;
  fail.dungeon.runObjective = {
    kind: "fast_kill",
    title: "smoke pledge",
    desc: "smoke",
    target: 1,
    progress: 0,
    rewardZhuLingEssence: 1,
    rewardLingSha: 1,
    completed: false,
    startedAtMs: Date.now() - 2000,
    timeLimitMs: 1000,
    routePlan: "tempo",
  };
  tickDungeon(fail, 0.01, Date.now());
  assert.equal(fail.dungeon.runObjective.failed, true, "expired route pledge should fail");
  assert.equal(fail.dungeon.runRoutePledgeStreak, 0, "failed route pledge should break pledge streak");
  assert.match(fail.dungeon.runRoutePledgeLast, /承诺断连|承诺旁落/, "failed route pledge should leave readable break feedback");
  assert.ok(fail.dungeon.runPledgeReprisal > 0, "failed high pledge should bank a reprisal chance");
  assert.match(fail.dungeon.runPledgeReprisalLast, /破誓反打/, "banked reprisal should leave readable feedback");
}

function runRoutePledgeRewardAndRouteSmoke(): void {
  const reward = makeStrongNewState();
  reward.dungeon.runRoutePledgeStreak = 3;
  reward.dungeon.runRoutePledgePeak = 3;
  reward.dungeon.runNodeIndex = 2;
  const rewards = buildRunRewardOptions(reward, false, false);
  assert.ok(rewards.length > 0, "pledge reward smoke should build reward options");
  assert.ok(rewards.every((x) => (x.pickZhuLingBonus ?? 0) >= 12), "pledge streak should add zhu ling to every reward");
  assert.ok(rewards.every((x) => (x.pickFinisherBonus ?? 0) >= 12), "pledge streak should add finisher tempo to every reward");
  assert.ok(rewards.every((x) => (x.pickTacticalEdgeHits ?? 0) >= 4), "pledge streak should arm chase hits on every reward");
  assert.ok(rewards.every((x) => (x.pickTacticalEdgeDamagePct ?? 0) >= 0.07), "pledge streak should raise chase damage floor");
  assert.ok(rewards.some((x) => x.draftHint?.includes("承诺连段 x3")), "reward hints should explain pledge streak payoff");

  const route = makeStrongNewState();
  assert.equal(enterDungeon(route), true, "pledge route smoke should start");
  resolveOpeningDraft(route);
  route.dungeon.runRoutePledgeStreak = 3;
  route.dungeon.runRoutePledgePeak = 3;
  const enemy = route.dungeon.runEnemy;
  assert.ok(enemy, "pledge route smoke should have an enemy");
  enemy.hp = enemy.maxHp = 1;
  tickDungeon(route, 2, Date.now());
  assert.ok(route.dungeon.runPendingRewards.length > 0, "pledge route smoke should open rewards");
  assert.equal(applyRunRewardChoice(route, route.dungeon.runPendingRewards[0]!.id), true, "pledge reward choice should apply");
  assert.ok(route.dungeon.runPendingRoutes.length > 0, "reward choice should open pledge-boosted routes");
  assert.ok(
    route.dungeon.runPendingRoutes.some((x) => x.planPreview?.includes("承诺连段 x3")),
    "route cards should explain pledge streak opening payoff",
  );
}

function runPledgeReprisalSmoke(): void {
  const st = makeStrongNewState();
  assert.equal(enterDungeon(st), true, "pledge reprisal run should start");
  resolveOpeningDraft(st);
  st.dungeon.runPledgeReprisal = 2;
  st.dungeon.runPendingRoutes = [
    {
      id: "smoke:reprisal-combat",
      title: "smoke reprisal",
      desc: "smoke",
      nodeType: "combat",
      plan: "tempo",
    },
  ];
  assert.equal(applyRunRouteChoice(st, "smoke:reprisal-combat"), true, "reprisal route should start combat");
  assert.equal(st.dungeon.runOpportunity?.source, "pledge_reprisal", "reprisal should become an opening opportunity");
  assert.match(st.dungeon.runOpportunity?.title ?? "", /破誓反打/, "reprisal opportunity should be named");
  assert.match(st.dungeon.runPledgeReprisalLast, /开局出现/, "reprisal start should leave readable feedback");
  const enemy = st.dungeon.runEnemy;
  assert.ok(enemy, "reprisal combat should have enemy");
  enemy.hp = enemy.maxHp = 999999;
  const action = st.dungeon.runOpportunity!.action;
  const threatBefore = st.dungeon.runThreat;
  if (action === "dodge") queueDungeonDodge(st);
  else if (action === "skill") queueDungeonSkill(st);
  else {
    st.dungeon.runFinisherCharge = 100;
    queueDungeonFinisher(st);
  }
  tickDungeon(st, 0.01, Date.now());
  assert.equal(st.dungeon.runPledgeReprisal, 0, "resolved reprisal should be spent");
  assert.ok(st.dungeon.runTacticalEdgeHits > 0, "resolved reprisal should arm chase");
  assert.ok(st.dungeon.runThreat < threatBefore || threatBefore === 0, "resolved reprisal should reduce threat");
  assert.match(st.dungeon.runPledgeReprisalLast, /破誓反打兑现/, "resolved reprisal should write payoff feedback");

  const miss = makeStrongNewState();
  assert.equal(enterDungeon(miss), true, "missed reprisal run should start");
  resolveOpeningDraft(miss);
  miss.dungeon.runPledgeReprisal = 1;
  const missEnemy = miss.dungeon.runEnemy;
  assert.ok(missEnemy, "missed reprisal should have enemy");
  missEnemy.intent = "attack";
  miss.dungeon.runOpportunity = {
    action: "dodge",
    title: "破誓反打",
    desc: "smoke",
    untilMs: Date.now() - 10,
    rewardZhuLingEssence: 1,
    rewardFinisherCharge: 1,
    rewardStamina: 1,
    damagePct: 0.5,
    source: "pledge_reprisal",
    sourcePower: 1,
  };
  tickDungeon(miss, 0.01, Date.now());
  assert.equal(miss.dungeon.runPledgeReprisal, 0, "missed reprisal should be cleared");
  assert.match(miss.dungeon.runPledgeReprisalLast, /错过/, "missed reprisal should explain loss");
}

function runEventBuildFitSmoke(): void {
  const st = makeStrongNewState();
  assert.equal(enterDungeon(st), true, "event build fit run should start");
  resolveOpeningDraft(st);
  st.dungeon.runBlessings = ["fire_cinder", "fire_overheat"];
  st.dungeon.runPendingRoutes = [{ id: "smoke:rest-fit", title: "smoke rest", desc: "smoke", nodeType: "rest" }];
  assert.equal(applyRunRouteChoice(st, "smoke:rest-fit"), true, "rest route should open a fitted event");
  assert.ok(st.dungeon.runPendingEvent, "rest should open event choices");
  const options = st.dungeon.runPendingEvent!.options;
  assert.ok(options.every((x) => x.eventBuildHint), "event choices should explain fit to current build");
  assert.ok(options.some((x) => x.eventBuildFit === "match"), "fire build should mark at least one tempo event as a match");
  assert.ok(options.some((x) => x.eventBuildFit === "risk"), "fire build should mark at least one conservative event as a slower turn");
}

function runEventScoutBindingSmoke(): void {
  const st = makeStrongNewState();
  assert.equal(enterDungeon(st), true, "event scout binding run should start");
  resolveOpeningDraft(st);
  st.dungeon.runPendingRoutes = [
    {
      id: "smoke:event-scout",
      title: "smoke event",
      desc: "smoke",
      nodeType: "event",
      forecastEnemyElement: "water",
    },
  ];
  assert.equal(applyRunRouteChoice(st, "smoke:event-scout"), true, "event route should apply");
  assert.ok(st.dungeon.runPendingEvent, "event route should open a scouted event");
  const hinted = st.dungeon.runPendingEvent!.options.filter((x) => x.eventScoutHint);
  assert.ok(hinted.length > 0, "scouted event should mark matching options");
  assert.ok(
    hinted.every((x) => x.checkElement === "water" || (x.rewardBlessingId && getRunBlessing(x.rewardBlessingId)?.element === "water")),
    "scout hint should only mark options matching the forecast element",
  );
  assert.match(st.dungeon.runLog, /侦察命中|水行/, "event route should report scout binding in the log");
}

function runScoutedCombatObjectiveSmoke(): void {
  const st = makeStrongNewState();
  assert.equal(enterDungeon(st), true, "scouted combat objective run should start");
  resolveOpeningDraft(st);
  st.dungeon.runPendingRoutes = [
    {
      id: "smoke:scouted-guard",
      title: "smoke guard",
      desc: "smoke",
      nodeType: "combat",
      forecastEnemyRole: "guard",
      forecastEnemyElement: "metal",
    },
  ];
  assert.equal(applyRunRouteChoice(st, "smoke:scouted-guard"), true, "scouted combat route should apply");
  assert.equal(st.dungeon.runEnemy?.role, "guard", "scouted combat should spawn forecast role");
  assert.equal(st.dungeon.runEnemy?.element, "metal", "scouted combat should spawn forecast element");
  assert.equal(st.dungeon.runObjective?.kind, "skill_counter", "guard scout should create a skill counter objective");
  assert.equal(st.dungeon.runObjective?.scoutRole, "guard", "objective should retain scouted role");
  assert.equal(st.dungeon.runObjective?.scoutElement, "metal", "objective should retain scouted element");
  assert.ok((st.dungeon.runObjective?.rewardRerolls ?? 0) >= 1, "scouted objective should grant reroll tempo");
  assert.match(st.dungeon.runObjective?.desc ?? "", /侦察/, "scouted objective should explain the forecast payoff");
}

function runWarrantSmoke(): void {
  const st = makeStrongNewState();
  assert.equal(enterDungeon(st), true, "warrant run should start");
  assert.ok(st.dungeon.runWarrant, "new run should create a run warrant");
  resolveOpeningDraft(st);
  st.dungeon.runWarrant = {
    kind: "finishers",
    title: "smoke",
    desc: "smoke",
    target: 1,
    progress: 0,
    completed: false,
    rewardZhuLingEssence: 5,
    rewardLingSha: 1,
    rewardFinisherCharge: 20,
  };
  const enemy = st.dungeon.runEnemy;
  assert.ok(enemy, "warrant smoke should have an enemy");
  enemy.hp = enemy.maxHp = 999999;
  st.dungeon.runFinisherCharge = 100;
  const zhuBefore = st.zhuLingEssence;
  const shaBefore = st.lingSha;
  queueDungeonFinisher(st);
  tickDungeon(st, 0.01, Date.now());
  assert.equal(st.dungeon.runWarrant.completed, true, "finisher warrant should complete");
  assert.equal(st.dungeon.runWarrant.progress, 1, "finisher warrant progress should cap at target");
  assert.ok(st.zhuLingEssence >= zhuBefore + 5, "warrant should grant zhu ling essence");
  assert.equal(st.lingSha, shaBefore + 1, "warrant should grant ling sha");
  assert.ok(st.dungeon.runFinisherCharge >= 20, "warrant should refund finisher charge");
  assert.match(st.dungeon.runLog, /悬赏完成|smoke/, "warrant completion should be visible in combat log");
}

function runOpportunitySmoke(): void {
  const st = makeStrongNewState();
  assert.equal(enterDungeon(st), true, "opportunity run should start");
  resolveOpeningDraft(st);
  const enemy = st.dungeon.runEnemy;
  assert.ok(enemy, "opportunity smoke should have an enemy");
  enemy.hp = enemy.maxHp = 999999;
  enemy.intent = "guard";
  st.dungeon.runOpportunity = {
    action: "skill",
    title: "smoke",
    desc: "smoke",
    untilMs: Date.now() + 3000,
    rewardZhuLingEssence: 7,
    rewardFinisherCharge: 22,
    rewardStamina: 11,
    damagePct: 0.5,
  };
  st.dungeon.stamina = 20;
  st.dungeon.runFinisherCharge = 0;
  const zhuBefore = st.zhuLingEssence;
  const hpBefore = enemy.hp;
  queueDungeonSkill(st);
  tickDungeon(st, 0.01, Date.now());
  assert.equal(st.dungeon.runOpportunity, null, "matching action should consume opportunity");
  assert.ok(st.zhuLingEssence >= zhuBefore + 7, "opportunity should grant zhu ling essence");
  assert.ok(st.dungeon.runFinisherCharge >= 22, "opportunity should charge finisher");
  assert.ok(st.dungeon.stamina >= 31, "opportunity should refund stamina");
  assert.ok((st.dungeon.runEnemy?.hp ?? hpBefore) < hpBefore, "opportunity should deal damage");
  assert.match(st.dungeon.runLog, /smoke|战机/, "opportunity feedback should be visible in log");

  const auto = makeStrongNewState();
  assert.equal(enterDungeon(auto), true, "auto opportunity run should start");
  resolveOpeningDraft(auto);
  assert.ok(auto.dungeon.runEnemy, "auto opportunity should have an enemy");
  auto.dungeon.runOpportunityNextAtMs = Date.now() - 1;
  tickDungeon(auto, 0.01, Date.now());
  assert.ok(auto.dungeon.runOpportunity, "combat tick should open an opportunity window");
}

function runElementalFinisherSmoke(): void {
  const earth = makeStrongNewState();
  assert.equal(enterDungeon(earth), true, "earth finisher run should start");
  resolveOpeningDraft(earth);
  earth.owned.n_clod = { defId: "n_clod", stars: 0, level: 1 };
  earth.deck = ["n_clod", "n_clod", "n_clod", "n_clod", "n_clod"];
  earth.dungeon.runBlessings = ["earth_bulwark", "earth_stoneheart"];
  earth.dungeon.runThreat = 12;
  earth.dungeon.runShield = 0;
  earth.dungeon.runFinisherCharge = 100;
  const earthEnemy = earth.dungeon.runEnemy;
  assert.ok(earthEnemy, "earth finisher should have an enemy");
  earthEnemy.hp = earthEnemy.maxHp = 999999;
  earthEnemy.intent = "guard";
  const earthHpBefore = earthEnemy.hp;
  queueDungeonFinisher(earth);
  tickDungeon(earth, 0.01, Date.now());
  assert.ok(earth.dungeon.runShield > 0, "earth finisher should grant a shield");
  assert.ok(earth.dungeon.runThreat <= 10, "earth finisher should lower threat");
  assert.ok((earth.dungeon.runEnemy?.hp ?? earthHpBefore) < earthHpBefore, "earth finisher should deal damage");

  const fire = makeStrongNewState();
  assert.equal(enterDungeon(fire), true, "fire finisher run should start");
  resolveOpeningDraft(fire);
  fire.owned.n_spark = { defId: "n_spark", stars: 0, level: 1 };
  fire.deck = ["n_spark", "n_spark", "n_spark", "n_spark", "n_spark"];
  fire.dungeon.runBlessings = ["fire_cinder", "fire_overheat"];
  fire.dungeon.duelFervor = 0;
  fire.dungeon.runFinisherCharge = 100;
  const fireEnemy = fire.dungeon.runEnemy;
  assert.ok(fireEnemy, "fire finisher should have an enemy");
  fireEnemy.hp = fireEnemy.maxHp = 999999;
  const fireHpBefore = fireEnemy.hp;
  queueDungeonFinisher(fire);
  tickDungeon(fire, 0.01, Date.now());
  assert.ok(fire.dungeon.duelFervor >= 18, "fire finisher should rebuild fervor");
  assert.ok((fire.dungeon.runEnemy?.hp ?? fireHpBefore) < fireHpBefore, "fire finisher should deal damage");
}

function runStyleStreakSmoke(): void {
  const st = makeStrongNewState();
  assert.equal(enterDungeon(st), true, "style streak run should start");
  resolveOpeningDraft(st);
  const enemy = st.dungeon.runEnemy;
  assert.ok(enemy, "style streak smoke should have an enemy");
  enemy.hp = enemy.maxHp = 999999;
  enemy.intent = "guard";
  st.dungeon.runOpportunity = {
    action: "skill",
    title: "style smoke",
    desc: "style smoke",
    untilMs: Date.now() + 3000,
    rewardZhuLingEssence: 4,
    rewardFinisherCharge: 12,
    rewardStamina: 8,
    damagePct: 0.25,
  };
  st.dungeon.stamina = 20;
  st.dungeon.runFinisherCharge = 0;
  const zhuBefore = st.zhuLingEssence;
  queueDungeonSkill(st);
  tickDungeon(st, 0.01, Date.now());
  assert.ok(st.dungeon.runStyleStreak >= 3, "opportunity plus counter should build style streak");
  assert.ok(st.dungeon.runStylePeak >= st.dungeon.runStyleStreak, "style peak should track the best streak");
  assert.ok(st.zhuLingEssence > zhuBefore + 4, "style tier should grant extra zhu ling essence");
  assert.match(st.dungeon.runLog, /身法/, "style feedback should be visible in log");

  const peakBeforeHit = st.dungeon.runStylePeak;
  const liveEnemy = st.dungeon.runEnemy;
  assert.ok(liveEnemy, "style streak enemy should survive first action");
  liveEnemy.intent = "attack";
  liveEnemy.intentAtMs = Date.now();
  liveEnemy.enrage = 0;
  st.dungeon.dodgeIframesUntil = 0;
  st.dungeon.runShield = 0;
  tickDungeon(st, 0.01, Date.now() + 10);
  assert.equal(st.dungeon.runStyleStreak, 0, "taking damage should break current style streak");
  assert.ok(st.dungeon.runStylePeak >= peakBeforeHit, "taking damage should not erase peak style for grade preview");

  const finishEnemy = st.dungeon.runEnemy;
  assert.ok(finishEnemy, "style grade enemy should still exist");
  finishEnemy.hp = finishEnemy.maxHp = 1;
  st.dungeon.playerHp = st.dungeon.playerMax;
  st.dungeon.stamina = 100;
  tickDungeon(st, 2, Date.now() + 1000);
  assert.match(st.dungeon.runLog, /身法峰值/, "combat grade should include style peak feedback");
}

function runActionWeaveSmoke(): void {
  const st = makeStrongNewState();
  assert.equal(enterDungeon(st), true, "action weave run should start");
  resolveOpeningDraft(st);
  const enemy = st.dungeon.runEnemy;
  assert.ok(enemy, "action weave smoke should have an enemy");
  enemy.hp = enemy.maxHp = 999999;
  st.dungeon.stamina = 100;
  st.dungeon.runSkillCooldownUntil = 0;
  st.dungeon.runFinisherCharge = 0;

  const now = Date.now();
  enemy.intent = "attack";
  enemy.intentAtMs = now + 350;
  queueDungeonDodge(st);
  tickDungeon(st, 0.01, now);
  assert.equal(st.dungeon.runActionWeaveMask & 1, 1, "dodge should mark the first weave slot");
  assert.match(st.dungeon.runActionWeaveLast, /万象三式/, "dodge should expose weave feedback");

  const afterDodgeEnemy = st.dungeon.runEnemy;
  assert.ok(afterDodgeEnemy, "enemy should survive dodge weave");
  afterDodgeEnemy.intent = "guard";
  afterDodgeEnemy.intentAtMs = now + 4000;
  st.dungeon.runSkillCooldownUntil = 0;
  queueDungeonSkill(st);
  tickDungeon(st, 0.01, now + 100);
  assert.equal(st.dungeon.runActionWeaveMask & 3, 3, "skill should mark the second weave slot");

  const afterSkillEnemy = st.dungeon.runEnemy;
  assert.ok(afterSkillEnemy, "enemy should survive skill weave");
  afterSkillEnemy.intent = "guard";
  afterSkillEnemy.intentAtMs = now + 4000;
  st.dungeon.runFinisherCharge = 100;
  const zhuBefore = st.zhuLingEssence;
  const edgeBefore = st.dungeon.runTacticalEdgeHits;
  queueDungeonFinisher(st);
  tickDungeon(st, 0.01, now + 200);
  assert.equal(st.dungeon.runActionWeaveMask, 0, "finisher should consume a complete weave");
  assert.equal(st.dungeon.runActionWeaveStreak, 1, "complete weave should add streak");
  assert.ok(st.dungeon.runActionWeavePeak >= 1, "complete weave should track peak");
  assert.equal(st.dungeon.runActionWeavePrize, 1, "complete weave should bank a reward contract");
  assert.ok(st.zhuLingEssence > zhuBefore, "complete weave should pay zhu ling essence");
  assert.ok(st.dungeon.runTacticalEdgeHits > edgeBefore, "complete weave should grant tactical edge");
  assert.ok(st.dungeon.runActionWeaveLast.includes("x1"), "complete weave should be visible in action weave feedback");

  const rewardEnemy = st.dungeon.runEnemy;
  assert.ok(rewardEnemy, "enemy should survive long enough to test weave reward");
  rewardEnemy.hp = rewardEnemy.maxHp = 1;
  tickDungeon(st, 2, now + 1000);
  assert.ok(st.dungeon.runPendingRewards.length > 0, "weave prize should lead into a reward draft");
  assert.ok(st.dungeon.runPendingRewards.some((x) => x.draftHint?.includes("万象灵契")), "reward draft should surface weave contract value");
  const beforePickZhu = st.zhuLingEssence;
  assert.equal(applyRunRewardChoice(st, st.dungeon.runPendingRewards[0]!.id), true, "weave reward should be pickable");
  assert.equal(st.dungeon.runActionWeavePrize, 0, "weave contract should be spent on reward pick");
  assert.match(st.dungeon.runActionWeavePrizeLast, /万象灵契/, "spent weave contract should leave feedback");
  assert.ok(st.zhuLingEssence > beforePickZhu, "weave contract should add reward zhu ling essence");
  assert.ok(st.dungeon.runRewardVerbSurgePower >= 1, "spent weave contract should bank a next-combat opener");
  let combatRoute = st.dungeon.runPendingRoutes.find((x) => x.nodeType === "combat" || x.nodeType === "elite");
  if (!combatRoute) {
    st.dungeon.runPendingRoutes = [
      { id: "smoke:weave-opener-combat", title: "smoke", desc: "smoke", nodeType: "combat" },
    ];
    combatRoute = st.dungeon.runPendingRoutes[0];
  }
  assert.ok(combatRoute, "weave opener smoke should find a combat route");
  assert.equal(applyRunRouteChoice(st, combatRoute.id), true, "combat route should start after weave reward");
  assert.equal(st.dungeon.runOpportunity?.source, "reward_verb_surge", "weave contract should create an opening opportunity");
  const openerAction = st.dungeon.runOpportunity.action;
  if (openerAction === "dodge") {
    st.dungeon.stamina = 100;
    queueDungeonDodge(st);
  } else if (openerAction === "skill") {
    st.dungeon.runSkillCooldownUntil = 0;
    queueDungeonSkill(st);
  } else {
    st.dungeon.runFinisherCharge = 100;
    queueDungeonFinisher(st);
  }
  const weaveMaskBeforeOpener = st.dungeon.runActionWeaveMask;
  const weaveZhuBeforeOpener = st.zhuLingEssence;
  tickDungeon(st, 0.01, now + 1500);
  assert.equal(st.dungeon.runRewardVerbSurgePower, 0, "opener should spend the banked weave surge");
  assert.ok(st.dungeon.runTacticalEdgeHits > 0, "opener should roll into tactical edge pressure");
  assert.ok(st.dungeon.runActionWeaveMask !== weaveMaskBeforeOpener || st.dungeon.runActionWeaveLast.length > 0, "weave opener should feed back into action weave");
  assert.ok(st.zhuLingEssence > weaveZhuBeforeOpener, "weave opener should add a hit reward");

  const miss = makeStrongNewState();
  assert.equal(enterDungeon(miss), true, "missed weave opener run should start");
  resolveOpeningDraft(miss);
  miss.dungeon.runActionWeaveMask = 3;
  miss.dungeon.runActionWeavePrizeLast = "万象灵契 x1 已兑现：下一场触发终结开战。";
  miss.dungeon.runRewardVerbSurgeLast = miss.dungeon.runActionWeavePrizeLast;
  miss.dungeon.runRewardVerbSurge = "终结";
  miss.dungeon.runRewardVerbSurgePower = 1;
  miss.dungeon.runOpportunity = {
    action: "skill",
    title: "三式开战",
    desc: "smoke",
    untilMs: Date.now() - 10,
    rewardZhuLingEssence: 1,
    rewardFinisherCharge: 1,
    rewardStamina: 1,
    damagePct: 0.5,
    source: "reward_verb_surge",
    sourcePower: 1,
    sourceVerb: "终结",
  };
  tickDungeon(miss, 0.01, Date.now());
  assert.equal(miss.dungeon.runRewardVerbSurge, "", "missed weave opener should clear banked surge");
  assert.equal(miss.dungeon.runActionWeaveMask, 0, "missed weave opener should clear action weave progress");
  assert.ok(miss.dungeon.runActionWeaveLast.length > 0, "missed weave opener should leave action weave feedback");
}

function runEnemyRoleTrophySmoke(): void {
  const guard = makeStrongNewState();
  assert.equal(enterDungeon(guard), true, "guard trophy run should start");
  resolveOpeningDraft(guard);
  const guardEnemy = guard.dungeon.runEnemy;
  assert.ok(guardEnemy, "guard trophy run should have an enemy");
  guardEnemy.role = "guard";
  guardEnemy.hp = guardEnemy.maxHp = 1;
  guard.dungeon.runFinisherCharge = 0;
  const guardZhuBefore = guard.zhuLingEssence;
  tickDungeon(guard, 2, Date.now());
  assert.ok(guard.dungeon.runPendingRewards.length > 0, "guard trophy should still open reward draft");
  assert.ok(guard.dungeon.runFinisherCharge >= 16, "guard trophy should add finisher charge");
  assert.ok(guard.zhuLingEssence > guardZhuBefore, "guard trophy should add zhu ling essence");
  assert.match(guard.dungeon.runLog, /护卫战果|破甲/, "guard trophy should be visible in log");
  assert.equal(guard.dungeon.runRoleEcho, "guard", "guard trophy should bank a role echo");
  assert.ok(guard.dungeon.runRoleEchoPower >= 1, "guard trophy should store role echo power");
  const echoPower = guard.dungeon.runRoleEchoPower;
  assert.equal(applyRunRewardChoice(guard, guard.dungeon.runPendingRewards[0]!.id), true, "guard echo reward should apply");
  if (guard.dungeon.runPendingRoutes.length > 0) {
    const route = guard.dungeon.runPendingRoutes.find((x) => x.nodeType === "combat" || x.nodeType === "elite") ?? guard.dungeon.runPendingRoutes[0]!;
    route.nodeType = "combat";
    assert.equal(applyRunRouteChoice(guard, route.id), true, "guard echo route should start next combat");
  }
  assert.ok(guard.dungeon.runEnemy, "guard role echo should lead into next combat");
  assert.equal(guard.dungeon.runRoleEcho, null, "role echo should be spent on the next combat");
  assert.equal(guard.dungeon.runRoleEchoPower, 0, "spent role echo should clear power");
  assert.ok(guard.dungeon.runTacticalEdgeHits >= echoPower + 1, "guard role echo should arm opening chase");
  assert.match(guard.dungeon.runRoleEchoLast, /破甲残响/, "spent guard echo should leave readable feedback");

  const drain = makeStrongNewState();
  assert.equal(enterDungeon(drain), true, "drain trophy run should start");
  resolveOpeningDraft(drain);
  const drainEnemy = drain.dungeon.runEnemy;
  assert.ok(drainEnemy, "drain trophy run should have an enemy");
  drainEnemy.role = "drain";
  drainEnemy.hp = drainEnemy.maxHp = 1;
  drain.dungeon.runThreat = 24;
  const lingShaBefore = drain.lingSha;
  const threatBefore = drain.dungeon.runThreat;
  tickDungeon(drain, 2, Date.now());
  assert.ok(drain.lingSha >= lingShaBefore + 1, "drain trophy should return ling sha");
  assert.ok(drain.dungeon.runThreat < threatBefore, "drain trophy should reduce threat");
  assert.match(drain.dungeon.runLog, /汲灵战果|返还|夺回/, "drain trophy should be visible in log");
  assert.equal(drain.dungeon.runRoleEcho, "drain", "drain trophy should bank a return-spirit echo");
  assert.ok(drain.dungeon.runRoleEchoPower >= 1, "drain trophy should store role echo power");
}

function runEnemyRoleBehaviorSmoke(): void {
  const ranged = makeStrongNewState();
  assert.equal(enterDungeon(ranged), true, "ranged behavior run should start");
  resolveOpeningDraft(ranged);
  const rangedEnemy = ranged.dungeon.runEnemy;
  assert.ok(rangedEnemy, "ranged behavior run should have an enemy");
  rangedEnemy.role = "ranged";
  rangedEnemy.intent = "attack";
  rangedEnemy.hp = rangedEnemy.maxHp = 999999;
  rangedEnemy.intentAtMs = Date.now() + 500;
  ranged.dungeon.stamina = 60;
  ranged.dungeon.runFinisherCharge = 0;
  queueDungeonDodge(ranged);
  tickDungeon(ranged, 0.01, Date.now());
  assert.ok(ranged.dungeon.runFinisherCharge >= 45, "ranged perfect dodge should grant role counter finisher");
  assert.ok(ranged.dungeon.stamina >= 34, "ranged perfect dodge should refund extra stamina after dodge cost");
  assert.ok(ranged.dungeon.runStyleStreak >= 2, "ranged perfect dodge should build style");

  const guard = makeStrongNewState();
  assert.equal(enterDungeon(guard), true, "guard behavior run should start");
  resolveOpeningDraft(guard);
  const guardEnemy = guard.dungeon.runEnemy;
  assert.ok(guardEnemy, "guard behavior run should have an enemy");
  guardEnemy.role = "guard";
  guardEnemy.intent = "guard";
  guardEnemy.maxHp = 1000;
  guardEnemy.hp = 1000;
  guardEnemy.intentAtMs = Date.now();
  tickDungeon(guard, 0.01, Date.now() + 10);
  assert.ok(guardEnemy.block >= 220, "guard role should form thicker block");
  assert.ok(guardEnemy.enrage > 0, "guard role should gain pressure while guarding");

  const drain = makeStrongNewState();
  assert.equal(enterDungeon(drain), true, "drain behavior run should start");
  resolveOpeningDraft(drain);
  const drainEnemy = drain.dungeon.runEnemy;
  assert.ok(drainEnemy, "drain behavior run should have an enemy");
  drainEnemy.role = "drain";
  drainEnemy.intent = "drain";
  drainEnemy.hp = drainEnemy.maxHp = 999999;
  drain.dungeon.runThreat = 20;
  const zhuBefore = drain.zhuLingEssence;
  const shaBefore = drain.lingSha;
  const threatBefore = drain.dungeon.runThreat;
  queueDungeonSkill(drain);
  tickDungeon(drain, 0.01, Date.now());
  assert.ok(drain.zhuLingEssence > zhuBefore, "drain skill counter should return zhu ling essence");
  assert.ok(drain.lingSha >= shaBefore + 1, "drain skill counter should grant ling sha");
  assert.ok(drain.dungeon.runThreat < threatBefore, "drain skill counter should reduce threat");
}

function runRoleReadStreakSmoke(): void {
  const st = makeStrongNewState();
  assert.equal(enterDungeon(st), true, "role read streak run should start");
  resolveOpeningDraft(st);
  const now = Date.now();
  const enemy = st.dungeon.runEnemy;
  assert.ok(enemy, "role read streak should have an enemy");
  enemy.role = "guard";
  enemy.intent = "guard";
  enemy.hp = enemy.maxHp = 999999;
  enemy.block = 80;
  st.dungeon.runSkillCooldownUntil = 0;
  st.dungeon.runTacticalEdgeHits = 0;
  st.dungeon.runTacticalEdgeDamagePct = 0;
  st.dungeon.runRoleReadRole = null;
  st.dungeon.runRoleReadStreak = 0;
  queueDungeonSkill(st);
  tickDungeon(st, 0.01, now);
  assert.equal(st.dungeon.runRoleReadRole, "guard", "first guard counter should start role read");
  assert.equal(st.dungeon.runRoleReadStreak, 1, "first guard counter should be role read x1");
  assert.match(st.dungeon.runRoleReadLast, /识破/, "first role read should leave readable feedback");

  const sameEnemy = st.dungeon.runEnemy;
  assert.ok(sameEnemy, "enemy should survive role read streak");
  sameEnemy.intent = "guard";
  sameEnemy.block = 80;
  st.dungeon.runSkillCooldownUntil = 0;
  const edgeBefore = st.dungeon.runTacticalEdgeHits;
  queueDungeonSkill(st);
  tickDungeon(st, 0.01, now + 100);
  assert.equal(st.dungeon.runRoleReadRole, "guard", "second same-role counter should keep role read role");
  assert.equal(st.dungeon.runRoleReadStreak, 2, "second same-role counter should increase role read");
  assert.ok(st.dungeon.runRoleReadPeak >= 2, "role read should track peak");
  assert.ok(st.dungeon.runTacticalEdgeHits > edgeBefore, "role read x2 should arm tactical edge");
  assert.match(st.dungeon.runRoleReadLast, /识破 x2|护卫识破/, "role read payoff should keep visible feedback");

  const breaker = st.dungeon.runEnemy;
  assert.ok(breaker, "enemy should survive role read break setup");
  breaker.intent = "enrage";
  breaker.intentAtMs = now + 250;
  tickDungeon(st, 0.01, now + 500);
  assert.equal(st.dungeon.runRoleReadRole, null, "enemy intent should clear current role read");
  assert.equal(st.dungeon.runRoleReadStreak, 0, "enemy intent should break role read streak");
  assert.match(st.dungeon.runRoleReadLast, /断势/, "role read break should leave feedback");
}

function runRoleReadPrizeSmoke(): void {
  const draft = makeStrongNewState();
  draft.dungeon.runRoleReadPrizeRole = "guard";
  draft.dungeon.runRoleReadPrizePower = 2;
  draft.dungeon.runNodeIndex = 2;
  const rewards = buildRunRewardOptions(draft, false, false);
  assert.ok(rewards.length > 0, "role read prize should build reward options");
  assert.ok(rewards.every((x) => (x.pickZhuLingBonus ?? 0) >= 10), "role read prize should add zhu to every reward");
  assert.ok(rewards.every((x) => (x.pickFinisherBonus ?? 0) >= 20), "role read prize should add finisher to every reward");
  assert.ok(rewards.every((x) => (x.pickTacticalEdgeHits ?? 0) >= 5), "role read prize should arm chase on every reward");
  assert.ok(rewards.some((x) => x.draftHint?.includes("护卫识破手札 x2")), "reward hints should explain role read prize");
  draft.dungeon.runPendingRewards = rewards;
  assert.equal(applyRunReward(draft, rewards[0]!.id), true, "role read prize reward should apply");
  assert.equal(draft.dungeon.runRoleReadPrizeRole, null, "role read prize should be spent on reward choice");
  assert.equal(draft.dungeon.runRoleReadPrizePower, 0, "spent role read prize should clear power");
  assert.match(draft.dungeon.runRoleReadPrizeLast, /护卫识破手札 x2 已兑现/, "spent role read prize should leave feedback");

  const st = makeStrongNewState();
  assert.equal(enterDungeon(st), true, "role read prize bank run should start");
  resolveOpeningDraft(st);
  const enemy = st.dungeon.runEnemy;
  assert.ok(enemy, "role read prize bank should have enemy");
  enemy.role = "guard";
  enemy.hp = enemy.maxHp = 1;
  st.dungeon.runRoleReadRole = "guard";
  st.dungeon.runRoleReadStreak = 4;
  st.dungeon.runRoleReadPeak = 4;
  st.dungeon.playerAttackAccum = 999;
  tickDungeon(st, 0.01, Date.now());
  assert.ok(st.dungeon.runPendingRewards.length > 0, "combat clear should open rewards");
  assert.equal(st.dungeon.runRoleReadPrizeRole, "guard", "combat clear should bank role read prize role");
  assert.equal(st.dungeon.runRoleReadPrizePower, 2, "combat clear should bank role read prize power from peak");
  assert.equal(st.dungeon.runRoleReadStreak, 0, "banking role read prize should reset current read streak");
  assert.equal(st.dungeon.runRoleReadPeak, 0, "banking role read prize should reset read peak");
}

function runObjectiveTempoRewardSmoke(): void {
  const dodge = makeStrongNewState();
  assert.equal(enterDungeon(dodge), true, "objective tempo reward run should start");
  resolveOpeningDraft(dodge);
  const dodgeEnemy = dodge.dungeon.runEnemy;
  assert.ok(dodgeEnemy, "objective tempo reward run should have an enemy");
  dodgeEnemy.role = "ranged";
  dodgeEnemy.intent = "attack";
  dodgeEnemy.hp = dodgeEnemy.maxHp = 999999;
  dodgeEnemy.intentAtMs = Date.now() + 500;
  dodge.dungeon.runObjective = {
    kind: "perfect_dodge",
    title: "smoke objective",
    desc: "smoke",
    target: 1,
    progress: 0,
    rewardZhuLingEssence: 7,
    rewardLingSha: 1,
    rewardFinisherCharge: 18,
    rewardStyle: 2,
    completed: false,
    startedAtMs: Date.now(),
  };
  dodge.dungeon.stamina = 80;
  dodge.dungeon.runFinisherCharge = 0;
  const zhuBefore = dodge.zhuLingEssence;
  const shaBefore = dodge.lingSha;
  queueDungeonDodge(dodge);
  tickDungeon(dodge, 0.01, Date.now());
  assert.equal(dodge.dungeon.runObjective.completed, true, "objective should complete from perfect dodge");
  assert.equal(dodge.dungeon.runObjectiveStreak, 1, "first completed objective should start tactical streak");
  assert.equal(dodge.dungeon.runObjectivePeak, 1, "objective peak should track completed streak");
  assert.ok(dodge.dungeon.runTacticalEdgeHits > 0, "objective completion should arm tactical edge hits");
  assert.ok(dodge.dungeon.runTacticalEdgeDamagePct > 0, "objective completion should arm tactical edge damage");
  assert.ok(dodge.zhuLingEssence >= zhuBefore + 7, "objective should grant zhu ling essence");
  assert.ok(dodge.lingSha >= shaBefore + 1, "objective should grant ling sha");
  assert.ok(dodge.dungeon.runFinisherCharge >= 63, "objective should add finisher on top of dodge rewards");
  assert.ok(dodge.dungeon.runStyleStreak >= 4, "objective should add style on top of dodge rewards");
  assert.match(dodge.dungeon.runLog, /战术达成|smoke objective/, "objective completion should remain visible in log");

  const fail = makeStrongNewState();
  assert.equal(enterDungeon(fail), true, "objective failure run should start");
  resolveOpeningDraft(fail);
  assert.ok(fail.dungeon.runEnemy, "objective failure run should have an enemy");
  fail.dungeon.runObjective = {
    kind: "fast_kill",
    title: "expire smoke",
    desc: "smoke",
    target: 1,
    progress: 0,
    rewardZhuLingEssence: 7,
    rewardLingSha: 2,
    rewardFinisherCharge: 22,
    rewardRerolls: 1,
    completed: false,
    startedAtMs: Date.now() - 2000,
    timeLimitMs: 1000,
  };
  fail.dungeon.runThreat = 10;
  fail.dungeon.runMomentum = 1;
  fail.dungeon.runObjectiveStreak = 2;
  fail.dungeon.runObjectivePeak = 2;
  fail.dungeon.runTacticalEdgeHits = 3;
  fail.dungeon.runTacticalEdgeDamagePct = 0.24;
  fail.dungeon.runTacticalEdgeLabel = "smoke edge";
  fail.dungeon.runTacticalEdgeLastEcho = "stale echo";
  fail.dungeon.runTacticalEdgeChain = 2;
  tickDungeon(fail, 0.01, Date.now());
  assert.equal(fail.dungeon.runObjective.failed, true, "expired timed objective should fail");
  assert.equal(fail.dungeon.runThreat, 13, "failed objective should raise threat");
  assert.equal(fail.dungeon.runMomentum, 0, "failed objective should reduce momentum");
  assert.equal(fail.dungeon.runObjectiveStreak, 0, "failed objective should break tactical streak");
  assert.equal(fail.dungeon.runTacticalEdgeHits, 0, "failed objective should clear tactical edge hits");
  assert.equal(fail.dungeon.runTacticalEdgeDamagePct, 0, "failed objective should clear tactical edge damage");
  assert.equal(fail.dungeon.runTacticalEdgeLastEcho, "", "failed objective should clear tactical edge echo");
  assert.equal(fail.dungeon.runTacticalEdgeChain, 0, "failed objective should clear tactical edge chain");
  assert.match(fail.dungeon.runLog, /战术失手|expire smoke/, "objective failure should be visible in log");
}

function runTacticalEdgeDamageSmoke(): void {
  const st = makeStrongNewState();
  assert.equal(enterDungeon(st), true, "tactical edge damage run should start");
  resolveOpeningDraft(st);
  const enemy = st.dungeon.runEnemy;
  assert.ok(enemy, "tactical edge run should have an enemy");
  enemy.hp = enemy.maxHp = 999999;
  enemy.block = 0;
  st.dungeon.runTacticalEdgeHits = 3;
  st.dungeon.runTacticalEdgeDamagePct = 0.5;
  st.dungeon.runTacticalEdgeLabel = "smoke edge";
  st.dungeon.runTacticalEdgeChain = 0;
  st.dungeon.runFinisherCharge = 0;
  st.dungeon.duelFervor = 0;
  st.dungeon.playerAttackAccum = 999;
  const hpBefore = enemy.hp;
  tickDungeon(st, 0.01, Date.now());
  assert.equal(st.dungeon.runTacticalEdgeHits, 0, "auto attacks should consume tactical edge hits");
  assert.equal(st.dungeon.runTacticalEdgeDamagePct, 0, "empty tactical edge should clear damage pct");
  assert.ok(st.dungeon.runTacticalEdgeLastEcho.length > 0, "tactical edge should leave a readable combat echo");
  assert.match(st.dungeon.runTacticalEdgeLastEcho, /追击链成/, "third tactical edge should trigger chain payoff");
  assert.equal(st.dungeon.runTacticalEdgeChain, 0, "chain payoff should reset tactical edge chain");
  assert.equal(st.dungeon.runTacticalEdgePrize, 1, "chain payoff should bank a reward prize");
  assert.ok(st.dungeon.runFinisherCharge >= 14, "chain payoff should grant finisher tempo");
  assert.ok(st.dungeon.duelFervor >= 12, "chain payoff should grant fervor tempo");
  assert.ok(enemy.hp < hpBefore, "tactical edge attacks should damage the enemy");
}

function runTacticalEdgePrizeRewardSmoke(): void {
  const st = makeStrongNewState();
  st.dungeon.runTacticalEdgePrize = 2;
  st.dungeon.runNodeIndex = 2;
  const rewards = buildRunRewardOptions(st, false, false);
  assert.ok(rewards.length > 0, "chain prize should still build reward options");
  assert.ok(rewards.every((x) => (x.pickZhuLingBonus ?? 0) >= 14), "chain prize should add zhu ling to every reward");
  assert.ok(rewards.every((x) => (x.pickFinisherBonus ?? 0) >= 22), "chain prize should add finisher tempo to every reward");
  assert.ok(rewards.every((x) => (x.pickTacticalEdgeHits ?? 0) >= 6), "chain prize should arm stronger chase hits");
  assert.ok(rewards.every((x) => (x.pickTacticalEdgeDamagePct ?? 0) >= 0.09), "chain prize should raise chase damage floor");
  assert.ok(rewards.some((x) => x.draftHint?.includes("追击链印 x2")), "chain prize should be readable in reward hints");

  st.dungeon.runPendingRewards = [rewards[0]!];
  assert.equal(applyRunReward(st, rewards[0]!.id), true, "chain prize reward should apply");
  assert.equal(st.dungeon.runTacticalEdgePrize, 0, "choosing a reward should spend banked chain prize");
  assert.match(st.dungeon.runLog, /链印兑现 x2/, "spent chain prize should be visible in reward log");
}

function runTacticalEdgeElementEchoSmoke(): void {
  const cases = [
    { id: "n_iron_slag", key: "metal" },
    { id: "n_moss", key: "wood" },
    { id: "n_dew", key: "water" },
    { id: "n_spark", key: "fire" },
    { id: "n_clod", key: "earth" },
  ] as const;
  for (const c of cases) {
    const st = makeStrongNewState();
    forceDominantDeck(st, c.id);
    assert.equal(enterDungeon(st), true, `${c.key} tactical edge echo run should start`);
    resolveOpeningDraft(st);
    const enemy = st.dungeon.runEnemy;
    assert.ok(enemy, `${c.key} tactical edge echo should have an enemy`);
    enemy.hp = enemy.maxHp = 999999;
    enemy.block = c.key === "metal" ? 600 : 0;
    st.dungeon.runTacticalEdgeHits = 1;
    st.dungeon.runTacticalEdgeDamagePct = 0.3;
    st.dungeon.runTacticalEdgeLabel = "echo smoke";
    st.dungeon.runTacticalEdgeChain = 0;
    st.dungeon.playerAttackAccum = 999;
    st.dungeon.playerHp = Math.floor(st.dungeon.playerMax * 0.5);
    st.dungeon.stamina = 10;
    st.dungeon.runShield = 0;
    st.dungeon.duelFervor = 0;
    const hpBefore = st.dungeon.playerHp;
    const staminaBefore = st.dungeon.stamina;
    const shieldBefore = st.dungeon.runShield;
    const fervorBefore = st.dungeon.duelFervor;
    const blockBefore = enemy.block;
    const iframeBefore = st.dungeon.dodgeIframesUntil;
    tickDungeon(st, 0.01, Date.now());
    assert.equal(st.dungeon.runTacticalEdgeHits, 0, `${c.key} echo should consume tactical edge`);
    assert.equal(st.dungeon.runTacticalEdgeChain, 1, `${c.key} echo should progress tactical edge chain`);
    assert.ok(st.dungeon.runTacticalEdgeLastEcho.length > 0, `${c.key} echo should write combat feedback`);
    if (c.key === "metal") assert.ok(enemy.block < blockBefore, "metal tactical edge should cut block");
    if (c.key === "metal") assert.match(st.dungeon.runTacticalEdgeLastEcho, /金追击|破护/, "metal echo should name the break");
    if (c.key === "wood") {
      assert.ok(st.dungeon.playerHp > hpBefore, "wood tactical edge should heal");
      assert.match(st.dungeon.runTacticalEdgeLastEcho, /木追击|回生/, "wood echo should name the heal");
    }
    if (c.key === "water") {
      assert.ok(st.dungeon.stamina > staminaBefore, "water tactical edge should restore stamina");
      assert.ok(st.dungeon.dodgeIframesUntil > iframeBefore, "water tactical edge should extend iframes");
      assert.match(st.dungeon.runTacticalEdgeLastEcho, /水追击|体力/, "water echo should name the stamina return");
    }
    if (c.key === "fire") {
      assert.ok(st.dungeon.duelFervor > fervorBefore + 8, "fire tactical edge should add extra fervor");
      assert.match(st.dungeon.runTacticalEdgeLastEcho, /火追击|战意/, "fire echo should name the fervor return");
    }
    if (c.key === "earth") {
      assert.ok(st.dungeon.runShield > shieldBefore, "earth tactical edge should grant shield");
      assert.match(st.dungeon.runTacticalEdgeLastEcho, /土追击|护盾/, "earth echo should name the shield");
    }
  }
}

function runObjectiveStreakRewardSmoke(): void {
  const st = makeStrongNewState();
  assert.equal(enterDungeon(st), true, "objective streak reward run should start");
  resolveOpeningDraft(st);
  st.dungeon.runObjectiveStreak = 3;
  st.dungeon.runObjectivePeak = 3;
  const rewards = buildRunRewardOptions(st, false, false);
  assert.ok(rewards.length > 0, "streak reward smoke should build reward options");
  assert.ok(rewards.every((x) => (x.pickZhuLingBonus ?? 0) > 0), "objective streak should add zhu ling pick bonus to every reward");
  assert.ok(rewards.every((x) => (x.pickFinisherBonus ?? 0) >= 15), "objective streak should add finisher pick bonus to every reward");
  assert.ok(rewards.every((x) => (x.pickTacticalEdgeHits ?? 0) >= 4), "objective streak should add tactical edge hits to every reward");
  assert.ok(rewards.every((x) => (x.pickTacticalEdgeDamagePct ?? 0) >= 0.06), "objective streak should add tactical edge damage to every reward");
  assert.ok(rewards.some((x) => x.draftHint?.includes("战术锋芒 x3")), "reward hints should explain tactical streak bonus");
  assert.ok(rewards.some((x) => x.draftHint?.includes("追击")), "reward hints should explain tactical edge tempo");
}

function runRewardVerbStreakSmoke(): void {
  const st = makeStrongNewState();
  st.dungeon.runPendingRewards = [
    {
      id: "smoke:fire-1",
      kind: "essence",
      title: "smoke fire 1",
      desc: "smoke",
      combatVerb: "爆发",
      combatHint: "smoke",
      zhuLingEssence: 1,
    },
  ];
  assert.equal(applyRunReward(st, "smoke:fire-1"), true, "first verb reward should apply");
  assert.equal(st.dungeon.runRewardVerb, "爆发", "first reward should record chosen combat verb");
  assert.equal(st.dungeon.runRewardVerbStreak, 1, "first reward should start verb streak");

  st.dungeon.runPendingRewards = [
    {
      id: "smoke:fire-2",
      kind: "essence",
      title: "smoke fire 2",
      desc: "smoke",
      combatVerb: "爆发",
      combatHint: "smoke",
      zhuLingEssence: 1,
    },
  ];
  const zhuBefore = st.zhuLingEssence;
  assert.equal(applyRunReward(st, "smoke:fire-2"), true, "second same verb reward should apply");
  assert.equal(st.dungeon.runRewardVerbStreak, 2, "same combat verb should build streak");
  assert.equal(st.dungeon.runRewardVerbPeak, 2, "same combat verb should update peak");
  assert.ok(st.zhuLingEssence > zhuBefore + 1, "verb streak should grant immediate zhu ling");
  assert.ok(st.dungeon.runFinisherCharge > 0, "verb streak should grant immediate finisher tempo");
  assert.ok(st.dungeon.runTacticalEdgeHits > 0, "verb streak should arm chase");
  assert.match(st.dungeon.runRewardVerbLast, /爆发连选 x2/, "verb streak should leave readable feedback");

  st.dungeon.runPendingRewards = [
    {
      id: "smoke:wood",
      kind: "essence",
      title: "smoke wood",
      desc: "smoke",
      combatVerb: "续航",
      combatHint: "smoke",
      zhuLingEssence: 1,
    },
  ];
  assert.equal(applyRunReward(st, "smoke:wood"), true, "different verb reward should apply");
  assert.equal(st.dungeon.runRewardVerb, "续航", "different verb should become current verb");
  assert.equal(st.dungeon.runRewardVerbStreak, 1, "different verb should reset streak");

  const draft = makeStrongNewState();
  draft.dungeon.runRewardVerb = "爆发";
  draft.dungeon.runRewardVerbStreak = 3;
  draft.dungeon.runRewardVerbPeak = 3;
  const rewards = buildRunRewardOptions(draft, false, false);
  assert.ok(rewards.length > 0, "verb streak should still build reward options");
  assert.ok(rewards.every((x) => (x.pickZhuLingBonus ?? 0) > 0), "verb streak should add zhu to every reward");
  assert.ok(rewards.every((x) => (x.pickFinisherBonus ?? 0) >= 12), "verb streak should add finisher to every reward");
  assert.ok(rewards.every((x) => (x.pickTacticalEdgeHits ?? 0) >= 3), "verb streak should arm chase on every reward");
  assert.ok(rewards.some((x) => x.draftHint?.includes("爆发连选 x3")), "reward hints should explain verb streak payoff");
}

function runWarrantPrizeSmoke(): void {
  const st = makeStrongNewState();
  st.dungeon.runWarrantPrize = 3;
  const rewards = buildRunRewardOptions(st, false, false);
  assert.ok(rewards.length > 0, "warrant prize should still build reward options");
  assert.ok(rewards.every((x) => (x.pickZhuLingBonus ?? 0) >= 11), "warrant prize should add zhu to every reward");
  assert.ok(rewards.every((x) => (x.pickFinisherBonus ?? 0) >= 31), "warrant prize should add finisher tempo to every reward");
  assert.ok(rewards.every((x) => (x.pickTacticalEdgeHits ?? 0) >= 7), "warrant prize should add chase to every reward");
  assert.ok(rewards.every((x) => (x.pickThreatDelta ?? 0) <= 0), "warrant prize should not raise threat");
  assert.ok(rewards.some((x) => x.draftHint?.includes("悬赏兑券 x3")), "warrant prize should write reward draft feedback");

  st.dungeon.runPendingRewards = rewards;
  const zhuBefore = st.zhuLingEssence;
  assert.equal(applyRunReward(st, rewards[0]!.id), true, "warrant prize reward should apply");
  assert.equal(st.dungeon.runWarrantPrize, 0, "warrant prize should be spent after reward pick");
  assert.ok(st.dungeon.runWarrantPrizeLast.length > 0, "warrant prize should leave spent feedback");
  assert.ok(st.zhuLingEssence > zhuBefore, "warrant prize pick should pay zhu");
  assert.ok(st.dungeon.runFinisherCharge > 0, "warrant prize pick should add finisher charge");
  assert.ok(st.dungeon.runTacticalEdgeHits > 0, "warrant prize pick should arm chase");
}

function runRewardVerbSurgeSmoke(): void {
  const bank = makeStrongNewState();
  bank.dungeon.runPendingRewards = [
    { id: "surge:1", kind: "essence", title: "surge 1", desc: "smoke", combatVerb: "爆发", combatHint: "smoke" },
  ];
  assert.equal(applyRunReward(bank, "surge:1"), true, "first surge reward should apply");
  bank.dungeon.runPendingRewards = [
    { id: "surge:2", kind: "essence", title: "surge 2", desc: "smoke", combatVerb: "爆发", combatHint: "smoke" },
  ];
  assert.equal(applyRunReward(bank, "surge:2"), true, "second surge reward should apply");
  bank.dungeon.runPendingRewards = [
    { id: "surge:3", kind: "essence", title: "surge 3", desc: "smoke", combatVerb: "爆发", combatHint: "smoke" },
  ];
  assert.equal(applyRunReward(bank, "surge:3"), true, "third surge reward should apply");
  assert.equal(bank.dungeon.runRewardVerbSurge, "爆发", "third same verb should bank a combat surge");
  assert.ok(bank.dungeon.runRewardVerbSurgePower >= 1, "banked combat surge should have power");
  assert.match(bank.dungeon.runRewardVerbSurgeLast, /爆发开战/, "banked combat surge should be readable");

  const st = makeStrongNewState();
  assert.equal(enterDungeon(st), true, "reward verb surge run should start");
  resolveOpeningDraft(st);
  st.dungeon.runRewardVerbSurge = "爆发";
  st.dungeon.runRewardVerbSurgePower = 2;
  st.dungeon.runPendingRoutes = [{ id: "smoke:surge-combat", title: "smoke", desc: "smoke", nodeType: "combat" }];
  assert.equal(applyRunRouteChoice(st, "smoke:surge-combat"), true, "surge route should start combat");
  assert.equal(st.dungeon.runOpportunity?.source, "reward_verb_surge", "surge should become opening opportunity");
  assert.equal(st.dungeon.runOpportunity?.sourceVerb, "爆发", "surge opportunity should carry verb");
  assert.match(st.dungeon.runRewardVerbSurgeLast, /开战 x2 出现/, "surge start should leave readable feedback");
  const enemy = st.dungeon.runEnemy;
  assert.ok(enemy, "surge combat should have enemy");
  enemy.hp = enemy.maxHp = 999999;
  st.dungeon.runFinisherCharge = 100;
  const fervorBefore = st.dungeon.duelFervor;
  queueDungeonFinisher(st);
  tickDungeon(st, 0.01, Date.now());
  assert.equal(st.dungeon.runRewardVerbSurge, "", "resolved surge should be spent");
  assert.equal(st.dungeon.runRewardVerbSurgePower, 0, "resolved surge power should clear");
  assert.ok(st.dungeon.runTacticalEdgeHits > 0, "resolved surge should arm chase");
  assert.ok(st.dungeon.duelFervor > fervorBefore, "burst surge should add fervor");
  assert.match(st.dungeon.runRewardVerbSurgeLast, /爆发开战兑现/, "resolved surge should write payoff feedback");

  const miss = makeStrongNewState();
  assert.equal(enterDungeon(miss), true, "missed surge run should start");
  resolveOpeningDraft(miss);
  miss.dungeon.runRewardVerbSurge = "护盾";
  miss.dungeon.runRewardVerbSurgePower = 1;
  miss.dungeon.runOpportunity = {
    action: "skill",
    title: "护盾开战",
    desc: "smoke",
    untilMs: Date.now() - 10,
    rewardZhuLingEssence: 1,
    rewardFinisherCharge: 1,
    rewardStamina: 1,
    damagePct: 0.5,
    source: "reward_verb_surge",
    sourcePower: 1,
    sourceVerb: "护盾",
  };
  tickDungeon(miss, 0.01, Date.now());
  assert.equal(miss.dungeon.runRewardVerbSurge, "", "missed surge should be cleared");
  assert.match(miss.dungeon.runRewardVerbSurgeLast, /错过/, "missed surge should explain loss");
}

function runEliteRewardSmoke(): void {
  const st = makeStrongNewState();
  assert.equal(enterDungeon(st), true, "elite reward run should start");
  resolveOpeningDraft(st);
  st.dungeon.runNodes[st.dungeon.runNodeIndex]!.type = "elite";
  st.dungeon.runRewardRerolls = 0;
  const enemy = st.dungeon.runEnemy;
  assert.ok(enemy, "elite reward run should have enemy");
  enemy.hp = enemy.maxHp = 1;
  const lingShaBefore = st.lingSha;
  tickDungeon(st, 2, Date.now());
  assert.ok(st.dungeon.runPendingRewards.length > 0, "elite combat should offer rewards");
  assert.ok(st.dungeon.runRewardRerolls >= 1, "elite victory should grant at least one reroll");
  assert.ok(st.lingSha >= lingShaBefore + 2, "elite victory should grant extra lingSha");
  assert.ok(
    st.dungeon.runPendingRewards.some((x) => x.title.includes("精英") || (x.blessingId && getRunBlessing(x.blessingId)?.rarity === "major")),
    "elite reward should include a stronger option",
  );
  assert.match(st.dungeon.runLog, /精英击破/, "elite victory should be visible in log");
}

function main(): void {
  runOldSaveResetSmoke();
  runDungeonStartRewardEventSmoke();
  runDungeonVictorySmoke();
  runDungeonDefeatSettlementSmoke();
  runLastStandSmoke();
  runIntentCounterSmoke();
  runBlessingResonanceSmoke();
  runResonanceSurgeSmoke();
  runThreatPressureSmoke();
  runRestChoiceSmoke();
  runFervorSurgeSmoke();
  runComboFlourishSmoke();
  runCounterChainSmoke();
  runCounterTempoPrizeSmoke();
  runClutchPrizeSmoke();
  runCounterTempoReboundSmoke();
  runBossPostureSmoke();
  runBossBreakChoiceSmoke();
  runBossOmenSmoke();
  runCombatGradeSmoke();
  runMomentumSmoke();
  runElementCheckSmoke();
  runEventPlanSmoke();
  runEventEchoRouteFollowSmoke();
  runEventEchoSmoke();
  runEventEchoOpportunitySaveRoundTripSmoke();
  runRewardRerollSmoke();
  runRewardDraftPlanSmoke();
  runRewardLockRerollSmoke();
  runRouteScoutingAndAttunementSmoke();
  runRouteBuildFitSmoke();
  runRouteEchoFitSmoke();
  runRewardVerbRouteRecommendationSmoke();
  runRouteRecommendRewardSmoke();
  runRoutePlanObjectiveSmoke();
  runRoutePledgeRewardAndRouteSmoke();
  runPledgeReprisalSmoke();
  runEventBuildFitSmoke();
  runEventScoutBindingSmoke();
  runScoutedCombatObjectiveSmoke();
  runWarrantSmoke();
  runOpportunitySmoke();
  runElementalFinisherSmoke();
  runStyleStreakSmoke();
  runActionWeaveSmoke();
  runEnemyRoleTrophySmoke();
  runEnemyRoleBehaviorSmoke();
  runRoleReadStreakSmoke();
  runRoleReadPrizeSmoke();
  runObjectiveTempoRewardSmoke();
  runTacticalEdgeDamageSmoke();
  runTacticalEdgeElementEchoSmoke();
  runTacticalEdgePrizeRewardSmoke();
  runObjectiveStreakRewardSmoke();
  runRewardVerbStreakSmoke();
  runWarrantPrizeSmoke();
  runRewardVerbSurgeSmoke();
  runEliteRewardSmoke();
  // eslint-disable-next-line no-console
  console.log("dungeon run smoke passed");
}

main();
