import type { GameState } from "./types";
import { computeNextBoostHint, type NextBoostHint } from "./nextBoostHint";
const SCRIPT_ID = "ai-agent-guide-data";
const ROOT_ID = "ai-agent-guide-root";

/** 与主界面主导航一致，供自动化按名路由 */
export type AiHubId = "character" | "cultivate" | "battle" | "estate";

export interface AiAgentNavigation {
  activeHub: AiHubId;
  estateSub: "idle" | "vein" | "array" | "garden";
  estateIdleSub: "core" | "well" | "away";
  battleSub: "dungeon" | "forge";
  cultivateSub: string;
  characterSub: string;
  gachaPool: "cards" | "gear";
}

/** 单步导航：与真实 DOM 一致 */
export interface AiNavStep {
  /** 机器可读类别 */
  kind:
    | "bottom_nav"
    | "cultivate_sub"
    | "estate_sub"
    | "estate_idle_sub"
    | "battle_sub"
    | "character_sub"
    | "gacha_pool_tab"
    | "optional_jump";
  /** 优先使用的 CSS 选择器（单步） */
  selector: string;
  /** 中文说明，给人/LLM 读 */
  descriptionZh: string;
}

export interface AiActionGuide {
  /** 与 primaryAction.target / data-next-boost-target 一致 */
  target: string;
  /** 点击「下一步」浮标等价于依次执行 navSteps 后再点主控件；可先点 #btn-next-boost-jump 由游戏代为切换 Tab */
  navSteps: AiNavStep[];
  /** 执行完导航后，界面应处于的状态（用于自检：当前 navigation 是否已到位） */
  expectedNavigation: AiAgentNavigation;
  /** 最终要点击的主按钮/区域（按优先级） */
  primarySelectors: string[];
  primaryButtonIds: string[];
  /** 找不到目标时：点此与游戏内「下一步」一致，会自动切换 Tab 并滚动 */
  fallbackJumpButtonId: string;
  /** 分步中文说明（与 navSteps 同步，便于只读文本的模型） */
  stepsZh: string[];
  /** 补充说明（如 deck-panel 需点阵位去角色页升阶等） */
  notesZh: string[];
}

export interface AiPrimaryAction {
  /** 与 `[data-next-boost-target]` 一致，可配合「下一步」浮标跳转 */
  target: string;
  /** 人类可读摘要 */
  label: string;
  detail: string;
  priority: number;
  claimStyle: boolean;
}

export interface AiAgentSnapshot {
  schema: "idle-gacha-ai-agent/v2";
  generatedAtMs: number;
  /** 存档版本，便于外部脚本判断兼容性 */
  saveVersion: number;
  tutorialStep: number;
  navigation: AiAgentNavigation;
  /** 当前最高优先级可执行建议；与 UI「下一步」浮标同源 */
  nextBoostHint: NextBoostHint | null;
  /** 建议优先执行的动作（通常与 nextBoostHint 一致；新手期例外） */
  primaryAction: AiPrimaryAction | null;
  /** 可定位的操作指引：导航步骤 + 选择器 + 预期 Tab 状态 */
  actionGuide: AiActionGuide | null;
  /** 缩短决策链的静态提示（不改变数值） */
  loopHints: string[];
}

export interface AiAgentFeedback {
  /** 本会话内调用 getSnapshot / 读取桥接的次数 */
  sessionReads: number;
  lastReadAtMs: number | null;
  /** 上次快照中的 primary target */
  lastPrimaryTarget: string | null;
  /** 若存在 nextBoostHint，是否与 primaryAction.target 一致 */
  hintAlignedWithPrimary: boolean | null;
}

let sessionReads = 0;
let lastReadAtMs: number | null = null;
let lastPrimaryTarget: string | null = null;
let lastHintAligned: boolean | null = null;

