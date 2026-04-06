import "./styles.css";
import type { GameState } from "./types";
import {
  ESSENCE_COST_SINGLE,
  ESSENCE_COST_TEN,
  ESSENCE_COST_GEAR_SINGLE,
  ESSENCE_COST_GEAR_TEN,
  MAX_CARD_LEVEL,
  REINCARNATION_REALM_REQ,
  BI_GUAN_COOLDOWN_MS,
  TUNA_COOLDOWN_MS,
  DUNGEON_DEATH_CD_MS,
  DUNGEON_INTER_WAVE_CD_MS,
  PLAYER_DUNGEON_HIT_INTERVAL_SEC,
  DUNGEON_MONSTER_HIT_INTERVAL,
  DUNGEON_STAMINA_MAX,
  DUNGEON_DODGE_STAMINA_COST,
} from "./types";
import {
  loadGame,
  saveGame,
  exportSave,
  importSave,
  totalCardsInPool,
  clearSaveAndNewGame,
  SAVE_SLOT_COUNT,
  getActiveSlotIndex,
  peekSlotSummary,
  switchToSaveSlot,
  copyCurrentToSlot,
  getSlotLabel,
  setSlotLabel,
  SAVE_SLOT_LABEL_MAX,
} from "./storage";
import {
  incomePerSecond,
  incomeBreakdownForDisplay,
  realmBreakthroughCostForState,
  upgradeCardLevelCost,
  upgradeCardLingShaCost,
  deckRealmBonusSum,
  effectiveDeckSlots,
} from "./economy";
import { catchUpOffline, applyTick, fastForward, maxOfflineSec } from "./gameLoop";
import {
  pullOne,
  pullTen,
  pullGearOne,
  pullGearTen,
  urPityRemaining,
  UR_PITY_MAX,
  gearSrPityRemaining,
  effectiveGearSrPityMax,
  GEAR_SR_PITY_MAX,
  highestRarityInPulls,
  type PullResult,
} from "./gacha";
import { CARDS, getCard } from "./data/cards";
import { tryCompleteAchievements, drainAchievementToastQueue, ACHIEVEMENTS, type AchievementDef } from "./achievements";
import { countUniqueOwned, SAVE_VERSION } from "./state";
import pkg from "../package.json";
import { playUiBlip, resumeAudioContext } from "./audio";
import {
  canReincarnate,
  daoEssenceGainOnReincarnate,
  performReincarnate,
  buyMeta,
  metaUpgradeCost,
} from "./systems/reincarnation";
import { describeInGameUi, onGachaPulls, essenceIncomePerSecondFromResonance } from "./dailyRewards";
import {
  buyVeinUpgrade,
  gongMingUpgradeCost,
  guYuanUpgradeCost,
  huiLingUpgradeCost,
  lingXiUpgradeCost,
  VEIN_DESC,
  VEIN_TITLES,
  VEIN_MAX_LEVEL,
  veinGongMingResonanceMult,
  veinHuiLingMult,
  veinLingXiMult,
  type VeinKind,
} from "./systems/veinCultivation";
import { tryTuna, tunaCooldownLeftMs, tunaStoneReward } from "./systems/tuna";
import { fmtDecimal, stones, addStones, canAfford, subStones, syncDecimalFormatFromState } from "./stones";
import { fireSynergyActive, deckSynergySummary } from "./deckSynergy";
import { tryFenTianBurst } from "./fenTian";
import { buyQoL, bulkUpgradeAllCards, qoLCost } from "./qoL";
import type {
  QoLFlags,
  Rarity,
  SkillId,
  GearItem,
  Element,
  GardenCropId,
  GearInventorySortMode,
} from "./types";
import Decimal from "decimal.js";
import { gsap } from "gsap";
import { Application, Container, Graphics, type Ticker } from "pixi.js";
import { getUiUnlocks } from "./uiUnlocks";
import { explorationHints } from "./explorationHints";
import { sessionFunFlavorLine, onTitleSpiritPet, bindKonamiEasterEgg } from "./funBits";
import {
  formatDungeonActiveMeta,
  formatDungeonActiveMetaBrief,
  renderDungeonPanel,
  renderTrainPanel,
  renderBattleSkillPanel,
  renderGearPanel,
  renderPetPanel,
} from "./ui/extraPanels";
import { featureGuidePanelHtml, type FeatureGuideId } from "./ui/featureGuides";
import { renderGameLoreHtml } from "./ui/gameLore";
import {
  ELEMENT_ICON,
  UI_STONE,
  UI_ESSENCE,
  UI_REALM,
  UI_DAO,
  UI_ZAO,
  UI_POWER,
  UI_LING_SHA,
  UI_XUAN_TIE,
  RARITY_BADGE_SSR,
  RARITY_BADGE_UR,
  cardPortraitClass,
  rarityBadgeSrc,
  UI_GACHA_DECOR,
  UI_RESONANCE_CORE,
  UI_PITY_SIGIL,
  UI_GEAR_PITY_SIGIL,
  UI_GEAR_FORGE_TIER_DECO,
  UI_TITLE_SPIRIT,
  UI_BG_SPARKLES,
  UI_PANEL_RUNES,
  UI_HEAD_STATS,
  UI_HEAD_COMBAT,
  UI_HUB_SECTION_FLAIR,
  UI_HEAD_SPIRIT_RESERVOIR,
  UI_HEAD_DAILY_FORTUNE,
  UI_ACH_FORGE_DECO,
  UI_ACH_FORGE_EMBER_DECO,
  UI_ACH_FORGE_NOVA_DECO,
  UI_ACH_GACHA_DECO,
  UI_ACH_CODEX_DECO,
  UI_ACH_RARITY_DECO,
  UI_ACH_TRAIN_DECO,
  UI_ACH_DUNGEON_DECO,
  UI_ACH_DUNGEON_WAVES_DECO,
  UI_ACH_DUNGEON_WAVES_SURGE_DECO,
  UI_ACH_LOGIN_DECO,
  UI_ACH_BOUNTY_DECO,
  UI_ACH_MERIDIAN_DECO,
  UI_ACH_PET_DECO,
  UI_ACH_SPIRIT_ARRAY_DECO,
  UI_ACH_PET_PULL_DECO,
  UI_ACH_PET_PULL_BLOOM_DECO,
  UI_ACH_REINCARNATION_DECO,
  UI_ACH_GARDEN_DECO,
  UI_ACH_GARDEN_BLOOM_DECO,
  UI_ACH_STASH_DECO,
  UI_ACH_RESERVOIR_DECO,
  UI_ACH_FORTUNE_DECO,
  UI_ACH_VEIN_DECO,
  UI_ACH_REALM_DECO,
  UI_SAVE_DOWNLOAD_DECO,
  UI_UI_PREFS_DECO,
  UI_DATA_OVERVIEW_DECO,
  UI_SOUND_PREFS_DECO,
  UI_SAVE_SLOTS_DECO,
  UI_SAVE_SLOT_LABEL_DECO,
  UI_KEYBOARD_HELP_DECO,
  UI_ABOUT_GAME_DECO,
  UI_DATA_EXPORT_DECO,
  UI_DATA_STATS_DOWNLOAD_DECO,
  UI_VEIN_GONGMING_LINK,
} from "./ui/visualAssets";
import { renderSpiritGardenPage } from "./ui/spiritGardenPanel";
import { renderSpiritArrayPanel, updateSpiritArrayPanelReadouts } from "./ui/spiritArrayPanel";
import { renderBountyPanel, updateBountyPanelReadouts } from "./ui/bountyPanel";
import { renderDailyLoginPanel, updateDailyLoginPanelReadouts } from "./ui/dailyLoginPanel";
import { claimDailyLoginReward, tickDailyLoginCalendar, toLocalYMD } from "./systems/dailyLoginCalendar";
import { getActiveFortuneDef, tickDailyFortune } from "./systems/dailyFortune";
import { renderCelestialStashPanel, updateCelestialStashPanelReadouts } from "./ui/celestialStashPanel";
import { tryBuyCelestialOffer } from "./systems/celestialStash";
import { tryUpgradeSpiritArray } from "./systems/spiritArray";
import {
  reservoirCap,
  reservoirFillRatio,
  reservoirStored,
  canClaimSpiritReservoir,
  claimSpiritReservoir,
} from "./systems/spiritReservoir";
import { renderDaoMeridianPanel } from "./ui/daoMeridianPanel";
import { renderChroniclePanel } from "./ui/chroniclePanel";
import { tryBuyDaoMeridian } from "./systems/daoMeridian";
import {
  claimAllCompletableWeeklyBounties,
  claimWeeklyBountyTask,
  noteWeeklyBountyBreakthrough,
} from "./systems/weeklyBounty";
import {
  plantCrop,
  harvestPlot,
  GARDEN_CROPS,
  GARDEN_PLOT_COUNT,
  plotGrowRemainingMs,
  isPlotReady,
} from "./systems/spiritGarden";
import {
  playerAttack,
  playerMaxHp,
  playerCritChance,
  playerCritMult,
  essenceFindMult,
  playerResAllSum,
  playerExpectedDps,
  playerCombatPower,
  playerDefenseRating,
  playerIncomingDamageMult,
  playerDungeonDodgeChance,
  playerDungeonAttackRangeMult,
  playerDungeonAttackSpeedMult,
  playerDungeonSustainedDamageMult,
} from "./systems/playerCombat";
import {
  enterDungeon,
  leaveDungeon,
  tryAutoEnterFromSanctuaryPortal,
  requestBossChallenge,
  canEnterDungeon,
  canEnterAtWave,
  dungeonFrontierWave,
  drainDungeonDamageFloats,
  bossDisplayTitle,
  currentBossMob,
  playerEngageRadiusNorm,
  queueDungeonDodge,
  totalAliveMobHpSum,
} from "./systems/dungeon";
import {
  ownedPetIds,
  petSystemUnlocked,
  petStoneIncomeMult,
  petDungeonAtkAdditive,
  petDungeonDefenseFlat,
  petEssenceFindMult,
} from "./systems/pets";
import { playerExpectedDpsDungeonAffix } from "./systems/dungeonAffix";
import { elementDamageMultiplier } from "./systems/elementCombat";
import { playerBattleElement } from "./systems/playerElement";
import { pullPet } from "./systems/petGacha";
import { secondsToNextLevel, skillXpPerSecond, xpToNextLevel } from "./systems/skillTraining";
import { enhanceGear, equipGear, tryRefineUr, unequipGear } from "./systems/gearCraft";
import { describeGearForgeTierLine } from "./systems/gearGachaTier";
import { salvageCard, salvageGear, toggleGearLock } from "./systems/salvage";
import { pullBattleSkill, battleSkillPullCost, describeBattleSkillLevels } from "./systems/battleSkills";
const EL_ZH: Record<string, string> = {
  metal: "金",
  wood: "木",
  water: "水",
  fire: "火",
  earth: "土",
};

const RARITY_ZH: Record<Rarity, string> = {
  N: "凡品",
  R: "灵品",
  SR: "珍品",
  SSR: "绝品",
  UR: "天极",
};

function rarityZh(r: Rarity): string {
  return RARITY_ZH[r] ?? r;
}

/** 界面数字短写（中文量级，避免英文 K/M/B） */
function fmtNumZh(n: number): string {
  if (!Number.isFinite(n)) return "—";
  if (n >= 1e12) return (n / 1e12).toFixed(2) + "兆";
  if (n >= 1e8) return (n / 1e8).toFixed(2) + "亿";
  if (n >= 1e4) return (n / 1e4).toFixed(2) + "万";
  if (n >= 100) return n.toFixed(0);
  if (n >= 10) return n.toFixed(1);
  return n.toFixed(2);
}

/** 幻域本局用时 / 预计清怪剩余（秒 → 展示） */
function fmtDungeonDur(sec: number): string {
  if (!Number.isFinite(sec) || sec < 0) return "—";
  if (sec < 60) return `${Math.max(0, Math.floor(sec))} 秒`;
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${String(s).padStart(2, "0")}`;
}

function duelComboTierLabel(stacks: number): string {
  if (stacks <= 0) return "蓄势";
  if (stacks <= 3) return "连斩";
  if (stacks <= 7) return "破军";
  if (stacks <= 11) return "贯虹";
  return "无双";
}

/** 离线结算时长展示 */
function fmtOfflineDurationSec(sec: number): string {
  const s = Math.max(0, Math.floor(sec));
  if (s < 60) return `${s} 秒`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m} 分`;
  const h = Math.floor(m / 60);
  const mr = m % 60;
  return `${h} 小时 ${mr} 分`;
}

function fmtSkillEta(sec: number | null): string {
  if (sec == null) return "—";
  if (sec <= 0) return "即将突破";
  if (sec < 60) return `约 ${Math.ceil(sec)} 秒`;
  if (sec < 3600) {
    const m = Math.floor(sec / 60);
    const s = Math.ceil(sec % 60);
    return `约 ${m} 分 ${s} 秒`;
  }
  return `约 ${Math.floor(sec / 60)} 分钟`;
}

let state: GameState = loadGame();
let selectedInvId: string | null = null;
/** 养成→卡组：点击阵位后弹层中编辑该位；null 表示未打开弹层 */
let deckModalSlot: number | null = null;
/** 装备精炼：先点主件，再点同基底同品阶作为消耗 */
let refineTargetId: string | null = null;
/** 装备页：正在查看哪一栏位的已装备详情（卸下仅在此操作） */
let gearDetailSlot: "weapon" | "body" | "ring" | null = null;
/** 聚灵阵：灵卡池 / 境界铸灵 */
let gachaPool: "cards" | "gear" = "cards";
let autoEnterPromptHandled = false;
let veinHelpDocListenerBound = false;
/** 主导航：底部五栏（灵府→养成→幻域→抽卡→角色）+ 部分页内二级子栏 */
type HubId = "character" | "cultivate" | "battle" | "gacha" | "estate";
type EstateSub = "idle" | "vein" | "array" | "garden";
type CultivateSub =
  | "deck"
  | "train"
  | "pets"
  | "codex"
  | "meta"
  | "ach"
  | "bounty"
  | "chronicle"
  | "daily"
  | "stash"
  | "xinfa";
type CharacterSub =
  | "stats"
  | "cards"
  | "gear"
  | "guides"
  | "settings"
  | "data"
  | "archive"
  | "meridian";

let activeHub: HubId = "estate";
let estateSub: EstateSub = "idle";
let cultivateSub: CultivateSub = "deck";
let characterSub: CharacterSub = "stats";
let topBarExtrasExpanded = false;
/** 快捷键说明浮层（? / 偏好页按钮） */
let showKeyboardHelpModal = false;
/** 关于游戏浮层（偏好页按钮） */
let showAboutModal = false;
/** 上一次完整 render 对应的主内容视图（用于同页操作时恢复 .hub-page-scroll 滚动） */
let lastMainContentViewKey = "";
/** 主循环间隔：过小会增加 CPU，过大则幻域位移像「瞬移」跨格 */
const LOOP_INTERVAL_MS = 50;

let toastTimer = 0;
let flyCreditsDismissed = false;
const deferredDungeonToasts: string[] = [];
let lastDungeonActive = false;
/** 幻域飘字爆发时刻（用于决斗舞台短促亮度反馈） */
let duelFloatBurstAtMs = 0;
const reducedMotionQuery =
  typeof window !== "undefined" ? window.matchMedia("(prefers-reduced-motion: reduce)") : null;
let prefersReducedMotion = reducedMotionQuery?.matches ?? false;
let modernFxPointerBound = false;
let modernFxPointerX = 0.5;
let modernFxPointerY = 0.2;
let motionUiFxBound = false;
let mobileLiteFx = false;
let pixiFxBooted = false;
let pixiApp: Application | null = null;
let pixiLayer: Container | null = null;
type PixiParticle = { g: Graphics; vx: number; vy: number; ttl: number; life: number };
const pixiParticles: PixiParticle[] = [];

function initPixiFxLayer(): void {
  if (typeof document === "undefined" || pixiFxBooted) return;
  pixiFxBooted = true;
  void (async () => {
    try {
      const app = new Application();
      await app.init({
        width: Math.max(1, window.innerWidth),
        height: Math.max(1, window.innerHeight),
        backgroundAlpha: 0,
        antialias: true,
        autoDensity: true,
        resolution: Math.min(2, window.devicePixelRatio || 1),
      });
      const canvas = app.canvas as HTMLCanvasElement;
      canvas.className = "modern-pixi-layer";
      document.body.appendChild(canvas);
      const layer = new Container();
      app.stage.addChild(layer);
      app.ticker.add((ticker: Ticker) => {
        const deltaMs = ticker.deltaMS;
        for (let i = pixiParticles.length - 1; i >= 0; i -= 1) {
          const p = pixiParticles[i]!;
          p.life += deltaMs;
          const t = Math.min(1, p.life / p.ttl);
          p.g.x += (p.vx * deltaMs) / 16.6667;
          p.g.y += (p.vy * deltaMs) / 16.6667;
          p.g.alpha = 1 - t;
          const s = 1 + t * 0.9;
          p.g.scale.set(s, s);
          if (t >= 1) {
            p.g.removeFromParent();
            p.g.destroy();
            pixiParticles.splice(i, 1);
          }
        }
      });
      window.addEventListener(
        "resize",
        () => {
          app.renderer.resize(Math.max(1, window.innerWidth), Math.max(1, window.innerHeight));
        },
        { passive: true },
      );
      pixiApp = app;
      pixiLayer = layer;
    } catch {
      pixiApp = null;
      pixiLayer = null;
    }
  })();
}

function emitPixiBurst(clientX: number, clientY: number, intensity: "normal" | "high" = "normal"): void {
  if (!pixiApp || !pixiLayer || prefersReducedMotion) return;
  const n = intensity === "high" ? 30 : 14;
  const speed = intensity === "high" ? 7.6 : 5.4;
  const palette = intensity === "high" ? [0xfff2b1, 0xffb6f8, 0x8fe8ff, 0xaac4ff] : [0x9bb8ff, 0x81d8ff, 0x9ff1d4];
  for (let i = 0; i < n; i += 1) {
    const g = new Graphics();
    const r = intensity === "high" ? 1.8 + Math.random() * 3.6 : 1.3 + Math.random() * 2.2;
    const c = palette[(Math.random() * palette.length) | 0]!;
    g.circle(0, 0, r);
    g.fill({ color: c, alpha: 0.95 });
    g.x = clientX;
    g.y = clientY;
    const a = Math.random() * Math.PI * 2;
    const mag = speed * (0.6 + Math.random() * 1.1);
    pixiLayer.addChild(g);
    pixiParticles.push({
      g,
      vx: Math.cos(a) * mag,
      vy: Math.sin(a) * mag - (intensity === "high" ? 1.8 : 0.9),
      ttl: intensity === "high" ? 720 + Math.random() * 380 : 520 + Math.random() * 260,
      life: 0,
    });
  }
}

function bindMotionUiFx(): void {
  if (typeof document === "undefined" || motionUiFxBound) return;
  motionUiFxBound = true;
  // 取消页签/按钮按压特效与粒子，避免移动端卡顿与风格不一致。
}

function playRevealOverlayIntro(overlay: HTMLElement, liteFx: boolean): void {
  if (liteFx || prefersReducedMotion) {
    overlay.classList.add("gacha-reveal-active");
    return;
  }
  const content = overlay.querySelector(".gacha-reveal-content") as HTMLElement | null;
  const cards = [...overlay.querySelectorAll(".gacha-reveal-card")] as HTMLElement[];
  gsap.set(overlay, { opacity: 0 });
  if (content) gsap.set(content, { opacity: 0, y: 24, scale: 0.95, filter: "blur(8px)" });
  gsap.set(cards, { opacity: 0, y: 16, rotateX: -12, transformOrigin: "50% 100%" });
  const tl = gsap.timeline();
  tl.to(overlay, { opacity: 1, duration: 0.2, ease: "power2.out" });
  if (content) {
    tl.to(content, { opacity: 1, y: 0, scale: 1, filter: "blur(0px)", duration: 0.5, ease: "power3.out" }, 0.02);
  }
  if (cards.length > 0) {
    tl.to(cards, { opacity: 1, y: 0, rotateX: 0, duration: 0.4, stagger: 0.05, ease: "back.out(1.35)" }, 0.12);
  }
  overlay.classList.add("gacha-reveal-active");
}

function playRevealOverlayExit(overlay: HTMLElement, liteFx: boolean, done: () => void): void {
  if (liteFx || prefersReducedMotion) {
    window.setTimeout(done, 140);
    return;
  }
  const content = overlay.querySelector(".gacha-reveal-content") as HTMLElement | null;
  gsap.to(content, {
    opacity: 0,
    y: -10,
    scale: 0.98,
    filter: "blur(4px)",
    duration: 0.22,
    ease: "power2.in",
  });
  gsap.to(overlay, {
    opacity: 0,
    duration: 0.28,
    ease: "power2.in",
    onComplete: done,
  });
}

function bindModernFxInteraction(): void {
  if (typeof document === "undefined" || modernFxPointerBound) return;
  modernFxPointerBound = true;
  // 取消鼠标追踪光效：保持静态中心点即可。
  modernFxPointerX = 0.5;
  modernFxPointerY = 0.2;
  reducedMotionQuery?.addEventListener("change", (ev) => {
    prefersReducedMotion = ev.matches;
  });
}

function shouldUseMobileLiteFx(): boolean {
  if (typeof window === "undefined") return false;
  const coarse = window.matchMedia?.("(pointer: coarse)")?.matches ?? false;
  const narrow = window.matchMedia?.("(max-width: 900px)")?.matches ?? false;
  const lowCpu = typeof navigator !== "undefined" && (navigator.hardwareConcurrency ?? 8) <= 6;
  return coarse || narrow || lowCpu;
}

function updateModernVisualFx(now: number): void {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  const cycle = 28000;
  const t = ((now % cycle) + cycle) / cycle;
  const pulse = (Math.sin((now / 1800) * Math.PI * 2) + 1) * 0.5;
  const hubHue: Record<HubId, number> = {
    estate: 0,
    cultivate: -20,
    battle: 22,
    gacha: 34,
    character: -10,
  };
  const pullDensity = Math.min(1, Math.log10(Math.max(10, state.totalPulls + 10)) / 4);
  const resonance = (((state.wishResonance % 100) + 100) % 100) / 100;
  const hue = 220 + hubHue[activeHub] + pulse * 22 + resonance * 18;
  const energy = 0.34 + 0.38 * pullDensity + 0.28 * resonance;
  root.style.setProperty("--modern-fx-hue", `${hue.toFixed(2)}deg`);
  root.style.setProperty("--modern-fx-energy", energy.toFixed(3));
  root.style.setProperty("--modern-fx-t", t.toFixed(4));
  root.style.setProperty("--modern-fx-mx", `${(modernFxPointerX * 100).toFixed(2)}%`);
  root.style.setProperty("--modern-fx-my", `${(modernFxPointerY * 100).toFixed(2)}%`);
  root.classList.toggle("fx-reduce-motion", prefersReducedMotion);
}

function tryToast(msg: string): void {
  if (typeof document !== "undefined" && document.visibilityState === "hidden") {
    deferredDungeonToasts.push(msg);
    return;
  }
  toast(msg);
}

const TOAST_DUNGEON_VICTORY_MS = 6000;

function toastDungeonVictory(msg: string): void {
  const w = document.getElementById("toast-wrap");
  if (!w) return;
  const el = document.createElement("div");
  el.className = "toast toast-dungeon-victory";
  const body = document.createElement("div");
  body.className = "toast-msg";
  body.textContent = msg;
  el.appendChild(body);
  appendToastProgress(el, TOAST_DUNGEON_VICTORY_MS);
  w.appendChild(el);
  window.setTimeout(() => el.remove(), TOAST_DUNGEON_VICTORY_MS);
  void resumeAudioContext().then(() => playUiBlip(state));
}

function tryToastDungeonVictory(msg: string): void {
  if (typeof document !== "undefined" && document.visibilityState === "hidden") {
    deferredDungeonToasts.push(msg);
    return;
  }
  toastDungeonVictory(msg);
}

function nowMs(): number {
  return Date.now();
}

function fmt(n: number): string {
  return fmtNumZh(n);
}

const TOAST_DURATION_MS = 4200;
const TOAST_ACHIEVEMENT_DURATION_MS = 6200;
const CURRENCY_HINT_TOAST_MS = 10000;
const CURRENCY_LONG_PRESS_MS = 450;
const DODGE_FAIL_TOAST_GAP_MS = 900;
let lastDodgeFailToastAt = 0;
const AUTO_ENTER_FAIL_TOAST_GAP_MS = 3000;
let lastAutoEnterFailToastAt = 0;
let lastAutoEnterFailReason = "";
let lastCombatPower = 0;
const COMBAT_POWER_POPUP_DURATION_MS = 1000;
const COMBAT_POWER_POPUP_HOLD_MS = 520;
let combatPowerPopupEl: HTMLDivElement | null = null;
let combatPowerPopupBaseEl: HTMLSpanElement | null = null;
let combatPowerPopupDeltaEl: HTMLSpanElement | null = null;
let combatPowerPopupToken = 0;
let combatPowerPopupHideTimer = 0;
let combatPowerPopupAnim:
  | { startAt: number; startBase: number; endBase: number; startDelta: number; endDelta: number; token: number }
  | null = null;

/** 顶栏货币/条目：长按或右键查看用途（文案供 toast 多行展示） */
const CURRENCY_HINTS: Record<string, string> = {
  stone:
    "灵石\n\n基础货币。用于破境、灵卡升阶、洞府升级等。主要来自每秒产出，也可由玩法和成就获得。",
  essence:
    "唤灵髓\n\n用于抽卡、进入幻域、抽取心法。主要由共鸣进度生成，也可由玩法和成就获得。不能用灵石直接购买。",
  realm: "境界\n\n当前境界等级。影响属性和功能解锁。可在「灵府→灵脉」消耗灵石提升。",
  dao: "道韵\n\n轮回结算获得。用于「养成→轮回」中的元强化。轮回后保留。",
  zao: "造化玉\n\n用于解锁便利功能。可通过成就等方式获得。",
  lingSha: "灵砂\n\n灵卡相关资源。升阶灵卡时除灵石外需消耗灵砂；分解灵卡可获得灵砂。",
  xuanTie: "玄铁\n\n装备相关资源。铸灵装备强化消耗玄铁；分解装备可获得玄铁。",
  power:
    "战力\n\n综合攻、防、生命、暴击、闪避等战斗属性的总分。会随装备、境界、技能、轮回、灵宠等实时变化。",
};

function appendToastProgress(el: HTMLElement, durationMs: number): void {
  const track = document.createElement("div");
  track.className = "toast-progress";
  track.setAttribute("aria-hidden", "true");
  const bar = document.createElement("span");
  bar.className = "toast-progress-bar";
  bar.style.animationDuration = `${durationMs}ms`;
  track.appendChild(bar);
  el.appendChild(track);
}

function toast(msg: string): void {
  const w = document.getElementById("toast-wrap");
  if (!w) return;
  const el = document.createElement("div");
  el.className = "toast";
  const body = document.createElement("div");
  body.className = "toast-msg";
  body.textContent = msg;
  if (msg.includes("\n")) body.style.whiteSpace = "pre-line";
  el.appendChild(body);
  appendToastProgress(el, TOAST_DURATION_MS);
  w.appendChild(el);
  window.setTimeout(() => el.remove(), TOAST_DURATION_MS);
}

function toastCurrencyHint(text: string): void {
  const w = document.getElementById("toast-wrap");
  if (!w) return;
  const el = document.createElement("div");
  el.className = "toast toast-currency-hint";
  const body = document.createElement("div");
  body.className = "toast-msg";
  body.textContent = text;
  el.appendChild(body);
  appendToastProgress(el, CURRENCY_HINT_TOAST_MS);
  w.appendChild(el);
  window.setTimeout(() => el.remove(), CURRENCY_HINT_TOAST_MS);
}

function showCurrencyHintById(id: string): void {
  const t = CURRENCY_HINTS[id];
  if (t) toastCurrencyHint(t);
}

function tryQueueDungeonDodgeWithFeedback(): void {
  if (!state.dungeon.active) return;
  const d = state.dungeon;
  const now = nowMs();
  const canToast = now - lastDodgeFailToastAt >= DODGE_FAIL_TOAST_GAP_MS;
  const toastOnce = (msg: string): void => {
    if (!canToast) return;
    lastDodgeFailToastAt = now;
    toast(msg);
  };
  if (now < d.playerMoveLockUntil) {
    toastOnce("当前处于硬直，暂时无法闪避。");
    return;
  }
  if (d.stamina < DUNGEON_DODGE_STAMINA_COST) {
    toastOnce(`体力不足：闪避需 ${DUNGEON_DODGE_STAMINA_COST} 点体力。`);
    return;
  }
  if (now < d.dodgeIframesUntil) {
    toastOnce("闪避冷却中。");
    return;
  }
  queueDungeonDodge(state);
}

function maybeToastAutoEnterFailure(now: number): void {
  if (!state.dungeonSanctuaryMode || state.dungeon.active) {
    lastAutoEnterFailReason = "";
    return;
  }
  const w = state.dungeonPortalTargetWave;
  if (w < 1) {
    lastAutoEnterFailReason = "";
    return;
  }
  const pmax = playerMaxHp(state);
  if (state.combatHpCurrent < pmax - 0.25) {
    lastAutoEnterFailReason = "";
    return;
  }
  if (!canEnterDungeon(state, now) || !canEnterAtWave(state, w)) {
    const reason = "not-eligible";
    if (reason === lastAutoEnterFailReason) return;
    if (now - lastAutoEnterFailToastAt < AUTO_ENTER_FAIL_TOAST_GAP_MS) return;
    lastAutoEnterFailReason = reason;
    lastAutoEnterFailToastAt = now;
    toast("自动进本未触发：当前条件不满足（冷却或关卡不可进）。");
    return;
  }
  lastAutoEnterFailReason = "";
}

