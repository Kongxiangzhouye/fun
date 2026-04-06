/**
 * 本地 PNG（public/assets/ui），构建后由 Vite 原样输出。
 * 图标来源：Twemoji（CC-BY 4.0）https://github.com/twitter/twemoji
 */
import type { Element, GardenCropId, PetId, Rarity } from "../types";
import { ACHIEVEMENTS_LIST_UI_FILES } from "../data/achievementsListUi";
import { CHRONICLE_HEADERS_UI_FILES } from "../data/chronicleHeadersUi";
import { DUNGEON_DUEL_UI_FILES } from "../data/dungeonDuelUi";
import { ELEMENT_UI_FILES } from "../data/elementUi";
import { EMPTY_STATE_UI_FILES } from "../data/emptyStateUi";
import { FEATURE_PAGE_HEADS_UI_FILES } from "../data/featurePageHeadsUi";
import { GACHA_POOL_UI_FILES } from "../data/gachaPoolUi";
import { GEAR_BASES } from "../data/gearBases";
import { GEAR_INVENTORY_UI_FILES } from "../data/gearInventoryUi";
import { GEAR_SLOT_UI_FILES } from "../data/gearSlotUi";
import { HUB_SECTION_HEADER_UI_FILES } from "../data/hubSectionHeadersUi";
import { HUB_VEIN_FLAIR_UI_FILES } from "../data/hubVeinFlairUi";
import { HUD_BAR_UI_FILES } from "../data/hudBarUi";
import { LORE_JOURNAL_UI_FILES } from "../data/loreJournalUi";
import { OFFLINE_SETTLEMENT_UI_FILES } from "../data/offlineSettlementUi";
import { PANEL_CHROME_UI_FILES } from "../data/panelChromeUi";
import { PLAYER_PROFILE_UI_FILES } from "../data/playerProfileUi";
import { RARITY_BADGE_UI_FILES } from "../data/rarityBadgeUi";
import { WEEKLY_BOUNTY_UI_FILES } from "../data/weeklyBountyUi";
import { PET_DEFS } from "../data/pets";
import { GARDEN_CROPS } from "../systems/spiritGarden";

const BASE = import.meta.env.BASE_URL;
const UI_INLINE_FALLBACK =
  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 8 8'%3E%3Crect width='8' height='8' fill='rgba(255,255,255,0.001)'/%3E%3C/svg%3E";

function asset(name: string | null | undefined, fallback = UI_INLINE_FALLBACK): string {
  if (!name || typeof name !== "string") return fallback;
  return `${BASE}assets/ui/${name}`;
}

/** 顶栏资源小图标；与 `HUD_BAR_UI_FILES` 同源 */
export const UI_STONE = asset(HUD_BAR_UI_FILES.stone);
export const UI_ESSENCE = asset(HUD_BAR_UI_FILES.essence);
/** 筑灵髓（历练副本掉落货币） */
export const UI_ZHULING = asset(HUD_BAR_UI_FILES.zhuling);
export const UI_REALM = asset(HUD_BAR_UI_FILES.realm);
export const UI_DAO = asset(HUD_BAR_UI_FILES.dao);
export const UI_ZAO = asset(HUD_BAR_UI_FILES.zao);
export const UI_POWER = asset(HUD_BAR_UI_FILES.power);
export const UI_LING_SHA = asset(HUD_BAR_UI_FILES.lingSha);
export const UI_XUAN_TIE = asset(HUD_BAR_UI_FILES.xuanTie);

/** SSR / UR 灵卡角标（与五行底图分离）；与 `RARITY_BADGE_UI_FILES` 同源 */
export const RARITY_BADGE_SSR = asset(RARITY_BADGE_UI_FILES.SSR);
export const RARITY_BADGE_UR = asset(RARITY_BADGE_UI_FILES.UR);

/** 五行灵卡小图标；与 `ELEMENT_UI_FILES` 同源 */
export const ELEMENT_ICON: Record<Element, string> = Object.fromEntries(
  (Object.keys(ELEMENT_UI_FILES) as Element[]).map((el) => [el, asset(ELEMENT_UI_FILES[el])]),
) as Record<Element, string>;

