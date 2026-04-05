import type { GameState, GearInventorySortMode, GearItem, Rarity, SkillId } from "../types";
import {
  DUNGEON_DEATH_CD_MS,
  DUNGEON_DODGE_IFRAMES_MS,
  DUNGEON_DODGE_STAMINA_COST,
  DUNGEON_INTER_WAVE_CD_MS,
  DUNGEON_STAMINA_MAX,
  PLAYER_DUNGEON_HIT_INTERVAL_SEC,
} from "../types";
import {
  canEnterDungeon,
  describeWaveProfile,
  describeMobBattleRole,
  dungeonEntryFeeForSelectedWave,
  essenceRewardTotalFloat,
  packSizeForWave,
  pickCombatTargetMob,
  playerEngageRadiusNorm,
  playerExpectedDpsDungeonRealm,
  starVortexLeylineLabel,
  playerInStarVortexLeylineForUi,
  currentBossMob,
} from "../systems/dungeon";
import {
  playerAttack,
  playerDungeonAttackSpeedMult,
  playerMaxHp,
} from "../systems/playerCombat";
import { getDungeonAffixForNow } from "../systems/dungeonAffix";
import { currentWeekKey } from "../systems/weeklyBounty";
import {
  SKILL_HINT,
  SKILL_LABEL,
  secondsToNextLevel,
  skillXpPerSecond,
  xpToNextLevel,
} from "../systems/skillTraining";
import { getGearBase } from "../data/gearBases";
import { xuanTieEnhanceCost } from "../systems/gearCraft";
import { BATTLE_SKILLS } from "../data/battleSkills";
import { battleSkillPullCost, describeBattleSkillLevels } from "../systems/battleSkills";
import { rarityZh } from "./rarityZh";
import {
  GEAR_SLOT_ICON,
  PET_PORTRAIT,
  UI_ESSENCE,
  UI_EMPTY_GEAR,
  UI_EMPTY_PET,
  UI_EMPTY_UNLOCK,
  UI_HEAD_DUNGEON,
  UI_DUNGEON_REALM_VORTEX,
  UI_DUNGEON_AFFIX_DECO,
  UI_GEAR_LOCK_DECO,
  UI_GEAR_SORT_DECO,
  UI_GEAR_SORT_PINNED_DECO,
  UI_HEAD_GEAR,
  UI_HEAD_PET,
  UI_HEAD_TRAIN,
} from "./visualAssets";
import { formatMobDisplayName } from "../data/dungeonMobs";
import { PET_DEFS } from "../data/pets";
import {
  describePetBonusesSummary,
  MAX_PET_LEVEL,
  petBonusPreviewLine,
  petSystemUnlocked,
  PET_SYSTEM_UNLOCK_WAVES,
  PET_PULL_COST,
  xpToNextPetLevel,
  petDungeonAtkAdditive,
} from "../systems/pets";