/** 顶栏货币：长按显示说明（仅长按，避免与日常操作冲突） */
function setupCurrencyHintInteractions(): void {
  let timer: number | null = null;
  let ptrId: number | null = null;
  const clearTimer = (): void => {
    if (timer != null) {
      clearTimeout(timer);
      timer = null;
    }
    ptrId = null;
  };
  document.addEventListener(
    "pointerdown",
    (e) => {
      const chip = (e.target as HTMLElement | null)?.closest?.("[data-currency-hint-id]");
      if (!chip || !(chip as HTMLElement).closest("#top-bar")) return;
      const id = (chip as HTMLElement).dataset.currencyHintId;
      if (!id || !CURRENCY_HINTS[id]) return;
      if (e.pointerType === "mouse" && e.button !== 0) return;
      clearTimer();
      ptrId = e.pointerId;
      timer = window.setTimeout(() => {
        timer = null;
        ptrId = null;
        showCurrencyHintById(id);
      }, CURRENCY_LONG_PRESS_MS);
    },
    true,
  );
  const onPtrEnd = (e: PointerEvent): void => {
    if (ptrId !== null && e.pointerId === ptrId && timer != null) {
      clearTimeout(timer);
      timer = null;
      ptrId = null;
    }
  };
  document.addEventListener("pointerup", onPtrEnd);
  document.addEventListener("pointercancel", onPtrEnd);
}

function toastAchievement(a: AchievementDef): void {
  const w = document.getElementById("toast-wrap");
  if (!w) return;
  const el = document.createElement("div");
  el.className = "toast toast-achievement";
  const reward =
    (a.rewardStones > 0 ? `灵石 +${fmtNumZh(a.rewardStones)} ` : "") +
    (a.rewardEssence > 0 ? `唤灵髓 +${a.rewardEssence}` : "");
  const body = document.createElement("div");
  body.className = "toast-msg toast-msg-achievement";
  body.innerHTML = `<div class="toast-ach-title">功业达成</div><div class="toast-ach-name">${a.title}</div><div class="toast-ach-desc">${a.desc}</div>${
    reward ? `<div class="toast-ach-reward">${reward}</div>` : ""
  }`;
  el.appendChild(body);
  appendToastProgress(el, TOAST_ACHIEVEMENT_DURATION_MS);
  w.appendChild(el);
  window.setTimeout(() => el.remove(), TOAST_ACHIEVEMENT_DURATION_MS);
}

function formatPullResults(results: PullResult[]): string {
  return results
    .map((r) => {
      const tag = r.isNew ? "初见" : r.duplicateStars ? "星辉+1" : "再遇";
      return `${r.card.name}「${rarityZh(r.card.rarity)}」${tag}`;
    })
    .join(" · ");
}

type RevealFxVariant = "meteor" | "rift" | "nova";
type CardFxVariant = "fly" | "flip" | "drift";

function pickRevealFxVariant(): RevealFxVariant {
  const v = Math.floor(Math.random() * 3);
  if (v === 0) return "meteor";
  if (v === 1) return "rift";
  return "nova";
}

function pickCardFxVariant(i: number, salt: number): CardFxVariant {
  const v = (i + salt) % 3;
  if (v === 0) return "fly";
  if (v === 1) return "flip";
  return "drift";
}

function shouldUseLiteRevealFx(): boolean {
  if (typeof window === "undefined") return false;
  const prefersReduced = window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches ?? false;
  const coarsePointer = window.matchMedia?.("(pointer: coarse)")?.matches ?? false;
  const narrowScreen = window.matchMedia?.("(max-width: 720px)")?.matches ?? false;
  const lowCpu = typeof navigator !== "undefined" && (navigator.hardwareConcurrency ?? 8) <= 6;
  const lowMem =
    typeof navigator !== "undefined" &&
    "deviceMemory" in navigator &&
    ((navigator as Navigator & { deviceMemory?: number }).deviceMemory ?? 8) <= 4;
  return prefersReduced || (coarsePointer && (narrowScreen || lowCpu || lowMem));
}

/** 全屏抽卡演出：关闭后再刷新界面并弹出汇总提示 */
function showGachaRevealOverlay(results: PullResult[], bonusStones: number, toastMsg: string, onDone: () => void): void {
  const overlay = document.createElement("div");
  const liteFx = shouldUseLiteRevealFx();
  const hi = highestRarityInPulls(results);
  const single = results.length === 1;
  const r0 = results[0]!.card.rarity;
  const orbTier = single ? r0 : hi;
  const fx = liteFx ? "rift" : pickRevealFxVariant();
  const cardSalt = Math.floor(Math.random() * 9);
  overlay.className = `gacha-reveal-overlay ${liteFx ? "gacha-reveal-lite" : ""} ${single ? `gacha-single reveal-${r0}` : `gacha-ten reveal-hi-${hi}`}`;
  overlay.setAttribute("role", "dialog");
  overlay.setAttribute("aria-modal", "true");

  const hasJackpot = hi === "UR" || hi === "SSR";
  if (!liteFx && hasJackpot && typeof navigator !== "undefined" && navigator.vibrate) {
    try {
      navigator.vibrate(hi === "UR" ? [20, 50, 30, 50, 40] : [18, 35, 18]);
    } catch {
      /* ignore */
    }
  }
  if (hasJackpot) {
    emitPixiBurst(window.innerWidth * 0.5, window.innerHeight * 0.34, "high");
  }

  const rarityCorner = (r: Rarity): string =>
    r === "SSR"
      ? `<img class="gacha-reveal-rarity-badge" src="${RARITY_BADGE_SSR}" alt="" width="36" height="36" />`
      : r === "UR"
        ? `<img class="gacha-reveal-rarity-badge" src="${RARITY_BADGE_UR}" alt="" width="40" height="40" />`
        : "";
  const cardsHtml = results
    .map((r, i) => {
      const tag = r.isNew ? "初见" : r.duplicateStars ? "星辉+1" : "再遇";
      const cardFx = pickCardFxVariant(i, cardSalt);
      return `<div class="gacha-reveal-card ${liteFx ? "card-fx-lite" : `card-fx-${cardFx}`} rarity-${r.card.rarity} tier-${r.card.rarity}" style="--stagger:${liteFx ? 0 : i}">
        ${rarityCorner(r.card.rarity)}
        <span class="gacha-reveal-card-name">${r.card.name}</span>
        <span class="gacha-reveal-card-r">${rarityZh(r.card.rarity)}</span>
        <span class="gacha-reveal-card-tag">${tag}</span>
      </div>`;
    })
    .join("");

  const bonusLine = bonusStones > 0 ? `<p class="gacha-reveal-bonus">额外灵石 +${fmtNumZh(bonusStones)}</p>` : "";

  overlay.innerHTML = `
    <div class="gacha-reveal-sparkles" aria-hidden="true"></div>
    <div class="gacha-reveal-backdrop bd-${orbTier}"></div>
    <div class="gacha-reveal-content fx-${fx} ${hasJackpot ? "is-high" : ""} ${results.length > 1 ? "is-ten" : "is-one"}" data-hi="${hi}">
      <div class="gacha-reveal-orb orb-${orbTier}" aria-hidden="true"></div>
      <p class="gacha-reveal-title tit-${orbTier}">${results.length > 1 ? "十连结果" : "抽卡结果"}</p>
      <div class="gacha-reveal-cards">${cardsHtml}</div>
      ${bonusLine}
      <p class="gacha-reveal-dismiss">点击任意处继续</p>
    </div>
  `;

  let closed = false;
  const finish = (): void => {
    if (closed) return;
    closed = true;
    overlay.classList.add("gacha-reveal-exit");
    playRevealOverlayExit(overlay, liteFx, () => {
      overlay.remove();
      toast(toastMsg);
      onDone();
    });
  };

  overlay.addEventListener("click", () => finish());
  document.body.appendChild(overlay);
  requestAnimationFrame(() => playRevealOverlayIntro(overlay, liteFx));
  const autoMs = liteFx ? (results.length === 1 ? 1300 : 1900 + results.length * 60) : results.length === 1 ? 3200 : 4200 + results.length * 120;
  window.setTimeout(() => finish(), autoMs);
}

function highestGearRarityInList(gears: GearItem[]): Rarity {
  const order: Rarity[] = ["N", "R", "SR", "SSR", "UR"];
  let best: Rarity = "N";
  for (const g of gears) {
    if (order.indexOf(g.rarity) > order.indexOf(best)) best = g.rarity;
  }
  return best;
}

function showGearRevealOverlay(gears: GearItem[], toastMsg: string, onDone: () => void): void {
  const overlay = document.createElement("div");
  const liteFx = shouldUseLiteRevealFx();
  const hi = highestGearRarityInList(gears);
  const single = gears.length === 1;
  const r0 = gears[0]!.rarity;
  const orbTier = single ? r0 : hi;
  const fx = liteFx ? "rift" : pickRevealFxVariant();
  const cardSalt = Math.floor(Math.random() * 9);
  overlay.className = `gacha-reveal-overlay gacha-gear ${liteFx ? "gacha-reveal-lite" : ""} ${single ? `gacha-single reveal-${r0}` : `gacha-ten reveal-hi-${hi}`}`;
  overlay.setAttribute("role", "dialog");
  overlay.setAttribute("aria-modal", "true");
  const hasHigh = hi === "UR" || hi === "SSR";
  if (!liteFx && hasHigh && typeof navigator !== "undefined" && navigator.vibrate) {
    try {
      navigator.vibrate(hi === "UR" ? [18, 45, 25] : [15, 30, 15]);
    } catch {
      /* ignore */
    }
  }
  if (hasHigh) {
    emitPixiBurst(window.innerWidth * 0.5, window.innerHeight * 0.34, "high");
  }
  const gearRarityCorner = (r: Rarity): string =>
    r === "SSR"
      ? `<img class="gacha-reveal-rarity-badge" src="${RARITY_BADGE_SSR}" alt="" width="36" height="36" />`
      : r === "UR"
        ? `<img class="gacha-reveal-rarity-badge" src="${RARITY_BADGE_UR}" alt="" width="40" height="40" />`
        : "";
  const cardsHtml = gears
    .map((g, i) => {
      const pre = g.prefixes.length + g.suffixes.length;
      const cardFx = pickCardFxVariant(i, cardSalt);
      return `<div class="gacha-reveal-card ${liteFx ? "card-fx-lite" : `card-fx-${cardFx}`} gear-reveal rarity-${g.rarity} tier-${g.rarity}" style="--stagger:${liteFx ? 0 : i}">
        ${gearRarityCorner(g.rarity)}
        <span class="gacha-reveal-card-name">${g.displayName}</span>
        <span class="gacha-reveal-card-r">${rarityZh(g.rarity)} · ilvl ${g.itemLevel}</span>
        <span class="gacha-reveal-card-tag">${pre} 条词缀 · 强化 ${g.enhanceLevel}</span>
      </div>`;
    })
    .join("");
  overlay.innerHTML = `
    <div class="gacha-reveal-sparkles" aria-hidden="true"></div>
    <div class="gacha-reveal-backdrop bd-${orbTier}"></div>
    <div class="gacha-reveal-content fx-${fx} ${hasHigh ? "is-high" : ""} ${gears.length > 1 ? "is-ten" : "is-one"}" data-hi="${hi}">
      <div class="gacha-reveal-orb orb-${orbTier}" aria-hidden="true"></div>
      <p class="gacha-reveal-title tit-${orbTier}">${gears.length > 1 ? "境界铸灵 · 十连" : "境界铸灵"}</p>
      <div class="gacha-reveal-cards">${cardsHtml}</div>
      <p class="gacha-reveal-dismiss">点击任意处继续</p>
    </div>
  `;
  let closed = false;
  const finish = (): void => {
    if (closed) return;
    closed = true;
    overlay.classList.add("gacha-reveal-exit");
    playRevealOverlayExit(overlay, liteFx, () => {
      overlay.remove();
      toast(toastMsg);
      onDone();
    });
  };
  overlay.addEventListener("click", () => finish());
  document.body.appendChild(overlay);
  requestAnimationFrame(() => playRevealOverlayIntro(overlay, liteFx));
  const autoMs = liteFx ? (gears.length === 1 ? 1200 : 1800 + gears.length * 55) : gears.length === 1 ? 3000 : 4000 + gears.length * 100;
  window.setTimeout(() => finish(), autoMs);
}

function cardPortraitBlock(def: { rarity: Rarity; element: Element }, size: "md" | "sm"): string {
  const sm = size === "sm" ? " sm" : "";
  const w = size === "sm" ? 28 : 36;
  const badge = rarityBadgeSrc(def.rarity);
  const badgeHtml = badge
    ? `<img class="card-rarity-badge" src="${badge}" alt="" width="20" height="20" loading="lazy" />`
    : "";
  return `<div class="card-portrait-stack${sm}">${badgeHtml}<div class="card-portrait${sm} ${cardPortraitClass(def.rarity, def.element)}"><img src="${ELEMENT_ICON[def.element]}" alt="" width="${w}" height="${w}" loading="lazy" class="card-portrait-icon" /></div></div>`;
}

/** 灵宠数值（与战斗公式一致，供灵脉面板与主循环刷新；已结缘灵宠全局叠加） */
function petBonusRowsInnerHtml(st: GameState): { stone: string; dng: string; def: string; ess: string } {
  if (!petSystemUnlocked(st)) return { stone: "", dng: "", def: "", ess: "" };
  if (ownedPetIds(st).length === 0) {
    const empty = `— <span class="cs-sub">（结缘后生效）</span>`;
    return { stone: empty, dng: empty, def: empty, ess: empty };
  }
  return {
    stone: `×${petStoneIncomeMult(st).toFixed(4)}`,
    dng: `+${(petDungeonAtkAdditive(st) * 100).toFixed(2)}% 乘区`,
    def: `+${petDungeonDefenseFlat(st).toFixed(1)} <span class="cs-sub">（护体）</span>`,
    ess: `×${petEssenceFindMult(st).toFixed(4)} <span class="cs-sub">（与装备噬髓叠乘）</span>`,
  };
}

function incomePetLineHtml(st: GameState): string {
  if (!petSystemUnlocked(st)) return "";
  if (ownedPetIds(st).length === 0) return "灵宠：未结缘（「灵宠」页唤灵）";
  if (petStoneIncomeMult(st).minus(1).abs().lt(1e-9)) return "";
  return `灵宠灵石 ×<strong>${petStoneIncomeMult(st).toFixed(4)}</strong>（已计入秒产）`;
}

function showPetStoneCombatRow(st: GameState): boolean {
  return petSystemUnlocked(st) && ownedPetIds(st).length > 0 && petStoneIncomeMult(st).minus(1).abs().gte(1e-9);
}

function showPetDngCombatRow(st: GameState): boolean {
  return petSystemUnlocked(st) && ownedPetIds(st).length > 0 && Math.abs(petDungeonAtkAdditive(st)) >= 1e-8;
}

function showPetDefCombatRow(st: GameState): boolean {
  return petSystemUnlocked(st) && ownedPetIds(st).length > 0 && petDungeonDefenseFlat(st) >= 0.05;
}

function showPetEssCombatRow(st: GameState): boolean {
  return petSystemUnlocked(st) && ownedPetIds(st).length > 0 && Math.abs(petEssenceFindMult(st) - 1) >= 1e-6;
}

function showResBonusRow(st: GameState): boolean {
  return Math.abs(playerResAllSum(st)) >= 0.05;
}

function showEssenceBonusRow(st: GameState): boolean {
  return Math.abs(essenceFindMult(st) - 1) > 0.001;
}

/** 在线累计时长（秒）友好展示 */
function fmtPlaytimeSec(sec: number): string {
  if (!Number.isFinite(sec) || sec < 0) return "—";
  if (sec < 60) return `${Math.floor(sec)} 秒`;
  const m = Math.floor(sec / 60);
  if (m < 60) return `${m} 分钟`;
  const h = Math.floor(sec / 3600);
  const mm = Math.floor((sec % 3600) / 60);
  if (h < 72) return `${h} 小时 ${mm} 分`;
  const d = Math.floor(h / 24);
  const rh = h % 24;
  return `${d} 天 ${rh} 小时`;
}

function renderPlayerStatsBlock(st: GameState): string {
  const unique = st.codexUnlocked.size;
  const pool = totalCardsInPool();
  const achN = st.achievementsDone.size;
  const achTotal = ACHIEVEMENTS.length;
  const lifeDay = Math.max(1, st.inGameDay - st.lifeStartInGameDay + 1);
  const peak = fmtDecimal(new Decimal(st.peakSpiritStonesThisLife || "0"));
  const chp = st.combatHpCurrent;
  const mxhp = playerMaxHp(st);
  const pullsLife = st.pullsThisLife ?? 0;
  const petN = petSystemUnlocked(st) ? ownedPetIds(st).length : 0;
  const skillsLine = `战 ${st.skills.combat.level} · 采 ${st.skills.gathering.level} · 篆 ${st.skills.arcana.level}`;
  return `
    <div class="player-stats-block" id="player-stats-block">
      <div class="panel-title-art-row panel-title-art-row--sub">
        <img class="panel-title-art-icon" src="${UI_HEAD_STATS}" alt="" width="24" height="24" loading="lazy" />
        <h3 class="sub-h">入世统计</h3>
      </div>
      <p class="hint sm player-stats-lead">本存档汇总；灵石峰值为当世最高。</p>
      <div class="player-stats-grid">
        <div class="ps-stat"><span class="ps-stat-label">累计入世时长</span><strong id="ps-playtime">${fmtPlaytimeSec(st.playtimeSec)}</strong></div>
        <div class="ps-stat"><span class="ps-stat-label">本界日序</span><strong id="ps-life-day">第 ${lifeDay} 日</strong></div>
        <div class="ps-stat"><span class="ps-stat-label">境界</span><strong id="ps-stat-realm">${st.realmLevel}</strong></div>
        <div class="ps-stat"><span class="ps-stat-label">修炼技能</span><strong id="ps-stat-skills" class="ps-stat-long">${skillsLine}</strong></div>
        <div class="ps-stat"><span class="ps-stat-label">累计抽卡</span><strong id="ps-total-pulls">${st.totalPulls}</strong></div>
        <div class="ps-stat"><span class="ps-stat-label">本轮抽卡</span><strong id="ps-pulls-life">${pullsLife}</strong></div>
        <div class="ps-stat"><span class="ps-stat-label">幻域通关波次</span><strong id="ps-dungeon-waves">${st.dungeon.totalWavesCleared}</strong></div>
        <div class="ps-stat"><span class="ps-stat-label">最高推进波</span><strong id="ps-max-wave">${st.dungeon.maxWaveRecord}</strong></div>
        <div class="ps-stat"><span class="ps-stat-label">轮回次数</span><strong id="ps-reinc">${st.reincarnations}</strong></div>
        <div class="ps-stat"><span class="ps-stat-label">图鉴收集</span><strong id="ps-codex">${unique} / ${pool}</strong></div>
        <div class="ps-stat"><span class="ps-stat-label">功业达成</span><strong id="ps-ach">${achN} / ${achTotal}</strong></div>
        <div class="ps-stat"><span class="ps-stat-label">登录连签</span><strong id="ps-streak">${st.dailyStreak}</strong></div>
        <div class="ps-stat"><span class="ps-stat-label">本世灵石峰值</span><strong id="ps-peak-stone">${peak}</strong></div>
        <div class="ps-stat"><span class="ps-stat-label">幻域生命</span><strong id="ps-combat-hp">${fmtNumZh(Math.max(0, chp))} / ${mxhp}</strong></div>
        ${
          petSystemUnlocked(st)
            ? `<div class="ps-stat"><span class="ps-stat-label">结缘灵宠</span><strong id="ps-pet-n">${petN} 只</strong></div>`
            : ""
        }
      </div>
    </div>`;
}

function renderCombatStatsPanel(): string {
  const atk = playerAttack(state);
  const edps = playerExpectedDps(state);
  const hp = playerMaxHp(state);
  const cc = playerCritChance(state);
  const cm = playerCritMult(state);
  const res = playerResAllSum(state);
  const em = essenceFindMult(state);
  const pDodge = playerDungeonDodgeChance(state);
  const pRangeNorm = playerEngageRadiusNorm(state);
  const pRangeMul = playerDungeonAttackRangeMult(state);
  const pAtkSpd = playerDungeonAttackSpeedMult(state);
  const pDmgTick = playerDungeonSustainedDamageMult(state);
  const defRating = playerDefenseRating(state);
  const refWave = state.dungeon.active ? state.dungeon.wave : Math.max(1, state.dungeon.maxWaveRecord);
  const incMul = playerIncomingDamageMult(state, refWave);
  const petUnlocked = petSystemUnlocked(state);
  const pr = petBonusRowsInnerHtml(state);
  const showRes = showResBonusRow(state);
  const showEss = showEssenceBonusRow(state);
  const psStone = showPetStoneCombatRow(state);
  const psDng = showPetDngCombatRow(state);
  const psDef = showPetDefCombatRow(state);
  const psEss = showPetEssCombatRow(state);
  const anyPetStat = petUnlocked && (psStone || psDng || psDef || psEss);
  const petNoBond = petUnlocked && ownedPetIds(state).length === 0;
  const petBlock = petUnlocked
    ? `<h3 class="sub-h">灵宠（通关幻域≥15 波 · 唤灵池）</h3>
      <p class="hint sm pet-bonus-hint">灵宠全局叠加，灵契随重复邂逅成长。</p>
      ${
        anyPetStat
          ? `<div class="combat-stats-grid combat-stats-grid-pet">
        ${psStone ? `<div class="cs-cell cs-cell-wide"><span class="cs-label">灵石乘区（全局）</span><strong id="ps-pet-stone">${pr.stone}</strong></div>` : ""}
        ${psDng ? `<div class="cs-cell cs-cell-wide"><span class="cs-label">幻域攻加算（全局）</span><strong id="ps-pet-dng">${pr.dng}</strong></div>` : ""}
        ${psDef ? `<div class="cs-cell cs-cell-wide"><span class="cs-label">护体（灵宠）</span><strong id="ps-pet-def">${pr.def}</strong></div>` : ""}
        ${psEss ? `<div class="cs-cell cs-cell-wide"><span class="cs-label">噬髓乘区（全局）</span><strong id="ps-pet-ess-part">${pr.ess}</strong></div>` : ""}
      </div>`
          : petNoBond
            ? `<p class="hint sm">尚未结缘，无灵宠加成。</p>`
            : `<p class="hint sm">当前无灵宠数值加成（或已叠至面板其它项）。</p>`
      }`
    : "";
  return `
    <div class="combat-stats-panel" id="combat-stats-panel">
      <div class="panel-title-art-row panel-title-art-row--sub">
        <img class="panel-title-art-icon" src="${UI_HEAD_COMBAT}" alt="" width="24" height="24" loading="lazy" />
        <h3 class="sub-h">身法与战斗属性</h3>
      </div>
      <p class="hint sm combat-stats-lead">攻防血暴为全局属性；护体减免幻域受击，来源含装备、境界、战艺、洞府固元、卡组厚土/溯流、心法、灵宠等。</p>
      <div class="combat-stats-grid">
        <div class="cs-cell"><span class="cs-label">境界</span><strong id="ps-realm">${state.realmLevel}</strong></div>
        <div class="cs-cell"><span class="cs-label">基础攻击</span><strong id="ps-atk">${fmtNumZh(atk)}</strong></div>
        <div class="cs-cell"><span class="cs-label">期望秒伤</span><strong id="ps-dps">${fmtNumZh(edps)}</strong></div>
        <div class="cs-cell"><span class="cs-label">生命</span><strong id="ps-hp">${hp}</strong></div>
        <div class="cs-cell"><span class="cs-label">护体</span><strong id="ps-def">${defRating.toFixed(1)}</strong></div>
        <div class="cs-cell"><span class="cs-label">幻域受击（参考）</span><strong id="ps-incmul">×${incMul.toFixed(3)}</strong> <span class="cs-sub" id="ps-incmul-wave">（第 ${refWave} 波）</span></div>
        <div class="cs-cell"><span class="cs-label">暴击率</span><strong id="ps-crit">${(cc * 100).toFixed(1)}%</strong></div>
        <div class="cs-cell"><span class="cs-label">暴伤倍率</span><strong id="ps-cm">${cm.toFixed(2)}×</strong></div>
        ${showRes ? `<div class="cs-cell"><span class="cs-label">全相抗性</span><strong id="ps-res">${res.toFixed(1)}%</strong></div>` : ""}
        ${showEss ? `<div class="cs-cell"><span class="cs-label">噬髓加成（合计）</span><strong id="ps-ess">${((em - 1) * 100).toFixed(1)}%</strong></div>` : ""}
        <div class="cs-cell cs-cell-wide"><span class="cs-label">幻域闪避</span><strong id="ps-dodge">${(pDodge * 100).toFixed(2)}%</strong></div>
        <div class="cs-cell cs-cell-wide"><span class="cs-label">幻域接战距离</span><strong id="ps-prange">${pRangeNorm.toFixed(4)} <span class="cs-sub">（基准 ×${pRangeMul.toFixed(3)}）</span></strong></div>
        <div class="cs-cell cs-cell-wide"><span class="cs-label">幻域攻击频率</span><strong id="ps-atkspd">×${pDmgTick.toFixed(3)}</strong> <span class="cs-sub">（攻速 ×${pAtkSpd.toFixed(2)} ÷ ${PLAYER_DUNGEON_HIT_INTERVAL_SEC}s 基准间隔）</span></div>
      </div>
      ${petBlock || ""}
    </div>`;
}

function advanceTutorialAfterPull(): void {
  if (state.tutorialStep === 3) {
    state.tutorialStep = 4;
    saveGame(state);
    toast("下一步：到「养成→卡组」上阵灵卡。升阶和分解在「角色→灵卡」。");
  }
}

/** 卡组上阵推进引导；若步进变化需整页重绘底栏脉动 */
function advanceTutorialAfterDeckAssign(): boolean {
  if (state.tutorialStep === 5) {
    state.tutorialStep = 6;
    saveGame(state);
    toast("下一步：到「灵府→洞府」强化一次。");
    return true;
  }
  return false;
}

function collectUnlockHintLines(u: ReturnType<typeof getUiUnlocks>): string[] {
  const unlockLines: string[] = [];
  if (!u.tabDungeon) {
    unlockLines.push("「<strong>幻域</strong>」解锁条件：抽卡≥1，或境界≥2，或曾通关幻域。");
  }
  if (!u.tabBattleSkills) {
    unlockLines.push("「<strong>养成→心法·领悟</strong>」与「幻域」同步解锁。");
  }
  if (!u.tabTrain) {
    unlockLines.push("「<strong>修炼</strong>」解锁条件：幻域通关 1 波，或境界≥3，或抽卡≥6。");
  }
  if (!u.tabGear) {
    unlockLines.push("「<strong>角色→行囊</strong>」解锁条件：抽卡≥10（或已持有装备）。");
  }
  if (!u.tabVein && state.tutorialStep !== 6 && state.tutorialStep !== 7) {
    unlockLines.push("「<strong>灵府→洞府</strong>」解锁条件：抽卡 1 次，或境界≥2。");
  }
  if (!u.tabGarden && u.tabVein) {
    unlockLines.push("「<strong>灵府→灵田</strong>」解锁条件：抽卡≥1 且 境界≥4。");
  }
  if (!u.tabCodex && u.tabVein) {
    unlockLines.push("「<strong>养成→图鉴</strong>」解锁条件：抽卡≥5，或境界≥4。");
  }
  if (!u.tabBounty) {
    unlockLines.push("「<strong>养成→周常悬赏</strong>」解锁条件：境界≥5，或抽卡≥5。");
  }
  if (!u.tabDailyLogin) {
    unlockLines.push("「<strong>养成→灵息·日历</strong>」解锁条件：抽卡≥1，或境界≥2。");
  }
  if (!u.tabSpiritReservoir) {
    unlockLines.push("「<strong>灵府→灵脉·蓄灵池</strong>」解锁条件：境界≥3，或抽卡≥3。");
  }
  if (!u.tabDailyFortune) {
    unlockLines.push("「<strong>灵府→灵脉·心斋卦象</strong>」解锁条件：境界≥4，或抽卡≥5。");
  }
  if (!u.tabSpiritArray) {
    unlockLines.push("「<strong>灵府→阵图·纳灵</strong>」解锁条件：境界≥5 且 抽卡≥2。");
  }
  if (!u.tabCelestialStash) {
    unlockLines.push("「<strong>养成→天机·匣</strong>」解锁条件：境界≥5，或抽卡≥6。");
  }
  if (!u.tabDaoMeridian) {
    unlockLines.push("「<strong>角色→道韵·灵窍</strong>」解锁条件：已轮回，或道韵≥15，或曾贯通灵窍。");
  }
  if (!u.tabChronicle) {
    unlockLines.push("「<strong>养成→唤灵通鉴</strong>」解锁条件：完成至少 1 次灵卡唤引。");
  }
  if (!u.tabMeta && u.tabCodex) {
    unlockLines.push("「<strong>养成→轮回</strong>」解锁条件：境界≥18，或已轮回。");
  }
  if (!u.tabPets && u.tabDungeon) {
    unlockLines.push("「<strong>灵宠</strong>」解锁条件：幻域累计通关 15 波。");
  }
  return unlockLines;
}

function renderUnlockHintsDetailsBlock(lines: string[]): string {
  if (state.tutorialStep !== 0) return "";
  if (lines.length === 0) return "";
  return `<details class="unlock-hints-details">
    <summary class="unlock-hints-summary">功能解锁条件</summary>
    <div class="unlock-hints unlock-hints-details-body">
      ${lines.map((t) => `<p class="unlock-hint">${t}</p>`).join("")}
      <p class="hint sm unlock-hint-more">更多说明见「养成→图鉴·札记」。</p>
    </div>
  </details>`;
}

