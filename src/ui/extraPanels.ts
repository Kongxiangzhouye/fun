import type { GameState, Rarity, SkillId } from "../types";
import {
  SKILL_HINT,
  SKILL_LABEL,
  secondsToNextLevel,
  skillXpPerSecond,
  xpToNextLevel,
} from "../systems/skillTraining";
import { xuanTieEnhanceCost } from "../systems/gearCraft";
import { BATTLE_SKILLS } from "../data/battleSkills";
import { battleSkillPullCost, describeBattleSkillLevels } from "../systems/battleSkills";
import { rarityZh } from "./rarityZh";
import {
  GEAR_SLOT_ICON,
  PET_PORTRAIT,
  UI_ESSENCE,
  UI_EMPTY_GEAR,
  UI_EMPTY_PET,
  UI_EMPTY_UNLOCK,
  UI_HEAD_GEAR,
  UI_HEAD_PET,
  UI_HEAD_TRAIN,
} from "./visualAssets";
import { PET_DEFS } from "../data/pets";
import {
  describePetBonusesSummary,
  MAX_PET_LEVEL,
  petBonusPreviewLine,
  petSystemUnlocked,
  PET_SYSTEM_UNLOCK_REALM,
  PET_SYSTEM_UNLOCK_PULLS,
  PET_PULL_COST,
  xpToNextPetLevel,
} from "../systems/pets";

/** 灵宠列表：稀有度天极 → 凡品 */
const PET_RARITY_ORDER_DESC: Rarity[] = ["UR", "SSR", "SR", "R", "N"];

function fmtNum(n: number): string {
  if (n >= 1e4) return (n / 1e4).toFixed(1) + "万";
  return n.toFixed(0);
}

function fmtEta(sec: number | null): string {
  if (sec == null) return "—";
  if (sec <= 0) return "即将突破";
  if (sec < 60) return `约 ${Math.ceil(sec)} 秒`;
  if (sec < 3600) {
    const m = Math.floor(sec / 60);
    const s = Math.ceil(sec % 60);
    return `约 ${m} 分 ${s} 秒`;
  }
  return `约 ${Math.floor(sec / 60)} 分钟`;
}

