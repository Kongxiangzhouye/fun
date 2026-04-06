/**
 * 天机匣：每周每档限购 1 次，与 `currentWeekKey` 同步刷新。
 */
export interface CelestialOfferDef {
  id: string;
  title: string;
  desc: string;
  costStones?: number;
  costLingSha?: number;
  costXuanTie?: number;
  costEssence?: number;
  rewardStones?: number;
  rewardEssence?: number;
  rewardDao?: number;
  /** 最低境界，未达时条目灰显 */
  minRealm?: number;
}

export const CELESTIAL_OFFERS: CelestialOfferDef[] = [
  {
    id: "cs_stone_ess",
    title: "灵石换髓",
    desc: "以积存灵石换取唤灵髓。",
    costStones: 420,
    rewardEssence: 6,
  },
  {
    id: "cs_ling_stone",
    title: "砂引灵流",
    desc: "灵砂兑为灵石。",
    costLingSha: 36,
    rewardStones: 200,
  },
  {
    id: "cs_xuan_ess",
    title: "铁髓互易",
    desc: "玄铁换唤灵髓。",
    costXuanTie: 24,
    rewardEssence: 9,
  },
  {
    id: "cs_dao_scroll",
    title: "道韵残卷",
    desc: "灵石与髓共换道韵，利于灵窍。",
    costStones: 580,
    costEssence: 12,
    rewardDao: 5,
    minRealm: 10,
  },
];
