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
    title: "幻域已开",
    body: "「<strong>幻域</strong>」刷怪得唤灵髓；阵亡后在灵息之地回满后，可<strong>勾选自动进本</strong>或手动进入该关（付入场髓），每次进关重新随机地图与魔物。细则见<strong>万象图鉴 → 修行札记</strong>。",
    tabHint: "解锁后点底部「幻域」进入副本。",
  },
  train: {
    title: "修炼之道",
    body: "「<strong>修炼</strong>」挂机三技能，同时只能修一项：战艺副本、采灵灵石、法篆共鸣。",
    tabHint: "底部「养成 → 修炼」。",
  },
  gear: {
    title: "装备构筑",
    body: "「<strong>装备</strong>」在「角色 → 行囊」；<strong>抽卡</strong>页铸灵池产装。前缀后缀、强化；天极可精炼。",
    tabHint: "底部「角色 → 行囊」；抽卡选铸灵池。",
  },
  vein: {
    title: "洞府蕴灵",
    body: "「<strong>洞府</strong>」与灵卡并行，<strong>轮回不重置</strong>。",
    tabHint: "底部「灵府 → 洞府」。",
  },
  codex: {
    title: "万象图鉴",
    body: "「<strong>万象图鉴</strong>」收录邂逅与<strong>修行札记</strong>（机制长文）。",
    tabHint: "底部「养成 → 图鉴」。",
  },
  meta: {
    title: "轮回阁",
    body: "「<strong>轮回阁</strong>」轮回换道韵，强化元印记。",
    tabHint: "底部「养成 → 轮回」。",
  },
  ach: {
    title: "功业录",
    body: "「<strong>功业录</strong>」成就与奖励一览。",
    tabHint: "底部「养成 → 功业」。",
  },
  gacha_ten: {
    title: "十连开放",
    body: "已解锁<strong>十连唤引</strong>：聚灵阵批量邂逅灵卡。",
    tabHint: "底部「抽卡」页十连按钮。",
  },
  footer: {
    title: "灵识封存",
    body: "「<strong>养成 → 轮回</strong>」页底<strong>封存 / 拓印 / 迎回</strong>密文，便于换机与备份。",
    tabHint: "底部「养成」→「轮回」。",
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
      return state.reincarnations >= 1 || state.realmLevel >= 18;
    case "ach":
      return state.achievementsDone.size > 0;
    case "gacha_ten":
      return state.totalPulls >= 1 || state.realmLevel >= 3 || state.qoL.tenPull;
    case "footer":
      return state.realmLevel >= 12 || state.reincarnations >= 1;
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
      <p class="hint">当前没有待读的新功能说明。解锁新区域后，若你尚未「体验过」对应玩法，会在此出现一条说明。</p>
    </section>`;
  }
  const c = COPY[pending];
  return `
    <section class="panel feature-guide-page">
      <h2>功能预览</h2>
      <p class="hint">以下为待确认的一项说明；确认后本条不再出现。</p>
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
