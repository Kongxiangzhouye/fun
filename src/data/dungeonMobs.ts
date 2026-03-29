import type { Element } from "../types";

const EL_PREFIX: Record<Element, string> = {
  metal: "金",
  wood: "木",
  water: "水",
  fire: "火",
  earth: "土",
};

/** 普通怪外观 / 称呼（与 mobKind 0–7 对应） */
export const MOB_KIND_NAMES = [
  "血煞",
  "幽影",
  "藤奴",
  "腐沼",
  "雷傀",
  "岩卫",
  "幻魅",
  "骨卒",
];

const BOSS_EPITHETS = [
  "烬主",
  "劫尊",
  "魇王",
  "冥狩",
  "煞君",
  "渊主",
  "罗刹",
  "劫煞",
];

export function randomBossEpithet(rand01: () => number): string {
  return BOSS_EPITHETS[Math.floor(rand01() * BOSS_EPITHETS.length)]!;
}

export function mobKindLabel(kind: number): string {
  return MOB_KIND_NAMES[((kind % MOB_KIND_NAMES.length) + MOB_KIND_NAMES.length) % MOB_KIND_NAMES.length]!;
}

export function formatMobDisplayName(
  element: Element,
  kind: number,
  isBoss: boolean,
  bossEpithet: string | undefined,
  mobRole?: "melee" | "ranged",
): string {
  const el = EL_PREFIX[element];
  const skin = mobKindLabel(kind);
  if (isBoss) {
    const epi = bossEpithet ?? "劫主";
    return `${el}灵·${epi}`;
  }
  const tag = mobRole === "ranged" ? "·远程" : mobRole === "melee" ? "·近战" : "";
  return `${el}系·${skin}${tag}`;
}
