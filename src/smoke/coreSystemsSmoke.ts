import assert from "node:assert/strict";
import { createInitialState } from "../state";
import { catchUpOffline, maxOfflineSec } from "../gameLoop";
import { ensureWeeklyBountyWeek, currentWeekKey } from "../systems/weeklyBounty";
import { serialize, deserialize } from "../storage";

function assertNear(actual: number, expected: number, epsilon: number, label: string): void {
  assert.ok(Math.abs(actual - expected) <= epsilon, `${label}: expected ${expected}, got ${actual}`);
}

function runOfflineCapSmoke(): void {
  const st = createInitialState();
  const now = Date.now();
  const cap = maxOfflineSec(st);
  st.lastTick = now - (cap + 1800) * 1000;
  const out = catchUpOffline(st, now);
  assert.equal(out.wasCapped, true, "offline gain should be capped");
  assertNear(out.settledSec, cap, 1e-6, "settledSec should equal cap");
  assert.ok(out.rawAwaySec > out.capSec, "rawAwaySec should exceed capSec");
}

function runWeeklySyncSmoke(): void {
  const st = createInitialState();
  st.weeklyBounty.weekKey = "1999-01-04";
  st.weeklyBounty.waves = 12;
  ensureWeeklyBountyWeek(st, Date.now());
  assert.equal(st.weeklyBounty.weekKey, currentWeekKey(Date.now()), "weekly key should sync to current week");
  assert.equal(st.weeklyBounty.waves, 0, "cross-week sync should reset old progress");

  const cross = createInitialState();
  const monday = new Date();
  monday.setHours(0, 10, 0, 0);
  const day = monday.getDay();
  const diffToMon = day === 0 ? -6 : 1 - day;
  monday.setDate(monday.getDate() + diffToMon);
  const endMs = monday.getTime();
  const startMs = endMs - 20 * 60 * 1000;
  cross.lastTick = startMs;
  catchUpOffline(cross, endMs);
  assert.equal(cross.weeklyBounty.weekKey, currentWeekKey(endMs), "offline cross-week settlement should sync week key");
}

function runSerializeRoundtripSmoke(): void {
  const st = createInitialState();
  st.realmLevel = 9;
  st.totalPulls = 123;
  st.weeklyBounty.waves = 7;
  st.spiritStones = "456789";
  const encoded = serialize(st);
  const decoded = deserialize(encoded);
  assert.equal(decoded.realmLevel, st.realmLevel, "realmLevel should roundtrip");
  assert.equal(decoded.totalPulls, st.totalPulls, "totalPulls should roundtrip");
  assert.equal(decoded.weeklyBounty.waves, st.weeklyBounty.waves, "weekly waves should roundtrip");
  assert.equal(decoded.spiritStones, st.spiritStones, "spiritStones should roundtrip");
}

function main(): void {
  runOfflineCapSmoke();
  runWeeklySyncSmoke();
  runSerializeRoundtripSmoke();
  // eslint-disable-next-line no-console
  console.log("core systems smoke passed");
}

main();