/** 仅重绘卡组面板，避免整页 innerHTML */
function refreshDeckPanel(): void {
  const cur = document.getElementById("deck-panel-root");
  if (!cur) return;
  const modalInv = cur.querySelector("#deck-slot-modal .inventory--modal") as HTMLElement | null;
  const modalInvScrollTop = modalInv?.scrollTop ?? 0;
  const slots = effectiveDeckSlots(state);
  const w = document.createElement("div");
  w.innerHTML = renderDeck(slots);
  const next = w.firstElementChild as HTMLElement | null;
  if (next) {
    cur.replaceWith(next);
    const nextModalInv = next.querySelector("#deck-slot-modal .inventory--modal") as HTMLElement | null;
    if (nextModalInv) nextModalInv.scrollTop = modalInvScrollTop;
  }
  updateTopResourcePillsAndVigor(totalCardsInPool());
}

function refreshCharacterCardsPanel(): void {
  const cur = document.getElementById("character-cards-root");
  if (!cur) return;
  const inv = cur.querySelector(".inventory") as HTMLElement | null;
  const invScrollTop = inv?.scrollTop ?? 0;
  const w = document.createElement("div");
  w.innerHTML = renderCharacterCardsPanel();
  const next = w.firstElementChild as HTMLElement | null;
  if (next) {
    cur.replaceWith(next);
    const nextInv = next.querySelector(".inventory") as HTMLElement | null;
    if (nextInv) nextInv.scrollTop = invScrollTop;
  }
  updateTopResourcePillsAndVigor(totalCardsInPool());
}

function sortOwnedCardIds(): string[] {
  return Object.keys(state.owned).sort((a, b) => {
    const ca = getCard(a);
    const cb = getCard(b);
    if (!ca || !cb) return 0;
    const order = { UR: 0, SSR: 1, SR: 2, R: 3, N: 4 };
    const dr = (order[ca.rarity] ?? 9) - (order[cb.rarity] ?? 9);
    if (dr !== 0) return dr;
    return ca.name.localeCompare(cb.name, "zh-Hans-CN");
  });
}

/** 仓库列表行；selectedId 高亮 */
function buildCardInventoryRowsHtml(selectedId: string | null): string {
  let invHtml = "";
  for (const id of sortOwnedCardIds()) {
    const def = getCard(id)!;
    const o = state.owned[id]!;
    const sel = selectedId === id ? "selected" : "";
    invHtml += `
      <div class="inv-row ${sel}" data-inv="${id}">
        <div class="inv-row-visual">
          ${cardPortraitBlock({ rarity: def.rarity, element: def.element }, "sm")}
          <div>
            <span class="rarity-${def.rarity}">${def.name}</span>
            <span class="inv-meta"> · 等级 ${o.level} · 星辉 ${o.stars} · ${EL_ZH[def.element]}</span>
          </div>
        </div>
        <span class="inv-meta">${rarityZh(def.rarity)}</span>
      </div>
    `;
  }
  return invHtml;
}

/**
 * idPrefix: deck-modal（阵位弹层） / char（角色·灵卡）
 * showUnequip：仅弹层且当前阵位有卡时显示下阵
 */
function buildCardSelectedDetailHtml(
  idPrefix: string,
  showUnequip: boolean,
): string {
  const sel = selectedInvId ? getCard(selectedInvId) : null;
  const so = selectedInvId ? state.owned[selectedInvId] : null;
  const upgradeCost = so ? upgradeCardLevelCost(so.level) : new Decimal(0);
  const lsCost = so ? upgradeCardLingShaCost(so.level) : 0;
  const canUp =
    sel &&
    so &&
    so.level < MAX_CARD_LEVEL &&
    canAfford(state, upgradeCost) &&
    state.lingSha >= lsCost;
  const onDeck = selectedInvId ? state.deck.includes(selectedInvId) : false;
  return sel && so
    ? `<div class="deck-selected-card" id="${idPrefix}-selected-card">
         <strong>${sel.name}</strong>
         <p class="hint" style="margin:6px 0">${sel.flavor}</p>
         <div class="btn-row">
           <button class="btn btn-primary" type="button" id="${idPrefix}-btn-card-up" ${canUp ? "" : "disabled"}>
             升阶（${fmtDecimal(upgradeCost)} 灵石 + ${lsCost} 灵砂）→ 等级 ${Math.min(MAX_CARD_LEVEL, so.level + 1)}
           </button>
           <button class="btn btn-danger" type="button" id="${idPrefix}-btn-card-salvage" ${onDeck ? "disabled" : ""} title="${onDeck ? "请先下阵再分解" : ""}">分解得灵砂</button>
           <button class="btn" type="button" id="${idPrefix}-btn-clear-sel">取消选中</button>
           ${showUnequip ? `<button class="btn" type="button" id="${idPrefix}-btn-unequip-slot">下阵</button>` : ""}
         </div>
       </div>`
    : "";
}

function renderDeckSlotModalContent(slotIndex: number): string {
  const invHtml = buildCardInventoryRowsHtml(selectedInvId);
  const detail = buildCardSelectedDetailHtml("deck-modal", true);
  const curId = state.deck[slotIndex];
  const curHint = curId
    ? `当前：<span class="rarity-${getCard(curId)?.rarity}">${getCard(curId)?.name ?? "?"}</span> · 点下方灵卡上阵或替换`
    : "当前阵位为空 · 点选灵卡上阵";
  return `
    <div class="deck-slot-overlay" id="deck-slot-overlay" aria-modal="true" role="dialog">
      <div class="deck-slot-modal" id="deck-slot-modal">
        <button type="button" class="deck-slot-modal-close" id="deck-slot-modal-close" aria-label="关闭">×</button>
        <h3 class="deck-slot-modal-title">阵位 ${slotIndex + 1}</h3>
        <p class="hint sm">${curHint}</p>
        ${detail}
        <div class="inventory inventory--modal">${invHtml || '<p class="hint">暂无卡牌。</p>'}</div>
        <p class="hint sm">点选灵卡上阵本阵位；与阵位上同卡则仅选中。升阶/分解与角色页「灵卡」仓库相同。</p>
      </div>
    </div>`;
}

function renderCharacterCardsPanel(): string {
  const invHtml = buildCardInventoryRowsHtml(selectedInvId);
  const detail = buildCardSelectedDetailHtml("char", false);
  return `
    <section class="panel" id="character-cards-root">
      <h2>灵卡仓库</h2>
      <p class="hint">在此管理持有灵卡：升阶、分解。上阵需在「养成 → 卡组」点击阵位，在弹出层中布置。</p>
      <p class="inv-meta">持有灵砂：<strong>${state.lingSha}</strong></p>
      <p class="hint sm">低品自动分解请在底部「抽卡」灵卡池/境界铸灵勾选。</p>
      ${detail}
      <div class="inventory">${invHtml || '<p class="hint">暂无卡牌，去祈愿池试试。</p>'}</div>
    </section>`;
}

/** 仅重绘行囊装备面板 */
function refreshGearPanel(): void {
  const cur = document.getElementById("gear-panel-root");
  if (!cur || !getUiUnlocks(state).tabGear) return;
  const w = document.createElement("div");
  w.innerHTML = renderGearPanel(state, refineTargetId, gearDetailSlot, state.gearInventorySort);
  const next = w.firstElementChild as HTMLElement | null;
  if (next) cur.replaceWith(next);
  updateTopResourcePillsAndVigor(totalCardsInPool());
}

function handleGearPanelClick(e: MouseEvent): void {
  const t = e.target as HTMLElement;
  if (!t.closest("#gear-panel-root")) return;

  const sortEl = t.closest("[data-gear-inv-sort]");
  if (sortEl) {
    const m = (sortEl as HTMLElement).dataset.gearInvSort as GearInventorySortMode | undefined;
    if (m === "rarity" || m === "ilvl" || m === "slot" || m === "name") {
      state.gearInventorySort = m;
      saveGame(state);
      refreshGearPanel();
    }
    return;
  }

  const lockEl = t.closest("[data-gear-toggle-lock]");
  if (lockEl) {
    const id = (lockEl as HTMLElement).dataset.gearToggleLock;
    if (!id) return;
    const r = toggleGearLock(state, id);
    toast(r.msg);
    if (r.ok) {
      saveGame(state);
      refreshGearPanel();
    }
    return;
  }

  const openSlot = t.closest("[data-gear-open-slot]");
  if (openSlot) {
    const s = (openSlot as HTMLElement).dataset.gearOpenSlot as "weapon" | "body" | "ring" | undefined;
    if (!s) return;
    gearDetailSlot = gearDetailSlot === s ? null : s;
    refreshGearPanel();
    return;
  }
  if (t.closest("#btn-gear-detail-close")) {
    gearDetailSlot = null;
    refreshGearPanel();
    return;
  }

  const unequipD = t.closest("[data-gear-unequip-detail]");
  if (unequipD) {
    const s = (unequipD as HTMLElement).dataset.gearUnequipDetail as "weapon" | "body" | "ring" | undefined;
    if (!s) return;
    unequipGear(state, s);
    gearDetailSlot = null;
    saveGame(state);
    toast("已卸下");
    refreshGearPanel();
    return;
  }

  const refineEl = t.closest("[data-gear-refine]");
  if (refineEl) {
    const id = (refineEl as HTMLElement).dataset.gearRefine;
    if (!id) return;
    const g = state.gearInventory[id];
    if (!g || g.rarity !== "UR") return;
    if (refineTargetId === null) {
      refineTargetId = id;
      toast("已选精炼主件，再点另一件同基底天极作为消耗");
      refreshGearPanel();
      return;
    }
    if (refineTargetId === id) {
      refineTargetId = null;
      toast("已取消精炼选择");
      refreshGearPanel();
      return;
    }
    const r = tryRefineUr(state, refineTargetId, id);
    toast(r.msg);
    if (r.ok) {
      refineTargetId = null;
      saveGame(state);
      refreshGearPanel();
    }
    return;
  }

  const equipEl = t.closest("[data-gear-equip]");
  if (equipEl) {
    const id = (equipEl as HTMLElement).dataset.gearEquip;
    if (!id) return;
    const r = equipGear(state, id);
    if (r.ok) {
      saveGame(state);
      toast(r.msg);
      refreshGearPanel();
    }
    return;
  }

  const enhEl = t.closest("[data-gear-enhance]");
  if (enhEl) {
    const id = (enhEl as HTMLElement).dataset.gearEnhance;
    if (!id) return;
    const r = enhanceGear(state, id);
    toast(r.msg);
    if (r.ok) {
      saveGame(state);
      refreshGearPanel();
    }
    return;
  }

  const salvEl = t.closest("[data-gear-salvage]");
  if (salvEl) {
    const id = (salvEl as HTMLElement).dataset.gearSalvage;
    if (!id) return;
    const g = state.gearInventory[id];
    if (!g) return;
    if (!confirm(`确定分解「${g.displayName}」？`)) return;
    const r = salvageGear(state, id);
    toast(r.msg);
    if (r.ok) {
      saveGame(state);
      refreshGearPanel();
    }
  }
}

function tryUpgradeSelectedCard(): boolean {
  if (!selectedInvId) return false;
  const o = state.owned[selectedInvId];
  if (!o || o.level >= MAX_CARD_LEVEL) return false;
  const c = upgradeCardLevelCost(o.level);
  const ls = upgradeCardLingShaCost(o.level);
  if (!canAfford(state, c) || state.lingSha < ls) return false;
  if (!subStones(state, c)) return false;
  state.lingSha -= ls;
  o.level += 1;
  saveGame(state);
  toast("灵卡升阶有成");
  return true;
}

function handleDeckPanelClick(e: MouseEvent): void {
  const t = e.target as HTMLElement;
  const root = t.closest("#deck-panel-root");
  if (!root) return;

  if ((t as HTMLElement).id === "deck-slot-overlay") {
    deckModalSlot = null;
    refreshDeckPanel();
    return;
  }
  if (t.closest("#deck-slot-modal-close")) {
    deckModalSlot = null;
    refreshDeckPanel();
    return;
  }

  if (t.closest("#deck-modal-btn-card-up")) {
    if (!selectedInvId) return;
    if (tryUpgradeSelectedCard()) refreshDeckPanel();
    return;
  }
  if (t.closest("#deck-modal-btn-card-salvage")) {
    if (!selectedInvId) return;
    const def = getCard(selectedInvId);
    if (!def) return;
    if (!confirm(`确定分解「${def.name}」？将永久失去该卡。`)) return;
    const r = salvageCard(state, selectedInvId);
    toast(r.msg);
    if (r.ok) {
      selectedInvId = null;
      saveGame(state);
      refreshDeckPanel();
    }
    return;
  }
  if (t.closest("#deck-modal-btn-clear-sel")) {
    selectedInvId = null;
    refreshDeckPanel();
    return;
  }
  if (t.closest("#deck-modal-btn-unequip-slot")) {
    if (deckModalSlot === null) return;
    state.deck[deckModalSlot] = null;
    selectedInvId = null;
    saveGame(state);
    toast("已下阵");
    refreshDeckPanel();
    return;
  }

  const invInModal = t.closest("#deck-slot-modal [data-inv]");
  if (invInModal) {
    const id = (invInModal as HTMLElement).dataset.inv ?? null;
    if (!id || deckModalSlot === null) return;
    selectedInvId = id;
    const si = deckModalSlot;
    const slotCard = state.deck[si];
    if (slotCard === null || slotCard === undefined) {
      const prev = state.deck.indexOf(id);
      if (prev >= 0) state.deck[prev] = null;
      state.deck[si] = id;
      if (advanceTutorialAfterDeckAssign()) {
        render();
        return;
      }
      deckModalSlot = null;
      saveGame(state);
      refreshDeckPanel();
      return;
    }
    if (slotCard === id) {
      refreshDeckPanel();
      return;
    }
    const oldDef = getCard(slotCard);
    const newDef = getCard(id);
    if (
      !confirm(
        `阵位 ${si + 1} 已有「${oldDef?.name ?? "?"}」，是否替换为「${newDef?.name ?? "?"}」？`,
      )
    ) {
      return;
    }
    const prev = state.deck.indexOf(id);
    if (prev >= 0) state.deck[prev] = null;
    state.deck[si] = id;
    if (advanceTutorialAfterDeckAssign()) {
      render();
      return;
    }
    deckModalSlot = null;
    saveGame(state);
    refreshDeckPanel();
    return;
  }

  const slotEl = t.closest(".deck-slot");
  if (slotEl && !t.closest("#deck-slot-modal")) {
    const si = Number((slotEl as HTMLElement).dataset.slot);
    if (!Number.isFinite(si) || si < 0 || si >= effectiveDeckSlots(state)) return;
    deckModalSlot = si;
    selectedInvId = state.deck[si] ?? null;
    refreshDeckPanel();
  }
}

function handleCharacterCardsClick(e: MouseEvent): void {
  const t = e.target as HTMLElement;
  if (!t.closest("#character-cards-root")) return;

  if (t.closest("#char-btn-card-up")) {
    if (!selectedInvId) return;
    if (tryUpgradeSelectedCard()) refreshCharacterCardsPanel();
    return;
  }
  if (t.closest("#char-btn-card-salvage")) {
    if (!selectedInvId) return;
    const def = getCard(selectedInvId);
    if (!def) return;
    if (!confirm(`确定分解「${def.name}」？将永久失去该卡。`)) return;
    const r = salvageCard(state, selectedInvId);
    toast(r.msg);
    if (r.ok) {
      selectedInvId = null;
      saveGame(state);
      refreshCharacterCardsPanel();
    }
    return;
  }
  if (t.closest("#char-btn-clear-sel")) {
    selectedInvId = null;
    refreshCharacterCardsPanel();
    return;
  }

  const invEl = t.closest("[data-inv]");
  if (invEl) {
    const id = (invEl as HTMLElement).dataset.inv ?? null;
    if (!id) return;
    selectedInvId = id;
    refreshCharacterCardsPanel();
  }
}

function renderFlyOverlay(): string {
  if (!state.trueEndingSeen || flyCreditsDismissed) return "";
  return `
    <div class="fly-overlay" id="fly-overlay">
      <div class="fly-modal">
        <h2>飞升</h2>
        <p>你已达成飞升。本存档轮回 <strong>${state.reincarnations}</strong> 次，
        抽卡 <strong>${state.totalPulls}</strong> 次，在线约 <strong>${fmt(state.playtimeSec / 3600)}</strong> 小时。</p>
        <p class="hint">主界面已切换飞升外观，并额外获得 3 枚造化玉。</p>
        <button class="btn btn-primary" type="button" id="btn-fly-dismiss">继续游戏</button>
      </div>
    </div>`;
}

function renderTutorialBlock(): string {
  if (state.tutorialStep === 0) return "";
  if (state.tutorialStep === 1) {
    return `
      <div class="tutorial-backdrop" role="dialog">
        <div class="tutorial-modal">
          <h3>新手引导</h3>
          <p class="hint">先领新手礼包，再去「<strong>抽卡</strong>」抽一次，然后到「<strong>养成→卡组</strong>」上阵灵卡开始产出。</p>
          <div class="btn-row">
            <button class="btn btn-primary" type="button" id="btn-tutorial-claim">领取新手礼包（唤灵髓×50 · 灵石×600）</button>
            <button class="btn" type="button" id="btn-tutorial-skip">跳过引导</button>
          </div>
        </div>
      </div>`;
  }
  const hints: Record<number, string> = {
    2: "引导：点底部「抽卡」。",
    3: "引导：在抽卡页完成 1 次抽卡。完成后开放「幻域」。",
    4: "引导：点「养成→卡组」，再点任意阵位。",
    5: "引导：在弹层里选择 1 张灵卡上阵。",
    6: "引导：点「灵府→洞府」，任意强化 1 次。",
    7: "引导：点「灵府→灵脉」，完成 1 次破境。",
  };
  const h = hints[state.tutorialStep];
  if (!h) return "";
  return `<div class="tutorial-hint-bar">${h}</div>`;
}

function renderTopBar(
  u: ReturnType<typeof getUiUnlocks>,
  _ui: ReturnType<typeof describeInGameUi>,
  goldClass: string,
  ips: Decimal,
): string {
  let extra = "";
  if (u.statDao) {
    extra += `<span class="res-chip res-chip-extra" data-currency-hint-id="dao">
      <img class="res-ico" src="${UI_DAO}" alt="" width="20" height="20" />
      <span class="res-chip-stack">
        <span class="res-lbl">道韵</span>
        <strong id="pill-dao">${fmt(state.daoEssence)}</strong>
      </span>
    </span>`;
  }
  if (u.statZao) {
    extra += `<span class="res-chip res-chip-extra" data-currency-hint-id="zao">
      <img class="res-ico" src="${UI_ZAO}" alt="" width="20" height="20" />
      <span class="res-chip-stack">
        <span class="res-lbl">造化玉</span>
        <strong id="pill-zao">${state.zaoHuaYu}</strong>
      </span>
    </span>`;
  }
  if (u.tabGear) {
    extra += `<span class="res-chip res-chip-extra" data-currency-hint-id="lingSha">
      <img class="res-ico" src="${UI_LING_SHA}" alt="" width="20" height="20" />
      <span class="res-chip-stack">
        <span class="res-lbl">灵砂</span>
        <strong id="pill-ling-sha">${state.lingSha}</strong>
      </span>
    </span>`;
    extra += `<span class="res-chip res-chip-extra" data-currency-hint-id="xuanTie">
      <img class="res-ico" src="${UI_XUAN_TIE}" alt="" width="20" height="20" />
      <span class="res-chip-stack">
        <span class="res-lbl">玄铁</span>
        <strong id="pill-xuan-tie">${state.xuanTie}</strong>
      </span>
    </span>`;
  }
  const hasExtra = extra.length > 0;
  const extraWrap = hasExtra
    ? `<div class="resource-strip-extra${topBarExtrasExpanded ? " expanded" : ""}" id="top-bar-extra">${extra}</div>`
    : "";
  const moreBtn = hasExtra
    ? `<button type="button" class="res-chip res-chip-more" id="btn-topbar-more" aria-expanded="${topBarExtrasExpanded ? "true" : "false"}">${topBarExtrasExpanded ? "收起" : "更多"}</button>`
    : "";
  return `
  <div class="resource-strip${goldClass}" id="top-bar" title="长按货币图标查看用途">
    <span class="res-chip res-chip-key res-chip-stone" data-currency-hint-id="stone">
      <img class="res-ico" src="${UI_STONE}" alt="" width="20" height="20" />
      <span class="res-chip-stack">
        <span class="res-lbl">灵石</span>
        <strong id="pill-stones">${fmtDecimal(stones(state))}</strong>
        <span class="res-delta" id="pill-stones-delta">+${fmtDecimal(ips)}/秒</span>
      </span>
    </span>
    <span class="res-chip res-chip-key res-chip-essence" data-currency-hint-id="essence">
      <img class="res-ico" src="${UI_ESSENCE}" alt="" width="20" height="20" />
      <span class="res-chip-stack">
        <span class="res-lbl">灵髓</span>
        <strong id="pill-essence">${state.summonEssence}</strong>
        <span class="res-delta res-delta-ess" id="pill-essence-delta">+${essenceIncomePerSecondFromResonance(state).toFixed(3)}/秒</span>
      </span>
    </span>
    <span class="res-chip res-chip-key" data-currency-hint-id="realm">
      <img class="res-ico" src="${UI_REALM}" alt="" width="20" height="20" />
      <span class="res-chip-stack">
        <span class="res-lbl">境界</span>
        <strong id="pill-realm">${state.realmLevel}</strong>
      </span>
    </span>
    <span class="res-chip res-chip-key res-chip-power" data-currency-hint-id="power">
      <img class="res-ico" src="${UI_POWER}" alt="" width="20" height="20" />
      <span class="res-chip-stack">
        <span class="res-lbl">战力</span>
        <strong id="pill-power">${fmtNumZh(playerCombatPower(state))}</strong>
      </span>
    </span>
    ${moreBtn}
    ${extraWrap}
  </div>`;
}

/** 与 renderHubContent 强相关的导航状态；变化时主列表应回到顶部而非保留滚动 */
function mainContentViewKey(): string {
  return `${activeHub}|${estateSub}|${cultivateSub}|${characterSub}|${gachaPool}`;
}

function normalizeHubNavigation(u: ReturnType<typeof getUiUnlocks>): void {
  if (activeHub === "battle" && !u.tabDungeon) activeHub = "estate";
  if (activeHub === "estate" && estateSub === "vein" && !u.tabVein) estateSub = "idle";
  if (activeHub === "estate" && estateSub === "garden" && !u.tabGarden) estateSub = "idle";
  if (activeHub === "estate" && estateSub === "array" && !u.tabSpiritArray) estateSub = "idle";
  const subOk = (s: CultivateSub): boolean => {
    switch (s) {
      case "deck":
        return true;
      case "train":
        return u.tabTrain;
      case "pets":
        return u.tabPets;
      case "codex":
        return u.tabCodex;
      case "meta":
        return u.tabMeta;
      case "ach":
        return u.tabAch;
      case "bounty":
        return u.tabBounty;
      case "chronicle":
        return u.tabChronicle;
      case "daily":
        return u.tabDailyLogin;
      case "stash":
        return u.tabCelestialStash;
      case "xinfa":
        return u.tabBattleSkills;
      default:
        return false;
    }
  };
  if (activeHub === "cultivate" && !subOk(cultivateSub)) cultivateSub = "deck";
  if (activeHub === "character" && characterSub === "meridian" && !u.tabDaoMeridian) characterSub = "stats";
}

/** 二级页签：主内容区顶部横排（幻域已独立为底部「幻域」页） */
function renderFloatingSubNav(u: ReturnType<typeof getUiUnlocks>): string {
  const mkEstate = (id: EstateSub, label: string, active: boolean, pulse: boolean): string =>
    `<button type="button" class="hub-sub-tab ${active ? "active" : ""} ${pulse ? "tutorial-pulse" : ""}" data-estate-sub="${id}"${active ? ` aria-current="page"` : ""}>${label}</button>`;
  const mkCult = (id: CultivateSub, label: string, unlocked: boolean, active: boolean, pulse: boolean): string =>
    unlocked
      ? `<button type="button" class="hub-sub-tab ${active ? "active" : ""} ${pulse ? "tutorial-pulse" : ""}" data-cultivate-sub="${id}"${active ? ` aria-current="page"` : ""}>${label}</button>`
      : `<span class="hub-sub-tab hub-sub-tab-locked" title="未解锁">${label}</span>`;
  const mkChar = (id: CharacterSub, label: string, active: boolean): string =>
    `<button type="button" class="hub-sub-tab ${active ? "active" : ""}" data-character-sub="${id}"${active ? ` aria-current="page"` : ""}>${label}</button>`;

  let left = "";
  let right = "";
  if (activeHub === "estate" && u.tabVein) {
    const gTabs = [
      mkEstate("idle", "灵脉·境界升级", estateSub === "idle", state.tutorialStep === 7),
      mkEstate("vein", "洞府·长期加成", estateSub === "vein", state.tutorialStep === 6),
    ];
    if (u.tabSpiritArray) {
      gTabs.push(mkEstate("array", "阵图·纳灵", estateSub === "array", false));
    }
    if (u.tabGarden) {
      gTabs.push(mkEstate("garden", "灵田·灵草", estateSub === "garden", false));
    }
    left = gTabs.join("");
  } else if (activeHub === "cultivate") {
    const rowBattle = [
      mkCult(
        "deck",
        "卡组·上阵",
        true,
        cultivateSub === "deck",
        state.tutorialStep >= 4 && state.tutorialStep <= 5,
      ),
      mkCult("train", "修炼·自动收益", u.tabTrain, cultivateSub === "train", false),
      mkCult("xinfa", "心法·领悟", u.tabBattleSkills, cultivateSub === "xinfa", false),
      mkCult("pets", "灵宠·全局加成", u.tabPets, cultivateSub === "pets", false),
    ].join("");
    const rowSys = [
      mkCult("codex", "图鉴·规则说明", u.tabCodex, cultivateSub === "codex", false),
      mkCult("chronicle", "唤灵·通鉴", u.tabChronicle, cultivateSub === "chronicle", false),
      mkCult("meta", "轮回·永久强化", u.tabMeta, cultivateSub === "meta", false),
      mkCult("bounty", "周常·悬赏", u.tabBounty, cultivateSub === "bounty", false),
      mkCult("stash", "天机·匣", u.tabCelestialStash, cultivateSub === "stash", false),
      mkCult("daily", "灵息·日历", u.tabDailyLogin, cultivateSub === "daily", false),
      mkCult("ach", "成就·奖励", u.tabAch, cultivateSub === "ach", false),
    ].join("");
    left = `<div class="hub-subnav-section">
      <div class="hub-subnav-section-label">
        <img class="hub-subnav-flair" src="${UI_HUB_SECTION_FLAIR}" alt="" width="12" height="12" loading="lazy" />
        <span>阵线与成长</span>
      </div>
      <div class="hub-inline-subnav-row hub-inline-subnav-row--tight">${rowBattle}</div>
    </div>
    <div class="hub-subnav-section">
      <div class="hub-subnav-section-label">
        <img class="hub-subnav-flair" src="${UI_HUB_SECTION_FLAIR}" alt="" width="12" height="12" loading="lazy" />
        <span>图鉴与周常</span>
      </div>
      <div class="hub-inline-subnav-row hub-inline-subnav-row--tight">${rowSys}</div>
    </div>`;
  } else if (activeHub === "character") {
    const mkCharUnlock = (id: CharacterSub, label: string, unlocked: boolean, active: boolean): string =>
      unlocked
        ? mkChar(id, label, active)
        : `<span class="hub-sub-tab hub-sub-tab-locked" title="未解锁">${label}</span>`;
    left = [
      mkChar("stats", "属性·总览", characterSub === "stats"),
      mkChar("cards", "卡牌·仓库", characterSub === "cards"),
      mkChar("gear", "装备·背包", characterSub === "gear"),
      mkCharUnlock("meridian", "道韵·灵窍", u.tabDaoMeridian, characterSub === "meridian"),
      mkChar("guides", "功能·指引", characterSub === "guides"),
      mkChar("settings", "偏好·设置", characterSub === "settings"),
      mkChar("data", "数据·总览", characterSub === "data"),
      mkChar("archive", "存档·管理", characterSub === "archive"),
    ].join("");
  }
  if (!left && !right) return "";
  if (activeHub === "cultivate") {
    return `<div class="hub-inline-subnav hub-inline-subnav--cultivate" aria-label="页内导航">${left}</div>`;
  }
  return `<div class="hub-inline-subnav" aria-label="页内导航">
    <div class="hub-inline-subnav-row">${left}${right}</div>
  </div>`;
}

