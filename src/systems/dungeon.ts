import type { GameState, DungeonMob, DungeonState, DungeonRealmId, Element, WaveCheckpoint } from "../types";
import {
  DUNGEON_DEATH_CD_MS,
  DUNGEON_DODGE_IFRAMES_MS,
  DUNGEON_DODGE_SLIDE,
  DUNGEON_DODGE_STAMINA_COST,
  DUNGEON_HITSTUN_ROOT_MS,
  DUNGEON_BOSS_HITSTUN_ROOT_MS,
  DUNGEON_PLAYER_ATTACK_ROOT_MS,
  DUNGEON_INTER_WAVE_CD_MS,
  DUNGEON_MELEE_MOVE_MULT,
  DUNGEON_MONSTER_HIT_INTERVAL,
  DUNGEON_STAMINA_MAX,
  DUNGEON_STAMINA_REGEN_PER_SEC,
  DUNGEON_REPEAT_ESSENCE_MULT,
  DUNGEON_REPEAT_ENTRY_FEE_MULT,
  PLAYER_DUNGEON_HIT_INTERVAL_SEC,
} from "../types";
import {
  essenceFindMult,
  playerAttack,
  playerCritChance,
  playerCritMult,
  playerDungeonAttackRangeMult,
  playerDungeonAttackSpeedMult,
  playerDungeonDodgeChance,
  playerIncomingDamageMult,
  playerMaxHp,
} from "./playerCombat";
import { nextRand01 } from "../rng";
import { elementDamageMultiplier } from "./elementCombat";
import { playerBattleElement } from "./playerElement";
import {
  dungeonAtkBonusFromSkills,
  dungeonEssenceBonusFromSkills,
  dungeonPlayerMoveSpeedMult,
} from "./battleSkills";
import { petDungeonAtkAdditive } from "./pets";
import { noteWeeklyBountyWave } from "./weeklyBounty";
import {
  dungeonAffixEssenceMult,
  dungeonAffixMobDamageMult,
  dungeonAffixMobHpMult,
  dungeonAffixPlayerAtkMult,
} from "./dungeonAffix";
import { daoMeridianDungeonAtkMult, daoMeridianDungeonEssenceMult } from "./daoMeridian";
import { playerExpectedDpsDungeonAffix } from "./dungeonAffix";
import { noteDungeonEssenceIntGained } from "./pullChronicle";
import {
  DUNGEON_MAP_H,
  DUNGEON_MAP_W,
  bfsReachable,
  cellHasCardinalWalkableNeighbor,
  generateWalkableMap,
  pickRandomWalkableCell,
  reachableCellsForFourWaySpawn,
} from "./dungeonMap";
import { formatMobDisplayName, randomBossEpithet } from "../data/dungeonMobs";
import { clampCombatHpToMax } from "./combatHp";
import Decimal from "decimal.js";
import { stones, subStones } from "../stones";

/** 幻域基础移速（归一化坐标/秒）；心法「御风行」等在 battleSkills 上乘算 */
const BASE_PLAYER_SPEED = 0.14;
/**
 * 首领追击：始终为玩家当前移速的固定比例（心法加成后同步对比），略慢便于拉开距离；
 * 再乘小幅正弦，避免与玩家完全同速「贴死」。旧版固定 0.1 + 大脉动曾出现首领快于玩家。
 */
const BOSS_CHASE_VS_PLAYER = 0.8;
const BOSS_CHASE_PULSE_AMP = 0.12;
/** 新波次/进本短保护：避免刷怪瞬间互殴导致“刚进图就掉血” */
const WAVE_START_GRACE_MS = 700;

/** 星漩乱域：限时连斩窗口（秒→毫秒在逻辑内） */
const VORTEX_STREAK_WINDOW_MS = 4500;
const VORTEX_STREAK_MAX = 8;
/** 每层连斩额外伤害（乘算基数 1 + stack × 此值） */
const VORTEX_STREAK_DMG_PER_STACK = 0.042;
/** 灵脉·狂岚：圈内对魔物伤害乘数 */
const VORTEX_FURY_ATK_MULT = 1.16;
/** 灵脉换位间隔 */
const VORTEX_LEYLINE_MOVE_MS = 12_000;
/** 灵脉·流息：额外体力回复 / 秒 */
const VORTEX_FLOW_STAMINA_PER_SEC = 2.85;
/** 星漩乱域唤灵髓结算加成（鼓励选用） */
const STAR_VORTEX_ESSENCE_MULT = 1.07;
/** 刷怪与玩家出生点的最小格距（曼哈顿）；降低贴脸刷怪感 */
const SPAWN_MIN_CELL_DIST = 3;
/** 过渡波（每段第 4 波）稍降压，缓冲到下一波节点 */
function isTransitionWave(wave: number): boolean {
  return wave % 5 === 4;
}
/** 每帧移动拆成多段，避免高速穿墙或卡死角 */
const MOVE_SUBSTEPS = 14;
/** 单次积分最大步长（秒），避免 tab 切回时 dt 过大一帧跨过许多格 */
const MOVEMENT_INTEGRATION_CAP_SEC = 1 / 36;

function movementIntegrationSteps(dt: number): { steps: number; subDt: number } {
  const steps = Math.max(1, Math.ceil(dt / MOVEMENT_INTEGRATION_CAP_SEC));
  return { steps, subDt: dt / steps };
}
/** 玩家攻击圈基准半径（归一化，约 1.2 格）；命中为圈与魔物碰撞圆重叠（圆心距 ≤ 半径 + 怪半径） */
export const DUNGEON_ENGAGE_NORM = 0.045;

/** 俯视归一化坐标下的碰撞半径（与 UI 圆点尺寸大致对应），用于玩家/怪互不重叠 */
const PLAYER_BODY_RADIUS_NORM = 0.017;
const MOB_BODY_RADIUS_NORM = 0.016;
const MOB_BOSS_BODY_RADIUS_NORM = 0.024;

function mobBodyRadius(m: DungeonMob): number {
  return m.isBoss ? MOB_BOSS_BODY_RADIUS_NORM : MOB_BODY_RADIUS_NORM;
}

/**
 * 幻域普攻是否在「攻击圈」内（与 UI 接战光圈必须同一套数）：
 * - 玩家视为**点**（圆心在归一化坐标 playerX, playerY）。
 * - 魔物有**碰撞半径** `mobBodyRadius(m)`（首领略大）。
 * - 当且仅当 圆心距 ≤ `pRange + mobBodyRadius(m)` 时算进圈，其中 `pRange = DUNGEON_ENGAGE_NORM * playerDungeonAttackRangeMult(state)`。
 * - 不做穿墙格判定（几何进圈即可出伤）。
 */
function mobInPlayerAttackDisk(d: DungeonState, m: DungeonMob, pRange: number): boolean {
  if (m.hp <= 0) return false;
  return dist(d.playerX, d.playerY, m.x, m.y) <= pRange + mobBodyRadius(m);
}

/** 攻击连线是否被墙阻断：用于命中判定公平化（隔墙不互殴） */
function hasClearCombatLine(d: DungeonState, tx: number, ty: number): boolean {
  const w = d.mapW;
  const h = d.mapH;
  if (w <= 0 || h <= 0 || !d.walkable.length) return true;
  const [px, py] = normToCell(d.playerX, d.playerY, w, h);
  const [mx, my] = normToCell(tx, ty, w, h);
  return gridLineInteriorWalkClear(w, h, d.walkable, px, py, mx, my);
}

/** 与 tick 内 inCombat 一致：锁定目标在「接战/被怪摸」带内则不因更近怪而切换 */
function mobInStickyFocusRange(d: DungeonState, m: DungeonMob, pRange: number): boolean {
  if (m.hp <= 0) return false;
  const distPre = dist(d.playerX, d.playerY, m.x, m.y);
  const mobArPre = Math.max(
    Math.max(DUNGEON_ENGAGE_NORM * 1.08, m.attackRange ?? DUNGEON_ENGAGE_NORM),
    pRange * MOB_ATTACK_RANGE_VS_PLAYER,
  );
  const reachToTarget = pRange + mobBodyRadius(m);
  return distPre <= reachToTarget || distPre <= mobArPre + PLAYER_BODY_RADIUS_NORM;
}

/**
 * 玩家格 → 怪格 的 Bresenham 线段（含两端）。
 */
function bresenhamLineCells(ax: number, ay: number, bx: number, by: number): [number, number][] {
  const out: [number, number][] = [];
  let x0 = ax;
  let y0 = ay;
  const x1 = bx;
  const y1 = by;
  const dx = Math.abs(x1 - x0);
  const dy = Math.abs(y1 - y0);
  const sx = x0 < x1 ? 1 : -1;
  const sy = y0 < y1 ? 1 : -1;
  let err = dx - dy;
  let x = x0;
  let y = y0;
  for (;;) {
    out.push([x, y]);
    if (x === x1 && y === y1) break;
    const e2 = 2 * err;
    if (e2 > -dy) {
      err -= dy;
      x += sx;
    }
    if (e2 < dx) {
      err += dx;
      y += sy;
    }
  }
  return out;
}

/** 两端可走前提下，线段中间格均可走（用于站桩判定；中间有墙则仍需绕路） */
function gridLineInteriorWalkClear(
  w: number,
  h: number,
  walkable: boolean[],
  ax: number,
  ay: number,
  bx: number,
  by: number,
): boolean {
  const pts = bresenhamLineCells(ax, ay, bx, by);
  if (pts.length <= 2) return true;
  for (let i = 1; i < pts.length - 1; i++) {
    const [cx, cy] = pts[i]!;
    if (cx < 0 || cy < 0 || cx >= w || cy >= h) return false;
    if (!walkable[cy * w + cx]) return false;
  }
  return true;
}

/**
 * 站桩停风筝：几何上已进攻击圈，且与**至少一只**进圈怪之间的格网线路上无墙。
 * 若中间隔障碍（如 (1,2) 墙挡在 (1,1) 与 (1,3) 之间），不站桩，继续 A* 风筝——此前仅用几何圈会误判「已到位」而根本不走位。
 * 普攻命中仍只按 `mobInPlayerAttackDisk`（可穿墙），与此处是否站桩无关。
 */
