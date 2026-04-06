import type { GameState, PetId, Rarity } from "../types";
import { nextRand01 } from "../rng";
import { rarityRank } from "../data/rarityRank";
import { PET_DEFS } from "../data/pets";
import { PET_PULL_COST, addPetXp, petSystemUnlocked } from "./pets";
import { recordSummonEssenceSpentLifetime } from "./pullChronicle";
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

function pickPetDefWithFallback(
  state: GameState,
  picked: Rarity,
): { ok: true; rarity: Rarity; defId: PetId } | { ok: false; msg: string } {
  const fallbackOrder: Rarity[] =
    picked === "UR" ? ["UR", "SSR", "SR", "R", "N"] : picked === "SSR" ? ["SSR", "SR", "R", "N"] : picked === "SR" ? ["SR", "R", "N"] : picked === "R" ? ["R", "N"] : ["N"];
  for (const r of fallbackOrder) {
    const pool = PET_POOL_BY_RARITY[r];
    if (pool.length <= 0) continue;
    const def = pool[Math.floor(nextRand01(state) * pool.length)];
    if (def) return { ok: true, rarity: r, defId: def.id };
  }
  return { ok: false, msg: "唤灵池暂不可用，请检查灵宠配置" };
}

export function pullPet(state: GameState): {
  ok: boolean;
  msg: string;
  petId?: PetId;
  duplicate?: boolean;
} {
  if (!petSystemUnlocked(state)) return { ok: false, msg: "幻域累计击溃 15 波后开放唤灵池" };
  if (state.summonEssence < PET_PULL_COST) return { ok: false, msg: `唤灵髓不足（需 ${PET_PULL_COST}）` };

  const pickedRarity = pickPetRarity(state);
  const pick = pickPetDefWithFallback(state, pickedRarity);
  if (!pick.ok) return { ok: false, msg: pick.msg };

  state.summonEssence -= PET_PULL_COST;
  state.petPullsTotal += 1;
  const def = PET_DEFS.find((p) => p.id === pick.defId);
  if (!def) {
    state.summonEssence += PET_PULL_COST;
    state.petPullsTotal = Math.max(0, state.petPullsTotal - 1);
    return { ok: false, msg: "唤灵失败：灵宠配置异常" };
  }
  recordSummonEssenceSpentLifetime(state, PET_PULL_COST);
  const had = state.pets[pick.defId] != null;

  if (had) {
    const bonusXp = 38 + Math.max(0, rarityRank(def.rarity)) * 26;
    addPetXp(state, pick.defId, bonusXp);
    return {
      ok: true,
      msg: `结缘重复：${def.name}（${def.rarity}）· 灵契 +${bonusXp}`,
      petId: pick.defId,
      duplicate: true,
    };
  }

  state.pets[pick.defId] = { level: 1, xp: 0 };
  return {
    ok: true,
    msg: `结缘成功：${def.name}（${def.rarity}）`,
    petId: pick.defId,
    duplicate: false,
  };
}
