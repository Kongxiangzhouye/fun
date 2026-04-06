import assert from "node:assert/strict";
import { createInitialState } from "../state";
import { catchUpOffline, maxOfflineSec } from "../gameLoop";
import { ensureWeeklyBountyWeek, currentWeekKey } from "../systems/weeklyBounty";
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

function main(): void {
  runOfflineCapSmoke();
  runWeeklySyncSmoke();
  runSerializeRoundtripSmoke();
  runSaveSlotSwitchIsolationSmoke();
  runImportExportRoundtripSmoke();
  runDefaultMigrationSmoke();
  // eslint-disable-next-line no-console
  console.log("core systems smoke passed");
}

main();