export function renderTrainPanel(state: GameState): string {
  const ids: SkillId[] = ["combat", "gathering", "arcana"];
  let rows = "";
  const activeId = state.activeSkillId;
  const activeLabel =
    activeId === "combat" || activeId === "gathering" || activeId === "arcana" ? SKILL_LABEL[activeId] : null;
  const activeRate =
    activeId === "combat" || activeId === "gathering" || activeId === "arcana"
      ? skillXpPerSecond(state.skills[activeId].level)
      : 0;
  const activeEta =
    activeId === "combat" || activeId === "gathering" || activeId === "arcana"
      ? secondsToNextLevel(state.skills[activeId])
      : null;

  for (const id of ids) {
    const sk = state.skills[id];
    const need = xpToNextLevel(sk.level);
    const on = state.activeSkillId === id;
    const pct = need > 0 ? Math.min(100, (100 * sk.xp) / need) : 0;
    const rate = skillXpPerSecond(sk.level);
    const eta = secondsToNextLevel(sk);
    rows += `
      <div class="skill-row ${on ? "active" : ""}" data-skill-row="${id}">
        <div class="skill-row-body">
          <strong>${SKILL_LABEL[id]}</strong> Lv.${sk.level}
          <p class="hint">${SKILL_HINT[id]}</p>
          <div class="skill-progress-meta">
            <span class="skill-stat"><span class="lbl">经验</span> <strong id="skill-xp-line-${id}">${fmtNum(sk.xp)} / ${fmtNum(need)}</strong></span>
            <span class="skill-stat"><span class="lbl">获得</span> <strong id="skill-rate-${id}">${rate.toFixed(1)}</strong> / 秒</span>
            <span class="skill-stat"><span class="lbl">本阶剩余</span> <strong id="skill-eta-${id}">${fmtEta(eta)}</strong></span>
          </div>
          <div class="bar-label"><span>进度</span><span id="skill-pct-label-${id}">${pct.toFixed(1)}%</span></div>
          <div class="progress-track skill"><div class="progress-fill skill" id="skill-bar-fill-${id}" style="width:${pct}%"></div></div>
        </div>
        <button class="btn ${on ? "btn-primary" : ""}" type="button" data-skill-train="${id}">
          ${on ? "修炼中" : "挂机此技能"}
        </button>
      </div>`;
  }
  return `
    <section class="panel train-panel">
      <div class="panel-title-art-row">
        <img class="panel-title-art-icon" src="${UI_HEAD_TRAIN}" alt="" width="28" height="28" loading="lazy" />
        <h2>修炼</h2>
      </div>
      <p class="hint">一次只能修炼一项技能。</p>
      <div class="train-active-banner ${activeLabel ? "" : "train-paused"}" id="train-active-banner">
        ${
          activeLabel
            ? `<span class="train-pulse"></span><span>当前修炼：<strong>${activeLabel}</strong></span>
               <span class="train-banner-meta">+<strong id="train-banner-rate">${activeRate.toFixed(1)}</strong> 经验/秒</span>
               <span class="train-banner-meta">距升级 <strong id="train-banner-eta">${fmtEta(activeEta)}</strong></span>`
            : `<span>当前未修炼：点击下方技能开始</span>`
        }
      </div>
      <div class="skill-list">${rows}</div>
      <button class="btn" type="button" id="btn-skill-none" ${state.activeSkillId === null ? "disabled" : ""}>暂停修炼</button>
      <h3 class="sub-h">心法</h3>
      <p class="hint">消耗唤灵髓随机获得或升级心法，同名最高 Lv.20。</p>
      <div class="battle-skill-catalog" aria-label="心法说明">
        ${BATTLE_SKILLS.map((def) => {
          const lv = state.battleSkills[def.id] ?? 0;
          const numParts: string[] = [];
          if (def.dungeonAtkBonusPerLevel > 0) {
            numParts.push(`战斗攻击（面板） <strong>+${(def.dungeonAtkBonusPerLevel * 100).toFixed(2)}%</strong>/级`);
          }
          if (def.stoneIncomeBonusPerLevel > 0) {
            numParts.push(`灵石 <strong>+${(def.stoneIncomeBonusPerLevel * 100).toFixed(3)}%</strong>/级`);
          }
          if (def.dungeonEssenceBonusPerLevel > 0) {
            numParts.push(`唤灵髓投放 <strong>+${(def.dungeonEssenceBonusPerLevel * 100).toFixed(2)}%</strong>/级`);
          }
          if (def.critChancePerLevel > 0) {
            numParts.push(`暴击率 <strong>+${(def.critChancePerLevel * 100).toFixed(2)}%</strong>/级`);
          }
          if (def.critMultPerLevel > 0) {
            numParts.push(`暴伤倍率 <strong>+${(def.critMultPerLevel * 100).toFixed(2)}%</strong>/级`);
          }
          if (def.dungeonMoveSpeedPerLevel > 0) {
            numParts.push(`移动（面板预留） <strong>+${(def.dungeonMoveSpeedPerLevel * 100).toFixed(2)}%</strong>/级`);
          }
          const nums = numParts.length > 0 ? numParts.join(" · ") : "无数值加成";
          return `<div class="battle-skill-card">
            <div class="battle-skill-card-head">
              <strong>${def.name}</strong>
              <span class="battle-skill-lv">${lv > 0 ? `已领悟 Lv.${lv}` : "未领悟"}</span>
            </div>
            <p class="hint battle-skill-desc">${def.desc}</p>
            <p class="battle-skill-nums">${nums}</p>
          </div>`;
        }).join("")}
      </div>
      <p class="inv-meta" id="battle-skills-readout">当前：${describeBattleSkillLevels(state)}</p>
      <button class="btn btn-primary" type="button" id="btn-pull-battle-skill" ${state.summonEssence >= battleSkillPullCost() ? "" : "disabled"}>领悟心法（${battleSkillPullCost()} 唤灵髓）</button>
    </section>`;
}