/** 灵宠列表：稀有度天极 → 凡品 */
const PET_RARITY_ORDER_DESC: Rarity[] = ["UR", "SSR", "SR", "R", "N"];

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
  const curMob = Math.min(d.packKilled + 1, d.packSize);
  const waveEssF = essenceRewardTotalFloat(d.wave, state, d.wave % 5 === 0, d.rewardModeRepeat);
  const nPk = packSizeForWave(d.wave + 1);
  const aliveN = d.mobs.filter((m) => m.hp > 0).length;
  const nearest = pickCombatTargetMob(d, playerEngageRadiusNorm(state));
  const bossAlive = d.mobs.some((m) => m.isBoss && m.hp > 0);
  const lockLine = nearest
    ? `锁定 ${describeMobBattleRole(nearest)}：${fmtN(Math.max(0, nearest.hp))} / ${fmtN(nearest.maxHp)}`
    : "—";
  const lines = [
    `本次击杀 ${d.sessionKills} · 本次髓 +${fmtSessEss(d.sessionEssence)} · 累计通关 ${d.totalWavesCleared} 波`,
    `第 ${d.wave} 波 · 本波第 ${curMob} / ${d.packSize} · 场上 ${aliveN} 存活`,
    `${lockLine} · 本关清完约 ${waveEssF.toFixed(2)} 髓 · 下波约 ${nPk} 只`,
  ];
  if (!bossAlive && d.monsterMax > 0) {
    lines.push(`汇总额 ${fmtN(Math.max(0, d.monsterHp))} / ${fmtN(d.monsterMax)}`);
  }
  const iframesLeft = now < d.dodgeIframesUntil ? Math.ceil((d.dodgeIframesUntil - now) / 1000) : 0;
  lines.push(
    `点击地图闪避（空格） · 耗体 ${DUNGEON_DODGE_STAMINA_COST} · 化劲 ${(DUNGEON_DODGE_IFRAMES_MS / 1000).toFixed(1)} 秒${iframesLeft > 0 ? ` · 余 ${iframesLeft} 秒` : ""}`,
  );
  if (state.dungeonRealm === "star_vortex") {
    const inL = playerInStarVortexLeylineForUi(d);
    lines.push(
      `星漩：连斩 ${d.vortexKillStreak} 层 · 灵脉 ${starVortexLeylineLabel(d.vortexLeylineKind)}${inL ? "（你在圈内）" : ""}`,
    );
  }
  return lines.join("\n");
}

export function formatDungeonInterMeta(): string {
  return "本关结算完成。休整后进入下一关。接战时移速会降低，出手和受击后会短暂停顿。";
}

