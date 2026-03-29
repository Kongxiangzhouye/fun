import type { GameState } from "./types";
import { CARDS, getCard } from "./data/cards";
import { countUniqueOwned } from "./state";

export interface AchievementDef {
  id: string;
  title: string;
  desc: string;
  rewardStones: number;
  rewardTickets: number;
}

export const ACHIEVEMENTS: AchievementDef[] = [
  {
    id: "first_pull",
    title: "初次祈愿",
    desc: "完成第 1 次抽卡",
    rewardStones: 50,
    rewardTickets: 0,
  },
  {
    id: "pulls_50",
    title: "祈愿常客",
    desc: "累计抽卡 50 次",
    rewardStones: 200,
    rewardTickets: 1,
  },
  {
    id: "pulls_200",
    title: "万象所归",
    desc: "累计抽卡 200 次",
    rewardStones: 800,
    rewardTickets: 3,
  },
  {
    id: "realm_10",
    title: "筑基有成",
    desc: "境界达到 10",
    rewardStones: 300,
    rewardTickets: 0,
  },
  {
    id: "realm_30",
    title: "金丹初凝",
    desc: "境界达到 30",
    rewardStones: 2000,
    rewardTickets: 2,
  },
  {
    id: "codex_half",
    title: "图鉴过半",
    desc: "解锁半数以上灵卡",
    rewardStones: 500,
    rewardTickets: 2,
  },
  {
    id: "first_ur",
    title: "天命所归",
    desc: "获得任意 UR 灵卡",
    rewardStones: 1000,
    rewardTickets: 2,
  },
  {
    id: "rein_1",
    title: "轮回一梦",
    desc: "完成 1 次轮回",
    rewardStones: 0,
    rewardTickets: 5,
  },
];

function hasUr(state: GameState): boolean {
  for (const id of Object.keys(state.owned)) {
    const c = getCard(id);
    if (c?.rarity === "UR") return true;
  }
  return false;
}

export function checkAchievementUnlock(state: GameState, id: string): boolean {
  if (state.achievementsDone.has(id)) return false;
  const half = Math.ceil(CARDS.length / 2);
  switch (id) {
    case "first_pull":
      return state.totalPulls >= 1;
    case "pulls_50":
      return state.totalPulls >= 50;
    case "pulls_200":
      return state.totalPulls >= 200;
    case "realm_10":
      return state.realmLevel >= 10;
    case "realm_30":
      return state.realmLevel >= 30;
    case "codex_half":
      return countUniqueOwned(state) >= half;
    case "first_ur":
      return hasUr(state);
    case "rein_1":
      return state.reincarnations >= 1;
    default:
      return false;
  }
}

export function tryCompleteAchievements(state: GameState): AchievementDef[] {
  const newly: AchievementDef[] = [];
  for (const a of ACHIEVEMENTS) {
    if (state.achievementsDone.has(a.id)) continue;
    if (checkAchievementUnlock(state, a.id)) {
      state.achievementsDone.add(a.id);
      state.spiritStones += a.rewardStones;
      state.tickets += a.rewardTickets;
      newly.push(a);
    }
  }
  return newly;
}
