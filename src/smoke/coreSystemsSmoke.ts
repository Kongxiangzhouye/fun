import assert from "node:assert/strict";
import { createInitialState } from "../state";
import { applyTick, catchUpOffline, fastForward, maxOfflineSec } from "../gameLoop";
import {
  ensureWeeklyBountyWeek,
  currentWeekKey,
  noteWeeklyBountyEstateCompletion,
  tryAutoClaimWeeklyBountyIfAny,
} from "../systems/weeklyBounty";
import {
  celestialStashWeeklyProgress,
  ensureCelestialStashWeek,
  tryAutoRedeemCelestialStashOffers,
} from "../systems/celestialStash";
import { addStones } from "../stones";
import { tryAutoFeedAllPetsIfPref } from "../systems/pets";
import {
  chooseOfflineAdventureOption,
  commitOfflineAdventureAutoReceipt,
  maybeQueueOfflineAdventure,
  normalizeOfflineAdventureState,
  OFFLINE_ADVENTURE_TRIGGER_SEC,
  tryAutoSettleOfflineAdventurePending,
} from "../systems/offlineAdventure";
import { acceptEstateCommission, settleEstateCommission, tryAutoSettleEstateCommission } from "../systems/estateCommission";
import { reservoirCap, tryAutoClaimSpiritReservoirIfFull } from "../systems/spiritReservoir";
import { plantCrop, tryAutoHarvestAndReplantGarden } from "../systems/spiritGarden";
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
import { daoEssenceGainBreakdown, daoEssenceGainOnReincarnate } from "../systems/reincarnation";
import { canClaimDailyLoginReward, claimDailyLoginReward } from "../systems/dailyLoginCalendar";
import { getUiUnlocks } from "../uiUnlocks";

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

function runEstateCommissionAutoSettlePrefSmoke(): void {
  const st = createInitialState();
  const now = Date.now();
  st.lastTick = now;
  assert.equal(acceptEstateCommission(st, now), true);
  if (!st.estateCommission.active) return;
  st.estateCommission.active.dueAtMs = now + 500;
  applyTick(st, now + 500);
  assert.ok(st.estateCommission.active?.completedAtMs != null);
  st.estateCommission.autoQueueEnabled = false;
  st.uiPrefs.autoSettleEstateCommission = false;
  assert.equal(tryAutoSettleEstateCommission(st, now + 500), null);
  st.uiPrefs.autoSettleEstateCommission = true;
  const r = tryAutoSettleEstateCommission(st, now + 500);
  assert.ok(r, "autoSettleEstateCommission pref should settle without auto queue");
  assert.equal(st.estateCommission.active, null);
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
  st.offlineAdventure.autoRerollEnabled = false;
  st.offlineAdventure.autoRerollBudgetStones = "0";
  const off = tryAutoSettleOfflineAdventurePending(st, now);
  assert.equal(off.settled, false, "disabled policy should not auto settle pending");
  st.offlineAdventure.autoPolicyEnabled = true;
  const on = tryAutoSettleOfflineAdventurePending(st, now);
  assert.equal(on.settled, true, "enabled policy should auto settle pending");
  assert.equal(on.optionId, "boost", "boost policy should pick boost option");
  assert.equal(st.offlineAdventure.pending, null, "auto settled pending should be cleared");

  st.offlineAdventure.pending = {
    triggeredAtMs: now + 1,
    settledSec: 4200,
    options: [
      { id: "instant", title: "I2", desc: "", instantStones: "100", instantEssence: 1, boostMult: 1, boostDurationSec: 0 },
      { id: "boost", title: "B2", desc: "", instantStones: "0", instantEssence: 0, boostMult: 1.2, boostDurationSec: 1800 },
      { id: "essence", title: "E2", desc: "", instantStones: "0", instantEssence: 8, boostMult: 1, boostDurationSec: 0, zhuLingBonus: 6 },
    ],
    rerolled: false,
    rerollCostStones: "200",
  };
  st.offlineAdventure.autoPolicy = "essence";
  const essence = tryAutoSettleOfflineAdventurePending(st, now + 1);
  assert.equal(essence.settled, true, "essence policy should auto settle pending");
  assert.equal(essence.optionId, "essence", "essence policy should pick essence option");
  assert.equal(st.offlineAdventure.pending, null, "essence auto settled pending should be cleared");

  st.offlineAdventure.pending = {
    triggeredAtMs: now + 2,
    settledSec: 4200,
    options: [
      { id: "instant", title: "I3", desc: "", instantStones: "30", instantEssence: 1, boostMult: 1, boostDurationSec: 0 },
      { id: "boost", title: "B3", desc: "", instantStones: "0", instantEssence: 0, boostMult: 1.45, boostDurationSec: 7200 },
      { id: "essence", title: "E3", desc: "", instantStones: "0", instantEssence: 1, boostMult: 1, boostDurationSec: 0, zhuLingBonus: 0 },
    ],
    rerolled: false,
    rerollCostStones: "210",
  };
  st.offlineAdventure.activeBoostUntilMs = 0;
  st.offlineAdventure.autoPolicy = "smart";
  const smart = tryAutoSettleOfflineAdventurePending(st, now + 2);
  assert.equal(smart.settled, true, "smart policy should auto settle pending");
  assert.equal(smart.optionId, "boost", "smart policy should pick strongest option by heuristic");
  assert.equal(st.offlineAdventure.pending, null, "smart auto settled pending should be cleared");
}

