import type { GameState } from "../types";
import { getCard } from "../data/cards";
import { fmtDecimal, stones } from "../stones";
import { PULL_CHRONICLE_MAX } from "../systems/pullChronicle";
import { rarityZh } from "./rarityZh";
import { gearTierClass, gearTierLabel } from "./gearVisualTier";
import {
  UI_CHRONICLE_BATTLE_SKILL_STAT,
  UI_CHRONICLE_DUNGEON_BOSS_KILL_STAT,
  UI_CHRONICLE_CARD_LEVEL_STAT,
  UI_CHRONICLE_CARD_SALVAGE_STAT,
  UI_CHRONICLE_CARD_STAR_STAT,
  UI_CHRONICLE_CARD_TEN_PULL_STAT,
  UI_CHRONICLE_CARD_SINGLE_PULL_STAT,
  UI_CHRONICLE_GEAR_TEN_PULL_STAT,
  UI_CHRONICLE_GEAR_SINGLE_PULL_STAT,
  UI_CHRONICLE_ESTATE_STAT,
  UI_CHRONICLE_FENTIAN_STAT,
  UI_CHRONICLE_BI_GUAN_STAT,
  UI_CHRONICLE_FORTUNE_STAT,
  UI_CHRONICLE_DAILY_LOGIN_STAT,
  UI_CHRONICLE_SPIRIT_TIDE_STAT,
  UI_CHRONICLE_GEAR_ENHANCE_STAT,
  UI_CHRONICLE_GARDEN_HARVEST_STAT,
  UI_CHRONICLE_GARDEN_PLANT_STAT,
  UI_CHRONICLE_GEAR_SALVAGE_STAT,
  UI_CHRONICLE_META_UPGRADE_STAT,
  UI_CHRONICLE_OFFLINE_ADVENTURE_STAT,
  UI_CHRONICLE_OFFLINE_STONE_SETTLEMENT_STAT,
  UI_CHRONICLE_PET_FEED_STAT,
  UI_CHRONICLE_PET_PULL_STAT,
  UI_CHRONICLE_REALM_BREAKTHROUGH_STAT,
  UI_CHRONICLE_IN_GAME_DAY_PEAK_STAT,
  UI_CHRONICLE_SKILL_LEVEL_STAT,
  UI_CHRONICLE_SPIRIT_ARRAY_UPGRADE_STAT,
  UI_CHRONICLE_TUNA_STAT,
  UI_CHRONICLE_UR_REFINE_STAT,
  UI_CHRONICLE_VEIN_UPGRADE_STAT,
  UI_GEAR_CHRONICLE_DECO,
  UI_HEAD_CHRONICLE,
  UI_RESONANCE_PAYOUT_STAT,
} from "./visualAssets";

