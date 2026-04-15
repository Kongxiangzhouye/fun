import type { GameState } from "../types";
import { DAO_MERIDIAN_MAX, DAO_MERIDIAN_TIERS, nextDaoMeridianCost } from "../systems/daoMeridian";
import { UI_HEAD_DAO_MERIDIAN } from "./visualAssets";

export function renderDaoMeridianPanel(state: GameState): string {
  const n = state.daoMeridian;
  const nextCost = nextDaoMeridianCost(state);
  const canBuy = nextCost != null && state.daoEssence >= nextCost;
  const rows = DAO_MERIDIAN_TIERS.map((t, i) => {
    const done = i < n;
    const cur = i === n && n < DAO_MERIDIAN_MAX;
    return `
      <div class="dao-meridian-row ${done ? "done" : cur ? "current" : "locked"}">
        <span class="dao-meridian-badge">${done ? "✓" : cur ? "→" : "○"}</span>
        <div class="dao-meridian-row-body">
          <strong>${t.title}</strong>
          <span class="hint sm">${t.desc}</span>
          <span class="hint sm dao-meridian-cost">${done ? "已贯通" : `需 ${t.cost} 道韵`}</span>
        </div>
      </div>`;
  }).join("");

  return `
    <section class="panel dao-meridian-panel" data-next-boost-target="dao-meridian-panel">
      <div class="panel-title-art-row">
        <img class="panel-title-art-icon" src="${UI_HEAD_DAO_MERIDIAN}" alt="" width="28" height="28" loading="lazy" />
        <h2>道韵 · 灵窍</h2>
      </div>
      <p class="hint">消耗<strong>道韵</strong>贯通灵窍，获得永久加成（<strong>轮回不重置</strong>）。自浅至深依次解锁。</p>
      <p class="hint sm">已贯通 <strong id="dao-meridian-count">${n}</strong> / ${DAO_MERIDIAN_MAX} 层 · 持有道韵 <strong id="dao-meridian-ess">${state.daoEssence}</strong></p>
      <div class="dao-meridian-list">${rows}</div>
      <div class="dao-meridian-actions">
        <button type="button" class="btn ${canBuy ? "btn-primary" : ""}" id="btn-dao-meridian-buy" ${canBuy ? "" : "disabled"}>
          ${nextCost == null ? "已全部贯通" : `贯通下一层（${nextCost} 道韵）`}
        </button>
      </div>
    </section>`;
}
