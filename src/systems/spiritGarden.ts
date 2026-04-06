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
    /** `public/assets/ui/<artFile>`，与 UI 图标同源 */
    artFile: string;
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
    artFile: "garden-crop-qing.svg",
    plantCost: new Decimal(80),
    growSec: 45,
    harvestLingSha: 4,
    harvestStones: "12",
    harvestEssence: 0,
  },
  cloud_shroom: {
    name: "云芝",
    desc: "菌类灵材，灵砂收益更高。",
    artFile: "garden-crop-cloud.svg",
    plantCost: new Decimal(400),
    growSec: 240,
    harvestLingSha: 18,
    harvestStones: "80",
    harvestEssence: 0,
  },
  jade_mist: {
    name: "玉露花",
    desc: "珍稀花卉，成熟时偶结唤灵髓。",
    artFile: "garden-crop-jade.svg",
    plantCost: new Decimal(2000),
    growSec: 720,
    harvestLingSha: 55,
    harvestStones: "350",
    harvestEssence: 1,
  },
};

export function emptyGardenPlots(): GameState["spiritGarden"]["plots"] {
  return Array.from({ length: GARDEN_PLOT_COUNT }, () => ({ crop: null, plantedAtMs: 0, lastCrop: null }));
}

export function normalizeSpiritGarden(st: GameState): void {
  if (!st.spiritGarden || !Array.isArray(st.spiritGarden.plots)) {
    st.spiritGarden = { plots: emptyGardenPlots(), totalHarvests: 0 };
    return;
  }
  while (st.spiritGarden.plots.length < GARDEN_PLOT_COUNT) {
    st.spiritGarden.plots.push({ crop: null, plantedAtMs: 0, lastCrop: null });
  }
  st.spiritGarden.plots.length = GARDEN_PLOT_COUNT;
  for (const p of st.spiritGarden.plots) {
    if (p.plantedAtMs == null || !Number.isFinite(p.plantedAtMs)) p.plantedAtMs = 0;
    if (p.lastCrop === undefined) p.lastCrop = null;
    if (p.lastCrop != null && !GARDEN_CROPS[p.lastCrop]) p.lastCrop = null;
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
  plot.lastCrop = crop;
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
  plot.lastCrop = c;
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

export interface BatchGardenResult {
  harvested: number;
  replanted: number;
  skippedReplant: number;
  messages: string[];
}

/** 一键收获所有成熟地块（与单块收获相同，逐次调用 `noteWeeklyBountyGardenHarvest`） */
export function harvestAllReadyPlots(state: GameState, now: number): BatchGardenResult {
  const messages: string[] = [];
  let harvested = 0;
  for (let i = 0; i < GARDEN_PLOT_COUNT; i++) {
    if (!isPlotReady(state, i, now)) continue;
    const res = harvestPlot(state, i, now);
    if (res) {
      harvested++;
      messages.push(res.message);
    }
  }
  return { harvested, replanted: 0, skippedReplant: 0, messages };
}

/**
 * 成熟地块先收获再续种；续种优先 `lastCrop`（本块上次作物），灵石不足则跳过并记入反馈。
 */
export function harvestAndReplantAllReady(state: GameState, now: number): BatchGardenResult {
  const messages: string[] = [];
  let harvested = 0;
  let replanted = 0;
  let skippedReplant = 0;
  for (let i = 0; i < GARDEN_PLOT_COUNT; i++) {
    if (!isPlotReady(state, i, now)) continue;
    const res = harvestPlot(state, i, now);
    if (!res) continue;
    harvested++;
    messages.push(res.message);
    const plot = state.spiritGarden.plots[i];
    const want = plot.lastCrop;
    if (!want || !GARDEN_CROPS[want]) continue;
    if (plot.crop != null) continue;
    if (plantCrop(state, i, want, now)) {
      replanted++;
      messages.push(`${GARDEN_CROPS[want].name} 已续种`);
    } else {
      skippedReplant++;
      messages.push(`${GARDEN_CROPS[want].name} 续种跳过（灵石不足）`);
    }
  }
  return { harvested, replanted, skippedReplant, messages };
}

/** 与灵府灵田解锁一致：见 `getUiUnlocks().tabGarden` */
export function spiritGardenUnlocked(state: GameState): boolean {
  return state.totalPulls >= 1 && state.realmLevel >= 4;
}

/** 偏好开启且已解锁灵田时，对成熟地块执行收获并续种；无成熟则返回 null */
export function tryAutoHarvestAndReplantGarden(state: GameState, now: number): BatchGardenResult | null {
  if (!state.uiPrefs.autoHarvestSpiritGarden) return null;
  if (!spiritGardenUnlocked(state)) return null;
  normalizeSpiritGarden(state);
  const r = harvestAndReplantAllReady(state, now);
  if (r.harvested <= 0) return null;
  return r;
}