function shouldHoldKiteNoDetour(d: DungeonState, pRange: number): boolean {
  const w = d.mapW;
  const h = d.mapH;
  if (w <= 0 || h <= 0 || !d.walkable.length) {
    for (const m of d.mobs) {
      if (m.hp <= 0) continue;
      if (mobInPlayerAttackDisk(d, m, pRange)) return true;
    }
    return false;
  }
  const [px, py] = normToCell(d.playerX, d.playerY, w, h);
  for (const m of d.mobs) {
    if (m.hp <= 0) continue;
    if (!mobInPlayerAttackDisk(d, m, pRange)) continue;
    const [mx, my] = normToCell(m.x, m.y, w, h);
    if (gridLineInteriorWalkClear(w, h, d.walkable, px, py, mx, my)) return true;
  }
  return false;
}
/** 怪有效攻击距至少为玩家接战距 × 此值，避免玩家射程更长时只秒怪、怪摸不到人 */
const MOB_ATTACK_RANGE_VS_PLAYER = 1.12;

/** 超过此距离（按格估算）的非锁定怪不再主动围拢 */
const CHASE_CELL_DIST = 7.5;
/** 非 Boss、非锁定目标时的随机游走速度（归一化坐标/秒量级） */
const WANDER_SPEED = 0.11;
/** 游荡朝向抖动（弧度/秒量级），越大转向越快、覆盖地图越快 */
const WANDER_HEADING_JITTER = 3.1;
/** 首领战侧向闪避额外位移系数（叠在寻路上） */
const BOSS_DODGE_STRAFE = 0.48;

const EL_LIST: Element[] = ["metal", "wood", "water", "fire", "earth"];

function saveWaveCheckpoint(state: GameState): void {
  const d = state.dungeon;
  if (!d.mobs.some((m) => m.hp > 0) || d.mapW <= 0) return;
  d.waveCheckpoint[d.wave] = {
    mobs: d.mobs.map((m) => ({ ...m })),
    walkable: [...d.walkable],
    mapW: d.mapW,
    mapH: d.mapH,
    packSize: d.packSize,
    packKilled: d.packKilled,
    essenceThisWave: d.essenceThisWave,
    monsterAttackAccum: d.monsterAttackAccum,
    playerAttackAccum: d.playerAttackAccum,
    playerAttackTargetMobId: d.playerAttackTargetMobId,
    spawnX: d.waveEntrySpawnX,
    spawnY: d.waveEntrySpawnY,
    rewardModeRepeat: d.rewardModeRepeat,
  };
}

function restoreWaveFromCheckpoint(state: GameState, ck: WaveCheckpoint): void {
  const d = state.dungeon;
  d.walkable = ck.walkable;
  d.mapW = ck.mapW;
  d.mapH = ck.mapH;
  d.mobs = ck.mobs.map((m) => ({
    ...m,
    mobRole: m.isBoss ? undefined : (m.mobRole ?? "melee"),
  }));
  /** 以场上实体为准，避免旧存档 packSize 与 mobs 数量不一致导致永远无法清关 */
  d.packSize = d.mobs.length;
  d.packKilled = ck.packKilled;
  if (d.packKilled > d.packSize) d.packKilled = d.packSize;
  const deadN = d.mobs.filter((m) => m.hp <= 0).length;
  d.packKilled = Math.min(d.packSize, Math.max(d.packKilled, deadN));
  d.essenceThisWave = ck.essenceThisWave;
  d.monsterAttackAccum = ck.monsterAttackAccum;
  d.playerAttackAccum = ck.playerAttackAccum ?? 0;
  d.playerAttackTargetMobId = ck.playerAttackTargetMobId ?? 0;
  d.playerX = ck.spawnX;
  d.playerY = ck.spawnY;
  d.waveEntrySpawnX = ck.spawnX;
  d.waveEntrySpawnY = ck.spawnY;
  d.rewardModeRepeat = ck.rewardModeRepeat ?? false;
  syncBars(state, d);
}

function playerMoveSpeed(state: GameState): number {
  return BASE_PLAYER_SPEED * dungeonPlayerMoveSpeedMult(state);
}

/** 请求下一 tick 尝试闪避（体力与无敌帧由 tick 内判定） */
export function queueDungeonDodge(state: GameState): void {
  if (!state.dungeon.active) return;
  state.dungeon.dodgeQueued = true;
}

function applyDodgeSlide(state: GameState, d: DungeonState, target: DungeonMob): void {
  const bx = d.playerX - target.x;
  const by = d.playerY - target.y;
  const len = Math.hypot(bx, by) || 1;
  const perpX = -(by / len);
  const perpY = bx / len;
  const flip = nextRand01(state) < 0.5 ? 1 : -1;
  const pPos = { x: d.playerX, y: d.playerY };
  const mag = DUNGEON_DODGE_SLIDE * flip;
  const gx = d.playerX + perpX * mag;
  const gy = d.playerY + perpY * mag;
  moveEntityGridSeek(d, pPos, gx, gy, Math.abs(mag), 1, { x: target.x, y: target.y });
  d.playerX = pPos.x;
  d.playerY = pPos.y;
}

/** 非接战：沿上一帧寻路方向位移；无有效方向时沿追击目标方向（靠近） */
function applyDodgeAlongMoveDirection(state: GameState, d: DungeonState, target: DungeonMob): void {
  let nx = d.playerLastMoveNx;
  let ny = d.playerLastMoveNy;
  let ln = Math.hypot(nx, ny);
  if (ln < 0.12) {
    const bx = target.x - d.playerX;
    const by = target.y - d.playerY;
    ln = Math.hypot(bx, by) || 1;
    nx = bx / ln;
    ny = by / ln;
  } else {
    nx /= ln;
    ny /= ln;
  }
  const pPos = { x: d.playerX, y: d.playerY };
  const mag = DUNGEON_DODGE_SLIDE;
  const gx = d.playerX + nx * mag;
  const gy = d.playerY + ny * mag;
  moveEntityGridSeek(d, pPos, gx, gy, mag, 1, { x: target.x, y: target.y });
  d.playerX = pPos.x;
  d.playerY = pPos.y;
}

/** 玩家幻域接战/攻击距离（归一化），与 tick 内判定一致；供 UI 展示 */
export function playerEngageRadiusNorm(state: GameState): number {
  return DUNGEON_ENGAGE_NORM * playerDungeonAttackRangeMult(state);
}

/**
 * 接战光圈**外缘**的归一化半径，与 `mobInPlayerAttackDisk` 对齐：`pRange + 怪碰撞半径`。
 * 场上多只怪时取**存活怪中最大**碰撞半径，使光圈表示「连体积最大的怪也算几何进圈」。
 * （地图为矩形时，用主循环里按此半径 × 地图宽高像素画椭圆，与归一化距离判定一致。）
 */
export function playerAttackDiskOuterRadiusNormForUi(state: GameState, d: DungeonState): number {
  const pr = playerEngageRadiusNorm(state);
  let maxBr = MOB_BODY_RADIUS_NORM;
  for (const m of d.mobs) {
    if (m.hp > 0) maxBr = Math.max(maxBr, mobBodyRadius(m));
  }
  return pr + maxBr;
}

/** 同波生命池拆条后：近战略增厚、远程显著削血（脆身） */
const MOB_MELEE_HP_MULT = 1.22;
const MOB_RANGED_HP_MULT = 0.58;

function rollMobCombatStats(
  state: GameState,
  wave: number,
  isBoss: boolean,
  role: "melee" | "ranged",
): { dodge: number; attackRange: number; attackInterval: number; moveSpeedMul: number } {
  const r = nextRand01(state);
  const waveDodge = 0.035 + wave * 0.0015 + nextRand01(state) * 0.06;
  let dodge = clamp(waveDodge, 0.03, 0.32);
  const baseInt = DUNGEON_MONSTER_HIT_INTERVAL;
  const waveAtk = 1 + Math.min(50, wave) * 0.01;

  if (isBoss) {
    const arMul = 1.35 + r * 0.28;
    const attackRange = Math.max(DUNGEON_ENGAGE_NORM * 1.12, DUNGEON_ENGAGE_NORM * arMul);
    const attackInterval = clamp(
      (baseInt * (0.85 + nextRand01(state) * 0.12)) / waveAtk,
      0.42,
      2.2,
    );
    const moveSpeedMul = clamp(1.0 + nextRand01(state) * 0.22, 0.45, 1.45);
    return { dodge: Math.min(0.26, dodge), attackRange, attackInterval, moveSpeedMul };
  }

  /** 近战：入战距短、血厚、略难闪避、移速较快；远程：射程远、血脆、易偏斜、移速慢 */
  if (role === "melee") {
    dodge = clamp(waveDodge * 1.06, 0.03, 0.34);
    const arMul = 1.06 + nextRand01(state) * 0.24;
    const attackRange = Math.max(DUNGEON_ENGAGE_NORM * 1.06, DUNGEON_ENGAGE_NORM * arMul);
    const attackInterval = clamp(
      (baseInt * (0.86 + nextRand01(state) * 0.32)) / waveAtk,
      0.42,
      2.2,
    );
    const moveSpeedMul = clamp(0.72 + nextRand01(state) * 0.58, 0.48, 1.42);
    return { dodge: Math.min(0.28, dodge), attackRange, attackInterval, moveSpeedMul };
  }

  dodge = clamp(waveDodge * 0.68, 0.02, 0.26);
  const arMul = 1.58 + nextRand01(state) * 0.92;
  const attackRange = Math.max(DUNGEON_ENGAGE_NORM * 1.48, DUNGEON_ENGAGE_NORM * arMul);
  const attackInterval = clamp(
    (baseInt * (1.04 + nextRand01(state) * 0.38)) / waveAtk,
    0.45,
    2.35,
  );
  const moveSpeedMul = clamp(0.48 + nextRand01(state) * 0.46, 0.4, 1.05);
  return { dodge: Math.min(0.22, dodge), attackRange, attackInterval, moveSpeedMul };
}

/**
 * 非首领：沿「怪 → 玩家」方向维持在最大攻击距离附近，与怪反向拉扯，减少贴脸。
 */
function movePlayerKiteMaxRange(
  state: GameState,
  d: DungeonState,
  pPos: { x: number; y: number },
  target: DungeonMob,
  subDt: number,
): void {
  const pRange = playerEngageRadiusNorm(state);
  const range = dist(pPos.x, pPos.y, target.x, target.y);
  const bx = pPos.x - target.x;
  const by = pPos.y - target.y;
  const len = Math.hypot(bx, by);
  let ux: number;
  let uy: number;
  if (len < 1e-7) {
    ux = 1;
    uy = 0;
  } else {
    ux = bx / len;
    uy = by / len;
  }
  const reach = pRange + mobBodyRadius(target);
  const ideal = reach * 0.94;
  const goalX = target.x + ux * ideal;
  const goalY = target.y + uy * ideal;
  const inMelee = range <= reach;
  const spd = playerMoveSpeed(state) * (inMelee ? DUNGEON_MELEE_MOVE_MULT : 1);
  moveEntityGridSeek(d, pPos, goalX, goalY, spd, subDt, { x: target.x, y: target.y });
}

