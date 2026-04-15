import type { GameState } from "../types";
import {
  GARDEN_CROPS,
  GARDEN_PLOT_COUNT,
  isPlotReady,
  plotGrowRemainingMs,
  normalizeSpiritGarden,
} from "../systems/spiritGarden";
import { fmtDecimal } from "../stones";
import {
  UI_HEAD_GARDEN,
  UI_GARDEN_HARVEST_ALL,
  UI_GARDEN_REPLANT,
  GARDEN_CROP_IMG,
} from "./visualAssets";

export function renderSpiritGardenPage(state: GameState, now: number): string {
  normalizeSpiritGarden(state);
  const cropIds = Object.keys(GARDEN_CROPS) as (keyof typeof GARDEN_CROPS)[];
  const plotsHtml = [];
  for (let i = 0; i < GARDEN_PLOT_COUNT; i++) {
    const p = state.spiritGarden.plots[i];
    const ready = isPlotReady(state, i, now);
    const rem = plotGrowRemainingMs(state, i, now);
    const pct =
      p.crop && !ready ? Math.min(100, 100 - (100 * rem) / (GARDEN_CROPS[p.crop].growSec * 1000)) : ready ? 100 : 0;
    if (!p.crop) {
      const options = cropIds
        .map((id) => {
          const c = GARDEN_CROPS[id];
          const timeLabel = c.growSec < 120 ? `${c.growSec} 秒` : `约 ${Math.ceil(c.growSec / 60)} 分`;
          return `<option value="${id}">${c.name}（种 ${fmtDecimal(c.plantCost)} 灵石 · ${timeLabel}）</option>`;
        })
        .join("");
      plotsHtml.push(`
        <div class="spirit-garden-plot" data-garden-plot="${i}">
          <div class="spirit-garden-plot-visual spirit-garden-plot-empty" aria-hidden="true">
            <img class="garden-plot-soil" src="${UI_HEAD_GARDEN}" width="56" height="56" alt="" />
          </div>
          <p class="hint sm">空地 · 选择灵草并播种</p>
          <div class="spirit-garden-plant-row">
            <label class="sr-only" for="garden-crop-${i}">灵草种类</label>
            <select id="garden-crop-${i}" class="garden-crop-select" data-garden-crop-select="${i}">
              ${options}
            </select>
            <button type="button" class="btn btn-primary" data-garden-plant="${i}">播种</button>
          </div>
        </div>`);
    } else {
      const c = GARDEN_CROPS[p.crop];
      const img = GARDEN_CROP_IMG[p.crop];
      plotsHtml.push(`
        <div class="spirit-garden-plot" data-garden-plot="${i}">
          <div class="spirit-garden-plot-visual" aria-hidden="true">
            <img class="garden-crop-art" src="${img}" width="72" height="72" alt="" />
          </div>
          <h3 class="garden-crop-title">${c.name}</h3>
          <p class="hint sm">${c.desc}</p>
          <div class="garden-grow-bar-wrap" aria-hidden="true">
            <div class="garden-grow-bar"><div class="garden-grow-bar-fill" id="garden-bar-fill-${i}" style="width:${pct}%"></div></div>
          </div>
          <p class="hint sm garden-eta-line" id="garden-eta-${i}">${ready ? "已成熟，可收获" : `约 ${Math.ceil(rem / 1000)} 息后成熟`}</p>
          <button type="button" class="btn ${ready ? "btn-primary" : ""}" data-garden-harvest="${i}" ${ready ? "" : "disabled"}>
            ${ready ? "收获" : "生长中"}
          </button>
        </div>`);
    }
  }
  return `
    <section class="panel spirit-garden-panel">
      <div class="panel-title-art-row">
        <img class="panel-title-art-icon" src="${UI_HEAD_GARDEN}" alt="" width="28" height="28" loading="lazy" />
        <h2>灵田 · 灵草</h2>
      </div>
      <p class="hint">消耗灵石播种，经现实时间成熟后收获<strong>灵砂</strong>与<strong>灵石</strong>；高阶灵草额外掉落唤灵髓。灵田进度<strong>轮回不重置</strong>。</p>
      <p class="hint sm">累计收获：<strong id="garden-total-harvests">${state.spiritGarden.totalHarvests}</strong> 次</p>
      <div class="spirit-garden-batch-row">
        <button type="button" class="btn btn-primary spirit-garden-batch-btn" data-garden-harvest-all="1">
          <img class="spirit-garden-batch-ico" src="${UI_GARDEN_HARVEST_ALL}" alt="" width="20" height="20" loading="lazy" />
          一键收获
        </button>
        <button type="button" class="btn spirit-garden-batch-btn" data-garden-harvest-replant="1">
          <img class="spirit-garden-batch-ico" src="${UI_GARDEN_REPLANT}" alt="" width="20" height="20" loading="lazy" />
          收获并续种
        </button>
      </div>
      <p class="hint sm spirit-garden-batch-hint">续种优先使用该块灵田<strong>上次作物</strong>；灵石不足时跳过该块并提示。</p>
      <div class="spirit-garden-grid">${plotsHtml.join("")}</div>
    </section>`;
}