function recordRead(nowMs: number, snap: AiAgentSnapshot): void {
  sessionReads += 1;
  lastReadAtMs = nowMs;
  lastPrimaryTarget = snap.primaryAction?.target ?? null;
  const h = snap.nextBoostHint;
  const p = snap.primaryAction;
  if (!h || !p) lastHintAligned = null;
  else lastHintAligned = h.scrollTarget === p.target;
}

export function getAiAgentFeedback(): AiAgentFeedback {
  return {
    sessionReads,
    lastReadAtMs,
    lastPrimaryTarget,
    hintAlignedWithPrimary: lastHintAligned,
  };
}

function buildPrimaryAction(state: GameState, hint: NextBoostHint | null): AiPrimaryAction | null {
  if (state.tutorialStep !== 0) {
    return {
      target: "tutorial",
      label: "完成新手引导",
      detail: `tutorialStep=${state.tutorialStep}，请按 actionGuide.stepsZh 与界面高亮操作`,
      priority: 1000,
      claimStyle: false,
    };
  }
  if (!hint) return null;
  return {
    target: hint.scrollTarget,
    label: hint.title,
    detail: hint.detailLine,
    priority: hint.priority,
    claimStyle: hint.claimStyle,
  };
}

const LOOP_HINTS: string[] = [
  "优先处理「可领取」类（礼、悬赏、蓄灵池、涓滴），再考虑抽卡与升阶。",
  "底部主导航：`[data-hub=\"estate\"|\"cultivate\"|\"battle\"|\"character\"]`。养成子栏：`[data-cultivate-sub=\"...\"]`。",
  "灵府子栏：`[data-estate-sub=\"idle\"|\"vein\"|...\"]`；灵脉页内再分 `data-estate-idle-sub=\"core\"|\"well\"|\"away\"`。",
  "卡组页灵卡池/境界铸灵切换：`[data-gacha-pool=\"cards\"|\"gear\"]`（仅养成→卡组页存在）。",
  "找不到控件时先点 `#btn-next-boost-jump`（与「下一步」浮标相同），再读新的 actionGuide。",
];

const FALLBACK_JUMP = "btn-next-boost-jump";

function nav(
  kind: AiNavStep["kind"],
  selector: string,
  descriptionZh: string,
): AiNavStep {
  return { kind, selector, descriptionZh };
}

/** 与 `routeNextBoostNavigation` 一致：到达该指引目标时应有的界面状态 */
export function expectedNavigationForTarget(
  target: string,
  current: AiAgentNavigation,
): AiAgentNavigation {
  const n = { ...current };
  switch (target) {
    case "daily-login":
      n.activeHub = "cultivate";
      n.cultivateSub = "daily";
      break;
    case "bounty-claim":
      n.activeHub = "cultivate";
      n.cultivateSub = "bounty";
      break;
    case "spirit-reservoir":
    case "ling-sha-drip":
      n.activeHub = "estate";
      n.estateSub = "idle";
      n.estateIdleSub = "well";
      break;
    case "realm-break":
      n.activeHub = "estate";
      n.estateSub = "idle";
      n.estateIdleSub = "core";
      break;
    case "gacha-card-ten":
      n.activeHub = "cultivate";
      n.cultivateSub = "deck";
      n.gachaPool = "cards";
      break;
    case "gacha-gear-ten":
      n.activeHub = "battle";
      n.battleSub = "forge";
      n.gachaPool = "gear";
      break;
    case "battle-skill-pull":
      n.activeHub = "cultivate";
      n.cultivateSub = "xinfa";
      break;
    case "spirit-array-up":
      n.activeHub = "estate";
      n.estateSub = "array";
      break;
    case "vein-huiLing":
    case "vein-lingXi":
    case "vein-gongMing":
    case "vein-guYuan":
      n.activeHub = "estate";
      n.estateSub = "vein";
      break;
    case "meta-idleMult":
    case "meta-gachaLuck":
    case "meta-deckSlots":
    case "meta-ticketRegen":
    case "meta-stoneMult":
      n.activeHub = "cultivate";
      n.cultivateSub = "meta";
      break;
    case "dao-meridian-panel":
      n.activeHub = "character";
      n.characterSub = "meridian";
      break;
    case "deck-panel":
      n.activeHub = "cultivate";
      n.cultivateSub = "deck";
      break;
    case "rein":
      n.activeHub = "cultivate";
      n.cultivateSub = "meta";
      break;
    default:
      break;
  }
  return n;
}

