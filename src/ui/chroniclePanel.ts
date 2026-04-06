import type { GameState } from "../types";
import { getCard } from "../data/cards";
import { fmtDecimal, stones } from "../stones";
import { PULL_CHRONICLE_MAX } from "../systems/pullChronicle";
import { rarityZh } from "./rarityZh";
import { UI_GEAR_CHRONICLE_DECO, UI_HEAD_CHRONICLE } from "./visualAssets";

function fmtTime(atMs: number): string {
  const d = new Date(atMs);
  return `${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

export function renderChroniclePanel(state: GameState): string {
  const cardTableBody =
    state.pullChronicle.length === 0
      ? `<tbody><tr><td colspan="3" class="chronicle-empty-cell"><p class="hint chronicle-empty">暂无灵卡唤引记录。去底部「抽卡 → 灵卡池」唤引后，会在此显示最近 ${PULL_CHRONICLE_MAX} 条。</p></td></tr></tbody>`
      : `<tbody>${state.pullChronicle
          .map((e) => {
            const c = getCard(e.defId);
            const name = c?.name ?? e.defId;
            const rz = rarityZh(e.rarity);
            const nw = e.isNew ? '<span class="chronicle-new">首遇</span>' : "";
            return `<tr class="chronicle-tr rarity-${e.rarity}">
          <td class="chronicle-td-time">${fmtTime(e.atMs)}</td>
          <td class="chronicle-td-name">${name} ${nw}</td>
          <td class="chronicle-td-r">${rz}</td>
        </tr>`;
          })
          .join("")}</tbody>`;

  const gearTableBody =
    state.gearPullChronicle.length === 0
      ? `<tbody><tr><td colspan="3" class="chronicle-empty-cell"><p class="hint chronicle-empty">暂无铸灵记录。去底部「抽卡 → 境界铸灵」铸灵后，会在此显示最近 ${PULL_CHRONICLE_MAX} 条。</p></td></tr></tbody>`
      : `<tbody>${state.gearPullChronicle
          .map((e) => {
            const rz = rarityZh(e.rarity);
            return `<tr class="chronicle-tr rarity-${e.rarity}">
          <td class="chronicle-td-time">${fmtTime(e.atMs)}</td>
          <td class="chronicle-td-name">${e.displayName}</td>
          <td class="chronicle-td-r">${rz}</td>
        </tr>`;
          })
          .join("")}</tbody>`;

  const ls = state.lifetimeStats;
  const pt = Math.floor(state.playtimeSec);
  const h = Math.floor(pt / 3600);
  const m = Math.floor((pt % 3600) / 60);

  return `
    <section class="panel chronicle-panel">
      <div class="panel-title-art-row">
        <img class="panel-title-art-icon" src="${UI_HEAD_CHRONICLE}" alt="" width="28" height="28" loading="lazy" />
        <h2>唤灵通鉴</h2>
      </div>
      <p class="hint">灵卡唤引与境界铸灵产出分栏记录；下方为部分终身统计。</p>
      <div class="chronicle-stats-grid">
        <div class="chronicle-stat-card">
          <span class="chronicle-stat-lbl">累计在线</span>
          <strong class="chronicle-stat-val">${h} 时 ${m} 分</strong>
        </div>
        <div class="chronicle-stat-card">
          <span class="chronicle-stat-lbl">灵卡累计唤引</span>
          <strong class="chronicle-stat-val">${state.totalPulls} 次</strong>
        </div>
        <div class="chronicle-stat-card">
          <span class="chronicle-stat-lbl">累计铸灵</span>
          <strong class="chronicle-stat-val">${ls.gearForgesTotal} 次</strong>
        </div>
        <div class="chronicle-stat-card">
          <span class="chronicle-stat-lbl">幻域累计入包髓</span>
          <strong class="chronicle-stat-val">${ls.dungeonEssenceIntGained}</strong>
        </div>
        <div class="chronicle-stat-card">
          <span class="chronicle-stat-lbl">天机匣兑换</span>
          <strong class="chronicle-stat-val">${ls.celestialStashBuys} 次</strong>
        </div>
        <div class="chronicle-stat-card">
          <span class="chronicle-stat-lbl">蓄灵池收取</span>
          <strong class="chronicle-stat-val">${ls.spiritReservoirClaims} 次</strong>
        </div>
        <div class="chronicle-stat-card">
          <span class="chronicle-stat-lbl">当前灵石</span>
          <strong class="chronicle-stat-val">${fmtDecimal(stones(state))}</strong>
        </div>
      </div>
      <h3 class="sub-h chronicle-sub-h">最近灵卡唤引</h3>
      <div class="chronicle-table-wrap">
        <table class="chronicle-table" aria-label="灵卡唤引记录">
          <thead><tr><th>时间</th><th>灵卡</th><th>稀有度</th></tr></thead>
          ${cardTableBody}
        </table>
      </div>
      <h3 class="sub-h chronicle-sub-h chronicle-sub-h--gear">
        <img class="chronicle-gear-deco" src="${UI_GEAR_CHRONICLE_DECO}" alt="" width="26" height="26" loading="lazy" />
        最近铸灵
      </h3>
      <div class="chronicle-table-wrap">
        <table class="chronicle-table chronicle-table--gear" aria-label="铸灵记录">
          <thead><tr><th>时间</th><th>装备</th><th>稀有度</th></tr></thead>
          ${gearTableBody}
        </table>
      </div>
    </section>`;
}
