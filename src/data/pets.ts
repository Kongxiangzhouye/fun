import type { PetId, Rarity } from "../types";

export type PetBonusKind = "stone" | "dungeon_atk" | "dungeon_def" | "essence_find" | "all";

/** 稀有度强度系数（叠在 √等级 上；SR=1 为基准） */
export const PET_RARITY_POWER: Record<Rarity, number> = {
  N: 0.38,
  R: 0.62,
  SR: 1,
  SSR: 1.22,
  UR: 1.55,
};

export interface PetDef {
  id: PetId;
  name: string;
  rarity: Rarity;
  /** 个体强度微调（1 为模板值） */
  power: number;
  tag: string;
  flavor: string;
  bonusKind: PetBonusKind;
  /** 「all」时三项各占比例；否则忽略 */
  allSplit: number;
  artFile: string;
}

/** 唤灵池：邂逅后再喂养升级；未邂逅则无加成 */
export const PET_DEFS: PetDef[] = [
  {
    id: "yuling",
    name: "玉鳞鲤",
    rarity: "N",
    power: 0.95,
    tag: "凡尘灵种",
    flavor: "池中游鳞，微引灵息入脉。",
    bonusKind: "stone",
    allSplit: 0,
    artFile: "pet-yuling.svg",
  },
  {
    id: "zijing",
    name: "紫睛蟾",
    rarity: "N",
    power: 0.95,
    tag: "凡尘灵种",
    flavor: "踞石而鸣，幻域中略稳剑势。",
    bonusKind: "dungeon_atk",
    allSplit: 0,
    artFile: "pet-zijing.svg",
  },
  {
    id: "chiyan",
    name: "赤焰貂",
    rarity: "R",
    power: 1,
    tag: "灵焰噬髓",
    flavor: "尾带火星，髓光稍易析出。",
    bonusKind: "essence_find",
    allSplit: 0,
    artFile: "pet-chiyan.svg",
  },
  {
    id: "qingluan",
    name: "青鸾",
    rarity: "SR",
    power: 1,
    tag: "灵脉相随",
    flavor: "衔灵息而行，增洞府汇流之灵石。",
    bonusKind: "stone",
    allSplit: 0,
    artFile: "pet-qingluan.svg",
  },
  {
    id: "xuangui",
    name: "玄龟",
    rarity: "SR",
    power: 1,
    tag: "镇域护法",
    flavor: "壳映玄纹，于幻域中加厚护体、减轻受击。",
    bonusKind: "dungeon_def",
    allSplit: 0,
    artFile: "pet-xuangui.svg",
  },
  {
    id: "linghu",
    name: "灵狐",
    rarity: "SSR",
    power: 1.05,
    tag: "噬髓通灵",
    flavor: "尾扫髓光，唤灵髓更易析出。",
    bonusKind: "essence_find",
    allSplit: 0,
    artFile: "pet-linghu.svg",
  },
  {
    id: "qilin",
    name: "瑞麟",
    rarity: "UR",
    power: 1,
    tag: "万象瑞兽",
    flavor: "踏云而至，灵石、剑意、髓光皆沾其泽。",
    bonusKind: "all",
    allSplit: 0.38,
    artFile: "pet-qilin.svg",
  },
];

export const ALL_PET_IDS: PetId[] = PET_DEFS.map((p) => p.id);

const defById: Record<string, PetDef | undefined> = {};
for (const p of PET_DEFS) defById[p.id] = p;

export function getPetDef(id: string): PetDef | undefined {
  return defById[id];
}
