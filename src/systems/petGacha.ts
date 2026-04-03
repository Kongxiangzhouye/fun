import type { GameState, PetId, Rarity } from "../types";
import { nextRand01 } from "../rng";
import { PET_DEFS } from "../data/pets";
import { PET_PULL_COST, addPetXp, petSystemUnlocked } from "./pets";

const RARITY_WEIGHT: Record<Rarity, number> = {
  N: 380,
  R: 260,
  SR: 200,
  SSR: 120,
  UR: 40,
};

function pickPetRarity(state: GameState): Rarity {
  const w = RARITY_WEIGHT;
  const total = w.N + w.R + w.SR + w.SSR + w.UR;
  let r = nextRand01(state) * total;
  const order: Rarity[] = ["N", "R", "SR", "SSR", "UR"];
  for (const ra of order) {
    r -= w[ra];
    if (r < 0) return ra;
  }
  return "UR";
}

const RARITY_ORDER: Rarity[] = ["N", "R", "SR", "SSR", "UR"];

export function pullPet(state: GameState): {
  ok: boolean;
  msg: string;
  petId?: PetId;
  duplicate?: boolean;
} {
  if (!petSystemUnlocked(state)) return { ok: false, msg: "境界≥12 或累计唤引≥25 次后开放唤灵池" };
  if (state.summonEssence < PET_PULL_COST) return { ok: false, msg: `唤灵髓不足（需 ${PET_PULL_COST}）` };

  state.summonEssence -= PET_PULL_COST;
  state.petPullsTotal += 1;

  let rarity = pickPetRarity(state);
  let pool = PET_DEFS.filter((p) => p.rarity === rarity);
  if (pool.length === 0) {
    rarity = "N";
    pool = PET_DEFS.filter((p) => p.rarity === "N");
  }
  const def = pool[Math.floor(nextRand01(state) * pool.length)]!;
  const had = state.pets[def.id] != null;

  if (had) {
    const idx = RARITY_ORDER.indexOf(def.rarity);
    const bonusXp = 38 + Math.max(0, idx) * 26;
    addPetXp(state, def.id, bonusXp);
    return {
      ok: true,
      msg: `重复邂逅「${def.name}」：灵契 +${bonusXp}（${def.rarity}）`,
      petId: def.id,
      duplicate: true,
    };
  }

  state.pets[def.id] = { level: 1, xp: 0 };
  return {
    ok: true,
    msg: `结缘成功：${def.name}（${def.rarity}）`,
    petId: def.id,
    duplicate: false,
  };
}
