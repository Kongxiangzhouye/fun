import type { GameState } from "../types";

type HubSetter = () => void;

type DungeonInteractionDeps = {
  state: GameState;
  nowMs: () => number;
  save: () => void;
  render: () => void;
  toast: (msg: string) => void;
  tryToastDungeonVictory: (msg: string) => void;
  setActiveHubBattle: HubSetter;
  canEnterDungeon: (state: GameState, now: number) => boolean;
  canEnterAtWave: (state: GameState, wave: number) => boolean;
  dungeonFrontierWave: (state: GameState) => number;
  enterDungeon: (state: GameState, wave: number) => boolean;
  playerMaxHp: (state: GameState) => number;
  tryQueueDungeonDodgeWithFeedback: () => void;
  queueDungeonSkill: (state: GameState) => void;
  queueDungeonFervor: (state: GameState) => void;
  queueDungeonFinisher: (state: GameState) => void;
  applyRunRewardChoice: (state: GameState, rewardId: string) => boolean;
  toggleRunRewardLock: (state: GameState, rewardId: string) => boolean;
  rerollRunRewardChoices: (state: GameState) => boolean;
  applyRunEventChoice: (state: GameState, optionId: string) => boolean;
  applyRunRouteChoice: (state: GameState, routeId: string) => boolean;
  dungeonBossPrepSnapshot: (state: GameState) => { canChallenge: boolean; challengeHint: string };
  requestBossChallenge: (state: GameState) => { ok: boolean; msg: string };
};

export function bindDungeonInteractions(deps: DungeonInteractionDeps): void {
  const {
    state,
    nowMs,
    save,
    render,
    toast,
    tryToastDungeonVictory,
    setActiveHubBattle,
    canEnterDungeon,
    canEnterAtWave,
    dungeonFrontierWave,
    enterDungeon,
    playerMaxHp,
    tryQueueDungeonDodgeWithFeedback,
    queueDungeonSkill,
    queueDungeonFervor,
    queueDungeonFinisher,
    applyRunRewardChoice,
    toggleRunRewardLock,
    rerollRunRewardChoices,
    applyRunEventChoice,
    applyRunRouteChoice,
    dungeonBossPrepSnapshot,
    requestBossChallenge,
  } = deps;

  const readEntryWave = (): number => {
    const inp = document.getElementById("dungeon-entry-wave") as HTMLInputElement | null;
    const raw = inp?.valueAsNumber;
    const d = state.dungeon;
    const cap = dungeonFrontierWave(state);
    if (raw == null || !Number.isFinite(raw)) return Math.max(1, Math.min(cap, d.entryWave));
    return Math.max(1, Math.min(cap, Math.floor(raw)));
  };

  document.getElementById("btn-dungeon-entry-frontier")?.addEventListener("click", () => {
    const n = dungeonFrontierWave(state);
    const inp = document.getElementById("dungeon-entry-wave") as HTMLInputElement | null;
    if (inp) inp.value = String(n);
    state.dungeon.entryWave = n;
    save();
    render();
  });

  document.getElementById("btn-dungeon-enter")?.addEventListener("click", () => {
    const w = readEntryWave();
    state.dungeon.entryWave = w;
    const now = nowMs();
    if (!canEnterDungeon(state, now) || !canEnterAtWave(state, w)) {
      toast("当前无法进入幻域行旅。");
      return;
    }
    if (enterDungeon(state, w)) {
      save();
      toast("已进入幻域行旅。");
      render();
    } else {
      toast("无法进入幻域行旅。");
    }
  });

  document.getElementById("sanctuary-auto-enter")?.addEventListener("change", (e) => {
    const el = e.target as HTMLInputElement;
    state.dungeonSanctuaryAutoEnter = el.checked;
    save();
    render();
  });

  document.getElementById("btn-sanctuary-portal")?.addEventListener("click", () => {
    const now = nowMs();
    const w = state.dungeonPortalTargetWave;
    if (!state.dungeonSanctuaryMode || state.dungeon.active || w < 1) return;
    const pmax = playerMaxHp(state);
    if (state.combatHpCurrent < pmax - 0.25) {
      toast("灵息未满。");
      return;
    }
    if (!canEnterDungeon(state, now) || !canEnterAtWave(state, w)) {
      toast("当前无法进入该关卡。");
      return;
    }
    if (enterDungeon(state, w)) {
      setActiveHubBattle();
      save();
      toast(`已进入第 ${w} 关。`);
      render();
    } else {
      toast("无法进入幻域。");
    }
  });

  const onDungeonLivePointerUp = (e: PointerEvent): void => {
    if (!state.dungeon.active) return;
    const d = state.dungeon;
    const interWaveWait = d.mobs.length === 0 && d.interWaveCooldownUntil > nowMs();
    if (interWaveWait) return;
    if (e.pointerType === "mouse" && e.button !== 0) return;
    const el = e.target as HTMLElement | null;
    if (el?.closest("button, a, input, textarea, select, label, [role='button']")) return;
    tryQueueDungeonDodgeWithFeedback();
  };
  document.getElementById("dungeon-live-root")?.addEventListener("pointerup", onDungeonLivePointerUp);

  document.getElementById("btn-dungeon-dodge")?.addEventListener("click", () => {
    tryQueueDungeonDodgeWithFeedback();
    save();
    render();
  });

  document.getElementById("btn-dungeon-skill")?.addEventListener("click", () => {
    queueDungeonSkill(state);
    save();
    render();
  });

  document.getElementById("btn-dungeon-fervor")?.addEventListener("click", () => {
    queueDungeonFervor(state);
    save();
    render();
  });

  document.getElementById("btn-dungeon-finisher")?.addEventListener("click", () => {
    queueDungeonFinisher(state);
    save();
    render();
  });

  document.querySelectorAll<HTMLElement>("[data-run-reward]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const id = btn.dataset.runReward;
      if (!id) return;
      if (applyRunRewardChoice(state, id)) {
        save();
        render();
      }
    });
  });

  document.querySelectorAll<HTMLElement>("[data-run-reward-lock]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const id = btn.dataset.runRewardLock;
      if (!id) return;
      if (toggleRunRewardLock(state, id)) {
        save();
        render();
      }
    });
  });

  document.getElementById("btn-run-reroll-rewards")?.addEventListener("click", () => {
    if (rerollRunRewardChoices(state)) {
      save();
      render();
    }
  });

  document.querySelectorAll<HTMLElement>("[data-run-event]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const id = btn.dataset.runEvent;
      if (!id) return;
      if (applyRunEventChoice(state, id)) {
        save();
        render();
      }
    });
  });

  document.querySelectorAll<HTMLElement>("[data-run-route]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const id = btn.dataset.runRoute;
      if (!id) return;
      if (applyRunRouteChoice(state, id)) {
        save();
        render();
      }
    });
  });

  document.getElementById("btn-dungeon-challenge-boss")?.addEventListener("click", () => {
    const snap = dungeonBossPrepSnapshot(state);
    if (!snap.canChallenge) {
      tryToastDungeonVictory(snap.challengeHint);
      return;
    }
    const r = requestBossChallenge(state);
    if (!r.ok) {
      tryToastDungeonVictory(r.msg);
      return;
    }
    save();
    tryToastDungeonVictory(r.msg);
    render();
  });

  document.getElementById("btn-dungeon-boss-next-entry")?.addEventListener("click", () => {
    state.dungeonDeferBoss = false;
    save();
    toast("已切换为首领战：下次进入该波将面对首领。");
    render();
  });
}
