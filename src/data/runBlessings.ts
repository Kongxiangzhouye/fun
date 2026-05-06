import type { Element } from "../types";

export type RunBlessingId =
  | "metal_sunder"
  | "metal_execution"
  | "wood_regrowth"
  | "wood_lifebloom"
  | "water_flowstep"
  | "water_mirror"
  | "fire_cinder"
  | "fire_overheat"
  | "earth_bulwark"
  | "earth_stoneheart"
  | "void_momentum"
  | "void_spoil";

export interface RunBlessingDef {
  id: RunBlessingId;
  name: string;
  element?: Element;
  rarity: "minor" | "major";
  desc: string;
  atkPct?: number;
  hpPct?: number;
  shieldPct?: number;
  critPct?: number;
  dodgeRefund?: number;
  skillHastePct?: number;
  rewardPct?: number;
}

export const RUN_BLESSINGS: RunBlessingDef[] = [
  {
    id: "metal_sunder",
    name: "庚金裂甲",
    element: "metal",
    rarity: "minor",
    desc: "普攻削去敌方护势，后续伤害更容易穿透。",
    atkPct: 0.1,
  },
  {
    id: "metal_execution",
    name: "白刃收魂",
    element: "metal",
    rarity: "major",
    desc: "终结技伤害提高，击败敌人时额外获得筑灵髓。",
    atkPct: 0.16,
    rewardPct: 0.14,
  },
  {
    id: "wood_regrowth",
    name: "青木回春",
    element: "wood",
    rarity: "minor",
    desc: "每清理一个节点恢复少量生命。",
    hpPct: 0.12,
  },
  {
    id: "wood_lifebloom",
    name: "生生不息",
    element: "wood",
    rarity: "major",
    desc: "生命上限提高，心法技同时治疗自身。",
    hpPct: 0.22,
  },
  {
    id: "water_flowstep",
    name: "流云步",
    element: "water",
    rarity: "minor",
    desc: "闪避消耗降低，成功化劲后返还体力。",
    dodgeRefund: 10,
  },
  {
    id: "water_mirror",
    name: "镜湖反照",
    element: "water",
    rarity: "major",
    desc: "闪避敌方攻势时反击，并缩短心法技冷却。",
    dodgeRefund: 18,
    skillHastePct: 0.12,
  },
  {
    id: "fire_cinder",
    name: "余烬燎原",
    element: "fire",
    rarity: "minor",
    desc: "战意增长更快，普攻有更高爆发。",
    critPct: 0.06,
  },
  {
    id: "fire_overheat",
    name: "焚天一息",
    element: "fire",
    rarity: "major",
    desc: "心法技和终结技造成更高伤害。",
    atkPct: 0.2,
    critPct: 0.08,
  },
  {
    id: "earth_bulwark",
    name: "厚土护身",
    element: "earth",
    rarity: "minor",
    desc: "进入每场战斗时获得护盾。",
    shieldPct: 0.16,
  },
  {
    id: "earth_stoneheart",
    name: "山岳不移",
    element: "earth",
    rarity: "major",
    desc: "护盾和生命上限提高，适合挑战首领。",
    hpPct: 0.12,
    shieldPct: 0.26,
  },
  {
    id: "void_momentum",
    name: "阵线连破",
    rarity: "minor",
    desc: "每个已清理节点提高本局伤害。",
    atkPct: 0.08,
  },
  {
    id: "void_spoil",
    name: "秘境余响",
    rarity: "major",
    desc: "本局结算资源提高。",
    rewardPct: 0.22,
  },
];

export function getRunBlessing(id: string): RunBlessingDef | undefined {
  return RUN_BLESSINGS.find((x) => x.id === id);
}

export function blessingIdsForElement(element: Element): RunBlessingId[] {
  return RUN_BLESSINGS.filter((x) => x.element === element).map((x) => x.id);
}
