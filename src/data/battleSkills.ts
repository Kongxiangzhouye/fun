/** 心法：抽选养成，效果在副本/挂机中叠加 */

export interface BattleSkillDef {
  id: string;
  name: string;
  desc: string;
  /** 幻域内攻击乘区（加算，按等级 * 此值） */
  dungeonAtkBonusPerLevel: number;
  /** 灵石全局乘区（加算） */
  stoneIncomeBonusPerLevel: number;
  /** 幻域唤灵髓掉落（加算乘区，与 essence_find 等叠乘） */
  dungeonEssenceBonusPerLevel: number;
  /** 暴击率：每级 + 绝对值（如 0.002 = +0.2%） */
  critChancePerLevel: number;
  /** 暴伤：每级加在倍率上（如 0.01 = 倍率 +0.01） */
  critMultPerLevel: number;
  /** 幻域内移动速度：每级加算比例（如 0.01 = +1%） */
  dungeonMoveSpeedPerLevel: number;
  /** 幻域护体：每级 + 固定护体值（与装备、灵脉等叠加以减免受击） */
  defenseFlatPerLevel: number;
}

export const BATTLE_SKILLS: BattleSkillDef[] = [
  {
    id: "blade_sutra",
    name: "剑诀残章",
    desc: "偏幻域：每层境界加算幻域内最终攻击，与战艺、装备等乘区叠加。",
    dungeonAtkBonusPerLevel: 0.012,
    stoneIncomeBonusPerLevel: 0,
    dungeonEssenceBonusPerLevel: 0,
    critChancePerLevel: 0,
    critMultPerLevel: 0,
    dungeonMoveSpeedPerLevel: 0,
    defenseFlatPerLevel: 0,
  },
  {
    id: "gathering_mind",
    name: "采灵心印",
    desc: "偏挂机：每层境界加算灵脉灵石产出效率（与境界、洞府等叠加）。",
    dungeonAtkBonusPerLevel: 0,
    stoneIncomeBonusPerLevel: 0.004,
    dungeonEssenceBonusPerLevel: 0,
    critChancePerLevel: 0,
    critMultPerLevel: 0,
    dungeonMoveSpeedPerLevel: 0,
    defenseFlatPerLevel: 0,
  },
  {
    id: "void_step",
    name: "虚空步",
    desc: "均衡：同时小幅提升幻域攻击与灵石效率。",
    dungeonAtkBonusPerLevel: 0.007,
    stoneIncomeBonusPerLevel: 0.002,
    dungeonEssenceBonusPerLevel: 0,
    critChancePerLevel: 0,
    critMultPerLevel: 0,
    dungeonMoveSpeedPerLevel: 0,
    defenseFlatPerLevel: 0,
  },
  {
    id: "beast_tide",
    name: "兽潮经",
    desc: "偏幻域：单层加算较高，专精副本输出。",
    dungeonAtkBonusPerLevel: 0.018,
    stoneIncomeBonusPerLevel: 0,
    dungeonEssenceBonusPerLevel: 0,
    critChancePerLevel: 0,
    critMultPerLevel: 0,
    dungeonMoveSpeedPerLevel: 0,
    defenseFlatPerLevel: 0,
  },
  {
    id: "marrow_pull",
    name: "髓引诀",
    desc: "偏幻域：提升唤灵髓「投放」效率（与装备噬髓、境界等乘区叠加）。",
    dungeonAtkBonusPerLevel: 0,
    stoneIncomeBonusPerLevel: 0,
    dungeonEssenceBonusPerLevel: 0.007,
    critChancePerLevel: 0,
    critMultPerLevel: 0,
    dungeonMoveSpeedPerLevel: 0,
    defenseFlatPerLevel: 0,
  },
  {
    id: "keen_eye",
    name: "锐目心印",
    desc: "提升暴击率，副本伤害按期望暴击结算。",
    dungeonAtkBonusPerLevel: 0,
    stoneIncomeBonusPerLevel: 0,
    dungeonEssenceBonusPerLevel: 0,
    critChancePerLevel: 0.0025,
    critMultPerLevel: 0,
    dungeonMoveSpeedPerLevel: 0,
    defenseFlatPerLevel: 0,
  },
  {
    id: "shattering_force",
    name: "崩山劲",
    desc: "提升暴击伤害倍率。",
    dungeonAtkBonusPerLevel: 0,
    stoneIncomeBonusPerLevel: 0,
    dungeonEssenceBonusPerLevel: 0,
    critChancePerLevel: 0,
    critMultPerLevel: 0.014,
    dungeonMoveSpeedPerLevel: 0,
    defenseFlatPerLevel: 0,
  },
  {
    id: "wind_ride",
    name: "御风行",
    desc: "幻域内身法更快，便于接战与走位。",
    dungeonAtkBonusPerLevel: 0,
    stoneIncomeBonusPerLevel: 0,
    dungeonEssenceBonusPerLevel: 0,
    critChancePerLevel: 0,
    critMultPerLevel: 0,
    dungeonMoveSpeedPerLevel: 0.014,
    defenseFlatPerLevel: 0,
  },
  {
    id: "iron_carapace",
    name: "玄甲篇",
    desc: "偏幻域：每层心法境界加算护体值，与装备、洞府固元、灵脉厚土等叠加。",
    dungeonAtkBonusPerLevel: 0,
    stoneIncomeBonusPerLevel: 0,
    dungeonEssenceBonusPerLevel: 0,
    critChancePerLevel: 0,
    critMultPerLevel: 0,
    dungeonMoveSpeedPerLevel: 0,
    defenseFlatPerLevel: 2.6,
  },
];

export function getBattleSkill(id: string): BattleSkillDef | undefined {
  return BATTLE_SKILLS.find((s) => s.id === id);
}