function stepsFromNav(navSteps: AiNavStep[]): string[] {
  return navSteps.map((s, i) => `${i + 1}. ${s.descriptionZh}（\`${s.selector}\`）`);
}

function buildTutorialGuide(step: number): AiActionGuide {
  /** 新手期不渲染「下一步」浮标，勿用 #btn-next-boost-jump */
  const noFab = "";
  if (step === 1) {
    const navSteps: AiNavStep[] = [
      nav("optional_jump", "#btn-tutorial-claim", "在新手弹层内点击「领取新手礼包」"),
      nav("optional_jump", "#btn-tutorial-skip", "若需跳过：点击「跳过引导」"),
    ];
    return {
      target: "tutorial",
      navSteps,
      expectedNavigation: {
        activeHub: "estate",
        estateSub: "idle",
        estateIdleSub: "core",
        battleSub: "dungeon",
        cultivateSub: "deck",
        characterSub: "stats",
        gachaPool: "cards",
      },
      primarySelectors: ["#btn-tutorial-claim"],
      primaryButtonIds: ["btn-tutorial-claim", "btn-tutorial-skip"],
      fallbackJumpButtonId: noFab,
      stepsZh: [
        "1. 点击 `#btn-tutorial-claim` 领取新手礼包（或 `#btn-tutorial-skip` 跳过）",
        "2. 领取后按顶部提示前往养成→卡组",
      ],
      notesZh: ["新手弹层为 `.tutorial-modal`，盖在主界面之上", "引导期间无「下一步」浮标，需手动按 tab 导航"],
    };
  }

  const hub = (h: AiHubId, sel: string, zh: string) => nav("bottom_nav", sel, zh);
  const csub = (id: string, zh: string) => nav("cultivate_sub", `[data-cultivate-sub="${id}"]`, zh);
  const esub = (id: string, zh: string) => nav("estate_sub", `[data-estate-sub="${id}"]`, zh);
  const eidle = (id: string, zh: string) => nav("estate_idle_sub", `[data-estate-idle-sub="${id}"]`, zh);

  if (step === 2 || step === 3) {
    const navSteps: AiNavStep[] = [
      hub("cultivate", '[data-hub="cultivate"]', "底部导航点「养成」"),
      csub("deck", "页内子栏点「卡组·上阵」"),
    ];
    if (step === 3) {
      navSteps.push(nav("gacha_pool_tab", '[data-gacha-pool="cards"]', "在卡组页点「灵卡池」标签（勿选境界铸灵）"));
      navSteps.push(nav("optional_jump", "#btn-pull-1", "点「单抽」按钮完成引导抽卡"));
    }
    return {
      target: "tutorial",
      navSteps,
      expectedNavigation: expectedNavigationForTarget("gacha-card-ten", {
        activeHub: "cultivate",
        estateSub: "idle",
        estateIdleSub: "core",
        battleSub: "dungeon",
        cultivateSub: "deck",
        characterSub: "stats",
        gachaPool: "cards",
      }),
      primarySelectors: step === 3 ? ['[data-gacha-pool="cards"]', "#btn-pull-1"] : ['[data-hub="cultivate"]', '[data-cultivate-sub="deck"]'],
      primaryButtonIds: step === 3 ? ["btn-pull-1"] : [],
      fallbackJumpButtonId: noFab,
      stepsZh: stepsFromNav(navSteps),
      notesZh:
        step === 3
          ? ["步骤 3 需在卡组页切换到灵卡池后再单抽", "若界面已在卡组但看不到单抽，确认 `gachaPool` 为 cards（灵卡池标签高亮）"]
          : ["进入养成→卡组后，引导会继续到单抽"],
    };
  }

  if (step === 4 || step === 5) {
    const navSteps: AiNavStep[] = [
      hub("cultivate", '[data-hub="cultivate"]', "底部点「养成」"),
      csub("deck", "子栏点「卡组·上阵」"),
      nav("optional_jump", ".deck-slot", "点击任意空/满阵位 `.deck-slot` 打开布阵弹层"),
    ];
    return {
      target: "tutorial",
      navSteps,
      expectedNavigation: expectedNavigationForTarget("deck-panel", {
        activeHub: "cultivate",
        estateSub: "idle",
        estateIdleSub: "core",
        battleSub: "dungeon",
        cultivateSub: "deck",
        characterSub: "stats",
        gachaPool: "cards",
      }),
      primarySelectors: [".deck-slot", "#deck-slot-modal .deck-inv", "[data-inv]"],
      primaryButtonIds: [],
      fallbackJumpButtonId: noFab,
      stepsZh: stepsFromNav(navSteps),
      notesZh: [
        "步骤 5：在 `#deck-slot-modal` 弹层内点选一张卡上阵",
        "弹层 id：`#deck-slot-overlay` / `#deck-slot-modal`",
      ],
    };
  }

  if (step === 6) {
    const navSteps: AiNavStep[] = [
      hub("estate", '[data-hub="estate"]', "底部点「灵府·成长」"),
      esub("vein", "一级子栏点「洞府·长期加成」"),
      nav("optional_jump", '[data-vein]', "在洞府四线中任点一条可升级的 `[data-vein]` 按钮"),
    ];
    return {
      target: "tutorial",
      navSteps,
      expectedNavigation: expectedNavigationForTarget("vein-huiLing", {
        activeHub: "estate",
        estateSub: "vein",
        estateIdleSub: "core",
        battleSub: "dungeon",
        cultivateSub: "deck",
        characterSub: "stats",
        gachaPool: "cards",
      }),
      primarySelectors: ['[data-next-boost-target^="vein-"]', "[data-vein]"],
      primaryButtonIds: [],
      fallbackJumpButtonId: noFab,
      stepsZh: stepsFromNav(navSteps),
      notesZh: ["任意洞府线均可，选已解锁且资源足够的一项"],
    };
  }

  if (step === 7) {
    const navSteps: AiNavStep[] = [
      hub("estate", '[data-hub="estate"]', "底部点「灵府·成长」"),
      esub("idle", "一级子栏点「灵脉·境界升级」"),
      eidle("core", "二级点「修炼·破境」"),
      nav("optional_jump", "#btn-realm", "点击「破境」`#btn-realm`"),
    ];
    return {
      target: "tutorial",
      navSteps,
      expectedNavigation: expectedNavigationForTarget("realm-break", {
        activeHub: "estate",
        estateSub: "idle",
        estateIdleSub: "core",
        battleSub: "dungeon",
        cultivateSub: "deck",
        characterSub: "stats",
        gachaPool: "cards",
      }),
      primarySelectors: ['[data-next-boost-target="realm-break"]', "#btn-realm"],
      primaryButtonIds: ["btn-realm"],
      fallbackJumpButtonId: noFab,
      stepsZh: stepsFromNav(navSteps),
      notesZh: ["必须先在灵脉·境界升级 → 修炼·破境子页，才能看到破境按钮"],
    };
  }

  return {
    target: "tutorial",
    navSteps: [],
    expectedNavigation: {
      activeHub: "estate",
      estateSub: "idle",
      estateIdleSub: "core",
      battleSub: "dungeon",
      cultivateSub: "deck",
      characterSub: "stats",
      gachaPool: "cards",
    },
    primarySelectors: [],
    primaryButtonIds: [],
    fallbackJumpButtonId: noFab,
    stepsZh: ["未知 tutorialStep，请读界面 `.tutorial-hint-bar` 文案"],
    notesZh: [],
  };
}