function renderDiscoverabilityHint(): string {
  if (state.tutorialStep !== 0) return "";
  let text = "";
  if (activeHub === "cultivate") {
    switch (cultivateSub) {
      case "deck":
        text = "常用入口：布阵在「养成→卡组」点阵位；升阶/分解在「角色→灵卡」；装备在「角色→行囊」。";
        break;
      case "train":
        text = "常用入口：这里只负责挂机修炼；心法在「养成→心法·领悟」；灵卡与装备请去「卡组」或「角色」页。";
        break;
      case "xinfa":
        text = "常用入口：消耗唤灵髓领悟/升级心法；唤灵髓来自共鸣与幻域等，规则见「图鉴·札记」。";
        break;
      case "codex":
        text = "常用入口：规则说明看「养成→图鉴·札记」；若找不到功能，去「角色→功能预览·导航」。";
        break;
      case "meta":
        text = "常用入口：轮回=重开本轮并换永久加成；保存/导出/导入存档在「角色→存档·管理」。";
        break;
      case "ach":
        text = "常用入口：奖励自动发放；若不清楚玩法入口，先看「角色→功能预览·导航」。";
        break;
      case "bounty":
        text = "常用入口：周常悬赏按本地每周一刷新；幻域、唤引、灵田、吐纳与破境均可推进条目。";
        break;
      case "chronicle":
        text = "常用入口：唤灵通鉴记录最近灵卡唤引；境界铸灵不计入列表。";
        break;
      case "daily":
        text = "常用入口：灵息日历按本地日结算连签；每日可领灵石与唤灵髓，与周常悬赏不同轨。";
        break;
      case "stash":
        text = "常用入口：天机匣按自然周刷新限购兑换；与周常悬赏共用周次，资源种类不同。";
        break;
      case "pets":
        text = "常用入口：灵宠是全局加成；唤灵入口在底部「抽卡」，成长进度在本页查看。";
        break;
      default:
        text = "";
    }
  } else if (activeHub === "character") {
    if (characterSub === "cards") {
      text = "常用入口：这里只做灵卡升阶/分解；上阵请去「养成→卡组」点阵位。";
    } else if (characterSub === "gear") {
      text = "常用入口：装备产出在底部「抽卡→境界铸灵」；强化/精炼/卸下在本页行囊。";
    } else if (characterSub === "guides") {
      text = "常用入口：这里专门告诉你“功能在哪”；保存/导出/导入存档在「角色→存档·管理」。";
    } else if (characterSub === "settings") {
      text = "常用入口：动效、数字与音频偏好在此；按 ? 打开快捷键说明；备份与导入在「存档·管理」。";
    } else if (characterSub === "data") {
      text = "常用入口：可复制或下载统计摘要（.txt）；详细规则见「养成→图鉴」，奖励见「成就」。";
    } else if (characterSub === "archive") {
      text = "常用入口：多存档位与本机备注、保存/导出/导入与重置均在此；切换槽位前会自动保存当前槽。";
    } else if (characterSub === "meridian") {
      text = "常用入口：道韵灵窍消耗道韵获得永久加成；道韵主要来自轮回结算。";
    }
  } else if (activeHub === "gacha") {
    text = "常用入口：灵卡池=卡牌，境界铸灵=装备；自动分解开关在本页底部。";
  } else if (activeHub === "estate") {
    text =
      "常用入口：灵脉=升级境界，洞府=长期加成，阵图=灵石全局乘区（轮回不重置），灵田=种植收获灵砂；可并行推进。";
  } else if (activeHub === "battle") {
    text = "常用入口：这里就是副本（幻域）；进本与复刷都在此页。";
  }
  if (!text) return "";
  return `<p class="hint sm discoverability-hint">${text}</p>`;
}

function renderBottomNav(u: ReturnType<typeof getUiUnlocks>): string {
  const item = (hub: HubId, label: string, disabled: boolean, pulse: boolean): string => {
    const battleCue = hub === "battle" && !disabled ? " app-nav-item--battle" : "";
    return `<button type="button" class="app-nav-item${battleCue} ${activeHub === hub ? "active" : ""}${pulse ? " tutorial-pulse" : ""}" data-hub="${hub}"${activeHub === hub && !disabled ? ` aria-current="page"` : ""}${disabled ? " disabled" : ""}>${label}</button>`;
  };
  return `<nav class="app-bottom-nav" role="navigation" aria-label="主导航">
    ${item("estate", "灵府·成长", false, state.tutorialStep === 6 || state.tutorialStep === 7)}
    ${item("cultivate", "养成", false, state.tutorialStep >= 4 && state.tutorialStep <= 5)}
    ${item("battle", "幻域·副本", !u.tabDungeon, false)}
    ${item("gacha", "抽卡", false, state.tutorialStep === 2 || state.tutorialStep === 3)}
    ${item("character", "角色", false, false)}
  </nav>`;
}

function renderCharacterHub(u: ReturnType<typeof getUiUnlocks>): string {
  if (characterSub === "stats") {
    return `<div class="character-hub-root">${renderPlayerStatsBlock(state)}${renderCombatStatsPanel()}</div>`;
  }
  if (characterSub === "meridian" && u.tabDaoMeridian) {
    return `<div class="character-hub-root">${renderDaoMeridianPanel(state)}</div>`;
  }
  if (characterSub === "cards") {
    return `<div class="character-hub-root">${renderCharacterCardsPanel()}</div>`;
  }
  if (characterSub === "guides") {
    return `<div class="character-hub-root">${featureGuidePanelHtml(state, u)}</div>`;
  }
  if (characterSub === "settings") {
    return `<div class="character-hub-root">${renderUiPrefsPanel()}</div>`;
  }
  if (characterSub === "data") {
    return `<div class="character-hub-root">${renderDataOverviewPanel()}</div>`;
  }
  if (characterSub === "archive") {
    return `<div class="character-hub-root">${renderSaveToolsPanel()}</div>`;
  }
  const gearBlock = u.tabGear
    ? renderGearPanel(state, refineTargetId, gearDetailSlot, state.gearInventorySort)
    : `<section class="panel character-hub-gear-locked"><p class="hint">解锁条件：获得 1 件装备，或累计抽卡≥10。解锁后开放境界铸灵和行囊装备管理。</p></section>`;
  return `<div class="character-hub-root">${gearBlock}</div>`;
}

