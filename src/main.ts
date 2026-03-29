import "./styles.css";
import type { GameState } from "./types";
import { TICKET_COST_SINGLE, TICKET_COST_TEN, MAX_CARD_LEVEL, REINCARNATION_REALM_REQ } from "./types";
import { loadGame, saveGame, exportSave, importSave, totalCardsInPool } from "./storage";
import {
  incomePerSecond,
  realmBreakthroughCost,
  upgradeCardLevelCost,
  deckRealmBonusSum,
  effectiveDeckSlots,
  elementSynergyMultiplier,
} from "./economy";
import { catchUpOffline, applyTick } from "./gameLoop";
import { pullOne, pullTen, urPityRemaining } from "./gacha";
import { CARDS, getCard } from "./data/cards";
import { tryCompleteAchievements } from "./achievements";
import { ACHIEVEMENTS } from "./achievements";
import {
  canReincarnate,
  daoEssenceGainOnReincarnate,
  performReincarnate,
  buyMeta,
  metaUpgradeCost,
} from "./systems/reincarnation";

const EL_ZH: Record<string, string> = {
  metal: "金",
  wood: "木",
  water: "水",
  fire: "火",
  earth: "土",
};

const TICKET_SHOP_PRICE = 520;

let state: GameState = loadGame();
let selectedInvId: string | null = null;
let activeTab: "idle" | "gacha" | "deck" | "codex" | "meta" | "ach" = "idle";
let toastTimer = 0;

function fmt(n: number): string {
  if (!Number.isFinite(n)) return "—";
  if (n >= 1e9) return (n / 1e9).toFixed(2) + "B";
  if (n >= 1e6) return (n / 1e6).toFixed(2) + "M";
  if (n >= 1e3) return (n / 1e3).toFixed(2) + "K";
  if (n >= 100) return n.toFixed(0);
  if (n >= 10) return n.toFixed(1);
  return n.toFixed(2);
}

