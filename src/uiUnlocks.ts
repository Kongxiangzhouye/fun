import type { GameState } from "./types";

/** 界面逐步解锁（无新存档字段，由进度推导） */
export function getUiUnlocks(state: GameState): {
  /** 欢迎弹窗（步骤 1）期间不展示，避免与引导抢注意力 */
  tabDungeon: boolean;
  /** 打过副本波次或境界/唤引达一定进度 */
  tabTrain: boolean;
  /** 获得过装备或唤引较多 */
  tabGear: boolean;
  /** 首次唤引后再开放十连，减轻开局信息量 */
  gachaTenUnlocked: boolean;
  tabVein: boolean;
  /** 灵府·灵田：境界与唤引达一定进度 */
  tabGarden: boolean;
  tabCodex: boolean;
  tabMeta: boolean;
  tabAch: boolean;
  /** 幻域累计通关 ≥15 波 */
  tabPets: boolean;
  topTide: boolean;
  statDao: boolean;
  statZao: boolean;
  privilegePanel: boolean;
  biGuan: boolean;
  gachaResonance: boolean;
  gachaRates: boolean;
  footerTools: boolean;
} {
  const pulls = state.totalPulls;
  const rl = state.realmLevel;
  const inVeinTutorial = state.tutorialStep >= 6 && state.tutorialStep <= 7;
  const tutDone = state.tutorialStep === 0;
  const gearCount = Object.keys(state.gearInventory).length;
  /** 幻域：启程礼后仍先引导聚灵阵唤引，首次唤引后再开刷髓副本（老存档 tutorialStep===0 直接开放） */
  const dungeonUnlocked =
    state.tutorialStep !== 1 &&
    (state.tutorialStep === 0 ||
      state.totalPulls >= 1 ||
      state.realmLevel >= 2 ||
      state.dungeon.totalWavesCleared >= 1);

  return {
    tabDungeon: dungeonUnlocked,
    tabTrain: rl >= 3 || state.dungeon.totalWavesCleared >= 1 || pulls >= 6,
    tabGear: gearCount >= 1 || pulls >= 10,
    gachaTenUnlocked: pulls >= 1 || rl >= 3 || state.qoL.tenPull,
    /** 首次唤引或破境二重即可见；引导步骤 6–7 也必须可见（勿依赖 tutorialStep===0） */
    tabVein: inVeinTutorial || pulls >= 1 || rl >= 2,
    tabGarden: pulls >= 1 && rl >= 4,
    tabCodex: pulls >= 5 || rl >= 4,
    tabMeta: rl >= 18 || state.reincarnations >= 1,
    tabAch: rl >= 6 || pulls >= 15,
    tabPets: state.dungeon.totalWavesCleared >= 15,
    topTide: tutDone,
    statDao: state.reincarnations >= 1 || state.daoEssence > 0 || rl >= 20,
    statZao: state.zaoHuaYu > 0 || rl >= 24 || state.trueEndingSeen,
    privilegePanel: rl >= 8 || state.zaoHuaYu > 0,
    biGuan: rl >= 6,
    gachaResonance: pulls >= 2,
    gachaRates: pulls >= 4,
    footerTools: true,
  };
}