function triggerDownloadSaveBackup(): void {
  const s = exportSave(state);
  const ts = new Date();
  const y = ts.getFullYear();
  const mo = String(ts.getMonth() + 1).padStart(2, "0");
  const d = String(ts.getDate()).padStart(2, "0");
  const h = String(ts.getHours()).padStart(2, "0");
  const mi = String(ts.getMinutes()).padStart(2, "0");
  const name = `idle-gacha-realm-backup-${y}${mo}${d}-${h}${mi}.txt`;
  const blob = new Blob([s], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.rel = "noopener";
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
  toast("已下载备份文件（与导出字符串相同格式，可导入还原）。");
}

function triggerDownloadDataOverviewTxt(): void {
  const text = buildDataOverviewExportText(state);
  const ts = new Date();
  const y = ts.getFullYear();
  const mo = String(ts.getMonth() + 1).padStart(2, "0");
  const d = String(ts.getDate()).padStart(2, "0");
  const h = String(ts.getHours()).padStart(2, "0");
  const mi = String(ts.getMinutes()).padStart(2, "0");
  const name = `idle-gacha-realm-stats-${y}${mo}${d}-${h}${mi}.txt`;
  const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.rel = "noopener";
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
  void resumeAudioContext().then(() => playUiBlip(state));
  toast("已下载统计摘要文件（与「复制统计摘要」内容相同）。");
}

function syncComfortDomFromState(): void {
  document.documentElement.classList.toggle("ui-reduce-motion", state.uiPrefs.reduceMotion);
}

function renderUiPrefsPanel(): string {
  const p = state.uiPrefs;
  return `<section class="panel ui-prefs-panel">
    <div class="panel-title-art-row">
      <img class="panel-title-art-icon" src="${UI_UI_PREFS_DECO}" alt="" width="28" height="28" loading="lazy" />
      <h2>偏好设置</h2>
    </div>
    <p class="hint">与玩法数值无关，写入存档；可随时调整。</p>
    <ul class="ui-prefs-list">
      <li class="ui-pref-row">
        <label class="ui-pref-label">
          <input type="checkbox" class="ui-pref-input" data-ui-pref="reduceMotion" ${p.reduceMotion ? "checked" : ""} />
          <span class="ui-pref-title">减弱界面动效</span>
        </label>
        <p class="hint sm ui-pref-desc">关闭大部分过渡与装饰动画，减轻眩晕与设备负担。</p>
      </li>
      <li class="ui-pref-row">
        <label class="ui-pref-label">
          <input type="checkbox" class="ui-pref-input" data-ui-pref="compactNumbers" ${p.compactNumbers ? "checked" : ""} />
          <span class="ui-pref-title">灵石数字使用紧凑缩写</span>
        </label>
        <p class="hint sm ui-pref-desc">开启：K / M / B 等缩写；关闭：尽量显示完整整数（极大值仍用科学计数）。</p>
      </li>
      <li class="ui-pref-row ui-pref-audio-block">
        <div class="ui-pref-audio-head">
          <img class="ui-pref-inline-ico" src="${UI_SOUND_PREFS_DECO}" alt="" width="22" height="22" loading="lazy" />
          <span class="ui-pref-section-title">音频</span>
        </div>
        <label class="ui-pref-label">
          <input type="checkbox" class="ui-pref-input" data-ui-pref="soundMuted" ${p.soundMuted ? "checked" : ""} />
          <span class="ui-pref-title">静音</span>
        </label>
        <div class="ui-pref-volume-row">
          <label class="ui-pref-vol-label" for="ui-master-volume">主音量</label>
          <input
            type="range"
            id="ui-master-volume"
            class="ui-pref-volume-range"
            min="0"
            max="100"
            step="1"
            value="${Math.round(p.masterVolume * 100)}"
          />
          <span class="ui-pref-vol-readout" id="ui-master-volume-pct">${p.soundMuted ? "静音" : `${Math.round(p.masterVolume * 100)}%`}</span>
        </div>
        <div class="ui-pref-audio-actions">
          <button type="button" class="btn" id="btn-audio-test">试听</button>
        </div>
        <p class="hint sm ui-pref-desc">使用 Web Audio 生成短促提示音（无额外资源包）；后续若加入音效将统一走主音量与静音。</p>
      </li>
    </ul>
    <div class="ui-pref-keyboard-cta">
      <button type="button" class="btn" id="btn-open-keyboard-help">快捷键说明</button>
      <p class="hint sm">按 <kbd class="kbd-inline">?</kbd> 或 <kbd class="kbd-inline">Shift</kbd> + <kbd class="kbd-inline">/</kbd> 打开/关闭。</p>
    </div>
    <div class="ui-pref-about-cta">
      <button type="button" class="btn" id="btn-open-about-game">关于游戏</button>
      <p class="hint sm">客户端版本、致谢与第三方库说明。</p>
    </div>
  </section>`;
}

function renderKeyboardHelpModal(): string {
  if (!showKeyboardHelpModal) return "";
  return `<div class="keyboard-help-layer" id="keyboard-help-layer">
    <button type="button" class="keyboard-help-backdrop" id="keyboard-help-backdrop" aria-label="关闭说明"></button>
    <div class="keyboard-help-dialog" role="dialog" aria-modal="true" aria-labelledby="keyboard-help-title">
      <div class="keyboard-help-head">
        <img class="keyboard-help-ico" src="${UI_KEYBOARD_HELP_DECO}" alt="" width="28" height="28" loading="lazy" />
        <h2 id="keyboard-help-title" class="keyboard-help-title">快捷键</h2>
        <button type="button" class="btn keyboard-help-close" id="btn-keyboard-help-close" aria-label="关闭">×</button>
      </div>
      <ul class="keyboard-help-list">
        <li><span class="kbd-pill">1</span> … <span class="kbd-pill">5</span> 切换底部主栏：<strong>灵府</strong> / <strong>养成</strong> / <strong>幻域</strong> / <strong>抽卡</strong> / <strong>角色</strong>（小键盘 1–5 亦可）</li>
        <li><span class="kbd-pill">?</span> 或 <span class="kbd-pill">Shift</span> + <span class="kbd-pill">/</span> 打开或关闭本说明</li>
        <li><span class="kbd-pill">Esc</span> 关闭最上层浮层（先「关于游戏」，再本说明）</li>
        <li class="keyboard-help-note">幻域未解锁时按 <span class="kbd-pill">3</span>（幻域）会提示不可用。</li>
        <li class="keyboard-help-note">在输入框内输入时，数字键不会切换页面。</li>
      </ul>
    </div>
  </div>`;
}

function renderAboutModal(): string {
  if (!showAboutModal) return "";
  return `<div class="keyboard-help-layer" id="about-game-layer">
    <button type="button" class="keyboard-help-backdrop" id="about-game-backdrop" aria-label="关闭关于"></button>
    <div class="keyboard-help-dialog about-game-dialog" role="dialog" aria-modal="true" aria-labelledby="about-game-title">
      <div class="keyboard-help-head">
        <img class="keyboard-help-ico" src="${UI_ABOUT_GAME_DECO}" alt="" width="28" height="28" loading="lazy" />
        <h2 id="about-game-title" class="keyboard-help-title">关于游戏</h2>
        <button type="button" class="btn keyboard-help-close" id="btn-about-game-close" aria-label="关闭">×</button>
      </div>
      <div class="about-game-body">
        <p class="about-game-lead"><strong>万象唤灵</strong> · 单机网页增量挂机。进度保存在本机浏览器；清除站点数据或隐私模式可能导致存档丢失。</p>
        <dl class="about-game-meta">
          <dt>客户端版本</dt>
          <dd>${escapeHtmlAttr(pkg.version)}</dd>
          <dt>存档数据格式版本</dt>
          <dd>${SAVE_VERSION}</dd>
        </dl>
        <p class="hint sm about-game-tech">使用 Decimal.js、GSAP、Motion、Pixi.js、seedrandom 等开源库；部分界面图标基于 Twemoji（CC-BY 4.0）。</p>
      </div>
    </div>
  </div>`;
}

function parseHubDigitKey(e: KeyboardEvent): HubId | null {
  let d: string | null = null;
  if (/^[1-5]$/.test(e.key)) d = e.key;
  else {
    const n = { Numpad1: "1", Numpad2: "2", Numpad3: "3", Numpad4: "4", Numpad5: "5" }[e.code];
    if (n) d = n;
  }
  if (!d) return null;
  const map: Record<string, HubId> = {
    "1": "estate",
    "2": "cultivate",
    "3": "battle",
    "4": "gacha",
    "5": "character",
  };
  return map[d] ?? null;
}

function handleGlobalKeyboardShortcuts(e: KeyboardEvent): void {
  const t = e.target as HTMLElement | null;
  const inTextField =
    t &&
    (t.tagName === "INPUT" ||
      t.tagName === "TEXTAREA" ||
      t.tagName === "SELECT" ||
      (t as HTMLElement).isContentEditable);

  if (e.key === "Escape") {
    if (showAboutModal) {
      e.preventDefault();
      showAboutModal = false;
      render();
      return;
    }
    if (!showKeyboardHelpModal) return;
    e.preventDefault();
    showKeyboardHelpModal = false;
    render();
    return;
  }

  const isQuestionMark = e.key === "?" || (e.code === "Slash" && e.shiftKey);
  if (isQuestionMark) {
    if (inTextField) return;
    e.preventDefault();
    if (e.repeat) return;
    if (showAboutModal) {
      showAboutModal = false;
      showKeyboardHelpModal = true;
      render();
      return;
    }
    showKeyboardHelpModal = !showKeyboardHelpModal;
    render();
    return;
  }

  if (showKeyboardHelpModal || showAboutModal) return;
  if (inTextField) return;

  const hub = parseHubDigitKey(e);
  if (!hub) return;
  if (e.repeat) return;
  const u = getUiUnlocks(state);
  if (hub === "battle" && !u.tabDungeon) {
    e.preventDefault();
    toast("幻域尚未解锁。");
    return;
  }
  e.preventDefault();
  activeHub = hub;
  normalizeHubNavigation(u);
  render();
}

const GEAR_FORGE_RARITY_RANK_LABELS = ["N", "R", "SR", "SSR", "UR"] as const;

function buildDataOverviewExportText(st: GameState): string {
  const d = st.dungeon;
  const lt = st.lifetimeStats;
  const pool = totalCardsInPool();
  const lifeDay = Math.max(1, st.inGameDay - st.lifeStartInGameDay + 1);
  const rarityPeak =
    lt.maxGearRarityRankForged >= 0 && lt.maxGearRarityRankForged < GEAR_FORGE_RARITY_RANK_LABELS.length
      ? GEAR_FORGE_RARITY_RANK_LABELS[lt.maxGearRarityRankForged]
      : "—";
  const slotIdx = getActiveSlotIndex();
  const lines: string[] = [
    "万象唤灵 · 数据摘要",
    `导出时间（本地 ISO）: ${new Date().toISOString()}`,
    `当前存档位: ${slotIdx + 1} / ${SAVE_SLOT_COUNT}`,
    `存档数据版本: ${st.version}`,
    "",
    "[历程与境界]",
    `累计入世时长: ${fmtPlaytimeSec(st.playtimeSec)}`,
    `本轮回第几日: 第 ${lifeDay} 日`,
    `境界: ${st.realmLevel}`,
    `轮回次数: ${st.reincarnations}`,
    `本轮灵石峰值: ${fmtDecimal(new Decimal(st.peakSpiritStonesThisLife || "0"))}`,
    `灵息连签: ${st.dailyStreak}`,
    "",
    "[唤引与图鉴]",
    `灵卡唤引总次数: ${st.totalPulls}`,
    `本轮唤引次数: ${st.pullsThisLife ?? 0}`,
    `灵宠唤引累计: ${st.petPullsTotal}`,
    `图鉴解锁: ${st.codexUnlocked.size} / ${pool}`,
    `持有不同灵卡: ${countUniqueOwned(st)}`,
    `成就: ${st.achievementsDone.size} / ${ACHIEVEMENTS.length}`,
    "",
    "[幻域]",
    `历史最高波次: ${d.maxWaveRecord}`,
    `累计清波次数: ${d.totalWavesCleared}`,
    "",
    "[终身累计]",
    `幻域累计获得唤灵髓（整数）: ${lt.dungeonEssenceIntGained}`,
    `天机匣兑换次数: ${lt.celestialStashBuys}`,
    `蓄灵池收取次数: ${lt.spiritReservoirClaims}`,
    `心斋卦象刷新次数: ${lt.dailyFortuneRolls}`,
    `铸灵累计次数: ${lt.gearForgesTotal}`,
    `历史最高铸灵稀有度: ${rarityPeak}`,
    `周常悬赏单周清满次数: ${lt.weeklyBountyFullWeeks}`,
    "",
    "[其他]",
    `行囊装备件数: ${Object.keys(st.gearInventory).length}`,
    `灵田累计收获: ${st.spiritGarden.totalHarvests}`,
  ];
  return lines.join("\n");
}

function renderDataOverviewPanel(): string {
  const st = state;
  const d = st.dungeon;
  const lt = st.lifetimeStats;
  const pool = totalCardsInPool();
  const codex = st.codexUnlocked.size;
  const owned = countUniqueOwned(st);
  const gearN = Object.keys(st.gearInventory).length;
  const rarityPeak =
    lt.maxGearRarityRankForged >= 0 && lt.maxGearRarityRankForged < GEAR_FORGE_RARITY_RANK_LABELS.length
      ? GEAR_FORGE_RARITY_RANK_LABELS[lt.maxGearRarityRankForged]
      : "—";
  const lifeDay = Math.max(1, st.inGameDay - st.lifeStartInGameDay + 1);

  return `<section class="panel data-overview-panel">
    <div class="panel-title-art-row">
      <img class="panel-title-art-icon" src="${UI_DATA_OVERVIEW_DECO}" alt="" width="28" height="28" loading="lazy" />
      <h2>数据总览</h2>
    </div>
    <p class="hint">只读汇总：历程、唤引、幻域与终身统计；在线时长随挂机累计。</p>
    <div class="data-overview-export-row">
      <div class="data-overview-export-actions">
        <button type="button" class="btn data-overview-copy-btn" id="btn-data-overview-copy">
          <img class="data-overview-copy-ico" src="${UI_DATA_EXPORT_DECO}" alt="" width="18" height="18" loading="lazy" />
          复制统计摘要
        </button>
        <button type="button" class="btn data-overview-download-btn" id="btn-data-overview-download">
          <img class="data-overview-download-ico" src="${UI_DATA_STATS_DOWNLOAD_DECO}" alt="" width="18" height="18" loading="lazy" />
          下载 .txt
        </button>
      </div>
      <span class="hint sm data-overview-export-hint">纯文本，含存档位与时间戳；下载与复制内容相同。</span>
    </div>

    <div class="data-overview-section">
      <h3>历程与境界</h3>
      <div class="data-overview-grid">
        <div class="data-overview-cell"><span class="d-label">累计入世时长</span><strong class="d-val" id="data-overview-playtime">${fmtPlaytimeSec(st.playtimeSec)}</strong></div>
        <div class="data-overview-cell"><span class="d-label">本轮回第几日</span><strong class="d-val" id="data-overview-life-day">第 ${lifeDay} 日</strong></div>
        <div class="data-overview-cell"><span class="d-label">境界</span><strong class="d-val" id="data-overview-realm">${st.realmLevel}</strong></div>
        <div class="data-overview-cell"><span class="d-label">轮回次数</span><strong class="d-val" id="data-overview-reinc">${st.reincarnations}</strong></div>
        <div class="data-overview-cell"><span class="d-label">本轮灵石峰值</span><strong class="d-val" id="data-overview-peak-stone">${fmtDecimal(new Decimal(st.peakSpiritStonesThisLife || "0"))}</strong></div>
        <div class="data-overview-cell"><span class="d-label">灵息连签</span><strong class="d-val" id="data-overview-streak">${st.dailyStreak}</strong></div>
      </div>
    </div>

    <div class="data-overview-section">
      <h3>唤引与图鉴</h3>
      <div class="data-overview-grid">
        <div class="data-overview-cell"><span class="d-label">灵卡唤引总次数</span><strong class="d-val" id="data-overview-total-pulls">${st.totalPulls}</strong></div>
        <div class="data-overview-cell"><span class="d-label">本轮唤引次数</span><strong class="d-val" id="data-overview-pulls-life">${st.pullsThisLife ?? 0}</strong></div>
        <div class="data-overview-cell"><span class="d-label">灵宠唤引累计</span><strong class="d-val" id="data-overview-pet-pulls">${st.petPullsTotal}</strong></div>
        <div class="data-overview-cell"><span class="d-label">图鉴解锁</span><strong class="d-val" id="data-overview-codex">${codex} / ${pool}</strong></div>
        <div class="data-overview-cell"><span class="d-label">持有不同灵卡</span><strong class="d-val" id="data-overview-owned">${owned}</strong></div>
        <div class="data-overview-cell"><span class="d-label">成就</span><strong class="d-val" id="data-overview-ach">${st.achievementsDone.size} / ${ACHIEVEMENTS.length}</strong></div>
      </div>
    </div>

    <div class="data-overview-section">
      <h3>幻域</h3>
      <div class="data-overview-grid">
        <div class="data-overview-cell"><span class="d-label">历史最高波次</span><strong class="d-val" id="data-overview-max-wave">${d.maxWaveRecord}</strong></div>
        <div class="data-overview-cell"><span class="d-label">累计清波次数</span><strong class="d-val" id="data-overview-waves-cleared">${d.totalWavesCleared}</strong></div>
      </div>
    </div>

    <div class="data-overview-section">
      <h3>终身累计</h3>
      <div class="data-overview-grid">
        <div class="data-overview-cell"><span class="d-label">幻域累计获得唤灵髓（整数）</span><strong class="d-val" id="data-overview-lt-dungeon-ess">${lt.dungeonEssenceIntGained}</strong></div>
        <div class="data-overview-cell"><span class="d-label">天机匣兑换次数</span><strong class="d-val" id="data-overview-lt-stash">${lt.celestialStashBuys}</strong></div>
        <div class="data-overview-cell"><span class="d-label">蓄灵池收取次数</span><strong class="d-val" id="data-overview-lt-reservoir">${lt.spiritReservoirClaims}</strong></div>
        <div class="data-overview-cell"><span class="d-label">心斋卦象刷新次数</span><strong class="d-val" id="data-overview-lt-fortune">${lt.dailyFortuneRolls}</strong></div>
        <div class="data-overview-cell"><span class="d-label">铸灵累计次数</span><strong class="d-val" id="data-overview-lt-forge">${lt.gearForgesTotal}</strong></div>
        <div class="data-overview-cell"><span class="d-label">历史最高铸灵稀有度</span><strong class="d-val" id="data-overview-lt-rarity">${rarityPeak}</strong></div>
        <div class="data-overview-cell"><span class="d-label">周常悬赏单周清满次数</span><strong class="d-val" id="data-overview-lt-bounty-weeks">${lt.weeklyBountyFullWeeks}</strong></div>
      </div>
    </div>

    <div class="data-overview-section">
      <h3>其他</h3>
      <div class="data-overview-grid">
        <div class="data-overview-cell"><span class="d-label">行囊装备件数</span><strong class="d-val" id="data-overview-gear-count">${gearN}</strong></div>
        <div class="data-overview-cell"><span class="d-label">灵田累计收获</span><strong class="d-val" id="data-overview-harvests">${st.spiritGarden.totalHarvests}</strong></div>
      </div>
    </div>
  </section>`;
}

function updateDataOverviewReadouts(): void {
  if (!document.getElementById("data-overview-playtime")) return;
  const st = state;
  const d = st.dungeon;
  const lt = st.lifetimeStats;
  const pool = totalCardsInPool();
  const set = (id: string, text: string) => {
    const el = document.getElementById(id);
    if (el) el.textContent = text;
  };
  set("data-overview-playtime", fmtPlaytimeSec(st.playtimeSec));
  const lifeDay = Math.max(1, st.inGameDay - st.lifeStartInGameDay + 1);
  set("data-overview-life-day", `第 ${lifeDay} 日`);
  set("data-overview-realm", String(st.realmLevel));
  set("data-overview-reinc", String(st.reincarnations));
  set("data-overview-peak-stone", fmtDecimal(new Decimal(st.peakSpiritStonesThisLife || "0")));
  set("data-overview-streak", String(st.dailyStreak));
  set("data-overview-total-pulls", String(st.totalPulls));
  set("data-overview-pulls-life", String(st.pullsThisLife ?? 0));
  set("data-overview-pet-pulls", String(st.petPullsTotal));
  set("data-overview-codex", `${st.codexUnlocked.size} / ${pool}`);
  set("data-overview-owned", String(countUniqueOwned(st)));
  set("data-overview-ach", `${st.achievementsDone.size} / ${ACHIEVEMENTS.length}`);
  set("data-overview-max-wave", String(d.maxWaveRecord));
  set("data-overview-waves-cleared", String(d.totalWavesCleared));
  set("data-overview-lt-dungeon-ess", String(lt.dungeonEssenceIntGained));
  set("data-overview-lt-stash", String(lt.celestialStashBuys));
  set("data-overview-lt-reservoir", String(lt.spiritReservoirClaims));
  set("data-overview-lt-fortune", String(lt.dailyFortuneRolls));
  set("data-overview-lt-forge", String(lt.gearForgesTotal));
  const rarityPeak =
    lt.maxGearRarityRankForged >= 0 && lt.maxGearRarityRankForged < GEAR_FORGE_RARITY_RANK_LABELS.length
      ? GEAR_FORGE_RARITY_RANK_LABELS[lt.maxGearRarityRankForged]
      : "—";
  set("data-overview-lt-rarity", rarityPeak);
  set("data-overview-lt-bounty-weeks", String(lt.weeklyBountyFullWeeks));
  set("data-overview-gear-count", String(Object.keys(st.gearInventory).length));
  set("data-overview-harvests", String(st.spiritGarden.totalHarvests));
}

function escapeHtmlAttr(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function renderSaveSlotRow(i: number): string {
  const active = getActiveSlotIndex();
  const sum = peekSlotSummary(i);
  const meta = sum.empty ? "空槽" : `境界 ${sum.realmLevel} · ${fmtPlaytimeSec(sum.playtimeSec ?? 0)}`;
  const isActive = i === active;
  const labelVal = escapeHtmlAttr(getSlotLabel(i));
  return `<li class="save-slot-row">
    <div class="save-slot-main">
      <div class="save-slot-title-row">
        <strong class="save-slot-title">槽位 ${i + 1}</strong>
        ${isActive ? `<span class="save-slot-badge">当前</span>` : ""}
      </div>
      <span class="save-slot-meta">${meta}</span>
      <div class="save-slot-label-row">
        <label class="save-slot-label-field" for="save-slot-label-${i}">备注</label>
        <input
          type="text"
          id="save-slot-label-${i}"
          class="save-slot-label-input"
          data-save-slot-label="${i}"
          maxlength="${SAVE_SLOT_LABEL_MAX}"
          autocomplete="off"
          placeholder="本机备注，最多 ${SAVE_SLOT_LABEL_MAX} 字"
          value="${labelVal}"
        />
      </div>
    </div>
    <div class="save-slot-actions">
      ${
        !isActive
          ? `<button type="button" class="btn save-slot-btn" data-save-slot-activate="${i}">切换到此槽</button><button type="button" class="btn save-slot-btn" data-save-slot-copy="${i}">将当前复制到此槽</button>`
          : ""
      }
    </div>
  </li>`;
}

function renderSaveToolsPanel(): string {
  const rows = Array.from({ length: SAVE_SLOT_COUNT }, (_, i) => renderSaveSlotRow(i)).join("");
  return `<section class="panel save-tools-panel">
    <h2>存档管理</h2>
    <p class="hint">保存/导出/导入与重置都集中在这里。重置前建议先导出备份。</p>
    <div class="save-slots-block">
      <div class="save-slots-head">
        <img class="save-slots-head-ico" src="${UI_SAVE_SLOTS_DECO}" alt="" width="26" height="26" loading="lazy" />
        <h3 class="save-slots-heading">本机存档位</h3>
        <img
          class="save-slots-label-head-ico"
          src="${UI_SAVE_SLOT_LABEL_DECO}"
          alt=""
          width="22"
          height="22"
          loading="lazy"
          title="槽位备注仅保存在本机，不随导出存档字符串迁移"
        />
      </div>
      <p class="hint sm save-slots-hint">共 ${SAVE_SLOT_COUNT} 个独立槽位；可填备注区分周目。切换前会自动保存当前槽；空槽切换将新开局。备注不写入导出字符串。</p>
      <ul class="save-slots-list">${rows}</ul>
    </div>
    <div class="footer-tools">
      <button class="btn" type="button" id="btn-save">保存到本机</button>
      <button class="btn" type="button" id="btn-export">导出存档字符串</button>
      <button class="btn btn-save-download" type="button" id="btn-save-download">
        <img src="${UI_SAVE_DOWNLOAD_DECO}" alt="" width="18" height="18" class="btn-save-download-ico" loading="lazy" />
        下载备份文件
      </button>
      <input type="text" id="import-input" class="import-input" placeholder="粘贴存档字符串" />
      <button class="btn" type="button" id="btn-import">导入存档</button>
    </div>
    <div class="reset-strip">
      <button type="button" class="btn btn-danger" id="btn-reset-world">重置存档</button>
      <span class="reset-strip-hint">会清空当前存档并从头开始，建议先导出备份</span>
    </div>
  </section>`;
}

function renderHubContent(
  ips: Decimal,
  rb: Decimal,
  canBreak: boolean,
  u: ReturnType<typeof getUiUnlocks>,
  pityUr: number,
  slots: number,
): string {
  switch (activeHub) {
    case "battle":
      return u.tabDungeon
        ? renderDungeonPanel(state)
        : `<section class="panel"><p class="hint">完成 1 次抽卡后开放底部「<strong>幻域</strong>」。</p></section>`;
    case "estate":
      if (estateSub === "idle") return renderIdle(ips, rb, canBreak, u);
      if (estateSub === "vein") return renderVeinPage();
      if (estateSub === "array") return renderSpiritArrayPanel(state);
      return renderSpiritGardenPage(state, nowMs());
    case "gacha":
      return renderGacha(pityUr, u);
    case "cultivate":
      switch (cultivateSub) {
        case "deck":
          return renderDeck(slots);
        case "train":
          return renderTrainPanel(state);
        case "xinfa":
          return renderBattleSkillPanel(state);
        case "pets":
          return renderPetPanel(state);
        case "codex":
          return renderCodex();
        case "meta":
          return renderMeta();
        case "ach":
          return renderAch();
        case "bounty":
          return renderBountyPanel(state, nowMs());
        case "chronicle":
          return renderChroniclePanel(state);
        case "daily":
          return renderDailyLoginPanel(state, nowMs());
        case "stash":
          return renderCelestialStashPanel(state, nowMs());
        default:
          return "";
      }
    case "character":
      return renderCharacterHub(u);
    default:
      return "";
  }
}

function render(): void {
  const app = document.getElementById("app");
  if (!app) return;

  syncDecimalFormatFromState(state);
  syncComfortDomFromState();

  const u = getUiUnlocks(state);
  normalizeHubNavigation(u);

  const hubScrollEl = document.querySelector(".hub-page-scroll") as HTMLElement | null;
  const preservedHubScrollTop = hubScrollEl?.scrollTop ?? 0;
  const viewKeyNow = mainContentViewKey();
  const restoreHubScroll =
    lastMainContentViewKey !== "" && viewKeyNow === lastMainContentViewKey && preservedHubScrollTop > 0;

  const ui = describeInGameUi(state);
  const ips = incomePerSecond(state, totalCardsInPool());
  const rb = realmBreakthroughCostForState(state);
  const canBreak = canAfford(state, rb);
  const slots = effectiveDeckSlots(state);
  const pityUr = urPityRemaining(state);
  const goldClass = state.trueEndingSeen ? " app-gold" : "";
  const unlockLines = collectUnlockHintLines(u);
  const unlockDetailsBlock = renderUnlockHintsDetailsBlock(unlockLines);

  app.innerHTML = `
    <div class="app-visual-bg" style="--ui-sparkles:url('${UI_BG_SPARKLES}')" aria-hidden="true"></div>
    <div class="app-visual-aurora" aria-hidden="true"></div>
    <div class="app-root-content" style="--ui-panel-runes:url('${UI_PANEL_RUNES}')">
    <div class="app-head">
    <div class="app-brand-row">
      <div class="app-title-cluster">
        <img class="app-title-spirit" src="${UI_TITLE_SPIRIT}" alt="" width="40" height="40" loading="eager" title="戳一戳" />
        <h1 class="app-title">万象唤灵</h1>
      </div>
      ${renderTopBar(u, ui, goldClass, ips)}
    </div>
    ${ui.tagLine ? `<p class="vigor-line vigor-compact">${ui.tagLine}</p>` : `<p class="vigor-line vigor-compact fun-flavor-line">「${sessionFunFlavorLine()}」</p>`}
    </div>

    <main class="app-main app-main-stack" id="main-content">
    <div class="hub-page-scroll">
    ${unlockDetailsBlock}
    ${renderFloatingSubNav(u)}
    ${renderDiscoverabilityHint()}
    ${renderHubContent(ips, rb, canBreak, u, pityUr, slots)}
    </div>
    </main>

    ${renderTutorialBlock()}
    ${renderFlyOverlay()}
    ${renderBottomNav(u)}
    </div>
    ${renderKeyboardHelpModal()}
    ${renderAboutModal()}
  `;

  bindEvents(rb, slots);

  lastMainContentViewKey = viewKeyNow;
  if (restoreHubScroll) {
    requestAnimationFrame(() => {
      const el = document.querySelector(".hub-page-scroll") as HTMLElement | null;
      if (!el) return;
      const maxTop = Math.max(0, el.scrollHeight - el.clientHeight);
      el.scrollTop = Math.min(preservedHubScrollTop, maxTop);
    });
  }
}

function qoLRow(label: string, kind: keyof QoLFlags, desc: string): string {
  const on = state.qoL[kind];
  const cost = qoLCost(kind);
  return `
    <div class="meta-card">
      <h3>${label}</h3>
      <p class="hint">${desc}</p>
      <p class="hint">${on ? "已解锁" : `耗费 ${cost} 造化玉`}</p>
      <button class="btn btn-primary" type="button" data-qol="${kind}" ${on || state.zaoHuaYu < cost ? "disabled" : ""}>
        ${on ? "已拥有" : "解锁"}
      </button>
    </div>`;
}

function renderIdle(ips: Decimal, rb: Decimal, canBreak: boolean, u: ReturnType<typeof getUiUnlocks>): string {
  const codex = totalCardsInPool();
  const unique = state.codexUnlocked.size;
  const now = nowMs();
  const huiLingM = veinHuiLingMult(state.vein.huiLing).toFixed(2);
  const lingXiM = veinLingXiMult(state.vein.lingXi).toFixed(2);
  const tunaLeft = tunaCooldownLeftMs(state, now);
  const tunaReady = tunaLeft <= 0;
  const tunaGain = tunaStoneReward(state.realmLevel);
  const ftCd = Math.max(0, state.fenTianCooldownUntil - now);
  const ftReady = fireSynergyActive(state) && ftCd <= 0;
  const cdZh = `${Math.ceil(ftCd / 1000)} 息`;
  const tunaPct = tunaReady ? 100 : Math.min(100, 100 - (100 * tunaLeft) / TUNA_COOLDOWN_MS);

  const br = incomeBreakdownForDisplay(state, totalCardsInPool());
  const showRealmSplit = br.fromRealm.gt(1e-18);
  const showDeckSplit = br.fromDeck.gt(1e-18);
  const petIncomeHint = petSystemUnlocked(state) ? incomePetLineHtml(state) : "";
  const deckRealmPct = deckRealmBonusSum(state);
  const nextExplore = explorationHints(state);
  const exploreBlock =
    nextExplore.length > 0
      ? `<div class="explore-block"><strong class="explore-title">下一探索</strong><ul class="explore-list">${nextExplore.map((h) => `<li>${h}</li>`).join("")}</ul></div>`
      : "";

  const rs = reservoirStored(state);
  const rc = reservoirCap(state);
  const rPct = reservoirFillRatio(state) * 100;
  const canRs = canClaimSpiritReservoir(state);
  const reservoirBlock = u.tabSpiritReservoir
    ? `<section class="panel spirit-reservoir-panel">
      <div class="panel-title-art-row">
        <img class="panel-title-art-icon" src="${UI_HEAD_SPIRIT_RESERVOIR}" alt="" width="28" height="28" loading="lazy" />
        <h2>蓄灵池</h2>
      </div>
      <p class="hint">额外积蓄约 <strong>9%</strong> 当前每秒灵石等效的灵流（与上方主收益并行）；达上限后不再累积。</p>
      <div class="spirit-reservoir-bar-wrap">
        <div class="spirit-reservoir-bar"><div class="spirit-reservoir-bar-fill" id="spirit-reservoir-bar-fill" style="width:${rPct}%"></div></div>
        <p class="hint sm spirit-reservoir-readout"><span id="spirit-reservoir-stored">${fmtDecimal(rs)}</span> / <span id="spirit-reservoir-cap">${fmtDecimal(rc)}</span> 灵石</p>
      </div>
      <button type="button" class="btn ${canRs ? "btn-primary" : ""}" id="btn-spirit-reservoir-claim" ${canRs ? "" : "disabled"}>${canRs ? "收取蓄灵" : "暂无蓄灵"}</button>
    </section>`
    : "";

  const fd = getActiveFortuneDef(state);
  const calDay = state.dailyFortune.calendarDay || toLocalYMD(nowMs());
  const fortuneBlock =
    u.tabDailyFortune && fd
      ? `<section class="panel daily-fortune-panel">
      <div class="panel-title-art-row">
        <img class="panel-title-art-icon" src="${UI_HEAD_DAILY_FORTUNE}" alt="" width="28" height="28" loading="lazy" />
        <h2>心斋卦象</h2>
      </div>
      <p class="hint sm daily-fortune-day">本日 <strong id="daily-fortune-day">${calDay}</strong></p>
      <h3 class="daily-fortune-name" id="daily-fortune-title">${fd.title}</h3>
      <p class="hint daily-fortune-desc" id="daily-fortune-desc">${fd.desc}</p>
      <ul class="daily-fortune-bonuses">
        <li>灵石收益 <strong id="daily-fortune-stone">+${((fd.stoneMult - 1) * 100).toFixed(1)}%</strong></li>
        <li>幻域伤害期望 <strong id="daily-fortune-dungeon">+${((fd.dungeonMult - 1) * 100).toFixed(1)}%</strong></li>
      </ul>
      <p class="hint sm">每日按本地历更替；与存档灵识共同决定当日卦象。</p>
    </section>`
      : "";

  const core = `
    <section class="panel">
      <h2>灵脉汇聚</h2>
      <div class="income-hero">
        <div class="income-hero-label">每秒灵石</div>
        <div class="income-hero-value"><strong id="income-total-live">${fmtDecimal(ips)}</strong></div>
        <div class="income-split" id="income-split-live">
          ${showRealmSplit ? `<span>境界基础 <strong id="income-realm-live">${fmtDecimal(br.fromRealm)}</strong> / 秒</span>` : ""}
          ${showDeckSplit ? `<span>灵卡汇流 <strong id="income-deck-live">${fmtDecimal(br.fromDeck)}</strong> / 秒</span>` : ""}
      </div>
      ${petIncomeHint !== "" ? `<p class="hint sm income-pet-line" id="income-pet-line">${petIncomeHint}</p>` : ""}
      </div>
      <p class="hint stone-uses">灵石用于破境、洞府升级和升阶；唤灵髓用于抽卡和幻域。详细规则见「养成→图鉴·札记」。</p>
      ${exploreBlock}
      <p class="hint vein-hint-row">洞府乘区（已计入上方每秒灵石）：<strong>汇灵</strong> ×<span id="idle-vein-hui">${huiLingM}</span> · <strong>灵息</strong> ×<span id="idle-vein-ling">${lingXiM}</span>
        <button type="button" class="btn-help-icon" id="btn-vein-synergy-help" aria-expanded="false" aria-controls="vein-synergy-popover" aria-label="查看卡组灵脉说明" title="卡组灵脉说明">?</button>
      </p>
      <p class="hint sm vein-hint-sub">境界基础与灵卡汇流相加后，再乘洞府等加成（灵息每级约 +2.2%，与汇灵叠乘）。</p>
      <div id="vein-synergy-popover" class="vein-help-panel hidden" role="region" aria-label="五行灵脉说明">
        <p class="hint">同系卡牌≥3 激活对应灵脉。完整规则见「养成→图鉴·札记」。</p>
        <ul class="vein-help-list vein-help-list-compact">
          <li><strong>焚天</strong> 爆发 · <strong>溯流</strong> 水链 · <strong>岁木</strong> 岁序 · <strong>剑虹</strong> 返利 · <strong>厚土</strong> 离线</li>
        </ul>
      </div>
      <div class="btn-row">
        <button class="btn btn-primary" type="button" id="btn-realm" ${canBreak ? "" : "disabled"}>
          破境（耗 ${fmtDecimal(rb)} 灵石）
        </button>
        <button class="btn ${tunaReady ? "btn-primary" : ""}" type="button" id="btn-tuna" ${tunaReady ? "" : "disabled"}>
          吐纳${tunaReady ? `（+${tunaGain} 灵石）` : `（${Math.ceil(tunaLeft / 1000)} 息）`}
        </button>
        <button class="btn ${ftReady ? "btn-primary" : ""}" type="button" id="btn-fentian" ${fireSynergyActive(state) ? "" : "disabled"}>
          焚天${fireSynergyActive(state) ? (ftReady ? "（可施）" : `（${cdZh}后再行）`) : "（阵中需火灵≥三）"}
        </button>
      </div>
      <div class="cooldown-row" id="row-tuna-cd">
        <span class="cooldown-label">吐纳回气</span>
        <div class="progress-track slim"><div class="progress-fill cd tuna" id="tuna-cd-bar" style="width:${tunaPct}%"></div></div>
      </div>
      <p class="hint">吐纳冷却约 ${Math.round(TUNA_COOLDOWN_MS / 1000)} 秒。</p>
      <p class="hint">图鉴收集 ${unique} / ${codex}${deckRealmPct > 0.001 ? ` · 卡组境界加成 ${deckRealmPct.toFixed(2)}%` : ""}</p>
    </section>`;

  if (!u.privilegePanel) return reservoirBlock + fortuneBlock + core;

  const bulkRow =
    state.qoL.bulkLevel
      ? `<button class="btn" type="button" id="btn-bulk-up">一键尽升（袖里乾坤）</button>`
      : `<button class="btn" type="button" disabled title="需先解锁一键尽升">一键尽升（未解锁）</button>`;

  const ffLeft = Math.max(0, state.biGuanCooldownUntil - nowMs());
  const ffCooling = ffLeft > 0;
  const ffPct = ffCooling ? Math.min(100, 100 - (100 * ffLeft) / BI_GUAN_COOLDOWN_MS) : 100;
  const biGuanRow = u.biGuan
    ? `<button class="btn" type="button" id="btn-ff" ${ffCooling ? "disabled" : ""}>${
        ffCooling ? `闭关回气中（约 ${Math.ceil(ffLeft / 1000)} 息后可再施）` : "闭关一纪（预演一时段挂机收益）"
      }</button>`
    : "";
  const biGuanCdBar =
    u.biGuan && ffCooling
      ? `<div class="cooldown-row" id="row-biguan-cd"><span class="cooldown-label">闭关回气</span><div class="progress-track slim"><div class="progress-fill cd biguan" id="bi-guan-cd-bar" style="width:${ffPct}%"></div></div></div>`
      : "";

  return (
    reservoirBlock +
    fortuneBlock +
    core +
    `
    <section class="panel">
      <h2>便利功能</h2>
      <p class="hint">使用造化玉解锁以下功能。</p>
      <div class="meta-grid">
        ${qoLRow("十连加成", "tenPull", "十连结束后额外获得 1 层奖励加成")}
        ${qoLRow("一键尽升", "bulkLevel", "一键将已拥有灵卡升到当前上限")}
        ${qoLRow("自动破境", "autoRealm", "灵石足够时自动破境")}
        ${qoLRow("自动抽卡", "autoGacha", "唤灵髓足够时自动抽卡")}
        ${qoLRow("自动吐纳", "autoTuna", "吐纳冷却结束后自动执行")}
      </div>
      <div class="btn-row" style="margin-top:10px">
        ${bulkRow}
        ${biGuanRow}
      </div>
      ${biGuanCdBar}
    </section>
  `
  );
}

function renderGacha(pityUr: number, u: ReturnType<typeof getUiUnlocks>): string {
  const resFrac = ((state.wishResonance % 100) + 100) % 100;
  const pityProgressPct = Math.min(100, Math.max(0, ((UR_PITY_MAX - pityUr) / UR_PITY_MAX) * 100));
  const gearPityRem = gearSrPityRemaining(state);
  const gearPityCap = effectiveGearSrPityMax(state);
  const gearPityProgressPct = Math.min(
    100,
    Math.max(0, ((gearPityCap - gearPityRem) / gearPityCap) * 100),
  );
  const gearForgeTierHint = describeGearForgeTierLine(state);
  const tenUnlocked = u.gachaTenUnlocked;
  const tenDisabled = !tenUnlocked || state.summonEssence < ESSENCE_COST_TEN;
  const gearTenDisabled = !tenUnlocked || state.summonEssence < ESSENCE_COST_GEAR_TEN;
  const resonanceBlock = u.gachaResonance
    ? `<div class="resonance-panel resonance-panel-visual">
        <div class="resonance-head-row">
          <img class="resonance-core-img" src="${UI_RESONANCE_CORE}" alt="" width="44" height="44" loading="lazy" />
          <div class="resonance-head-text">
            <h3 class="resonance-title">聚灵共鸣</h3>
            <p class="hint resonance-hint-tight">随游戏时间累积共鸣，满百得唤灵髓+1（在线、离线追赶、闭关预演均计入）。</p>
          </div>
        </div>
        <div class="resonance-meter-row">
          <div class="resonance-ring-wrap" aria-hidden="true">
            <div class="resonance-ring" id="resonance-ring" style="--p:${resFrac}"></div>
            <span class="resonance-ring-val" id="resonance-ring-val">${Math.round(resFrac)}</span>
          </div>
          <div class="resonance-bar-column">
            <div class="resonance-ticks"><span>0</span><span>25</span><span>50</span><span>75</span><span>100</span></div>
            <div class="resonance-bar-wrap">
              <div class="resonance-bar" id="resonance-bar-fill" style="width:${resFrac}%"></div>
            </div>
          </div>
        </div>
        <p class="resonance-readout" id="resonance-readout-live">共鸣度 ${resFrac.toFixed(1)} / 100 · 持续累积</p>
      </div>`
    : `<p class="hint">再抽几次卡可解锁共鸣进度。</p>`;

  if (!u.tabGear && gachaPool === "gear") gachaPool = "cards";

  const ratesBlock = u.gachaRates
    ? `<table class="rates-table">
        <thead><tr><th>品阶</th><th>说明</th></tr></thead>
        <tbody>
          <tr><td class="rarity-UR">天极</td><td>最高稀有度；90 抽保底至少 1 张</td></tr>
          <tr><td class="rarity-SSR">绝品</td><td>高稀有度</td></tr>
          <tr><td class="rarity-SR">珍品</td><td>中高稀有度</td></tr>
          <tr><td class="rarity-R">灵品</td><td>中稀有度</td></tr>
          <tr><td class="rarity-N">凡品</td><td>基础稀有度</td></tr>
        </tbody>
      </table>`
    : "";

  const poolTabs = u.tabGear
    ? `
    <div class="gacha-pool-tabs" role="tablist">
      <button type="button" class="gacha-pool-tab ${gachaPool === "cards" ? "active" : ""}" data-gacha-pool="cards">灵卡池</button>
      <button type="button" class="gacha-pool-tab ${gachaPool === "gear" ? "active" : ""}" data-gacha-pool="gear">境界铸灵</button>
    </div>`
    : "";

  const cardSection = `
    <div class="gacha-pool-panel" ${gachaPool === "cards" ? "" : 'hidden'} id="gacha-panel-cards">
      <div class="pity-meter-block" aria-label="天极保底进度">
        <div class="pity-meter-head">
          <img class="pity-sigil-img" src="${UI_PITY_SIGIL}" alt="" width="22" height="22" loading="lazy" />
          <div class="pity-meter-titles">
            <span class="pity-meter-title">灵卡池 · 天极显化</span>
            <span class="pity-meter-sub">距保底约余 <strong id="pity-remain-txt">${pityUr}</strong> 唤</span>
          </div>
        </div>
        <div class="pity-meter-track" role="progressbar" aria-valuenow="${Math.round(pityProgressPct)}" aria-valuemin="0" aria-valuemax="100" aria-label="保底进度">
          <div class="pity-meter-fill" id="pity-fill-cards" style="width:${pityProgressPct}%"></div>
        </div>
      </div>
      <p class="hint">金系卡牌≥3 时，抽卡可获得额外灵石；解锁十连加成功能后收益更高。</p>
      <div class="gacha-actions">
        <button class="btn btn-primary gacha-flash" type="button" id="btn-pull-1" ${state.summonEssence >= ESSENCE_COST_SINGLE ? "" : "disabled"}>单抽（${ESSENCE_COST_SINGLE} 唤灵髓）</button>
        ${
          tenUnlocked
            ? `<button class="btn btn-primary gacha-flash" type="button" id="btn-pull-10" ${tenDisabled ? "disabled" : ""}>十连（${ESSENCE_COST_TEN} 唤灵髓）</button>`
            : `<button class="btn gacha-ten-locked" type="button" disabled title="完成一次单抽或境界≥三重后开放">十连（未解锁）</button>`
        }
      </div>
      ${!tenUnlocked ? `<p class="hint gacha-ten-hint">完成一次单抽或境界≥三重后开放<strong>十连</strong>。</p>` : ""}
      <div class="salvage-auto-row salvage-auto-row--gacha">
        <span class="salvage-auto-row-title">自动分解（仓库未上阵）</span>
        <label class="chk-inline"><input type="checkbox" id="chk-salvage-auto-n" ${state.salvageAuto.n ? "checked" : ""} /> 灵卡·凡品</label>
        <label class="chk-inline"><input type="checkbox" id="chk-salvage-auto-r" ${state.salvageAuto.r ? "checked" : ""} /> 灵卡·灵品</label>
      </div>
      ${ratesBlock}
      <div id="pull-output" class="pull-result"></div>
    </div>`;

  const gearSection = `
    <div class="gacha-pool-panel" ${gachaPool === "gear" ? "" : 'hidden'} id="gacha-panel-gear">
      <div class="gear-forge-tier-row" role="status">
        <img class="gear-forge-tier-deco" src="${UI_GEAR_FORGE_TIER_DECO}" alt="" width="28" height="28" loading="lazy" />
        <p class="hint gear-forge-tier-hint" id="gear-forge-tier-hint">${gearForgeTierHint}</p>
      </div>
      <div class="pity-meter-block pity-meter-block--gear" aria-label="境界铸灵珍品保底进度">
        <div class="pity-meter-head">
          <img class="pity-sigil-img" src="${UI_GEAR_PITY_SIGIL}" alt="" width="22" height="22" loading="lazy" />
          <div class="pity-meter-titles">
            <span class="pity-meter-title">境界铸灵 · 珍品显化</span>
            <span class="pity-meter-sub">距珍品+保底约余 <strong id="pity-remain-gear-txt">${gearPityRem}</strong> 唤</span>
          </div>
        </div>
        <div class="pity-meter-track" role="progressbar" aria-valuenow="${Math.round(gearPityProgressPct)}" aria-valuemin="0" aria-valuemax="100" aria-label="境界铸灵珍品保底进度">
          <div class="pity-meter-fill pity-meter-fill--gear" id="pity-fill-gear" style="width:${gearPityProgressPct}%"></div>
        </div>
      </div>
      <p class="pity-info">境界铸灵 · 仅产<strong>装备</strong>，<strong>不占灵卡天极保底</strong>；当前阶下<strong>最长 ${gearPityCap} 唤</strong>内至少一件珍品+（基准 ${GEAR_SR_PITY_MAX} 唤，随铸灵阶缩短）；背包上限 80 件。十铸若前 9 次无珍品+，第 10 次必为珍品+。</p>
      <p class="hint">词条与强化规则在底部「<strong>角色 → 行囊</strong>」查看；天极可精炼。</p>
      <div class="gacha-actions">
        <button class="btn btn-primary gacha-flash" type="button" id="btn-pull-gear-1" ${state.summonEssence >= ESSENCE_COST_GEAR_SINGLE ? "" : "disabled"}>单铸（${ESSENCE_COST_GEAR_SINGLE} 唤灵髓）</button>
        ${
          tenUnlocked
            ? `<button class="btn btn-primary gacha-flash" type="button" id="btn-pull-gear-10" ${gearTenDisabled ? "disabled" : ""}>十铸（${ESSENCE_COST_GEAR_TEN} 唤灵髓）</button>`
            : `<button class="btn gacha-ten-locked" type="button" disabled>十铸（未解锁）</button>`
        }
      </div>
      <div class="salvage-auto-row salvage-auto-row--gacha">
        <span class="salvage-auto-row-title">自动分解（背包未装备）</span>
        <label class="chk-inline"><input type="checkbox" id="chk-salvage-gear-n" ${state.salvageAuto.gearN ? "checked" : ""} /> 装备·凡品</label>
        <label class="chk-inline"><input type="checkbox" id="chk-salvage-gear-r" ${state.salvageAuto.gearR ? "checked" : ""} /> 装备·灵品</label>
      </div>
      <div id="pull-output-gear" class="pull-result pull-result-gear"></div>
    </div>`;

  const gachaLead = u.tabGear
    ? `<p class="hint gacha-lead"><strong>灵卡池</strong>产出灵卡；<strong>境界铸灵</strong>按进度产出更强倾向的装备（稀有度、装等随阶提升）。</p>`
    : `<p class="hint gacha-lead">抽卡入口。境界铸灵会在获得首件装备或累计抽卡 10 次后开放。</p>`;

  return `
    <section class="panel gacha-panel-root">
      <header class="gacha-panel-header">
        <img class="gacha-panel-decor-img" src="${UI_GACHA_DECOR}" alt="" width="180" height="108" loading="lazy" />
        <div class="gacha-panel-header-inner">
        <p class="gacha-panel-kicker">抽卡与装备获取</p>
        <h2 class="gacha-panel-title">抽卡 · 聚灵阵</h2>
        ${gachaLead}
        </div>
      </header>
      ${resonanceBlock}
      ${poolTabs}
      ${cardSection}
      ${gearSection}
    </section>
  `;
}

function renderVeinPage(): string {
  const v = state.vein;
  const poolN = totalCardsInPool();
  const ipsNow = incomePerSecond(state, poolN);
  const huiMult = veinHuiLingMult(v.huiLing);
  const lingMult = veinLingXiMult(v.lingXi);
  const gmMult = veinGongMingResonanceMult(v.gongMing);
  const kinds: VeinKind[] = ["huiLing", "guYuan", "lingXi", "gongMing"];
  let grid = "";
  for (const k of kinds) {
    const cur = v[k];
    const maxed = cur >= VEIN_MAX_LEVEL;
    let costLabel = "";
    let affordable = false;
    if (k === "huiLing") {
      const c = huiLingUpgradeCost(cur);
      costLabel = `${fmtDecimal(c)} 灵石`;
      affordable = !maxed && canAfford(state, c);
    } else if (k === "guYuan") {
      const c = guYuanUpgradeCost(cur);
      costLabel = `${c} 道韵`;
      affordable = !maxed && state.daoEssence >= c;
    } else if (k === "lingXi") {
      const c = lingXiUpgradeCost(cur);
      costLabel = `${fmtDecimal(c)} 灵石`;
      affordable = !maxed && canAfford(state, c);
    } else {
      const c = gongMingUpgradeCost(cur);
      costLabel = `${fmtDecimal(c)} 灵石`;
      affordable = !maxed && canAfford(state, c);
    }
    const lvPct = (cur / VEIN_MAX_LEVEL) * 100;
    grid += `
      <div class="vein-card vein-card-visual">
        <h3>${VEIN_TITLES[k]} <span class="inv-meta">Lv.${cur}</span></h3>
        <div class="vein-lv-track" role="progressbar" aria-valuenow="${cur}" aria-valuemin="0" aria-valuemax="${VEIN_MAX_LEVEL}" aria-label="${VEIN_TITLES[k]}等级">
          <div class="vein-lv-fill vein-lv-fill-${k}" style="width:${lvPct}%"></div>
        </div>
        <p class="hint">${VEIN_DESC[k]}</p>
        <button class="btn btn-primary" type="button" data-vein="${k}" ${affordable ? "" : "disabled"}>
          ${maxed ? "已满" : `强化（${costLabel}）`}
        </button>
      </div>`;
  }
  return `
    <section class="panel">
      <h2>洞府蕴灵</h2>
      <p class="hint">汇灵/灵息叠乘全局灵石；固元减破境消耗；共鸣同时加快聚灵共鸣与幻域唤灵髓。洞府<strong>轮回不重置</strong>。细则见图鉴·札记。</p>
      <p class="stat-inline vein-dungeon-readout" id="vein-dungeon-readout">
        当前乘区：<strong>汇灵</strong> ×<span id="vein-live-hui">${huiMult.toFixed(3)}</span>
        · <strong>灵息</strong> ×<span id="vein-live-ling">${lingMult.toFixed(3)}</span>
        · 洞府双线合并 ×<span id="vein-live-hui-ling">${(huiMult * lingMult).toFixed(3)}</span>
        · 每秒灵石 <strong id="vein-preview-ips">${fmtDecimal(ipsNow)}</strong>
      </p>
      <p class="hint sm vein-res-readout"><img src="${UI_VEIN_GONGMING_LINK}" alt="" width="14" height="14" class="vein-gm-deco" /> 共鸣乘区 ×<span id="vein-live-gongming">${gmMult.toFixed(3)}</span> · 聚灵共鸣 / 幻域唤灵髓（与法篆、词条等叠乘）</p>
      <div class="vein-grid">${grid}</div>
    </section>
  `;
}

function renderDeck(slots: number): string {
  const syn = deckSynergySummary(state);

  let slotsHtml = "";
  for (let i = 0; i < slots; i++) {
    const id = state.deck[i];
    const def = id ? getCard(id) : null;
    const o = id ? state.owned[id] : null;
    const filled = !!def && !!o;
    const picked = deckModalSlot === i;
    slotsHtml += `
      <div class="deck-slot ${filled ? "filled" : ""} ${picked ? "deck-slot-picked" : ""}" data-slot="${i}" role="button" tabindex="0" aria-pressed="${picked ? "true" : "false"}">
        <div class="slot-label">阵位 ${i + 1}${i >= 4 ? " · 轮回阁中解封" : ""}</div>
        ${
          filled
            ? `<div class="card-mini card-mini-visual">
                 ${cardPortraitBlock({ rarity: def!.rarity, element: def!.element }, "md")}
                 <div class="card-mini-text">
                   <span class="name rarity-${def!.rarity}">${def!.name}</span>
                   <div class="inv-meta">等级 ${o!.level} · 星辉 ${o!.stars} · ${EL_ZH[def!.element]}</div>
                 </div>
               </div>`
            : `<span class="hint">空 · 点选布阵</span>`
        }
      </div>
    `;
  }

  const modalHtml =
    deckModalSlot !== null &&
    deckModalSlot >= 0 &&
    deckModalSlot < slots
      ? renderDeckSlotModalContent(deckModalSlot)
      : "";

  return `
    <section class="panel deck-panel-wrap" id="deck-panel-root">
      <h2>卡组（${slots} 槽生效）</h2>
      <p class="hint">${syn}</p>
      <p class="hint">升阶、分解与仓库：<strong>角色 → 灵卡</strong>；点阵位在此弹层中布阵与升阶。</p>
      <p class="inv-meta">持有灵砂：<strong>${state.lingSha}</strong></p>
      <p class="hint sm">低品自动分解请在底部「<strong>抽卡</strong>」中切换至<strong>灵卡池</strong>或<strong>境界铸灵</strong>后勾选。</p>
      <p class="hint">同系≥三激活灵脉（焚天、溯流、岁木、剑虹、厚土）。</p>
      <p class="hint deck-assign-hint"><strong>上阵</strong>：点击阵位，在弹出层中选择灵卡。</p>
      <div class="deck-slots">${slotsHtml}</div>
      ${modalHtml}
    </section>
  `;
}

function renderCodex(): string {
  let html = "";
  for (const c of CARDS) {
    const has = state.codexUnlocked.has(c.id);
    html += `
      <div class="codex-card ${has ? "" : "locked"}">
        <div><span class="rarity-${c.rarity}">${c.name}</span> <span class="inv-meta">${EL_ZH[c.element]}</span></div>
        <div class="flavor">${has ? c.flavor : "？？？（未邂逅）"}</div>
      </div>
    `;
  }
  return `
    <section class="panel">
      <h2>万象图鉴</h2>
      <p class="hint">图鉴进度提升全局灵石（上限 15%）；全满赠造化玉。</p>
      <div class="codex-grid">${html}</div>
      ${renderGameLoreHtml()}
    </section>
  `;
}

function renderMeta(): string {
  const gain = daoEssenceGainOnReincarnate(state);
  const reinOk = canReincarnate(state);
  const kinds: (keyof GameState["meta"])[] = ["idleMult", "gachaLuck", "deckSlots", "ticketRegen", "stoneMult"];
  const titles: Record<keyof GameState["meta"], string> = {
    idleMult: "灵脉共鸣",
    gachaLuck: "祈愿加护",
    deckSlots: "额外槽位",
    ticketRegen: "轮回赠髓",
    stoneMult: "灵石心印",
  };
  const desc: Record<keyof GameState["meta"], string> = {
    idleMult: "每级：全局挂机效率 +8%",
    gachaLuck: "每级：高稀有权重略升",
    deckSlots: "每级：卡组 +1 槽（最多 +2，总上限 6）",
    ticketRegen: "每级：轮回初始唤灵髓增加",
    stoneMult: "每级：灵石获取 +6%",
  };

  let grid = "";
  for (const k of kinds) {
    const lv = state.meta[k];
    const maxed = k === "deckSlots" ? lv >= 2 : lv >= 20;
    const cost = metaUpgradeCost(k, lv);
    const can = !maxed && state.daoEssence >= cost;
    grid += `
      <div class="meta-card">
        <h3>${titles[k]} <span class="inv-meta">Lv.${lv}</span></h3>
        <p class="hint">${desc[k]}</p>
        <button class="btn btn-primary" type="button" data-meta="${k}" ${can ? "" : "disabled"}>
          强化（${fmt(cost)} 道韵）
        </button>
      </div>
    `;
  }

  return `
    <section class="panel">
      <h2>轮回</h2>
      <p>境界≥ <strong>${REINCARNATION_REALM_REQ}</strong> 可轮回：重置境界、灵石、卡组与持有卡；保留图鉴、成就与元强化。</p>
      <p class="hint">道韵依本轮灵石峰值等规则结算。</p>
      <p class="hint">预计本次可获得道韵：<strong>${fmt(gain)}</strong></p>
      <div class="btn-row">
        <button class="btn btn-danger" type="button" id="btn-rein" ${reinOk ? "" : "disabled"}>确认轮回</button>
      </div>
    </section>
    <section class="panel">
      <h2>元强化</h2>
      <div class="meta-grid">${grid}</div>
    </section>
  `;
}

function renderAch(): string {
  let html = "";
  for (const a of ACHIEVEMENTS) {
    const done = state.achievementsDone.has(a.id);
    const deco =
      a.listDeco === "forge"
        ? `<img class="ach-deco-icon" src="${UI_ACH_FORGE_DECO}" alt="" width="22" height="22" loading="lazy" />`
        : a.listDeco === "forgeEmber"
          ? `<img class="ach-deco-icon" src="${UI_ACH_FORGE_EMBER_DECO}" alt="" width="22" height="22" loading="lazy" />`
        : a.listDeco === "forgeNova"
          ? `<img class="ach-deco-icon" src="${UI_ACH_FORGE_NOVA_DECO}" alt="" width="22" height="22" loading="lazy" />`
        : a.listDeco === "gacha"
          ? `<img class="ach-deco-icon" src="${UI_ACH_GACHA_DECO}" alt="" width="22" height="22" loading="lazy" />`
          : a.listDeco === "codex"
            ? `<img class="ach-deco-icon" src="${UI_ACH_CODEX_DECO}" alt="" width="22" height="22" loading="lazy" />`
            : a.listDeco === "rarity"
              ? `<img class="ach-deco-icon" src="${UI_ACH_RARITY_DECO}" alt="" width="22" height="22" loading="lazy" />`
        : a.listDeco === "train"
          ? `<img class="ach-deco-icon" src="${UI_ACH_TRAIN_DECO}" alt="" width="22" height="22" loading="lazy" />`
          : a.listDeco === "dungeon"
            ? `<img class="ach-deco-icon" src="${UI_ACH_DUNGEON_DECO}" alt="" width="22" height="22" loading="lazy" />`
            : a.listDeco === "dungeonWaves"
              ? `<img class="ach-deco-icon" src="${UI_ACH_DUNGEON_WAVES_DECO}" alt="" width="22" height="22" loading="lazy" />`
            : a.listDeco === "dungeonWavesSurge"
              ? `<img class="ach-deco-icon" src="${UI_ACH_DUNGEON_WAVES_SURGE_DECO}" alt="" width="22" height="22" loading="lazy" />`
            : a.listDeco === "login"
              ? `<img class="ach-deco-icon" src="${UI_ACH_LOGIN_DECO}" alt="" width="22" height="22" loading="lazy" />`
              : a.listDeco === "bounty"
                ? `<img class="ach-deco-icon" src="${UI_ACH_BOUNTY_DECO}" alt="" width="22" height="22" loading="lazy" />`
                : a.listDeco === "meridian"
                  ? `<img class="ach-deco-icon" src="${UI_ACH_MERIDIAN_DECO}" alt="" width="22" height="22" loading="lazy" />`
                  : a.listDeco === "pet"
                    ? `<img class="ach-deco-icon" src="${UI_ACH_PET_DECO}" alt="" width="22" height="22" loading="lazy" />`
                    : a.listDeco === "array"
                      ? `<img class="ach-deco-icon" src="${UI_ACH_SPIRIT_ARRAY_DECO}" alt="" width="22" height="22" loading="lazy" />`
                      : a.listDeco === "petPull"
                        ? `<img class="ach-deco-icon" src="${UI_ACH_PET_PULL_DECO}" alt="" width="22" height="22" loading="lazy" />`
                        : a.listDeco === "petPullBloom"
                          ? `<img class="ach-deco-icon" src="${UI_ACH_PET_PULL_BLOOM_DECO}" alt="" width="22" height="22" loading="lazy" />`
                        : a.listDeco === "reincarnation"
                          ? `<img class="ach-deco-icon" src="${UI_ACH_REINCARNATION_DECO}" alt="" width="22" height="22" loading="lazy" />`
                            : a.listDeco === "garden"
                            ? `<img class="ach-deco-icon" src="${UI_ACH_GARDEN_DECO}" alt="" width="22" height="22" loading="lazy" />`
                            : a.listDeco === "gardenBloom"
                              ? `<img class="ach-deco-icon" src="${UI_ACH_GARDEN_BLOOM_DECO}" alt="" width="22" height="22" loading="lazy" />`
                            : a.listDeco === "stash"
                              ? `<img class="ach-deco-icon" src="${UI_ACH_STASH_DECO}" alt="" width="22" height="22" loading="lazy" />`
                              : a.listDeco === "reservoir"
                                ? `<img class="ach-deco-icon" src="${UI_ACH_RESERVOIR_DECO}" alt="" width="22" height="22" loading="lazy" />`
                                : a.listDeco === "fortune"
                                  ? `<img class="ach-deco-icon" src="${UI_ACH_FORTUNE_DECO}" alt="" width="22" height="22" loading="lazy" />`
                                  : a.listDeco === "vein"
                                    ? `<img class="ach-deco-icon" src="${UI_ACH_VEIN_DECO}" alt="" width="22" height="22" loading="lazy" />`
                                    : a.listDeco === "realm"
                                      ? `<img class="ach-deco-icon" src="${UI_ACH_REALM_DECO}" alt="" width="22" height="22" loading="lazy" />`
                                      : "";
    html += `
      <div class="ach-item ${done ? "done" : ""} ${a.listDeco ? `ach-item--${a.listDeco}` : ""}">
        <div class="ach-item-main">
          ${deco}
          <div>
            <strong>${a.title}</strong>
            <p class="hint" style="margin:4px 0 0">${a.desc}</p>
          </div>
        </div>
        <div class="inv-meta">
          ${done ? "已完成" : "进行中"}
          ${a.rewardStones ? `<br/>灵石 +${a.rewardStones}` : ""}
          ${a.rewardEssence ? `<br/>唤灵髓 +${a.rewardEssence}` : ""}
        </div>
      </div>
    `;
  }
  return `
    <section class="panel">
      <h2>成就</h2>
      <p class="hint">达成即自动发奖。</p>
      <div class="ach-list">${html}</div>
    </section>
  `;
}

function bindEvents(rb: Decimal, _slots: number): void {
  const applyHub = (hub: HubId): void => {
    activeHub = hub;
    if (hub !== "cultivate") deckModalSlot = null;
    if (hub !== "character") gearDetailSlot = null;
    if (hub === "gacha" && state.tutorialStep === 2) {
      state.tutorialStep = 3;
      saveGame(state);
    }
    if (hub === "cultivate" && state.tutorialStep === 4) {
      state.tutorialStep = 5;
      saveGame(state);
    }
    render();
  };

  document.querySelectorAll("[data-hub]").forEach((el) => {
    el.addEventListener("click", () => {
      const hub = (el as HTMLElement).dataset.hub as HubId | undefined;
      if (!hub) return;
      if ((el as HTMLButtonElement).disabled) return;
      applyHub(hub);
    });
  });

  document.getElementById("btn-topbar-more")?.addEventListener("click", () => {
    topBarExtrasExpanded = !topBarExtrasExpanded;
    render();
  });

  document.querySelectorAll("[data-estate-sub]").forEach((el) => {
    el.addEventListener("click", () => {
      const s = (el as HTMLElement).dataset.estateSub as EstateSub | undefined;
      if (s !== "idle" && s !== "vein" && s !== "garden" && s !== "array") return;
      const uNav = getUiUnlocks(state);
      if (s === "vein" && !uNav.tabVein) return;
      if (s === "garden" && !uNav.tabGarden) return;
      if (s === "array" && !uNav.tabSpiritArray) return;
      estateSub = s;
      render();
    });
  });

  document.querySelectorAll("[data-cultivate-sub]").forEach((el) => {
    el.addEventListener("click", () => {
      const s = (el as HTMLElement).dataset.cultivateSub as CultivateSub | undefined;
      if (
        s !== "deck" &&
        s !== "train" &&
        s !== "pets" &&
        s !== "codex" &&
        s !== "meta" &&
        s !== "ach" &&
        s !== "bounty" &&
        s !== "chronicle" &&
        s !== "daily" &&
        s !== "stash" &&
        s !== "xinfa"
      )
        return;
      const uNav = getUiUnlocks(state);
      if (s === "train" && !uNav.tabTrain) return;
      if (s === "xinfa" && !uNav.tabBattleSkills) return;
      if (s === "pets" && !uNav.tabPets) return;
      if (s === "codex" && !uNav.tabCodex) return;
      if (s === "meta" && !uNav.tabMeta) return;
      if (s === "ach" && !uNav.tabAch) return;
      if (s === "bounty" && !uNav.tabBounty) return;
      if (s === "chronicle" && !uNav.tabChronicle) return;
      if (s === "daily" && !uNav.tabDailyLogin) return;
      if (s === "stash" && !uNav.tabCelestialStash) return;
      cultivateSub = s;
      if (s !== "deck") deckModalSlot = null;
      render();
    });
  });

  document.querySelectorAll("[data-character-sub]").forEach((el) => {
    el.addEventListener("click", () => {
      const s = (el as HTMLElement).dataset.characterSub as CharacterSub | undefined;
      if (
        s !== "stats" &&
        s !== "cards" &&
        s !== "gear" &&
        s !== "guides" &&
        s !== "settings" &&
        s !== "data" &&
        s !== "archive" &&
        s !== "meridian"
      )
        return;
      if (s === "meridian" && !getUiUnlocks(state).tabDaoMeridian) return;
      characterSub = s;
      if (s !== "gear") gearDetailSlot = null;
      render();
    });
  });

  document.querySelectorAll("input[data-ui-pref]").forEach((el) => {
    el.addEventListener("change", (ev) => {
      const t = (ev.target as HTMLInputElement).dataset.uiPref;
      const checked = (ev.target as HTMLInputElement).checked;
      if (t === "reduceMotion") state.uiPrefs.reduceMotion = checked;
      else if (t === "compactNumbers") state.uiPrefs.compactNumbers = checked;
      else if (t === "soundMuted") state.uiPrefs.soundMuted = checked;
      else return;
      saveGame(state);
      render();
    });
  });

  document.getElementById("ui-master-volume")?.addEventListener("input", (ev) => {
    const pct = Number((ev.target as HTMLInputElement).value);
    state.uiPrefs.masterVolume = Math.max(0, Math.min(1, pct / 100));
    const ro = document.getElementById("ui-master-volume-pct");
    if (ro) ro.textContent = state.uiPrefs.soundMuted ? "静音" : `${Math.round(state.uiPrefs.masterVolume * 100)}%`;
  });
  document.getElementById("ui-master-volume")?.addEventListener("change", () => {
    saveGame(state);
  });
  document.getElementById("btn-audio-test")?.addEventListener("click", () => {
    void resumeAudioContext().then(() => playUiBlip(state));
  });

  document.getElementById("btn-open-keyboard-help")?.addEventListener("click", () => {
    showAboutModal = false;
    showKeyboardHelpModal = true;
    render();
  });
  const closeKeyboardHelp = (): void => {
    if (!showKeyboardHelpModal) return;
    showKeyboardHelpModal = false;
    render();
  };
  document.getElementById("btn-keyboard-help-close")?.addEventListener("click", closeKeyboardHelp);
  document.getElementById("keyboard-help-backdrop")?.addEventListener("click", closeKeyboardHelp);

  document.getElementById("btn-open-about-game")?.addEventListener("click", () => {
    showKeyboardHelpModal = false;
    showAboutModal = true;
    render();
  });
  const closeAboutGame = (): void => {
    if (!showAboutModal) return;
    showAboutModal = false;
    render();
  };
  document.getElementById("btn-about-game-close")?.addEventListener("click", closeAboutGame);
  document.getElementById("about-game-backdrop")?.addEventListener("click", closeAboutGame);

  document.getElementById("btn-data-overview-copy")?.addEventListener("click", () => {
    const text = buildDataOverviewExportText(state);
    void navigator.clipboard.writeText(text).then(
      () => {
        void resumeAudioContext().then(() => playUiBlip(state));
        toast("统计摘要已复制到剪贴板。");
      },
      () => {
        toast("复制失败：请检查剪贴板权限或浏览器设置。");
      },
    );
  });

  document.getElementById("btn-data-overview-download")?.addEventListener("click", () => {
    triggerDownloadDataOverviewTxt();
  });

  document.getElementById("btn-tutorial-claim")?.addEventListener("click", () => {
    state.tutorialStep = 2;
    state.summonEssence += 50;
    addStones(state, 600);
    saveGame(state);
    toast("新手礼包已领取。请先去「抽卡」完成 1 次抽卡。");
    render();
  });

  document.getElementById("btn-tutorial-skip")?.addEventListener("click", () => {
    state.tutorialStep = 0;
    saveGame(state);
    render();
  });

  document.getElementById("btn-realm")?.addEventListener("click", () => {
    if (canAfford(state, rb) && subStones(state, rb)) {
      state.realmLevel += 1;
      noteWeeklyBountyBreakthrough(state);
      if (state.tutorialStep === 7) {
        state.tutorialStep = 0;
        toast("破境成功。新手引导已完成。");
      } else {
        toast("境界突破成功");
      }
      tryCompleteAchievements(state);
      saveGame(state);
      render();
    }
  });

  document.getElementById("btn-fentian")?.addEventListener("click", () => {
    if (tryFenTianBurst(state)) {
      saveGame(state);
      toast("焚天已触发：已获得灵石增益。");
      const pool = totalCardsInPool();
      updateTopResourcePillsAndVigor(pool);
      if (activeHub === "estate" && estateSub === "idle") {
        updateEstateIdleLiveReadouts(nowMs());
      }
    } else {
      toast("焚天不可用：需要火系卡牌≥3，且技能不在冷却。");
    }
  });

  document.getElementById("btn-tuna")?.addEventListener("click", () => {
    const g = tryTuna(state, nowMs());
    if (g > 0) {
      const newly = tryCompleteAchievements(state);
      saveGame(state);
      toast(`吐纳完成：灵石 +${g}`);
      if (newly.length > 0) {
        render();
      } else {
        const pool = totalCardsInPool();
        updateTopResourcePillsAndVigor(pool);
        if (activeHub === "estate" && estateSub === "idle") {
          updateEstateIdleLiveReadouts(nowMs());
        }
      }
    }
  });

  document.querySelectorAll("[data-qol]").forEach((el) => {
    el.addEventListener("click", () => {
      const k = (el as HTMLElement).dataset.qol as keyof QoLFlags;
      if (buyQoL(state, k)) {
        saveGame(state);
        toast("便利功能已解锁。");
        render();
      }
    });
  });

  document.getElementById("btn-bulk-up")?.addEventListener("click", () => {
    const n = bulkUpgradeAllCards(state);
    saveGame(state);
    toast(n > 0 ? `已完成一键尽升：共升级 ${n} 次。` : "未升级：资源不足或已全部满级。");
    render();
  });

  document.getElementById("btn-ff")?.addEventListener("click", () => {
    const t = nowMs();
    if (t < state.biGuanCooldownUntil) {
      toast("闭关冷却中，请稍后再试。");
      return;
    }
    const g = fastForward(state, 3600);
    state.biGuanCooldownUntil = t + BI_GUAN_COOLDOWN_MS;
    saveGame(state);
    toast(`闭关完成：获得约 ${fmtDecimal(g)} 灵石（${Math.round(BI_GUAN_COOLDOWN_MS / 1000)} 秒冷却）`);
    render();
  });

  document.getElementById("btn-reset-world")?.addEventListener("click", () => {
    if (!confirm("确定重置存档？当前进度将被清空。建议先导出存档备份。")) return;
    state = clearSaveAndNewGame();
    selectedInvId = null;
    deckModalSlot = null;
    refineTargetId = null;
    gearDetailSlot = null;
    gachaPool = "cards";
    activeHub = "estate";
    estateSub = "idle";
    cultivateSub = "deck";
    characterSub = "stats";
    autoEnterPromptHandled = false;
    flyCreditsDismissed = false;
    toast("存档已重置。");
    render();
  });

  document.getElementById("btn-fly-dismiss")?.addEventListener("click", () => {
    flyCreditsDismissed = true;
    saveGame(state);
    document.getElementById("fly-overlay")?.remove();
  });

  document.querySelectorAll("[data-gacha-pool]").forEach((el) => {
    el.addEventListener("click", () => {
      const p = (el as HTMLElement).dataset.gachaPool as "cards" | "gear" | undefined;
      if (p !== "cards" && p !== "gear") return;
      if (p === "gear" && !getUiUnlocks(state).tabGear) {
        toast("境界铸灵未解锁：获得 1 件装备，或累计抽卡达到 10 次后开放。");
        return;
      }
      gachaPool = p;
      render();
    });
  });

  const runCardPull = (n: 1 | 10) => {
    if (n === 10 && !getUiUnlocks(state).gachaTenUnlocked) {
      toast("十连未解锁：先完成 1 次单抽，或境界达到 3。");
      return;
    }
    const cost = n === 1 ? ESSENCE_COST_SINGLE : ESSENCE_COST_TEN;
    if (state.summonEssence < cost) return;
    state.summonEssence -= cost;
    let pullHtml = "";
    let toastMsg = "";
    let resultsForFx: PullResult[] = [];
    if (n === 1) {
      const r = pullOne(state);
      resultsForFx = [r];
      const bonus = onGachaPulls(state, 1);
      tryCompleteAchievements(state);
      saveGame(state);
      const tag = r.isNew ? "初见" : r.duplicateStars ? "星辉+1" : "再遇";
      toastMsg = `抽卡：${r.card.name}「${rarityZh(r.card.rarity)}」${tag}` + (bonus > 0 ? ` · 额外 +${fmt(bonus)} 灵石` : "");
      pullHtml = `<span class="pull-tag">${r.card.name} · ${rarityZh(r.card.rarity)}</span>`;
      advanceTutorialAfterPull();
      const bonusNum = bonus;
      showGachaRevealOverlay(resultsForFx, bonusNum, toastMsg, () => {
        render();
        queueMicrotask(() => {
          const out = document.getElementById("pull-output");
          if (!out) return;
          out.innerHTML = pullHtml;
          out.classList.add("pull-burst");
          setTimeout(() => out.classList.remove("pull-burst"), 450);
        });
      });
    } else {
      const results = pullTen(state);
      resultsForFx = results;
      const bonus = onGachaPulls(state, 10);
      tryCompleteAchievements(state);
      saveGame(state);
      toastMsg = "十连完成：" + formatPullResults(results) + (bonus > 0 ? ` · 额外共 ${fmt(bonus)} 灵石` : "");
      pullHtml = results.map((r) => `<span class="pull-tag">${r.card.name}·${rarityZh(r.card.rarity)}</span>`).join("");
      advanceTutorialAfterPull();
      const bonusNum = bonus;
      showGachaRevealOverlay(resultsForFx, bonusNum, toastMsg, () => {
        render();
        queueMicrotask(() => {
          const out = document.getElementById("pull-output");
          if (!out) return;
          out.innerHTML = pullHtml;
          out.classList.add("pull-burst");
          setTimeout(() => out.classList.remove("pull-burst"), 450);
        });
      });
    }
  };

  const runGearPull = (n: 1 | 10) => {
    if (!getUiUnlocks(state).tabGear) {
      toast("境界铸灵未解锁：获得 1 件装备，或累计抽卡达到 10 次后开放。");
      return;
    }
    if (n === 10 && !getUiUnlocks(state).gachaTenUnlocked) {
      toast("十连未解锁：先完成 1 次单抽，或境界达到 3。");
      return;
    }
    const cost = n === 1 ? ESSENCE_COST_GEAR_SINGLE : ESSENCE_COST_GEAR_TEN;
    if (state.summonEssence < cost) return;
    const inv = Object.keys(state.gearInventory).length;
    if (inv >= 80) {
      toast("背包装备已满");
      return;
    }
    if (n === 10 && inv > 70) {
      toast("背包空间不足，无法十铸");
      return;
    }
    state.summonEssence -= cost;
    if (n === 1) {
      const r = pullGearOne(state);
      if (!r.ok || !r.gear) {
        state.summonEssence += cost;
        toast(!r.ok && "msg" in r ? r.msg : "铸灵失败");
        return;
      }
      const g = r.gear;
      tryCompleteAchievements(state);
      saveGame(state);
      const toastMsg = `铸灵：${g.displayName}「${rarityZh(g.rarity)}」`;
      const pullHtml = `<span class="pull-tag">${g.displayName} · ${rarityZh(g.rarity)}</span>`;
      showGearRevealOverlay([g], toastMsg, () => {
        render();
        queueMicrotask(() => {
          const out = document.getElementById("pull-output-gear");
          if (!out) return;
          out.innerHTML = pullHtml;
          out.classList.add("pull-burst");
          setTimeout(() => out.classList.remove("pull-burst"), 450);
        });
      });
    } else {
      const gears = pullGearTen(state);
      tryCompleteAchievements(state);
      saveGame(state);
      const toastMsg =
        "十铸已毕：" + gears.map((g) => `${g.displayName}「${rarityZh(g.rarity)}」`).join(" · ");
      const pullHtml = gears.map((g) => `<span class="pull-tag">${g.displayName}·${rarityZh(g.rarity)}</span>`).join("");
      showGearRevealOverlay(gears, toastMsg, () => {
        render();
        queueMicrotask(() => {
          const out = document.getElementById("pull-output-gear");
          if (!out) return;
          out.innerHTML = pullHtml;
          out.classList.add("pull-burst");
          setTimeout(() => out.classList.remove("pull-burst"), 450);
        });
      });
    }
  };

  document.getElementById("btn-pull-1")?.addEventListener("click", () => runCardPull(1));
  document.getElementById("btn-pull-10")?.addEventListener("click", () => runCardPull(10));
  document.getElementById("btn-pull-gear-1")?.addEventListener("click", () => runGearPull(1));
  document.getElementById("btn-pull-gear-10")?.addEventListener("click", () => runGearPull(10));

  document.getElementById("main-content")?.addEventListener("click", handleDeckPanelClick);
  document.getElementById("main-content")?.addEventListener("keydown", (e) => {
    const ke = e as KeyboardEvent;
    if (ke.key !== "Enter" && ke.key !== " ") return;
    const t = ke.target as HTMLElement | null;
    const slotEl = t?.closest?.(".deck-slot") as HTMLElement | null;
    if (!slotEl || slotEl.closest("#deck-slot-modal")) return;
    ke.preventDefault();
    const si = Number(slotEl.dataset.slot);
    if (!Number.isFinite(si) || si < 0 || si >= effectiveDeckSlots(state)) return;
    deckModalSlot = si;
    selectedInvId = state.deck[si] ?? null;
    refreshDeckPanel();
  });
  document.getElementById("main-content")?.addEventListener("click", handleCharacterCardsClick);
  document.getElementById("main-content")?.addEventListener("click", handleGearPanelClick);

  document.getElementById("chk-salvage-auto-n")?.addEventListener("change", (e) => {
    state.salvageAuto.n = (e.target as HTMLInputElement).checked;
    saveGame(state);
  });
  document.getElementById("chk-salvage-auto-r")?.addEventListener("change", (e) => {
    state.salvageAuto.r = (e.target as HTMLInputElement).checked;
    saveGame(state);
  });
  document.getElementById("chk-salvage-gear-n")?.addEventListener("change", (e) => {
    state.salvageAuto.gearN = (e.target as HTMLInputElement).checked;
    saveGame(state);
  });
  document.getElementById("chk-salvage-gear-r")?.addEventListener("change", (e) => {
    state.salvageAuto.gearR = (e.target as HTMLInputElement).checked;
    saveGame(state);
  });

  document.getElementById("btn-vein-synergy-help")?.addEventListener("click", (ev) => {
    ev.stopPropagation();
    const p = document.getElementById("vein-synergy-popover");
    const btn = document.getElementById("btn-vein-synergy-help");
    if (!p) return;
    p.classList.toggle("hidden");
    const expanded = !p.classList.contains("hidden");
    if (btn) btn.setAttribute("aria-expanded", expanded ? "true" : "false");
  });
  if (!veinHelpDocListenerBound) {
    veinHelpDocListenerBound = true;
    document.addEventListener("click", (ev) => {
      const t = ev.target as HTMLElement;
      if (t.closest("#btn-vein-synergy-help") || t.closest("#vein-synergy-popover")) return;
      const pop = document.getElementById("vein-synergy-popover");
      const btn = document.getElementById("btn-vein-synergy-help");
      if (!pop || !btn) return;
      pop.classList.add("hidden");
      btn.setAttribute("aria-expanded", "false");
    });
  }

  document.querySelectorAll("[data-meta]").forEach((el) => {
    el.addEventListener("click", () => {
      const k = (el as HTMLElement).dataset.meta as keyof GameState["meta"];
      if (buyMeta(state, k)) {
        saveGame(state);
        toast("元强化升级成功。");
        render();
      }
    });
  });

  document.getElementById("btn-rein")?.addEventListener("click", () => {
    if (!confirm("确定轮回？境界、灵石、卡组与持有卡将重置，图鉴进度保留。")) return;
    performReincarnate(state);
    tryCompleteAchievements(state);
    saveGame(state);
    toast("轮回完成，道韵已入体");
    selectedInvId = null;
    deckModalSlot = null;
    gearDetailSlot = null;
    render();
  });

  document.getElementById("btn-dao-meridian-buy")?.addEventListener("click", () => {
    if (tryBuyDaoMeridian(state)) {
      tryCompleteAchievements(state);
      saveGame(state);
      toast("灵窍贯通，道韵已固化为修为。");
      render();
    } else {
      toast("无法贯通：道韵不足或已达上限。");
    }
  });

  document.querySelectorAll("[data-vein]").forEach((el) => {
    el.addEventListener("click", () => {
      const k = (el as HTMLElement).dataset.vein as VeinKind | undefined;
      if (!k) return;
      if (buyVeinUpgrade(state, k)) {
        if (state.tutorialStep === 6) {
          state.tutorialStep = 7;
        toast("下一步：回到「灵府→灵脉」完成 1 次破境。");
        } else {
          toast(`${VEIN_TITLES[k]} 升级成功。`);
        }
        tryCompleteAchievements(state);
        saveGame(state);
        render();
      } else {
        toast("资源不足或已达上限");
      }
    });
  });

  document.querySelectorAll("[data-garden-plant]").forEach((el) => {
    el.addEventListener("click", () => {
      const raw = (el as HTMLElement).dataset.gardenPlant;
      const idx = raw !== undefined ? Number(raw) : NaN;
      if (!Number.isFinite(idx) || idx < 0 || idx >= GARDEN_PLOT_COUNT) return;
      const sel = document.getElementById(`garden-crop-${idx}`) as HTMLSelectElement | null;
      const crop = sel?.value as GardenCropId | undefined;
      if (!crop || !GARDEN_CROPS[crop]) return;
      const t = nowMs();
      if (plantCrop(state, idx, crop, t)) {
        saveGame(state);
        toast(`已种下 ${GARDEN_CROPS[crop].name}`);
        render();
      } else {
        toast("无法播种：灵石不足，或该地块已有作物。");
      }
    });
  });

  document.querySelectorAll("[data-garden-harvest]").forEach((el) => {
    el.addEventListener("click", () => {
      const raw = (el as HTMLElement).dataset.gardenHarvest;
      const idx = raw !== undefined ? Number(raw) : NaN;
      if (!Number.isFinite(idx) || idx < 0 || idx >= GARDEN_PLOT_COUNT) return;
      const t = nowMs();
      const res = harvestPlot(state, idx, t);
      if (!res) {
        toast("尚未成熟。");
        return;
      }
      const newly = tryCompleteAchievements(state);
      saveGame(state);
      toast(res.message);
      updateTopResourcePillsAndVigor(totalCardsInPool());
      for (const a of newly) toastAchievement(a);
      render();
    });
  });

  document.querySelectorAll("[data-bounty-claim]").forEach((el) => {
    el.addEventListener("click", () => {
      const id = (el as HTMLElement).dataset.bountyClaim;
      if (!id) return;
      const t = nowMs();
      if (claimWeeklyBountyTask(state, id, t)) {
        tryCompleteAchievements(state);
        saveGame(state);
        toast("悬赏奖励已领取");
        updateTopResourcePillsAndVigor(totalCardsInPool());
        render();
      } else {
        toast("无法领取：未达成或本周已领过。");
      }
    });
  });

  document.getElementById("btn-bounty-claim-all")?.addEventListener("click", () => {
    const t = nowMs();
    const r = claimAllCompletableWeeklyBounties(state, t);
    if (r.claimed <= 0) {
      toast("当前没有可领取的悬赏。");
      return;
    }
    tryCompleteAchievements(state);
    saveGame(state);
    toast(
      `已领取 ${r.claimed} 条悬赏：灵石 +${r.rewardStones} · 唤灵髓 +${r.rewardEssence}`,
    );
    updateTopResourcePillsAndVigor(totalCardsInPool());
    render();
  });

  document.body.addEventListener("click", (ev) => {
    const t0 = (ev.target as HTMLElement | null)?.closest?.("#btn-daily-login-claim") as HTMLElement | null;
    if (!t0) return;
    const t = nowMs();
    if (!claimDailyLoginReward(state, t)) {
      toast("今日已领取过灵息礼。");
      return;
    }
    tryCompleteAchievements(state);
    saveGame(state);
    toast("灵息礼已领取");
    updateTopResourcePillsAndVigor(totalCardsInPool());
    const pStr = document.getElementById("ps-streak");
    if (pStr) pStr.textContent = String(state.dailyStreak);
    const pAch = document.getElementById("ps-ach");
    if (pAch) pAch.textContent = `${state.achievementsDone.size} / ${ACHIEVEMENTS.length}`;
    if (activeHub === "cultivate" && cultivateSub === "daily") {
      updateDailyLoginPanelReadouts(state, t);
    } else {
      render();
    }
  });

  document.body.addEventListener("click", (ev) => {
    const el = (ev.target as HTMLElement | null)?.closest?.("[data-celestial-buy]") as HTMLElement | null;
    if (!el) return;
    const id = el.dataset.celestialBuy;
    if (!id) return;
    const t = nowMs();
    const err = tryBuyCelestialOffer(state, id, t);
    if (err) {
      toast(err);
      return;
    }
    tryCompleteAchievements(state);
    saveGame(state);
    toast("天机匣兑换成功");
    updateTopResourcePillsAndVigor(totalCardsInPool());
    const pAch = document.getElementById("ps-ach");
    if (pAch) pAch.textContent = `${state.achievementsDone.size} / ${ACHIEVEMENTS.length}`;
    if (activeHub === "cultivate" && cultivateSub === "stash") {
      updateCelestialStashPanelReadouts(state, t);
    } else {
      render();
    }
  });

  document.body.addEventListener("click", (ev) => {
    const b = (ev.target as HTMLElement | null)?.closest?.("#btn-spirit-reservoir-claim") as HTMLElement | null;
    if (!b) return;
    if (!canClaimSpiritReservoir(state)) {
      toast("暂无蓄灵可收。");
      return;
    }
    const got = claimSpiritReservoir(state);
    if (got.lte(0)) return;
    tryCompleteAchievements(state);
    saveGame(state);
    toast(`收取蓄灵 ${fmtDecimal(got)} 灵石`);
    updateTopResourcePillsAndVigor(totalCardsInPool());
    const pAch = document.getElementById("ps-ach");
    if (pAch) pAch.textContent = `${state.achievementsDone.size} / ${ACHIEVEMENTS.length}`;
    const t = nowMs();
    if (activeHub === "estate" && estateSub === "idle") {
      updateEstateIdleLiveReadouts(t);
    } else {
      render();
    }
  });

  document.body.addEventListener("click", (ev) => {
    const b = (ev.target as HTMLElement | null)?.closest?.("#btn-spirit-array-up") as HTMLElement | null;
    if (!b) return;
    if (!tryUpgradeSpiritArray(state)) {
      toast("灵石或灵砂不足，或已达阵图上限。");
      return;
    }
    tryCompleteAchievements(state);
    saveGame(state);
    toast("阵图精进一重");
    updateTopResourcePillsAndVigor(totalCardsInPool());
    const pAch = document.getElementById("ps-ach");
    if (pAch) pAch.textContent = `${state.achievementsDone.size} / ${ACHIEVEMENTS.length}`;
    if (activeHub === "estate" && estateSub === "array") {
      updateSpiritArrayPanelReadouts(state);
    } else {
      render();
    }
  });

  const readEntryWave = (): number => {
    const inp = document.getElementById("dungeon-entry-wave") as HTMLInputElement | null;
    const raw = inp?.valueAsNumber;
    const d = state.dungeon;
    const cap = dungeonFrontierWave(state);
    if (raw == null || !Number.isFinite(raw)) return Math.max(1, Math.min(cap, d.entryWave));
    return Math.max(1, Math.min(cap, Math.floor(raw)));
  };

  document.getElementById("btn-dungeon-entry-frontier")?.addEventListener("click", () => {
    const n = dungeonFrontierWave(state);
    const inp = document.getElementById("dungeon-entry-wave") as HTMLInputElement | null;
    if (inp) inp.value = String(n);
    state.dungeon.entryWave = n;
    saveGame(state);
    render();
  });

  document.getElementById("btn-dungeon-enter")?.addEventListener("click", () => {
    const w = readEntryWave();
    state.dungeon.entryWave = w;
    const now = nowMs();
    if (!canEnterDungeon(state, now)) {
      toast("当前无法进入：冷却中或仍在副本内。");
      return;
    }
    if (!canEnterAtWave(state, w)) {
      toast("无法从该波进入：已超过当前可推进范围，或该波不可选。");
      return;
    }
    if (!confirm(`确认进入第 ${w} 关？`)) return;
    if (enterDungeon(state, w)) {
      saveGame(state);
      toast(`已进入幻域（自第 ${w} 波）`);
      render();
    } else {
      toast("无法进入副本（冷却或其它限制）");
    }
  });

  document.getElementById("sanctuary-auto-enter")?.addEventListener("change", (e) => {
    const el = e.target as HTMLInputElement;
    state.dungeonSanctuaryAutoEnter = el.checked;
    saveGame(state);
    render();
  });
  document.getElementById("btn-sanctuary-portal")?.addEventListener("click", () => {
    const now = nowMs();
    const w = state.dungeonPortalTargetWave;
    if (!state.dungeonSanctuaryMode || state.dungeon.active || w < 1) return;
    const pmax = playerMaxHp(state);
    if (state.combatHpCurrent < pmax - 0.25) {
      toast("灵息未满");
      return;
    }
    if (!canEnterDungeon(state, now) || !canEnterAtWave(state, w)) {
      toast("当前无法进入该关卡。");
      return;
    }
    if (!confirm(`确认进入第 ${w} 关？`)) return;
    if (enterDungeon(state, w)) {
      activeHub = "battle";
      saveGame(state);
      toast(`已进入第 ${w} 关`);
      render();
    } else {
      toast("无法进入副本");
    }
  });
  document.getElementById("btn-dungeon-help")?.addEventListener("click", (e) => {
    e.stopPropagation();
    const p = document.getElementById("dungeon-help-popover");
    const b = document.getElementById("btn-dungeon-help");
    if (!p || !b) return;
    p.hidden = !p.hidden;
    b.setAttribute("aria-expanded", p.hidden ? "false" : "true");
  });
  const onDungeonLivePointerUp = (e: PointerEvent): void => {
    if (!state.dungeon.active) return;
    const d = state.dungeon;
    const interWaveWait = d.mobs.length === 0 && d.interWaveCooldownUntil > nowMs();
    if (interWaveWait) return;
    if (e.pointerType === "mouse" && e.button !== 0) return;
    const el = e.target as HTMLElement | null;
    if (el?.closest("button, a, input, textarea, select, label, [role='button']")) return;
    tryQueueDungeonDodgeWithFeedback();
  };
  document.getElementById("dungeon-live-root")?.addEventListener("pointerup", onDungeonLivePointerUp);
  document.getElementById("btn-dungeon-leave")?.addEventListener("click", () => {
    if (!confirm("确认暂离副本？再次进入将重置本波地图与魔物。")) return;
    leaveDungeon(state);
    saveGame(state);
    toast("已暂离副本；再次进入将重置本波地图与魔物。");
    render();
  });
  document.getElementById("btn-dungeon-challenge-boss")?.addEventListener("click", () => {
    requestBossChallenge(state);
    saveGame(state);
    toast("已切换为首领战：本波将重整为首领。");
    render();
  });
  document.getElementById("btn-dungeon-boss-next-entry")?.addEventListener("click", () => {
    state.dungeonDeferBoss = false;
    saveGame(state);
    toast("已切换为首领战：下次进入该波将面对首领。");
    render();
  });

  document.querySelectorAll("[data-skill-train]").forEach((el) => {
    el.addEventListener("click", () => {
      const id = (el as HTMLElement).dataset.skillTrain as SkillId;
      if (id !== "combat" && id !== "gathering" && id !== "arcana") return;
      state.activeSkillId = id;
      saveGame(state);
      render();
    });
  });

  document.getElementById("btn-pet-pull")?.addEventListener("click", () => {
    const r = pullPet(state);
    toast(r.msg);
    if (r.ok) {
      tryCompleteAchievements(state);
      saveGame(state);
      render();
    }
  });

  document.getElementById("btn-skill-none")?.addEventListener("click", () => {
    state.activeSkillId = null;
    saveGame(state);
    render();
  });

  document.getElementById("btn-pull-battle-skill")?.addEventListener("click", () => {
    const r = pullBattleSkill(state);
    toast(r.msg);
    if (r.ok) {
      saveGame(state);
      render();
    }
  });

  const fg = document.getElementById("feature-guide-panel");
  if (fg) {
    const gid = fg.dataset.guideId as FeatureGuideId | undefined;
    const dismiss = (never: boolean): void => {
      if (never) state.suppressFeatureGuides = true;
      if (gid && !state.featureGuideDismissed.includes(gid)) state.featureGuideDismissed.push(gid);
      saveGame(state);
      render();
    };
    document.getElementById("btn-feature-guide-ok")?.addEventListener("click", () => {
      const never = (document.getElementById("chk-feature-guide-never") as HTMLInputElement | null)?.checked ?? false;
      dismiss(never);
    });
    document.getElementById("btn-feature-guide-skip-once")?.addEventListener("click", () => {
      const never = (document.getElementById("chk-feature-guide-never") as HTMLInputElement | null)?.checked ?? false;
      // “跳过”按“本条已处理”执行，但不强制开启全局不再显示。
      dismiss(never);
      characterSub = "stats";
      render();
    });
  }

  document.getElementById("btn-save")?.addEventListener("click", () => {
    saveGame(state);
    toast("已保存到本机。");
  });

  document.getElementById("btn-export")?.addEventListener("click", () => {
    const s = exportSave(state);
    void navigator.clipboard.writeText(s).then(
      () => toast("存档字符串已复制到剪贴板。"),
      () => {
        const pasted = window.prompt("剪贴板不可用，请手动复制以下完整存档字符串：", s);
        if (pasted == null) {
          toast("导出未完成：请重试或检查剪贴板权限。");
        } else {
          toast("已显示完整存档字符串，请手动复制。");
        }
      },
    );
  });

  document.getElementById("btn-save-download")?.addEventListener("click", () => {
    triggerDownloadSaveBackup();
  });

  document.querySelectorAll("[data-save-slot-activate]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const slot = Number((btn as HTMLElement).dataset.saveSlotActivate);
      if (!Number.isFinite(slot) || slot < 0 || slot >= SAVE_SLOT_COUNT) return;
      if (slot === getActiveSlotIndex()) return;
      if (peekSlotSummary(slot).empty) {
        const ok = confirm(
          `存档位 ${slot + 1} 当前为空。切换后将从此槽开始新开局（当前槽会先保存）。确定吗？`,
        );
        if (!ok) return;
      }
      state = switchToSaveSlot(slot, state);
      selectedInvId = null;
      refineTargetId = null;
      autoEnterPromptHandled = false;
      flyCreditsDismissed = false;
      saveGame(state);
      toast(`已切换到存档位 ${slot + 1}`);
      render();
    });
  });

  document.querySelectorAll("[data-save-slot-copy]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const slot = Number((btn as HTMLElement).dataset.saveSlotCopy);
      if (!Number.isFinite(slot) || slot < 0 || slot >= SAVE_SLOT_COUNT) return;
      if (slot === getActiveSlotIndex()) return;
      const sum = peekSlotSummary(slot);
      if (!sum.empty) {
        const ok = confirm(`将用当前进度覆盖存档位 ${slot + 1} 的已有存档。确定吗？`);
        if (!ok) return;
      }
      copyCurrentToSlot(slot, state);
      toast(`已复制当前进度到存档位 ${slot + 1}`);
      render();
    });
  });

  document.querySelectorAll(".save-slot-label-input").forEach((el) => {
    el.addEventListener("change", () => {
      const inp = el as HTMLInputElement;
      const slot = Number(inp.dataset.saveSlotLabel);
      if (!Number.isFinite(slot) || slot < 0 || slot >= SAVE_SLOT_COUNT) return;
      setSlotLabel(slot, inp.value);
      inp.value = getSlotLabel(slot);
    });
  });

  document.getElementById("btn-import")?.addEventListener("click", () => {
    const inp = document.getElementById("import-input") as HTMLInputElement | null;
    const raw = inp?.value?.trim();
    if (!raw) {
      toast("请先粘贴存档字符串。");
      inp?.focus();
      return;
    }
    const next = importSave(raw);
    if (!next) {
      toast("导入失败：字符串无效。");
      return;
    }
    const curExport = exportSave(state);
    if (raw !== curExport) {
      const ok = confirm("导入会覆盖当前进度，建议先导出备份。确认继续导入吗？");
      if (!ok) return;
    }
    state = next;
    selectedInvId = null;
    refineTargetId = null;
    autoEnterPromptHandled = false;
    flyCreditsDismissed = false;
    saveGame(state);
    toast("存档导入成功。");
    render();
  });

  document.querySelector(".app-title-spirit")?.addEventListener("click", () => {
    const msg = onTitleSpiritPet();
    if (msg) toast(msg);
  });
}