function renderDungeonMapHtml(state: GameState): string {
  const d = state.dungeon;
  if (!d.active) return "";
  let cells = "";
  if (d.walkable.length && d.mapW > 0) {
    for (let y = 0; y < d.mapH; y++) {
      for (let x = 0; x < d.mapW; x++) {
        const w = d.walkable[y * d.mapW + x];
        cells += `<div class="dcell ${w ? "walk" : "wall"}"></div>`;
      }
    }
  }
  let mobs = "";
  for (const m of d.mobs) {
    const boss = m.isBoss ? " mob-boss" : "";
    const skin = ` mob-skin-${((m.mobKind % 8) + 8) % 8}`;
    const hpPct = m.maxHp > 0 ? Math.min(100, (100 * Math.max(0, m.hp)) / m.maxHp) : 0;
    const miniHp = m.isBoss
      ? ""
      : `<div class="mob-hp-mini" aria-hidden="true"><span class="mob-hp-fill" style="width:${hpPct}%"></span></div>`;
    const roleCls = !m.isBoss && m.mobRole === "ranged" ? " mob-stack-ranged" : "";
    mobs += `<div class="dungeon-mob-stack${roleCls}" data-mob-id="${m.id}" style="left:${m.x * 100}%;top:${m.y * 100}%">
      ${miniHp}
      <div class="dungeon-entity mob${skin}${boss} ${m.hp <= 0 ? "mob-dead" : ""}"></div>
    </div>`;
  }
  const atkCls = d.inMelee ? " attacking" : "";
  /** 幻域普攻与转圈剑气一致，不再用群怪爆发圈 */
  const fxAoe = "";
  const fxSingle = d.inMelee && d.attackVisualMode === "single" ? " is-single" : "";
  const vortexOn = state.dungeonRealm === "star_vortex";
  const leyW = vortexOn ? Math.max(8, 2 * d.vortexLeylineRadiusNorm * 100) : 0;
  const leylineHtml = vortexOn
    ? `<div class="dungeon-vortex-leyline ${d.vortexLeylineKind}" aria-hidden="true" style="left:${d.vortexLeylineX * 100}%;top:${d.vortexLeylineY * 100}%;width:${leyW}%;"></div>`
    : "";
  const vortexHudHtml = vortexOn
    ? `<div class="dungeon-vortex-hud" id="dungeon-vortex-hud" aria-live="polite">
        <span class="dungeon-vortex-hud-line">连斩 <strong id="dungeon-vortex-streak-val">${d.vortexKillStreak}</strong> 层</span>
        <span class="dungeon-vortex-hud-line">灵脉 <strong id="dungeon-vortex-ley-txt">${starVortexLeylineLabel(d.vortexLeylineKind)}</strong></span>
      </div>`
    : "";
  const bossMob = currentBossMob(d);
  const bossAlive = !!bossMob;
  const mobPct = d.monsterMax > 0 ? Math.min(100, (100 * Math.max(0, d.monsterHp)) / d.monsterMax) : 0;
  const bossTitle = bossMob
    ? formatMobDisplayName(bossMob.element, bossMob.mobKind, true, bossMob.bossEpithet, undefined)
    : "首领";
  const bossHud = bossAlive
    ? `<div class="dungeon-map-hud-overlay" aria-hidden="true">
      <div class="dungeon-boss-strip" id="dungeon-boss-hud">
        <div class="dungeon-boss-strip-title" id="dungeon-boss-name">${bossTitle}</div>
        <div class="dungeon-boss-strip-bar-wrap">
          <div class="dungeon-boss-strip-bar-bg" aria-hidden="true"></div>
          <div class="dungeon-boss-strip-bar-fill" id="dungeon-boss-bar" style="width:${mobPct}%"></div>
        </div>
        <div class="dungeon-boss-strip-readout" id="dungeon-boss-hp-txt">${fmtNum(Math.max(0, d.monsterHp))} / ${fmtNum(d.monsterMax)}</div>
      </div>
      <div id="dungeon-float-layer" class="dungeon-float-layer"></div>
    </div>`
    : `<div class="dungeon-map-hud-overlay" aria-hidden="true">
      <div id="dungeon-float-layer" class="dungeon-float-layer"></div>
    </div>`;
  const hpPct = d.playerMax > 0 ? Math.min(100, (100 * Math.max(0, d.playerHp)) / d.playerMax) : 0;
  const staPct = DUNGEON_STAMINA_MAX > 0 ? Math.min(100, (100 * Math.max(0, d.stamina)) / DUNGEON_STAMINA_MAX) : 0;
  const hitIntSec = Math.max(0.2, PLAYER_DUNGEON_HIT_INTERVAL_SEC / playerDungeonAttackSpeedMult(state));
  return `
    <div class="dungeon-map-frame">
      <button type="button" class="dungeon-map-leave-btn" id="btn-dungeon-leave">暂离</button>
      ${vortexHudHtml}
      <div class="dungeon-map-hud-bl" aria-hidden="true">
        <div class="dungeon-hud-mini-row"><span>生命</span><span id="dungeon-pl-txt">${fmtNum(Math.max(0, d.playerHp))} / ${fmtNum(d.playerMax)}</span></div>
        <div class="progress-track dungeon slim hud-mini"><div class="progress-fill player" id="dungeon-pl-bar" style="width:${hpPct}%"></div></div>
        <div class="dungeon-hud-mini-row"><span>体力</span><span id="dungeon-stamina-txt">${Math.floor(d.stamina)} / ${DUNGEON_STAMINA_MAX}</span></div>
        <div class="progress-track dungeon slim stamina-track hud-mini"><div class="progress-fill stamina" id="dungeon-stamina-bar" style="width:${staPct}%"></div></div>
      </div>
      <div class="dungeon-map-wrap">
        <div class="dungeon-map${vortexOn ? " dungeon-map--vortex" : ""}${fxAoe}${fxSingle}" id="dungeon-map" aria-label="幻域俯视" style="--gw:${d.mapW || 1};--gh:${d.mapH || 1};--dungeon-player-hit-interval:${hitIntSec}s">
          ${bossHud}
          <div class="dungeon-cells">${cells}</div>
          <div class="dungeon-entities">
          ${leylineHtml}
          <div class="dungeon-player-stack" id="dungeon-player-stack" style="left:${d.playerX * 100}%;top:${d.playerY * 100}%">
            <div class="dungeon-player-fx" aria-hidden="true">
              <div class="dungeon-engage-ring"></div>
              <div class="fx-aoe-ring"></div>
              <div class="fx-single-slash"></div>
            </div>
            <div class="dungeon-player-rot" id="dungeon-player-rot">
              <span class="player-facing-wedge" aria-hidden="true"></span>
              <div class="dungeon-entity player${atkCls}" id="dungeon-player"></div>
            </div>
          </div>
          ${mobs}
          </div>
        </div>
      </div>
    </div>`;
}