function moveMobFourWayChase(
  d: DungeonState,
  m: DungeonMob,
  pRange: number,
  subDt: number,
): void {
  const mPos = { x: m.x, y: m.y };
  const mRange = Math.max(DUNGEON_ENGAGE_NORM * 1.05, m.attackRange ?? DUNGEON_ENGAGE_NORM);
  const reachByPlayer = pRange + mobBodyRadius(m);
  const desired =
    m.mobRole === "ranged"
      ? Math.min(mRange * 0.92, reachByPlayer * 0.9)
      : Math.max(PLAYER_BODY_RADIUS_NORM + mobBodyRadius(m) + 0.002, mRange * 0.7);
  const dx = d.playerX - mPos.x;
  const dy = d.playerY - mPos.y;
  const len = Math.hypot(dx, dy) || 1;
  const ux = dx / len;
  const uy = dy / len;
  const goalX = d.playerX - ux * desired;
  const goalY = d.playerY - uy * desired;
  const spd = BASE_PLAYER_SPEED * 0.9 * (m.moveSpeedMul > 0 ? m.moveSpeedMul : 1);
  moveEntityGridSeek(d, mPos, goalX, goalY, spd, subDt, { x: d.playerX, y: d.playerY });
  m.x = mPos.x;
  m.y = mPos.y;
}

function moveMobFourWayWander(
  state: GameState,
  d: DungeonState,
  m: DungeonMob,
  subDt: number,
): void {
  if (m.wanderHeading == null) m.wanderHeading = nextRand01(state) * Math.PI * 2;
  m.wanderHeading += (nextRand01(state) - 0.5) * WANDER_HEADING_JITTER * subDt;
  const wh = m.wanderHeading;
  const roamStep = Math.max(0.02, WANDER_SPEED * (m.moveSpeedMul > 0 ? m.moveSpeedMul : 1) * 0.75);
  const goalX = clamp(m.x + Math.cos(wh) * roamStep, 0.02, 0.98);
  const goalY = clamp(m.y + Math.sin(wh) * roamStep, 0.02, 0.98);
  const mPos = { x: m.x, y: m.y };
  moveEntityGridSeek(d, mPos, goalX, goalY, roamStep, 1, { x: d.playerX, y: d.playerY });
  m.x = mPos.x;
  m.y = mPos.y;
}

/**
 * 首领战：沿接战距离侧移环绕 + 普攻将落地前侧向滑步
 */
function movePlayerInBossFight(
  state: GameState,
  d: DungeonState,
  pPos: { x: number; y: number },
  target: DungeonMob,
  subDt: number,
  now: number,
): void {
  const pRange = playerEngageRadiusNorm(state);
  const reach = pRange + mobBodyRadius(target);
  const range = dist(pPos.x, pPos.y, target.x, target.y);
  const meleeSlow = range <= reach ? DUNGEON_MELEE_MOVE_MULT : 1;
  const spd = playerMoveSpeed(state) * meleeSlow;
  if (range > reach * 3.4) {
    moveEntityGridSeek(d, pPos, target.x, target.y, spd, subDt);
    return;
  }
  const bx = target.x - pPos.x;
  const by = target.y - pPos.y;
  const len = Math.hypot(bx, by) || 1;
  const nx = bx / len;
  const ny = by / len;
  const perpX = -ny;
  const perpY = nx;
  const t = now * 0.001;
  const orbit = 0.03 * Math.sin(t * 2.35 + d.wave * 0.65);
  const idealDist = reach * 0.94;
  const cx = target.x - nx * idealDist + perpX * orbit;
  const cy = target.y - ny * idealDist + perpY * orbit;
  moveEntityGridSeek(d, pPos, cx, cy, spd * 1.1, subDt, { x: target.x, y: target.y });
  const iv = Math.max(0.35, target.attackInterval ?? DUNGEON_MONSTER_HIT_INTERVAL);
  const phase = (d.monsterAttackAccum % iv) / iv;
  if (phase > 0.7) {
    const flip = Math.sin(now * 0.004 + d.wave) >= 0 ? 1 : -1;
    const spdBase = playerMoveSpeed(state) * meleeSlow;
    slideEntity(
      d,
      pPos,
      perpX * flip * BOSS_DODGE_STRAFE * spdBase * subDt,
      perpY * flip * BOSS_DODGE_STRAFE * spdBase * subDt,
      MOVE_SUBSTEPS,
    );
  }
}

/** 幻域伤害飘字（不入档，每帧由主循环消费） */
export interface DungeonDamageFloat {
  nx: number;
  ny: number;
  text: string;
  cls: "dmg-out" | "dmg-in" | "dmg-miss";
}

const damageFloatQueue: DungeonDamageFloat[] = [];
let dmgFloatAcc = 0;
let dmgFloatTime = 0;

function pushDamageFloat(
  nx: number,
  ny: number,
  text: string,
  cls: "dmg-out" | "dmg-in" | "dmg-miss",
): void {
  damageFloatQueue.push({ nx, ny, text, cls });
}

export function drainDungeonDamageFloats(): DungeonDamageFloat[] {
  if (damageFloatQueue.length === 0) return [];
  return damageFloatQueue.splice(0, damageFloatQueue.length);
}

function resetDamageFloatAccum(): void {
  dmgFloatAcc = 0;
  dmgFloatTime = 0;
}

export function currentBossMob(d: DungeonState): DungeonMob | null {
  return d.mobs.find((m) => m.isBoss && m.hp > 0) ?? null;
}

export function bossDisplayTitle(m: DungeonMob): string {
  return formatMobDisplayName(m.element, m.mobKind, true, m.bossEpithet, undefined);
}

/** UI：锁定目标一行 */
export function describeMobBattleRole(m: DungeonMob): string {
  if (m.isBoss) return "首领";
  if (m.mobRole === "ranged") return "远程";
  if (m.mobRole === "melee") return "近战";
  return "近战";
}

function clamp(v: number, a: number, b: number): number {
  return Math.max(a, Math.min(b, v));
}

function dist(ax: number, ay: number, bx: number, by: number): number {
  return Math.hypot(ax - bx, ay - by);
}

function normToCell(x: number, y: number, w: number, h: number): [number, number] {
  const cx = clamp(Math.floor(x * w), 0, w - 1);
  const cy = clamp(Math.floor(y * h), 0, h - 1);
  return [cx, cy];
}

function playerInVortexLeyline(d: DungeonState): boolean {
  const r = d.vortexLeylineRadiusNorm > 0 ? d.vortexLeylineRadiusNorm : 0.088;
  return dist(d.playerX, d.playerY, d.vortexLeylineX, d.vortexLeylineY) <= r + 0.014;
}

function initStarVortexLeyline(state: GameState, d: DungeonState, now: number): void {
  if (state.dungeonRealm !== "star_vortex") return;
  if (d.mapW <= 0 || !d.walkable.length) return;
  const [px, py] = normToCell(d.playerX, d.playerY, d.mapW, d.mapH);
  const reach = bfsReachable(d.mapW, d.mapH, d.walkable, px, py);
  const spot = pickRandomWalkableCell(state, d.walkable, d.mapW, d.mapH, reach, new Set<number>());
  if (spot) {
    d.vortexLeylineX = (spot.x + 0.5) / d.mapW;
    d.vortexLeylineY = (spot.y + 0.5) / d.mapH;
  } else {
    d.vortexLeylineX = d.playerX;
    d.vortexLeylineY = d.playerY;
  }
  d.vortexLeylineRadiusNorm = 0.088;
  d.vortexLeylineKind = nextRand01(state) < 0.5 ? "fury" : "flow";
  d.vortexLeylineMoveAt = now + VORTEX_LEYLINE_MOVE_MS;
}

function tickStarVortexRealm(state: GameState, d: DungeonState, dt: number, now: number): void {
  if (state.dungeonRealm !== "star_vortex") return;
  if (now > d.vortexStreakExpireAt && d.vortexKillStreak > 0) {
    d.vortexKillStreak = 0;
  }
  if (now >= d.vortexLeylineMoveAt) {
    initStarVortexLeyline(state, d, now);
  }
  if (d.vortexLeylineKind === "flow" && playerInVortexLeyline(d)) {
    d.stamina = Math.min(DUNGEON_STAMINA_MAX, d.stamina + VORTEX_FLOW_STAMINA_PER_SEC * dt);
  }
}

export function dungeonVortexDamageMult(state: GameState, d: DungeonState, now: number): number {
  if (state.dungeonRealm !== "star_vortex" || !d.active) return 1;
  let m = 1 + Math.min(VORTEX_STREAK_MAX, d.vortexKillStreak) * VORTEX_STREAK_DMG_PER_STACK;
  if (d.vortexLeylineKind === "fury" && playerInVortexLeyline(d)) m *= VORTEX_FURY_ATK_MULT;
  return m;
}

export function playerExpectedDpsDungeonRealm(state: GameState, now: number): number {
  const base = playerExpectedDpsDungeonAffix(state, now);
  if (state.dungeonRealm !== "star_vortex" || !state.dungeon.active) return base;
  return base * dungeonVortexDamageMult(state, state.dungeon, now);
}

export function playerInStarVortexLeylineForUi(d: DungeonState): boolean {
  return playerInVortexLeyline(d);
}

export function starVortexLeylineLabel(kind: "fury" | "flow"): string {
  return kind === "fury" ? "狂岚" : "流息";
}

export function dungeonRealmLabel(id: DungeonRealmId): string {
  return id === "star_vortex" ? "星漩乱域" : "经典幻域";
}

function canStand(x: number, y: number, d: DungeonState): boolean {
  if (d.mapW <= 0 || d.mapH <= 0 || !d.walkable.length) return true;
  const [cx, cy] = normToCell(x, y, d.mapW, d.mapH);
  return d.walkable[cy * d.mapW + cx];
}

/**
 * 若从 from 到 to 的格心位移跨越「对角相邻的两格」，则两直角方向上的邻格必须至少有一个可走，
 * 否则属于从两堵墙夹角斜挤进对角格，与四连通行走不一致（原 slideEntity 先横后纵会误放行）。
 */