function buildActionGuideForTarget(target: string, current: AiAgentNavigation): AiActionGuide {
  const exp = expectedNavigationForTarget(target, current);
  const jump = nav("optional_jump", `#${FALLBACK_JUMP}`, "可选：点「下一步」`#btn-next-boost-jump` 自动导航并滚动");

  const hub = (h: AiHubId) => nav("bottom_nav", `[data-hub="${h}"]`, `底部导航：${h === "estate" ? "灵府·成长" : h === "cultivate" ? "养成" : h === "battle" ? "历练·筑灵" : "角色"}`);
  const csub = (id: string, zh: string) => nav("cultivate_sub", `[data-cultivate-sub="${id}"]`, zh);
  const esub = (id: string, zh: string) => nav("estate_sub", `[data-estate-sub="${id}"]`, zh);
  const eidle = (id: string, zh: string) => nav("estate_idle_sub", `[data-estate-idle-sub="${id}"]`, zh);
  const bsub = (id: string, zh: string) => nav("battle_sub", `[data-battle-sub="${id}"]`, zh);
  const chsub = (id: string, zh: string) => nav("character_sub", `[data-character-sub="${id}"]`, zh);
  const gpool = (pool: "cards" | "gear") =>
    nav("gacha_pool_tab", `[data-gacha-pool="${pool}"]`, pool === "cards" ? "卡组页点「灵卡池」" : "卡组页点「境界铸灵」");

  switch (target) {
    case "daily-login": {
      const navSteps = [hub("cultivate"), csub("daily", "子栏点「灵息·日历」"), jump];
      return {
        target,
        navSteps,
        expectedNavigation: exp,
        primarySelectors: ['[data-next-boost-target="daily-login"]', "#btn-daily-login-claim"],
        primaryButtonIds: ["btn-daily-login-claim"],
        fallbackJumpButtonId: FALLBACK_JUMP,
        stepsZh: stepsFromNav(navSteps),
        notesZh: [".daily-login-panel 内领取按钮"],
      };
    }
    case "bounty-claim": {
      const navSteps = [hub("cultivate"), csub("bounty", "子栏点「周常·悬赏」"), jump];
      return {
        target,
        navSteps,
        expectedNavigation: exp,
        primarySelectors: ['[data-next-boost-target="bounty-claim"]', "#btn-bounty-claim-all"],
        primaryButtonIds: ["btn-bounty-claim-all"],
        fallbackJumpButtonId: FALLBACK_JUMP,
        stepsZh: stepsFromNav(navSteps),
        notesZh: [],
      };
    }
    case "spirit-reservoir": {
      const navSteps = [hub("estate"), esub("idle", "一级「灵脉·境界升级」"), eidle("well", "二级「蓄灵·卦象」"), jump];
      return {
        target,
        navSteps,
        expectedNavigation: exp,
        primarySelectors: ['[data-next-boost-target="spirit-reservoir"]', "#btn-spirit-reservoir-claim"],
        primaryButtonIds: ["btn-spirit-reservoir-claim"],
        fallbackJumpButtonId: FALLBACK_JUMP,
        stepsZh: stepsFromNav(navSteps),
        notesZh: ["蓄灵池在灵府→灵脉·境界升级→蓄灵·卦象"],
      };
    }
    case "ling-sha-drip": {
      const navSteps = [hub("estate"), esub("idle", "一级「灵脉·境界升级」"), eidle("well", "二级「蓄灵·卦象」"), jump];
      return {
        target,
        navSteps,
        expectedNavigation: exp,
        primarySelectors: ['[data-next-boost-target="ling-sha-drip"]', "#btn-idle-ling-sha-drip-claim"],
        primaryButtonIds: ["btn-idle-ling-sha-drip-claim"],
        fallbackJumpButtonId: FALLBACK_JUMP,
        stepsZh: stepsFromNav(navSteps),
        notesZh: [],
      };
    }
    case "realm-break": {
      const navSteps = [hub("estate"), esub("idle", "一级「灵脉·境界升级」"), eidle("core", "二级「修炼·破境」"), jump];
      return {
        target,
        navSteps,
        expectedNavigation: exp,
        primarySelectors: ['[data-next-boost-target="realm-break"]', "#btn-realm"],
        primaryButtonIds: ["btn-realm"],
        fallbackJumpButtonId: FALLBACK_JUMP,
        stepsZh: stepsFromNav(navSteps),
        notesZh: [],
      };
    }
    case "gacha-card-ten": {
      const navSteps = [hub("cultivate"), csub("deck", "子栏「卡组·上阵」"), gpool("cards"), jump];
      return {
        target,
        navSteps,
        expectedNavigation: exp,
        primarySelectors: ['[data-next-boost-target="gacha-card-ten"]', "#btn-pull-10"],
        primaryButtonIds: ["btn-pull-10"],
        fallbackJumpButtonId: FALLBACK_JUMP,
        stepsZh: stepsFromNav(navSteps),
        notesZh: ["十连前务必切换到灵卡池标签（非境界铸灵）"],
      };
    }
    case "gacha-gear-ten": {
      const navSteps = [hub("battle"), bsub("forge", "子栏「境界·铸灵」"), jump];
      return {
        target,
        navSteps,
        expectedNavigation: exp,
        primarySelectors: ['[data-next-boost-target="gacha-gear-ten"]', "#btn-pull-gear-10"],
        primaryButtonIds: ["btn-pull-gear-10"],
        fallbackJumpButtonId: FALLBACK_JUMP,
        stepsZh: stepsFromNav(navSteps),
        notesZh: ["历练→筑灵页的境界铸灵，与养成页抽卡不同入口"],
      };
    }
    case "battle-skill-pull": {
      const navSteps = [hub("cultivate"), csub("xinfa", "子栏「心法·领悟」"), jump];
      return {
        target,
        navSteps,
        expectedNavigation: exp,
        primarySelectors: ['[data-next-boost-target="battle-skill-pull"]', "#btn-pull-battle-skill"],
        primaryButtonIds: ["btn-pull-battle-skill"],
        fallbackJumpButtonId: FALLBACK_JUMP,
        stepsZh: stepsFromNav(navSteps),
        notesZh: [],
      };
    }
    case "spirit-array-up": {
      const navSteps = [hub("estate"), esub("array", "一级「阵图·纳灵」"), jump];
      return {
        target,
        navSteps,
        expectedNavigation: exp,
        primarySelectors: ['[data-next-boost-target="spirit-array-up"]', "#btn-spirit-array-up"],
        primaryButtonIds: ["btn-spirit-array-up"],
        fallbackJumpButtonId: FALLBACK_JUMP,
        stepsZh: stepsFromNav(navSteps),
        notesZh: [],
      };
    }
    case "dao-meridian-panel": {
      const navSteps = [hub("character"), chsub("meridian", "子栏「道韵·灵窍」"), jump];
      return {
        target,
        navSteps,
        expectedNavigation: exp,
        primarySelectors: ['[data-next-boost-target="dao-meridian-panel"]', "#btn-dao-meridian-buy"],
        primaryButtonIds: ["btn-dao-meridian-buy"],
        fallbackJumpButtonId: FALLBACK_JUMP,
        stepsZh: stepsFromNav(navSteps),
        notesZh: [],
      };
    }
    case "rein": {
      const navSteps = [hub("cultivate"), csub("meta", "子栏「轮回·永久强化」"), jump];
      return {
        target,
        navSteps,
        expectedNavigation: exp,
        primarySelectors: ['[data-next-boost-target="rein"]', "#btn-rein"],
        primaryButtonIds: ["btn-rein"],
        fallbackJumpButtonId: FALLBACK_JUMP,
        stepsZh: stepsFromNav(navSteps),
        notesZh: ["轮回为危险操作，若开启确认需二次确认"],
      };
    }
    case "deck-panel": {
      const navSteps = [hub("cultivate"), csub("deck", "子栏「卡组·上阵」"), jump];
      return {
        target,
        navSteps,
        expectedNavigation: exp,
        primarySelectors: [
          '[data-next-boost-target="deck-panel"]',
          "#deck-panel-root",
          ".deck-slot",
          '[data-character-sub="cards"]',
        ],
        primaryButtonIds: [],
        fallbackJumpButtonId: FALLBACK_JUMP,
        stepsZh: stepsFromNav(navSteps),
        notesZh: [
          "「灵卡可升阶」时：升阶在「角色→灵卡」仓库内操作，或点卡组阵位打开弹层",
          "若只见卡组不见升阶按钮，请切到角色→卡牌·仓库，点选卡牌后升阶",
        ],
      };
    }
    default:
      break;
  }

  if (target.startsWith("vein-")) {
    const kind = target.slice("vein-".length);
    const navSteps = [hub("estate"), esub("vein", "一级「洞府·长期加成」"), jump];
    return {
      target,
      navSteps,
      expectedNavigation: exp,
      primarySelectors: [`[data-next-boost-target="${target}"]`, `[data-vein="${kind}"]`],
      primaryButtonIds: [],
      fallbackJumpButtonId: FALLBACK_JUMP,
      stepsZh: stepsFromNav(navSteps),
      notesZh: [`洞府线 ${kind}：点对应 data-vein 按钮`],
    };
  }

  if (target.startsWith("meta-")) {
    const key = target.slice("meta-".length);
    const navSteps = [hub("cultivate"), csub("meta", "子栏「轮回·永久强化」"), jump];
    return {
      target,
      navSteps,
      expectedNavigation: exp,
      primarySelectors: [`[data-next-boost-target="${target}"]`, `[data-meta="${key}"]`],
      primaryButtonIds: [],
      fallbackJumpButtonId: FALLBACK_JUMP,
      stepsZh: stepsFromNav(navSteps),
      notesZh: [`元强化项 ${key}`],
    };
  }

  return {
    target,
    navSteps: [jump],
    expectedNavigation: exp,
    primarySelectors: [`[data-next-boost-target="${target}"]`],
    primaryButtonIds: [],
    fallbackJumpButtonId: FALLBACK_JUMP,
    stepsZh: [`1. 尝试 \`[data-next-boost-target="${target}"]\` 2. 或点 #${FALLBACK_JUMP}`],
    notesZh: [],
  };
}

