import type { GameState } from "./types";
import { CARDS, getCard } from "./data/cards";
import { ALL_PET_IDS } from "./data/pets";
import { addStones } from "./stones";

export interface AchievementDef {
  id: string;
  title: string;
  desc: string;
  rewardStones: number;
  /** 唤灵髓 */
  rewardEssence: number;
}

export const ACHIEVEMENTS: AchievementDef[] = [
  {
    id: "first_pull",
    title: "初次祈愿",
    desc: "完成第 1 次唤引",
    rewardStones: 50,
    rewardEssence: 0,
  },
  {
    id: "pulls_50",
    title: "祈愿常客",
    desc: "累计唤引 50 次",
    rewardStones: 200,
    rewardEssence: 18,
  },
  {
    id: "pulls_200",
    title: "万象所归",
    desc: "累计唤引 200 次",
    rewardStones: 800,
    rewardEssence: 50,
  },
  {
    id: "realm_10",
    title: "筑基有成",
    desc: "境界达到 10",
    rewardStones: 300,
    rewardEssence: 0,
  },
  {
    id: "realm_30",
    title: "金丹初凝",
    desc: "境界达到 30",
    rewardStones: 2000,
    rewardEssence: 35,
  },
  {
    id: "codex_half",
    title: "图鉴过半",
    desc: "解锁半数以上灵卡",
    rewardStones: 500,
    rewardEssence: 35,
  },
  {
    id: "first_ur",
    title: "天命所归",
    desc: "获得任意 UR 灵卡",
    rewardStones: 1000,
    rewardEssence: 35,
  },
  {
    id: "rein_1",
    title: "轮回一梦",
    desc: "完成 1 次轮回",
    rewardStones: 0,
    rewardEssence: 80,
  },
  {
    id: "pulls_100",
    title: "百抽之约",
    desc: "累计祈愿 100 次",
    rewardStones: 400,
    rewardEssence: 35,
  },
  {
    id: "pulls_500",
    title: "千愿其一",
    desc: "累计祈愿 500 次",
    rewardStones: 2200,
    rewardEssence: 120,
  },
  {
    id: "realm_20",
    title: "道台初筑",
    desc: "境界达到 20",
    rewardStones: 900,
    rewardEssence: 18,
  },
  {
    id: "realm_50",
    title: "洞虚有象",
    desc: "境界达到 50",
    rewardStones: 12000,
    rewardEssence: 80,
  },
  {
    id: "first_ssr",
    title: "霞光初遇",
    desc: "获得任意 SSR 灵卡",
    rewardStones: 600,
    rewardEssence: 18,
  },
  {
    id: "codex_full",
    title: "万象归一",
    desc: "图鉴邂逅全部灵卡",
    rewardStones: 8000,
    rewardEssence: 150,
  },
  {
    id: "rein_3",
    title: "三生尘劫",
    desc: "累计完成 3 次轮回",
    rewardStones: 1500,
    rewardEssence: 90,
  },
  {
    id: "rein_5",
    title: "五世灯传",
    desc: "累计完成 5 次轮回",
    rewardStones: 4000,
    rewardEssence: 150,
  },
  {
    id: "streak_7",
    title: "七日恒心",
    desc: "登录连签达到 7 天",
    rewardStones: 350,
    rewardEssence: 50,
  },
  {
    id: "pet_first_feed",
    title: "灵契初结",
    desc: "在唤灵池结缘任意灵宠",
    rewardStones: 120,
    rewardEssence: 25,
  },
];

function hasUr(state: GameState): boolean {
  for (const id of Object.keys(state.owned)) {
    const c = getCard(id);
    if (c?.rarity === "UR") return true;
  }
  return false;
}

function anyPetOwned(state: GameState): boolean {
  for (const id of ALL_PET_IDS) {
    if (state.pets[id]) return true;
  }
  return false;
}

function hasSsr(state: GameState): boolean {
  for (const id of Object.keys(state.owned)) {
    const c = getCard(id);
    if (c?.rarity === "SSR") return true;
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
      return state.codexUnlocked.size >= half;
    case "first_ur":
      return hasUr(state);
    case "rein_1":
      return state.reincarnations >= 1;
    case "pulls_100":
      return state.totalPulls >= 100;
    case "pulls_500":
      return state.totalPulls >= 500;
    case "realm_20":
      return state.realmLevel >= 20;
    case "realm_50":
      return state.realmLevel >= 50;
    case "first_ssr":
      return hasSsr(state);
    case "codex_full":
      return state.codexUnlocked.size >= CARDS.length;
    case "rein_3":
      return state.reincarnations >= 3;
    case "rein_5":
      return state.reincarnations >= 5;
    case "streak_7":
      return state.dailyStreak >= 7;
    case "pet_first_feed":
      return anyPetOwned(state);
    default:
      return false;
  }
}

/** 供主界面展示醒目成就弹窗（由 gameLoop / 操作逻辑写入） */
let achievementToastQueue: AchievementDef[] = [];

export function drainAchievementToastQueue(): AchievementDef[] {
  const out = achievementToastQueue;
  achievementToastQueue = [];
  return out;
}

export function tryCompleteAchievements(state: GameState): AchievementDef[] {
  const newly: AchievementDef[] = [];
  for (const a of ACHIEVEMENTS) {
    if (state.achievementsDone.has(a.id)) continue;
    if (checkAchievementUnlock(state, a.id)) {
      state.achievementsDone.add(a.id);
      if (a.rewardStones > 0) {
        addStones(state, a.rewardStones);
      }
      state.summonEssence += a.rewardEssence;
      if (a.id === "codex_full") {
        state.zaoHuaYu += 15;
      }
      newly.push(a);
      achievementToastQueue.push(a);
    }
  }
  return newly;
}