/** 与 `GEAR_SLOT_UI_FILES` 同源 */
export const GEAR_SLOT_ICON: Record<"weapon" | "body" | "ring", string> = Object.fromEntries(
  (Object.keys(GEAR_SLOT_UI_FILES) as Array<keyof typeof GEAR_SLOT_UI_FILES>).map((slot) => [
    slot,
    asset(GEAR_SLOT_UI_FILES[slot]),
  ]),
) as Record<"weapon" | "body" | "ring", string>;

/** 各装备基底立绘（`public/assets/ui/gear-base-<baseId>.png`）；与 `GEAR_BASES` 同步，否则回退槽位图标 */
export const GEAR_BASE_PORTRAIT: Record<string, string> = Object.fromEntries(
  GEAR_BASES.map((b) => [b.id, asset(`gear-base-${b.id}.png`)]),
);

export function gearPortraitSrc(
  baseId: string,
  slot: "weapon" | "body" | "ring",
): string {
  return GEAR_BASE_PORTRAIT[baseId] ?? GEAR_SLOT_ICON[slot];
}

/** 抽卡页装饰、共鸣图标、保底星印（自绘 SVG）；与 `GACHA_POOL_UI_FILES` 同源 */
export const UI_GACHA_DECOR = asset(GACHA_POOL_UI_FILES.gachaDecor);
export const UI_RESONANCE_CORE = asset(GACHA_POOL_UI_FILES.resonanceCore);
export const UI_PITY_SIGIL = asset(GACHA_POOL_UI_FILES.pitySigil);
/** 铸灵池珍品保底条左侧印记（与灵卡区分） */
export const UI_GEAR_PITY_SIGIL = asset(GACHA_POOL_UI_FILES.gearPitySigil);
/** 境界铸灵阶位说明条左侧小徽 */
export const UI_GEAR_FORGE_TIER_DECO = asset(GACHA_POOL_UI_FILES.gearForgeTierDeco);

/** 顶栏标题旁灵息球、面板角饰、全页星点底（自绘 SVG）；与 `PANEL_CHROME_UI_FILES` 同源 */
export const UI_TITLE_SPIRIT = asset(PANEL_CHROME_UI_FILES.titleSpirit);
/** 存档页 · 下载备份文件按钮；与 `PLAYER_PROFILE_UI_FILES` 同源 */
export const UI_SAVE_DOWNLOAD_DECO = asset(PLAYER_PROFILE_UI_FILES.saveDownloadDeco);
/** 角色 · 偏好设置面板标题装饰 */
export const UI_UI_PREFS_DECO = asset(PLAYER_PROFILE_UI_FILES.uiPrefsDeco);
/** 角色 · 数据总览面板标题装饰 */
export const UI_DATA_OVERVIEW_DECO = asset(PLAYER_PROFILE_UI_FILES.dataOverviewDeco);
/** 偏好设置 · 音频小节图标 */
export const UI_SOUND_PREFS_DECO = asset(PLAYER_PROFILE_UI_FILES.soundPrefsDeco);
/** 存档管理 · 多存档位区块图标 */
export const UI_SAVE_SLOTS_DECO = asset(PLAYER_PROFILE_UI_FILES.saveSlotsDeco);
/** 存档管理 · 槽位备注（本机标签） */
export const UI_SAVE_SLOT_LABEL_DECO = asset(PLAYER_PROFILE_UI_FILES.saveSlotLabelDeco);
/** 快捷键说明浮层标题图标 */
export const UI_KEYBOARD_HELP_DECO = asset(PLAYER_PROFILE_UI_FILES.keyboardHelpDeco);
/** 关于游戏浮层标题图标 */
export const UI_ABOUT_GAME_DECO = asset(PLAYER_PROFILE_UI_FILES.aboutGameDeco);
/** 数据总览 · 复制统计摘要按钮图标 */
export const UI_DATA_EXPORT_DECO = asset(PLAYER_PROFILE_UI_FILES.dataExportDeco);
/** 数据总览 · 下载统计摘要为 .txt 按钮图标 */
export const UI_DATA_STATS_DOWNLOAD_DECO = asset(PLAYER_PROFILE_UI_FILES.dataStatsDownloadDeco);
export const UI_PANEL_CORNER = asset(PANEL_CHROME_UI_FILES.panelCorner);
export const UI_BG_SPARKLES = asset(PANEL_CHROME_UI_FILES.bgSparkles);
/** 离线收益摘要条左侧装饰 */
export const UI_OFFLINE_SUMMARY_DECO = asset(PANEL_CHROME_UI_FILES.offlineSummaryDeco);
/** 离线结算摘要徽记（用于摘要标题或关键收益行） */
export const UI_OFFLINE_SUMMARY_BADGE = asset(OFFLINE_SETTLEMENT_UI_FILES.summaryBadge);
/** 离线结算过渡光带（可用于摘要区块分隔） */
export const UI_OFFLINE_TRANSITION_SHINE = asset(OFFLINE_SETTLEMENT_UI_FILES.transitionShine);
export const UI_PANEL_RUNES = asset(PANEL_CHROME_UI_FILES.panelRunes);