export function renderGearPanel(
  state: GameState,
  refineTargetId: string | null = null,
  gearDetailSlot: "weapon" | "body" | "ring" | null = null,
): string {
  const refineHint = refineTargetId
    ? `<p class="hint refine-hint">精炼：已选主件，再点<strong>另一件</strong>同基底天极作为消耗；再点主件可取消。</p>`
    : "";
  const rarityOrder: Record<string, number> = { UR: 0, SSR: 1, SR: 2, R: 3, N: 4 };
  const items = Object.values(state.gearInventory).sort((a, b) => {
    const dr = (rarityOrder[a.rarity] ?? 9) - (rarityOrder[b.rarity] ?? 9);
    if (dr !== 0) return dr;
    return a.displayName.localeCompare(b.displayName, "zh-Hans-CN");
  });
  let inv = "";
  for (const g of items) {
    const eq =
      state.equippedGear.weapon === g.instanceId ||
      state.equippedGear.body === g.instanceId ||
      state.equippedGear.ring === g.instanceId;
    const pre = g.prefixes.map((x) => `<span class="affix">${x.text}</span>`).join("");
    const suf = g.suffixes.map((x) => `<span class="affix">${x.text}</span>`).join("");
    const picked = refineTargetId === g.instanceId;
    const refineBtn =
      g.rarity === "UR"
        ? `<button class="btn ${picked ? "btn-primary" : ""}" type="button" data-gear-refine="${g.instanceId}">${picked ? "取消精炼" : "精炼"}</button>`
        : "";
    const xt = xuanTieEnhanceCost(g.enhanceLevel);
    inv += `
      <div class="gear-row ${eq ? "equipped" : ""} ${picked ? "refine-picked" : ""}">
        <div class="gear-row-visual">
          <div class="gear-icon-wrap rarity-${g.rarity}">
            <img src="${GEAR_SLOT_ICON[g.slot]}" alt="" width="32" height="32" loading="lazy" class="gear-slot-icon" />
          </div>
          <div>
          <strong class="rarity-${g.rarity}">${g.displayName}</strong> · ${rarityZh(g.rarity)} · ilvl ${g.itemLevel}
          <p class="inv-meta">强化 ${g.enhanceLevel}${g.rarity === "UR" ? ` · 精炼 ${g.refineLevel}` : ""}</p>
          <div class="affix-block">${pre}${suf}</div>
          </div>
        </div>
        <div class="gear-actions">
          <button class="btn btn-primary" type="button" data-gear-equip="${g.instanceId}" ${eq ? "disabled" : ""}>装备</button>
          <button class="btn" type="button" data-gear-enhance="${g.instanceId}">强化（${xt} 玄铁）</button>
          <button class="btn" type="button" data-gear-salvage="${g.instanceId}" ${eq ? "disabled" : ""}>分解</button>
          ${refineBtn}
        </div>
      </div>`;
  }
  const slotLabel: Record<"weapon" | "body" | "ring", string> = {
    weapon: "武器",
    body: "衣甲",
    ring: "指环",
  };
  const slots = ["weapon", "body", "ring"] as const;
  let slotHtml = "";
  for (const s of slots) {
    const id = state.equippedGear[s];
    const g = id ? state.gearInventory[id] : null;
    const open = gearDetailSlot === s;
    slotHtml += `<div class="gear-slot-line">
      <button type="button" class="gear-slot-summary ${open ? "is-open" : ""}" data-gear-open-slot="${s}">
        <span class="gear-slot-summary-label">${slotLabel[s]}</span>
        <span class="gear-slot-summary-name">${g ? g.displayName : "（空）"}</span>
        <span class="inv-meta gear-slot-summary-hint">${open ? "收起" : "详情 · 卸下 / 强化"}</span>
      </button>
    </div>`;
  }
  let detailBlock = "";
  if (gearDetailSlot) {
    const s = gearDetailSlot;
    const id = state.equippedGear[s];
    const g = id ? state.gearInventory[id] : null;
    if (!g) {
      detailBlock = `<div class="gear-equipped-detail" id="gear-equipped-detail">
        <p class="hint">${slotLabel[s]}栏位为空。可在下方背包点击「装备」上阵。</p>
        <button type="button" class="btn" id="btn-gear-detail-close">关闭</button>
      </div>`;
    } else {
      const pre = g.prefixes.map((x) => `<span class="affix">${x.text}</span>`).join("");
      const suf = g.suffixes.map((x) => `<span class="affix">${x.text}</span>`).join("");
      const xt = xuanTieEnhanceCost(g.enhanceLevel);
      const picked = refineTargetId === g.instanceId;
      const refineBtn =
        g.rarity === "UR"
          ? `<button class="btn ${picked ? "btn-primary" : ""}" type="button" data-gear-refine="${g.instanceId}">${picked ? "取消精炼" : "精炼"}</button>`
          : "";
      detailBlock = `<div class="gear-equipped-detail" id="gear-equipped-detail">
        <div class="gear-equipped-detail-head">
          <div class="gear-icon-wrap rarity-${g.rarity}">
            <img src="${GEAR_SLOT_ICON[g.slot]}" alt="" width="40" height="40" loading="lazy" class="gear-slot-icon" />
          </div>
          <div>
            <strong class="rarity-${g.rarity}">${g.displayName}</strong> · ${rarityZh(g.rarity)} · ilvl ${g.itemLevel}
            <p class="inv-meta">已装备于 ${slotLabel[s]} · 强化 ${g.enhanceLevel}${g.rarity === "UR" ? ` · 精炼 ${g.refineLevel}` : ""}</p>
          </div>
        </div>
        <div class="affix-block">${pre}${suf}</div>
        <div class="gear-equipped-detail-actions">
          <button class="btn btn-danger" type="button" data-gear-unequip-detail="${s}">卸下</button>
          <button class="btn btn-primary" type="button" data-gear-enhance="${g.instanceId}">强化（${xt} 玄铁）</button>
          ${refineBtn}
          <button type="button" class="btn" id="btn-gear-detail-close">关闭</button>
        </div>
      </div>`;
    }
  }
  return `
    <section class="panel" id="gear-panel-root">
      <div class="panel-title-art-row">
        <img class="panel-title-art-icon" src="${UI_HEAD_GEAR}" alt="" width="28" height="28" loading="lazy" />
        <h2>装备</h2>
      </div>
      <p class="hint">装备来自抽卡的铸灵池。强化消耗玄铁（分解装备获得）；天极可精炼。</p>
      <p class="hint">点武器/衣甲/指环查看详情，可卸下或强化。背包中的未装备件也能强化。</p>
      ${refineHint}
      <h3 class="sub-h">已装备</h3>
      ${slotHtml}
      ${detailBlock}
      <h3 class="sub-h">背包</h3>
      <div class="gear-inv">${inv || `<div class="empty-art-wrap"><img src="${UI_EMPTY_GEAR}" alt="暂无装备" class="empty-art-img" width="320" height="160" loading="lazy" /></div>`}</div>
    </section>`;
}

