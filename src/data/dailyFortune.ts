/**
 * 心斋卦象：每日一条，与存档种子共同决定当日条目（同日同档不变）。
 */
export interface DailyFortuneDef {
  id: string;
  title: string;
  desc: string;
  /** 灵石每秒乘区 */
  stoneMult: number;
  /** 幻域期望秒伤乘区（与词缀、灵窍等叠乘） */
  dungeonMult: number;
}

export const DAILY_FORTUNES: DailyFortuneDef[] = [
  {
    id: "fd_he",
    title: "和光同尘",
    desc: "柔光敛锋，灵息绵长。",
    stoneMult: 1.065,
    dungeonMult: 1,
  },
  {
    id: "fd_lei",
    title: "雷动九天",
    desc: "势如奔雷，幻域更易破敌。",
    stoneMult: 1.025,
    dungeonMult: 1.08,
  },
  {
    id: "fd_song",
    title: "松风徐来",
    desc: "清风入府，灵石汇聚更盛。",
    stoneMult: 1.085,
    dungeonMult: 1.035,
  },
  {
    id: "fd_meng",
    title: "梦笔生花",
    desc: "意象流转，战阵与资粮两宜。",
    stoneMult: 1.045,
    dungeonMult: 1.065,
  },
  {
    id: "fd_xu",
    title: "虚怀若谷",
    desc: "守中致和，进境平稳。",
    stoneMult: 1.055,
    dungeonMult: 1.055,
  },
  {
    id: "fd_chao",
    title: "潮涌星渊",
    desc: "渊回潮生，资粮与战意同涨。",
    stoneMult: 1.072,
    dungeonMult: 1.062,
  },
];