function runOfflineAdventureAutoReceiptSmoke(): void {
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
  st.offlineAdventure.autoPolicyEnabled = true;
  st.offlineAdventure.autoPolicy = "boost";
  const economyBefore = {
    spiritStones: st.spiritStones,
    summonEssence: st.summonEssence,
    zhuLingEssence: st.zhuLingEssence,
  };
  const policy = st.offlineAdventure.autoPolicy;
  const auto = tryAutoSettleOfflineAdventurePending(st, now);
  assert.equal(auto.settled, true);
  commitOfflineAdventureAutoReceipt(st, now, {
    policy,
    optionId: auto.optionId!,
    rerolled: auto.rerolled,
    economyBefore,
  });
  const line = st.offlineAdventure.lastAutoSettleReceipt?.summaryLine ?? "";
  assert.ok(line.length > 0, "auto settle should write receipt summary");
  assert.ok(line.includes("增益优先") || line.includes("静修余韵"), "receipt should describe policy/option");
  const prevLine = line;
  st.offlineAdventure.autoPolicyEnabled = false;
  assert.equal(st.offlineAdventure.lastAutoSettleReceipt?.summaryLine, prevLine, "turning off auto policy must not clear receipt");
}

function runOfflineAdventureAutoRerollBudgetSmoke(): void {
  const st = createInitialState();
  const now = Date.now();
  st.spiritStones = "1000";
  st.offlineAdventure.autoPolicyEnabled = true;
  st.offlineAdventure.autoPolicy = "steady";
  st.offlineAdventure.autoRerollEnabled = true;
  st.offlineAdventure.autoRerollBudgetStones = "300";
  st.offlineAdventure.pending = {
    triggeredAtMs: now,
    settledSec: 4200,
    options: [
      { id: "instant", title: "I", desc: "", instantStones: "100", instantEssence: 1, boostMult: 1, boostDurationSec: 0 },
      { id: "boost", title: "B", desc: "", instantStones: "0", instantEssence: 0, boostMult: 1.2, boostDurationSec: 3600 },
      { id: "essence", title: "E", desc: "", instantStones: "0", instantEssence: 5, boostMult: 1, boostDurationSec: 0, zhuLingBonus: 3 },
    ],
    rerolled: false,
    rerollCostStones: "180",
  };
  const settledWithReroll = tryAutoSettleOfflineAdventurePending(st, now);
  assert.equal(settledWithReroll.settled, true, "auto policy should still settle after reroll");
  assert.equal(settledWithReroll.rerolled, true, "budget-sufficient pending should auto reroll once");

  st.offlineAdventure.pending = {
    triggeredAtMs: now + 1,
    settledSec: 4200,
    options: [
      { id: "instant", title: "I2", desc: "", instantStones: "100", instantEssence: 1, boostMult: 1, boostDurationSec: 0 },
      { id: "boost", title: "B2", desc: "", instantStones: "0", instantEssence: 0, boostMult: 1.2, boostDurationSec: 3600 },
      { id: "essence", title: "E2", desc: "", instantStones: "0", instantEssence: 5, boostMult: 1, boostDurationSec: 0, zhuLingBonus: 3 },
    ],
    rerolled: false,
    rerollCostStones: "350",
  };
  st.offlineAdventure.autoRerollBudgetStones = "120";
  const settledWithoutReroll = tryAutoSettleOfflineAdventurePending(st, now + 1);
  assert.equal(settledWithoutReroll.settled, true, "over-budget pending should still auto settle");
  assert.equal(settledWithoutReroll.rerolled, false, "over-budget pending should skip auto reroll");
}