export function renderPetPanel(state: GameState): string {
  if (!petSystemUnlocked(state)) {
    return `
    <section class="panel pet-panel">
      <div class="panel-title-art-row">
        <img class="panel-title-art-icon" src="${UI_HEAD_PET}" alt="" width="28" height="28" loading="lazy" />
        <h2>灵宠</h2>
      </div>
      <p class="hint">境界 ≥ <strong>${PET_SYSTEM_UNLOCK_REALM}</strong> 或累计唤引 ≥ <strong>${PET_SYSTEM_UNLOCK_PULLS}</strong> 次后开放唤灵池；灵宠全局生效。当前境界 <strong>${state.realmLevel}</strong>，累计唤引 <strong>${state.totalPulls}</strong> 次。</p>
      <div class="empty-art-wrap"><img src="${UI_EMPTY_UNLOCK}" alt="未解锁灵宠" class="empty-art-img" width="320" height="160" loading="lazy" /></div>
    </section>`;
  }

  const canPull = state.summonEssence >= PET_PULL_COST;
  const bonusLine = describePetBonusesSummary(state);
  const defsSorted = [...PET_DEFS].sort(
    (a, b) => PET_RARITY_ORDER_DESC.indexOf(a.rarity) - PET_RARITY_ORDER_DESC.indexOf(b.rarity),
  );
  let cards = "";
  for (const def of defsSorted) {
    const p = state.pets[def.id];
    if (p) {
      const maxed = p.level >= MAX_PET_LEVEL;
      const need = maxed ? 0 : xpToNextPetLevel(p.level);
      const pct = maxed || need <= 0 ? 100 : Math.min(100, (100 * p.xp) / need);
      cards += `<div class="pet-card pet-card-owned">
      <div class="pet-card-portrait"><img src="${PET_PORTRAIT[def.id]}" alt="" width="72" height="72" loading="lazy" /></div>
      <div class="pet-card-body">
        <strong class="pet-card-name rarity-${def.rarity}">${def.name}</strong>
        <span class="pet-card-tag">${rarityZh(def.rarity)} · ${def.tag}</span>
        <p class="pet-card-flavor">${def.flavor}</p>
        <p class="inv-meta">等级 ${p.level}${maxed ? "（已满）" : ""} · 加成：${
          def.bonusKind === "stone"
            ? "灵石汇流（叠乘）"
            : def.bonusKind === "dungeon_atk"
              ? "战斗攻（加算）"
              : def.bonusKind === "essence_find"
                ? "唤灵髓（叠乘）"
                : "三项综合"
        }</p>
        <p class="inv-meta pet-bonus-num">本等级单宠：${petBonusPreviewLine(def, p.level)}</p>
        ${
          maxed
            ? `<div class="pet-xp-bar pet-xp-bar-maxed" aria-hidden="true"><span class="pet-xp-fill" style="width:100%"></span></div>`
            : `<div class="pet-xp-bar" title="灵契经验（重复邂逅增加）"><span class="pet-xp-fill" style="width:${pct}%"></span></div>
               <p class="inv-meta pet-xp-label">${p.xp} / ${need} 灵契</p>`
        }
      </div>
    </div>`;
    } else {
      cards += `<div class="pet-card pet-card-locked">
      <div class="pet-card-portrait pet-card-portrait-dim"><img src="${PET_PORTRAIT[def.id]}" alt="" width="72" height="72" loading="lazy" /></div>
      <div class="pet-card-body">
        <strong class="pet-card-name rarity-${def.rarity}">${def.name}</strong>
        <span class="pet-card-tag">${rarityZh(def.rarity)} · 未结缘</span>
        <p class="pet-card-flavor">${def.flavor}</p>
        <p class="inv-meta">唤灵池邂逅后解锁；未结缘则<strong>无</strong>此项加成。</p>
        <p class="inv-meta pet-bonus-num">预览（Lv.1）：${petBonusPreviewLine(def, 1)}</p>
      </div>
    </div>`;
    }
  }

  return `
    <section class="panel pet-panel">
      <div class="panel-title-art-row">
        <img class="panel-title-art-icon" src="${UI_HEAD_PET}" alt="" width="28" height="28" loading="lazy" />
        <h2>灵宠 · 唤灵池</h2>
      </div>
      <p class="hint">消耗唤灵髓抽取灵宠。已拥有灵宠的加成全局生效，轮回不重置。</p>
      <div class="pet-pool-row">
        <button class="btn btn-primary" type="button" id="btn-pet-pull" ${canPull ? "" : "disabled"}>
          唤灵（${PET_PULL_COST} <img class="btn-inline-ico" src="${UI_ESSENCE}" alt="" width="14" height="14" />）
        </button>
        <span class="inv-meta pet-pull-meta">累计唤灵 <strong>${state.petPullsTotal}</strong> 次 · 持有唤灵髓 <strong>${Math.floor(state.summonEssence)}</strong></span>
      </div>
      <p class="hint sm">大致概率：凡 38% · 灵 26% · 珍 20% · 绝 12% · 天 4%。重复会增加灵契经验。</p>
      <p class="pet-active-summary">当前全局加成：<strong>${bonusLine}</strong></p>
      ${cards ? `<div class="pet-grid">${cards}</div>` : `<div class="empty-art-wrap"><img src="${UI_EMPTY_PET}" alt="暂无灵宠" class="empty-art-img" width="320" height="160" loading="lazy" /></div>`}
    </section>`;
}