function allowsDiagonalGridStep(
  d: DungeonState,
  fromX: number,
  fromY: number,
  toX: number,
  toY: number,
): boolean {
  if (d.mapW <= 0 || d.mapH <= 0 || !d.walkable.length) return true;
  const w = d.mapW;
  const h = d.mapH;
  const [cx0, cy0] = normToCell(fromX, fromY, w, h);
  const [cx1, cy1] = normToCell(toX, toY, w, h);
  if (Math.abs(cx1 - cx0) !== 1 || Math.abs(cy1 - cy0) !== 1) return true;
  const iSideA = cy0 * w + cx1;
  const iSideB = cy1 * w + cx0;
  return d.walkable[iSideA] || d.walkable[iSideB];
}

function canStandFromPrev(d: DungeonState, x: number, y: number, fromX: number, fromY: number): boolean {
  if (!canStand(x, y, d)) return false;
  return allowsDiagonalGridStep(d, fromX, fromY, x, y);
}

/** 若点不在可走格，吸附到最近可走格中心（玩家与魔物共用） */
function snapNormPosToNearestWalkable(d: DungeonState, pos: { x: number; y: number }): void {
  if (d.mapW <= 0 || d.mapH <= 0 || !d.walkable.length) return;
  if (canStand(pos.x, pos.y, d)) return;
  const w = d.mapW;
  const h = d.mapH;
  const [cx0, cy0] = normToCell(pos.x, pos.y, w, h);
  const q: [number, number][] = [[cx0, cy0]];
  const seen = new Set<number>([cy0 * w + cx0]);
  let qi = 0;
  const dirs = [
    [1, 0],
    [-1, 0],
    [0, 1],
    [0, -1],
  ];
  while (qi < q.length) {
    const [x, y] = q[qi++]!;
    if (x < 0 || y < 0 || x >= w || y >= h) continue;
    const i = y * w + x;
    if (d.walkable[i]) {
      if (cellHasCardinalWalkableNeighbor(w, h, d.walkable, i)) {
        pos.x = (x + 0.5) / w;
        pos.y = (y + 0.5) / h;
        return;
      }
    }
    for (const [dx, dy] of dirs) {
      const nx = x + dx;
      const ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
      const ni = ny * w + nx;
      if (seen.has(ni)) continue;
      seen.add(ni);
      q.push([nx, ny]);
    }
  }
}

function snapPlayerToNearestWalkable(d: DungeonState): void {
  const pos = { x: d.playerX, y: d.playerY };
  snapNormPosToNearestWalkable(d, pos);
  d.playerX = pos.x;
  d.playerY = pos.y;
}

/** 两圆心距离若小于 minDist，则沿法向推开（带墙检测与分步衰减） */
function trySeparatePair(
  d: DungeonState,
  a: { x: number; y: number },
  b: { x: number; y: number },
  minDist: number,
  weightA: number,
  weightB: number,
): void {
  let dx = a.x - b.x;
  let dy = a.y - b.y;
  let len = Math.hypot(dx, dy);
  if (len >= minDist - 1e-10) return;
  if (len < 1e-12) {
    dx = 1;
    dy = 0;
    len = 1;
  } else {
    dx /= len;
    dy /= len;
  }
  const overlap = minDist - len;
  const wSum = weightA + weightB;
  const wa = weightA / wSum;
  const wb = weightB / wSum;
  for (const frac of [1, 0.55, 0.3]) {
    const mag = overlap * frac;
    const axN = a.x + dx * mag * wa;
    const ayN = a.y + dy * mag * wa;
    const bxN = b.x - dx * mag * wb;
    const byN = b.y - dy * mag * wb;
    let setA = false;
    let setB = false;
    const ax0 = a.x;
    const ay0 = a.y;
    const bx0 = b.x;
    const by0 = b.y;
    if (canStandFromPrev(d, axN, ayN, ax0, ay0)) {
      a.x = axN;
      a.y = ayN;
      setA = true;
    } else if (canStandFromPrev(d, axN, a.y, ax0, ay0)) {
      a.x = axN;
      setA = true;
    } else if (canStandFromPrev(d, a.x, ayN, ax0, ay0)) {
      a.y = ayN;
      setA = true;
    }
    if (canStandFromPrev(d, bxN, byN, bx0, by0)) {
      b.x = bxN;
      b.y = byN;
      setB = true;
    } else if (canStandFromPrev(d, bxN, b.y, bx0, by0)) {
      b.x = bxN;
      setB = true;
    } else if (canStandFromPrev(d, b.x, byN, bx0, by0)) {
      b.y = byN;
      setB = true;
    }
    if (setA || setB) break;
  }
}

/**
 * 两怪贴边/死角时，纯法线分离常两侧撞墙无效；改用切向滑移 + 多种推力分配，减少地图边缘「粘成一团」。
 */
function separateMobPairRobust(d: DungeonState, a: DungeonMob, b: DungeonMob): void {
  const minD = mobBodyRadius(a) + mobBodyRadius(b);
  let dx = a.x - b.x;
  let dy = a.y - b.y;
  let len0 = Math.hypot(dx, dy);
  if (len0 >= minD - 1e-9) return;
  if (len0 < 1e-11) {
    const ang = (((a.id * 2654435761) ^ (b.id * 1597334677)) % 6283) / 1000;
    dx = Math.cos(ang) * 1e-4;
    dy = Math.sin(ang) * 1e-4;
    len0 = Math.hypot(dx, dy);
  }
  dx /= len0;
  dy /= len0;
  const gap = minD - Math.hypot(a.x - b.x, a.y - b.y) + 3e-5;
  if (gap <= 0) return;
  const px = -dy;
  const py = dx;

  const tryPush = (ux: number, uy: number, mag: number, wa: number, wb: number): boolean => {
    const ax0 = a.x;
    const ay0 = a.y;
    const bx0 = b.x;
    const by0 = b.y;
    const axN = a.x + ux * mag * wa;
    const ayN = a.y + uy * mag * wa;
    const bxN = b.x - ux * mag * wb;
    const byN = b.y - uy * mag * wb;
    let moved = false;
    if (canStandFromPrev(d, axN, ayN, ax0, ay0)) {
      a.x = axN;
      a.y = ayN;
      moved = true;
    } else if (canStandFromPrev(d, axN, a.y, ax0, ay0)) {
      a.x = axN;
      moved = true;
    } else if (canStandFromPrev(d, a.x, ayN, ax0, ay0)) {
      a.y = ayN;
      moved = true;
    }
    if (canStandFromPrev(d, bxN, byN, bx0, by0)) {
      b.x = bxN;
      b.y = byN;
      moved = true;
    } else if (canStandFromPrev(d, bxN, b.y, bx0, by0)) {
      b.x = bxN;
      moved = true;
    } else if (canStandFromPrev(d, b.x, byN, bx0, by0)) {
      b.y = byN;
      moved = true;
    }
    return moved;
  };

  const splits: [number, number][] = [
    [0.5, 0.5],
    [0.62, 0.38],
    [0.38, 0.62],
    [0.75, 0.25],
    [0.25, 0.75],
  ];
  for (const [wa, wb] of splits) {
    if (tryPush(dx, dy, gap, wa, wb)) return;
    if (tryPush(px, py, gap * 0.9, wa, wb)) return;
  }
  const slip = gap * 0.45;
  for (const sgn of [1, -1]) {
    if (tryPush(px * sgn, py * sgn, slip, 1, 0)) return;
    if (tryPush(px * sgn, py * sgn, slip, 0, 1)) return;
    if (tryPush(dx * sgn, dy * sgn, slip * 0.8, 0.55, 0.45)) return;
  }
}

function resolveDungeonBodyOverlaps(d: DungeonState): void {
  const pr = PLAYER_BODY_RADIUS_NORM;
  const p = { x: d.playerX, y: d.playerY };
  const alive = d.mobs.filter((m) => m.hp > 0);
  for (let pass = 0; pass < 3; pass++) {
    p.x = d.playerX;
    p.y = d.playerY;
    for (const m of alive) {
      const minD = pr + mobBodyRadius(m);
      trySeparatePair(d, p, m, minD, 0.42, 0.58);
    }
    for (let i = 0; i < alive.length; i++) {
      const a = alive[i]!;
      for (let j = i + 1; j < alive.length; j++) {
        const b = alive[j]!;
        const minD = mobBodyRadius(a) + mobBodyRadius(b);
        trySeparatePair(d, a, b, minD, 0.5, 0.5);
      }
    }
    d.playerX = p.x;
    d.playerY = p.y;
  }
  for (let pass = 0; pass < 3; pass++) {
    for (let i = 0; i < alive.length; i++) {
      const a = alive[i]!;
      for (let j = i + 1; j < alive.length; j++) {
        separateMobPairRobust(d, a, alive[j]!);
      }
    }
  }
  snapNormPosToNearestWalkable(d, p);
  d.playerX = p.x;
  d.playerY = p.y;
  for (const m of alive) {
    const mp = { x: m.x, y: m.y };
    snapNormPosToNearestWalkable(d, mp);
    m.x = mp.x;
    m.y = mp.y;
  }
}

function slideEntity(
  d: DungeonState,
  ex: { x: number; y: number },
  vx: number,
  vy: number,
  substeps: number,
): void {
  if (substeps <= 0) return;
  for (let s = 0; s < substeps; s++) {
    const px = vx / substeps;
    const py = vy / substeps;
    const ox = ex.x;
    const oy = ex.y;
    const tx = ox + px;
    const ty = oy + py;
    if (canStandFromPrev(d, tx, ty, ox, oy)) {
      ex.x = tx;
      ex.y = ty;
      continue;
    }
    if (canStandFromPrev(d, tx, oy, ox, oy)) ex.x = tx;
    if (canStandFromPrev(d, ex.x, ty, ox, oy)) ex.y = ty;
  }
}

const PATH_DIRS: readonly [number, number][] = [
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
];

function astarHeapPush(heap: [number, number][], item: [number, number]): void {
  heap.push(item);
  let i = heap.length - 1;
  while (i > 0) {
    const p = (i - 1) >> 1;
    if (heap[p]![0] <= heap[i]![0]) break;
    const t = heap[p]!;
    heap[p] = heap[i]!;
    heap[i] = t;
    i = p;
  }
}

