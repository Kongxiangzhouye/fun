import assert from "node:assert/strict";
import Decimal from "decimal.js";
import { createInitialState } from "../state";
import { pullOne, UR_PITY_MAX } from "../gacha";
import { catchUpOffline, maxOfflineSec } from "../gameLoop";
import { incomePerSecondAt } from "../economy";
import { earthOfflineIncomeMult } from "../deckSynergy";
import { WEEKLY_BOUNTY_TASKS, noteWeeklyBountyWave, weeklyBountyProgress } from "../systems/weeklyBounty";
import { totalCardsInPool } from "../storage";

function runUrPitySmoke(): void {
  const st = createInitialState();
  st.pityUr = UR_PITY_MAX - 1;
  const pull = pullOne(st);
  assert.equal(pull.card.rarity, "UR", "UR 保底阈值命中时应强制产出 UR");
  assert.equal(st.pityUr, 0, "抽到 UR 后应重置 UR 保底计数");
}

function runOfflineCapBoundarySmoke(): void {
  const st = createInitialState();
  const cap = maxOfflineSec(st);
  const now = Date.now();
  st.lastTick = now - (cap + 7200) * 1000;
  const out = catchUpOffline(st, now);
  assert.equal(out.wasCapped, true, "离线超上限时应触发封顶");
  assert.ok(out.settledSec <= cap + 1e-6, "离线结算秒数不得超封顶");
}

function runDungeonWeeklyLinkSmoke(): void {
  const st = createInitialState();
  const waveTask = WEEKLY_BOUNTY_TASKS.find((x) => x.kind === "waves");
  assert.ok(waveTask, "应存在周常幻域波次任务");
  const before = weeklyBountyProgress(st, waveTask!);
  noteWeeklyBountyWave(st, Date.now());
  noteWeeklyBountyWave(st, Date.now());
  const after = weeklyBountyProgress(st, waveTask!);
  assert.equal(after, before + 2, "副本推进应联动累计到周常波次进度");
}

function runOfflineBoostExpiryBoundarySmoke(): void {
  const st = createInitialState();
  const now = Date.now();
  const durationSec = 3600;
  st.lastTick = now - durationSec * 1000;
  st.offlineAdventure.activeBoostMult = 1.5;
  st.offlineAdventure.activeBoostUntilMs = st.lastTick + 1800 * 1000;
  const baseIps = incomePerSecondAt(st, totalCardsInPool(), st.lastTick).div(1.5);
  const expected = baseIps.mul(1800 * 1.5 + 1800).mul(earthOfflineIncomeMult(st));
  const out = catchUpOffline(st, now);
  const delta = out.stoneGain.sub(expected).abs();
  const tolerance = Decimal.max(1, expected.mul(0.002));
  assert.ok(delta.lte(tolerance), `跨过离线增益到期点时收益不应整段高倍率结算: delta=${delta.toFixed(3)}`);
}

function main(): void {
  runUrPitySmoke();
  runOfflineCapBoundarySmoke();
  runDungeonWeeklyLinkSmoke();
  runOfflineBoostExpiryBoundarySmoke();
  // eslint-disable-next-line no-console
  console.log("progression smoke passed");
}

main();
