import type { Element } from "../types";

/** 攻方克制守方时伤害倍率；被克时 */
const ADV = 1.28;
const DIS = 0.82;

/** 五行相克：金→木→土→水→火→金 */
const BEATS: Record<Element, Element> = {
  metal: "wood",
  wood: "earth",
  earth: "water",
  water: "fire",
  fire: "metal",
};

export function elementDamageMultiplier(attacker: Element, defender: Element): number {
  if (BEATS[attacker] === defender) return ADV;
  if (BEATS[defender] === attacker) return DIS;
  return 1;
}