function astarHeapPop(heap: [number, number][]): [number, number] | undefined {
  if (heap.length === 0) return undefined;
  const ret = heap[0]!;
  const last = heap.pop()!;
  if (heap.length === 0) return ret;
  heap[0] = last;
  let i = 0;
  for (;;) {
    const l = i * 2 + 1;
    const r = l + 1;
    let smallest = i;
    if (l < heap.length && heap[l]![0] < heap[smallest]![0]) smallest = l;
    if (r < heap.length && heap[r]![0] < heap[smallest]![0]) smallest = r;
    if (smallest === i) break;
    const t = heap[smallest]!;
    heap[smallest] = heap[i]!;
    heap[i] = t;
    i = smallest;
  }
  return ret;
}

/**
 * 四连通格网 A*（代价 1 / 步，曼哈顿启发），返回最短路不含起点；不可达返回 null。
 */
function aStarShortestPathCells(
  w: number,
  h: number,
  walkable: boolean[],
  si: number,
  gi: number,
): number[] | null {
  if (!walkable[si] || !walkable[gi]) return null;
  if (si === gi) return [];
  const gx = gi % w;
  const gy = Math.floor(gi / w);
  const n = w * h;
  const INF = 0x7fffffff;
  const gScore = new Int32Array(n);
  gScore.fill(INF);
  gScore[si] = 0;
  const cameFrom = new Map<number, number>();
  const closed = new Uint8Array(n);
  const heap: [number, number][] = [];
  const sx = si % w;
  const sy = Math.floor(si / w);
  astarHeapPush(heap, [Math.abs(sx - gx) + Math.abs(sy - gy), si]);

  while (heap.length) {
    const popped = astarHeapPop(heap);
    if (!popped) break;
    const [, current] = popped;
    if (closed[current]) continue;
    closed[current] = 1;
    if (current === gi) {
      const pathRev: number[] = [];
      let c = gi;
      while (c !== si) {
        pathRev.push(c);
        c = cameFrom.get(c)!;
      }
      pathRev.reverse();
      return pathRev;
    }
    const cx = current % w;
    const cy = Math.floor(current / w);
    const gCur = gScore[current];
    for (const [dx, dy] of PATH_DIRS) {
      const nx = cx + dx;
      const ny = cy + dy;
      if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
      const ni = ny * w + nx;
      if (!walkable[ni] || closed[ni]) continue;
      const tentative = gCur + 1;
      if (tentative >= gScore[ni]) continue;
      cameFrom.set(ni, current);
      gScore[ni] = tentative;
      const f = tentative + Math.abs(nx - gx) + Math.abs(ny - gy);
      astarHeapPush(heap, [f, ni]);
    }
  }
  return null;
}

/**
 * 当前格四邻可走格中，选一个使得到 goal 归一化坐标距离最短的格（用于最短路不存在时的兜底，避免顶墙空转）。
 */
function greedyNeighborTowardGoal(
  w: number,
  h: number,
  walkable: boolean[],
  si: number,
  goalNormX: number,
  goalNormY: number,
): number | null {
  const cx = si % w;
  const cy = Math.floor(si / w);
  let best: number | null = null;
  let bestD = Infinity;
  for (const [dx, dy] of PATH_DIRS) {
    const nx = cx + dx;
    const ny = cy + dy;
    if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
    const ni = ny * w + nx;
    if (!walkable[ni]) continue;
    const ncx = (nx + 0.5) / w;
    const ncy = (ny + 0.5) / h;
    const dd = Math.hypot(goalNormX - ncx, goalNormY - ncy);
    if (dd < bestD) {
      bestD = dd;
      best = ni;
    }
  }
  return best;
}

/** 朝「路径上下一格中心」或「同格时的精确点」移动，避免直线被障碍挡住时卡死 */
function steerOnGridToward(
  d: DungeonState,
  ex: { x: number; y: number },
  goalNormX: number,
  goalNormY: number,
  speed: number,
  dt: number,
): void {
  const w = d.mapW;
  const h = d.mapH;
  const len0 = Math.hypot(goalNormX - ex.x, goalNormY - ex.y) || 1;
  const pvx = ((goalNormX - ex.x) / len0) * speed * dt;
  const pvy = ((goalNormY - ex.y) / len0) * speed * dt;
  slideEntity(d, ex, pvx, pvy, MOVE_SUBSTEPS);
}

/**
 * 从 ex 所在格沿最短路走向 (goalNormX, goalNormY) 所在格；同格则走向该精确坐标。
 * 目标落在墙格或理想点与玩家不连通时，先吸附目标再走最短路；仍不可达时用 altGoal（如怪站位）再试，最后用四邻贪心逼近，避免退化成穿墙直线导致卡住。
 */
function moveEntityGridSeek(
  d: DungeonState,
  ex: { x: number; y: number },
  goalNormX: number,
  goalNormY: number,
  speed: number,
  dt: number,
  altGoalNorm?: { x: number; y: number },
): void {
  const w = d.mapW;
  const h = d.mapH;
  if (w <= 0 || h <= 0 || !d.walkable.length) {
    const len = Math.hypot(goalNormX - ex.x, goalNormY - ex.y) || 1;
    slideEntity(
      d,
      ex,
      ((goalNormX - ex.x) / len) * speed * dt,
      ((goalNormY - ex.y) / len) * speed * dt,
      MOVE_SUBSTEPS,
    );
    return;
  }
  const [px, py] = normToCell(ex.x, ex.y, w, h);
  const si = py * w + px;

  const pathToGoal = (gnx: number, gny: number): number[] | null => {
    let [gx, gy] = normToCell(gnx, gny, w, h);
    let gi = gy * w + gx;
    if (!d.walkable[gi]) {
      const pos = { x: gnx, y: gny };
      snapNormPosToNearestWalkable(d, pos);
      [gx, gy] = normToCell(pos.x, pos.y, w, h);
      gi = gy * w + gx;
    }
    if (!d.walkable[si] || !d.walkable[gi]) return null;
    return aStarShortestPathCells(w, h, d.walkable, si, gi);
  };

  let path = pathToGoal(goalNormX, goalNormY);
  if (path === null && altGoalNorm) {
    path = pathToGoal(altGoalNorm.x, altGoalNorm.y);
  }

  let tx: number;
  let ty: number;
  if (path === null) {
    const gn = greedyNeighborTowardGoal(w, h, d.walkable, si, goalNormX, goalNormY);
    if (gn !== null) {
      tx = (gn % w + 0.5) / w;
      ty = (Math.floor(gn / w) + 0.5) / h;
    } else {
      tx = goalNormX;
      ty = goalNormY;
    }
  } else if (path.length === 0) {
    tx = goalNormX;
    ty = goalNormY;
  } else {
    const i = path[0]!;
    const cx = i % w;
    const cy = Math.floor(i / w);
    tx = (cx + 0.5) / w;
    ty = (cy + 0.5) / h;
  }
  steerOnGridToward(d, ex, tx, ty, speed, dt);
}

/**
 * 本波「总生命池」：再按 `packSizeForWave` 拆成多只怪（`hpSlice`），故单只血量 = 总池 / 只数。
 * 旧系数下前期角色成长快于单怪血量，易被误认为数值 bug；已整体抬高生命池倍率。
 */
const MONSTER_HP_POOL_MULT = 2.45;

export function monsterMaxHpForWave(wave: number): number {
  return Math.floor((62 + wave * 24 * Math.pow(1.064, wave)) * 1.42 * MONSTER_HP_POOL_MULT);
}

export function monsterDamageForWave(wave: number): number {
  return (6.2 + wave * 1.52 * Math.pow(1.02, Math.min(80, wave))) * 1.22;
}

/** 本波总唤灵髓（含小数，用于分摊与累计） */
export function essenceRewardTotalFloat(
  wave: number,
  state: GameState,
  isBoss: boolean,
  repeatMode = false,
): number {
  const base = 5 + wave * 2.1;
  let v = Math.max(0.05, base * essenceFindMult(state) * (1 + dungeonEssenceBonusFromSkills(state)));
  if (isBoss) v *= 1.45;
  v *= dungeonAffixEssenceMult(Date.now()) * daoMeridianDungeonEssenceMult(state);
  if (repeatMode) {
    v *= DUNGEON_REPEAT_ESSENCE_MULT;
    // 复刷若明显落后前沿波次，则再做温和衰减，避免长期低关稳定刷最优。
    const frontier = dungeonFrontierWave(state);
    const lag = Math.max(0, frontier - wave);
    if (lag >= 4) {
      const extraDecay = Math.max(0.5, 1 - (lag - 3) * 0.05);
      v *= extraDecay;
    }
  }
  if (state.dungeonRealm === "star_vortex") {
    v *= STAR_VORTEX_ESSENCE_MULT;
  }
  return v;
}

/** 整数展示/保底用（兼容旧逻辑） */
export function essenceRewardForWave(
  wave: number,
  state: GameState,
  isBoss: boolean,
  repeatMode = false,
): number {
  return Math.max(1, Math.floor(essenceRewardTotalFloat(wave, state, isBoss, repeatMode)));
}

export function packSizeForWave(wave: number): number {
  if (wave % 5 === 0) return 1;
  const base = Math.min(42, 10 + Math.floor(wave * 1.35) + Math.floor(wave / 8));
  if (!isTransitionWave(wave)) return base;
  return Math.max(8, Math.floor(base * 0.82));
}

/** 供 UI 展示：下一关关卡类型预告 */
export function describeWaveProfile(wave: number): string {
  if (wave % 5 === 0) return "首领关（单体高压）";
  if (isTransitionWave(wave)) return "过渡关（群怪缓冲）";
  return "普通关（群怪推进）";
}

function hpSlice(total: number, size: number, index: number): number {
  if (size <= 1) return total;
  const b = Math.floor(total / size);
  const r = total - b * size;
  return b + (index < r ? 1 : 0);
}

function aliveMobs(d: DungeonState): DungeonMob[] {
  return d.mobs.filter((m) => m.hp > 0);
}

/** 接战范围内的存活魔物数量（攻击圈与怪碰撞圆重叠，与命中判定一致） */
export function countMobsInEngageRange(d: DungeonState, playerRangeNorm: number): number {
  let n = 0;
  for (const m of d.mobs) {
    if (mobInPlayerAttackDisk(d, m, playerRangeNorm)) n += 1;
  }
  return n;
}

export function pickNearestMob(d: DungeonState): DungeonMob | null {
  const alive = aliveMobs(d);
  if (alive.length === 0) return null;
  let best = alive[0]!;
  let bestD = dist(d.playerX, d.playerY, best.x, best.y);
  for (let i = 1; i < alive.length; i++) {
    const m = alive[i]!;
    const dd = dist(d.playerX, d.playerY, m.x, m.y);
    if (dd < bestD) {
      bestD = dd;
      best = m;
    }
  }
  return best;
}

