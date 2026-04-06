import assert from "node:assert/strict";
import { createInitialState } from "../state";
import { pullOne, UR_PITY_MAX } from "../gacha";
import { catchUpOffline, maxOfflineSec } from "../gameLoop";
import { WEEKLY_BOUNTY_TASKS, noteWeeklyBountyWave, weeklyBountyProgress } from "../systems/weeklyBounty";

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

function main(): void {
  runUrPitySmoke();
  runOfflineCapBoundarySmoke();
  runDungeonWeeklyLinkSmoke();
  // eslint-disable-next-line no-console
  console.log("progression smoke passed");
}

main();