function setPillStrong(pillId: string, text: string): void {
  const el = document.getElementById(pillId);
  if (!el) return;
  if (el.tagName === "STRONG") {
    el.textContent = text;
    return;
  }
  const strong = el.querySelector("strong");
  if (strong) strong.textContent = text;
}

function easeOutCubic01(t: number): number {
  const x = Math.max(0, Math.min(1, t));
  const y = 1 - x;
  return 1 - y * y * y;
}

function ensureCombatPowerPopup(): void {
  if (combatPowerPopupEl) return;
  if (typeof document === "undefined") return;
  const el = document.createElement("div");
  el.id = "combat-power-popup";
  el.className = "combat-power-popup";
  el.setAttribute("aria-live", "polite");
  el.setAttribute("aria-atomic", "true");
  el.innerHTML = `<div class="combat-power-popup-inner"><span class="combat-power-popup-base" id="combat-power-popup-base">0</span><span class="combat-power-popup-delta" id="combat-power-popup-delta">+0</span></div>`;
  document.body.appendChild(el);
  combatPowerPopupEl = el;
  combatPowerPopupBaseEl = el.querySelector("#combat-power-popup-base");
  combatPowerPopupDeltaEl = el.querySelector("#combat-power-popup-delta");
}

function readCombatPowerPopupSnapshot(now: number): { base: number; delta: number } | null {
  if (!combatPowerPopupAnim) return null;
  const t = Math.min(1, (now - combatPowerPopupAnim.startAt) / COMBAT_POWER_POPUP_DURATION_MS);
  const e = easeOutCubic01(t);
  return {
    base: combatPowerPopupAnim.startBase + (combatPowerPopupAnim.endBase - combatPowerPopupAnim.startBase) * e,
    delta: combatPowerPopupAnim.startDelta + (combatPowerPopupAnim.endDelta - combatPowerPopupAnim.startDelta) * e,
  };
}

