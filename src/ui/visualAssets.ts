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
/** 境界铸灵阶位说明条左侧小徽 */
export const UI_GEAR_FORGE_TIER_DECO = asset("gear-forge-tier-deco.svg");

/** 顶栏标题旁灵息球、面板角饰、全页星点底（自绘 SVG） */
export const UI_TITLE_SPIRIT = asset("title-spirit.svg");
/** 存档页 · 下载备份文件按钮 */
export const UI_SAVE_DOWNLOAD_DECO = asset("save-download-deco.svg");
/** 角色 · 偏好设置面板标题装饰 */
export const UI_UI_PREFS_DECO = asset("ui-prefs-panel-deco.svg");
/** 角色 · 数据总览面板标题装饰 */
export const UI_DATA_OVERVIEW_DECO = asset("data-overview-deco.svg");
/** 偏好设置 · 音频小节图标 */
export const UI_SOUND_PREFS_DECO = asset("ui-sound-prefs-deco.svg");
/** 存档管理 · 多存档位区块图标 */
export const UI_SAVE_SLOTS_DECO = asset("save-slots-deco.svg");
/** 存档管理 · 槽位备注（本机标签） */
export const UI_SAVE_SLOT_LABEL_DECO = asset("save-slot-label-deco.svg");
/** 快捷键说明浮层标题图标 */
export const UI_KEYBOARD_HELP_DECO = asset("keyboard-help-deco.svg");
/** 关于游戏浮层标题图标 */
export const UI_ABOUT_GAME_DECO = asset("about-game-deco.svg");
/** 数据总览 · 复制统计摘要按钮图标 */
export const UI_DATA_EXPORT_DECO = asset("data-export-deco.svg");
/** 数据总览 · 下载统计摘要为 .txt 按钮图标 */
export const UI_DATA_STATS_DOWNLOAD_DECO = asset("data-stats-download-deco.svg");
export const UI_PANEL_CORNER = asset("panel-corner.svg");
export const UI_BG_SPARKLES = asset("bg-sparkles.svg");
/** 离线收益摘要条左侧装饰 */
export const UI_OFFLINE_SUMMARY_DECO = asset("offline-summary-deco.svg");
export const UI_PANEL_RUNES = asset("bg-panel-runes.svg");

