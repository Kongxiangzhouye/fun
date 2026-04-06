import Decimal from "decimal.js";
import type { GameState } from "../types";
import {
  chooseOfflineAdventureOption,
  offlineAdventureBoostLeftMs,
  rerollOfflineAdventureOptions,
} from "../systems/offlineAdventure";
import {
  claimAllCompletableWeeklyBounties,
  claimWeeklyBountyMilestone,
  claimWeeklyBountyTask,
  formatWeeklyBountyFeedbackLine,
  weeklyBountyFeedbackState,
  weeklyBountyNextAction,
} from "../systems/weeklyBounty";
import { refreshBountyPanelLiveIfVisible } from "./bountyPanel";

export interface OfflineWeeklyBinderCtx {
  state: GameState;
  getNow: () => number;
  render: () => void;
  saveGame: (s: GameState) => void;
  toast: (msg: string) => void;
  fmtDecimal: (d: Decimal) => string;
  offlineBoostRenewRuleText: () => string;
  maybeAutoSettleOfflineAdventure: (now: number, source: "loop" | "resume" | "init" | "ui") => boolean;
  tryCompleteAchievements: (s: GameState) => unknown;
  updateTopResourcePillsAndVigor: (pool: number) => void;
  totalCardsInPool: () => number;
  routeByOfflineDecision: (hub: "estate" | "battle", sub: string, targetSelector: string) => void;
  isBountyPanelVisible: () => boolean;
  playBountyClaimBurstFx: (el: HTMLElement) => void;
}