function renderCombatPowerPopup(base: number, delta: number): void {
  ensureCombatPowerPopup();
  if (!combatPowerPopupEl || !combatPowerPopupBaseEl || !combatPowerPopupDeltaEl) return;
  const b = Math.max(0, Math.round(base));
  const d = Math.round(delta);
  combatPowerPopupBaseEl.textContent = fmtNumZh(b);
  combatPowerPopupDeltaEl.textContent = `${d >= 0 ? "+" : "-"}${fmtNumZh(Math.abs(d))}`;
  combatPowerPopupDeltaEl.classList.remove("is-up", "is-down");
  combatPowerPopupDeltaEl.classList.add(d >= 0 ? "is-up" : "is-down");
}

function animateCombatPowerPopup(fromPower: number, toPower: number): void {
  if (fromPower === toPower) return;
  ensureCombatPowerPopup();
  if (!combatPowerPopupEl) return;
  const now = nowMs();
  const snap = readCombatPowerPopupSnapshot(now);
  const startBase = snap ? snap.base : fromPower;
  const endBase = toPower;
  const startDelta = toPower - startBase;
  const endDelta = 0;
  combatPowerPopupToken += 1;
  const token = combatPowerPopupToken;
  combatPowerPopupAnim = { startAt: now, startBase, endBase, startDelta, endDelta, token };
  if (combatPowerPopupHideTimer) {
    window.clearTimeout(combatPowerPopupHideTimer);
    combatPowerPopupHideTimer = 0;
  }
  const rising = toPower >= fromPower;
  combatPowerPopupEl.classList.remove("fx-up", "fx-down");
  // 强制重排，确保连续覆盖时动效可重播。
  void combatPowerPopupEl.offsetWidth;
  combatPowerPopupEl.classList.add(rising ? "fx-up" : "fx-down");
  combatPowerPopupEl.classList.add("active");
  const tick = (): void => {
    if (!combatPowerPopupAnim || combatPowerPopupAnim.token !== token) return;
    const curNow = nowMs();
    const t = Math.min(1, (curNow - combatPowerPopupAnim.startAt) / COMBAT_POWER_POPUP_DURATION_MS);
    const e = easeOutCubic01(t);
    const base = combatPowerPopupAnim.startBase + (combatPowerPopupAnim.endBase - combatPowerPopupAnim.startBase) * e;
    const delta = combatPowerPopupAnim.startDelta + (combatPowerPopupAnim.endDelta - combatPowerPopupAnim.startDelta) * e;
    renderCombatPowerPopup(base, delta);
    if (t < 1) {
      requestAnimationFrame(tick);
      return;
    }
    renderCombatPowerPopup(endBase, 0);
    combatPowerPopupAnim = null;
    combatPowerPopupHideTimer = window.setTimeout(() => {
      if (combatPowerPopupEl) combatPowerPopupEl.classList.remove("active", "fx-up", "fx-down");
      combatPowerPopupHideTimer = 0;
    }, COMBAT_POWER_POPUP_HOLD_MS);
  };
  requestAnimationFrame(tick);
}

function updateCombatPowerTip(power: number): void {
  const prev = lastCombatPower;
  if (prev <= 0) {
    lastCombatPower = power;
    return;
  }
  const delta = power - prev;
  if (delta === 0) return;
  const threshold = Math.max(8, Math.floor(prev * 0.025));
  if (Math.abs(delta) < threshold) {
    lastCombatPower = power;
    return;
  }
  animateCombatPowerPopup(prev, power);
  lastCombatPower = power;
}

/** 顶栏灵石/髓等 + 道韵行：局部操作后调用，避免整页 innerHTML 重绘 */
function updateTopResourcePillsAndVigor(pool: number): void {
  syncDecimalFormatFromState(state);
  const u = getUiUnlocks(state);
  const ipsLoop = incomePerSecond(state, pool);
  setPillStrong("pill-stones", fmtDecimal(stones(state)));
  const psd = document.getElementById("pill-stones-delta");
  if (psd) psd.textContent = `+${fmtDecimal(ipsLoop)}/秒`;
  setPillStrong("pill-essence", String(state.summonEssence));
  const eps = essenceIncomePerSecondFromResonance(state);
  const ped = document.getElementById("pill-essence-delta");
  if (ped) ped.textContent = `+${eps >= 0.1 ? eps.toFixed(2) : eps.toFixed(3)}/秒`;
  if (u.tabGear) {
    setPillStrong("pill-ling-sha", String(state.lingSha));
    setPillStrong("pill-xuan-tie", String(state.xuanTie));
  }
  if (u.statDao) setPillStrong("pill-dao", fmt(state.daoEssence));
  if (u.statZao) setPillStrong("pill-zao", String(state.zaoHuaYu));
  setPillStrong("pill-realm", String(state.realmLevel));
  const power = playerCombatPower(state);
  setPillStrong("pill-power", fmtNumZh(power));
  updateCombatPowerTip(power);
  const vigLine = document.querySelector(".vigor-line");
  if (vigLine) {
    const t = describeInGameUi(state).tagLine;
    vigLine.textContent = t;
    (vigLine as HTMLElement).hidden = !t;
  }
}

/** 灵府·灵脉页实时数字与吐纳/闭关条（仅在该子页时 DOM 存在） */
function updateEstateIdleLiveReadouts(now: number): void {
  const pool = totalCardsInPool();
  const ips = incomePerSecond(state, pool);
  const br = incomeBreakdownForDisplay(state, pool);
  const totalEl = document.getElementById("income-total-live");
  const realmEl = document.getElementById("income-realm-live");
  const deckEl = document.getElementById("income-deck-live");
  if (totalEl) totalEl.textContent = fmtDecimal(ips);
  if (realmEl) realmEl.textContent = fmtDecimal(br.fromRealm);
  if (deckEl) deckEl.textContent = fmtDecimal(br.fromDeck);
  const huiSpan = document.getElementById("idle-vein-hui");
  const lingSpan = document.getElementById("idle-vein-ling");
  if (huiSpan) huiSpan.textContent = veinHuiLingMult(state.vein.huiLing).toFixed(2);
  if (lingSpan) lingSpan.textContent = veinLingXiMult(state.vein.lingXi).toFixed(2);
  const uIdle = getUiUnlocks(state);
  const btnFf = document.getElementById("btn-ff") as HTMLButtonElement | null;
  if (btnFf && uIdle.privilegePanel && uIdle.biGuan) {
    const left = Math.max(0, state.biGuanCooldownUntil - nowMs());
    btnFf.disabled = left > 0;
    btnFf.textContent =
      left > 0 ? `闭关回气中（约 ${Math.ceil(left / 1000)} 息后可再施）` : "闭关一纪（预演一时段挂机收益）";
  }
  const btnTuna = document.getElementById("btn-tuna") as HTMLButtonElement | null;
  if (btnTuna) {
    const leftT = tunaCooldownLeftMs(state, nowMs());
    const readyT = leftT <= 0;
    const g = tunaStoneReward(state.realmLevel);
    btnTuna.disabled = !readyT;
    btnTuna.className = readyT ? "btn btn-primary" : "btn";
    btnTuna.textContent = readyT ? `吐纳（+${g} 灵石）` : `吐纳（${Math.ceil(leftT / 1000)} 息）`;
  }
  const tunaBar = document.getElementById("tuna-cd-bar");
  if (tunaBar) {
    const leftT = tunaCooldownLeftMs(state, now);
    const readyT = leftT <= 0;
    tunaBar.style.width = `${readyT ? 100 : Math.min(100, 100 - (100 * leftT) / TUNA_COOLDOWN_MS)}%`;
  }
  const bgBar = document.getElementById("bi-guan-cd-bar");
  if (bgBar) {
    const left = Math.max(0, state.biGuanCooldownUntil - now);
    bgBar.style.width = `${left <= 0 ? 100 : Math.min(100, 100 - (100 * left) / BI_GUAN_COOLDOWN_MS)}%`;
  }
  if (uIdle.tabSpiritReservoir) {
    const rs = reservoirStored(state);
    const rc = reservoirCap(state);
    const rPct = reservoirFillRatio(state) * 100;
    const canRs = canClaimSpiritReservoir(state);
    const elS = document.getElementById("spirit-reservoir-stored");
    const elC = document.getElementById("spirit-reservoir-cap");
    const bar = document.getElementById("spirit-reservoir-bar-fill") as HTMLElement | null;
    const btn = document.getElementById("btn-spirit-reservoir-claim") as HTMLButtonElement | null;
    if (elS) elS.textContent = fmtDecimal(rs);
    if (elC) elC.textContent = fmtDecimal(rc);
    if (bar) bar.style.width = `${rPct}%`;
    if (btn) {
      btn.disabled = !canRs;
      btn.className = `btn ${canRs ? "btn-primary" : ""}`;
      btn.textContent = canRs ? "收取蓄灵" : "暂无蓄灵";
    }
  }
  if (uIdle.tabDailyFortune) {
    const fd = getActiveFortuneDef(state);
    const dayEl = document.getElementById("daily-fortune-day");
    if (dayEl) dayEl.textContent = state.dailyFortune.calendarDay || toLocalYMD(now);
    if (fd) {
      const tEl = document.getElementById("daily-fortune-title");
      const dEl = document.getElementById("daily-fortune-desc");
      const sEl = document.getElementById("daily-fortune-stone");
      const gEl = document.getElementById("daily-fortune-dungeon");
      if (tEl) tEl.textContent = fd.title;
      if (dEl) dEl.textContent = fd.desc;
      if (sEl) sEl.textContent = `+${((fd.stoneMult - 1) * 100).toFixed(1)}%`;
      if (gEl) gEl.textContent = `+${((fd.dungeonMult - 1) * 100).toFixed(1)}%`;
    }
  }
}

/** 灵府·灵田：生长条与收获按钮（仅在该子页时 DOM 存在） */
function updateEstateGardenLiveReadouts(now: number): void {
  const totalEl = document.getElementById("garden-total-harvests");
  if (totalEl) totalEl.textContent = String(state.spiritGarden.totalHarvests);
  for (let i = 0; i < GARDEN_PLOT_COUNT; i++) {
    const p = state.spiritGarden.plots[i];
    if (!p.crop) continue;
    const rem = plotGrowRemainingMs(state, i, now);
    const ready = isPlotReady(state, i, now);
    const eta = document.getElementById(`garden-eta-${i}`);
    if (eta) eta.textContent = ready ? "已成熟，可收获" : `约 ${Math.ceil(rem / 1000)} 息后成熟`;
    const fill = document.getElementById(`garden-bar-fill-${i}`);
    if (fill && p.crop) {
      const def = GARDEN_CROPS[p.crop];
      const pct = ready ? 100 : Math.min(100, 100 - (100 * rem) / (def.growSec * 1000));
      fill.style.width = `${pct}%`;
    }
    const btn = document.querySelector(`button[data-garden-harvest="${i}"]`) as HTMLButtonElement | null;
    if (btn) {
      btn.disabled = !ready;
      btn.className = ready ? "btn btn-primary" : "btn";
      btn.textContent = ready ? "收获" : "生长中";
    }
  }
}