const DUNGEON_HELP_BLURB = `幻域只掉唤灵髓，按关结算。幻域生命为全局共享，进关不会回满。每次进关都会重置地图和怪物。入场费、阵亡损失和复刷规则见「养成→图鉴·札记」。`;

function renderSanctuaryBlock(state: GameState, chp: number, pmax: number): string {
  const portalReady = state.dungeonSanctuaryMode && chp >= pmax - 0.25;
  const w = state.dungeonPortalTargetWave;
  const auto = state.dungeonSanctuaryAutoEnter;
  const autoAttr = auto ? "checked" : "";
  const portalSection = portalReady
    ? auto
      ? `<div class="sanctuary-portal-wrap sanctuary-portal-wrap--ready" aria-live="polite">
      <div class="sanctuary-portal-ring" aria-hidden="true"></div>
      <p class="sanctuary-portal-msg">生命已回满，将自动进入第 <strong>${w}</strong> 关</p>
    </div>`
      : `<div class="sanctuary-portal-wrap sanctuary-portal-wrap--ready" aria-live="polite">
      <div class="sanctuary-portal-ring" aria-hidden="true"></div>
      <p class="sanctuary-portal-msg">生命已回满，可进入第 <strong>${w}</strong> 关（需入场髓）</p>
      <button type="button" class="btn btn-primary btn-sanctuary-portal" id="btn-sanctuary-portal">进入副本</button>
    </div>`
    : auto
      ? `<p class="sanctuary-wait-txt">恢复中，回满后将自动进入</p>`
      : `<p class="sanctuary-wait-txt">恢复中，回满后可手动进入第 <strong>${w}</strong> 关</p>`;
  return `<div class="sanctuary-visual">
    <div class="sanctuary-visual-bg" aria-hidden="true"></div>
    <div class="sanctuary-heal-particles" aria-hidden="true"></div>
    <div class="sanctuary-player-dot" aria-hidden="true"></div>
    <div class="sanctuary-auto-row">
      <label class="sanctuary-auto-label">
        <input type="checkbox" id="sanctuary-auto-enter" ${autoAttr} />
        <span>回满后自动进本</span>
      </label>
      <span class="hint sm sanctuary-auto-hint">未勾选时，进本前会先确认</span>
    </div>
    ${portalSection}
  </div>`;
}

function renderIdlePreviewMap(): string {
  return `<div class="dungeon-idle-preview-map" aria-hidden="true"><div class="dungeon-idle-preview-grid"></div></div>`;
}