function buildActionGuide(
  state: GameState,
  primary: AiPrimaryAction | null,
  hint: NextBoostHint | null,
  currentNav: AiAgentNavigation,
): AiActionGuide | null {
  if (state.tutorialStep !== 0) {
    return buildTutorialGuide(state.tutorialStep);
  }
  if (!primary || !hint) return null;
  return buildActionGuideForTarget(primary.target, currentNav);
}

export function buildAiAgentSnapshot(
  state: GameState,
  nowMs: number,
  cardPool: number,
  nav: AiAgentNavigation,
): AiAgentSnapshot {
  const hint = computeNextBoostHint(state, nowMs, cardPool);
  const primary = buildPrimaryAction(state, hint);
  const actionGuide = buildActionGuide(state, primary, hint, nav);
  return {
    schema: "idle-gacha-ai-agent/v2",
    generatedAtMs: nowMs,
    saveVersion: state.version,
    tutorialStep: state.tutorialStep,
    navigation: nav,
    nextBoostHint: hint,
    primaryAction: primary,
    actionGuide,
    loopHints: LOOP_HINTS,
  };
}

function snapshotJson(snap: AiAgentSnapshot): string {
  return JSON.stringify(snap);
}

/** 嵌入 HTML 时避免 `</script>` 截断 */
function jsonForScriptEmbed(snap: AiAgentSnapshot): string {
  return snapshotJson(snap).replace(/</g, "\\u003c");
}

