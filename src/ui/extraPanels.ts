import type { Element, GameState, GearInventorySortMode, GearItem, Rarity, SkillId } from "../types";
import {
  DUNGEON_DEATH_CD_MS,
  DUNGEON_DODGE_IFRAMES_MS,
  DUNGEON_DODGE_STAMINA_COST,
  DUNGEON_STAMINA_MAX,
  PLAYER_DUNGEON_HIT_INTERVAL_SEC,
} from "../types";
import {
  canEnterDungeon,
  describeWaveProfile,
  dungeonBossPrepSnapshot,
  dungeonCombatPhase,
  dungeonFrontierWave,
  essenceRewardTotalFloat,
  packSizeForWave,
  currentBossMob,
} from "../systems/dungeon";
import {
  playerAttack,
  playerDungeonAttackSpeedMult,
  playerMaxHp,
} from "../systems/playerCombat";
import { getDungeonAffixForWeekKey, playerExpectedDpsDungeonAffix } from "../systems/dungeonAffix";
import { elementDamageMultiplier } from "../systems/elementCombat";
import { playerBattleElement } from "../systems/playerElement";
import { currentWeekKey } from "../systems/weeklyBounty";
import {
  SKILL_HINT,
  SKILL_LABEL,
  secondsToNextLevel,
  skillXpPerSecond,
  xpToNextLevel,
} from "../systems/skillTraining";
import { rarityRank } from "../data/rarityRank";
import { ALL_GEAR_SLOTS, getGearBase, GEAR_SLOT_LABEL } from "../data/gearBases";
import { gearItemPower, xuanTieEnhanceCost } from "../systems/gearCraft";
import { BATTLE_SKILLS } from "../data/battleSkills";
import { battleSkillPullCost, describeBattleSkillLevels } from "../systems/battleSkills";
import { isSlotTopPowerGear } from "../systems/salvage";
import { rarityZh } from "./rarityZh";
import { gearTierClass, gearTierLabel, gearVisualTier } from "./gearVisualTier";
import {
  gearPortraitSrc,
  PET_PORTRAIT,
  UI_ESSENCE,
  UI_EMPTY_GEAR,
  UI_EMPTY_PET,
  UI_EMPTY_UNLOCK,
  UI_HEAD_DUNGEON,
  UI_DUNGEON_DUEL_DECO,
  UI_DUNGEON_HIT_FLASH_DECO,
  UI_DUNGEON_CRIT_ECHO_DECO,
  UI_DUNGEON_COMBO_CHAIN_DECO,
  UI_DUNGEON_PHASE_TRASH_BADGE_DECO,
  UI_DUNGEON_PHASE_BOSS_PREP_BADGE_DECO,
  UI_DUNGEON_WEAKNESS_PING_DECO,
  UI_DUEL_GAUGE_SWORD,
  UI_DUEL_GAUGE_THREAT,
  UI_DUNGEON_IDLE_MIST,
  UI_DUEL_WAVE_BADGE,
  UI_DUEL_FRAME_CORNER,
  UI_DUNGEON_FOOT_TIMER_DECO,
  UI_DUNGEON_PANEL_LIVE_STRIP,
  UI_DUNGEON_ENTER_DECO,
  UI_DUNGEON_READINESS_DECO,
  UI_DUEL_BOSS_BADGE,
  UI_DUNGEON_AFFIX_DECO,
  UI_DUNGEON_AFFIX_CLASSIC_DECO,
  UI_DUNGEON_AFFIX_VORTEX_DECO,
  UI_DUNGEON_COUNTER_WINDOW_BADGE_DECO,
  UI_DUNGEON_BOSS_READY_BADGE,
  UI_DUNGEON_BOSS_LOCKED_BADGE,
  UI_DUNGEON_BOSS_PROGRESS_RING,
  UI_DUNGEON_REALM_CLASSIC_FRAME_DECO,
  UI_DUNGEON_REALM_VORTEX_FRAME_DECO,
  UI_DUNGEON_AUTO_BADGE_ON,
  UI_DUNGEON_AUTO_BADGE_OFF,
  UI_ASYNC_LOADING_CHIP_ICON,
  UI_ASYNC_HINT_DECO,
  UI_AUTO_RECYCLE_TIMER_ICON,
  UI_FEEDBACK_PANEL_ICON,
  UI_WEEKLY_SYNC_BADGE,
  UI_WEEKLY_SYNC_HINT,
  ELEMENT_ICON,
  UI_GEAR_LOCK_DECO,
  UI_GEAR_UPGRADE_UP,
  UI_GEAR_UPGRADE_DOWN,
  gearTierBadgeSrc,
  UI_HEAD_GEAR,
  UI_HEAD_PET,
  UI_PET_AUTO_FEED,
  UI_PET_FEED_ACTION,
  UI_HEAD_TRAIN,
  UI_HEAD_COMBAT,
} from "./visualAssets";
import { formatMobDisplayName } from "../data/dungeonMobs";
import { PET_DEFS } from "../data/pets";
import {
  describePetBonusesSummary,
  MAX_PET_LEVEL,
  petBonusPreviewLine,
  petFeedCost,
  petSystemUnlocked,
  PET_SYSTEM_UNLOCK_WAVES,
  PET_PULL_COST,
  xpToNextPetLevel,
  petDungeonAtkAdditive,
} from "../systems/pets";

const EL_ZH: Record<Element, string> = {
  metal: "金",
  wood: "木",
  water: "水",
  fire: "火",
  earth: "土",
};

function fmtNum(n: number): string {
  if (n >= 1e4) return (n / 1e4).toFixed(1) + "万";
  return n.toFixed(0);
}

