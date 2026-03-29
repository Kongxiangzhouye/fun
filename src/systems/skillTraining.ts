import type { GameState, SkillId } from "../types";

export function xpToNextLevel(level: number): number {
  return Math.max(30, Math.floor(48 * Math.pow(1.13, level)));
}

/** 当前等级每秒获得的经验（与 tickSkillTraining 一致） */
export function skillXpPerSecond(level: number): number {
  return 7 + level * 0.4;
}

/** 距下一级尚需秒数；已满级或无法计算时返回 null */
export function secondsToNextLevel(sk: { level: number; xp: number }): number | null {
  const need = xpToNextLevel(sk.level);
  const rem = need - sk.xp;
  if (rem <= 0) return 0;
  const rate = skillXpPerSecond(sk.level);
  if (rate <= 0) return null;
  return rem / rate;
}

export function tickSkillTraining(state: GameState, dt: number): void {
  const id = state.activeSkillId;
  if (!id) return;
  const sk = state.skills[id];
  const rate = 7 + sk.level * 0.4;
  sk.xp += rate * dt;
  let guard = 0;
  while (sk.xp >= xpToNextLevel(sk.level) && guard < 500) {
    guard++;
    sk.xp -= xpToNextLevel(sk.level);
    sk.level += 1;
  }
}

export const SKILL_LABEL: Record<SkillId, string> = {
  combat: "战艺",
  gathering: "采灵",
  arcana: "法篆",
};

export const SKILL_HINT: Record<SkillId, string> = {
  combat: "副本伤害、生命与幻域闪避/接战/攻速（见「角色」）",
  gathering: "略增灵石与资源向收益",
  arcana: "略加快聚灵共鸣累积",
};
