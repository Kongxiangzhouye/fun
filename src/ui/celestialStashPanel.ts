import type { GameState } from "../types";
import { CELESTIAL_OFFERS } from "../data/celestialStash";
import { currentWeekKey } from "../systems/weeklyBounty";
import {
  canAffordCelestialOffer,
  celestialStashWeeklyProgress,
  isCelestialOfferPurchasedThisWeek,
} from "../systems/celestialStash";
import { UI_CELESTIAL_STASH_AUTO_REDEEM, UI_CELESTIAL_STASH_PROGRESS, UI_HEAD_CELESTIAL_STASH } from "./visualAssets";

function costLine(_state: GameState, offerId: string): string {
  const def = CELESTIAL_OFFERS.find((o) => o.id === offerId);
  if (!def) return "";
  const parts: string[] = [];
  if (def.costStones != null && def.costStones > 0) parts.push(`灵石 ${def.costStones}`);
  if (def.costLingSha != null && def.costLingSha > 0) parts.push(`灵砂 ${def.costLingSha}`);
  if (def.costXuanTie != null && def.costXuanTie > 0) parts.push(`玄铁 ${def.costXuanTie}`);
  if (def.costEssence != null && def.costEssence > 0) parts.push(`唤灵髓 ${def.costEssence}`);
  return parts.join(" · ");
}

function rewardLine(def: (typeof CELESTIAL_OFFERS)[0]): string {
  const parts: string[] = [];
  if (def.rewardStones != null && def.rewardStones > 0) parts.push(`灵石 ${def.rewardStones}`);
  if (def.rewardEssence != null && def.rewardEssence > 0) parts.push(`唤灵髓 ${def.rewardEssence}`);
  if (def.rewardDao != null && def.rewardDao > 0) parts.push(`道韵 ${def.rewardDao}`);
  return parts.join(" · ");
}

export function renderCelestialStashPanel(state: GameState, now: number): string {
  const wk = currentWeekKey(now);
  const prog = celestialStashWeeklyProgress(state, now);
  const remain = Math.max(0, prog.total - prog.purchased);
  const cards = CELESTIAL_OFFERS.map((def) => {
    const bought = isCelestialOfferPurchasedThisWeek(state, def.id);
    const realmOk = def.minRealm == null || state.realmLevel >= def.minRealm;
    const canAff = canAffordCelestialOffer(state, def.id) && realmOk;
    const canBuy = !bought && canAff;
    const hintRealm = def.minRealm != null && state.realmLevel < def.minRealm ? ` 需境界 ≥${def.minRealm}` : "";
    return `
      <div class="celestial-card" data-celestial-offer="${def.id}">
        <div class="celestial-card-head">
          <h3>${def.title}</h3>
          <span class="celestial-status ${bought ? "bought" : canAff ? "ready" : "lock"}">${bought ? "本周已换" : canAff ? "可换" : "条件不足"}</span>
        </div>
        <p class="hint sm">${def.desc}${hintRealm}</p>
        <p class="hint sm celestial-cost">支付：${costLine(state, def.id)}</p>
        <p class="hint sm celestial-reward">获得：${rewardLine(def)}</p>
        <button type="button" class="btn ${canBuy ? "btn-primary" : ""}" data-celestial-buy="${def.id}" ${canBuy ? "" : "disabled"}>
          ${bought ? "本周已兑换" : canBuy ? "兑换" : "无法兑换"}
        </button>
      </div>`;
  }).join("");

  return `
    <section class="panel celestial-stash-panel">
      <div class="panel-title-art-row">
        <img class="panel-title-art-icon" src="${UI_HEAD_CELESTIAL_STASH}" alt="" width="28" height="28" loading="lazy" />
        <h2>天机匣</h2>
      </div>
      <p class="hint">与周悬赏同步按<strong>本地自然周</strong>（周一）刷新；每档每周限购 1 次。</p>
      <p class="hint sm celestial-week-line">当前周次：<strong>${wk}</strong></p>
      <div class="celestial-progress-row">
        <img class="celestial-progress-ico" src="${UI_CELESTIAL_STASH_PROGRESS}" alt="" width="22" height="22" loading="lazy" />
        <p class="hint sm celestial-progress-line" id="celestial-progress-line">
          本周已兑换 <strong id="celestial-progress-purchased">${prog.purchased}</strong> / ${prog.total}
          · 剩余 <strong id="celestial-progress-remaining">${remain}</strong> 项
        </p>
      </div>
      <label class="celestial-auto-redeem-row">
        <input type="checkbox" id="chk-celestial-auto-redeem" data-ui-pref="autoRedeemCelestialStash" ${state.uiPrefs.autoRedeemCelestialStash ? "checked" : ""} />
        <img class="celestial-auto-redeem-ico" src="${UI_CELESTIAL_STASH_AUTO_REDEEM}" alt="" width="20" height="20" loading="lazy" />
        <span class="celestial-auto-redeem-text">资源足够时自动兑换本周尚未兑换的可换条目（按列表顺序）</span>
      </label>
      <div class="celestial-grid">${cards}</div>
    </section>`;
}

export function updateCelestialStashPanelReadouts(state: GameState, now: number): void {
  const autoChk = document.getElementById("chk-celestial-auto-redeem") as HTMLInputElement | null;
  if (autoChk) autoChk.checked = state.uiPrefs.autoRedeemCelestialStash;
  const wkEl = document.querySelector(".celestial-week-line strong");
  if (wkEl) wkEl.textContent = currentWeekKey(now);
  const prog = celestialStashWeeklyProgress(state, now);
  const remain = Math.max(0, prog.total - prog.purchased);
  const pPur = document.getElementById("celestial-progress-purchased");
  const pRem = document.getElementById("celestial-progress-remaining");
  if (pPur) pPur.textContent = String(prog.purchased);
  if (pRem) pRem.textContent = String(remain);
  for (const def of CELESTIAL_OFFERS) {
    const bought = isCelestialOfferPurchasedThisWeek(state, def.id);
    const realmOk = def.minRealm == null || state.realmLevel >= def.minRealm;
    const canAff = canAffordCelestialOffer(state, def.id) && realmOk;
    const canBuy = !bought && canAff;
    const card = document.querySelector(`[data-celestial-offer="${def.id}"]`);
    if (!card) continue;
    const status = card.querySelector(".celestial-status");
    if (status) {
      status.className = `celestial-status ${bought ? "bought" : canAff ? "ready" : "lock"}`;
      status.textContent = bought ? "本周已换" : canAff ? "可换" : "条件不足";
    }
    const btn = card.querySelector("[data-celestial-buy]") as HTMLButtonElement | null;
    if (btn) {
      btn.disabled = !canBuy;
      btn.className = `btn ${canBuy ? "btn-primary" : ""}`;
      btn.textContent = bought ? "本周已兑换" : canBuy ? "兑换" : "无法兑换";
    }
  }
}
