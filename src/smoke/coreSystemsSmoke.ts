import assert from "node:assert/strict";
import { createInitialState } from "../state";
import { applyTick, catchUpOffline, fastForward, maxOfflineSec } from "../gameLoop";
import { ensureWeeklyBountyWeek, currentWeekKey, noteWeeklyBountyEstateCompletion } from "../systems/weeklyBounty";
import { ensureCelestialStashWeek } from "../systems/celestialStash";
import {
  chooseOfflineAdventureOption,
  maybeQueueOfflineAdventure,
  OFFLINE_ADVENTURE_TRIGGER_SEC,
  tryAutoSettleOfflineAdventurePending,
} from "../systems/offlineAdventure";
import { acceptEstateCommission, settleEstateCommission, tryAutoSettleEstateCommission } from "../systems/estateCommission";
import {
  serialize,
  deserialize,
  saveGame,
  loadGame,
  switchToSaveSlot,
  exportSave,
  importSave,
  getActiveSlotIndex,
} from "../storage";

type MemoryStorage = {
  getItem: (key: string) => string | null;
  setItem: (key: string, value: string) => void;
  removeItem: (key: string) => void;
  clear: () => void;
  key: (index: number) => string | null;
  length: number;
};

function installMemoryLocalStorage(): void {
  const store = new Map<string, string>();
  const localStorageShim: MemoryStorage = {
    getItem: (key) => (store.has(key) ? store.get(key)! : null),
    setItem: (key, value) => {
      store.set(String(key), String(value));
    },
    removeItem: (key) => {
      store.delete(String(key));
    },
    clear: () => {
      store.clear();
    },
    key: (index) => Array.from(store.keys())[index] ?? null,
    get length() {
      return store.size;
    },
  };
  Object.defineProperty(globalThis, "localStorage", {
    value: localStorageShim,
    configurable: true,
    writable: true,
  });
}

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

  const near = createInitialState();
  near.lastTick = now - Math.max(1, Math.floor((cap - 1) * 1000));
  const nearOut = catchUpOffline(near, now);
  assert.equal(nearOut.wasCapped, false, "offline gain should not cap near boundary");
  assert.ok(nearOut.settledSec <= cap, "near-boundary settledSec should not exceed cap");
}