export function renderDungeonPanel(state: GameState): string {
  const d = state.dungeon;
  const now = Date.now();
  const cd = Math.max(0, d.deathCooldownUntil - now);
  const canEnter = canEnterDungeon(state, now);
  const edps = playerExpectedDpsDungeonRealm(state, now);
  const affix = getDungeonAffixForNow(now);
  const weekLine = currentWeekKey(now);
  const pmax = playerMaxHp(state);
  const chp = state.combatHpCurrent;
  const chpPctGlobal = pmax > 0 ? Math.min(100, (100 * Math.max(0, chp)) / pmax) : 0;
  const entryFeeShow = dungeonEntryFeeForSelectedWave(
    state,
    Math.max(1, Math.min(d.maxWaveRecord + 1, d.entryWave)),
  );
  const petAtkPct =
    petSystemUnlocked(state) && petDungeonAtkAdditive(state) > 0
      ? (petDungeonAtkAdditive(state) * 100).toFixed(2)
      : null;
  const nextWavePreview = describeWaveProfile(Math.max(1, d.entryWave));
  const cdPct = cd > 0 ? Math.min(100, 100 - (100 * cd) / DUNGEON_DEATH_CD_MS) : 100;
  const interWaveWait = d.active && d.mobs.length === 0 && d.interWaveCooldownUntil > now;
  const interSec = interWaveWait ? Math.max(0, Math.ceil((d.interWaveCooldownUntil - now) / 1000)) : 0;
  const interPct =
    interWaveWait && DUNGEON_INTER_WAVE_CD_MS > 0
      ? Math.min(100, (100 * (DUNGEON_INTER_WAVE_CD_MS - (d.interWaveCooldownUntil - now))) / DUNGEON_INTER_WAVE_CD_MS)
      : 0;
  const sanctuaryIdle = state.dungeonSanctuaryMode && !d.active;

  const helpPop = `<div id="dungeon-help-popover" class="dungeon-help-popover" role="region" aria-label="幻域说明" hidden>
    <p class="hint sm">${DUNGEON_HELP_BLURB}</p>
  </div>`;

  return `
    <section class="panel dungeon-strip-panel">
      <div class="panel-title-art-row">
        <img class="panel-title-art-icon" src="${UI_HEAD_DUNGEON}" alt="" width="28" height="28" loading="lazy" />
        <h2>幻域</h2>
      </div>
      <div class="dungeon-affix-banner" role="region" aria-label="本周幻域词缀" id="dungeon-affix-banner">
        <img class="dungeon-affix-icon" src="${UI_DUNGEON_AFFIX_DECO}" alt="" width="40" height="40" loading="lazy" />
        <div class="dungeon-affix-text">
          <strong class="dungeon-affix-title" id="dungeon-affix-title">本周词缀 · ${affix.title}</strong>
          <p class="hint sm dungeon-affix-desc" id="dungeon-affix-desc">${affix.desc}<span class="dungeon-affix-wk">（周次 ${weekLine}）</span></p>
        </div>
      </div>
      <div class="dungeon-map-stage">
        <button type="button" class="dungeon-map-help-btn" id="btn-dungeon-help" aria-expanded="false" aria-controls="dungeon-help-popover" aria-label="查看幻域说明" title="幻域说明">?</button>
        ${helpPop}
      ${
        d.active
          ? interWaveWait
            ? `<div class="dungeon-active-stack">
          <div class="dungeon-viewport dungeon-inter-wave">
            <button type="button" class="dungeon-map-leave-btn" id="btn-dungeon-leave">暂离</button>
            <div class="dungeon-inter-wave-inner">
              <p class="dungeon-inter-title">休整中 · 即将进入第 <strong>${d.wave}</strong> 关</p>
              <div class="bar-label"><span>下一关就绪</span><span id="dungeon-inter-sec">${interSec} 秒</span></div>
              <div class="progress-track cd"><div class="progress-fill cd" id="dungeon-inter-bar-fill" style="width:${interPct}%"></div></div>
            </div>
          </div>
          <p class="dungeon-active-meta hint sm" id="dungeon-active-meta">${formatDungeonInterMeta()}</p>
        </div>`
            : `<div class="dungeon-active-stack">
          <div class="dungeon-viewport dungeon-live-combat" id="dungeon-live-root">
          ${renderDungeonMapHtml(state)}
          </div>
          <p class="dungeon-active-meta hint sm" id="dungeon-active-meta">${formatDungeonActiveMeta(state, now)}</p>
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
          <p class="hint sm">可选下一关或已通关关卡复刷。入场约 <strong>${entryFeeShow}</strong> 髓；阵亡损失灵石 <strong>5%</strong>（至少 1）。</p>
          <div class="dungeon-realm-pick" role="radiogroup" aria-label="幻域类型">
            <span class="dungeon-realm-pick-label">副本类型</span>
            <label class="dungeon-realm-option">
              <input type="radio" name="dungeon-realm" value="classic" ${state.dungeonRealm === "classic" ? "checked" : ""} />
              <span class="dungeon-realm-option-body">经典幻域</span>
              <span class="hint sm">原网格战斗</span>
            </label>
            <label class="dungeon-realm-option dungeon-realm-option--vortex">
              <input type="radio" name="dungeon-realm" value="star_vortex" ${state.dungeonRealm === "star_vortex" ? "checked" : ""} />
              <img class="dungeon-realm-vortex-ico" src="${UI_DUNGEON_REALM_VORTEX}" alt="" width="22" height="22" loading="lazy" />
              <span class="dungeon-realm-option-body">星漩乱域</span>
              <span class="hint sm">连斩 + 灵脉场地 · 髓 +7%</span>
            </label>
          </div>
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
          <button class="btn btn-primary" type="button" id="btn-dungeon-enter" ${canEnter ? "" : "disabled"}>
            ${canEnter ? "进入副本" : cd > 0 ? "冷却中" : "无法进入"}
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
          <span>本局用时 <strong id="dungeon-session-elapsed">—</strong></span>
          <span class="dungeon-foot-timer-sep">·</span>
          <span>预计剩余 <strong id="dungeon-eta-remaining">—</strong></span>
          <span class="dungeon-foot-timer-hint">（估算值）</span>
        </div>
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
      <h3 class="sub-h">心法</h3>
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

const RARITY_ORDER_SORT: Record<string, number> = { UR: 0, SSR: 1, SR: 2, R: 3, N: 4 };
const SLOT_ORDER_SORT: Record<"weapon" | "body" | "ring", number> = { weapon: 0, body: 1, ring: 2 };

function sortGearInventoryItems(items: GearItem[], mode: GearInventorySortMode): GearItem[] {
  const ro = RARITY_ORDER_SORT;
  const so = SLOT_ORDER_SORT;
  return [...items].sort((a, b) => {
    if (mode === "rarity") {
      const dr = (ro[a.rarity] ?? 9) - (ro[b.rarity] ?? 9);
      if (dr !== 0) return dr;
      if (b.itemLevel !== a.itemLevel) return b.itemLevel - a.itemLevel;
      return a.displayName.localeCompare(b.displayName, "zh-Hans-CN");
    }
    if (mode === "ilvl") {
      if (b.itemLevel !== a.itemLevel) return b.itemLevel - a.itemLevel;
      const dr = (ro[a.rarity] ?? 9) - (ro[b.rarity] ?? 9);
      if (dr !== 0) return dr;
      return a.displayName.localeCompare(b.displayName, "zh-Hans-CN");
    }
    if (mode === "slot") {
      const ds = (so[a.slot] ?? 9) - (so[b.slot] ?? 9);
      if (ds !== 0) return ds;
      const dr = (ro[a.rarity] ?? 9) - (ro[b.rarity] ?? 9);
      if (dr !== 0) return dr;
      return b.itemLevel - a.itemLevel;
    }
    const c = a.displayName.localeCompare(b.displayName, "zh-Hans-CN");
    if (c !== 0) return c;
    return (ro[a.rarity] ?? 9) - (ro[b.rarity] ?? 9);
  });
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
  gearDetailSlot: "weapon" | "body" | "ring" | null = null,
  gearInvSort: GearInventorySortMode = "rarity",
): string {
  const refineHint = refineTargetId
    ? `<p class="hint refine-hint">精炼：已选主件，再点<strong>另一件</strong>同基底天极作为消耗；再点主件可取消。</p>`
    : "";
  const items = sortGearInventoryItems(Object.values(state.gearInventory), gearInvSort);
  let inv = "";
  for (const g of items) {
    const eq =
      state.equippedGear.weapon === g.instanceId ||
      state.equippedGear.body === g.instanceId ||
      state.equippedGear.ring === g.instanceId;
    const pre = g.prefixes.map((x) => `<span class="affix">${x.text}</span>`).join("");
    const suf = g.suffixes.map((x) => `<span class="affix">${x.text}</span>`).join("");
    const picked = refineTargetId === g.instanceId;
    const refineBtn =
      g.rarity === "UR"
        ? `<button class="btn ${picked ? "btn-primary" : ""}" type="button" data-gear-refine="${g.instanceId}">${picked ? "取消精炼" : "精炼"}</button>`
        : "";
    const xt = xuanTieEnhanceCost(g.enhanceLevel);
    const locked = !!g.locked;
    inv += `
      <div class="gear-row ${eq ? "equipped" : ""} ${picked ? "refine-picked" : ""} ${locked ? "is-locked" : ""}">
        <div class="gear-row-visual">
          <div class="gear-icon-wrap rarity-${g.rarity}">
            <img src="${GEAR_SLOT_ICON[g.slot]}" alt="" width="32" height="32" loading="lazy" class="gear-slot-icon" />
          </div>
          <div>
          <strong class="rarity-${g.rarity}">${g.displayName}</strong> · ${rarityZh(g.rarity)} · ilvl ${g.itemLevel}
          <p class="inv-meta">强化 ${g.enhanceLevel}${g.rarity === "UR" ? ` · 精炼 ${g.refineLevel}` : ""}${locked ? " · <span class=\"gear-locked-tag\">已锁定</span>" : ""}</p>
          <div class="affix-block">${pre}${suf}</div>
          </div>
        </div>
        <div class="gear-actions">
          <button class="btn btn-primary" type="button" data-gear-equip="${g.instanceId}" ${eq ? "disabled" : ""}>装备</button>
          <button class="btn" type="button" data-gear-enhance="${g.instanceId}">强化（${xt} 玄铁）</button>
          <button class="btn gear-lock-toggle-btn ${locked ? "is-locked" : ""}" type="button" data-gear-toggle-lock="${g.instanceId}">
            <img src="${UI_GEAR_LOCK_DECO}" alt="" width="16" height="16" class="gear-lock-ico" loading="lazy" />${locked ? "解锁" : "锁定"}
          </button>
          <button class="btn" type="button" data-gear-salvage="${g.instanceId}" ${eq || locked ? "disabled" : ""}>分解</button>
          ${refineBtn}
        </div>
      </div>`;
  }
  const slotLabel: Record<"weapon" | "body" | "ring", string> = {
    weapon: "武器",
    body: "衣甲",
    ring: "指环",
  };
  const slots = ["weapon", "body", "ring"] as const;
  let slotHtml = "";
  for (const s of slots) {
    const id = state.equippedGear[s];
    const g = id ? state.gearInventory[id] : null;
    const open = gearDetailSlot === s;
    slotHtml += `<div class="gear-slot-line">
      <button type="button" class="gear-slot-summary ${open ? "is-open" : ""}" data-gear-open-slot="${s}">
        <span class="gear-slot-summary-label">${slotLabel[s]}</span>
        <span class="gear-slot-summary-name">${g ? g.displayName : "（空）"}</span>
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
        <p class="hint">${slotLabel[s]}栏位为空。可在下方背包点击「装备」上阵。</p>
        <button type="button" class="btn" id="btn-gear-detail-close">关闭</button>
      </div>`;
    } else {
      const pre = g.prefixes.map((x) => `<span class="affix">${x.text}</span>`).join("");
      const suf = g.suffixes.map((x) => `<span class="affix">${x.text}</span>`).join("");
      const xt = xuanTieEnhanceCost(g.enhanceLevel);
      const picked = refineTargetId === g.instanceId;
      const refineBtn =
        g.rarity === "UR"
          ? `<button class="btn ${picked ? "btn-primary" : ""}" type="button" data-gear-refine="${g.instanceId}">${picked ? "取消精炼" : "精炼"}</button>`
          : "";
      detailBlock = `<div class="gear-equipped-detail" id="gear-equipped-detail">
        <div class="gear-equipped-detail-head">
          <div class="gear-icon-wrap rarity-${g.rarity}">
            <img src="${GEAR_SLOT_ICON[g.slot]}" alt="" width="40" height="40" loading="lazy" class="gear-slot-icon" />
          </div>
          <div>
            <strong class="rarity-${g.rarity}">${g.displayName}</strong> · ${rarityZh(g.rarity)} · ilvl ${g.itemLevel}
            <p class="inv-meta">已装备于 ${slotLabel[s]} · 强化 ${g.enhanceLevel}${g.rarity === "UR" ? ` · 精炼 ${g.refineLevel}` : ""}${g.locked ? " · <span class=\"gear-locked-tag\">已锁定</span>" : ""}</p>
          </div>
        </div>
        <div class="affix-block">${pre}${suf}</div>
        <div class="gear-equipped-detail-actions">
          <button class="btn btn-danger" type="button" data-gear-unequip-detail="${s}">卸下</button>
          <button class="btn btn-primary" type="button" data-gear-enhance="${g.instanceId}">强化（${xt} 玄铁）</button>
          <button class="btn gear-lock-toggle-btn ${g.locked ? "is-locked" : ""}" type="button" data-gear-toggle-lock="${g.instanceId}">
            <img src="${UI_GEAR_LOCK_DECO}" alt="" width="16" height="16" class="gear-lock-ico" loading="lazy" />${g.locked ? "解锁" : "锁定"}
          </button>
          ${refineBtn}
          <button type="button" class="btn" id="btn-gear-detail-close">关闭</button>
        </div>
      </div>`;
    }
  }
  return `
    <section class="panel" id="gear-panel-root">
      <div class="panel-title-art-row">
        <img class="panel-title-art-icon" src="${UI_HEAD_GEAR}" alt="" width="28" height="28" loading="lazy" />
        <h2>装备</h2>
      </div>
      <p class="hint">装备来自抽卡的铸灵池。强化消耗玄铁（分解装备获得）；天极可精炼。</p>
      <p class="hint">点武器/衣甲/指环查看详情，可卸下或强化。背包中的未装备件也能强化。</p>
      <p class="hint sm">锁定装备不可分解，也不会被自动分解；精炼时不可锁定消耗件。</p>
      ${refineHint}
      <h3 class="sub-h">已装备</h3>
      ${slotHtml}
      ${detailBlock}
      <h3 class="sub-h">背包</h3>
      ${
        items.length > 0
          ? `<div class="gear-inv-sort-bar" role="toolbar" aria-label="背包排序">
        <span class="gear-inv-sort-label">
          <img src="${UI_GEAR_SORT_DECO}" class="gear-inv-sort-ico" alt="" width="18" height="18" loading="lazy" />
          排序
          <img src="${UI_GEAR_SORT_PINNED_DECO}" class="gear-inv-sort-pinned" alt="" width="14" height="14" loading="lazy" title="偏好已写入存档" />
        </span>
        <div class="gear-inv-sort-btns">
          ${(["rarity", "ilvl", "slot", "name"] as const)
            .map(
              (m) =>
                `<button type="button" class="btn gear-inv-sort-btn ${gearInvSort === m ? "is-active" : ""}" data-gear-inv-sort="${m}">${GEAR_SORT_LABELS[m]}</button>`,
            )
            .join("")}
        </div>
      </div>`
          : ""
      }
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
    (a, b) => PET_RARITY_ORDER_DESC.indexOf(a.rarity) - PET_RARITY_ORDER_DESC.indexOf(b.rarity),
  );
  let cards = "";
  for (const def of defsSorted) {
    const p = state.pets[def.id];
    if (p) {
      const maxed = p.level >= MAX_PET_LEVEL;
      const need = maxed ? 0 : xpToNextPetLevel(p.level);
      const pct = maxed || need <= 0 ? 100 : Math.min(100, (100 * p.xp) / need);
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
               <p class="inv-meta pet-xp-label">${p.xp} / ${need} 灵契</p>`
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
      <p class="hint sm">大致概率：凡 38% · 灵 26% · 珍 20% · 绝 12% · 天 4%。重复会增加灵契经验。</p>
      <p class="pet-active-summary">当前全局加成：<strong>${bonusLine}</strong></p>
      ${cards ? `<div class="pet-grid">${cards}</div>` : `<div class="empty-art-wrap"><img src="${UI_EMPTY_PET}" alt="暂无灵宠" class="empty-art-img" width="320" height="160" loading="lazy" /></div>`}
    </section>`;
}
