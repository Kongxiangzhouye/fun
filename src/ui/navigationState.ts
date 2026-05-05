export type HubId = "character" | "cultivate" | "battle" | "estate";
export type EstateSub = "idle" | "vein" | "array" | "garden";
export type EstateIdleSub = "core" | "well" | "away";
export type BattleSub = "dungeon" | "forge";
export type CultivateSub =
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
export type CharacterSub =
  | "stats"
  | "cards"
  | "guides"
  | "settings"
  | "data"
  | "archive"
  | "meridian";

export type NavigationState = {
  activeHub: HubId;
  estateSub: EstateSub;
  estateIdleSub: EstateIdleSub;
  battleSub: BattleSub;
  cultivateSub: CultivateSub;
  characterSub: CharacterSub;
  gachaPool: "cards" | "gear";
};

export type NavigationUnlocks = {
  tabVein: boolean;
  tabGarden: boolean;
  tabSpiritArray: boolean;
  tabGear: boolean;
  tabTrain: boolean;
  tabPets: boolean;
  tabCodex: boolean;
  tabMeta: boolean;
  tabAch: boolean;
  tabBounty: boolean;
  tabChronicle: boolean;
  tabDailyLogin: boolean;
  tabCelestialStash: boolean;
  tabBattleSkills: boolean;
  tabDaoMeridian: boolean;
};

export const DEFAULT_NAVIGATION_STATE: NavigationState = {
  activeHub: "estate",
  estateSub: "idle",
  estateIdleSub: "core",
  battleSub: "dungeon",
  cultivateSub: "deck",
  characterSub: "stats",
  gachaPool: "cards",
};

export function navigationViewKey(nav: NavigationState): string {
  return `${nav.activeHub}|${nav.estateSub}|${nav.estateIdleSub}|${nav.battleSub}|${nav.cultivateSub}|${nav.characterSub}|${nav.gachaPool}`;
}

export function normalizeNavigationState(nav: NavigationState, unlocks: NavigationUnlocks): NavigationState {
  if (nav.activeHub === "estate" && nav.estateSub === "vein" && !unlocks.tabVein) nav.estateSub = "idle";
  if (nav.activeHub === "estate" && nav.estateSub === "garden" && !unlocks.tabGarden) nav.estateSub = "idle";
  if (nav.activeHub === "estate" && nav.estateSub === "array" && !unlocks.tabSpiritArray) nav.estateSub = "idle";
  if (nav.activeHub === "battle" && nav.battleSub === "forge" && !unlocks.tabGear) nav.battleSub = "dungeon";
  if (nav.activeHub === "cultivate" && !isCultivateSubUnlocked(nav.cultivateSub, unlocks)) nav.cultivateSub = "deck";
  if (nav.activeHub === "character" && nav.characterSub === "meridian" && !unlocks.tabDaoMeridian) {
    nav.characterSub = "stats";
  }
  return nav;
}

function isCultivateSubUnlocked(sub: CultivateSub, unlocks: NavigationUnlocks): boolean {
  switch (sub) {
    case "deck":
      return true;
    case "train":
      return unlocks.tabTrain;
    case "pets":
      return unlocks.tabPets;
    case "codex":
      return unlocks.tabCodex;
    case "meta":
      return unlocks.tabMeta;
    case "ach":
      return unlocks.tabAch;
    case "bounty":
      return unlocks.tabBounty;
    case "chronicle":
      return unlocks.tabChronicle;
    case "daily":
      return unlocks.tabDailyLogin;
    case "stash":
      return unlocks.tabCelestialStash;
    case "xinfa":
      return unlocks.tabBattleSkills;
  }
}
