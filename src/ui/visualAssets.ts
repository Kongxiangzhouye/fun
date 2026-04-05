/**
 * 本地 PNG（public/assets/ui），构建后由 Vite 原样输出。
 * 图标来源：Twemoji（CC-BY 4.0）https://github.com/twitter/twemoji
 */
import type { Element, GardenCropId, PetId, Rarity } from "../types";

const BASE = import.meta.env.BASE_URL;

function asset(name: string): string {
  return `${BASE}assets/ui/${name}`;
}

/** 顶栏资源小图标 */
export const UI_STONE = asset("ui-stone.png");
export const UI_ESSENCE = asset("ui-essence.png");
export const UI_REALM = asset("ui-realm.png");
export const UI_DAO = asset("ui-dao.svg");
export const UI_ZAO = asset("ui-zao.svg");
export const UI_POWER = asset("ui-power.svg");
export const UI_LING_SHA = asset("ui-ling-sha.svg");
export const UI_XUAN_TIE = asset("ui-xuan-tie.svg");

/** SSR / UR 灵卡角标（与五行底图分离） */
export const RARITY_BADGE_SSR = asset("rarity-ssr.png");
export const RARITY_BADGE_UR = asset("rarity-ur.png");

/** 五行灵卡小图标 */
export const ELEMENT_ICON: Record<Element, string> = {
  metal: asset("metal.png"),
  wood: asset("wood.png"),
  water: asset("water.png"),
  fire: asset("fire.png"),
  earth: asset("earth.png"),
};

export const GEAR_SLOT_ICON: Record<"weapon" | "body" | "ring", string> = {
  weapon: asset("gear-weapon.png"),
  body: asset("gear-body.png"),
  ring: asset("gear-ring.png"),
};

/** 抽卡页装饰、共鸣图标、保底星印（自绘 SVG） */
export const UI_GACHA_DECOR = asset("gacha-decor.svg");
export const UI_RESONANCE_CORE = asset("resonance-core.svg");
export const UI_PITY_SIGIL = asset("pity-sigil.svg");
/** 铸灵池珍品保底条左侧印记（与灵卡区分） */
export const UI_GEAR_PITY_SIGIL = asset("gear-pity-sigil.svg");

/** 顶栏标题旁灵息球、面板角饰、全页星点底（自绘 SVG） */
export const UI_TITLE_SPIRIT = asset("title-spirit.svg");
export const UI_PANEL_CORNER = asset("panel-corner.svg");
export const UI_BG_SPARKLES = asset("bg-sparkles.svg");
export const UI_PANEL_RUNES = asset("bg-panel-runes.svg");

/** 分区标题与空状态插画（自绘 SVG） */
export const UI_HEAD_DUNGEON = asset("deco-dungeon-header.svg");
export const UI_HEAD_TRAIN = asset("deco-train-header.svg");
export const UI_HEAD_GEAR = asset("deco-gear-header.svg");
/** 行囊背包排序条左侧小标 */
export const UI_GEAR_SORT_DECO = asset("gear-sort-deco.svg");
export const UI_HEAD_PET = asset("deco-pet-header.svg");
export const UI_HEAD_STATS = asset("deco-stats-header.svg");
export const UI_HEAD_COMBAT = asset("deco-combat-header.svg");
export const UI_HEAD_GARDEN = asset("deco-garden-header.svg");
export const UI_HEAD_BOUNTY = asset("deco-bounty-header.svg");
/** 周常悬赏 · 铸灵功课卡片标题旁 */
export const UI_BOUNTY_FORGE_DECO = asset("bounty-forge-deco.svg");
/** 周常悬赏 · 一键领取按钮内图标 */
export const UI_BOUNTY_CLAIM_ALL_DECO = asset("bounty-claim-all-deco.svg");
/** 幻域周常词缀条左侧装饰 */
export const UI_DUNGEON_AFFIX_DECO = asset("deco-dungeon-affix.svg");
/** 道韵灵窍页标题装饰 */
export const UI_HEAD_DAO_MERIDIAN = asset("deco-dao-meridian.svg");
/** 唤灵通鉴页标题 */
export const UI_HEAD_CHRONICLE = asset("deco-chronicle-header.svg");
/** 通鉴页「最近铸灵」小标题旁装饰（与灵卡卷轴区分） */
export const UI_GEAR_CHRONICLE_DECO = asset("deco-chronicle-gear.svg");
/** 成就列表 · 铸灵系条目左侧小标 */
export const UI_ACH_FORGE_DECO = asset("ach-forge-deco.svg");
/** 灵息日历（每日签到）页标题 */
export const UI_HEAD_DAILY_LOGIN = asset("deco-daily-login.svg");
/** 天机匣（周轮换商店）页标题 */
export const UI_HEAD_CELESTIAL_STASH = asset("deco-celestial-stash.svg");
/** 蓄灵池（灵府灵脉）标题装饰 */
export const UI_HEAD_SPIRIT_RESERVOIR = asset("deco-spirit-reservoir.svg");
/** 心斋卦象（每日运势）标题装饰 */
export const UI_HEAD_DAILY_FORTUNE = asset("deco-daily-fortune.svg");
/** 纳灵阵图（灵府）标题装饰 */
export const UI_HEAD_SPIRIT_ARRAY = asset("deco-spirit-array.svg");
export const UI_EMPTY_GEAR = asset("art-empty-gear.svg");
export const UI_EMPTY_PET = asset("art-empty-pet.svg");
export const UI_EMPTY_UNLOCK = asset("art-empty-unlock.svg");

/** 灵田作物图标（自绘 SVG） */
export const GARDEN_CROP_IMG: Record<GardenCropId, string> = {
  qing_grass: asset("garden-crop-qing.svg"),
  cloud_shroom: asset("garden-crop-cloud.svg"),
  jade_mist: asset("garden-crop-jade.svg"),
};

/** 灵宠立绘（SVG） */
export const PET_PORTRAIT: Record<PetId, string> = {
  yuling: asset("pet-yuling.svg"),
  zijing: asset("pet-zijing.svg"),
  chiyan: asset("pet-chiyan.svg"),
  qingluan: asset("pet-qingluan.svg"),
  xuangui: asset("pet-xuangui.svg"),
  linghu: asset("pet-linghu.svg"),
  qilin: asset("pet-qilin.svg"),
};

export function cardPortraitClass(rarity: string, element: Element): string {
  return `card-portrait rarity-${rarity} el-${element}`;
}

export function rarityBadgeSrc(rarity: Rarity): string | null {
  if (rarity === "SSR") return RARITY_BADGE_SSR;
  if (rarity === "UR") return RARITY_BADGE_UR;
  return null;
}