/** 离线奇遇面板与周常悬赏相关点击绑定（由 main 注入依赖，行为与内联版一致） */
export function bindOfflinePanelAndWeeklyBountyEvents(ctx: OfflineWeeklyBinderCtx): void {
  const {
    state,
    getNow,
    render,
    saveGame,
    toast,
    fmtDecimal,
    offlineBoostRenewRuleText,
    maybeAutoSettleOfflineAdventure,
    tryCompleteAchievements,
    updateTopResourcePillsAndVigor,
    totalCardsInPool,
    routeByOfflineDecision,
    isBountyPanelVisible,
    playBountyClaimBurstFx,
  } = ctx;

  document.querySelectorAll("[data-offline-choice]").forEach((el) => {
    el.addEventListener("click", () => {
      const id = (el as HTMLElement).dataset.offlineChoice;
      if (id !== "instant" && id !== "boost" && id !== "essence") return;
      const t = getNow();
      if (!chooseOfflineAdventureOption(state, id, t)) {
        toast("当前没有可结算的离线奇遇。");
        return;
      }
      tryCompleteAchievements(state);
      saveGame(state);
      if (id === "instant") {
        toast("已选择灵脉馈赠：奖励已到账。");
      } else if (id === "essence") {
        toast("已选择髓潮归元：唤灵髓与筑灵髓已到账。");
      } else {
        const leftMin = Math.ceil(offlineAdventureBoostLeftMs(state, t) / 60000);
        toast(`已选择静修余韵：挂机增益状态已更新（约 ${leftMin} 分）。${offlineBoostRenewRuleText()}`);
      }
      render();
    });
  });

  document.querySelectorAll("[data-offline-reroll]").forEach((el) => {
    el.addEventListener("click", () => {
      const t = getNow();
      const result = rerollOfflineAdventureOptions(state, t);
      if (!result.ok) {
        if (result.reason === "no_pending") toast("当前没有可重掷的离线奇遇。");
        else if (result.reason === "already_rerolled") toast("本轮离线奇遇已重掷过一次。");
        else toast(`灵石不足：重掷需 ${fmtDecimal(new Decimal(result.costStones))}。`);
        return;
      }
      saveGame(state);
      toast(`重掷完成：已消耗 ${fmtDecimal(new Decimal(result.costStones))} 灵石，并刷新三选一。`);
      render();
    });
  });

  document.querySelectorAll("[data-offline-auto-strategy]").forEach((el) => {
    el.addEventListener("click", () => {
      const strategy = (el as HTMLElement).dataset.offlineAutoStrategy;
      if (strategy !== "steady" && strategy !== "boost" && strategy !== "essence" && strategy !== "smart") return;
      const t = getNow();
      if (state.offlineAdventure.autoPolicyEnabled && state.offlineAdventure.autoPolicy === strategy) {
        state.offlineAdventure.autoPolicyEnabled = false;
        toast("离线奇遇自动结算已关闭。");
      } else {
        state.offlineAdventure.autoPolicyEnabled = true;
        state.offlineAdventure.autoPolicy = strategy;
        const strategyText =
          strategy === "boost"
            ? "增益优先"
            : strategy === "essence"
              ? "髓潮优先"
              : strategy === "smart"
                ? "智能策略"
                : "稳态优先";
        toast(`离线奇遇自动结算已开启：${strategyText}。`);
      }
      const autoSettled = maybeAutoSettleOfflineAdventure(t, "ui");
      tryCompleteAchievements(state);
      saveGame(state);
      if (autoSettled) updateTopResourcePillsAndVigor(totalCardsInPool());
      render();
    });
  });

  document.querySelectorAll("[data-offline-auto-reroll-toggle]").forEach((el) => {
    el.addEventListener("click", () => {
      state.offlineAdventure.autoRerollEnabled = !state.offlineAdventure.autoRerollEnabled;
      saveGame(state);
      toast(state.offlineAdventure.autoRerollEnabled ? "离线奇遇自动重掷已开启。" : "离线奇遇自动重掷已关闭。");
      render();
    });
  });

  document.querySelectorAll("[data-offline-auto-reroll-budget-input]").forEach((el) => {
    const input = el as HTMLInputElement;
    const apply = () => {
      const raw = Number.isFinite(Number(input.value)) ? Number(input.value) : 0;
      const budget = Math.max(0, Math.floor(raw));
      state.offlineAdventure.autoRerollBudgetStones = String(budget);
      saveGame(state);
      render();
    };
    input.addEventListener("change", apply);
    input.addEventListener("blur", apply);
  });

  document.querySelectorAll("[data-offline-go]").forEach((el) => {
    el.addEventListener("click", () => {
      const node = el as HTMLElement;
      const hub = node.dataset.offlineGoHub;
      const sub = node.dataset.offlineGoSub ?? "";
      const targetSelector = node.dataset.offlineGoTarget ?? "#offline-adventure-panel";
      if (hub !== "estate" && hub !== "battle") return;
      routeByOfflineDecision(hub, sub, targetSelector);
    });
  });

  document.querySelectorAll("[data-bounty-claim]").forEach((el) => {
    el.addEventListener("click", () => {
      const id = (el as HTMLElement).dataset.bountyClaim;
      if (!id) return;
      const t = getNow();
      if (claimWeeklyBountyTask(state, id, t)) {
        playBountyClaimBurstFx(el as HTMLElement);
        tryCompleteAchievements(state);
        saveGame(state);
        const fb = weeklyBountyFeedbackState(state, t);
        toast(`悬赏奖励已领取（${formatWeeklyBountyFeedbackLine(fb)}）`);
        updateTopResourcePillsAndVigor(totalCardsInPool());
        if (!refreshBountyPanelLiveIfVisible(state, t, isBountyPanelVisible())) {
          render();
        }
      } else {
        toast("无法领取：未达成或本周已领过。");
        if (!refreshBountyPanelLiveIfVisible(state, t, isBountyPanelVisible())) {
          render();
        }
      }
    });
  });

  document.querySelectorAll("[data-bounty-milestone-claim]").forEach((el) => {
    el.addEventListener("click", () => {
      const id = (el as HTMLElement).dataset.bountyMilestoneClaim;
      if (!id) return;
      const t = getNow();
      if (claimWeeklyBountyMilestone(state, id, t)) {
        playBountyClaimBurstFx(el as HTMLElement);
        tryCompleteAchievements(state);
        saveGame(state);
        const fb = weeklyBountyFeedbackState(state, t);
        toast(`里程奖励已领取（${formatWeeklyBountyFeedbackLine(fb)}）`);
        updateTopResourcePillsAndVigor(totalCardsInPool());
        if (!refreshBountyPanelLiveIfVisible(state, t, isBountyPanelVisible())) {
          render();
        }
      } else {
        toast("无法领取：进度不足或本周已领过。");
        if (!refreshBountyPanelLiveIfVisible(state, t, isBountyPanelVisible())) {
          render();
        }
      }
    });
  });

  document.getElementById("btn-bounty-claim-all")?.addEventListener("click", () => {
    const t = getNow();
    const trigger = document.getElementById("btn-bounty-claim-all");
    const r = claimAllCompletableWeeklyBounties(state, t);
    if (r.claimedTasks + r.claimedMilestones <= 0) {
      toast("当前没有可领取的悬赏或里程奖励。");
      if (!refreshBountyPanelLiveIfVisible(state, t, isBountyPanelVisible())) {
        render();
      }
      return;
    }
    if (trigger) playBountyClaimBurstFx(trigger);
    tryCompleteAchievements(state);
    saveGame(state);
    const fb = weeklyBountyFeedbackState(state, t);
    const next = weeklyBountyNextAction(state, t);
    toast(
      `已领取 ${r.claimedTasks} 条悬赏、${r.claimedMilestones} 档里程：灵石 +${r.rewardStones} · 唤灵髓 +${r.rewardSummonEssence} · 筑灵髓 +${r.rewardZhuLingEssence}（${formatWeeklyBountyFeedbackLine(fb)}）`,
    );
    if (next) {
      toast(`下一步建议：${next.title}（${next.progress}/${next.target}）`);
    }
    updateTopResourcePillsAndVigor(totalCardsInPool());
    if (!refreshBountyPanelLiveIfVisible(state, t, isBountyPanelVisible())) {
      render();
    }
  });
}
