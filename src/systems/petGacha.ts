import type { GameState, PetId, Rarity } from "../types";
import { nextRand01 } from "../rng";
import { rarityRank } from "../data/rarityRank";
import { PET_DEFS } from "../data/pets";
import { PET_PULL_COST, addPetXp, petSystemUnlocked } from "./pets";
import { pickRarityByWeights01 } from "./rarityDraw";

const RARITY_WEIGHT: Record<Rarity, number> = {
  N: 380,
  R: 260,
  SR: 200,
  SSR: 120,
  UR: 40,
};

const PET_POOL_BY_RARITY: Record<Rarity, typeof PET_DEFS> = {
  N: PET_DEFS.filter((p) => p.rarity === "N"),
  R: PET_DEFS.filter((p) => p.rarity === "R"),
  SR: PET_DEFS.filter((p) => p.rarity === "SR"),
  SSR: PET_DEFS.filter((p) => p.rarity === "SSR"),
  UR: PET_DEFS.filter((p) => p.rarity === "UR"),
};

function pickPetRarity(state: GameState): Rarity {
  return pickRarityByWeights01(RARITY_WEIGHT, nextRand01(state));
}

export function pullPet(state: GameState): {
  ok: boolean;
  msg: string;
  petId?: PetId;
  duplicate?: boolean;
} {
  if (!petSystemUnlocked(state)) return { ok: false, msg: "幻域累计击溃 15 波后开放唤灵池" };
  if (state.summonEssence < PET_PULL_COST) return { ok: false, msg: `唤灵髓不足（需 ${PET_PULL_COST}）` };

  state.summonEssence -= PET_PULL_COST;
  state.petPullsTotal += 1;

  let rarity = pickPetRarity(state);
  let pool = PET_POOL_BY_RARITY[rarity];
  if (pool.length === 0) {
    rarity = "N";
    pool = PET_POOL_BY_RARITY.N;
  }
  const def = pool[Math.floor(nextRand01(state) * pool.length)]!;
  const had = state.pets[def.id] != null;

  if (had) {
    const bonusXp = 38 + Math.max(0, rarityRank(def.rarity)) * 26;
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
