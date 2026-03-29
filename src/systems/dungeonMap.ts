import type { GameState } from "../types";
import { nextRand01 } from "../rng";

export const DUNGEON_MAP_W = 28;
export const DUNGEON_MAP_H = 16;

/**
 * 幻域地图尺寸：前期较小，每通关 5 波（进入下一档，如 6、11、16…）扩大一档，直至满尺寸。
 * tier0：第 1–5 波；tier1：6–10；…；tier4：21 波起为满图。
 */
export function dungeonMapDimensionsForWave(wave: number): { w: number; h: number } {
  const wv = Math.max(1, Math.floor(wave));
  const tier = Math.min(4, Math.floor((wv - 1) / 5));
  const sizes: { w: number; h: number }[] = [
    { w: 16, h: 9 },
    { w: 19, h: 11 },
    { w: 22, h: 13 },
    { w: 25, h: 14 },
    { w: DUNGEON_MAP_W, h: DUNGEON_MAP_H },
  ];
  return sizes[tier]!;
}

/** row-major：true 表示可行走 */
export function makeEmptyWalkable(w: number, h: number): boolean[] {
  return new Array(w * h).fill(true);
}

function idx(x: number, y: number, w: number): number {
  return y * w + x;
}

/** 与寻路一致：仅上下左右四向 */
const CARDINAL_DIRS: readonly [number, number][] = [
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
];

/**
 * 可走格在**四连通**意义下是否至少有一侧与另一可走格相邻。
 * 用于排除「四周皆墙」的孤立格上的刷怪/吸附（与 BFS 四向一致）。
 */
export function cellHasCardinalWalkableNeighbor(
  w: number,
  h: number,
  walkable: boolean[],
  i: number,
): boolean {
  const cx = i % w;
  const cy = Math.floor(i / w);
  for (const [dx, dy] of CARDINAL_DIRS) {
    const nx = cx + dx;
    const ny = cy + dy;
    if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
    if (walkable[ny * w + nx]) return true;
  }
  return false;
}

/**
 * 从玩家起点 BFS 得到的可达集中，只保留四向上至少有一格可走邻格的格子（与移动/寻路四向一致）。
 */
export function reachableCellsForFourWaySpawn(
  w: number,
  h: number,
  walkable: boolean[],
  reachFromStart: Set<number>,
): Set<number> {
  const out = new Set<number>();
  for (const i of reachFromStart) {
    if (cellHasCardinalWalkableNeighbor(w, h, walkable, i)) out.add(i);
  }
  return out.size > 0 ? out : reachFromStart;
}

function bfsReachable(w: number, h: number, walkable: boolean[], sx: number, sy: number): Set<number> {
  const start = idx(sx, sy, w);
  if (!walkable[start]) return new Set();
  const seen = new Set<number>([start]);
  const q: number[] = [start];
  while (q.length) {
    const cur = q.shift()!;
    const cx = cur % w;
    const cy = Math.floor(cur / w);
    for (const [dx, dy] of CARDINAL_DIRS) {
      const nx = cx + dx;
      const ny = cy + dy;
      if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
      const ni = idx(nx, ny, w);
      if (!walkable[ni] || seen.has(ni)) continue;
      seen.add(ni);
      q.push(ni);
    }
  }
  return seen;
}

/**
 * 随机障碍 + 可达性校验；返回可走格与玩家起点（保证在较大连通块内）
 * @param wave 当前波次，决定地图档位（每 5 波扩大）
 */
export function generateWalkableMap(
  state: GameState,
  wave: number,
): { walkable: boolean[]; px: number; py: number; w: number; h: number } {
  const { w, h } = dungeonMapDimensionsForWave(wave);
  for (let attempt = 0; attempt < 48; attempt++) {
    const walkable = makeEmptyWalkable(w, h);
    /** 边框为墙 */
    for (let x = 0; x < w; x++) {
      walkable[idx(x, 0, w)] = false;
      walkable[idx(x, h - 1, w)] = false;
    }
    for (let y = 0; y < h; y++) {
      walkable[idx(0, y, w)] = false;
      walkable[idx(w - 1, y, w)] = false;
    }
    const density = 0.2 + nextRand01(state) * 0.12;
    for (let y = 1; y < h - 1; y++) {
      for (let x = 1; x < w - 1; x++) {
        if (nextRand01(state) < density) walkable[idx(x, y, w)] = false;
      }
    }
    /** 清出中央出生点邻域 */
    const cx = Math.floor(w / 2);
    const cy = Math.floor(h / 2);
    for (let dy = -2; dy <= 2; dy++) {
      for (let dx = -2; dx <= 2; dx++) {
        const x = cx + dx;
        const y = cy + dy;
        if (x > 0 && x < w - 1 && y > 0 && y < h - 1) walkable[idx(x, y, w)] = true;
      }
    }
    const reach = bfsReachable(w, h, walkable, cx, cy);
    if (reach.size < w * h * 0.28) continue;
    return { walkable, px: cx, py: cy, w, h };
  }
  /** 兜底：空图（无障碍，仍用本档 w×h） */
  const walkable = makeEmptyWalkable(w, h);
  for (let x = 0; x < w; x++) {
    walkable[idx(x, 0, w)] = false;
    walkable[idx(x, h - 1, w)] = false;
  }
  for (let y = 0; y < h; y++) {
    walkable[idx(0, y, w)] = false;
    walkable[idx(w - 1, y, w)] = false;
  }
  const px = Math.floor(w / 2);
  const py = Math.floor(h / 2);
  return { walkable, px, py, w, h };
}

/** 从可达集中随机挑一格（不含禁止）；仅考虑四向上至少有一可走邻格的格子 */
export function pickRandomWalkableCell(
  state: GameState,
  walkable: boolean[],
  w: number,
  h: number,
  reachable: Set<number>,
  forbid: Set<number>,
): { x: number; y: number } | null {
  const pool: number[] = [];
  for (const i of reachable) {
    if (forbid.has(i)) continue;
    if (!cellHasCardinalWalkableNeighbor(w, h, walkable, i)) continue;
    pool.push(i);
  }
  if (pool.length === 0) return null;
  const pick = pool[Math.floor(nextRand01(state) * pool.length)]!;
  return { x: pick % w, y: Math.floor(pick / w) };
}

export { bfsReachable };