/** 供 DOM 解析：隐藏 script[type="application/json"] + data 属性 */
export function renderAiAgentHiddenMarkup(snap: AiAgentSnapshot): string {
  const primary = snap.primaryAction?.target ?? "";
  const priLabel = snap.primaryAction?.label ?? "";
  const tut = String(snap.tutorialStep);
  const ag = snap.actionGuide;
  const firstSel = ag?.primarySelectors[0] ?? "";
  const json = jsonForScriptEmbed(snap);
  return `
<div id="${ROOT_ID}" class="ai-agent-guide-root" aria-hidden="true"
  data-ai-schema="${snap.schema}"
  data-ai-tutorial-step="${tut}"
  data-ai-primary-target="${escapeAttr(primary)}"
  data-ai-primary-label="${escapeAttr(priLabel)}"
  data-ai-first-selector="${escapeAttr(firstSel)}"
  data-ai-hub="${snap.navigation.activeHub}"
  data-ai-cultivate-sub="${snap.navigation.cultivateSub}"
  data-ai-estate-sub="${snap.navigation.estateSub}"
></div>
<script type="application/json" id="${SCRIPT_ID}">${json}</script>`.trim();
}

function escapeAttr(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");
}

export type IdleGachaAiBridge = {
  getSnapshot: () => AiAgentSnapshot;
  getFeedback: () => AiAgentFeedback;
  /** 自动化轮询时可调用，用于累计 sessionReads 并刷新对齐统计 */
  markRead: () => void;
};