/**
 * 移动/普攻共用目标：已锁定且仍在接战带内时保持该目标，避免更近怪导致镜头与走位频繁切换。
 */
export function pickCombatTargetMob(d: DungeonState, pRange: number): DungeonMob | null {
  const alive = aliveMobs(d);
  if (alive.length === 0) return null;
  const lockId = d.playerAttackTargetMobId;
  if (lockId > 0) {
    const locked = alive.find((m) => m.id === lockId);
    if (locked && mobInStickyFocusRange(d, locked, pRange)) return locked;
  }
  return pickNearestMob(d);
}

/** 本波存活魔物剩余血量之和（用于预计清怪时间） */
export function totalAliveMobHpSum(d: DungeonState): number {
  let s = 0;
  for (const m of d.mobs) {
    if (m.hp > 0) s += m.hp;
  }
  return s;
}

function syncBars(state: GameState, d: DungeonState): void {
  const t = pickCombatTargetMob(d, playerEngageRadiusNorm(state));
  if (t) {
    d.monsterHp = t.hp;
    d.monsterMax = t.maxHp;
  }
}

function syncDungeonHpToState(state: GameState): void {
  const d = state.dungeon;
  if (!d.active) return;
  state.combatHpCurrent = d.playerHp;
  clampCombatHpToMax(state);
}

/** 进入第 w 波所需唤灵髓（约本波首通预期收益的 5%；复刷再乘 `DUNGEON_REPEAT_ENTRY_FEE_MULT`） */
export function dungeonEntryFeeEssence(state: GameState, wave: number, repeatMode = false): number {
  const w = Math.max(1, Math.floor(wave));
  const isBoss = w % 5 === 0;
  const raw = essenceRewardTotalFloat(w, state, isBoss, false) * 0.05;
  let fee = Math.max(1, Math.ceil(raw));
  if (repeatMode) fee = Math.max(1, Math.ceil(fee * DUNGEON_REPEAT_ENTRY_FEE_MULT));
  return fee;
}

/** 界面选波：按是否复刷计算入场费（与 `enterDungeon` 一致） */
export function dungeonEntryFeeForSelectedWave(state: GameState, wave: number): number {
  const w = Math.max(1, Math.floor(wave));
  return dungeonEntryFeeEssence(state, w, computeDungeonRepeatMode(state, w));
}

function refreshRewardModeRepeat(state: GameState): void {
  const d = state.dungeon;
  d.rewardModeRepeat = d.wave < dungeonFrontierWave(state);
}

/** 复刷通关时奖灵砂（助灵卡养成） */
function repeatLingShaBonus(wave: number): number {
  return 2 + Math.floor(wave / 2);
}

/**
 * 本波清关时统一结算：将本波累计的唤灵髓（含小数进位）写入背包与会话统计。
 * 击杀过程中只累加 essenceThisWave / essenceRemainder，不即时加 summonEssence。
 */
function grantWaveEssenceToInventory(state: GameState): void {
  const d = state.dungeon;
  let intGain = 0;
  while (d.essenceRemainder >= 1) {
    d.essenceRemainder -= 1;
    intGain += 1;
  }
  state.summonEssence += intGain;
  noteDungeonEssenceIntGained(state, intGain);
  d.sessionEssence += d.essenceThisWave;
}

/** 本波已全部阵亡时推进关卡（兜底：packKilled 与尸体数量不同步时 pickNearestMob 为空会卡死） */
function clearWaveAndAdvance(state: GameState, now: number): void {
  const d = state.dungeon;
  const clearedWave = d.wave;
  const waveEss = d.essenceThisWave;
  const wasRepeat = d.rewardModeRepeat;
  delete d.waveCheckpoint[clearedWave];
  d.maxWaveRecord = Math.max(d.maxWaveRecord, clearedWave);
  d.entryWave = Math.min(d.maxWaveRecord + 1, clearedWave + 1);
  d.totalWavesCleared += 1;
  noteWeeklyBountyWave(state);
  d.wave = clearedWave + 1;
  d.playerMax = playerMaxHp(state);
  d.playerHp = Math.min(d.playerHp, d.playerMax);
  d.vortexKillStreak = 0;
  d.vortexStreakExpireAt = 0;
  d.mobs = [];
  d.packKilled = 0;
  d.packSize = 0;
  d.monsterHp = 0;
  d.monsterMax = 0;
  d.interWaveCooldownUntil = now + DUNGEON_INTER_WAVE_CD_MS;
  let extra = "";
  if (wasRepeat) {
    const ls = repeatLingShaBonus(clearedWave);
    state.lingSha += ls;
    extra = ` · 灵砂 +${ls}（复刷助养成）`;
  }
  d.pendingToast = `第 ${clearedWave} 关完成！本关唤灵髓 +${waveEss.toFixed(2)}（已入背包）${extra}`;
  refreshRewardModeRepeat(state);
}

/** 单只魔物阵亡结算；若本波清空则推进关卡并返回 true（调用方应结束本 tick） */
function registerDungeonKill(state: GameState, d: DungeonState, mob: DungeonMob, now: number): boolean {
  resetDamageFloatAccum();
  if (state.dungeonRealm === "star_vortex") {
    if (now <= d.vortexStreakExpireAt && d.vortexKillStreak > 0) {
      d.vortexKillStreak = Math.min(VORTEX_STREAK_MAX, d.vortexKillStreak + 1);
    } else {
      d.vortexKillStreak = 1;
    }
    d.vortexStreakExpireAt = now + VORTEX_STREAK_WINDOW_MS;
  }
  const totalFloat = essenceRewardTotalFloat(d.wave, state, mob.isBoss, d.rewardModeRepeat);
  const share = totalFloat / Math.max(1, d.packSize);
  d.essenceRemainder += share;
  d.essenceThisWave += share;
  d.packKilled += 1;
  d.sessionKills += 1;
  const isLastInPack = d.packKilled >= d.packSize;
  mob.hp = 0;
  if (isLastInPack) {
    grantWaveEssenceToInventory(state);
    clearWaveAndAdvance(state, now);
    return true;
  }
  return false;
}

function cellDistApprox(ax: number, ay: number, bx: number, by: number, w: number, h: number): number {
  return Math.hypot((ax - bx) * w, (ay - by) * h);
}

function cellManhattanDist(ax: number, ay: number, bx: number, by: number): number {
  return Math.abs(ax - bx) + Math.abs(ay - by);
}

function randomEl(state: GameState): Element {
  return EL_LIST[Math.floor(nextRand01(state) * EL_LIST.length)]!;
}

function spawnMobsForWave(state: GameState): void {
  const d = state.dungeon;
  const ck = d.waveCheckpoint[d.wave];
  if (ck && ck.mobs.some((m) => m.hp > 0) && ck.walkable.length > 0 && ck.mapW > 0) {
    restoreWaveFromCheckpoint(state, ck);
    if (state.dungeonRealm === "star_vortex") {
      initStarVortexLeyline(state, d, Date.now());
    }
    return;
  }

  d.playerAttackAccum = 0;
  d.playerAttackTargetMobId = 0;
  d.essenceThisWave = 0;
  const { walkable, px, py, w: mapW, h: mapH } = generateWalkableMap(state, d.wave);
  d.walkable = walkable;
  d.mapW = mapW;
  d.mapH = mapH;
  d.playerX = (px + 0.5) / d.mapW;
  d.playerY = (py + 0.5) / d.mapH;
  d.packSize = packSizeForWave(d.wave);
  d.packKilled = 0;
  d.mobs = [];

  const startI = py * d.mapW + px;
  const startX = startI % d.mapW;
  const startY = Math.floor(startI / d.mapW);
  const reach = reachableCellsForFourWaySpawn(
    d.mapW,
    d.mapH,
    d.walkable,
    bfsReachable(d.mapW, d.mapH, d.walkable, px, py),
  );
  const hpAffix = dungeonAffixMobHpMult(Date.now());
  const totalHp0 = Math.max(1, Math.floor(monsterMaxHpForWave(d.wave) * hpAffix));
  const bossWave = d.wave % 5 === 0;

  if (bossWave) {
    d.packSize = 1;
    const forbid = new Set<number>([startI]);
    let bossReach = reach;
    const safeBossReach = new Set<number>();
    for (const i of reach) {
      const cx = i % d.mapW;
      const cy = Math.floor(i / d.mapW);
      if (cellManhattanDist(cx, cy, startX, startY) >= SPAWN_MIN_CELL_DIST + 1) safeBossReach.add(i);
    }
    if (safeBossReach.size > 0) bossReach = safeBossReach;
    let spot = pickRandomWalkableCell(state, d.walkable, d.mapW, d.mapH, bossReach, forbid);
    if (!spot) {
      for (const i of bossReach) {
        if (i === startI) continue;
        spot = { x: i % d.mapW, y: Math.floor(i / d.mapW) };
        break;
      }
    }
    if (!spot) return;
    const mx = (spot.x + 0.5) / d.mapW;
    const my = (spot.y + 0.5) / d.mapH;
    const hp = Math.max(1, Math.floor(totalHp0 * 4.2));
    const bel = randomEl(state);
    const combat = rollMobCombatStats(state, d.wave, true, "melee");
    d.mobs.push({
      id: d.nextMobId++,
      x: mx,
      y: my,
      hp,
      maxHp: hp,
      element: bel,
      isBoss: true,
      mobKind: Math.floor(nextRand01(state) * 8),
      bossEpithet: randomBossEpithet(() => nextRand01(state)),
      ...combat,
    });
    d.waveEntrySpawnX = d.playerX;
    d.waveEntrySpawnY = d.playerY;
    if (state.dungeonRealm === "star_vortex") {
      initStarVortexLeyline(state, d, Date.now());
    }
    syncBars(state, d);
    return;
  }

  const forbid = new Set<number>([startI]);
  const safeReach = new Set<number>();
  for (const i of reach) {
    const cx = i % d.mapW;
    const cy = Math.floor(i / d.mapW);
    if (cellManhattanDist(cx, cy, startX, startY) >= SPAWN_MIN_CELL_DIST) safeReach.add(i);
  }
  const spawnReach = safeReach.size > 0 ? safeReach : reach;
  let anchorCell: { x: number; y: number } | null = null;
  for (let i = 0; i < d.packSize; i++) {
    let pickPool = spawnReach;
    // 非首领波采用“主簇 + 分散”混合刷怪，减少清波末段满图追怪。
    if (anchorCell) {
      const clustered = new Set<number>();
      for (const ci of spawnReach) {
        const cx = ci % d.mapW;
        const cy = Math.floor(ci / d.mapW);
        const dist = Math.abs(cx - anchorCell.x) + Math.abs(cy - anchorCell.y);
        if (dist <= 4) clustered.add(ci);
      }
      if (clustered.size > 0) {
        const useCluster = nextRand01(state) < 0.72;
        pickPool = useCluster ? clustered : spawnReach;
      }
    }
    const spot = pickRandomWalkableCell(state, d.walkable, d.mapW, d.mapH, pickPool, forbid);
    if (!spot) break;
    if (!anchorCell) anchorCell = { ...spot };
    forbid.add(spot.y * d.mapW + spot.x);
    const role: "melee" | "ranged" = nextRand01(state) < 0.5 ? "melee" : "ranged";
    const hpBase = hpSlice(totalHp0, d.packSize, i);
    const hpMult = role === "melee" ? MOB_MELEE_HP_MULT : MOB_RANGED_HP_MULT;
    const maxHp = Math.max(1, Math.floor(hpBase * hpMult));
    const combat = rollMobCombatStats(state, d.wave, false, role);
    d.mobs.push({
      id: d.nextMobId++,
      x: (spot.x + 0.5) / d.mapW,
      y: (spot.y + 0.5) / d.mapH,
      hp: maxHp,
      maxHp,
      element: randomEl(state),
      isBoss: false,
      mobKind: Math.floor(nextRand01(state) * 8),
      mobRole: role,
      wanderHeading: nextRand01(state) * Math.PI * 2,
      ...combat,
    });
  }
  d.packSize = d.mobs.length;
  d.waveEntrySpawnX = d.playerX;
  d.waveEntrySpawnY = d.playerY;
  if (state.dungeonRealm === "star_vortex") {
    initStarVortexLeyline(state, d, Date.now());
  }
  syncBars(state, d);
}

