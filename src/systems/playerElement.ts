import type { GameState, Element } from "../types";
import { getCard } from "../data/cards";
import { effectiveDeckSlots } from "../economy";

const ORDER: Element[] = ["metal", "wood", "water", "fire", "earth"];

/** 阵上灵卡五行多数决定角色临场属性；无卡时默认为金 */
export function playerBattleElement(state: GameState): Element {
  const counts: Record<Element, number> = {
    metal: 0,
    wood: 0,
    water: 0,
    fire: 0,
    earth: 0,
  };
  const slots = effectiveDeckSlots(state);
  for (let i = 0; i < slots; i++) {
    const id = state.deck[i];
    if (!id) continue;
    const def = getCard(id);
    if (def) counts[def.element] += 1;
  }
  let best: Element = "metal";
  let mx = 0;
  for (const el of ORDER) {
    if (counts[el] > mx) {
      mx = counts[el];
      best = el;
    }
  }
  return best;
}