function runOfflineAdventurePendingNormalizeSmoke(): void {
  const st = createInitialState();
  const now = Date.now();
  st.offlineAdventure.pending = {
    triggeredAtMs: now,
    settledSec: 3600,
    options: [
      // 非法/缺项：仅保留 instant + 一个重复 instant
      { id: "instant", title: "I", desc: "", instantStones: "90", instantEssence: 1, boostMult: 1, boostDurationSec: 0 },
      { id: "instant", title: "I2", desc: "", instantStones: "110", instantEssence: 1, boostMult: 1, boostDurationSec: 0 },
      { id: "instant", title: "I3", desc: "", instantStones: "130", instantEssence: 2, boostMult: 1, boostDurationSec: 0 },
    ],
    rerolled: false,
    rerollCostStones: "0",
  };
  normalizeOfflineAdventureState(st, now);
  const pending = st.offlineAdventure.pending;
  assert.ok(pending, "invalid pending should be normalized to safe options instead of crashing");
  assert.equal(pending?.options.length, 3, "normalized pending should keep tri-option shape");
  assert.equal(pending?.options[0].id, "instant", "normalized options should contain instant");
  assert.equal(pending?.options[1].id, "boost", "normalized options should backfill boost");
  assert.equal(pending?.options[2].id, "essence", "normalized options should backfill essence");
}

function runWeeklyBountyAutoClaimSmoke(): void {
  const st = createInitialState();
  st.uiPrefs.autoClaimWeeklyBounty = false;
  assert.equal(tryAutoClaimWeeklyBountyIfAny(st, Date.now()), null);
}

function runCelestialStashProgressSmoke(): void {
  const st = createInitialState();
  const now = Date.now();
  const p0 = celestialStashWeeklyProgress(st, now);
  assert.equal(p0.total, 4, "celestial offer count should match data table");
  assert.equal(p0.purchased, 0);
  st.celestialStash.purchased.push("cs_stone_ess");
  const p1 = celestialStashWeeklyProgress(st, now);
  assert.equal(p1.purchased, 1);
}

function runPetAutoFeedPrefSmoke(): void {
  const st = createInitialState();
  st.dungeon.totalWavesCleared = 15;
  st.pets.yuling = { level: 1, xp: 0 };
  st.summonEssence = 500;
  st.uiPrefs.autoFeedPets = false;
  assert.equal(tryAutoFeedAllPetsIfPref(st), null);
  st.uiPrefs.autoFeedPets = true;
  const before = st.summonEssence;
  const n = tryAutoFeedAllPetsIfPref(st);
  assert.ok(n != null && n >= 1, "auto feed should run at least one feed when pref on");
  assert.ok(st.summonEssence < before, "summon essence should drop after auto feed");
}

