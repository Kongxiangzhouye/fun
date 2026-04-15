import type { GameState } from "./types";

/**
 * 关闭会替玩家持续消耗资源或做非透明决策的自动项（读档/轮回后统一口径）。
 * 保留纯展示类偏好（动效、数字格式等）。
 */
export function disableDiscretionaryAutoProgress(state: GameState): void {
  state.qoL.autoRealm = false;
  state.qoL.autoGacha = false;
  state.qoL.autoTuna = false;
  state.autoGearForge = false;
  state.autoBossChallenge = false;
  state.uiPrefs.autoClaimSpiritReservoir = false;
  state.uiPrefs.autoHarvestSpiritGarden = false;
  state.uiPrefs.autoClaimDailyLogin = false;
  state.uiPrefs.autoClaimWeeklyBounty = false;
  state.uiPrefs.autoSettleEstateCommission = false;
  state.uiPrefs.autoRedeemCelestialStash = false;
  state.uiPrefs.autoFeedPets = false;
  state.uiPrefs.autoUpgradeSpiritArray = false;
  state.uiPrefs.autoPullBattleSkill = false;
  state.uiPrefs.autoBuyDaoMeridian = false;
  state.uiPrefs.autoUpgradeVein = false;
  state.uiPrefs.autoBuyMeta = false;
}
