import Decimal from "decimal.js";
import type { GameState, GardenCropId } from "../types";
import { addStones, canAfford, subStones } from "../stones";
import { noteWeeklyBountyGardenHarvest } from "./weeklyBounty";

export const GARDEN_PLOT_COUNT = 3;

export const GARDEN_CROPS: Record<
  GardenCropId,
  {
    name: string;
    desc: string;
    plantCost: Decimal;
    growSec: number;
    harvestLingSha: number;
    harvestStones: string;
    harvestEssence: number;
  }
> = {
  qing_grass: {
    name: "青心草",
    desc: "入门灵草，成熟快，适合过渡。",
    plantCost: new Decimal(80),
    growSec: 45,
    harvestLingSha: 4,
    harvestStones: "12",
    harvestEssence: 0,
  },
  cloud_shroom: {
    name: "云芝",
    desc: "菌类灵材，灵砂收益更高。",
    plantCost: new Decimal(400),
    growSec: 240,
    harvestLingSha: 18,
    harvestStones: "80",
    harvestEssence: 0,
  },
  jade_mist: {
    name: "玉露花",
    desc: "珍稀花卉，成熟时偶结唤灵髓。",
    plantCost: new Decimal(2000),
    growSec: 720,
    harvestLingSha: 55,
    harvestStones: "350",
    harvestEssence: 1,
  },
};

export function emptyGardenPlots(): GameState["spiritGarden"]["plots"] {
  return Array.from({ length: GARDEN_PLOT_COUNT }, () => ({ crop: null, plantedAtMs: 0 }));
}

export function normalizeSpiritGarden(st: GameState): void {
  if (!st.spiritGarden || !Array.isArray(st.spiritGarden.plots)) {
    st.spiritGarden = { plots: emptyGardenPlots(), totalHarvests: 0 };
    return;
  }
  while (st.spiritGarden.plots.length < GARDEN_PLOT_COUNT) {
    st.spiritGarden.plots.push({ crop: null, plantedAtMs: 0 });
  }
  st.spiritGarden.plots.length = GARDEN_PLOT_COUNT;
  for (const p of st.spiritGarden.plots) {
    if (p.plantedAtMs == null || !Number.isFinite(p.plantedAtMs)) p.plantedAtMs = 0;
  }
  if (st.spiritGarden.totalHarvests == null || !Number.isFinite(st.spiritGarden.totalHarvests)) {
    st.spiritGarden.totalHarvests = 0;
  }
  st.spiritGarden.totalHarvests = Math.max(0, Math.floor(st.spiritGarden.totalHarvests));
}

/** 剩余生长时间 ms；无作物时为 0 */
export function plotGrowRemainingMs(state: GameState, plotIndex: number, now: number): number {
  normalizeSpiritGarden(state);
  const p = state.spiritGarden.plots[plotIndex];
  if (!p?.crop) return 0;
  const def = GARDEN_CROPS[p.crop];
  const end = p.plantedAtMs + def.growSec * 1000;
  return Math.max(0, end - now);
}

export function isPlotReady(state: GameState, plotIndex: number, now: number): boolean {
  const p = state.spiritGarden.plots[plotIndex];
  return p?.crop != null && plotGrowRemainingMs(state, plotIndex, now) <= 0;
}

export function plantCrop(state: GameState, plotIndex: number, crop: GardenCropId, now: number): boolean {
  normalizeSpiritGarden(state);
  if (plotIndex < 0 || plotIndex >= GARDEN_PLOT_COUNT) return false;
  const plot = state.spiritGarden.plots[plotIndex];
  if (plot.crop != null) return false;
  const def = GARDEN_CROPS[crop];
  if (!canAfford(state, def.plantCost)) return false;
  if (!subStones(state, def.plantCost)) return false;
  plot.crop = crop;
  plot.plantedAtMs = now;
  return true;
}

export interface HarvestResult {
  message: string;
  lingSha: number;
  essence: number;
}

export function harvestPlot(state: GameState, plotIndex: number, now: number): HarvestResult | null {
  normalizeSpiritGarden(state);
  if (plotIndex < 0 || plotIndex >= GARDEN_PLOT_COUNT) return null;
  if (!isPlotReady(state, plotIndex, now)) return null;
  const plot = state.spiritGarden.plots[plotIndex];
  const c = plot.crop!;
  const def = GARDEN_CROPS[c];
  plot.crop = null;
  plot.plantedAtMs = 0;
  state.spiritGarden.totalHarvests += 1;
  noteWeeklyBountyGardenHarvest(state);
  state.lingSha += def.harvestLingSha;
  addStones(state, def.harvestStones);
  let essence = 0;
  if (def.harvestEssence > 0) {
    essence = def.harvestEssence;
    state.summonEssence += essence;
  }
  const parts = [`灵砂 +${def.harvestLingSha}`, `灵石 +${def.harvestStones}`];
  if (essence > 0) parts.push(`唤灵髓 +${essence}`);
  return { message: `收获 ${def.name}：${parts.join("，")}`, lingSha: def.harvestLingSha, essence };
}