/** 分区标题与空状态插画（自绘 SVG） */
export const UI_HEAD_DUNGEON = asset("deco-dungeon-header.svg");
export const UI_HEAD_TRAIN = asset("deco-train-header.svg");
export const UI_HEAD_GEAR = asset("deco-gear-header.svg");
/** 行囊背包排序条左侧小标 */
export const UI_GEAR_SORT_DECO = asset("gear-sort-deco.svg");
/** 行囊排序偏好已持久化提示（图钉） */
export const UI_GEAR_SORT_PINNED_DECO = asset("gear-sort-pinned-deco.svg");
/** 装备锁定 / 解锁按钮内小锁 */
export const UI_GEAR_LOCK_DECO = asset("gear-lock-deco.svg");
export const UI_HEAD_PET = asset("deco-pet-header.svg");
export const UI_HEAD_STATS = asset("deco-stats-header.svg");
export const UI_HEAD_COMBAT = asset("deco-combat-header.svg");
export const UI_HEAD_GARDEN = asset("deco-garden-header.svg");
export const UI_HEAD_BOUNTY = asset("deco-bounty-header.svg");
/** 周常悬赏 · 铸灵功课卡片标题旁 */
export const UI_BOUNTY_FORGE_DECO = asset("bounty-forge-deco.svg");
/** 周常悬赏 · 幻域清剿 */
export const UI_BOUNTY_WAVES_DECO = asset("bounty-waves-deco.svg");
/** 周常悬赏 · 唤引修行 */
export const UI_BOUNTY_PULLS_DECO = asset("bounty-pulls-deco.svg");
/** 周常悬赏 · 灵田收成 */
export const UI_BOUNTY_GARDEN_DECO = asset("bounty-garden-deco.svg");
/** 周常悬赏 · 吐纳功课 */
export const UI_BOUNTY_TUNA_DECO = asset("bounty-tuna-deco.svg");
/** 周常悬赏 · 破境精进 */
export const UI_BOUNTY_REALM_DECO = asset("bounty-realm-deco.svg");
/** 周常悬赏 · 一键领取按钮内图标 */
export const UI_BOUNTY_CLAIM_ALL_DECO = asset("bounty-claim-all-deco.svg");
/** 养成二级导航 · 分组标题前小徽记 */
export const UI_HUB_SECTION_FLAIR = asset("hub-section-flair.svg");
/** 洞府蕴灵 · 共鸣乘区说明行左侧小标（双环链意象） */
export const UI_VEIN_GONGMING_LINK = asset("deco-vein-gongming-link.svg");
/** 幻域备战条左侧装饰 */
export const UI_DUNGEON_READINESS_DECO = asset("deco-dungeon-readiness-ribbon.svg");
/** 幻域周常词缀条左侧装饰 */
export const UI_DUNGEON_AFFIX_DECO = asset("deco-dungeon-affix.svg");
/** 幻域·阵线对决舞台中央装饰 */
export const UI_DUNGEON_DUEL_DECO = asset("deco-dungeon-duel.svg");
/** 阵线对决 · 剑气读条旁小标 */
export const UI_DUEL_GAUGE_SWORD = asset("deco-duel-gauge-sword.svg");
/** 阵线对决 · 凶煞读条旁小标 */
export const UI_DUEL_GAUGE_THREAT = asset("deco-duel-gauge-threat.svg");
/** 幻域未进本 · 预览区灵雾装饰（叠于格线之上） */
export const UI_DUNGEON_IDLE_MIST = asset("deco-dungeon-idle-mist.svg");
/** 阵线对决 · 波次徽章旁小标 */
export const UI_DUEL_WAVE_BADGE = asset("deco-duel-wave-badge.svg");
/** 阵线对决 · 地图四角装饰（同一素材旋转/镜像） */
export const UI_DUEL_FRAME_CORNER = asset("deco-duel-corner.svg");
/** 幻域 · 关间休整画面中央意象 */
export const UI_DUNGEON_INTER_WAVE_DECO = asset("deco-dungeon-inter-wave.svg");
/** 幻域底部栏 · 本局用时旁小标 */
export const UI_DUNGEON_FOOT_TIMER_DECO = asset("deco-dungeon-foot-timer.svg");
/** 幻域面板 · 进本进行中顶缘装饰条（CSS 平铺） */
export const UI_DUNGEON_PANEL_LIVE_STRIP = asset("deco-dungeon-panel-live.svg");
/** 幻域 · 进入副本主按钮内图标 */
export const UI_DUNGEON_ENTER_DECO = asset("deco-dungeon-enter-btn.svg");
/** 幻域 · 暂离（战斗中/休整）按钮内图标 */
export const UI_DUNGEON_LEAVE_DECO = asset("deco-dungeon-leave-btn.svg");
/** 阵线对决 · 首领名条旁徽记 */
export const UI_DUEL_BOSS_BADGE = asset("deco-duel-boss-badge.svg");
/** 经典幻域模式单选项图标 */
export const UI_DUNGEON_REALM_CLASSIC = asset("deco-dungeon-realm-classic.svg");
/** 星漩乱域模式单选项图标 */
export const UI_DUNGEON_REALM_VORTEX = asset("deco-dungeon-realm-vortex.svg");
/** 道韵灵窍页标题装饰 */
export const UI_HEAD_DAO_MERIDIAN = asset("deco-dao-meridian.svg");
/** 唤灵通鉴页标题 */
export const UI_HEAD_CHRONICLE = asset("deco-chronicle-header.svg");
/** 通鉴页「最近铸灵」小标题旁装饰（与灵卡卷轴区分） */
export const UI_GEAR_CHRONICLE_DECO = asset("deco-chronicle-gear.svg");
/** 成就列表 · 铸灵系条目左侧小标 */
export const UI_ACH_FORGE_DECO = asset("ach-forge-deco.svg");
/** 成就列表 · 训练（三艺）系条目左侧小标 */
export const UI_ACH_TRAIN_DECO = asset("ach-train-deco.svg");
/** 成就列表 · 幻域系条目左侧小标 */
export const UI_ACH_DUNGEON_DECO = asset("ach-dungeon-deco.svg");
/** 成就列表 · 灵息日历 / 连签系条目左侧小徽 */
export const UI_ACH_LOGIN_DECO = asset("ach-login-deco.svg");
/** 成就列表 · 周常悬赏系条目左侧小徽 */
export const UI_ACH_BOUNTY_DECO = asset("ach-bounty-deco.svg");
/** 成就列表 · 道韵灵窍系条目左侧小徽 */
export const UI_ACH_MERIDIAN_DECO = asset("ach-meridian-deco.svg");
/** 成就列表 · 灵宠系条目左侧小徽 */
export const UI_ACH_PET_DECO = asset("ach-pet-deco.svg");
/** 成就列表 · 纳灵阵图系条目左侧小徽 */
export const UI_ACH_SPIRIT_ARRAY_DECO = asset("ach-spirit-array-deco.svg");
/** 成就列表 · 灵宠唤引次数系条目左侧小徽 */
export const UI_ACH_PET_PULL_DECO = asset("ach-pet-pull-deco.svg");
/** 成就列表 · 轮回次数系条目左侧小徽 */
export const UI_ACH_REINCARNATION_DECO = asset("ach-reincarnation-deco.svg");
/** 成就列表 · 灵田系条目左侧小徽 */
export const UI_ACH_GARDEN_DECO = asset("ach-garden-deco.svg");
/** 修行札记 · 「挂机三艺」折叠标题旁 */
export const UI_LORE_THREE_ARTS = asset("deco-lore-three-arts.svg");
/** 修行札记 · 「周常悬赏」折叠标题旁 */
export const UI_LORE_BOUNTY = asset("deco-lore-bounty.svg");
/** 修行札记 · 「灵府与灵脉」折叠标题旁 */
export const UI_LORE_ESTATE = asset("deco-lore-estate.svg");
/** 修行札记 · 「功能解锁一览」折叠标题旁 */
export const UI_LORE_UNLOCKS = asset("deco-lore-unlocks.svg");
/** 修行札记 · 「幻域副本」折叠标题旁 */
export const UI_LORE_DUNGEON = asset("deco-lore-dungeon.svg");
/** 修行札记 · 「行囊与铸灵」折叠标题旁 */
export const UI_LORE_GEAR = asset("deco-lore-gear.svg");
/** 修行札记 · 「卡组与轮回」折叠标题旁 */
export const UI_LORE_REINCARNATION = asset("deco-lore-reincarnation.svg");
/** 修行札记 · 「术语速查」折叠标题旁 */
export const UI_LORE_GLOSSARY = asset("deco-lore-glossary.svg");
/** 修行札记 · 「资源与灵石分流」折叠标题旁 */
export const UI_LORE_RESOURCES = asset("deco-lore-resources.svg");
/** 修行札记 · 「洞府蕴灵四线」折叠标题旁 */
export const UI_LORE_VEIN = asset("deco-lore-vein.svg");
/** 修行札记 · 「五行灵脉」折叠标题旁 */
export const UI_LORE_ELEMENTS = asset("deco-lore-elements.svg");
/** 修行札记 · 「唤灵池与灵宠」折叠标题旁 */
export const UI_LORE_PET = asset("deco-lore-pet.svg");
/** 修行札记 · 「元强化与道韵」折叠标题旁 */
export const UI_LORE_META = asset("deco-lore-meta.svg");
/** 修行札记 · 「道韵灵窍」折叠标题旁 */
export const UI_LORE_DAO_MERIDIAN = asset("deco-lore-dao-meridian.svg");
/** 修行札记 · 「心法（修炼）」折叠标题旁 */
export const UI_LORE_BATTLE_SKILL = asset("deco-lore-battle-skill.svg");
/** 修行札记 · 「灵息日历」折叠标题旁 */
export const UI_LORE_LOGIN_CALENDAR = asset("deco-lore-login-calendar.svg");
/** 修行札记 · 「唤灵通鉴」折叠标题旁 */
export const UI_LORE_CHRONICLE = asset("deco-lore-chronicle.svg");
/** 修行札记 · 「吐纳与闭关」折叠标题旁 */
export const UI_LORE_TUNA_MEDITATION = asset("deco-lore-tuna-meditation.svg");
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