function loop(): void {
  syncDecimalFormatFromState(state);
  const now = nowMs();
  applyTick(state, now);
  if (!mobileLiteFx) updateModernVisualFx(now);
  if (typeof document !== "undefined" && tryAutoEnterFromSanctuaryPortal(state, now)) {
    activeHub = "battle";
    lastAutoEnterFailReason = "";
    saveGame(state);
    toast(`灵息已盈，已传送至第 ${state.dungeon.wave} 关`);
    render();
  } else if (typeof document !== "undefined") {
    maybeToastAutoEnterFailure(now);
  }
  // 幻域解锁后首次且尚未通关第 1 波：自动从第 1 关进本
  if (
    typeof document !== "undefined" &&
    state.tutorialStep === 0 &&
    getUiUnlocks(state).tabDungeon &&
    !state.dungeon.active &&
    !state.dungeon.autoEnterConsumed &&
    state.dungeon.maxWaveRecord === 0 &&
    canEnterDungeon(state, now) &&
    canEnterAtWave(state, 1)
  ) {
    if (!autoEnterPromptHandled) {
      autoEnterPromptHandled = true;
      const ok = confirm(`幻域已解锁，是否立即进入第 1 关？`);
      if (ok && enterDungeon(state, 1)) {
        activeHub = "battle";
        saveGame(state);
        toast(`已进入第 1 关`);
        render();
      } else if (!ok) {
        state.dungeon.autoEnterConsumed = true;
        saveGame(state);
      }
    }
  }
  const floatPopups = drainDungeonDamageFloats();
  if (floatPopups.length && typeof document !== "undefined") {
    if (state.dungeon.active) duelFloatBurstAtMs = Date.now();
    const layer = document.getElementById("dungeon-float-layer");
    if (layer) {
      for (const f of floatPopups) {
        const el = document.createElement("span");
        el.className = `dungeon-float-txt ${f.cls}`;
        el.textContent = f.text;
        el.style.left = `${100 * f.nx}%`;
        el.style.top = `${100 * f.ny}%`;
        layer.appendChild(el);
        setTimeout(() => el.remove(), 880);
      }
    }
  }
  if (state.dungeon.pendingToast) {
    const m = state.dungeon.pendingToast;
    state.dungeon.pendingToast = null;
    if (m.startsWith("破阵胜利")) tryToastDungeonVictory(m);
    else tryToast(m);
    saveGame(state);
  }
  /** 阵亡/暂离出本：仍在幻域页时整页重绘，避免底部生命/地图卡在进本前状态 */
  if (
    typeof document !== "undefined" &&
    lastDungeonActive &&
    !state.dungeon.active &&
    activeHub === "battle"
  ) {
    render();
  }
  /** 阵亡已在 `dungeonSanctuaryMode` 中处理并会走 pendingToast；此处仅补「暂离等非回气所」在后台结束时的提示 */
  if (
    lastDungeonActive &&
    !state.dungeon.active &&
    typeof document !== "undefined" &&
    document.visibilityState === "hidden" &&
    !state.dungeonSanctuaryMode
  ) {
    deferredDungeonToasts.push("幻域已结束（阵亡或暂离）");
  }
  lastDungeonActive = state.dungeon.active;
  for (const a of drainAchievementToastQueue()) {
    toastAchievement(a);
  }
  toastTimer += LOOP_INTERVAL_MS;
  if (toastTimer >= 5000) {
    toastTimer = 0;
    saveGame(state);
  }
  const pool = totalCardsInPool();
  if (activeHub === "estate" && estateSub === "idle") {
    updateEstateIdleLiveReadouts(now);
  }
  if (activeHub === "estate" && estateSub === "vein") {
    const ipsV = incomePerSecond(state, pool);
    const v = state.vein;
    const huiM = veinHuiLingMult(v.huiLing);
    const lingM = veinLingXiMult(v.lingXi);
    const elIps = document.getElementById("vein-preview-ips");
    if (elIps) elIps.textContent = fmtDecimal(ipsV);
    const elH = document.getElementById("vein-live-hui");
    if (elH) elH.textContent = huiM.toFixed(3);
    const elL = document.getElementById("vein-live-ling");
    if (elL) elL.textContent = lingM.toFixed(3);
    const elHL = document.getElementById("vein-live-hui-ling");
    if (elHL) elHL.textContent = (huiM * lingM).toFixed(3);
    const elGm = document.getElementById("vein-live-gongming");
    if (elGm) elGm.textContent = veinGongMingResonanceMult(v.gongMing).toFixed(3);
    const vk: VeinKind[] = ["huiLing", "guYuan", "lingXi", "gongMing"];
    for (const k of vk) {
      const fill = document.querySelector(`.vein-lv-fill-${k}`) as HTMLElement | null;
      if (fill) fill.style.width = `${(v[k] / VEIN_MAX_LEVEL) * 100}%`;
    }
  }
  if (activeHub === "estate" && estateSub === "garden") {
    updateEstateGardenLiveReadouts(now);
  }
  if (activeHub === "estate" && estateSub === "array") {
    updateSpiritArrayPanelReadouts(state);
  }
  if (activeHub === "cultivate" && cultivateSub === "train") {
    for (const id of ["combat", "gathering", "arcana"] as const) {
      const sk = state.skills[id];
      const need = xpToNextLevel(sk.level);
      const pct = need > 0 ? Math.min(100, (100 * sk.xp) / need) : 100;
      const rate = skillXpPerSecond(sk.level);
      const eta = secondsToNextLevel(sk);
      const xl = document.getElementById(`skill-xp-line-${id}`);
      if (xl) xl.textContent = `${fmtNumZh(sk.xp)} / ${fmtNumZh(need)}`;
      const rt = document.getElementById(`skill-rate-${id}`);
      if (rt) rt.textContent = rate.toFixed(1);
      const et = document.getElementById(`skill-eta-${id}`);
      if (et) et.textContent = fmtSkillEta(eta);
      const pl = document.getElementById(`skill-pct-label-${id}`);
      if (pl) pl.textContent = `${pct.toFixed(1)}%`;
      const bar = document.getElementById(`skill-bar-fill-${id}`);
      if (bar) (bar as HTMLElement).style.width = `${pct}%`;
    }
    const aid = state.activeSkillId;
    if (aid === "combat" || aid === "gathering" || aid === "arcana") {
      const sk = state.skills[aid];
      const br = document.getElementById("train-banner-rate");
      const be = document.getElementById("train-banner-eta");
      if (br) br.textContent = skillXpPerSecond(sk.level).toFixed(1);
      if (be) be.textContent = fmtSkillEta(secondsToNextLevel(sk));
    }
  }
  if (activeHub === "cultivate" && cultivateSub === "xinfa") {
    const bsr = document.getElementById("battle-skills-readout");
    if (bsr) bsr.textContent = `当前：${describeBattleSkillLevels(state)}`;
    const btnPull = document.getElementById("btn-pull-battle-skill") as HTMLButtonElement | null;
    if (btnPull) btnPull.disabled = state.summonEssence < battleSkillPullCost();
  }
  if (activeHub === "cultivate" && cultivateSub === "bounty") {
    updateBountyPanelReadouts(state, now);
  }
  if (activeHub === "cultivate" && cultivateSub === "daily") {
    updateDailyLoginPanelReadouts(state, now);
  }
  if (activeHub === "cultivate" && cultivateSub === "stash") {
    updateCelestialStashPanelReadouts(state, now);
  }
  if (getUiUnlocks(state).tabDungeon && state.dungeon.active) {
    const d = state.dungeon;
    /** 仅当正在查看「幻域」页时才补挂载地图；否则地图本就不在 DOM，会误判为缺失而每帧 render */
    if (activeHub === "battle" && d.mobs.length > 0 && !document.getElementById("dungeon-map")) {
      render();
    }
    if (
      d.mobs.length === 0 &&
      d.interWaveCooldownUntil > now &&
      document.getElementById("dungeon-inter-sec")
    ) {
      const cd = Math.max(0, d.interWaveCooldownUntil - now);
      const pct =
        DUNGEON_INTER_WAVE_CD_MS > 0
          ? Math.min(100, (100 * (DUNGEON_INTER_WAVE_CD_MS - cd)) / DUNGEON_INTER_WAVE_CD_MS)
          : 100;
      const secEl = document.getElementById("dungeon-inter-sec");
      const barEl = document.getElementById("dungeon-inter-bar-fill") as HTMLElement | null;
      if (secEl) secEl.textContent = `${Math.ceil(cd / 1000)} 秒`;
      if (barEl) barEl.style.width = `${pct}%`;
    }
    const mapEl = document.getElementById("dungeon-map");
    if (activeHub === "battle" && mapEl) {
      mapEl.classList.toggle("is-aoe", d.inMelee && d.attackVisualMode === "aoe");
      mapEl.classList.toggle("is-single", false);
      mapEl.classList.toggle("in-combat", d.inMelee);
      mapEl.classList.toggle("duel-weak-active", now < d.duelWeakUntilMs);
      const tgt = d.mobs.find((m) => m.hp > 0);
      const hi =
        tgt && tgt.hp > 0 ? Math.max(0.35, tgt.attackInterval ?? DUNGEON_MONSTER_HIT_INTERVAL) : 1;
      const hitPhase =
        tgt && tgt.hp > 0 ? (((d.monsterAttackAccum % hi) + hi) % hi) / hi : 0;
      const duelMood =
        now < d.dodgeIframesUntil
          ? "iframe"
          : d.duelFervor >= 100
            ? "fervor"
            : hitPhase > 0.5
              ? "windup"
              : "none";
      mapEl.classList.toggle("duel-mood-iframe", duelMood === "iframe");
      mapEl.classList.toggle("duel-mood-windup", duelMood === "windup");
      mapEl.classList.toggle("duel-mood-fervor", duelMood === "fervor");
      mapEl.classList.toggle("duel-boss-telegraph", d.bossDodgeVisual);
      mapEl.classList.toggle("duel-combo-high", d.duelComboStacks >= 7);
      mapEl.classList.toggle(
        "duel-fx-hit",
        !prefersReducedMotion && Date.now() - duelFloatBurstAtMs < 140,
      );
      mapEl.classList.toggle(
        "duel-hp-low",
        d.playerMax > 0 && d.playerHp / d.playerMax < 0.28,
      );
      mapEl.classList.toggle("duel-is-boss", !!(tgt?.isBoss));
      const waveTxt = document.getElementById("duel-wave-pill-txt");
      if (waveTxt) waveTxt.textContent = `第 ${d.wave} 波`;
      const plHpWrap = document.getElementById("dungeon-pl-hp-wrap");
      if (plHpWrap) {
        plHpWrap.classList.toggle(
          "duel-bar-low",
          d.playerMax > 0 && d.playerHp / d.playerMax < 0.28,
        );
      }
      const stWrap = document.getElementById("dungeon-stamina-wrap");
      if (stWrap) {
        stWrap.classList.toggle("duel-stamina-low", d.stamina < DUNGEON_STAMINA_MAX * 0.22);
      }
      const comboPill = document.getElementById("duel-combo-pill");
      const tierEl = document.getElementById("duel-combo-tier");
      const weakPill = document.getElementById("duel-weak-pill");
      const fervPct = document.getElementById("duel-fervor-pct");
      if (comboPill) comboPill.textContent = `连击 ${d.duelComboStacks}`;
      if (tierEl) {
        tierEl.textContent = duelComboTierLabel(d.duelComboStacks);
        tierEl.classList.toggle("is-hot", d.duelComboStacks >= 7);
      }
      if (weakPill) weakPill.hidden = now >= d.duelWeakUntilMs;
      if (fervPct) fervPct.textContent = String(Math.min(100, Math.floor(d.duelFervor)));
      const atkSpd = playerDungeonAttackSpeedMult(state);
      const playerHitIntSec = Math.max(0.2, PLAYER_DUNGEON_HIT_INTERVAL_SEC / atkSpd);
      mapEl.style.setProperty("--dungeon-player-hit-interval", `${playerHitIntSec}s`);
      const pEl = playerBattleElement(state);
      const mulOutEl = document.getElementById("duel-elem-out-pill");
      const mulInEl = document.getElementById("duel-elem-in-pill");
      if (tgt && mulOutEl && mulInEl) {
        mulOutEl.textContent = `绽 ×${elementDamageMultiplier(pEl, tgt.element).toFixed(2)}`;
        mulInEl.textContent = `承 ×${elementDamageMultiplier(tgt.element, pEl).toFixed(2)}`;
      }
      const dodgeChip = document.getElementById("dungeon-duel-dodge-chip");
      if (dodgeChip) {
        if (now < d.dodgeIframesUntil) dodgeChip.textContent = "化劲中 · 无敌帧";
        else if (d.stamina < DUNGEON_DODGE_STAMINA_COST)
          dodgeChip.textContent = `体力不足（需 ${DUNGEON_DODGE_STAMINA_COST}）`;
        else if (now < d.playerMoveLockUntil) dodgeChip.textContent = "硬直中 · 稍后可闪";
        else dodgeChip.textContent = "点击战场 · 化劲闪避";
      }
      const pPl = document.getElementById("dungeon-duel-pl-gauge");
      const pEn = document.getElementById("dungeon-duel-en-gauge");
      if (tgt && pPl) {
        const pct = Math.min(100, (100 * d.playerAttackAccum) / playerHitIntSec);
        pPl.style.width = `${pct}%`;
      }
      if (tgt && pEn) {
        const phase = ((d.monsterAttackAccum % hi) + hi) % hi;
        pEn.style.width = `${Math.min(100, (100 * phase) / hi)}%`;
      }
      const plTrack = document.getElementById("dungeon-duel-pl-gauge-track");
      const enTrack = document.getElementById("dungeon-duel-en-gauge-track");
      if (plTrack && tgt && playerHitIntSec > 0) {
        plTrack.classList.toggle(
          "duel-gauge-primed",
          (d.playerAttackAccum / playerHitIntSec) >= 0.82,
        );
      } else if (plTrack) {
        plTrack.classList.remove("duel-gauge-primed");
      }
      if (enTrack && tgt && hi > 0) {
        const ph = ((d.monsterAttackAccum % hi) + hi) % hi;
        enTrack.classList.toggle("duel-gauge-windup", ph / hi > 0.5);
      } else if (enTrack) {
        enTrack.classList.remove("duel-gauge-windup");
      }
    }
    const mobPct = d.monsterMax > 0 ? Math.min(100, (100 * Math.max(0, d.monsterHp)) / d.monsterMax) : 0;
    const hpPct = d.playerMax > 0 ? Math.min(100, (100 * Math.max(0, d.playerHp)) / d.playerMax) : 0;
    const fmtN = (n: number) => (n >= 1e4 ? (n / 1e4).toFixed(1) + "万" : n.toFixed(0));
    const interWaveWait = d.mobs.length === 0 && d.interWaveCooldownUntil > now;
    const metaEl = document.getElementById("dungeon-active-meta");
    const metaBriefEl = document.getElementById("dungeon-active-meta-brief");
    if (metaEl && !interWaveWait) {
      metaEl.textContent = formatDungeonActiveMeta(state, now);
    }
    if (metaBriefEl && !interWaveWait) {
      metaBriefEl.textContent = formatDungeonActiveMetaBrief(state, now);
    }
    const plTxt = document.getElementById("dungeon-pl-txt");
    if (plTxt) plTxt.textContent = `${fmtN(Math.max(0, d.playerHp))} / ${fmtN(d.playerMax)}`;
    const stBar = document.getElementById("dungeon-stamina-bar");
    const stTxt = document.getElementById("dungeon-stamina-txt");
    if (stBar && DUNGEON_STAMINA_MAX > 0) {
      stBar.style.width = `${Math.min(100, (100 * Math.max(0, d.stamina)) / DUNGEON_STAMINA_MAX)}%`;
    }
    if (stTxt) stTxt.textContent = `${Math.floor(d.stamina)} / ${DUNGEON_STAMINA_MAX}`;
    const pb = document.getElementById("dungeon-pl-bar");
    const bb = document.getElementById("dungeon-boss-bar");
    const btxt = document.getElementById("dungeon-boss-hp-txt");
    if (pb) pb.style.width = `${hpPct}%`;
    if (bb) bb.style.width = `${mobPct}%`;
    if (btxt) btxt.textContent = `${fmtN(Math.max(0, d.monsterHp))} / ${fmtN(d.monsterMax)}`;
    const bname = document.getElementById("dungeon-boss-name");
    const bm = currentBossMob(d) ?? d.mobs.find((m) => m.hp > 0) ?? d.mobs[0];
    if (bname && bm) bname.textContent = bossDisplayTitle(bm);
  }
  if (getUiUnlocks(state).tabDungeon && !state.dungeon.active) {
    const d = state.dungeon;
    const now = nowMs();
    const cd = Math.max(0, d.deathCooldownUntil - now);
    const cdPct = cd > 0 ? Math.min(100, 100 - (100 * cd) / DUNGEON_DEATH_CD_MS) : 100;
    const canEnter = canEnterDungeon(state, now);
    const secEl = document.getElementById("dungeon-cd-sec");
    const barEl = document.getElementById("dungeon-cd-bar-fill") as HTMLElement | null;
    const cdBlock = document.getElementById("dungeon-cd-block") as HTMLElement | null;
    const readyHint = document.getElementById("dungeon-idle-ready-hint") as HTMLElement | null;
    const btnEnter = document.getElementById("btn-dungeon-enter") as HTMLButtonElement | null;
    if (secEl) secEl.textContent = `${Math.ceil(cd / 1000)} 秒`;
    if (barEl) barEl.style.width = `${cdPct}%`;
    if (cdBlock) cdBlock.hidden = cd <= 0;
    if (readyHint) readyHint.hidden = cd > 0;
    const btnEnterLbl = document.getElementById("btn-dungeon-enter-label");
    if (btnEnter) {
      btnEnter.disabled = !canEnter;
      const t = canEnter ? "进入副本" : cd > 0 ? "冷却中" : "无法进入";
      if (btnEnterLbl) btnEnterLbl.textContent = t;
      else btnEnter.textContent = t;
    }
  }
  if (getUiUnlocks(state).tabDungeon && state.dungeonSanctuaryMode && !state.dungeon.active) {
    const pmax = playerMaxHp(state);
    const chp = state.combatHpCurrent;
    const pct = pmax > 0 ? Math.min(100, (100 * Math.max(0, chp)) / pmax) : 0;
    const t = document.getElementById("dungeon-global-hp-txt");
    const b = document.getElementById("dungeon-global-hp-bar");
    if (t) t.textContent = `${fmtNumZh(Math.max(0, chp))} / ${fmtNumZh(pmax)}`;
    if (b) (b as HTMLElement).style.width = `${pct}%`;
  }
  if (activeHub === "gacha") {
    const bar = document.getElementById("resonance-bar-fill");
    const ring = document.getElementById("resonance-ring");
    const ringVal = document.getElementById("resonance-ring-val");
    const ro = document.getElementById("resonance-readout-live");
    const resFrac = ((state.wishResonance % 100) + 100) % 100;
    if (bar) bar.style.width = `${resFrac}%`;
    if (ring) ring.style.setProperty("--p", String(resFrac));
    if (ringVal) ringVal.textContent = String(Math.round(resFrac));
    if (ro) {
      ro.textContent = `共鸣度 ${resFrac.toFixed(1)} / 100 · 持续累积`;
    }
    const pityRem = urPityRemaining(state);
    const pityPct = Math.min(100, Math.max(0, ((UR_PITY_MAX - pityRem) / UR_PITY_MAX) * 100));
    const pityFill = document.getElementById("pity-fill-cards");
    const pityTxt = document.getElementById("pity-remain-txt");
    if (pityFill) pityFill.style.width = `${pityPct}%`;
    if (pityTxt) pityTxt.textContent = String(pityRem);
    const gearRem = gearSrPityRemaining(state);
    const gearCap = effectiveGearSrPityMax(state);
    const gearPct = Math.min(100, Math.max(0, ((gearCap - gearRem) / gearCap) * 100));
    const pityFillGear = document.getElementById("pity-fill-gear");
    const pityTxtGear = document.getElementById("pity-remain-gear-txt");
    const tierHint = document.getElementById("gear-forge-tier-hint");
    if (pityFillGear) pityFillGear.style.width = `${gearPct}%`;
    if (pityTxtGear) pityTxtGear.textContent = String(gearRem);
    if (tierHint) tierHint.textContent = describeGearForgeTierLine(state);
  }
  if (getUiUnlocks(state).tabDungeon && activeHub === "battle") {
    const d = state.dungeon;
    const pmax = playerMaxHp(state);
    const chp = state.combatHpCurrent;
    const footChp = document.getElementById("dungeon-foot-chp");
    const footPmax = document.getElementById("dungeon-foot-pmax");
    const footEdps = document.getElementById("dungeon-foot-edps");
    if (footChp) footChp.textContent = fmtNumZh(Math.max(0, chp));
    if (footPmax) footPmax.textContent = fmtNumZh(pmax);
    if (footEdps) footEdps.textContent = fmtNumZh(playerExpectedDpsDungeonAffix(state, now));
    const idleEdps = document.getElementById("dungeon-idle-readiness-edps");
    const idleChp = document.getElementById("dungeon-idle-readiness-chp");
    const idlePmax = document.getElementById("dungeon-idle-readiness-pmax");
    if (idleEdps && footEdps) idleEdps.textContent = footEdps.textContent;
    if (idleChp && footChp) idleChp.textContent = footChp.textContent;
    if (idlePmax && footPmax) idlePmax.textContent = footPmax.textContent;
    const elElapsed = document.getElementById("dungeon-session-elapsed");
    const elEta = document.getElementById("dungeon-eta-remaining");
    if (d.active && d.sessionEnterAtMs > 0) {
      const elapsedSec = (now - d.sessionEnterAtMs) / 1000;
      if (elElapsed) elElapsed.textContent = fmtDungeonDur(elapsedSec);
      const poolHp = totalAliveMobHpSum(d);
      const edps = playerExpectedDpsDungeonAffix(state, now);
      if (elEta) {
        if (poolHp <= 0) elEta.textContent = "—";
        else if (edps <= 1e-9) elEta.textContent = "∞";
        else elEta.textContent = fmtDungeonDur(poolHp / edps);
      }
    } else {
      if (elElapsed) elElapsed.textContent = "—";
      if (elEta) elEta.textContent = "—";
    }
  }
  updateTopResourcePillsAndVigor(pool);
  const pr = document.getElementById("ps-realm");
  const pa = document.getElementById("ps-atk");
  const ph = document.getElementById("ps-hp");
  const pc = document.getElementById("ps-crit");
  const pe = document.getElementById("ps-ess");
  if (pr) pr.textContent = String(state.realmLevel);
  if (pa) pa.textContent = fmtNumZh(playerAttack(state));
  const pd = document.getElementById("ps-dps");
  if (pd) pd.textContent = fmtNumZh(playerExpectedDps(state));
  if (ph) ph.textContent = String(playerMaxHp(state));
  if (pc) pc.textContent = `${(playerCritChance(state) * 100).toFixed(1)}%`;
  const pm = document.getElementById("ps-cm");
  if (pm) pm.textContent = `${playerCritMult(state).toFixed(2)}×`;
  const prs = document.getElementById("ps-res");
  if (prs) prs.textContent = `${playerResAllSum(state).toFixed(1)}%`;
  if (pe) pe.textContent = `${((essenceFindMult(state) - 1) * 100).toFixed(1)}%`;
  const pDodgeEl = document.getElementById("ps-dodge");
  if (pDodgeEl) pDodgeEl.textContent = `${(playerDungeonDodgeChance(state) * 100).toFixed(2)}%`;
  const pRangeEl = document.getElementById("ps-prange");
  if (pRangeEl) {
    const rn = playerEngageRadiusNorm(state);
    const rm = playerDungeonAttackRangeMult(state);
    pRangeEl.innerHTML = `${rn.toFixed(4)} <span class="cs-sub">（基准 ×${rm.toFixed(3)}）</span>`;
  }
  const pSpdEl = document.getElementById("ps-atkspd");
  if (pSpdEl) pSpdEl.textContent = `×${playerDungeonSustainedDamageMult(state).toFixed(3)}`;
  const pDefEl = document.getElementById("ps-def");
  if (pDefEl) pDefEl.textContent = playerDefenseRating(state).toFixed(1);
  const pInc = document.getElementById("ps-incmul");
  const pIncW = document.getElementById("ps-incmul-wave");
  if (pInc && pIncW) {
    const rw = state.dungeon.active ? state.dungeon.wave : Math.max(1, state.dungeon.maxWaveRecord);
    pInc.textContent = `×${playerIncomingDamageMult(state, rw).toFixed(3)}`;
    pIncW.textContent = `（第 ${rw} 波）`;
  }
  const prLive = petBonusRowsInnerHtml(state);
  const pps = document.getElementById("ps-pet-stone");
  const ppd = document.getElementById("ps-pet-dng");
  const ppdf = document.getElementById("ps-pet-def");
  const ppe = document.getElementById("ps-pet-ess-part");
  if (petSystemUnlocked(state)) {
    if (pps) pps.innerHTML = prLive.stone;
    if (ppd) ppd.innerHTML = prLive.dng;
    if (ppdf) ppdf.innerHTML = prLive.def;
    if (ppe) ppe.innerHTML = prLive.ess;
  }
  const ipl = document.getElementById("income-pet-line");
  if (ipl) ipl.innerHTML = incomePetLineHtml(state);

  const ptime = document.getElementById("ps-playtime");
  if (ptime) ptime.textContent = fmtPlaytimeSec(state.playtimeSec);
  const pld = document.getElementById("ps-life-day");
  if (pld) {
    const lifeDay = Math.max(1, state.inGameDay - state.lifeStartInGameDay + 1);
    pld.textContent = `第 ${lifeDay} 日`;
  }
  const psStRealm = document.getElementById("ps-stat-realm");
  if (psStRealm) psStRealm.textContent = String(state.realmLevel);
  const psStSkills = document.getElementById("ps-stat-skills");
  if (psStSkills) {
    psStSkills.textContent = `战 ${state.skills.combat.level} · 采 ${state.skills.gathering.level} · 篆 ${state.skills.arcana.level}`;
  }
  const ptPulls = document.getElementById("ps-total-pulls");
  if (ptPulls) ptPulls.textContent = String(state.totalPulls);
  const pPullLife = document.getElementById("ps-pulls-life");
  if (pPullLife) pPullLife.textContent = String(state.pullsThisLife ?? 0);
  const pDw = document.getElementById("ps-dungeon-waves");
  if (pDw) pDw.textContent = String(state.dungeon.totalWavesCleared);
  const pMw = document.getElementById("ps-max-wave");
  if (pMw) pMw.textContent = String(state.dungeon.maxWaveRecord);
  const pReinc = document.getElementById("ps-reinc");
  if (pReinc) pReinc.textContent = String(state.reincarnations);
  const pCodex = document.getElementById("ps-codex");
  if (pCodex) {
    const uniq = state.codexUnlocked.size;
    pCodex.textContent = `${uniq} / ${pool}`;
  }
  const pAch = document.getElementById("ps-ach");
  if (pAch) pAch.textContent = `${state.achievementsDone.size} / ${ACHIEVEMENTS.length}`;
  const pStr = document.getElementById("ps-streak");
  if (pStr) pStr.textContent = String(state.dailyStreak);
  const pPeak = document.getElementById("ps-peak-stone");
  if (pPeak) pPeak.textContent = fmtDecimal(new Decimal(state.peakSpiritStonesThisLife || "0"));
  const pChp = document.getElementById("ps-combat-hp");
  if (pChp) {
    pChp.textContent = `${fmtNumZh(Math.max(0, state.combatHpCurrent))} / ${playerMaxHp(state)}`;
  }
  const pPetN = document.getElementById("ps-pet-n");
  if (pPetN && petSystemUnlocked(state)) {
    pPetN.textContent = `${ownedPetIds(state).length} 只`;
  }
  if (activeHub === "character" && characterSub === "data") {
    updateDataOverviewReadouts();
  }
}

function init(): void {
  const t = nowMs();
  mobileLiteFx = shouldUseMobileLiteFx();
  if (!mobileLiteFx) initPixiFxLayer();
  bindModernFxInteraction();
  bindMotionUiFx();
  updateModernVisualFx(t);
  const offline = catchUpOffline(state, t);
  tickDailyLoginCalendar(state, t);
  tickDailyFortune(state, t);
  if (offline.stoneGain.gt(0.01)) {
    const dur = fmtOfflineDurationSec(offline.settledSec);
    const capSec = maxOfflineSec(state);
    const capLine = offline.wasCapped ? `\n已超过离线收益上限，按 ${fmtOfflineDurationSec(capSec)} 结算` : "";
    tryToast(`离线收益已结算\n时长约 ${dur}${capLine}\n灵石 +${fmtDecimal(offline.stoneGain)}`);
    saveGame(state);
  }
  tryCompleteAchievements(state);
  for (const a of drainAchievementToastQueue()) {
    toastAchievement(a);
  }
  render();
  setupCurrencyHintInteractions();
  bindKonamiEasterEgg(() => {
    toast("秘传心法已领悟……开玩笑的，继续挂机吧。");
  });
  document.addEventListener("keydown", handleGlobalKeyboardShortcuts);
  document.addEventListener(
    "keydown",
    (e) => {
      if (e.code !== "Space" && e.key !== " ") return;
      if (showKeyboardHelpModal || showAboutModal) return;
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable)) return;
      if (t?.closest("button, a, select, label, [role='button'], [tabindex]")) return;
      if (!state.dungeon.active) return;
      const d = state.dungeon;
      if (d.mobs.length === 0 && d.interWaveCooldownUntil > nowMs()) return;
      e.preventDefault();
      tryQueueDungeonDodgeWithFeedback();
    },
    { passive: false },
  );
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState !== "visible") return;
    if (deferredDungeonToasts.length === 0) return;
    for (const m of deferredDungeonToasts) toast(m);
    deferredDungeonToasts.length = 0;
  });
  setInterval(loop, LOOP_INTERVAL_MS);
}

init();