let lastSnap: AiAgentSnapshot | null = null;

export function installAiAgentBridge(snap: AiAgentSnapshot): void {
  lastSnap = snap;
  const w = window as unknown as { __IDLE_GACHA_AI__?: IdleGachaAiBridge };
  const bridge: IdleGachaAiBridge = {
    getSnapshot: () => {
      if (!lastSnap) throw new Error("ai agent snapshot not ready");
      recordRead(Date.now(), lastSnap);
      return lastSnap;
    },
    getFeedback: () => getAiAgentFeedback(),
    markRead: () => {
      if (!lastSnap) return;
      recordRead(Date.now(), lastSnap);
    },
  };
  w.__IDLE_GACHA_AI__ = bridge;

  if (typeof window.dispatchEvent === "function") {
    try {
      window.dispatchEvent(new CustomEvent<AiAgentSnapshot>("idle-gacha-ai-snapshot", { detail: snap }));
    } catch {
      /* ignore */
    }
  }
}

/** 单元测试或外部脚本：直接从页面读取 JSON */
export function readAiSnapshotFromDocument(): AiAgentSnapshot | null {
  const el = document.getElementById(SCRIPT_ID);
  if (!el || el.textContent == null || el.textContent.trim() === "") return null;
  try {
    return JSON.parse(el.textContent) as AiAgentSnapshot;
  } catch {
    return null;
  }
}

/** 局部刷新（如仅更新「下一步」浮标）时同步隐藏 JSON，避免与 window 桥接漂移 */
export function updateAiAgentGuideDom(snap: AiAgentSnapshot): void {
  installAiAgentBridge(snap);
  const root = document.getElementById(ROOT_ID);
  if (root) {
    const primary = snap.primaryAction?.target ?? "";
    const priLabel = snap.primaryAction?.label ?? "";
    const firstSel = snap.actionGuide?.primarySelectors[0] ?? "";
    root.dataset.aiSchema = snap.schema;
    root.dataset.aiTutorialStep = String(snap.tutorialStep);
    root.dataset.aiPrimaryTarget = primary;
    root.dataset.aiPrimaryLabel = priLabel;
    root.dataset.aiFirstSelector = firstSel;
    root.dataset.aiHub = snap.navigation.activeHub;
    root.dataset.aiCultivateSub = snap.navigation.cultivateSub;
    root.dataset.aiEstateSub = snap.navigation.estateSub;
  }
  const scr = document.getElementById(SCRIPT_ID);
  if (scr) scr.textContent = snapshotJson(snap);
}
