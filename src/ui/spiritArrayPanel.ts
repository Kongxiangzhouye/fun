import type { GameState } from "../types";
import { fmtDecimal } from "../stones";
import {
  SPIRIT_ARRAY_MAX_LEVEL,
  canUpgradeSpiritArray,
  spiritArrayLingShaCost,
  spiritArrayStoneCost,
  spiritArrayStoneMult,
} from "../systems/spiritArray";
import { incomePerSecond } from "../economy";
import { totalCardsInPool } from "../storage";
import { UI_HEAD_SPIRIT_ARRAY, UI_SPIRIT_ARRAY_AUTO } from "./visualAssets";

export function renderSpiritArrayPanel(state: GameState): string {
  const lv = state.spiritArrayLevel;
  const maxed = lv >= SPIRIT_ARRAY_MAX_LEVEL;
  const sc = spiritArrayStoneCost(lv);
  const lc = spiritArrayLingShaCost(lv);
  const can = canUpgradeSpiritArray(state);
  const mult = spiritArrayStoneMult(state);
  const pool = totalCardsInPool();
  const ips = incomePerSecond(state, pool);
  const bonusPct = (mult.toNumber() - 1) * 100;

  return `
    <section class="panel spirit-array-panel">
      <div class="panel-title-art-row">
        <img class="panel-title-art-icon" src="${UI_HEAD_SPIRIT_ARRAY}" alt="" width="28" height="28" loading="lazy" />
        <h2>纳灵阵图</h2>
      </div>
      <p class="hint">以灵石与灵砂绘阵，提升<strong>全局灵石收益</strong>（与洞府、卦象等叠乘）。阵图<strong>轮回不重置</strong>。</p>
      <p class="hint sm spirit-array-readout">当前阵图 <strong id="spirit-array-lv">${lv}</strong> / ${SPIRIT_ARRAY_MAX_LEVEL} · 灵石收益 <strong id="spirit-array-mult">+${bonusPct.toFixed(1)}%</strong></p>
      <p class="hint sm">预览：每秒灵石约 <strong id="spirit-array-ips">${fmtDecimal(ips)}</strong>（已含阵图）</p>
      <div class="spirit-array-actions">
        <button type="button" class="btn ${can ? "btn-primary" : ""}" id="btn-spirit-array-up" data-next-boost-target="spirit-array-up" ${can ? "" : "disabled"}>
          ${maxed ? "阵图已满" : `绘阵一重（${fmtDecimal(sc)} 灵石 · ${lc} 灵砂）`}
        </button>
      </div>
    </section>`;
}

export function updateSpiritArrayPanelReadouts(state: GameState): void {
  const autoChk = document.getElementById("chk-spirit-array-auto") as HTMLInputElement | null;
  if (autoChk) autoChk.checked = state.uiPrefs.autoUpgradeSpiritArray;
  const lv = state.spiritArrayLevel;
  const maxed = lv >= SPIRIT_ARRAY_MAX_LEVEL;
  const sc = spiritArrayStoneCost(lv);
  const lc = spiritArrayLingShaCost(lv);
  const can = canUpgradeSpiritArray(state);
  const mult = spiritArrayStoneMult(state);
  const pool = totalCardsInPool();
  const ips = incomePerSecond(state, pool);
  const bonusPct = (mult.toNumber() - 1) * 100;
  const lvEl = document.getElementById("spirit-array-lv");
  const mEl = document.getElementById("spirit-array-mult");
  const ipsEl = document.getElementById("spirit-array-ips");
  const btn = document.getElementById("btn-spirit-array-up") as HTMLButtonElement | null;
  if (lvEl) lvEl.textContent = String(lv);
  if (mEl) mEl.textContent = `+${bonusPct.toFixed(1)}%`;
  if (ipsEl) ipsEl.textContent = fmtDecimal(ips);
  if (btn) {
    btn.disabled = !can;
    btn.className = `btn ${can ? "btn-primary" : ""}`;
    btn.textContent = maxed ? "阵图已满" : `绘阵一重（${fmtDecimal(sc)} 灵石 · ${lc} 灵砂）`;
  }
}