function runWeeklySyncSmoke(): void {
  const st = createInitialState();
  st.weeklyBounty.weekKey = "1999-01-04";
  st.weeklyBounty.waves = 12;
  ensureWeeklyBountyWeek(st, Date.now());
  assert.equal(st.weeklyBounty.weekKey, currentWeekKey(Date.now()), "weekly key should sync to current week");
  assert.equal(st.weeklyBounty.waves, 0, "cross-week sync should reset old progress");
  assert.equal(st.weeklyBounty.estateCompletions, 0, "cross-week sync should reset estate completion progress");

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

function runWeeklyEstateCrossWeekResetSmoke(): void {
  const st = createInitialState();
  const now = Date.now();
  const beforeWeek = currentWeekKey(now - 8 * 24 * 3600 * 1000);
  st.weeklyBounty.weekKey = beforeWeek;
  st.weeklyBounty.estateCompletions = 3;
  noteWeeklyBountyEstateCompletion(st, now);
  assert.equal(st.weeklyBounty.weekKey, currentWeekKey(now), "estate completion event should sync weekly key");
  assert.equal(st.weeklyBounty.estateCompletions, 1, "estate completion should reset then count in new week");
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

function runSaveSlotSwitchIsolationSmoke(): void {
  installMemoryLocalStorage();
  const slot0 = createInitialState();
  slot0.realmLevel = 8;
  slot0.dungeon.deathCooldownUntil = 123456;
  saveGame(slot0);
  assert.equal(getActiveSlotIndex(), 0, "initial active slot should be 0");

  const sw1 = switchToSaveSlot(1, slot0);
  assert.equal(sw1.ok, true, "switch to empty slot should succeed");
  if (!sw1.ok) return;
  const slot1 = sw1.value;
  slot1.realmLevel = 3;
  slot1.dungeon.deathCooldownUntil = 8888;
  saveGame(slot1);

  const back = switchToSaveSlot(0, slot1);
  assert.equal(back.ok, true, "switch back to slot 0 should succeed");
  if (!back.ok) return;
  assert.equal(back.value.realmLevel, 8, "slot 0 realmLevel should stay isolated");
  assert.equal(
    back.value.dungeon.deathCooldownUntil,
    123456,
    "slot 0 recycle cooldown should not be polluted by slot 1",
  );
  const loaded = loadGame();
  assert.equal(loaded.realmLevel, 8, "loadGame should follow active slot after switching back");
}

function runImportExportRoundtripSmoke(): void {
  const st = createInitialState();
  st.realmLevel = 12;
  st.totalPulls = 345;
  st.dungeon.maxWaveRecord = 30;
  st.dungeon.entryWave = 17;
  const encoded = exportSave(st);
  const imported = importSave(encoded);
  assert.equal(imported.ok, true, "exported payload should import");
  if (!imported.ok) return;
  assert.equal(imported.value.realmLevel, st.realmLevel, "import should keep realmLevel");
  assert.equal(imported.value.totalPulls, st.totalPulls, "import should keep totalPulls");
  assert.equal(imported.value.dungeon.entryWave, 31, "import should normalize entry wave to current frontier");
}

function runDefaultMigrationSmoke(): void {
  const st = createInitialState();
  const data = JSON.parse(serialize(st)) as Record<string, unknown>;
  delete data.dungeonSanctuaryAutoEnter;
  delete data.dungeonDeferBoss;
  const migrated = deserialize(JSON.stringify(data));
  assert.equal(migrated.dungeonSanctuaryAutoEnter, true, "missing auto-enter field should migrate to true");
  assert.equal(migrated.dungeonDeferBoss, true, "missing defer-boss field should migrate to true");
}

function runOfflineBoostRenewRuleSmoke(): void {
  const st = createInitialState();
  const now = Date.now();
  st.offlineAdventure.activeBoostUntilMs = now + 30 * 60 * 1000;
  st.offlineAdventure.activeBoostMult = 1.6;
  st.offlineAdventure.pending = {
    triggeredAtMs: now,
    settledSec: 3600,
    options: [
      { id: "instant", title: "I", desc: "", instantStones: "100", instantEssence: 1, boostMult: 1, boostDurationSec: 0 },
      { id: "boost", title: "B", desc: "", instantStones: "0", instantEssence: 0, boostMult: 1.24, boostDurationSec: 7200 },
      { id: "essence", title: "E", desc: "", instantStones: "0", instantEssence: 3, boostMult: 1, boostDurationSec: 0, zhuLingBonus: 2 },
    ],
    rerolled: false,
    rerollCostStones: "180",
  };
  const oldUntil = st.offlineAdventure.activeBoostUntilMs;
  assert.equal(chooseOfflineAdventureOption(st, "boost", now), true, "boost option should be selectable");
  assert.equal(st.offlineAdventure.activeBoostMult, 1.6, "lower multiplier should not overwrite active higher multiplier");
  assert.equal(st.offlineAdventure.activeBoostUntilMs, oldUntil, "lower multiplier should not extend active higher multiplier");
}

function runApplyTickSegmentedCatchUpSmoke(): void {
  const st = createInitialState();
  const now = Date.now();
  const oldTick = now - 300_000;
  st.lastTick = oldTick;
  const prevPlaytime = st.playtimeSec;
  applyTick(st, now);
  assert.ok(st.lastTick > oldTick, "tick should advance forward");
  assert.equal(st.lastTick, oldTick + 120_000, "large dt should respect capped segmented advancement");
  assert.ok(st.playtimeSec >= prevPlaytime + 120 - 1e-6, "playtime should include full capped dt");
}

function runAutoSalvageAccumulatorRemainderSmoke(): void {
  const st = createInitialState();
  const now = Date.now();
  st.lastTick = now - 9_900;
  st.autoSalvageAccumSec = 0;
  applyTick(st, now);
  // 9.9 秒应触发 3 次并保留 2.4 秒余量（允许极小浮点误差）
  assert.ok(
    st.autoSalvageAccumSec >= 2.39 && st.autoSalvageAccumSec <= 2.41,
    `auto salvage accumulator remainder mismatch: ${st.autoSalvageAccumSec}`,
  );
}

function runFastForwardCrossWeekSyncSmoke(): void {
  const st = createInitialState();
  st.weeklyBounty.weekKey = "1999-01-04";
  st.weeklyBounty.waves = 5;
  st.celestialStash.weekKey = "1999-01-04";
  st.celestialStash.purchased = ["starter-stash"];
  st.qoL.autoTuna = true;
  st.lastTunaMs = 0;
  const monday = new Date();
  monday.setHours(0, 10, 0, 0);
  const day = monday.getDay();
  const diffToMon = day === 0 ? -6 : 1 - day;
  monday.setDate(monday.getDate() + diffToMon);
  const endMs = monday.getTime();
  const startMs = endMs - 20 * 60 * 1000;
  st.lastTick = startMs;
  fastForward(st, 3600, endMs);
  ensureWeeklyBountyWeek(st, endMs);
  ensureCelestialStashWeek(st, endMs);
  assert.equal(st.weeklyBounty.weekKey, currentWeekKey(endMs), "fast-forward should sync weekly bounty week key");
  assert.equal(st.celestialStash.weekKey, currentWeekKey(endMs), "fast-forward should sync celestial stash week key");
  assert.equal(st.celestialStash.purchased.length, 0, "cross-week fast-forward should reset celestial stash purchases");
  assert.ok(st.lastTunaMs >= startMs, "fast-forward should follow offline auto tuna timing");
}

function runEstateCommissionDueSettleSmoke(): void {
  const st = createInitialState();
  const now = Date.now();
  st.lastTick = now;
  assert.equal(acceptEstateCommission(st, now), true, "commission should be accepted");
  assert.ok(st.estateCommission.active, "active commission should exist after accept");
  if (!st.estateCommission.active) return;
  st.estateCommission.active.dueAtMs = now + 500;
  applyTick(st, now + 500);
  assert.ok(st.estateCommission.active?.completedAtMs != null, "commission should become completable at due time");
  const settled = settleEstateCommission(st, now + 500);
  assert.ok(settled, "completed commission should be settleable");
}

function runOfflineAdventureQueueNoOverwriteSmoke(): void {
  const st = createInitialState();
  const now = Date.now();
  st.lastTick = now - (OFFLINE_ADVENTURE_TRIGGER_SEC + 180) * 1000;
  const offline = catchUpOffline(st, now);
  assert.ok(offline.settledSec >= OFFLINE_ADVENTURE_TRIGGER_SEC, "offline settle should reach adventure threshold");
  const queued1 = maybeQueueOfflineAdventure(st, offline.settledSec, now);
  assert.equal(queued1, true, "first queue attempt should create pending adventure");
  const firstTriggered = st.offlineAdventure.pending?.triggeredAtMs ?? 0;
  const queued2 = maybeQueueOfflineAdventure(st, offline.settledSec + 600, now + 1000);
  assert.equal(queued2, false, "existing pending should block overwrite");
  assert.equal(st.offlineAdventure.pending?.triggeredAtMs ?? 0, firstTriggered, "pending adventure should stay untouched");
}

function runOfflineAdventureAutoPolicySmoke(): void {
  const st = createInitialState();
  const now = Date.now();
  st.offlineAdventure.pending = {
    triggeredAtMs: now,
    settledSec: 4200,
    options: [
      { id: "instant", title: "I", desc: "", instantStones: "100", instantEssence: 1, boostMult: 1, boostDurationSec: 0 },
      { id: "boost", title: "B", desc: "", instantStones: "0", instantEssence: 0, boostMult: 1.3, boostDurationSec: 3600 },
      { id: "essence", title: "E", desc: "", instantStones: "0", instantEssence: 5, boostMult: 1, boostDurationSec: 0, zhuLingBonus: 3 },
    ],
    rerolled: false,
    rerollCostStones: "190",
  };
  st.offlineAdventure.autoPolicyEnabled = false;
  st.offlineAdventure.autoPolicy = "boost";
  const off = tryAutoSettleOfflineAdventurePending(st, now);
  assert.equal(off.settled, false, "disabled policy should not auto settle pending");
  st.offlineAdventure.autoPolicyEnabled = true;
  const on = tryAutoSettleOfflineAdventurePending(st, now);
  assert.equal(on.settled, true, "enabled policy should auto settle pending");
  assert.equal(on.optionId, "boost", "boost policy should pick boost option");
  assert.equal(st.offlineAdventure.pending, null, "auto settled pending should be cleared");
}

function runEstateCommissionAutoSettleLoopSmoke(): void {
  const st = createInitialState();
  const now = Date.now();
  st.estateCommission.autoQueueEnabled = true;
  assert.equal(acceptEstateCommission(st, now), true, "commission should be accepted");
  assert.ok(st.estateCommission.active, "active commission should exist after accept");
  if (!st.estateCommission.active) return;
  st.estateCommission.active.completedAtMs = now;
  const settled = tryAutoSettleEstateCommission(st, now + 1);
  assert.ok(settled, "auto settle should complete when auto queue enabled and due");
}

function main(): void {
  runOfflineCapSmoke();
  runWeeklySyncSmoke();
  runWeeklyEstateCrossWeekResetSmoke();
  runSerializeRoundtripSmoke();
  runSaveSlotSwitchIsolationSmoke();
  runImportExportRoundtripSmoke();
  runDefaultMigrationSmoke();
  runOfflineBoostRenewRuleSmoke();
  runApplyTickSegmentedCatchUpSmoke();
  runAutoSalvageAccumulatorRemainderSmoke();
  runFastForwardCrossWeekSyncSmoke();
  runEstateCommissionDueSettleSmoke();
  runOfflineAdventureQueueNoOverwriteSmoke();
  runOfflineAdventureAutoPolicySmoke();
  runEstateCommissionAutoSettleLoopSmoke();
  // eslint-disable-next-line no-console
  console.log("core systems smoke passed");
}

main();