function runCelestialStashAutoRedeemSmoke(): void {
  const st = createInitialState();
  const now = Date.now();
  addStones(st, 5000);
  st.lingSha = 100;
  st.xuanTie = 100;
  st.uiPrefs.autoRedeemCelestialStash = false;
  assert.equal(tryAutoRedeemCelestialStashOffers(st, now), null);
  st.uiPrefs.autoRedeemCelestialStash = true;
  const r = tryAutoRedeemCelestialStashOffers(st, now);
  assert.ok(r && r.length >= 1, "auto redeem should purchase affordable offers when pref on");
  assert.ok(r!.includes("cs_stone_ess"), "stone→essence offer should auto-redeem when affordable");
}

function runDailyLoginAutoClaimPrefsSmoke(): void {
  const st = createInitialState();
  st.totalPulls = 1;
  st.uiPrefs.autoClaimDailyLogin = true;
  const now = Date.now();
  assert.ok(getUiUnlocks(st).tabDailyLogin, "daily login tab should unlock");
  assert.ok(canClaimDailyLoginReward(st, now), "fresh save should allow claim once per day");
  assert.ok(claimDailyLoginReward(st, now), "claim should succeed");
  assert.equal(canClaimDailyLoginReward(st, now), false, "same-day second claim should fail");
}

function runGardenAutoHarvestSmoke(): void {
  const st = createInitialState();
  st.totalPulls = 1;
  st.realmLevel = 4;
  st.spiritStones = "99999";
  st.uiPrefs.autoHarvestSpiritGarden = true;
  const now = Date.now();
  assert.equal(plantCrop(st, 0, "qing_grass", now - 120_000), true, "garden plant should succeed");
  const r = tryAutoHarvestAndReplantGarden(st, now);
  assert.ok(r != null && r.harvested >= 1, "auto harvest should run when mature");
}

function runSpiritReservoirAutoClaimSmoke(): void {
  const st = createInitialState();
  st.realmLevel = 3;
  st.uiPrefs.autoClaimSpiritReservoir = true;
  const cap = reservoirCap(st);
  st.spiritReservoirStored = cap.toString();
  const got = tryAutoClaimSpiritReservoirIfFull(st);
  assert.ok(got != null && got.gt(0), "auto-claim should return positive amount when full");
  assert.equal(st.spiritReservoirStored, "0", "pool should empty after claim");
}

function runDaoEssenceBreakdownSmoke(): void {
  const st = createInitialState();
  st.peakSpiritStonesThisLife = "1000000";
  st.owned = {
    demo: { defId: "n_iron_slag", stars: 0, level: 1 },
  };
  const b = daoEssenceGainBreakdown(st);
  assert.equal(b.total, daoEssenceGainOnReincarnate(st), "breakdown total must match legacy gain fn");
  assert.equal(b.floorMin, 3, "floor min should be 3");
  assert.ok(b.peakLogPart >= 1, "large peak should contribute log part");
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
  runEstateCommissionAutoSettlePrefSmoke();
  runOfflineAdventureQueueNoOverwriteSmoke();
  runOfflineAdventureAutoPolicySmoke();
  runOfflineAdventureAutoReceiptSmoke();
  runOfflineAdventureAutoRerollBudgetSmoke();
  runOfflineAdventurePendingNormalizeSmoke();
  runDaoEssenceBreakdownSmoke();
  runSpiritReservoirAutoClaimSmoke();
  runGardenAutoHarvestSmoke();
  runDailyLoginAutoClaimPrefsSmoke();
  runCelestialStashProgressSmoke();
  runCelestialStashAutoRedeemSmoke();
  runPetAutoFeedPrefSmoke();
  runWeeklyBountyAutoClaimSmoke();
  runEstateCommissionAutoSettleLoopSmoke();
  // eslint-disable-next-line no-console
  console.log("core systems smoke passed");
}

main();
