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
  /** 成就列表左侧小装饰（铸灵系 / 训练系 / 连签等） */
  listDeco?: "forge" | "forgeEmber" | "forgeNova" | "train" | "dungeon" | "dungeonWaves" | "dungeonWavesSurge" | "login" | "bounty" | "meridian" | "pet" | "array" | "petPull" | "petPullBloom" | "reincarnation" | "garden" | "gardenBloom" | "stash" | "stashBloom" | "reservoir" | "reservoirBloom" | "fortune" | "fortuneBloom" | "vein" | "realm" | "gacha" | "codex" | "rarity";
}

export const ACHIEVEMENTS: AchievementDef[] = [
  {
    id: "first_pull",
    title: "初次祈愿",
    desc: "完成第 1 次唤引",
    rewardStones: 50,
    rewardEssence: 0,
    listDeco: "gacha",
  },
  {
    id: "pulls_50",
    title: "祈愿常客",
    desc: "累计唤引 50 次",
    rewardStones: 200,
    rewardEssence: 18,
    listDeco: "gacha",
  },
  {
    id: "pulls_200",
    title: "万象所归",
    desc: "累计唤引 200 次",
    rewardStones: 800,
    rewardEssence: 50,
    listDeco: "gacha",
  },
  {
    id: "realm_10",
    title: "筑基有成",
    desc: "境界达到 10",
    rewardStones: 300,
    rewardEssence: 0,
    listDeco: "realm",
  },
  {
    id: "realm_30",
    title: "金丹初凝",
    desc: "境界达到 30",
    rewardStones: 2000,
    rewardEssence: 35,
    listDeco: "realm",
  },
  {
    id: "codex_half",
    title: "图鉴过半",
    desc: "解锁半数以上灵卡",
    rewardStones: 500,
    rewardEssence: 35,
    listDeco: "codex",
  },
  {
    id: "first_ur",
    title: "天命所归",
    desc: "获得任意 UR 灵卡",
    rewardStones: 1000,
    rewardEssence: 35,
    listDeco: "rarity",
  },
  {
    id: "rein_1",
    title: "轮回一梦",
    desc: "完成 1 次轮回",
    rewardStones: 0,
    rewardEssence: 80,
    listDeco: "reincarnation",
  },
  {
    id: "pulls_100",
    title: "百抽之约",
    desc: "累计祈愿 100 次",
    rewardStones: 400,
    rewardEssence: 35,
    listDeco: "gacha",
  },
  {
    id: "pulls_500",
    title: "千愿其一",
    desc: "累计祈愿 500 次",
    rewardStones: 2200,
    rewardEssence: 120,
    listDeco: "gacha",
  },
  {
    id: "pulls_1000",
    title: "万愿归一",
    desc: "累计灵卡唤引 1000 次",
    rewardStones: 12000,
    rewardEssence: 200,
    listDeco: "gacha",
  },
  {
    id: "realm_20",
    title: "道台初筑",
    desc: "境界达到 20",
    rewardStones: 900,
    rewardEssence: 18,
    listDeco: "realm",
  },
  {
    id: "realm_50",
    title: "洞虚有象",
    desc: "境界达到 50",
    rewardStones: 12000,
    rewardEssence: 80,
    listDeco: "realm",
  },
  {
    id: "realm_75",
    title: "归真照影",
    desc: "境界达到 75",
    rewardStones: 20000,
    rewardEssence: 110,
    listDeco: "realm",
  },
  {
    id: "first_ssr",
    title: "霞光初遇",
    desc: "获得任意 SSR 灵卡",
    rewardStones: 600,
    rewardEssence: 18,
    listDeco: "rarity",
  },
  {
    id: "codex_full",
    title: "万象归一",
    desc: "图鉴邂逅全部灵卡",
    rewardStones: 8000,
    rewardEssence: 150,
    listDeco: "codex",
  },
  {
    id: "rein_3",
    title: "三生尘劫",
    desc: "累计完成 3 次轮回",
    rewardStones: 1500,
    rewardEssence: 90,
    listDeco: "reincarnation",
  },
  {
    id: "rein_5",
    title: "五世灯传",
    desc: "累计完成 5 次轮回",
    rewardStones: 4000,
    rewardEssence: 150,
    listDeco: "reincarnation",
  },
  {
    id: "rein_10",
    title: "十世浮灯",
    desc: "累计完成 10 次轮回",
    rewardStones: 9500,
    rewardEssence: 220,
    listDeco: "reincarnation",
  },
  {
    id: "streak_7",
    title: "副本深耕",
    desc: "在幻域副本中累计击溃 40 波",
    rewardStones: 350,
    rewardEssence: 50,
    listDeco: "dungeonWaves",
  },
  {
    id: "dungeon_waves_100",
    title: "百波斩魔",
    desc: "在幻域累计击溃 100 波",
    rewardStones: 1200,
    rewardEssence: 95,
    listDeco: "dungeonWaves",
  },
  {
    id: "dungeon_waves_500",
    title: "千波涤魔",
    desc: "在幻域累计击溃 500 波",
    rewardStones: 4200,
    rewardEssence: 155,
    listDeco: "dungeonWaves",
  },
  {
    id: "dungeon_waves_2000",
    title: "万波证道",
    desc: "在幻域累计击溃 2000 波",
    rewardStones: 9800,
    rewardEssence: 265,
    listDeco: "dungeonWavesSurge",
  },
  {
    id: "pet_first_feed",
    title: "灵契初结",
    desc: "在唤灵池结缘任意灵宠",
    rewardStones: 120,
    rewardEssence: 25,
    listDeco: "pet",
  },
  {
    id: "pet_level_30",
    title: "灵契深耕",
    desc: "任意灵宠达到 30 级",
    rewardStones: 550,
    rewardEssence: 32,
    listDeco: "pet",
  },
  {
    id: "pet_all_owned",
    title: "七灵同契",
    desc: "结缘全部灵宠",
    rewardStones: 2800,
    rewardEssence: 95,
    listDeco: "pet",
  },
  {
    id: "pet_pulls_25",
    title: "唤灵不倦",
    desc: "灵宠唤引累计 25 次",
    rewardStones: 320,
    rewardEssence: 18,
    listDeco: "petPull",
  },
  {
    id: "pet_pulls_100",
    title: "百唤灵缘",
    desc: "灵宠唤引累计 100 次",
    rewardStones: 1400,
    rewardEssence: 48,
    listDeco: "petPull",
  },
  {
    id: "pet_pulls_300",
    title: "千唤灵缘",
    desc: "灵宠唤引累计 300 次",
    rewardStones: 3800,
    rewardEssence: 95,
    listDeco: "petPullBloom",
  },
  {
    id: "garden_first_harvest",
    title: "灵田初收",
    desc: "在灵府灵田完成 1 次收获",
    rewardStones: 100,
    rewardEssence: 8,
    listDeco: "garden",
  },
  {
    id: "garden_harvest_30",
    title: "畦间熟手",
    desc: "灵田累计收获 30 次",
    rewardStones: 450,
    rewardEssence: 22,
    listDeco: "garden",
  },
  {
    id: "garden_harvest_100",
    title: "畦间老手",
    desc: "灵田累计收获 100 次",
    rewardStones: 1100,
    rewardEssence: 42,
    listDeco: "garden",
  },
  {
    id: "garden_harvest_300",
    title: "畦间千穗",
    desc: "灵田累计收获 300 次",
    rewardStones: 2800,
    rewardEssence: 72,
    listDeco: "gardenBloom",
  },
  {
    id: "login_streak_7",
    title: "灵息不辍",
    desc: "登录连签达到 7 日",
    rewardStones: 280,
    rewardEssence: 20,
    listDeco: "login",
  },
  {
    id: "login_streak_30",
    title: "灵息长明",
    desc: "登录连签达到 30 日",
    rewardStones: 1200,
    rewardEssence: 45,
    listDeco: "login",
  },
  {
    id: "login_streak_60",
    title: "灵息贯日",
    desc: "登录连签达到 60 日",
    rewardStones: 3200,
    rewardEssence: 85,
    listDeco: "login",
  },
  {
    id: "weekly_bounty_week_full_1",
    title: "悬赏初满",
    desc: "任意一周完成并领取全部周常悬赏条目",
    rewardStones: 380,
    rewardEssence: 22,
    listDeco: "bounty",
  },
  {
    id: "weekly_bounty_week_full_12",
    title: "周天不倦",
    desc: "累计 12 次单周清满周常悬赏",
    rewardStones: 2200,
    rewardEssence: 65,
    listDeco: "bounty",
  },
  {
    id: "celestial_stash_1",
    title: "天机初启",
    desc: "在天机匣完成 1 次兑换",
    rewardStones: 120,
    rewardEssence: 8,
    listDeco: "stash",
  },
  {
    id: "celestial_stash_25",
    title: "天机常顾",
    desc: "在天机匣累计兑换 25 次",
    rewardStones: 1900,
    rewardEssence: 58,
    listDeco: "stash",
  },
  {
    id: "celestial_stash_100",
    title: "天机渊市",
    desc: "在天机匣累计兑换 100 次",
    rewardStones: 5200,
    rewardEssence: 115,
    listDeco: "stashBloom",
  },
  {
    id: "spirit_reservoir_1",
    title: "蓄灵初收",
    desc: "从蓄灵池收取 1 次灵石",
    rewardStones: 150,
    rewardEssence: 0,
    listDeco: "reservoir",
  },
  {
    id: "spirit_reservoir_50",
    title: "蓄灵有成",
    desc: "从蓄灵池累计收取 50 次灵石",
    rewardStones: 900,
    rewardEssence: 35,
    listDeco: "reservoir",
  },
  {
    id: "spirit_reservoir_200",
    title: "蓄灵渊深",
    desc: "从蓄灵池累计收取 200 次灵石",
    rewardStones: 3200,
    rewardEssence: 88,
    listDeco: "reservoirBloom",
  },
  {
    id: "daily_fortune_1",
    title: "心斋有象",
    desc: "经历 1 次卦象日更替",
    rewardStones: 100,
    rewardEssence: 5,
    listDeco: "fortune",
  },
  {
    id: "daily_fortune_30",
    title: "心斋常新",
    desc: "心斋卦象累计刷新 30 次",
    rewardStones: 950,
    rewardEssence: 32,
    listDeco: "fortune",
  },
  {
    id: "daily_fortune_100",
    title: "心斋万象",
    desc: "心斋卦象累计刷新 100 次",
    rewardStones: 2800,
    rewardEssence: 78,
    listDeco: "fortuneBloom",
  },
  {
    id: "spirit_array_10",
    title: "阵图小成",
    desc: "纳灵阵图达到 10 重",
    rewardStones: 600,
    rewardEssence: 15,
    listDeco: "array",
  },
  {
    id: "spirit_array_25",
    title: "阵图大成",
    desc: "纳灵阵图达到 25 重",
    rewardStones: 1400,
    rewardEssence: 38,
    listDeco: "array",
  },
  {
    id: "spirit_array_30",
    title: "阵图圆满",
    desc: "纳灵阵图达到 30 重",
    rewardStones: 2600,
    rewardEssence: 72,
    listDeco: "array",
  },
  {
    id: "vein_gongming_40",
    title: "声应气求",
    desc: "洞府「共鸣」达到 40 级",
    rewardStones: 520,
    rewardEssence: 35,
    listDeco: "vein",
  },
  {
    id: "vein_gongming_80",
    title: "共鸣圆满",
    desc: "洞府「共鸣」达到 80 级",
    rewardStones: 2200,
    rewardEssence: 88,
    listDeco: "vein",
  },
  {
    id: "skills_triple_25",
    title: "三艺并济",
    desc: "战艺、采灵、法篆均达到 25 级",
    rewardStones: 420,
    rewardEssence: 28,
    listDeco: "train",
  },
  {
    id: "skills_triple_50",
    title: "三艺纯青",
    desc: "战艺、采灵、法篆均达到 50 级",
    rewardStones: 2400,
    rewardEssence: 72,
    listDeco: "train",
  },
  {
    id: "forge_1",
    title: "铸灵初鸣",
    desc: "完成第 1 次铸灵",
    rewardStones: 80,
    rewardEssence: 6,
    listDeco: "forge",
  },
  {
    id: "forge_50",
    title: "百锻千锤",
    desc: "累计铸灵 50 次",
    rewardStones: 400,
    rewardEssence: 28,
    listDeco: "forge",
  },
  {
    id: "forge_200",
    title: "铸灵通神",
    desc: "累计铸灵 200 次",
    rewardStones: 1800,
    rewardEssence: 85,
    listDeco: "forge",
  },
  {
    id: "forge_500",
    title: "千锻无极",
    desc: "累计铸灵 500 次",
    rewardStones: 5200,
    rewardEssence: 155,
    listDeco: "forgeEmber",
  },
  {
    id: "forge_1000",
    title: "万锻归一",
    desc: "累计铸灵 1000 次",
    rewardStones: 12000,
    rewardEssence: 320,
    listDeco: "forgeNova",
  },
  {
    id: "forge_treasure",
    title: "珍品显形",
    desc: "铸灵曾达到珍品及以上稀有度",
    rewardStones: 350,
    rewardEssence: 18,
    listDeco: "forge",
  },
  {
    id: "forge_celestial",
    title: "天工开物",
    desc: "铸灵曾达到天极稀有度",
    rewardStones: 2200,
    rewardEssence: 55,
    listDeco: "forge",
  },
  {
    id: "dao_meridian_3",
    title: "灵窍三明",
    desc: "道韵灵窍达到 3 重",
    rewardStones: 480,
    rewardEssence: 20,
    listDeco: "meridian",
  },
  {
    id: "dao_meridian_5",
    title: "灵窍贯通",
    desc: "道韵灵窍五重圆满",
    rewardStones: 1600,
    rewardEssence: 45,
    listDeco: "meridian",
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

function maxPetLevel(state: GameState): number {
  let m = 0;
  for (const id of ALL_PET_IDS) {
    const p = state.pets[id];
    if (p && p.level > m) m = p.level;
  }
  return m;
}

function allPetsOwned(state: GameState): boolean {
  return ALL_PET_IDS.every((id) => state.pets[id] != null);
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
    case "pulls_1000":
      return state.totalPulls >= 1000;
    case "realm_20":
      return state.realmLevel >= 20;
    case "realm_50":
      return state.realmLevel >= 50;
    case "realm_75":
      return state.realmLevel >= 75;
    case "first_ssr":
      return hasSsr(state);
    case "codex_full":
      return state.codexUnlocked.size >= CARDS.length;
    case "rein_3":
      return state.reincarnations >= 3;
    case "rein_5":
      return state.reincarnations >= 5;
    case "rein_10":
      return state.reincarnations >= 10;
    case "streak_7":
      return state.dungeon.totalWavesCleared >= 40;
    case "dungeon_waves_100":
      return state.dungeon.totalWavesCleared >= 100;
    case "dungeon_waves_500":
      return state.dungeon.totalWavesCleared >= 500;
    case "dungeon_waves_2000":
      return state.dungeon.totalWavesCleared >= 2000;
    case "pet_first_feed":
      return anyPetOwned(state);
    case "pet_level_30":
      return maxPetLevel(state) >= 30;
    case "pet_all_owned":
      return allPetsOwned(state);
    case "pet_pulls_25":
      return state.petPullsTotal >= 25;
    case "pet_pulls_100":
      return state.petPullsTotal >= 100;
    case "pet_pulls_300":
      return state.petPullsTotal >= 300;
    case "garden_first_harvest":
      return (state.spiritGarden?.totalHarvests ?? 0) >= 1;
    case "garden_harvest_30":
      return (state.spiritGarden?.totalHarvests ?? 0) >= 30;
    case "garden_harvest_100":
      return (state.spiritGarden?.totalHarvests ?? 0) >= 100;
    case "garden_harvest_300":
      return (state.spiritGarden?.totalHarvests ?? 0) >= 300;
    case "login_streak_7":
      return state.dailyStreak >= 7;
    case "login_streak_30":
      return state.dailyStreak >= 30;
    case "login_streak_60":
      return state.dailyStreak >= 60;
    case "weekly_bounty_week_full_1":
      return (state.lifetimeStats?.weeklyBountyFullWeeks ?? 0) >= 1;
    case "weekly_bounty_week_full_12":
      return (state.lifetimeStats?.weeklyBountyFullWeeks ?? 0) >= 12;
    case "celestial_stash_1":
      return (state.lifetimeStats?.celestialStashBuys ?? 0) >= 1;
    case "celestial_stash_25":
      return (state.lifetimeStats?.celestialStashBuys ?? 0) >= 25;
    case "celestial_stash_100":
      return (state.lifetimeStats?.celestialStashBuys ?? 0) >= 100;
    case "spirit_reservoir_1":
      return (state.lifetimeStats?.spiritReservoirClaims ?? 0) >= 1;
    case "spirit_reservoir_50":
      return (state.lifetimeStats?.spiritReservoirClaims ?? 0) >= 50;
    case "spirit_reservoir_200":
      return (state.lifetimeStats?.spiritReservoirClaims ?? 0) >= 200;
    case "daily_fortune_1":
      return (state.lifetimeStats?.dailyFortuneRolls ?? 0) >= 1;
    case "daily_fortune_30":
      return (state.lifetimeStats?.dailyFortuneRolls ?? 0) >= 30;
    case "daily_fortune_100":
      return (state.lifetimeStats?.dailyFortuneRolls ?? 0) >= 100;
    case "spirit_array_10":
      return state.spiritArrayLevel >= 10;
    case "spirit_array_25":
      return state.spiritArrayLevel >= 25;
    case "spirit_array_30":
      return state.spiritArrayLevel >= 30;
    case "vein_gongming_40":
      return state.vein.gongMing >= 40;
    case "vein_gongming_80":
      return state.vein.gongMing >= 80;
    case "skills_triple_25":
      return (
        state.skills.combat.level >= 25 &&
        state.skills.gathering.level >= 25 &&
        state.skills.arcana.level >= 25
      );
    case "skills_triple_50":
      return (
        state.skills.combat.level >= 50 &&
        state.skills.gathering.level >= 50 &&
        state.skills.arcana.level >= 50
      );
    case "forge_1":
      return (state.lifetimeStats?.gearForgesTotal ?? 0) >= 1;
    case "forge_50":
      return (state.lifetimeStats?.gearForgesTotal ?? 0) >= 50;
    case "forge_200":
      return (state.lifetimeStats?.gearForgesTotal ?? 0) >= 200;
    case "forge_500":
      return (state.lifetimeStats?.gearForgesTotal ?? 0) >= 500;
    case "forge_1000":
      return (state.lifetimeStats?.gearForgesTotal ?? 0) >= 1000;
    case "forge_treasure":
      return (state.lifetimeStats?.maxGearRarityRankForged ?? 0) >= 2;
    case "forge_celestial":
      return (state.lifetimeStats?.maxGearRarityRankForged ?? 0) >= 4;
    case "dao_meridian_3":
      return state.daoMeridian >= 3;
    case "dao_meridian_5":
      return state.daoMeridian >= 5;
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