function fmtTime(atMs: number): string {
  const d = new Date(atMs);
  return `${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

export function renderChroniclePanel(state: GameState): string {
  const cardTableBody =
    state.pullChronicle.length === 0
      ? `<tbody><tr><td colspan="3" class="chronicle-empty-cell"><p class="hint chronicle-empty">暂无灵卡唤引记录。去底部「抽卡 → 灵卡池」唤引后，会在此显示最近 ${PULL_CHRONICLE_MAX} 条。</p></td></tr></tbody>`
      : `<tbody>${state.pullChronicle
          .map((e) => {
            const c = getCard(e.defId);
            const name = c?.name ?? e.defId;
            const rz = rarityZh(e.rarity);
            const nw = e.isNew ? '<span class="chronicle-new">首遇</span>' : "";
            return `<tr class="chronicle-tr rarity-${e.rarity}">
          <td class="chronicle-td-time">${fmtTime(e.atMs)}</td>
          <td class="chronicle-td-name">${name} ${nw}</td>
          <td class="chronicle-td-r">${rz}</td>
        </tr>`;
          })
          .join("")}</tbody>`;

  const gearTableBody =
    state.gearPullChronicle.length === 0
      ? `<tbody><tr><td colspan="3" class="chronicle-empty-cell"><p class="hint chronicle-empty">暂无铸灵记录。去底部「抽卡 → 境界铸灵」铸灵后，会在此显示最近 ${PULL_CHRONICLE_MAX} 条。</p></td></tr></tbody>`
      : `<tbody>${state.gearPullChronicle
          .map((e) => {
            const rz = gearTierLabel(e.gearTier);
            return `<tr class="chronicle-tr ${gearTierClass(e.gearTier)}">
          <td class="chronicle-td-time">${fmtTime(e.atMs)}</td>
          <td class="chronicle-td-name">${e.displayName}</td>
          <td class="chronicle-td-r ${gearTierClass(e.gearTier)} gear-tier-text">${rz}</td>
        </tr>`;
          })
          .join("")}</tbody>`;

  const ls = state.lifetimeStats;
  const pt = Math.floor(state.playtimeSec);
  const h = Math.floor(pt / 3600);
  const m = Math.floor((pt % 3600) / 60);

  return `
    <section class="panel chronicle-panel">
      <div class="panel-title-art-row">
        <img class="panel-title-art-icon" src="${UI_HEAD_CHRONICLE}" alt="" width="28" height="28" loading="lazy" />
        <h2>唤灵通鉴</h2>
      </div>
      <p class="hint">灵卡唤引与境界铸灵产出分栏记录；下方为部分终身统计。</p>
      <div class="chronicle-stats-grid">
        <div class="chronicle-stat-card">
          <span class="chronicle-stat-lbl">累计在线</span>
          <strong class="chronicle-stat-val">${h} 时 ${m} 分</strong>
        </div>
        <div class="chronicle-stat-card chronicle-stat-card--in-game-day-peak">
          <img class="chronicle-stat-ico" src="${UI_CHRONICLE_IN_GAME_DAY_PEAK_STAT}" alt="" width="32" height="32" loading="lazy" />
          <div>
            <span class="chronicle-stat-lbl">历世日序峰值</span>
            <strong class="chronicle-stat-val">第 ${ls.maxInGameDayReached} 日</strong>
          </div>
        </div>
        <div class="chronicle-stat-card chronicle-stat-card--realm-breakthrough">
          <img class="chronicle-stat-ico" src="${UI_CHRONICLE_REALM_BREAKTHROUGH_STAT}" alt="" width="32" height="32" loading="lazy" />
          <div>
            <span class="chronicle-stat-lbl">境界突破</span>
            <strong class="chronicle-stat-val">${ls.realmBreakthroughs} 次</strong>
          </div>
        </div>
        <div class="chronicle-stat-card">
          <span class="chronicle-stat-lbl">灵卡累计唤引</span>
          <strong class="chronicle-stat-val">${state.totalPulls} 次</strong>
        </div>
        <div class="chronicle-stat-card chronicle-stat-card--card-ten-pull">
          <img class="chronicle-stat-ico" src="${UI_CHRONICLE_CARD_TEN_PULL_STAT}" alt="" width="32" height="32" loading="lazy" />
          <div>
            <span class="chronicle-stat-lbl">灵卡十连</span>
            <strong class="chronicle-stat-val">${ls.cardTenPullSessions} 次</strong>
          </div>
        </div>
        <div class="chronicle-stat-card chronicle-stat-card--card-single-pull">
          <img class="chronicle-stat-ico" src="${UI_CHRONICLE_CARD_SINGLE_PULL_STAT}" alt="" width="32" height="32" loading="lazy" />
          <div>
            <span class="chronicle-stat-lbl">灵卡单抽</span>
            <strong class="chronicle-stat-val">${ls.cardSinglePullActions} 次</strong>
          </div>
        </div>
        <div class="chronicle-stat-card chronicle-stat-card--card-star">
          <img class="chronicle-stat-ico" src="${UI_CHRONICLE_CARD_STAR_STAT}" alt="" width="32" height="32" loading="lazy" />
          <div>
            <span class="chronicle-stat-lbl">灵卡叠星</span>
            <strong class="chronicle-stat-val">${ls.cardStarUps} 次</strong>
          </div>
        </div>
        <div class="chronicle-stat-card chronicle-stat-card--card-level">
          <img class="chronicle-stat-ico" src="${UI_CHRONICLE_CARD_LEVEL_STAT}" alt="" width="32" height="32" loading="lazy" />
          <div>
            <span class="chronicle-stat-lbl">灵卡升阶</span>
            <strong class="chronicle-stat-val">${ls.cardLevelUps} 次</strong>
          </div>
        </div>
        <div class="chronicle-stat-card chronicle-stat-card--pet-pull">
          <img class="chronicle-stat-ico" src="${UI_CHRONICLE_PET_PULL_STAT}" alt="" width="32" height="32" loading="lazy" />
          <div>
            <span class="chronicle-stat-lbl">灵宠唤引</span>
            <strong class="chronicle-stat-val">${state.petPullsTotal} 次</strong>
          </div>
        </div>
        <div class="chronicle-stat-card chronicle-stat-card--pet-feed">
          <img class="chronicle-stat-ico" src="${UI_CHRONICLE_PET_FEED_STAT}" alt="" width="32" height="32" loading="lazy" />
          <div>
            <span class="chronicle-stat-lbl">灵宠喂养</span>
            <strong class="chronicle-stat-val">${ls.petFeeds} 次</strong>
          </div>
        </div>
        <div class="chronicle-stat-card">
          <span class="chronicle-stat-lbl">累计铸灵</span>
          <strong class="chronicle-stat-val">${ls.gearForgesTotal} 次</strong>
        </div>
        <div class="chronicle-stat-card chronicle-stat-card--gear-ten-pull">
          <img class="chronicle-stat-ico" src="${UI_CHRONICLE_GEAR_TEN_PULL_STAT}" alt="" width="32" height="32" loading="lazy" />
          <div>
            <span class="chronicle-stat-lbl">境界十铸</span>
            <strong class="chronicle-stat-val">${ls.gearTenPullSessions} 次</strong>
          </div>
        </div>
        <div class="chronicle-stat-card chronicle-stat-card--gear-single-pull">
          <img class="chronicle-stat-ico" src="${UI_CHRONICLE_GEAR_SINGLE_PULL_STAT}" alt="" width="32" height="32" loading="lazy" />
          <div>
            <span class="chronicle-stat-lbl">境界单铸</span>
            <strong class="chronicle-stat-val">${ls.gearSinglePullActions} 次</strong>
          </div>
        </div>
        <div class="chronicle-stat-card chronicle-stat-card--gear-enhance">
          <img class="chronicle-stat-ico" src="${UI_CHRONICLE_GEAR_ENHANCE_STAT}" alt="" width="32" height="32" loading="lazy" />
          <div>
            <span class="chronicle-stat-lbl">槽位强化</span>
            <strong class="chronicle-stat-val">${ls.gearEnhances} 次</strong>
          </div>
        </div>
        <div class="chronicle-stat-card chronicle-stat-card--ur-refine">
          <img class="chronicle-stat-ico" src="${UI_CHRONICLE_UR_REFINE_STAT}" alt="" width="32" height="32" loading="lazy" />
          <div>
            <span class="chronicle-stat-lbl">天极精炼</span>
            <strong class="chronicle-stat-val">${ls.urGearRefines} 次</strong>
          </div>
        </div>
        <div class="chronicle-stat-card chronicle-stat-card--gear-salvage">
          <img class="chronicle-stat-ico" src="${UI_CHRONICLE_GEAR_SALVAGE_STAT}" alt="" width="32" height="32" loading="lazy" />
          <div>
            <span class="chronicle-stat-lbl">装备分解</span>
            <strong class="chronicle-stat-val">${ls.gearSalvages} 次</strong>
          </div>
        </div>
        <div class="chronicle-stat-card chronicle-stat-card--card-salvage">
          <img class="chronicle-stat-ico" src="${UI_CHRONICLE_CARD_SALVAGE_STAT}" alt="" width="32" height="32" loading="lazy" />
          <div>
            <span class="chronicle-stat-lbl">灵卡分解</span>
            <strong class="chronicle-stat-val">${ls.cardSalvages} 次</strong>
          </div>
        </div>
        <div class="chronicle-stat-card">
          <span class="chronicle-stat-lbl">幻域累计入包髓</span>
          <strong class="chronicle-stat-val">${ls.dungeonEssenceIntGained}</strong>
        </div>
        <div class="chronicle-stat-card chronicle-stat-card--dungeon-boss">
          <img class="chronicle-stat-ico" src="${UI_CHRONICLE_DUNGEON_BOSS_KILL_STAT}" alt="" width="32" height="32" loading="lazy" />
          <div>
            <span class="chronicle-stat-lbl">首领击败</span>
            <strong class="chronicle-stat-val">${ls.dungeonBossKills} 次</strong>
          </div>
        </div>
        <div class="chronicle-stat-card chronicle-stat-card--battle-skill">
          <img class="chronicle-stat-ico" src="${UI_CHRONICLE_BATTLE_SKILL_STAT}" alt="" width="32" height="32" loading="lazy" />
          <div>
            <span class="chronicle-stat-lbl">心法领悟</span>
            <strong class="chronicle-stat-val">${ls.battleSkillPulls} 次</strong>
          </div>
        </div>
        <div class="chronicle-stat-card chronicle-stat-card--skill-level">
          <img class="chronicle-stat-ico" src="${UI_CHRONICLE_SKILL_LEVEL_STAT}" alt="" width="32" height="32" loading="lazy" />
          <div>
            <span class="chronicle-stat-lbl">三系挂机升级</span>
            <strong class="chronicle-stat-val">${ls.skillLevelUps} 次</strong>
          </div>
        </div>
        <div class="chronicle-stat-card chronicle-stat-card--spirit-array-upgrade">
          <img class="chronicle-stat-ico" src="${UI_CHRONICLE_SPIRIT_ARRAY_UPGRADE_STAT}" alt="" width="32" height="32" loading="lazy" />
          <div>
            <span class="chronicle-stat-lbl">纳灵阵图绘阵</span>
            <strong class="chronicle-stat-val">${ls.spiritArrayUpgrades} 次</strong>
          </div>
        </div>
        <div class="chronicle-stat-card">
          <span class="chronicle-stat-lbl">天机匣兑换</span>
          <strong class="chronicle-stat-val">${ls.celestialStashBuys} 次</strong>
        </div>
        <div class="chronicle-stat-card chronicle-stat-card--fortune">
          <img class="chronicle-stat-ico" src="${UI_CHRONICLE_FORTUNE_STAT}" alt="" width="32" height="32" loading="lazy" />
          <div>
            <span class="chronicle-stat-lbl">心斋卦象刷新</span>
            <strong class="chronicle-stat-val">${ls.dailyFortuneRolls} 次</strong>
          </div>
        </div>
        <div class="chronicle-stat-card chronicle-stat-card--daily-login-claim">
          <img class="chronicle-stat-ico" src="${UI_CHRONICLE_DAILY_LOGIN_STAT}" alt="" width="32" height="32" loading="lazy" />
          <div>
            <span class="chronicle-stat-lbl">灵息礼领取（日）</span>
            <strong class="chronicle-stat-val">${ls.dailyLoginDayClaims} 次</strong>
          </div>
        </div>
        <div class="chronicle-stat-card chronicle-stat-card--spirit-tide">
          <img class="chronicle-stat-ico" src="${UI_CHRONICLE_SPIRIT_TIDE_STAT}" alt="" width="32" height="32" loading="lazy" />
          <div>
            <span class="chronicle-stat-lbl">灵潮时辰</span>
            <strong class="chronicle-stat-val">${ls.spiritTideHours} 次</strong>
          </div>
        </div>
        <div class="chronicle-stat-card chronicle-stat-card--offline-adventure">
          <img class="chronicle-stat-ico" src="${UI_CHRONICLE_OFFLINE_ADVENTURE_STAT}" alt="" width="32" height="32" loading="lazy" />
          <div>
            <span class="chronicle-stat-lbl">离线奇遇结算</span>
            <strong class="chronicle-stat-val">${ls.offlineAdventureCompletions} 次</strong>
          </div>
        </div>
        <div class="chronicle-stat-card chronicle-stat-card--offline-stone-settlement">
          <img class="chronicle-stat-ico" src="${UI_CHRONICLE_OFFLINE_STONE_SETTLEMENT_STAT}" alt="" width="32" height="32" loading="lazy" />
          <div>
            <span class="chronicle-stat-lbl">离线灵石回补</span>
            <strong class="chronicle-stat-val">${ls.offlineStoneSettlements} 次</strong>
          </div>
        </div>
        <div class="chronicle-stat-card">
          <span class="chronicle-stat-lbl">蓄灵池收取</span>
          <strong class="chronicle-stat-val">${ls.spiritReservoirClaims} 次</strong>
        </div>
        <div class="chronicle-stat-card chronicle-stat-card--estate">
          <img class="chronicle-stat-ico" src="${UI_CHRONICLE_ESTATE_STAT}" alt="" width="32" height="32" loading="lazy" />
          <div>
            <span class="chronicle-stat-lbl">洞府委托完成</span>
            <strong class="chronicle-stat-val">${ls.estateCommissionCompletions} 次</strong>
          </div>
        </div>
        <div class="chronicle-stat-card chronicle-stat-card--garden-harvest">
          <img class="chronicle-stat-ico" src="${UI_CHRONICLE_GARDEN_HARVEST_STAT}" alt="" width="32" height="32" loading="lazy" />
          <div>
            <span class="chronicle-stat-lbl">灵田收获</span>
            <strong class="chronicle-stat-val">${state.spiritGarden.totalHarvests} 次</strong>
          </div>
        </div>
        <div class="chronicle-stat-card chronicle-stat-card--garden-plant">
          <img class="chronicle-stat-ico" src="${UI_CHRONICLE_GARDEN_PLANT_STAT}" alt="" width="32" height="32" loading="lazy" />
          <div>
            <span class="chronicle-stat-lbl">灵田种植</span>
            <strong class="chronicle-stat-val">${ls.gardenPlants} 次</strong>
          </div>
        </div>
        <div class="chronicle-stat-card chronicle-stat-card--resonance">
          <img class="chronicle-stat-ico" src="${UI_RESONANCE_PAYOUT_STAT}" alt="" width="32" height="32" loading="lazy" />
          <div>
            <span class="chronicle-stat-lbl">共鸣发放唤灵髓</span>
            <strong class="chronicle-stat-val">${ls.resonanceEssencePayouts} 次</strong>
          </div>
        </div>
        <div class="chronicle-stat-card chronicle-stat-card--vein-upgrade">
          <img class="chronicle-stat-ico" src="${UI_CHRONICLE_VEIN_UPGRADE_STAT}" alt="" width="32" height="32" loading="lazy" />
          <div>
            <span class="chronicle-stat-lbl">灵脉升级</span>
            <strong class="chronicle-stat-val">${ls.veinUpgrades} 次</strong>
          </div>
        </div>
        <div class="chronicle-stat-card chronicle-stat-card--tuna">
          <img class="chronicle-stat-ico" src="${UI_CHRONICLE_TUNA_STAT}" alt="" width="32" height="32" loading="lazy" />
          <div>
            <span class="chronicle-stat-lbl">吐纳成功</span>
            <strong class="chronicle-stat-val">${ls.tunaCompletions} 次</strong>
          </div>
        </div>
        <div class="chronicle-stat-card chronicle-stat-card--fentian">
          <img class="chronicle-stat-ico" src="${UI_CHRONICLE_FENTIAN_STAT}" alt="" width="32" height="32" loading="lazy" />
          <div>
            <span class="chronicle-stat-lbl">焚天成功</span>
            <strong class="chronicle-stat-val">${ls.fenTianBursts} 次</strong>
          </div>
        </div>
        <div class="chronicle-stat-card chronicle-stat-card--bi-guan">
          <img class="chronicle-stat-ico" src="${UI_CHRONICLE_BI_GUAN_STAT}" alt="" width="32" height="32" loading="lazy" />
          <div>
            <span class="chronicle-stat-lbl">闭关推进</span>
            <strong class="chronicle-stat-val">${ls.biGuanCompletions} 次</strong>
          </div>
        </div>
        <div class="chronicle-stat-card">
          <span class="chronicle-stat-lbl">周常单周清满</span>
          <strong class="chronicle-stat-val">${ls.weeklyBountyFullWeeks} 次</strong>
        </div>
        <div class="chronicle-stat-card chronicle-stat-card--meta-upgrade">
          <img class="chronicle-stat-ico" src="${UI_CHRONICLE_META_UPGRADE_STAT}" alt="" width="32" height="32" loading="lazy" />
          <div>
            <span class="chronicle-stat-lbl">轮回元强化</span>
            <strong class="chronicle-stat-val">${ls.metaUpgrades} 次</strong>
          </div>
        </div>
        <div class="chronicle-stat-card">
          <span class="chronicle-stat-lbl">当前灵石</span>
          <strong class="chronicle-stat-val">${fmtDecimal(stones(state))}</strong>
        </div>
      </div>
      <h3 class="sub-h chronicle-sub-h">最近灵卡唤引</h3>
      <div class="chronicle-table-wrap">
        <table class="chronicle-table" aria-label="灵卡唤引记录">
          <thead><tr><th>时间</th><th>灵卡</th><th>稀有度</th></tr></thead>
          ${cardTableBody}
        </table>
      </div>
      <h3 class="sub-h chronicle-sub-h chronicle-sub-h--gear">
        <img class="chronicle-gear-deco" src="${UI_GEAR_CHRONICLE_DECO}" alt="" width="26" height="26" loading="lazy" />
        最近铸灵
      </h3>
      <div class="chronicle-table-wrap">
        <table class="chronicle-table chronicle-table--gear" aria-label="铸灵记录">
          <thead><tr><th>时间</th><th>装备</th><th>稀有度</th></tr></thead>
          ${gearTableBody}
        </table>
      </div>
    </section>`;
}