export function canEnterDungeon(state: GameState, now: number): boolean {
  return !state.dungeon.active && now >= state.dungeon.deathCooldownUntil;
}

/** 当前应推进的下一波：maxWaveRecord + 1 */
export function dungeonFrontierWave(state: GameState): number {
  return Math.max(1, state.dungeon.maxWaveRecord + 1);
}

/** 入场/计费：是否按复刷关（唤灵髓削减、关末奖灵砂） */
export function computeDungeonRepeatMode(state: GameState, w: number): boolean {
  const d = state.dungeon;
  const ck = d.waveCheckpoint[w];
  if (ck && ck.mobs.some((m) => m.hp > 0)) return ck.rewardModeRepeat ?? false;
  return w < dungeonFrontierWave(state);
}

/**
 * 可否从第 w 波进入：前沿波、未完结存档波、或已通关波的复刷。
 */
export function canEnterAtWave(state: GameState, w: number): boolean {
  const d = state.dungeon;
  if (!Number.isFinite(w) || w < 1) return false;
  const frontier = dungeonFrontierWave(state);
  if (w > frontier) return false;
  if (w === frontier) return true;
  const ck = d.waveCheckpoint[w];
  if (ck && ck.mobs.some((m) => m.hp > 0)) return true;
  return w <= d.maxWaveRecord;
}

export function enterDungeon(state: GameState, startWave?: number): boolean {
  const now = Date.now();
  if (!canEnterDungeon(state, now)) return false;
  const d = state.dungeon;
  const sw = startWave ?? d.entryWave;
  const w = Math.max(1, Math.floor(sw));
  if (!canEnterAtWave(state, w)) return false;
  d.rewardModeRepeat = computeDungeonRepeatMode(state, w);
  const fee = dungeonEntryFeeEssence(state, w, d.rewardModeRepeat);
  if (state.summonEssence < fee) return false;
  state.summonEssence -= fee;
  d.autoEnterConsumed = true;
  state.dungeonSanctuaryMode = false;
  state.dungeonPortalTargetWave = 0;
  d.active = true;
  d.wave = w;
  /** 每次进本重置该波进度：重新随机地图与满血魔物（不再接续暂离存档） */
  delete d.waveCheckpoint[w];
  d.sessionKills = 0;
  d.sessionEssence = 0;
  d.sessionEnterAtMs = now;
  d.essenceRemainder = 0;
  d.monsterAttackAccum = 0;
  d.playerAttackAccum = 0;
  d.playerAttackTargetMobId = 0;
  d.attackAnimPhase = 0;
  d.attackVisualMode = "none";
  d.interWaveCooldownUntil = 0;
  d.pendingToast = null;
  d.pendingDeathPresentation = false;
  clampCombatHpToMax(state);
  d.playerMax = playerMaxHp(state);
  d.playerHp = Math.min(state.combatHpCurrent, d.playerMax);
  d.bossDodgeVisual = false;
  d.stamina = DUNGEON_STAMINA_MAX;
  d.dodgeIframesUntil = 0;
  d.dodgeQueued = false;
  d.playerMoveLockUntil = 0;
  d.playerLastMoveNx = 0;
  d.playerLastMoveNy = 0;
  d.vortexKillStreak = 0;
  d.vortexStreakExpireAt = 0;
  d.vortexLeylineMoveAt = 0;
  damageFloatQueue.length = 0;
  resetDamageFloatAccum();
  spawnMobsForWave(state);
  d.dodgeIframesUntil = now + WAVE_START_GRACE_MS;
  return true;
}

/**
 * 圣所回满后自动传送回中断关卡（不依赖玩家点开幻域或按钮）。
 * 需在 `tickCombatHpRegen` 之后调用，以便 `combatHpCurrent` 已更新。
 */
export function tryAutoEnterFromSanctuaryPortal(state: GameState, now: number): boolean {
  if (!state.dungeonSanctuaryAutoEnter || !state.dungeonSanctuaryMode || state.dungeon.active) return false;
  const w = state.dungeonPortalTargetWave;
  if (w < 1) return false;
  const pmax = playerMaxHp(state);
  if (state.combatHpCurrent < pmax - 0.25) return false;
  if (!canEnterDungeon(state, now) || !canEnterAtWave(state, w)) return false;
  const rm = computeDungeonRepeatMode(state, w);
  const fee = dungeonEntryFeeEssence(state, w, rm);
  if (state.summonEssence < fee) return false;
  return enterDungeon(state, w);
}

export function leaveDungeon(state: GameState): void {
  const d = state.dungeon;
  if (d.active) {
    state.combatHpCurrent = d.playerHp;
    clampCombatHpToMax(state);
  }
  let savedCk = false;
  if (d.active && d.mobs.some((m) => m.hp > 0) && d.mapW > 0) {
    saveWaveCheckpoint(state);
    savedCk = true;
  }
  d.active = false;
  d.mobs = [];
  d.walkable = [];
  d.interWaveCooldownUntil = 0;
  d.pendingToast = savedCk ? "已暂离。再入该波将重新随机地图与魔物。" : null;
  d.pendingDeathPresentation = false;
  d.bossDodgeVisual = false;
  d.dodgeQueued = false;
  damageFloatQueue.length = 0;
  resetDamageFloatAccum();
}