/** 分区标题与空状态插画（自绘 SVG）；主分区头图与 `HUB_SECTION_HEADER_UI_FILES` 同源 */
export const UI_HEAD_DUNGEON = asset(HUB_SECTION_HEADER_UI_FILES.dungeon);
export const UI_HEAD_TRAIN = asset(HUB_SECTION_HEADER_UI_FILES.train);
export const UI_HEAD_GEAR = asset(HUB_SECTION_HEADER_UI_FILES.gear);
/** 行囊背包排序条左侧小标；与 `GEAR_INVENTORY_UI_FILES` 同源 */
export const UI_GEAR_SORT_DECO = asset(GEAR_INVENTORY_UI_FILES.sortDeco);
/** 行囊排序偏好已持久化提示（图钉） */
export const UI_GEAR_SORT_PINNED_DECO = asset(GEAR_INVENTORY_UI_FILES.sortPinnedDeco);
/** 装备锁定 / 解锁按钮内小锁 */
export const UI_GEAR_LOCK_DECO = asset(GEAR_INVENTORY_UI_FILES.lockDeco);
export const UI_HEAD_PET = asset(HUB_SECTION_HEADER_UI_FILES.pet);
export const UI_HEAD_STATS = asset(HUB_SECTION_HEADER_UI_FILES.stats);
export const UI_HEAD_COMBAT = asset(HUB_SECTION_HEADER_UI_FILES.combat);
export const UI_HEAD_GARDEN = asset(HUB_SECTION_HEADER_UI_FILES.garden);
export const UI_HEAD_BOUNTY = asset(HUB_SECTION_HEADER_UI_FILES.bounty);
/** 周常悬赏 · 铸灵功课卡片标题旁；与 `WEEKLY_BOUNTY_UI_FILES` 同源 */
export const UI_BOUNTY_FORGE_DECO = asset(WEEKLY_BOUNTY_UI_FILES.forge);
/** 周常悬赏 · 幻域清剿 */
export const UI_BOUNTY_WAVES_DECO = asset(WEEKLY_BOUNTY_UI_FILES.waves);
/** 周常悬赏 · 唤引修行 */
export const UI_BOUNTY_PULLS_DECO = asset(WEEKLY_BOUNTY_UI_FILES.pulls);
/** 周常悬赏 · 灵田收成 */
export const UI_BOUNTY_GARDEN_DECO = asset(WEEKLY_BOUNTY_UI_FILES.garden);
/** 周常悬赏 · 吐纳功课 */
export const UI_BOUNTY_TUNA_DECO = asset(WEEKLY_BOUNTY_UI_FILES.tuna);
/** 周常悬赏 · 破境精进 */
export const UI_BOUNTY_REALM_DECO = asset(WEEKLY_BOUNTY_UI_FILES.realm);
/** 周常悬赏 · 一键领取按钮内图标 */
export const UI_BOUNTY_CLAIM_ALL_DECO = asset(WEEKLY_BOUNTY_UI_FILES.claimAll);
/** 周常悬赏 · 领取反馈爆闪徽记 */
export const UI_BOUNTY_CLAIM_BURST = asset(WEEKLY_BOUNTY_UI_FILES.claimBurst);
/** 周常悬赏 · 周进度连胜状态徽记 */
export const UI_BOUNTY_STREAK_BADGE = asset(WEEKLY_BOUNTY_UI_FILES.streakBadge);
/** 周常悬赏 · 周目标完成状态徽记 */
export const UI_BOUNTY_COMPLETE_BADGE = asset(WEEKLY_BOUNTY_UI_FILES.completeBadge);
/** 周常悬赏 · 周目标进行中状态徽记 */
export const UI_BOUNTY_PENDING_BADGE = asset(WEEKLY_BOUNTY_UI_FILES.pendingBadge);
/** 周常悬赏 · 幻域任务高频反馈聚焦徽记 */
export const UI_BOUNTY_WAVES_FOCUS_BADGE = asset(WEEKLY_BOUNTY_UI_FILES.wavesFocusBadge);
/** 养成二级导航 · 分组标题前小徽记；与 `HUB_VEIN_FLAIR_UI_FILES` 同源 */
export const UI_HUB_SECTION_FLAIR = asset(HUB_VEIN_FLAIR_UI_FILES.hubSectionFlair);
/** 洞府蕴灵 · 共鸣乘区说明行左侧小标（双环链意象） */
export const UI_VEIN_GONGMING_LINK = asset(HUB_VEIN_FLAIR_UI_FILES.veinGongmingLink);
/** 幻域备战条左侧装饰；与 `DUNGEON_DUEL_UI_FILES` 同源 */
export const UI_DUNGEON_READINESS_DECO = asset(DUNGEON_DUEL_UI_FILES.readinessDeco);
/** 幻域周常词缀条左侧装饰 */
export const UI_DUNGEON_AFFIX_DECO = asset(DUNGEON_DUEL_UI_FILES.affixDeco);
/** 幻域周常词缀条 · 经典模式辅助装饰 */
export const UI_DUNGEON_AFFIX_CLASSIC_DECO = asset(DUNGEON_DUEL_UI_FILES.affixClassicDeco);
/** 幻域周常词缀条 · 星漩模式辅助装饰 */
export const UI_DUNGEON_AFFIX_VORTEX_DECO = asset(DUNGEON_DUEL_UI_FILES.affixVortexDeco);
/** 幻域·阵线对决舞台中央装饰 */
export const UI_DUNGEON_DUEL_DECO = asset(DUNGEON_DUEL_UI_FILES.duelDeco);
/** 阵线对决 · 命中闪光反馈 */
export const UI_DUNGEON_HIT_FLASH_DECO = asset(DUNGEON_DUEL_UI_FILES.hitFlashDeco, UI_DUNGEON_DUEL_DECO);
/** 阵线对决 · 暴击爆发反馈 */
export const UI_DUNGEON_CRIT_BURST_DECO = asset(DUNGEON_DUEL_UI_FILES.critBurstDeco, UI_DUNGEON_DUEL_DECO);
/** 阵线对决 · 暴击回响反馈（高频连击场景，2026-04-06 版） */
export const UI_DUNGEON_CRIT_ECHO_DECO = asset(DUNGEON_DUEL_UI_FILES.critEchoDeco, UI_DUNGEON_DUEL_DECO);
/** 阵线对决 · 破防/破绽反馈 */
export const UI_DUNGEON_GUARD_BREAK_DECO = asset(DUNGEON_DUEL_UI_FILES.guardBreakDeco, UI_DUNGEON_DUEL_DECO);
/** 阵线对决 · 命中确认环反馈（弱敌清线时更易读，2026-04-06 版） */
export const UI_DUNGEON_HIT_CONFIRM_RING_DECO = asset(
  DUNGEON_DUEL_UI_FILES.hitConfirmRingDeco,
  UI_DUNGEON_DUEL_DECO,
);
/** 阵线对决 · 连击链路确认反馈（高频命中阶段） */
export const UI_DUNGEON_COMBO_CHAIN_DECO = asset(DUNGEON_DUEL_UI_FILES.comboChainDeco, UI_DUNGEON_DUEL_DECO);
/** 阵线对决 · 失衡震荡反馈 */
export const UI_DUNGEON_STAGGER_PULSE_DECO = asset(DUNGEON_DUEL_UI_FILES.staggerPulseDeco, UI_DUNGEON_DUEL_DECO);
/** 阵线对决 · 斩杀收束印记反馈 */
export const UI_DUNGEON_FINISHER_SEAL_DECO = asset(DUNGEON_DUEL_UI_FILES.finisherSealDeco, UI_DUNGEON_DUEL_DECO);
/** 阵线对决 · 剑气读条旁小标 */
export const UI_DUEL_GAUGE_SWORD = asset(DUNGEON_DUEL_UI_FILES.gaugeSword);
/** 阵线对决 · 凶煞读条旁小标 */
export const UI_DUEL_GAUGE_THREAT = asset(DUNGEON_DUEL_UI_FILES.gaugeThreat);
/** 幻域未进本 · 预览区灵雾装饰（叠于格线之上） */
export const UI_DUNGEON_IDLE_MIST = asset(DUNGEON_DUEL_UI_FILES.idleMist);
/** 阵线对决 · 波次徽章旁小标 */
export const UI_DUEL_WAVE_BADGE = asset(DUNGEON_DUEL_UI_FILES.waveBadge);
/** 阵线对决 · 地图四角装饰（同一素材旋转/镜像） */
export const UI_DUEL_FRAME_CORNER = asset(DUNGEON_DUEL_UI_FILES.frameCorner);
/** 幻域 · 关间休整画面中央意象 */
export const UI_DUNGEON_INTER_WAVE_DECO = asset(DUNGEON_DUEL_UI_FILES.interWaveDeco);
/** 幻域底部栏 · 本局用时旁小标 */
export const UI_DUNGEON_FOOT_TIMER_DECO = asset(DUNGEON_DUEL_UI_FILES.footTimerDeco);
/** 幻域面板 · 进本进行中顶缘装饰条（CSS 平铺） */
export const UI_DUNGEON_PANEL_LIVE_STRIP = asset(DUNGEON_DUEL_UI_FILES.panelLiveStrip);
/** 幻域 · 进入副本主按钮内图标 */
export const UI_DUNGEON_ENTER_DECO = asset(DUNGEON_DUEL_UI_FILES.enterDeco);
/** 幻域 · 暂离（战斗中/休整）按钮内图标 */
export const UI_DUNGEON_LEAVE_DECO = asset(DUNGEON_DUEL_UI_FILES.leaveDeco);
/** 阵线对决 · 首领名条旁徽记 */
export const UI_DUEL_BOSS_BADGE = asset(DUNGEON_DUEL_UI_FILES.bossBadge);
/** 经典幻域模式单选项图标 */
export const UI_DUNGEON_REALM_CLASSIC = asset(DUNGEON_DUEL_UI_FILES.realmClassic);
/** 星漩乱域模式单选项图标 */
export const UI_DUNGEON_REALM_VORTEX = asset(DUNGEON_DUEL_UI_FILES.realmVortex);
/** 经典幻域模式展示位框体装饰 */
export const UI_DUNGEON_REALM_CLASSIC_FRAME_DECO = asset(DUNGEON_DUEL_UI_FILES.realmClassicFrameDeco);
/** 星漩乱域模式展示位框体装饰 */
export const UI_DUNGEON_REALM_VORTEX_FRAME_DECO = asset(DUNGEON_DUEL_UI_FILES.realmVortexFrameDeco);
/** 道韵灵窍页标题装饰；与 `CHRONICLE_HEADERS_UI_FILES` 同源 */
export const UI_HEAD_DAO_MERIDIAN = asset(CHRONICLE_HEADERS_UI_FILES.daoMeridianHead);
/** 唤灵通鉴页标题 */
export const UI_HEAD_CHRONICLE = asset(CHRONICLE_HEADERS_UI_FILES.chronicleHead);
/** 通鉴页「最近铸灵」小标题旁装饰（与灵卡卷轴区分） */
export const UI_GEAR_CHRONICLE_DECO = asset(CHRONICLE_HEADERS_UI_FILES.gearChronicleDeco);
/** 成就列表 · 铸灵系条目左侧小标；与 `ACHIEVEMENTS_LIST_UI_FILES` 同源 */
export const UI_ACH_FORGE_DECO = asset(ACHIEVEMENTS_LIST_UI_FILES.forge);
/** 成就列表 · 高阶铸灵次数里程碑（余烬） */
export const UI_ACH_FORGE_EMBER_DECO = asset(ACHIEVEMENTS_LIST_UI_FILES.forgeEmber);
export const UI_ACH_FORGE_NOVA_DECO = asset(ACHIEVEMENTS_LIST_UI_FILES.forgeNova);
/** 成就列表 · 灵卡池累计唤引系条目左侧小徽 */
export const UI_ACH_GACHA_DECO = asset(ACHIEVEMENTS_LIST_UI_FILES.gacha);
/** 成就列表 · 图鉴进度系条目左侧小徽 */
export const UI_ACH_CODEX_DECO = asset(ACHIEVEMENTS_LIST_UI_FILES.codex);
/** 成就列表 · 高稀有灵卡首遇系条目左侧小徽 */
export const UI_ACH_RARITY_DECO = asset(ACHIEVEMENTS_LIST_UI_FILES.rarity);
/** 成就列表 · 训练（三艺）系条目左侧小标 */
export const UI_ACH_TRAIN_DECO = asset(ACHIEVEMENTS_LIST_UI_FILES.train);
/** 成就列表 · 幻域系条目左侧小标 */
export const UI_ACH_DUNGEON_DECO = asset(ACHIEVEMENTS_LIST_UI_FILES.dungeon);
/** 成就列表 · 幻域累计波次系条目左侧小徽 */
export const UI_ACH_DUNGEON_WAVES_DECO = asset(ACHIEVEMENTS_LIST_UI_FILES.dungeonWaves);
/** 成就列表 · 幻域超高累计波次里程碑（浪涌） */
export const UI_ACH_DUNGEON_WAVES_SURGE_DECO = asset(ACHIEVEMENTS_LIST_UI_FILES.dungeonWavesSurge);
/** 成就列表 · 灵息日历 / 连签系条目左侧小徽 */
export const UI_ACH_LOGIN_DECO = asset(ACHIEVEMENTS_LIST_UI_FILES.login);
/** 成就列表 · 周常悬赏系条目左侧小徽 */
export const UI_ACH_BOUNTY_DECO = asset(ACHIEVEMENTS_LIST_UI_FILES.bounty);
/** 成就列表 · 周常悬赏超高清满周次里程碑（岁印） */
export const UI_ACH_BOUNTY_BLOOM_DECO = asset(ACHIEVEMENTS_LIST_UI_FILES.bountyBloom);
/** 成就列表 · 道韵灵窍系条目左侧小徽 */
export const UI_ACH_MERIDIAN_DECO = asset(ACHIEVEMENTS_LIST_UI_FILES.meridian);
/** 成就列表 · 灵宠系条目左侧小徽 */
export const UI_ACH_PET_DECO = asset(ACHIEVEMENTS_LIST_UI_FILES.pet);
/** 成就列表 · 纳灵阵图系条目左侧小徽 */
export const UI_ACH_SPIRIT_ARRAY_DECO = asset(ACHIEVEMENTS_LIST_UI_FILES.spiritArray);
/** 成就列表 · 灵宠唤引次数系条目左侧小徽 */
export const UI_ACH_PET_PULL_DECO = asset(ACHIEVEMENTS_LIST_UI_FILES.petPull);
/** 成就列表 · 灵宠唤引超高次数里程碑（绽华） */
export const UI_ACH_PET_PULL_BLOOM_DECO = asset(ACHIEVEMENTS_LIST_UI_FILES.petPullBloom);
/** 成就列表 · 轮回次数系条目左侧小徽 */
export const UI_ACH_REINCARNATION_DECO = asset(ACHIEVEMENTS_LIST_UI_FILES.reincarnation);
/** 成就列表 · 灵田系条目左侧小徽 */
export const UI_ACH_GARDEN_DECO = asset(ACHIEVEMENTS_LIST_UI_FILES.garden);
/** 成就列表 · 灵田超高累计收获里程碑（穗花） */
export const UI_ACH_GARDEN_BLOOM_DECO = asset(ACHIEVEMENTS_LIST_UI_FILES.gardenBloom);
/** 成就列表 · 天机匣系条目左侧小徽 */
export const UI_ACH_STASH_DECO = asset(ACHIEVEMENTS_LIST_UI_FILES.stash);
/** 成就列表 · 天机匣超高累计兑换里程碑（渊匣） */
export const UI_ACH_STASH_BLOOM_DECO = asset(ACHIEVEMENTS_LIST_UI_FILES.stashBloom);
/** 成就列表 · 蓄灵池系条目左侧小徽 */
export const UI_ACH_RESERVOIR_DECO = asset(ACHIEVEMENTS_LIST_UI_FILES.reservoir);
/** 成就列表 · 蓄灵池超高累计收取里程碑（渊涌） */
export const UI_ACH_RESERVOIR_BLOOM_DECO = asset(ACHIEVEMENTS_LIST_UI_FILES.reservoirBloom);
/** 成就列表 · 心斋卦象系条目左侧小徽 */
export const UI_ACH_FORTUNE_DECO = asset(ACHIEVEMENTS_LIST_UI_FILES.fortune);
/** 成就列表 · 心斋卦象超高刷新次数里程碑（星环） */
export const UI_ACH_FORTUNE_BLOOM_DECO = asset(ACHIEVEMENTS_LIST_UI_FILES.fortuneBloom);
/** 成就列表 · 洞府蕴灵（共鸣线）系条目左侧小徽 */
export const UI_ACH_VEIN_DECO = asset(ACHIEVEMENTS_LIST_UI_FILES.vein);
/** 成就列表 · 境界里程碑条目左侧小徽 */
export const UI_ACH_REALM_DECO = asset(ACHIEVEMENTS_LIST_UI_FILES.realm);
/** 修行札记 · 「挂机三艺」折叠标题旁；与 `LORE_JOURNAL_UI_FILES` 同源 */
export const UI_LORE_THREE_ARTS = asset(LORE_JOURNAL_UI_FILES.threeArts);
/** 修行札记 · 「周常悬赏」折叠标题旁 */
export const UI_LORE_BOUNTY = asset(LORE_JOURNAL_UI_FILES.bounty);
/** 修行札记 · 「灵府与灵脉」折叠标题旁 */
export const UI_LORE_ESTATE = asset(LORE_JOURNAL_UI_FILES.estate);
/** 修行札记 · 「功能解锁一览」折叠标题旁 */
export const UI_LORE_UNLOCKS = asset(LORE_JOURNAL_UI_FILES.unlocks);
/** 修行札记 · 「幻域副本」折叠标题旁 */
export const UI_LORE_DUNGEON = asset(LORE_JOURNAL_UI_FILES.dungeon);
/** 修行札记 · 「行囊与铸灵」折叠标题旁 */
export const UI_LORE_GEAR = asset(LORE_JOURNAL_UI_FILES.gear);
/** 修行札记 · 「卡组与轮回」折叠标题旁 */
export const UI_LORE_REINCARNATION = asset(LORE_JOURNAL_UI_FILES.reincarnation);
/** 修行札记 · 「术语速查」折叠标题旁 */
export const UI_LORE_GLOSSARY = asset(LORE_JOURNAL_UI_FILES.glossary);
/** 修行札记 · 「资源与灵石分流」折叠标题旁 */
export const UI_LORE_RESOURCES = asset(LORE_JOURNAL_UI_FILES.resources);
/** 修行札记 · 「洞府蕴灵四线」折叠标题旁 */
export const UI_LORE_VEIN = asset(LORE_JOURNAL_UI_FILES.vein);
/** 修行札记 · 「五行灵脉」折叠标题旁 */
export const UI_LORE_ELEMENTS = asset(LORE_JOURNAL_UI_FILES.elements);
/** 修行札记 · 「唤灵池与灵宠」折叠标题旁 */
export const UI_LORE_PET = asset(LORE_JOURNAL_UI_FILES.pet);
/** 修行札记 · 「元强化与道韵」折叠标题旁 */
export const UI_LORE_META = asset(LORE_JOURNAL_UI_FILES.meta);
/** 修行札记 · 「道韵灵窍」折叠标题旁 */
export const UI_LORE_DAO_MERIDIAN = asset(LORE_JOURNAL_UI_FILES.daoMeridian);
/** 修行札记 · 「心法（修炼）」折叠标题旁 */
export const UI_LORE_BATTLE_SKILL = asset(LORE_JOURNAL_UI_FILES.battleSkill);
/** 修行札记 · 「灵息日历」折叠标题旁 */
export const UI_LORE_LOGIN_CALENDAR = asset(LORE_JOURNAL_UI_FILES.loginCalendar);
/** 修行札记 · 「唤灵通鉴」折叠标题旁 */
export const UI_LORE_CHRONICLE = asset(LORE_JOURNAL_UI_FILES.chronicle);
/** 修行札记 · 「吐纳与闭关」折叠标题旁 */
export const UI_LORE_TUNA_MEDITATION = asset(LORE_JOURNAL_UI_FILES.tunaMeditation);
/** 灵息日历（每日签到）页标题；与 `FEATURE_PAGE_HEADS_UI_FILES` 同源 */
export const UI_HEAD_DAILY_LOGIN = asset(FEATURE_PAGE_HEADS_UI_FILES.dailyLogin);
/** 天机匣（周轮换商店）页标题 */
export const UI_HEAD_CELESTIAL_STASH = asset(FEATURE_PAGE_HEADS_UI_FILES.celestialStash);
/** 蓄灵池（灵府灵脉）标题装饰 */
export const UI_HEAD_SPIRIT_RESERVOIR = asset(FEATURE_PAGE_HEADS_UI_FILES.spiritReservoir);
/** 心斋卦象（每日运势）标题装饰 */
export const UI_HEAD_DAILY_FORTUNE = asset(FEATURE_PAGE_HEADS_UI_FILES.dailyFortune);
/** 纳灵阵图（灵府）标题装饰 */
export const UI_HEAD_SPIRIT_ARRAY = asset(FEATURE_PAGE_HEADS_UI_FILES.spiritArray);
/** 与 `EMPTY_STATE_UI_FILES` 同源 */
export const UI_EMPTY_GEAR = asset(EMPTY_STATE_UI_FILES.gear);
export const UI_EMPTY_PET = asset(EMPTY_STATE_UI_FILES.pet);
export const UI_EMPTY_UNLOCK = asset(EMPTY_STATE_UI_FILES.unlock);

/** 灵田作物图标（自绘 SVG）；与 `GARDEN_CROPS[].artFile` 同源 */
export const GARDEN_CROP_IMG: Record<GardenCropId, string> = Object.fromEntries(
  (Object.keys(GARDEN_CROPS) as GardenCropId[]).map((id) => [id, asset(GARDEN_CROPS[id].artFile)]),
) as Record<GardenCropId, string>;

/** 灵宠立绘（SVG）；与 `PET_DEFS[].artFile` 同源 */
export const PET_PORTRAIT: Record<PetId, string> = Object.fromEntries(
  PET_DEFS.map((p) => [p.id, asset(p.artFile)]),
) as Record<PetId, string>;

export function cardPortraitClass(rarity: string, element: Element): string {
  return `card-portrait rarity-${rarity} el-${element}`;
}

export function rarityBadgeSrc(rarity: Rarity): string | null {
  if (rarity === "SSR") return RARITY_BADGE_SSR;
  if (rarity === "UR") return RARITY_BADGE_UR;
  return null;
}