function fmtEta(sec: number | null): string {
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

/** 幻域战斗中：波次、锁定、掉落说明等合并为一段文字（由 loop 刷新） */
export function formatDungeonActiveMeta(state: GameState, now: number): string {
  const d = state.dungeon;
  const fmtN = (n: number) => (n >= 1e4 ? (n / 1e4).toFixed(1) + "万" : n.toFixed(0));
  const fmtSessEss = (n: number) => (n >= 200 ? n.toFixed(1) : n.toFixed(2));
  const waveEssF = essenceRewardTotalFloat(
    d.wave,
    state,
    dungeonCombatPhase(state) === "boss_fight",
    d.rewardModeRepeat,
  );
  const nPk = packSizeForWave(d.wave + 1);
  const tgt = d.mobs.find((m) => m.hp > 0);
  const lockLine = tgt
    ? `敌阵灵压 ${fmtN(Math.max(0, tgt.hp))} / ${fmtN(tgt.maxHp)}${tgt.isBoss ? " · 首领" : ""}`
    : "—";
  const pEl = playerBattleElement(state);
  const elemLine = tgt
    ? `五行 ${EL_ZH[pEl]}→${EL_ZH[tgt.element]} · 绽×${elementDamageMultiplier(pEl, tgt.element).toFixed(2)} · 承×${elementDamageMultiplier(tgt.element, pEl).toFixed(2)}`
    : "五行 —";
  const lines = [
    `本次击溃 ${d.sessionKills} · 本次髓累计 +${fmtSessEss(d.sessionEssence)}（小兵即时入袋，关末记入此累计） · 通关 ${d.totalWavesCleared} 波`,
    elemLine,
    `第 ${d.wave} 波 · ${lockLine} · 本关清完约 ${waveEssF.toFixed(2)} 髓 · 下波灵压档参考 ${nPk}`,
  ];
  const iframesLeft = now < d.dodgeIframesUntil ? Math.ceil((d.dodgeIframesUntil - now) / 1000) : 0;
  lines.push(
    `点击战场闪避 · 耗体 ${DUNGEON_DODGE_STAMINA_COST} · 化劲 ${(DUNGEON_DODGE_IFRAMES_MS / 1000).toFixed(1)} 秒${iframesLeft > 0 ? ` · 余 ${iframesLeft} 秒` : ""}`,
  );
  return lines.join("\n");
}

/** 手机端战报：少行、字号可读，与 formatDungeonActiveMeta 数据一致 */
export function formatDungeonActiveMetaBrief(state: GameState, now: number): string {
  const d = state.dungeon;
  const fmtN = (n: number) => (n >= 1e4 ? (n / 1e4).toFixed(1) + "万" : n.toFixed(0));
  const fmtSessEss = (n: number) => (n >= 200 ? n.toFixed(1) : n.toFixed(2));
  const waveEssF = essenceRewardTotalFloat(
    d.wave,
    state,
    dungeonCombatPhase(state) === "boss_fight",
    d.rewardModeRepeat,
  );
  const tgt = d.mobs.find((m) => m.hp > 0);
  const iframesLeft = now < d.dodgeIframesUntil ? Math.ceil((d.dodgeIframesUntil - now) / 1000) : 0;
  const dodgeTip = `点屏闪避 · 耗体${DUNGEON_DODGE_STAMINA_COST} · 化劲${(DUNGEON_DODGE_IFRAMES_MS / 1000).toFixed(1)}秒${iframesLeft > 0 ? ` · 余${iframesLeft}秒` : ""}`;
  const line1 = `第${d.wave}波 · 击溃${d.sessionKills} · 髓+${fmtSessEss(d.sessionEssence)} · 累计${d.totalWavesCleared}波`;
  const line2 = tgt
    ? `灵压 ${fmtN(Math.max(0, tgt.hp))}/${fmtN(tgt.maxHp)}${tgt.isBoss ? " · 首领" : ""} · 本关髓≈${waveEssF.toFixed(1)}`
    : "";
  return [line1, line2, dodgeTip].filter((s) => s.length > 0).join("\n");
}

/** 「?」弹层中的战斗速览：比主战报更短，便于快速扫读。 */
export function formatDungeonActiveHelpMeta(state: GameState, now: number): string {
  const d = state.dungeon;
  const fmtN = (n: number) => (n >= 1e4 ? (n / 1e4).toFixed(1) + "万" : n.toFixed(0));
  const waveEssF = essenceRewardTotalFloat(
    d.wave,
    state,
    dungeonCombatPhase(state) === "boss_fight",
    d.rewardModeRepeat,
  );
  const nPk = packSizeForWave(d.wave + 1);
  const tgt = d.mobs.find((m) => m.hp > 0);
  const pEl = playerBattleElement(state);
  const elemLine = tgt
    ? `五行 ${EL_ZH[pEl]}→${EL_ZH[tgt.element]} · 绽×${elementDamageMultiplier(pEl, tgt.element).toFixed(2)} · 承×${elementDamageMultiplier(tgt.element, pEl).toFixed(2)}`
    : "五行 —";
  const lockLine = tgt
    ? `敌阵灵压 ${fmtN(Math.max(0, tgt.hp))}/${fmtN(tgt.maxHp)}${tgt.isBoss ? " · 首领" : ""}`
    : "敌阵灵压 —";
  const iframesLeft = now < d.dodgeIframesUntil ? Math.ceil((d.dodgeIframesUntil - now) / 1000) : 0;
  const dodgeLine = `闪避：耗体 ${DUNGEON_DODGE_STAMINA_COST} · 化劲 ${(DUNGEON_DODGE_IFRAMES_MS / 1000).toFixed(1)} 秒${iframesLeft > 0 ? ` · 余 ${iframesLeft} 秒` : ""}`;
  return [
    `第 ${d.wave} 波 · 击溃 ${d.sessionKills} · 累计通关 ${d.totalWavesCleared} 波`,
    lockLine,
    `${elemLine} · 本关约 ${waveEssF.toFixed(2)} 髓 · 下波档 ${nPk}`,
    dodgeLine,
  ].join("\n");
}

export function formatDungeonInterMeta(): string {
  return "本关结算完成。休整后进入下一关。剑气/凶煞双轴读条，出手与受击会有短暂硬直。";
}

function renderDungeonMapHtml(state: GameState): string {
  const d = state.dungeon;
  if (!d.active) return "";
  const combatPhase = dungeonCombatPhase(state);
  const phaseClass =
    combatPhase === "boss_fight"
      ? "dungeon-duel-stage--phase-boss-fight"
      : combatPhase === "boss_prep"
        ? "dungeon-duel-stage--phase-boss-prep"
        : "dungeon-duel-stage--phase-trash";
  const tagFull =
    combatPhase === "boss_fight"
      ? "首领对决 · 可对你造成真实伤害 · 击败后进入下一关"
      : combatPhase === "boss_prep"
        ? "首领前哨 · 清完小怪后须点「挑战首领」才会进入首领战"
        : "阵线清剿 · 自动接战 · 每击杀一只小兵即时结算筑灵髓";
  const tagCompact =
    combatPhase === "boss_fight"
      ? "首领战 · 击败后进下一关"
      : combatPhase === "boss_prep"
        ? "清小怪 → 挑战首领"
        : "清剿 · 击杀即时入髓";
  const bossMob = currentBossMob(d);
  const frontMob = d.mobs.find((m) => m.hp > 0) ?? d.mobs[0];
  const mobPct = d.monsterMax > 0 ? Math.min(100, (100 * Math.max(0, d.monsterHp)) / d.monsterMax) : 0;
  const title =
    bossMob || frontMob
      ? formatMobDisplayName(
          (bossMob ?? frontMob)!.element,
          (bossMob ?? frontMob)!.mobKind,
          !!(bossMob ?? frontMob)!.isBoss,
          (bossMob ?? frontMob)!.bossEpithet,
          undefined,
        )
      : "敌阵";
  const hpPct = d.playerMax > 0 ? Math.min(100, (100 * Math.max(0, d.playerHp)) / d.playerMax) : 0;
  const staPct = DUNGEON_STAMINA_MAX > 0 ? Math.min(100, (100 * Math.max(0, d.stamina)) / DUNGEON_STAMINA_MAX) : 0;
  const hitIntSec = Math.max(0.2, PLAYER_DUNGEON_HIT_INTERVAL_SEC / playerDungeonAttackSpeedMult(state));
  const pEl = playerBattleElement(state);
  const em = frontMob ? frontMob.element : ("metal" as Element);
  const mulOut = elementDamageMultiplier(pEl, em);
  const mulIn = elementDamageMultiplier(em, pEl);
  const liveMob = d.mobs.find((m) => m.hp > 0);
  const isBossFight = !!(liveMob?.isBoss);
  const floatOverlay = `<div class="dungeon-map-hud-overlay" aria-hidden="true">
      <div id="dungeon-float-layer" class="dungeon-float-layer"></div>
    </div>`;
  return `
    <div class="dungeon-map-frame">
      <div class="dungeon-map-wrap">
        <div class="dungeon-map dungeon-duel-stage is-aoe in-combat ${phaseClass}" id="dungeon-map" aria-label="幻域阵线对决" style="--dungeon-player-hit-interval:${hitIntSec}s">
          <div class="dungeon-duel-frame-corners" aria-hidden="true">
            <img class="duel-corner duel-corner--tl" src="${UI_DUEL_FRAME_CORNER}" alt="" width="32" height="32" loading="lazy" />
            <img class="duel-corner duel-corner--tr" src="${UI_DUEL_FRAME_CORNER}" alt="" width="32" height="32" loading="lazy" />
            <img class="duel-corner duel-corner--bl" src="${UI_DUEL_FRAME_CORNER}" alt="" width="32" height="32" loading="lazy" />
            <img class="duel-corner duel-corner--br" src="${UI_DUEL_FRAME_CORNER}" alt="" width="32" height="32" loading="lazy" />
          </div>
          <div class="dungeon-duel-top-hud" aria-hidden="true">
            <div class="dungeon-duel-wave-pill" id="duel-wave-pill-wrap">
              <img class="dungeon-duel-wave-ico" src="${UI_DUEL_WAVE_BADGE}" alt="" width="18" height="18" loading="lazy" />
              <span id="duel-wave-pill-txt">第 ${d.wave} 波</span>
            </div>
          </div>
          <div class="dungeon-duel-vs-bar" aria-hidden="true">
            <div class="dungeon-duel-side dungeon-duel-side--player">
              <span class="dungeon-duel-side-tag">我方</span>
              <div class="dungeon-hud-mini-row"><span>生命</span><span id="dungeon-pl-txt">${fmtNum(Math.max(0, d.playerHp))} / ${fmtNum(d.playerMax)}</span></div>
              <div class="progress-track dungeon slim hud-mini" id="dungeon-pl-hp-wrap"><div class="progress-fill player" id="dungeon-pl-bar" style="width:${hpPct}%"></div></div>
              <div class="dungeon-hud-mini-row"><span>体力</span><span id="dungeon-stamina-txt">${Math.floor(d.stamina)} / ${DUNGEON_STAMINA_MAX}</span></div>
              <div class="progress-track dungeon slim stamina-track hud-mini" id="dungeon-stamina-wrap"><div class="progress-fill stamina" id="dungeon-stamina-bar" style="width:${staPct}%"></div></div>
            </div>
            <div class="dungeon-duel-vs-mid">
              <div class="dungeon-duel-elem-icons">
                <img class="dungeon-duel-elem-ico" src="${ELEMENT_ICON[pEl]}" alt="" width="22" height="22" loading="lazy" />
                <span class="dungeon-duel-vs-core">VS</span>
                <img class="dungeon-duel-elem-ico" src="${ELEMENT_ICON[em]}" alt="" width="22" height="22" loading="lazy" />
              </div>
              <div class="dungeon-duel-elem-pills">
                <span class="duel-elem-pill duel-elem-pill--out" id="duel-elem-out-pill" title="对敌伤害五行倍率">绽 ×${mulOut.toFixed(2)}</span>
                <span class="duel-elem-pill duel-elem-pill--in" id="duel-elem-in-pill" title="敌对你造成伤害倍率">承 ×${mulIn.toFixed(2)}</span>
              </div>
            </div>
            <div class="dungeon-duel-side dungeon-duel-side--enemy">
              <span class="dungeon-duel-side-tag">敌方</span>
              <div class="dungeon-boss-strip dungeon-boss-strip--duel" id="dungeon-boss-hud">
                <div class="dungeon-boss-strip-title-wrap${isBossFight ? " dungeon-boss-strip-title-wrap--boss" : ""}" id="dungeon-boss-name-wrap">
                  ${isBossFight ? `<img class="dungeon-boss-crown-ico" src="${UI_DUEL_BOSS_BADGE}" alt="" width="18" height="18" loading="lazy" />` : ""}
                  <div class="dungeon-boss-strip-title" id="dungeon-boss-name">${title}</div>
                </div>
                <div class="dungeon-boss-strip-bar-wrap">
                  <div class="dungeon-boss-strip-bar-bg" aria-hidden="true"></div>
                  <div class="dungeon-boss-strip-bar-fill" id="dungeon-boss-bar" style="width:${mobPct}%"></div>
                </div>
                <div class="dungeon-boss-strip-readout" id="dungeon-boss-hp-txt">${fmtNum(Math.max(0, d.monsterHp))} / ${fmtNum(d.monsterMax)}</div>
              </div>
            </div>
          </div>
          <div class="dungeon-duel-fx-core" aria-hidden="true">
            <div class="dungeon-player-fx">
              <div class="dungeon-engage-ring dungeon-duel-engage-ring"></div>
              <div class="fx-aoe-ring"></div>
            </div>
            <img class="dungeon-duel-fx-deco dungeon-duel-fx-hit-deco" id="dungeon-duel-fx-hit-deco" src="${UI_DUNGEON_HIT_FLASH_DECO}" alt="" width="160" height="160" loading="lazy" />
            <img class="dungeon-duel-fx-deco dungeon-duel-fx-crit-deco" id="dungeon-duel-fx-crit-deco" src="${UI_DUNGEON_CRIT_ECHO_DECO}" alt="" width="184" height="184" loading="lazy" />
            <img class="dungeon-duel-fx-deco dungeon-duel-fx-guard-deco" src="${UI_DUNGEON_WEAKNESS_PING_DECO}" alt="" width="168" height="168" loading="lazy" />
          </div>
          ${floatOverlay}
          <div class="dungeon-duel-center">
            <img class="dungeon-duel-deco" src="${UI_DUNGEON_DUEL_DECO}" alt="" width="100" height="100" loading="lazy" />
          </div>
          <div class="dungeon-duel-momentum" id="dungeon-duel-momentum" aria-live="polite">
            <img class="dungeon-duel-counter-window-badge" id="dungeon-duel-counter-window-badge" src="${UI_DUNGEON_COUNTER_WINDOW_BADGE_DECO}" alt="" width="96" height="22" loading="lazy" />
            <img class="dungeon-duel-combo-chain-deco" id="dungeon-duel-combo-chain-deco" src="${UI_DUNGEON_COMBO_CHAIN_DECO}" alt="" width="120" height="24" loading="lazy" />
            <span class="duel-mom-pill duel-mom-pill--tier" id="duel-combo-tier">蓄势</span>
            <span class="duel-mom-pill" id="duel-combo-pill">连击 0</span>
            <span class="duel-mom-pill duel-weak-pill" id="duel-weak-pill" hidden title="弱点窗口优先反馈">弱点窗口</span>
            <span class="duel-mom-pill">战意 <span id="duel-fervor-pct">0</span>%</span>
          </div>
          <p class="dungeon-duel-dodge-chip hint sm" id="dungeon-duel-dodge-chip">点击战场 · 化劲闪避</p>
          <div class="dungeon-duel-gauge-row">
            <div class="dungeon-duel-gauge">
              <span class="dungeon-duel-gauge-lbl"><img class="dungeon-duel-gauge-ico" src="${UI_DUEL_GAUGE_SWORD}" alt="" width="16" height="16" loading="lazy" />剑气</span>
              <div class="progress-track dungeon duel-gauge" id="dungeon-duel-pl-gauge-track"><div class="progress-fill player" id="dungeon-duel-pl-gauge" style="width:0%"></div></div>
            </div>
            <div class="dungeon-duel-gauge">
              <span class="dungeon-duel-gauge-lbl"><img class="dungeon-duel-gauge-ico" src="${UI_DUEL_GAUGE_THREAT}" alt="" width="16" height="16" loading="lazy" />凶煞</span>
              <div class="progress-track dungeon duel-gauge" id="dungeon-duel-en-gauge-track"><div class="progress-fill enemy" id="dungeon-duel-en-gauge" style="width:0%"></div></div>
            </div>
          </div>
        </div>
        <p class="hint sm dungeon-duel-tagline-outside" role="note">
          <span class="dungeon-duel-tagline-full">${tagFull}</span>
          <span class="dungeon-duel-tagline-compact">${tagCompact}</span>
        </p>
      </div>
    </div>`;
}

export const DUNGEON_HELP_BLURB = `筑灵髓来自战斗：普通波为小怪群，每击杀一只即入袋整数唤灵髓；清完一波进下一波。每逢第 5、10…波为首领关：前哨小怪可持续清剿，达成挑战门槛后可随时点「挑战首领」；击败首领后进下一关。首领可造成伤害，小怪不会致死（灵护）。唤灵髓用于本页聚灵阵。幻域生命全局共享。阵亡无灵石损失。`;

function renderSanctuaryBlock(state: GameState, chp: number, pmax: number): string {
  const portalReady = state.dungeonSanctuaryMode && chp >= pmax - 0.25;
  const w = state.dungeonPortalTargetWave;
  const autoOn = !!state.dungeonSanctuaryAutoEnter;
  const autoBadge = autoOn ? UI_DUNGEON_AUTO_BADGE_ON : UI_DUNGEON_AUTO_BADGE_OFF;
  const portalSection = portalReady
    ? `<div class="sanctuary-portal-wrap sanctuary-portal-wrap--ready" aria-live="polite">
      <div class="sanctuary-portal-ring" aria-hidden="true"></div>
      <p class="sanctuary-portal-msg">生命已回满，将<strong>自动</strong>进入段首第 <strong>${w}</strong> 关继续清小怪</p>
    </div>`
    : `<p class="sanctuary-wait-txt">恢复中，回满后将自动返回段首第 <strong>${w}</strong> 关</p>`;
  return `<div class="sanctuary-visual">
    <div class="sanctuary-visual-bg" aria-hidden="true"></div>
    <div class="sanctuary-heal-particles" aria-hidden="true"></div>
    <div class="sanctuary-player-dot" aria-hidden="true"></div>
    <div class="sanctuary-auto-row">
      <label class="sanctuary-auto-label" for="sanctuary-auto-enter">
        <input type="checkbox" id="sanctuary-auto-enter" ${autoOn ? "checked" : ""} />
        <img class="sanctuary-auto-badge-icon" src="${autoBadge}" alt="" width="14" height="14" loading="lazy" />
        <span>自动进本</span>
      </label>
      <span class="status-badge ${autoOn ? "status-badge--ready" : "status-badge--pending"}">${autoOn ? "已开启" : "已关闭"}</span>
      <p class="hint sm sanctuary-auto-hint">
        <img class="sanctuary-auto-hint-ico" src="${UI_ASYNC_HINT_DECO}" alt="" width="13" height="13" loading="lazy" />
        阵亡后从本段起始波继续；首领需点「挑战首领」再进关。
      </p>
    </div>
    ${portalSection}
  </div>`;
}

function renderIdlePreviewMap(): string {
  return `<div class="dungeon-idle-preview-map dungeon-idle-preview-map--mist" style="--dungeon-idle-mist:url('${UI_DUNGEON_IDLE_MIST}')" aria-hidden="true"><div class="dungeon-idle-preview-grid"></div></div>`;
}

function battleGearStarLine(r: Rarity): string {
  const n = r === "UR" ? 5 : r === "SSR" ? 4 : r === "SR" ? 3 : r === "R" ? 2 : 1;
  return `<span class="battle-gear-stars" aria-hidden="true">${"★".repeat(n)}<span class="battle-gear-stars-dim">${"★".repeat(5 - n)}</span></span>`;
}

/** 历练页中部：三件筑灵装备概览；默认收起，长按展开详情 */
export function renderBattleEquippedStrip(state: GameState, expanded: boolean): string {
  const displaySlots = ALL_GEAR_SLOTS;
  let cells = "";
  let collapsedIcons = "";
  for (const s of displaySlots) {
    const id = state.equippedGear[s];
    const g = id ? state.gearInventory[id] : null;
    if (g) {
      const pw = gearItemPower(g);
      collapsedIcons += `<div class="battle-gear-ico-mini rarity-${g.rarity}" title="${GEAR_SLOT_LABEL[s]}">
        <img src="${gearPortraitSrc(g.baseId, g.slot)}" alt="" width="36" height="36" loading="lazy" />
      </div>`;
      cells += `
      <div class="battle-gear-cell rarity-${g.rarity}">
        <div class="battle-gear-cell-top">${battleGearStarLine(g.rarity)}</div>
        <div class="battle-gear-icon-wrap">
          <img src="${gearPortraitSrc(g.baseId, g.slot)}" alt="" width="48" height="48" loading="lazy" class="battle-gear-icon" />
        </div>
        <div class="battle-gear-lv">Lv.${g.itemLevel}</div>
        <div class="battle-gear-pw">战力 ${fmtNum(pw)}</div>
        <span class="battle-gear-slot-label">${GEAR_SLOT_LABEL[s]}</span>
      </div>`;
    } else {
      collapsedIcons += `<div class="battle-gear-ico-mini battle-gear-ico-mini--empty" aria-hidden="true"><span>+</span></div>`;
      cells += `
      <div class="battle-gear-cell battle-gear-cell--empty">
        <div class="battle-gear-cell-top">&nbsp;</div>
        <div class="battle-gear-icon-wrap battle-gear-icon-wrap--empty" aria-hidden="true">
          <span class="battle-gear-empty-plus">+</span>
        </div>
        <div class="battle-gear-lv">—</div>
        <div class="battle-gear-pw">空位</div>
        <span class="battle-gear-slot-label">${GEAR_SLOT_LABEL[s]}</span>
      </div>`;
    }
  }
  const stripClass = `battle-equipped-strip battle-equipped-strip--collapsible${expanded ? " battle-equipped-strip--expanded" : ""}`;
  return `
      <div class="${stripClass}" id="battle-equipped-strip" role="region" aria-label="筑灵装备" aria-expanded="${expanded ? "true" : "false"}">
        <div class="battle-equipped-collapsed-only" ${expanded ? "hidden" : ""}>
          <div class="battle-equipped-touch-target" title="长按展开装备详情">
            <div class="battle-equipped-mini-icons">${collapsedIcons}</div>
            <p class="battle-equipped-longpress-hint">筑灵装备 · 长按展开</p>
          </div>
        </div>
        <div class="battle-equipped-expanded-only" ${expanded ? "" : "hidden"}>
          <div class="battle-equipped-strip-head">
            <span class="battle-equipped-strip-title">筑灵装备</span>
            <span class="hint sm battle-equipped-strip-hint">12 部位等权掉落，按同部位战力自动替换</span>
          </div>
          <div class="battle-gear-grid">${cells}</div>
          <div class="battle-equipped-actions">
            <button type="button" class="btn" id="btn-battle-equipped-collapse">收起</button>
            <button type="button" class="btn btn-primary" id="btn-battle-gear-open-manage">强化 / 锁定 / 分解</button>
          </div>
        </div>
      </div>`;
}

export function renderDungeonPanel(state: GameState, battleGearStripExpanded = false, now = Date.now()): string {
  const d = state.dungeon;
  const cd = Math.max(0, d.deathCooldownUntil - now);
  const canEnter = canEnterDungeon(state, now);
  const edps = playerExpectedDpsDungeonAffix(state, now);
  const weekLine = state.weeklyBounty?.weekKey || currentWeekKey(now);
  const affix = getDungeonAffixForWeekKey(weekLine);
  const weekNow = currentWeekKey(now);
  const weeklySyncOk = weekLine === weekNow;
  const isVortexAffix = affix.id === "storm_sigil" || affix.id === "iron_march";
  const affixModeDecoSrc = isVortexAffix
    ? UI_DUNGEON_AFFIX_VORTEX_DECO
    : UI_DUNGEON_AFFIX_CLASSIC_DECO;
  const pmax = playerMaxHp(state);
  const chp = state.combatHpCurrent;
  const chpPctGlobal = pmax > 0 ? Math.min(100, (100 * Math.max(0, chp)) / pmax) : 0;
  const petAtkPct =
    petSystemUnlocked(state) && petDungeonAtkAdditive(state) > 0
      ? (petDungeonAtkAdditive(state) * 100).toFixed(2)
      : null;
  const fw = dungeonFrontierWave(state);
  const nextWavePreview = describeWaveProfile(Math.max(1, d.entryWave));
  const cdPct = cd > 0 ? Math.min(100, 100 - (100 * cd) / DUNGEON_DEATH_CD_MS) : 100;
  const sanctuaryIdle = state.dungeonSanctuaryMode && !d.active;
  const showCombatBossBtn =
    d.active &&
    state.dungeonDeferBoss &&
    d.wave % 5 === 0 &&
    (d.mobs.some((m) => m.hp > 0) || d.mobs.length === 0);
  const showIdleBossBtn =
    !d.active && !sanctuaryIdle && state.dungeonDeferBoss && fw % 5 === 0 && canEnter;
  const combatPhase = d.active ? dungeonCombatPhase(state) : "trash";
  const bossPrep = dungeonBossPrepSnapshot(state);
  const bossPrepProgress = `${bossPrep.kills}/${bossPrep.req}`;
  const phaseBadgeSrc =
    combatPhase === "boss_fight"
      ? UI_DUEL_BOSS_BADGE
      : combatPhase === "boss_prep"
        ? UI_DUNGEON_PHASE_BOSS_PREP_BADGE_DECO
        : UI_DUNGEON_PHASE_TRASH_BADGE_DECO;

  const panelRunClass = d.active ? " dungeon-panel--run dungeon-panel--live-fight" : "";
  const panelRunStyle = d.active ? ` style="--dungeon-live-strip:url('${UI_DUNGEON_PANEL_LIVE_STRIP}')"` : "";
  const asyncHintText = d.active
    ? "战场反馈按需刷新中（优先战斗数值与交互）"
    : "入口与预览按需加载，先渲染核心操作";
  const recycleVisualState = d.active
    ? "战斗进行中"
    : sanctuaryIdle
      ? "回收执行中"
      : cd > 0
        ? `回收冷却 ${Math.ceil(cd / 1000)} 秒`
        : "回收待机";
  const recycleHintText = d.active
    ? "自动回收计时切换为战斗态，优先保持主战信息可读。"
    : sanctuaryIdle
      ? "处于回气所可视态，回满后将尝试自动回收进本。"
      : "当前展示入口态计时，支持移动端快速判断可进本状态。";

  return `
    <section class="panel dungeon-strip-panel${panelRunClass}"${panelRunStyle}>
      <div class="panel-title-art-row dungeon-panel-title-cluster">
        <img class="panel-title-art-icon" src="${UI_HEAD_DUNGEON}" alt="" width="28" height="28" loading="lazy" />
        <div class="dungeon-panel-title-text">
          <h2>历练·筑灵</h2>
          <p class="hint sm dungeon-panel-subtitle">上为阵线战斗 · 中为筑灵装备（默认收起，长按展开）· 下为聚灵抽卡</p>
        </div>
      </div>
      <div class="feedback-panel-head">
        <img class="feedback-panel-head-ico" src="${UI_FEEDBACK_PANEL_ICON}" alt="" width="14" height="14" loading="lazy" />
        <span>统一反馈样式</span>
      </div>
      <div class="dungeon-async-feedback" role="status" aria-live="polite">
        <span class="loading-chip ${d.active ? "is-active" : ""}">
          <img src="${UI_ASYNC_LOADING_CHIP_ICON}" alt="" width="14" height="14" loading="lazy" />
          ${d.active ? "战斗流已加载" : "轻量预加载中"}
        </span>
        <span class="loading-chip recycle-timer-chip ${d.active || sanctuaryIdle ? "is-active" : ""}">
          <img src="${UI_AUTO_RECYCLE_TIMER_ICON}" alt="" width="14" height="14" loading="lazy" />
          自动回收计时 · ${recycleVisualState}
        </span>
        <span class="async-hint">
          <img src="${UI_ASYNC_HINT_DECO}" alt="" width="14" height="14" loading="lazy" />
          ${asyncHintText} · ${recycleHintText}
        </span>
      </div>
      <div class="dungeon-affix-banner" role="region" aria-label="本周幻域词缀" id="dungeon-affix-banner">
        <img class="dungeon-affix-icon" src="${UI_DUNGEON_AFFIX_DECO}" alt="" width="40" height="40" loading="lazy" />
        <img class="dungeon-affix-mode-deco" id="dungeon-affix-mode-deco" src="${affixModeDecoSrc}" alt="" width="124" height="24" loading="lazy" />
        <div class="dungeon-affix-text">
          <strong class="dungeon-affix-title" id="dungeon-affix-title">本周词缀 · ${affix.title}</strong>
          <p class="hint sm dungeon-affix-desc" id="dungeon-affix-desc">${affix.desc}<span class="dungeon-affix-wk" id="dungeon-affix-week">（周次 ${weekLine}）</span></p>
        </div>
      </div>
      <div class="weekly-sync-hint" role="status" aria-live="polite">
        <span class="status-badge ${weeklySyncOk ? "status-badge--ready" : "status-badge--risk"}">
          <img src="${UI_WEEKLY_SYNC_BADGE}" alt="" width="14" height="14" loading="lazy" />
          周更同步 ${weeklySyncOk ? "已对齐" : "待同步"}
        </span>
        <span class="hint sm weekly-sync-hint-text">
          <img src="${UI_WEEKLY_SYNC_HINT}" alt="" width="14" height="14" loading="lazy" />
          状态周次 ${weekLine} · 当前周次 ${weekNow}${weeklySyncOk ? "，无需额外操作。" : "，建议进行一次刷新或存档重载。"}
        </span>
      </div>
      ${
        !d.active && !sanctuaryIdle
          ? `<div class="dungeon-battle-readiness" role="region" aria-label="备战摘要" id="dungeon-battle-readiness-strip">
        <img class="dungeon-readiness-ico" src="${UI_DUNGEON_READINESS_DECO}" alt="" width="36" height="36" loading="lazy" />
        <div class="dungeon-readiness-body">
          <span class="dungeon-readiness-kicker">备战</span>
          <p class="dungeon-readiness-line hint sm">
            期望秒伤 <strong id="dungeon-idle-readiness-edps">${fmtNum(edps)}</strong>/s
            · 幻域生命 <strong id="dungeon-idle-readiness-chp">${fmtNum(Math.max(0, chp))}</strong>/<strong id="dungeon-idle-readiness-pmax">${fmtNum(pmax)}</strong>
            · 目标第 <strong id="dungeon-idle-readiness-wave">${Math.max(1, d.entryWave)}</strong> 波
          </p>
        </div>
      </div>`
          : ""
      }
      <div class="dungeon-combat-module">
      <div class="dungeon-map-stage">
      ${
        d.active
          ? `<div class="dungeon-active-stack dungeon-active-stack--live">
          <div class="dungeon-phase-banner dungeon-phase-banner--${combatPhase}" role="region" aria-label="阶段说明" id="dungeon-phase-banner">
            <div class="dungeon-phase-banner-head">
              <span class="dungeon-phase-badge-wrap">
                <img class="dungeon-phase-progress-ring" src="${UI_DUNGEON_BOSS_PROGRESS_RING}" alt="" width="22" height="22" loading="lazy" ${combatPhase === "boss_prep" ? "" : "hidden"} />
                <img class="dungeon-phase-badge-ico" src="${phaseBadgeSrc}" alt="" width="18" height="18" loading="lazy" />
              </span>
              <span class="dungeon-phase-badge" id="dungeon-phase-badge">${
                combatPhase === "boss_fight" ? "首领对决" : combatPhase === "boss_prep" ? "首领前哨" : "阵线清剿"
              }</span>
              <span class="dungeon-phase-wave-hint hint sm" id="dungeon-phase-wave-hint">第 ${d.wave} 波</span>
            </div>
            <p class="dungeon-phase-banner-guide" id="dungeon-phase-guide">${
              combatPhase === "boss_fight"
                ? "首领可对你造成真实伤害。击败首领后本关胜利，并自动进入下一波。"
                : combatPhase === "boss_prep"
                  ? `首领前哨可无限清剿；累计击败小兵达到门槛后可随时挑战首领（当前 ${bossPrepProgress}）。`
                  : "普通清剿：敌人自动接战；每击杀一只小兵，唤灵髓整数立即入袋。清完本关后进入下一波。"
            }</p>
            ${
              showCombatBossBtn
                ? `<div class="dungeon-phase-banner-cta" id="dungeon-phase-cta">
              <button type="button" class="btn btn-primary btn-dungeon-challenge-boss" id="btn-dungeon-challenge-boss" ${bossPrep.canChallenge ? "" : "disabled"}>挑战首领</button>
              <button type="button" class="btn" data-toggle-auto-boss-challenge="1">${state.autoBossChallenge ? "自动挑战首领：开" : "自动挑战首领：关"}</button>
              <span class="hint sm dungeon-phase-cta-note" id="dungeon-phase-cta-note"><img class="dungeon-boss-progress-badge" src="${bossPrep.canChallenge ? UI_DUNGEON_BOSS_READY_BADGE : UI_DUNGEON_BOSS_LOCKED_BADGE}" alt="" width="16" height="16" loading="lazy" />${bossPrep.challengeHint}</span>
            </div>`
                : ""
            }
          </div>
          <div class="dungeon-viewport dungeon-live-combat" id="dungeon-live-root">
          ${renderDungeonMapHtml(state)}
          </div>
          <p class="dungeon-active-meta hint sm dungeon-active-meta--combat dungeon-active-meta--brief" id="dungeon-active-meta-brief">${formatDungeonActiveMetaBrief(state, now)}</p>
        </div>`
          : sanctuaryIdle
            ? `<div class="dungeon-idle-sanctuary dungeon-stage-fill">
          ${renderSanctuaryBlock(state, chp, pmax)}
          <div class="bar-label"><span>幻域生命</span><span id="dungeon-global-hp-txt">${fmtNum(Math.max(0, chp))} / ${fmtNum(pmax)}</span></div>
          <div class="progress-track dungeon"><div class="progress-fill player sanctuary-hp-fill" id="dungeon-global-hp-bar" style="width:${chpPctGlobal}%"></div></div>
        </div>`
            : `<div class="dungeon-idle dungeon-stage-fill">
          ${renderIdlePreviewMap()}
          <p class="dungeon-idle-stats">累计通关 <strong>${d.totalWavesCleared}</strong> 波 · 最高第 <strong>${d.maxWaveRecord}</strong> 波</p>
          <p class="hint sm">目标第 <strong>${Math.max(1, d.entryWave)}</strong> 波：${nextWavePreview}</p>
          <p class="hint sm">下一未通关波为第 <strong>${fw}</strong> 波（前沿）。首领关可持续清剿前哨小怪，达门槛后可随时挑战首领。</p>
          <ol class="dungeon-idle-guide-steps hint sm">
            <li>点「进入副本」开始；普通波自动打小怪，每只掉落即时入袋。</li>
            <li>首领波前哨可无限刷；达成挑战门槛后可点「挑战首领」，击败后自动进下一波。</li>
            <li>下方聚灵阵消耗筑灵髓抽卡；筑灵条长按可展开。</li>
          </ol>
          ${
            showIdleBossBtn
              ? `<div class="dungeon-boss-intent-row">
            <button type="button" class="btn btn-primary" id="btn-dungeon-boss-next-entry">下一关为首领 · 挑战首领</button>
            <button type="button" class="btn" data-toggle-auto-boss-challenge="1">${state.autoBossChallenge ? "自动挑战首领：开" : "自动挑战首领：关"}</button>
            <p class="hint sm">默认进关为首领位小怪群；点此后再进关将面对真正首领。</p>
          </div>`
              : ""
          }
          <div class="dungeon-entry-tools">
            <label class="dungeon-entry-label">起始波次（1～${Math.max(1, d.maxWaveRecord + 1)}）
              <input type="number" id="dungeon-entry-wave" min="1" max="${Math.max(1, d.maxWaveRecord + 1)}" step="1" value="${d.entryWave}" />
            </label>
            <button type="button" class="btn btn-primary" id="btn-dungeon-entry-frontier">下一关</button>
          </div>
          <div class="cd-block" id="dungeon-cd-block" ${cd > 0 ? "" : "hidden"}>
              <div class="bar-label"><span>再入冷却</span><span id="dungeon-cd-sec">${Math.ceil(cd / 1000)} 秒</span></div>
              <div class="progress-track cd"><div class="progress-fill cd" id="dungeon-cd-bar-fill" style="width:${cdPct}%"></div></div>
          </div>
          <p class="hint" id="dungeon-idle-ready-hint" ${cd > 0 ? "hidden" : ""}>可进入幻域</p>
          <button class="btn btn-primary btn-dungeon-enter" type="button" id="btn-dungeon-enter" ${canEnter ? "" : "disabled"}>
            <img class="btn-dungeon-enter-ico" src="${UI_DUNGEON_ENTER_DECO}" alt="" width="18" height="18" loading="lazy" />
            <span id="btn-dungeon-enter-label">${canEnter ? "进入副本" : cd > 0 ? "冷却中" : "无法进入"}</span>
          </button>
        </div>`
      }
      </div>
      <div class="dungeon-foot-bar" aria-label="幻域战力简要">
        <div class="dungeon-foot-bar-inner">
          <span class="dungeon-foot-chip dungeon-foot-chip--skill" title="战艺等级">战艺 <strong>Lv.${state.skills.combat.level}</strong></span>
          <span class="dungeon-foot-chip dungeon-foot-chip--dps" title="期望秒伤（不含五行相克）">期望 <strong id="dungeon-foot-edps">${fmtNum(edps)}</strong><span class="dungeon-foot-unit">/s</span></span>
          <span class="dungeon-foot-chip dungeon-foot-chip--hp" title="幻域生命（全局）">生命 <strong id="dungeon-foot-chp">${fmtNum(Math.max(0, chp))}</strong><span class="dungeon-foot-sep">/</span><strong id="dungeon-foot-pmax">${fmtNum(pmax)}</strong></span>
          ${
            petAtkPct !== null
              ? `<span class="dungeon-foot-chip dungeon-foot-chip--pet" title="灵宠幻域攻击加成">灵宠 <strong>+${petAtkPct}%</strong> 攻</span>`
              : ""
          }
        </div>
        <div class="dungeon-foot-timer hint sm" id="dungeon-foot-timer-row" aria-live="polite">
          <img class="dungeon-foot-timer-ico" src="${UI_DUNGEON_FOOT_TIMER_DECO}" alt="" width="15" height="15" loading="lazy" />
          <span>预计剩余 <strong id="dungeon-eta-remaining">—</strong></span>
          <span class="dungeon-foot-timer-hint">（估算值）</span>
        </div>
      </div>
      ${renderBattleEquippedStrip(state, battleGearStripExpanded)}
      </div>
    </section>`;
}

export function renderTrainPanel(state: GameState): string {
  const ids: SkillId[] = ["combat", "gathering", "arcana"];
  let rows = "";
  const activeId = state.activeSkillId;
  const activeLabel =
    activeId === "combat" || activeId === "gathering" || activeId === "arcana" ? SKILL_LABEL[activeId] : null;
  const activeRate =
    activeId === "combat" || activeId === "gathering" || activeId === "arcana"
      ? skillXpPerSecond(state.skills[activeId].level)
      : 0;
  const activeEta =
    activeId === "combat" || activeId === "gathering" || activeId === "arcana"
      ? secondsToNextLevel(state.skills[activeId])
      : null;

  for (const id of ids) {
    const sk = state.skills[id];
    const need = xpToNextLevel(sk.level);
    const on = state.activeSkillId === id;
    const pct = need > 0 ? Math.min(100, (100 * sk.xp) / need) : 0;
    const rate = skillXpPerSecond(sk.level);
    const eta = secondsToNextLevel(sk);
    rows += `
      <div class="skill-row ${on ? "active" : ""}" data-skill-row="${id}">
        <div class="skill-row-body">
          <strong>${SKILL_LABEL[id]}</strong> Lv.${sk.level}
          <p class="hint">${SKILL_HINT[id]}</p>
          <div class="skill-progress-meta">
            <span class="skill-stat"><span class="lbl">经验</span> <strong id="skill-xp-line-${id}">${fmtNum(sk.xp)} / ${fmtNum(need)}</strong></span>
            <span class="skill-stat"><span class="lbl">获得</span> <strong id="skill-rate-${id}">${rate.toFixed(1)}</strong> / 秒</span>
            <span class="skill-stat"><span class="lbl">本阶剩余</span> <strong id="skill-eta-${id}">${fmtEta(eta)}</strong></span>
          </div>
          <div class="bar-label"><span>进度</span><span id="skill-pct-label-${id}">${pct.toFixed(1)}%</span></div>
          <div class="progress-track skill"><div class="progress-fill skill" id="skill-bar-fill-${id}" style="width:${pct}%"></div></div>
        </div>
        <button class="btn ${on ? "btn-primary" : ""}" type="button" data-skill-train="${id}">
          ${on ? "修炼中" : "挂机此技能"}
        </button>
      </div>`;
  }
  return `
    <section class="panel train-panel">
      <div class="panel-title-art-row">
        <img class="panel-title-art-icon" src="${UI_HEAD_TRAIN}" alt="" width="28" height="28" loading="lazy" />
        <h2>修炼</h2>
      </div>
      <p class="hint">一次只能修炼一项技能。</p>
      <div class="train-active-banner ${activeLabel ? "" : "train-paused"}" id="train-active-banner">
        ${
          activeLabel
            ? `<span class="train-pulse"></span><span>当前修炼：<strong>${activeLabel}</strong></span>
               <span class="train-banner-meta">+<strong id="train-banner-rate">${activeRate.toFixed(1)}</strong> 经验/秒</span>
               <span class="train-banner-meta">距升级 <strong id="train-banner-eta">${fmtEta(activeEta)}</strong></span>`
            : `<span>当前未修炼：点击下方技能开始</span>`
        }
      </div>
      <div class="skill-list">${rows}</div>
      <button class="btn" type="button" id="btn-skill-none" ${state.activeSkillId === null ? "disabled" : ""}>暂停修炼</button>
    </section>`;
}

export function renderBattleSkillPanel(state: GameState): string {
  return `
    <section class="panel battle-skill-panel">
      <div class="panel-title-art-row">
        <img class="panel-title-art-icon" src="${UI_HEAD_COMBAT}" alt="" width="28" height="28" loading="lazy" />
        <h2>心法</h2>
      </div>
      <p class="hint">消耗唤灵髓随机获得或升级心法，同名最高 Lv.20。</p>
      <div class="battle-skill-catalog" aria-label="心法说明">
        ${BATTLE_SKILLS.map((def) => {
          const lv = state.battleSkills[def.id] ?? 0;
          const numParts: string[] = [];
          if (def.dungeonAtkBonusPerLevel > 0) {
            numParts.push(`幻域攻击 <strong>+${(def.dungeonAtkBonusPerLevel * 100).toFixed(2)}%</strong>/级`);
          }
          if (def.stoneIncomeBonusPerLevel > 0) {
            numParts.push(`灵石 <strong>+${(def.stoneIncomeBonusPerLevel * 100).toFixed(3)}%</strong>/级`);
          }
          if (def.dungeonEssenceBonusPerLevel > 0) {
            numParts.push(`唤灵髓投放 <strong>+${(def.dungeonEssenceBonusPerLevel * 100).toFixed(2)}%</strong>/级`);
          }
          if (def.critChancePerLevel > 0) {
            numParts.push(`暴击率 <strong>+${(def.critChancePerLevel * 100).toFixed(2)}%</strong>/级`);
          }
          if (def.critMultPerLevel > 0) {
            numParts.push(`暴伤倍率 <strong>+${(def.critMultPerLevel * 100).toFixed(2)}%</strong>/级`);
          }
          if (def.dungeonMoveSpeedPerLevel > 0) {
            numParts.push(`幻域移速 <strong>+${(def.dungeonMoveSpeedPerLevel * 100).toFixed(2)}%</strong>/级`);
          }
          const nums = numParts.length > 0 ? numParts.join(" · ") : "无数值加成";
          return `<div class="battle-skill-card">
            <div class="battle-skill-card-head">
              <strong>${def.name}</strong>
              <span class="battle-skill-lv">${lv > 0 ? `已领悟 Lv.${lv}` : "未领悟"}</span>
            </div>
            <p class="hint battle-skill-desc">${def.desc}</p>
            <p class="battle-skill-nums">${nums}</p>
          </div>`;
        }).join("")}
      </div>
      <p class="inv-meta" id="battle-skills-readout">当前：${describeBattleSkillLevels(state)}</p>
      <button class="btn btn-primary" type="button" id="btn-pull-battle-skill" ${state.summonEssence >= battleSkillPullCost() ? "" : "disabled"}>领悟心法（${battleSkillPullCost()} 唤灵髓）</button>
    </section>`;
}

const SLOT_ORDER_SORT: Record<string, number> = Object.fromEntries(ALL_GEAR_SLOTS.map((s, i) => [s, i]));

function sortGearInventoryItems(items: GearItem[], mode: GearInventorySortMode): GearItem[] {
  const rarityOrder = (g: GearItem): number => 10 - gearVisualTier(g);
  const so = SLOT_ORDER_SORT;
  return [...items].sort((a, b) => {
    if (mode === "rarity") {
      const dr = rarityOrder(a) - rarityOrder(b);
      if (dr !== 0) return dr;
      if (b.itemLevel !== a.itemLevel) return b.itemLevel - a.itemLevel;
      return a.displayName.localeCompare(b.displayName, "zh-Hans-CN");
    }
    if (mode === "ilvl") {
      if (b.itemLevel !== a.itemLevel) return b.itemLevel - a.itemLevel;
      const dr = rarityOrder(a) - rarityOrder(b);
      if (dr !== 0) return dr;
      return a.displayName.localeCompare(b.displayName, "zh-Hans-CN");
    }
    if (mode === "slot") {
      const ds = (so[a.slot] ?? 9) - (so[b.slot] ?? 9);
      if (ds !== 0) return ds;
      const dr = rarityOrder(a) - rarityOrder(b);
      if (dr !== 0) return dr;
      return b.itemLevel - a.itemLevel;
    }
    const c = a.displayName.localeCompare(b.displayName, "zh-Hans-CN");
    if (c !== 0) return c;
    return rarityOrder(a) - rarityOrder(b);
  });
}

function slotPowerDeltaText(delta: number): string {
  if (delta > 0) return `+${delta}`;
  if (delta < 0) return `${delta}`;
  return "±0";
}

const GEAR_SORT_LABELS: Record<GearInventorySortMode, string> = {
  rarity: "稀有度",
  ilvl: "装等",
  slot: "部位",
  name: "名称",
};

export function renderGearPanel(
  state: GameState,
  refineTargetId: string | null = null,
  gearDetailSlot: (typeof ALL_GEAR_SLOTS)[number] | null = null,
  gearInvSort: GearInventorySortMode = "rarity",
): string {
  void refineTargetId;
  const items = sortGearInventoryItems(Object.values(state.gearInventory), gearInvSort);
  const slotTopPower = new Map<string, number>();
  const slotSecondPower = new Map<string, number>();
  for (const it of Object.values(state.gearInventory)) {
    const slotLv = Math.max(0, Math.floor(state.gearSlotEnhance[it.slot] ?? 0));
    const pw = gearItemPower(it, slotLv);
    const top = slotTopPower.get(it.slot) ?? Number.NEGATIVE_INFINITY;
    const second = slotSecondPower.get(it.slot) ?? Number.NEGATIVE_INFINITY;
    if (pw > top) {
      slotSecondPower.set(it.slot, top);
      slotTopPower.set(it.slot, pw);
    } else if (pw > second) {
      slotSecondPower.set(it.slot, pw);
    }
  }
  let inv = "";
  for (const g of items) {
    const eq =
      Object.values(state.equippedGear).some((id) => id === g.instanceId);
    if (!eq) continue;
    const pre = g.prefixes.map((x) => `<span class="affix">${x.text}</span>`).join("");
    const suf = g.suffixes.map((x) => `<span class="affix">${x.text}</span>`).join("");
    const slotLv = Math.max(0, Math.floor(state.gearSlotEnhance[g.slot] ?? 0));
    const xt = xuanTieEnhanceCost(slotLv);
    const locked = !!g.locked;
    const pw = gearItemPower(g, slotLv);
    const top = slotTopPower.get(g.slot) ?? pw;
    const second = slotSecondPower.get(g.slot) ?? Number.NEGATIVE_INFINITY;
    const compareTarget = top > pw ? top : Number.isFinite(second) ? second : top;
    const delta = pw - compareTarget;
    const topTag = isSlotTopPowerGear(state, g.instanceId) ? " · 槽位Top1" : "";
    const visualTier = gearVisualTier(g);
    const visualTierCls = gearTierClass(visualTier);
    const visualTierLabel = gearTierLabel(visualTier);
    const visualTierBadge = gearTierBadgeSrc(visualTier);
    inv += `
      <div class="gear-row equipped ${locked ? "is-locked" : ""}">
        <div class="gear-row-visual">
          <div class="gear-icon-wrap rarity-${g.rarity} ${visualTierCls}">
            <img src="${visualTierBadge}" alt="" width="18" height="18" loading="lazy" class="gear-tier-badge" />
            <img src="${gearPortraitSrc(g.baseId, g.slot)}" alt="" width="32" height="32" loading="lazy" class="gear-slot-icon" />
          </div>
          <div>
          <strong class="rarity-${g.rarity} ${visualTierCls} gear-tier-text">${g.displayName}</strong> · ${visualTierLabel} · 筑灵阶 ${g.gearGrade} · ilvl ${g.itemLevel}
          <p class="inv-meta">战力 ${pw} · 同槽对比 ${slotPowerDeltaText(delta)}${topTag} · 槽位强化 ${slotLv}${locked ? " · <span class=\"gear-locked-tag\">已锁定</span>" : ""}</p>
          <div class="affix-block">${pre}${suf}</div>
          </div>
        </div>
        <div class="gear-actions">
          <button class="btn gear-upgrade-btn" type="button" data-gear-enhance="${g.instanceId}">
            <img src="${UI_GEAR_UPGRADE_UP}" alt="" width="14" height="14" class="gear-upgrade-ico" loading="lazy" />强化（${xt} 玄铁）
          </button>
          <button class="btn gear-lock-toggle-btn ${locked ? "is-locked" : ""}" type="button" data-gear-toggle-lock="${g.instanceId}">
            <img src="${UI_GEAR_LOCK_DECO}" alt="" width="16" height="16" class="gear-lock-ico" loading="lazy" />${locked ? "解锁" : "锁定"}
          </button>
          <button class="btn" type="button" data-gear-salvage="${g.instanceId}" ${locked ? "disabled" : ""}>分解</button>
        </div>
      </div>`;
  }
  const slotLabel = GEAR_SLOT_LABEL;
  const slots = ALL_GEAR_SLOTS;
  let slotHtml = "";
  for (const s of slots) {
    const id = state.equippedGear[s];
    const g = id ? state.gearInventory[id] : null;
    const open = gearDetailSlot === s;
    const slotLv = g ? Math.max(0, Math.floor(state.gearSlotEnhance[g.slot] ?? 0)) : 0;
    const pw = g ? gearItemPower(g, slotLv) : 0;
    const top = g ? (slotTopPower.get(s) ?? pw) : 0;
    const delta = g ? pw - top : 0;
    slotHtml += `<div class="gear-slot-line">
      <button type="button" class="gear-slot-summary ${open ? "is-open" : ""}" data-gear-open-slot="${s}">
        <span class="gear-slot-summary-label">${slotLabel[s]}</span>
        <span class="gear-slot-summary-name">${g ? `${g.displayName} · 战力 ${pw} · 同槽 ${slotPowerDeltaText(delta)}` : "（空）"}</span>
        <span class="inv-meta gear-slot-summary-hint">${open ? "收起" : "详情 · 卸下 / 强化"}</span>
      </button>
    </div>`;
  }
  let detailBlock = "";
  if (gearDetailSlot) {
    const s = gearDetailSlot;
    const id = state.equippedGear[s];
    const g = id ? state.gearInventory[id] : null;
    if (!g) {
      detailBlock = `<div class="gear-equipped-detail" id="gear-equipped-detail">
        <p class="hint">${slotLabel[s]}栏位为空。请去「历练·筑灵→境界铸灵」获取装备。</p>
        <button type="button" class="btn" id="btn-gear-detail-close">关闭</button>
      </div>`;
    } else {
      const pre = g.prefixes.map((x) => `<span class="affix">${x.text}</span>`).join("");
      const suf = g.suffixes.map((x) => `<span class="affix">${x.text}</span>`).join("");
      const slotLv = Math.max(0, Math.floor(state.gearSlotEnhance[g.slot] ?? 0));
      const xt = xuanTieEnhanceCost(slotLv);
      const visualTier = gearVisualTier(g);
      const visualTierCls = gearTierClass(visualTier);
      const visualTierLabel = gearTierLabel(visualTier);
      const visualTierBadge = gearTierBadgeSrc(visualTier);
      detailBlock = `<div class="gear-equipped-detail" id="gear-equipped-detail">
        <div class="gear-equipped-detail-head">
          <div class="gear-icon-wrap rarity-${g.rarity} ${visualTierCls}">
            <img src="${visualTierBadge}" alt="" width="20" height="20" loading="lazy" class="gear-tier-badge" />
            <img src="${gearPortraitSrc(g.baseId, g.slot)}" alt="" width="40" height="40" loading="lazy" class="gear-slot-icon" />
          </div>
          <div>
            <strong class="rarity-${g.rarity} ${visualTierCls} gear-tier-text">${g.displayName}</strong> · ${visualTierLabel} · 筑灵阶 ${g.gearGrade} · ilvl ${g.itemLevel}
            <p class="inv-meta">已装备于 ${slotLabel[s]} · 战力 ${gearItemPower(g, slotLv)} · 槽位强化 ${slotLv}${g.locked ? " · <span class=\"gear-locked-tag\">已锁定</span>" : ""}</p>
          </div>
        </div>
        <div class="affix-block">${pre}${suf}</div>
        <div class="gear-equipped-detail-actions">
          <button class="btn btn-danger gear-upgrade-btn gear-upgrade-btn-down" type="button" data-gear-unequip-detail="${s}" ${g.locked ? "disabled" : ""}>
            <img src="${UI_GEAR_UPGRADE_DOWN}" alt="" width="14" height="14" class="gear-upgrade-ico" loading="lazy" />卸下并拆解
          </button>
          <button class="btn btn-primary gear-upgrade-btn" type="button" data-gear-enhance="${g.instanceId}">
            <img src="${UI_GEAR_UPGRADE_UP}" alt="" width="14" height="14" class="gear-upgrade-ico" loading="lazy" />强化（${xt} 玄铁）
          </button>
          <button class="btn gear-lock-toggle-btn ${g.locked ? "is-locked" : ""}" type="button" data-gear-toggle-lock="${g.instanceId}">
            <img src="${UI_GEAR_LOCK_DECO}" alt="" width="16" height="16" class="gear-lock-ico" loading="lazy" />${g.locked ? "解锁" : "锁定"}
          </button>
          <button type="button" class="btn" id="btn-gear-detail-close">关闭</button>
        </div>
      </div>`;
    }
  }
  const sortBar = `
      <div class="gear-inv-sort-row" role="group" aria-label="装备排序">
        ${(["rarity", "ilvl", "slot", "name"] as GearInventorySortMode[])
          .map(
            (m) =>
              `<button type="button" class="btn gear-inv-sort-btn ${gearInvSort === m ? "is-active" : ""}" data-gear-inv-sort="${m}">${GEAR_SORT_LABELS[m]}</button>`,
          )
          .join("")}
      </div>`;
  return `
    <section class="panel" id="gear-panel-root">
      <div class="panel-title-art-row">
        <img class="panel-title-art-icon" src="${UI_HEAD_GEAR}" alt="" width="28" height="28" loading="lazy" />
        <h2>装备</h2>
      </div>
      <p class="hint">装备按<strong>12 部位</strong>生效：新装在境界铸灵与当前部位比对<strong>战力</strong>，更高才替换。强化消耗玄铁。在「历练·筑灵」页长按筑灵条展开，点「管理」在此强化、锁定或分解。</p>
      <p class="hint sm">锁定装备不可分解，也不会被自动分解（灵卡自动分解仍可在聚灵阵勾选）。</p>
      <h3 class="sub-h">已装备</h3>
      ${slotHtml}
      ${detailBlock}
      <h3 class="sub-h">部位详情</h3>
      ${sortBar}
      <div class="gear-inv">${inv || `<div class="empty-art-wrap"><img src="${UI_EMPTY_GEAR}" alt="暂无装备" class="empty-art-img" width="320" height="160" loading="lazy" /></div>`}</div>
    </section>`;
}

export function renderPetPanel(state: GameState): string {
  if (!petSystemUnlocked(state)) {
    const w = state.dungeon.totalWavesCleared;
    return `
    <section class="panel pet-panel">
      <div class="panel-title-art-row">
        <img class="panel-title-art-icon" src="${UI_HEAD_PET}" alt="" width="28" height="28" loading="lazy" />
        <h2>灵宠</h2>
      </div>
      <p class="hint">幻域累计 <strong>${PET_SYSTEM_UNLOCK_WAVES}</strong> 波开放唤灵池；灵宠全局生效。当前 <strong>${w}</strong> / ${PET_SYSTEM_UNLOCK_WAVES} 波。</p>
      <div class="empty-art-wrap"><img src="${UI_EMPTY_UNLOCK}" alt="未解锁灵宠" class="empty-art-img" width="320" height="160" loading="lazy" /></div>
    </section>`;
  }

  const canPull = state.summonEssence >= PET_PULL_COST;
  const bonusLine = describePetBonusesSummary(state);
  const defsSorted = [...PET_DEFS].sort(
    (a, b) => rarityRank(b.rarity) - rarityRank(a.rarity),
  );
  let cards = "";
  for (const def of defsSorted) {
    const p = state.pets[def.id];
    if (p) {
      const maxed = p.level >= MAX_PET_LEVEL;
      const need = maxed ? 0 : xpToNextPetLevel(p.level);
      const pct = maxed || need <= 0 ? 100 : Math.min(100, (100 * p.xp) / need);
      const feedCost = petFeedCost(p.level);
      const canFeedOnce = !maxed && state.summonEssence >= feedCost;
      cards += `<div class="pet-card pet-card-owned">
      <div class="pet-card-portrait"><img src="${PET_PORTRAIT[def.id]}" alt="" width="72" height="72" loading="lazy" /></div>
      <div class="pet-card-body">
        <strong class="pet-card-name rarity-${def.rarity}">${def.name}</strong>
        <span class="pet-card-tag">${rarityZh(def.rarity)} · ${def.tag}</span>
        <p class="pet-card-flavor">${def.flavor}</p>
        <p class="inv-meta">等级 ${p.level}${maxed ? "（已满）" : ""} · 加成：${
          def.bonusKind === "stone"
            ? "灵石汇流（叠乘）"
            : def.bonusKind === "dungeon_atk"
              ? "幻域攻（加算）"
              : def.bonusKind === "essence_find"
                ? "唤灵髓（叠乘）"
                : "三项综合"
        }</p>
        <p class="inv-meta pet-bonus-num">本等级单宠：${petBonusPreviewLine(def, p.level)}</p>
        ${
          maxed
            ? `<div class="pet-xp-bar pet-xp-bar-maxed" aria-hidden="true"><span class="pet-xp-fill" style="width:100%"></span></div>`
            : `<div class="pet-xp-bar" title="灵契经验（重复邂逅增加）"><span class="pet-xp-fill" style="width:${pct}%"></span></div>
               <p class="inv-meta pet-xp-label">${p.xp} / ${need} 灵契</p>
               <div class="pet-card-actions pet-feed-row">
                 <button type="button" class="btn btn-primary pet-feed-btn" data-pet-feed="${def.id}" ${canFeedOnce ? "" : "disabled"} title="消耗唤灵髓提升灵契">
                   <img class="pet-feed-ico" src="${UI_PET_FEED_ACTION}" alt="" width="14" height="14" loading="lazy" />
                   喂养一次（${feedCost}<img class="btn-inline-ico" src="${UI_ESSENCE}" alt="" width="14" height="14" />）
                 </button>
                 <button type="button" class="btn pet-feed-btn" data-pet-feed-bulk="${def.id}" ${canFeedOnce ? "" : "disabled"} title="连续喂养直至唤灵髓不足或满级">
                   尽髓连喂
                 </button>
               </div>`
        }
      </div>
    </div>`;
    } else {
      cards += `<div class="pet-card pet-card-locked">
      <div class="pet-card-portrait pet-card-portrait-dim"><img src="${PET_PORTRAIT[def.id]}" alt="" width="72" height="72" loading="lazy" /></div>
      <div class="pet-card-body">
        <strong class="pet-card-name rarity-${def.rarity}">${def.name}</strong>
        <span class="pet-card-tag">${rarityZh(def.rarity)} · 未结缘</span>
        <p class="pet-card-flavor">${def.flavor}</p>
        <p class="inv-meta">唤灵池邂逅后解锁；未结缘则<strong>无</strong>此项加成。</p>
        <p class="inv-meta pet-bonus-num">预览（Lv.1）：${petBonusPreviewLine(def, 1)}</p>
      </div>
    </div>`;
    }
  }

  return `
    <section class="panel pet-panel">
      <div class="panel-title-art-row">
        <img class="panel-title-art-icon" src="${UI_HEAD_PET}" alt="" width="28" height="28" loading="lazy" />
        <h2>灵宠 · 唤灵池</h2>
      </div>
      <p class="hint">消耗唤灵髓抽取灵宠。已拥有灵宠的加成全局生效，轮回不重置。</p>
      <div class="pet-pool-row">
        <button class="btn btn-primary" type="button" id="btn-pet-pull" ${canPull ? "" : "disabled"}>
          唤灵（${PET_PULL_COST} <img class="btn-inline-ico" src="${UI_ESSENCE}" alt="" width="14" height="14" />）
        </button>
        <span class="inv-meta pet-pull-meta">累计唤灵 <strong>${state.petPullsTotal}</strong> 次 · 持有唤灵髓 <strong>${Math.floor(state.summonEssence)}</strong></span>
      </div>
      <label class="pet-auto-feed-row">
        <input type="checkbox" id="chk-pet-auto-feed" data-ui-pref="autoFeedPets" ${state.uiPrefs.autoFeedPets ? "checked" : ""} />
        <img class="pet-auto-feed-ico" src="${UI_PET_AUTO_FEED}" alt="" width="18" height="18" loading="lazy" />
        <span class="pet-auto-feed-text">主循环自动尽髓喂养（已结缘灵宠依次连喂，唤灵髓不足或已满级则停）</span>
      </label>
      <p class="hint sm">大致概率：凡 38% · 灵 26% · 珍 20% · 绝 12% · 天 4%。重复会增加灵契经验。</p>
      <p class="pet-active-summary">当前全局加成：<strong>${bonusLine}</strong></p>
      ${cards ? `<div class="pet-grid">${cards}</div>` : `<div class="empty-art-wrap"><img src="${UI_EMPTY_PET}" alt="暂无灵宠" class="empty-art-img" width="320" height="160" loading="lazy" /></div>`}
    </section>`;
}