function localDate(): string {
  const n = new Date();
  return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, "0")}-${String(n.getDate()).padStart(2, "0")}`;
}

function toast(msg: string): void {
  const w = document.getElementById("toast-wrap");
  if (!w) return;
  const el = document.createElement("div");
  el.className = "toast";
  el.textContent = msg;
  w.appendChild(el);
  setTimeout(() => el.remove(), 4200);
}

function formatPullResults(results: ReturnType<typeof pullTen>): string {
  return results
    .map((r) => {
      const tag = r.isNew ? "NEW" : r.duplicateStars ? "★+1" : "重复";
      return `${r.card.name} [${r.card.rarity}] ${tag}`;
    })
    .join(" · ");
}

function render(): void {
  const app = document.getElementById("app");
  if (!app) return;

  const ips = incomePerSecond(state, totalCardsInPool());
  const slots = effectiveDeckSlots(state);
  const pityUr = urPityRemaining(state);
  const rb = realmBreakthroughCost(state.realmLevel);
  const canBreak = state.spiritStones >= rb;

  app.innerHTML = `
    <header>
      <h1>万象抽灵</h1>
      <p class="subtitle">放置挂机 · 抽卡深度养成 · 轮回与元成长</p>
    </header>
    <div class="top-bar">
      <div class="stat-pill"><span class="label">灵石</span><strong>${fmt(state.spiritStones)}</strong></div>
      <div class="stat-pill"><span class="label">抽卡券</span><strong>${state.tickets}</strong></div>
      <div class="stat-pill"><span class="label">道韵</span><strong>${fmt(state.daoEssence)}</strong></div>
      <div class="stat-pill"><span class="label">境界</span><strong>${state.realmLevel}</strong></div>
      <div class="stat-pill"><span class="label">轮回</span><strong>${state.reincarnations}</strong></div>
    </div>
    <nav class="tabs">
      <button class="tab ${activeTab === "idle" ? "active" : ""}" data-tab="idle">挂机</button>
      <button class="tab ${activeTab === "gacha" ? "active" : ""}" data-tab="gacha">抽卡</button>
      <button class="tab ${activeTab === "deck" ? "active" : ""}" data-tab="deck">卡组</button>
      <button class="tab ${activeTab === "codex" ? "active" : ""}" data-tab="codex">图鉴</button>
      <button class="tab ${activeTab === "meta" ? "active" : ""}" data-tab="meta">轮回阁</button>
      <button class="tab ${activeTab === "ach" ? "active" : ""}" data-tab="ach">成就</button>
    </nav>

    ${activeTab === "idle" ? renderIdle(ips, rb, canBreak) : ""}
    ${activeTab === "gacha" ? renderGacha(pityUr) : ""}
    ${activeTab === "deck" ? renderDeck(slots) : ""}
    ${activeTab === "codex" ? renderCodex() : ""}
    ${activeTab === "meta" ? renderMeta() : ""}
    ${activeTab === "ach" ? renderAch() : ""}

    <div class="footer-tools">
      <button class="btn" type="button" id="btn-daily">每日馈赠 ${state.dailyClaimDate === localDate() ? "(已领)" : ""}</button>
      <button class="btn" type="button" id="btn-save">手动存档</button>
      <button class="btn" type="button" id="btn-export">导出存档</button>
      <input type="text" id="import-input" placeholder="粘贴导入 Base64" />
      <button class="btn" type="button" id="btn-import">导入</button>
    </div>
  `;

  bindEvents(ips, rb, slots);
}

function renderIdle(ips: number, rb: number, canBreak: boolean): string {
  const codex = totalCardsInPool();
  const unique = Object.keys(state.owned).length;
  const elemSy = ((elementSynergyMultiplier(state.deck) - 1) * 100).toFixed(1);
  return `
    <section class="panel">
      <h2>灵脉汇聚</h2>
      <div class="income-line">当前灵石/秒：<strong>${fmt(ips)}</strong></div>
      <p class="hint">收入来自境界基础、卡组产出、图鉴收集度、元素共鸣、道途元强化与轮回记忆。将卡牌放入卡组以激活产出与境界加成。</p>
      <div class="btn-row">
        <button class="btn btn-primary" type="button" id="btn-realm" ${canBreak ? "" : "disabled"}>
          突破境界（消耗 ${fmt(rb)} 灵石）
        </button>
        <button class="btn" type="button" id="btn-buy-ticket" ${state.spiritStones >= TICKET_SHOP_PRICE ? "" : "disabled"}>
          购买抽卡券（${TICKET_SHOP_PRICE} 灵石）
        </button>
      </div>
      <p class="hint">图鉴：${unique} / ${codex} · 卡组境界加成合计：${deckRealmBonusSum(state).toFixed(2)}% · 元素共鸣额外：+${elemSy}%</p>
    </section>
  `;
}

function renderGacha(pityUr: number): string {
  return `
    <section class="panel">
      <h2>祈愿池</h2>
      <p class="pity-info">距离 UR 保底还剩约 <strong>${pityUr}</strong> 抽 · 软保底从第 65 抽起提升 SSR/UR 权重</p>
      <div class="gacha-actions">
        <button class="btn btn-primary" type="button" id="btn-pull-1" ${state.tickets >= TICKET_COST_SINGLE ? "" : "disabled"}>单抽（${TICKET_COST_SINGLE} 券）</button>
        <button class="btn btn-primary" type="button" id="btn-pull-10" ${state.tickets >= TICKET_COST_TEN ? "" : "disabled"}>十连（${TICKET_COST_TEN} 券）</button>
      </div>
      <p class="hint">抽卡券可通过挂机购买、每日馈赠、成就与轮回获得。元升级「祈愿加护」可提升高稀有概率。</p>
      <table class="rates-table">
        <thead><tr><th>稀有度</th><th>说明</th></tr></thead>
        <tbody>
          <tr><td class="rarity-UR">UR</td><td>极稀有，强力产出与境界加成；90 抽硬保底</td></tr>
          <tr><td class="rarity-SSR">SSR</td><td>超稀有，高权重成长</td></tr>
          <tr><td class="rarity-SR">SR</td><td>稀有</td></tr>
          <tr><td class="rarity-R">R</td><td>进阶</td></tr>
          <tr><td class="rarity-N">N</td><td>常见</td></tr>
        </tbody>
      </table>
      <div id="pull-output" class="pull-result"></div>
    </section>
  `;
}

function renderDeck(slots: number): string {
  const ownedIds = Object.keys(state.owned).sort((a, b) => {
    const ca = getCard(a);
    const cb = getCard(b);
    const order = { UR: 0, SSR: 1, SR: 2, R: 3, N: 4 };
    return (order[ca!.rarity] ?? 9) - (order[cb!.rarity] ?? 9);
  });

  let slotsHtml = "";
  for (let i = 0; i < slots; i++) {
    const id = state.deck[i];
    const def = id ? getCard(id) : null;
    const o = id ? state.owned[id] : null;
    const filled = !!def && !!o;
    slotsHtml += `
      <div class="deck-slot ${filled ? "filled" : ""}" data-slot="${i}" role="button" tabindex="0">
        <div class="slot-label">槽位 ${i + 1}${i >= 4 ? " · 轮回阁解锁" : ""}</div>
        ${
          filled
            ? `<div class="card-mini">
                 <span class="name rarity-${def!.rarity}">${def!.name}</span>
                 <div class="inv-meta">Lv.${o!.level} ★${o!.stars} · ${EL_ZH[def!.element]}</div>
               </div>`
            : `<span class="hint">空</span>`
        }
      </div>
    `;
  }

  let invHtml = "";
  for (const id of ownedIds) {
    const def = getCard(id)!;
    const o = state.owned[id]!;
    const sel = selectedInvId === id ? "selected" : "";
    invHtml += `
      <div class="inv-row ${sel}" data-inv="${id}">
        <div>
          <span class="rarity-${def.rarity}">${def.name}</span>
          <span class="inv-meta"> · Lv.${o.level} ★${o.stars} · ${EL_ZH[def.element]}</span>
        </div>
        <span class="inv-meta">${def.rarity}</span>
      </div>
    `;
  }

  const sel = selectedInvId ? getCard(selectedInvId) : null;
  const so = selectedInvId ? state.owned[selectedInvId] : null;
  const upgradeCost = so ? upgradeCardLevelCost(so.level) : 0;
  const canUp = sel && so && so.level < MAX_CARD_LEVEL && state.spiritStones >= upgradeCost;

  return `
    <section class="panel">
      <h2>卡组（${slots} 槽生效）</h2>
      <p class="hint">先点击仓库中的卡牌选中，再点击槽位上阵；无选中时点击已有卡槽可下阵。重复卡可提升星级。同元素三张以上触发元素共鸣。</p>
      <div class="deck-slots">${slotsHtml}</div>
      <h2 style="font-size:1rem;margin:12px 0 8px">仓库</h2>
      <div class="inventory">${invHtml || '<p class="hint">暂无卡牌，去祈愿池试试。</p>'}</div>
      ${
        sel && so
          ? `<div class="panel" style="margin-top:12px;padding:12px">
               <strong>${sel.name}</strong>
               <p class="hint" style="margin:6px 0">${sel.flavor}</p>
               <div class="btn-row">
                 <button class="btn btn-primary" type="button" id="btn-card-up" ${canUp ? "" : "disabled"}>
                   升级（${fmt(upgradeCost)} 灵石）→ Lv.${Math.min(MAX_CARD_LEVEL, so.level + 1)}
                 </button>
                 <button class="btn" type="button" id="btn-clear-sel">取消选中</button>
               </div>
             </div>`
          : ""
      }
    </section>
  `;
}

function renderCodex(): string {
  let html = "";
  for (const c of CARDS) {
    const has = state.codexUnlocked.has(c.id);
    html += `
      <div class="codex-card ${has ? "" : "locked"}">
        <div><span class="rarity-${c.rarity}">${c.name}</span> <span class="inv-meta">${EL_ZH[c.element]}</span></div>
        <div class="flavor">${has ? c.flavor : "？？？（未邂逅）"}</div>
      </div>
    `;
  }
  return `
    <section class="panel">
      <h2>万象图鉴</h2>
      <p class="hint">收集更多不同灵卡可提升全局灵石加成（上限 15%）。</p>
      <div class="codex-grid">${html}</div>
    </section>
  `;
}

function renderMeta(): string {
  const gain = daoEssenceGainOnReincarnate(state);
  const reinOk = canReincarnate(state);
  const kinds: (keyof GameState["meta"])[] = ["idleMult", "gachaLuck", "deckSlots", "ticketRegen", "stoneMult"];
  const titles: Record<keyof GameState["meta"], string> = {
    idleMult: "灵脉共鸣",
    gachaLuck: "祈愿加护",
    deckSlots: "额外槽位",
    ticketRegen: "轮回赠券",
    stoneMult: "灵石心印",
  };
  const desc: Record<keyof GameState["meta"], string> = {
    idleMult: "每级：全局挂机效率 +8%",
    gachaLuck: "每级：高稀有权重略升",
    deckSlots: "每级：卡组 +1 槽（最多 +2，总上限 6）",
    ticketRegen: "每级：轮回初始赠券 +1",
    stoneMult: "每级：灵石获取 +6%",
  };

  let grid = "";
  for (const k of kinds) {
    const lv = state.meta[k];
    const maxed = k === "deckSlots" ? lv >= 2 : lv >= 20;
    const cost = metaUpgradeCost(k, lv);
    const can = !maxed && state.daoEssence >= cost;
    grid += `
      <div class="meta-card">
        <h3>${titles[k]} <span class="inv-meta">Lv.${lv}</span></h3>
        <p class="hint">${desc[k]}</p>
        <button class="btn btn-primary" type="button" data-meta="${k}" ${can ? "" : "disabled"}>
          强化（${fmt(cost)} 道韵）
        </button>
      </div>
    `;
  }

  return `
    <section class="panel">
      <h2>轮回</h2>
      <p>境界达到 <strong>${REINCARNATION_REALM_REQ}</strong> 后可轮回：清空境界、灵石、卡组与卡牌持有，保留图鉴邂逅记录、成就与元强化。获得道韵用于永久强化。</p>
      <p class="hint">预计本次可获得道韵：<strong>${fmt(gain)}</strong>（随境界与收集变化）</p>
      <div class="btn-row">
        <button class="btn btn-danger" type="button" id="btn-rein" ${reinOk ? "" : "disabled"}>确认轮回</button>
      </div>
    </section>
    <section class="panel">
      <h2>道途元强化</h2>
      <div class="meta-grid">${grid}</div>
    </section>
  `;
}

function renderAch(): string {
  let html = "";
  for (const a of ACHIEVEMENTS) {
    const done = state.achievementsDone.has(a.id);
    html += `
      <div class="ach-item ${done ? "done" : ""}">
        <div>
          <strong>${a.title}</strong>
          <p class="hint" style="margin:4px 0 0">${a.desc}</p>
        </div>
        <div class="inv-meta">
          ${done ? "已完成" : "进行中"}
          ${a.rewardStones ? `<br/>灵石 +${a.rewardStones}` : ""}
          ${a.rewardTickets ? `<br/>券 +${a.rewardTickets}` : ""}
        </div>
      </div>
    `;
  }
  return `
    <section class="panel">
      <h2>成就</h2>
      <p class="hint">达成时自动发放奖励。</p>
      <div class="ach-list">${html}</div>
    </section>
  `;
}

function bindEvents(_ips: number, rb: number, _slots: number): void {
  document.querySelectorAll(".tab").forEach((el) => {
    el.addEventListener("click", () => {
      const t = (el as HTMLElement).dataset.tab as typeof activeTab;
      if (t) {
        activeTab = t;
        render();
      }
    });
  });

  document.getElementById("btn-realm")?.addEventListener("click", () => {
    if (state.spiritStones >= rb) {
      state.spiritStones -= rb;
      state.realmLevel += 1;
      tryCompleteAchievements(state);
      saveGame(state);
      toast("境界突破成功");
      render();
    }
  });

  document.getElementById("btn-buy-ticket")?.addEventListener("click", () => {
    if (state.spiritStones >= TICKET_SHOP_PRICE) {
      state.spiritStones -= TICKET_SHOP_PRICE;
      state.tickets += 1;
      saveGame(state);
      toast("已购买 1 张抽卡券");
      render();
    }
  });

  document.getElementById("btn-pull-1")?.addEventListener("click", () => {
    if (state.tickets < TICKET_COST_SINGLE) return;
    state.tickets -= TICKET_COST_SINGLE;
    const r = pullOne(state);
    tryCompleteAchievements(state);
    saveGame(state);
    toast(`祈愿：${r.card.name} [${r.card.rarity}] ${r.isNew ? "NEW" : r.duplicateStars ? "★+1" : ""}`);
    render();
    const out = document.getElementById("pull-output");
    if (out) out.innerHTML = `<span class="pull-tag">${r.card.name} · ${r.card.rarity}</span>`;
  });

  document.getElementById("btn-pull-10")?.addEventListener("click", () => {
    if (state.tickets < TICKET_COST_TEN) return;
    state.tickets -= TICKET_COST_TEN;
    const results = pullTen(state);
    tryCompleteAchievements(state);
    saveGame(state);
    toast("十连完成：" + formatPullResults(results));
    render();
    const out = document.getElementById("pull-output");
    if (out) out.innerHTML = results.map((r) => `<span class="pull-tag">${r.card.name}·${r.card.rarity}</span>`).join("");
  });

  document.querySelectorAll("[data-inv]").forEach((el) => {
    el.addEventListener("click", () => {
      selectedInvId = (el as HTMLElement).dataset.inv ?? null;
      render();
    });
  });

  document.querySelectorAll(".deck-slot").forEach((el) => {
    el.addEventListener("click", () => {
      const si = Number((el as HTMLElement).dataset.slot);
      if (!Number.isFinite(si)) return;
      if (selectedInvId) {
        const prev = state.deck.indexOf(selectedInvId);
        if (prev >= 0) state.deck[prev] = null;
        state.deck[si] = selectedInvId;
        selectedInvId = null;
        saveGame(state);
        render();
        return;
      }
      if (state.deck[si]) {
        state.deck[si] = null;
        saveGame(state);
        render();
      }
    });
  });

  document.getElementById("btn-card-up")?.addEventListener("click", () => {
    if (!selectedInvId) return;
    const o = state.owned[selectedInvId];
    if (!o || o.level >= MAX_CARD_LEVEL) return;
    const c = upgradeCardLevelCost(o.level);
    if (state.spiritStones < c) return;
    state.spiritStones -= c;
    o.level += 1;
    saveGame(state);
    toast("卡牌等级提升");
    render();
  });

  document.getElementById("btn-clear-sel")?.addEventListener("click", () => {
    selectedInvId = null;
    render();
  });

  document.querySelectorAll("[data-meta]").forEach((el) => {
    el.addEventListener("click", () => {
      const k = (el as HTMLElement).dataset.meta as keyof GameState["meta"];
      if (buyMeta(state, k)) {
        saveGame(state);
        toast("元强化成功");
        render();
      }
    });
  });

  document.getElementById("btn-rein")?.addEventListener("click", () => {
    if (!confirm("确定轮回？境界、灵石、卡组与卡牌将重置，图鉴邂逅保留。")) return;
    performReincarnate(state);
    tryCompleteAchievements(state);
    saveGame(state);
    toast("轮回完成，道韵已入体");
    selectedInvId = null;
    render();
  });

  document.getElementById("btn-daily")?.addEventListener("click", () => {
    const d = localDate();
    if (state.dailyClaimDate === d) {
      toast("今日已领取");
      return;
    }
    state.dailyClaimDate = d;
    state.spiritStones += 180;
    state.tickets += 1;
    tryCompleteAchievements(state);
    saveGame(state);
    toast("领取每日馈赠：灵石 +180，抽卡券 +1");
    render();
  });

  document.getElementById("btn-save")?.addEventListener("click", () => {
    saveGame(state);
    toast("已保存");
  });

  document.getElementById("btn-export")?.addEventListener("click", () => {
    const s = exportSave(state);
    void navigator.clipboard.writeText(s).then(
      () => toast("存档已复制到剪贴板"),
      () => toast(s.slice(0, 80) + "…"),
    );
  });

  document.getElementById("btn-import")?.addEventListener("click", () => {
    const inp = document.getElementById("import-input") as HTMLInputElement | null;
    const raw = inp?.value?.trim();
    if (!raw) return;
    const next = importSave(raw);
    if (!next) {
      toast("导入失败");
      return;
    }
    state = next;
    selectedInvId = null;
    saveGame(state);
    toast("导入成功");
    render();
  });
}

function loop(): void {
  const now = Date.now();
  applyTick(state, now);
  toastTimer += 200;
  if (toastTimer >= 5000) {
    toastTimer = 0;
    saveGame(state);
  }
  const ipsEl = document.querySelector(".income-line strong");
  if (ipsEl && activeTab === "idle") {
    const ips = incomePerSecond(state, totalCardsInPool());
    ipsEl.textContent = fmt(ips);
  }
  const top = document.querySelectorAll(".top-bar strong");
  if (top.length >= 4) {
    top[0]!.textContent = fmt(state.spiritStones);
    top[1]!.textContent = String(state.tickets);
    top[2]!.textContent = fmt(state.daoEssence);
    top[3]!.textContent = String(state.realmLevel);
  }
}

function init(): void {
  const offline = catchUpOffline(state, Date.now());
  if (offline > 0.01) {
    saveGame(state);
    queueMicrotask(() => toast(`离线收益：约 ${fmt(offline)} 灵石`));
  }
  tryCompleteAchievements(state);
  render();
  setInterval(loop, 200);
}

init();