export function tickDungeon(state: GameState, dt: number, now: number): void {
  const d = state.dungeon;
  if (!d.active || dt <= 0) return;
  d.inMelee = false;
  d.attackVisualMode = "none";
  d.bossDodgeVisual = false;
  d.playerMax = playerMaxHp(state);
  d.playerHp = Math.max(0, Math.min(d.playerMax, state.combatHpCurrent));
  d.stamina = Math.min(DUNGEON_STAMINA_MAX, d.stamina + DUNGEON_STAMINA_REGEN_PER_SEC * dt);
  tickStarVortexRealm(state, d, dt, now);
  snapPlayerToNearestWalkable(d);

  if (d.interWaveCooldownUntil > 0 && now >= d.interWaveCooldownUntil && d.mobs.length === 0) {
    d.interWaveCooldownUntil = 0;
    spawnMobsForWave(state);
    d.dodgeIframesUntil = Math.max(d.dodgeIframesUntil, now + WAVE_START_GRACE_MS);
  }

  const pEl = playerBattleElement(state);
  const skillAtk = dungeonAtkBonusFromSkills(state);
  const baseAtk =
    playerAttack(state) *
    (1 + skillAtk + petDungeonAtkAdditive(state)) *
    dungeonAffixPlayerAtkMult(now) *
    daoMeridianDungeonAtkMult(state);
  const cc = playerCritChance(state);
  const cm = playerCritMult(state);
  const pDodge = playerDungeonDodgeChance(state);
  const pRange = playerEngageRadiusNorm(state);
  const target = pickCombatTargetMob(d, pRange);
  if (!target) {
    if (d.mobs.length > 0 && d.mobs.every((m) => m.hp <= 0)) {
      grantWaveEssenceToInventory(state);
      clearWaveAndAdvance(state, now);
      syncBars(state, d);
      syncDungeonHpToState(state);
      return;
    }
    resetDamageFloatAccum();
    syncBars(state, d);
    syncDungeonHpToState(state);
    return;
  }

  const moveLocked = now < d.playerMoveLockUntil;
  const distPre = dist(d.playerX, d.playerY, target.x, target.y);
  const mobArPre = Math.max(
    Math.max(DUNGEON_ENGAGE_NORM * 1.08, target.attackRange ?? DUNGEON_ENGAGE_NORM),
    pRange * MOB_ATTACK_RANGE_VS_PLAYER,
  );
  const reachToTarget = pRange + mobBodyRadius(target);
  const inCombat =
    distPre <= reachToTarget || distPre <= mobArPre + PLAYER_BODY_RADIUS_NORM;

  if (d.dodgeQueued) {
    if (
      !moveLocked &&
      d.stamina >= DUNGEON_DODGE_STAMINA_COST &&
      now >= d.dodgeIframesUntil
    ) {
      d.stamina -= DUNGEON_DODGE_STAMINA_COST;
      d.dodgeIframesUntil = now + DUNGEON_DODGE_IFRAMES_MS;
      if (inCombat) {
        applyDodgeSlide(state, d, target);
      } else {
        applyDodgeAlongMoveDirection(state, d, target);
      }
    }
    d.dodgeQueued = false;
  }

  const prePathX = d.playerX;
  const prePathY = d.playerY;

  const { steps: moveSteps, subDt } = movementIntegrationSteps(dt);
  for (let step = 0; step < moveSteps; step++) {
    for (const m of d.mobs) {
      if (m.hp <= 0) continue;
      const msm = m.moveSpeedMul > 0 ? m.moveSpeedMul : 1;
      if (m.isBoss) {
        const cd = cellDistApprox(m.x, m.y, d.playerX, d.playerY, d.mapW, d.mapH);
        if (cd <= CHASE_CELL_DIST) {
          const br = dist(m.x, m.y, d.playerX, d.playerY);
          const reach = pRange + mobBodyRadius(m);
          /** 与玩家接战移速同一套：进圈后双方都乘 DUNGEON_MELEE_MOVE_MULT */
          const meleeSlow = br <= reach ? DUNGEON_MELEE_MOVE_MULT : 1;
          const pulse = 1 + BOSS_CHASE_PULSE_AMP * Math.sin(now * 0.0028 + m.id * 0.17 + step * 0.04);
          const bossSpd = playerMoveSpeed(state) * BOSS_CHASE_VS_PLAYER * msm * pulse * meleeSlow;
          moveEntityGridSeek(d, m, d.playerX, d.playerY, bossSpd, subDt);
        }
        continue;
      }
      const cd = cellDistApprox(m.x, m.y, d.playerX, d.playerY, d.mapW, d.mapH);
      // 非首领怪也按四联通寻路：近处追击，远处游走。
      if (m.id === target.id || cd <= CHASE_CELL_DIST) {
        moveMobFourWayChase(d, m, pRange, subDt);
      } else {
        moveMobFourWayWander(state, d, m, subDt);
      }
    }
    const pPos = { x: d.playerX, y: d.playerY };
    if (!moveLocked) {
      /** 几何进圈且格线无墙挡时站桩；隔墙仍判进圈时不站桩，便于上下绕路 */
      if (!shouldHoldKiteNoDetour(d, pRange)) {
        if (target.isBoss) {
          movePlayerInBossFight(state, d, pPos, target, subDt, now + step * subDt * 1000);
        } else {
          movePlayerKiteMaxRange(state, d, pPos, target, subDt);
        }
      }
    }
    d.playerX = pPos.x;
    d.playerY = pPos.y;
  }
  resolveDungeonBodyOverlaps(d);

  if (!moveLocked) {
    const mdx = d.playerX - prePathX;
    const mdy = d.playerY - prePathY;
    const mlen = Math.hypot(mdx, mdy);
    if (mlen > 1e-9) {
      d.playerLastMoveNx = mdx / mlen;
      d.playerLastMoveNy = mdy / mlen;
    }
  }

  const hitTarget = pickCombatTargetMob(d, pRange);
  if (!hitTarget) {
    if (d.mobs.length > 0 && d.mobs.every((m) => m.hp <= 0)) {
      grantWaveEssenceToInventory(state);
      clearWaveAndAdvance(state, now);
      syncBars(state, d);
      syncDungeonHpToState(state);
      return;
    }
    d.playerAttackAccum = 0;
    d.playerAttackTargetMobId = 0;
    resetDamageFloatAccum();
    syncBars(state, d);
    syncDungeonHpToState(state);
    return;
  }

  d.playerAttackTargetMobId = hitTarget.id;
  const distT = dist(d.playerX, d.playerY, hitTarget.x, hitTarget.y);
  const mobArFromStat = Math.max(DUNGEON_ENGAGE_NORM * 1.08, hitTarget.attackRange ?? DUNGEON_ENGAGE_NORM);
  const mobAR = Math.max(mobArFromStat, pRange * MOB_ATTACK_RANGE_VS_PLAYER);
  const playerCanHit = d.mobs.some((m) => mobInPlayerAttackDisk(d, m, pRange) && hasClearCombatLine(d, m.x, m.y));
  const mobCanHit = distT <= mobAR + PLAYER_BODY_RADIUS_NORM && hasClearCombatLine(d, hitTarget.x, hitTarget.y);
  const hitInterval = Math.max(0.35, hitTarget.attackInterval ?? DUNGEON_MONSTER_HIT_INTERVAL);
  const atkSpd = playerDungeonAttackSpeedMult(state);
  const playerHitInterval = Math.max(0.2, PLAYER_DUNGEON_HIT_INTERVAL_SEC / atkSpd);
  const attackersInRange = d.mobs.reduce((n, m) => {
    if (m.hp <= 0) return n;
    const mArFromStat = Math.max(DUNGEON_ENGAGE_NORM * 1.08, m.attackRange ?? DUNGEON_ENGAGE_NORM);
    const mAr = Math.max(mArFromStat, pRange * MOB_ATTACK_RANGE_VS_PLAYER);
    const canHit =
      dist(d.playerX, d.playerY, m.x, m.y) <= mAr + PLAYER_BODY_RADIUS_NORM &&
      hasClearCombatLine(d, m.x, m.y);
    return canHit ? n + 1 : n;
  }, 0);

  if (!playerCanHit) {
    resetDamageFloatAccum();
    d.playerAttackAccum = 0;
  }

  d.inMelee = playerCanHit || mobCanHit;
  if (playerCanHit) {
    d.playerAttackAccum += dt;
    d.attackVisualMode = "aoe";
    /** 圆形 AoE：攻击圈内魔物同一瞬各自判定偏斜/暴击 */
    while (d.playerAttackAccum >= playerHitInterval) {
      d.playerAttackAccum -= playerHitInterval;
      const inSweep = d.mobs.filter((m) => mobInPlayerAttackDisk(d, m, pRange) && hasClearCombatLine(d, m.x, m.y));
      d.attackAnimPhase += Math.PI * 2;
      /** 命中后再定身，避免“空挥也锁脚”造成手感发黏 */
      let landedHit = false;
      if (inSweep.length === 0) {
        continue;
      }
      for (const mob of inSweep) {
        if (mob.hp <= 0) continue;
        const jx = (nextRand01(state) - 0.5) * 0.038;
        const jy = (nextRand01(state) - 0.5) * 0.022;
        const fx = clamp(mob.x + jx, 0.05, 0.95);
        const fy = clamp(mob.y + jy - 0.045, 0.05, 0.92);
        const mdMul = elementDamageMultiplier(pEl, mob.element);
        const mobDodge = clamp(mob.dodge ?? 0.08, 0, 0.9);
        if (nextRand01(state) < mobDodge) {
          pushDamageFloat(fx, fy, "偏斜", "dmg-miss");
        } else {
          const critRoll = nextRand01(state) < cc ? cm : 1;
          const vortexMul = dungeonVortexDamageMult(state, d, now);
          const hitDmg = baseAtk * mdMul * critRoll * vortexMul;
          landedHit = true;
          mob.hp -= hitDmg;
          const v = Math.max(1, Math.round(hitDmg));
          pushDamageFloat(fx, fy, String(v), "dmg-out");
          if (mob.hp <= 0) {
            if (registerDungeonKill(state, d, mob, now)) {
              syncBars(state, d);
              syncDungeonHpToState(state);
              return;
            }
          }
        }
      }
      if (landedHit) {
        const rootMs = Math.max(120, Math.min(DUNGEON_PLAYER_ATTACK_ROOT_MS, Math.floor(playerHitInterval * 1000 * 0.45)));
        d.playerMoveLockUntil = Math.max(d.playerMoveLockUntil, now + rootMs);
      }
    }
  }

  if (mobCanHit && hitTarget.hp > 0) {
    const hitPhase = (d.monsterAttackAccum % hitInterval) / hitInterval;
    d.bossDodgeVisual = hitTarget.isBoss && hitPhase > 0.72;
    d.monsterAttackAccum += dt;
    const mdBase = monsterDamageForWave(d.wave) * (hitTarget.isBoss ? 1.35 : 1);
    const mdMul = elementDamageMultiplier(hitTarget.element, pEl);
    let md = mdBase * mdMul;
    if (attackersInRange > 1) {
      // 群怪压迫：随可攻击怪数量缓增并设上限，避免瞬间爆炸伤害。
      const pressure = Math.min(2.2, 1 + 0.22 * (attackersInRange - 1));
      md *= pressure;
    }
    if (hitTarget.isBoss && d.bossDodgeVisual) {
      md *= 0.52;
    }
    md *= playerIncomingDamageMult(state, d.wave);
    md *= dungeonAffixMobDamageMult(now);
    while (d.monsterAttackAccum >= hitInterval) {
      d.monsterAttackAccum -= hitInterval;
      const pj = (nextRand01(state) - 0.5) * 0.04;
      const px = clamp(d.playerX + pj, 0.05, 0.95);
      const py = clamp(d.playerY - 0.06, 0.05, 0.92);
      if (now < d.dodgeIframesUntil) {
        pushDamageFloat(px, py, "化劲", "dmg-miss");
        continue;
      }
      /** 原期望：伤害×(1−玩家闪避)；改为单次判定，期望不变 */
      if (nextRand01(state) < pDodge) {
        pushDamageFloat(px, py, "闪避", "dmg-miss");
      } else {
        d.playerHp -= md;
        const hitRootMs = hitTarget.isBoss ? DUNGEON_BOSS_HITSTUN_ROOT_MS : DUNGEON_HITSTUN_ROOT_MS;
        d.playerMoveLockUntil = Math.max(d.playerMoveLockUntil, now + hitRootMs);
        pushDamageFloat(px, py, `-${Math.max(1, Math.round(md))}`, "dmg-in");
      }
      if (d.playerHp <= 0) {
        saveWaveCheckpoint(state);
        d.entryWave = d.wave;
        state.dungeonSanctuaryMode = true;
        state.dungeonPortalTargetWave = d.wave;
        const s = stones(state);
        let pen = Decimal.max(1, s.mul(0.05).ceil());
        if (pen.gt(s)) pen = s;
        if (s.gt(0)) subStones(state, pen);
        state.combatHpCurrent = 0;
        d.playerHp = 0;
        d.active = false;
        d.mobs = [];
        d.walkable = [];
        d.interWaveCooldownUntil = 0;
        d.pendingToast =
          s.lte(0) || pen.lte(0)
            ? "灵力溃散，已回气。再入本关将重新随机地图与魔物。"
            : `灵力溃散，已回气。损失灵石 ${pen.toFixed(0)}（约当前灵石 5%，至少 1）。再入本关将重新随机地图与魔物。`;
        d.pendingDeathPresentation = false;
        d.deathCooldownUntil = now + DUNGEON_DEATH_CD_MS;
        damageFloatQueue.length = 0;
        resetDamageFloatAccum();
        return;
      }
    }
  } else {
    d.monsterAttackAccum = 0;
    d.bossDodgeVisual = false;
  }

  syncBars(state, d);
  syncDungeonHpToState(state);
}
