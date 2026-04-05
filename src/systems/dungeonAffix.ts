import type { GameState } from "../types";
import { currentWeekKey } from "./weeklyBounty";
import { playerExpectedDps } from "./playerCombat";

/** 与周常悬赏同一周界；词缀由周次确定性轮换 */
export type DungeonAffixId = "jade_well" | "iron_march" | "keen_edge" | "storm_sigil";

const AFFIX_ORDER: DungeonAffixId[] = ["jade_well", "iron_march", "keen_edge", "storm_sigil"];

export interface DungeonAffixInfo {
  id: DungeonAffixId;
  title: string;
  desc: string;
  /** 唤灵髓收益乘数 */
  essenceMult: number;
  /** 魔物生命乘数 */
  mobHpMult: number;
  /** 幻域内玩家有效攻击乘数（仅副本内） */
  playerAtkMult: number;
  /** 魔物对玩家伤害乘数 */
  mobDamageMult: number;
}

const AFFIX_DEF: Record<DungeonAffixId, Omit<DungeonAffixInfo, "id">> = {
  jade_well: {
    title: "玉髓潮",
    desc: "本周幻域唤灵髓收益提高。",
    essenceMult: 1.18,
    mobHpMult: 1,
    playerAtkMult: 1,
    mobDamageMult: 1,
  },
  iron_march: {
    title: "铁壁行",
    desc: "本周魔物生命提高。",
    essenceMult: 1,
    mobHpMult: 1.14,
    playerAtkMult: 1,
    mobDamageMult: 1,
  },
  keen_edge: {
    title: "锐锋印",
    desc: "本周幻域内你的攻击提高。",
    essenceMult: 1,
    mobHpMult: 1,
    playerAtkMult: 1.12,
    mobDamageMult: 1,
  },
  storm_sigil: {
    title: "雷殛纹",
    desc: "本周魔物攻势更猛。",
    essenceMult: 1,
    mobHpMult: 1,
    playerAtkMult: 1,
    mobDamageMult: 1.1,
  },
};

function hashWeekKey(weekKey: string): number {
  let h = 2166136261;
  for (let i = 0; i < weekKey.length; i++) {
    h ^= weekKey.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export function getDungeonAffixForNow(now: number): DungeonAffixInfo {
  const wk = currentWeekKey(now);
  const idx = hashWeekKey(wk) % AFFIX_ORDER.length;
  const id = AFFIX_ORDER[idx]!;
  const base = AFFIX_DEF[id];
  return { id, ...base };
}

export function dungeonAffixEssenceMult(now: number): number {
  return getDungeonAffixForNow(now).essenceMult;
}

export function dungeonAffixMobHpMult(now: number): number {
  return getDungeonAffixForNow(now).mobHpMult;
}

export function dungeonAffixPlayerAtkMult(now: number): number {
  return getDungeonAffixForNow(now).playerAtkMult;
}

export function dungeonAffixMobDamageMult(now: number): number {
  return getDungeonAffixForNow(now).mobDamageMult;
}

/** 幻域脚标期望秒伤：含本周「锐锋印」等攻击向词缀 */
export function playerExpectedDpsDungeonAffix(state: GameState, now: number): number {
  return playerExpectedDps(state) * dungeonAffixPlayerAtkMult(now);
}
