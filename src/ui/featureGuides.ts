import type { GameState } from "../types";
import { getUiUnlocks } from "../uiUnlocks";

type UiUnlocks = ReturnType<typeof getUiUnlocks>;

export type FeatureGuideId =
  | "dungeon"
  | "train"
  | "gear"
  | "vein"
  | "codex"
  | "meta"
  | "ach"
  | "gacha_ten"
  | "footer";

const ORDER: FeatureGuideId[] = [
  "dungeon",
  "train",
  "gear",
  "vein",
  "codex",
  "meta",
  "ach",
  "gacha_ten",
  "footer",
];

const COPY: Record<
  FeatureGuideId,
  { title: string; body: string; tabHint: string }
> = {
  dungeon: {
    title: "幻域已解锁",
    body: "在「<strong>幻域</strong>」刷怪获取唤灵髓；无入场费，阵亡无灵石损失。回满生命后可再次进本；可勾选自动进本。详细规则见「<strong>养成 → 图鉴·札记</strong>」。",
    tabHint: "入口：底部「幻域」。",
  },
  train: {
    title: "修炼已解锁",
    body: "在「<strong>修炼</strong>」里挂机提升技能。一次只能修炼一项。",
    tabHint: "入口：底部「养成 → 修炼·挂机」。",
  },
  gear: {
    title: "装备已解锁",
    body: "装备管理在「<strong>角色 → 行囊·装备</strong>」。装备来源在「<strong>抽卡 → 境界铸灵</strong>」（稀有度与装等随铸灵阶成长）。可强化，天极可精炼。",
    tabHint: "入口：角色看装备，抽卡拿装备。",
  },
  vein: {
    title: "洞府已解锁",
    body: "「<strong>灵府 → 洞府·养成</strong>」提供长期增益，轮回不重置。",
    tabHint: "入口：底部「灵府 → 洞府·养成」。",
  },
  codex: {
    title: "图鉴已解锁",
    body: "图鉴记录卡牌进度；「修行札记」里有机制说明。",
    tabHint: "入口：底部「养成 → 图鉴·札记」。",
  },
  meta: {
    title: "轮回已解锁",
    body: "在「<strong>养成 → 轮回·元印</strong>」进行轮回，获取道韵并升级元印。",
    tabHint: "入口：底部「养成 → 轮回·元印」。",
  },
  ach: {
    title: "功业已解锁",
    body: "这里查看成就进度与奖励。",
    tabHint: "入口：底部「养成 → 功业·奖励」。",
  },
  gacha_ten: {
    title: "十连已解锁",
    body: "抽卡页可直接十连。",
    tabHint: "入口：底部「抽卡」。",
  },
  footer: {
    title: "存档工具已解锁",
    body: "在「<strong>角色</strong>」页最下方可保存到本机、导出与导入存档。",
    tabHint: "入口：底部「角色」，拉到页底。",
  },
};

/** 若玩家早已使用过该功能，则不再弹引导（与是否「刚解锁」无关） */
export function guideAlreadyExperienced(state: GameState, id: FeatureGuideId): boolean {
  switch (id) {
    case "dungeon":
      return state.dungeon.totalWavesCleared > 0;
    case "train":
      return (
        state.skills.combat.level > 1 ||
        state.skills.gathering.level > 1 ||
        state.skills.arcana.level > 1 ||
        state.skills.combat.xp > 0 ||
        state.skills.gathering.xp > 0 ||
        state.skills.arcana.xp > 0
      );
    case "gear":
      return Object.keys(state.gearInventory).length > 0;
    case "vein":
      return state.vein.huiLing + state.vein.guYuan + state.vein.lingXi + state.vein.gongMing > 0;
    case "codex":
      return state.totalPulls >= 5;
    case "meta":
      return state.reincarnations >= 1;
    case "ach":
      return state.achievementsDone.size > 0;
    case "gacha_ten":
      return state.totalPulls >= 10 || state.qoL.tenPull;
    case "footer":
      return false;
    default:
      return false;
  }
}

function unlocked(id: FeatureGuideId, u: ReturnType<typeof getUiUnlocks>): boolean {
  switch (id) {
    case "dungeon":
      return u.tabDungeon;
    case "train":
      return u.tabTrain;
    case "gear":
      return u.tabGear;
    case "vein":
      return u.tabVein;
    case "codex":
      return u.tabCodex;
    case "meta":
      return u.tabMeta;
    case "ach":
      return u.tabAch;
    case "gacha_ten":
      return u.gachaTenUnlocked;
    case "footer":
      return u.footerTools;
    default:
      return false;
  }
}

/** 返回下一个待展示的功能说明 id；无则 null */
export function nextPendingFeatureGuide(state: GameState, u: ReturnType<typeof getUiUnlocks>): FeatureGuideId | null {
  if (state.suppressFeatureGuides) return null;
  const dismissed = new Set(state.featureGuideDismissed);
  for (const id of ORDER) {
    if (dismissed.has(id)) continue;
    if (!unlocked(id, u)) continue;
    if (guideAlreadyExperienced(state, id)) continue;
    return id;
  }
  return null;
}

/** 角色页 · 功能预览：内嵌面板（不再全屏遮罩） */
export function featureGuidePanelHtml(state: GameState, u: UiUnlocks): string {
  const pending = nextPendingFeatureGuide(state, u);
  if (!pending) {
    return `
    <section class="panel feature-guide-page">
      <h2>功能预览</h2>
      <p class="hint">当前没有新功能说明。后续解锁新内容时会在这里提示。</p>
    </section>`;
  }
  const c = COPY[pending];
  return `
    <section class="panel feature-guide-page">
      <h2>功能预览</h2>
      <p class="hint">这是当前待确认的新功能提示，确认后不再重复显示。</p>
      <div id="feature-guide-panel" data-guide-id="${pending}">
        <div class="feature-guide-card feature-guide-card--inline">
          <p class="feature-guide-kicker">新功能</p>
          <h3 class="feature-guide-title">${c.title}</h3>
          <p class="feature-guide-body">${c.body}</p>
          <p class="feature-guide-tabhint">${c.tabHint}</p>
          <div class="feature-guide-actions">
            <button type="button" class="btn btn-primary" id="btn-feature-guide-ok">知道了</button>
            <button type="button" class="btn" id="btn-feature-guide-skip-once">跳过</button>
          </div>
          <label class="feature-guide-optout">
            <input type="checkbox" id="chk-feature-guide-never" />
            不再显示此类新功能说明（仍可正常游戏）
          </label>
        </div>
      </div>
    </section>`;
}
