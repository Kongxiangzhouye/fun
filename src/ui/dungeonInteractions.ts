import type { GameState } from "../types";

/** 避免每次全页 render 时对同一节点重复 addEventListener（会导致多次 confirm / 行为异常） */
let dungeonInteractionAbort: AbortController | null = null;

/** 原生 confirm 在部分 WebView 中与整页 innerHTML 重绘冲突，会一闪即关；确认层挂在 body、在 #app 之外 */
let dungeonEnterConfirmEl: HTMLElement | null = null;
let dungeonEnterConfirmAbort: AbortController | null = null;

/** 关闭进本确认层（例如打开新一层前） */
function dismissDungeonEnterConfirm(): void {
  dungeonEnterConfirmAbort?.abort();
  dungeonEnterConfirmAbort = null;
  dungeonEnterConfirmEl?.remove();
  dungeonEnterConfirmEl = null;
}

function showDungeonEnterConfirm(wave: number, onConfirm: () => void): void {
  dismissDungeonEnterConfirm();
  const w = Math.max(1, Math.floor(wave));
  dungeonEnterConfirmAbort = new AbortController();
  const { signal } = dungeonEnterConfirmAbort;

  const overlay = document.createElement("div");
  overlay.className = "dungeon-enter-confirm-overlay";
  overlay.setAttribute("role", "dialog");
  overlay.setAttribute("aria-modal", "true");
  overlay.setAttribute("aria-labelledby", "dungeon-enter-confirm-title");
  overlay.innerHTML = `
    <div class="dungeon-enter-confirm-modal panel">
      <p class="dungeon-enter-confirm-msg" id="dungeon-enter-confirm-title">确认进入第 <strong>${w}</strong> 关？</p>
      <div class="dungeon-enter-confirm-actions">
        <button type="button" class="btn" id="dungeon-enter-confirm-cancel">取消</button>
        <button type="button" class="btn btn-primary" id="dungeon-enter-confirm-ok">确认</button>
      </div>
    </div>`;
  dungeonEnterConfirmEl = overlay;
  document.body.appendChild(overlay);

  const ok = (): void => {
    dismissDungeonEnterConfirm();
    onConfirm();
  };
  const cancel = (): void => dismissDungeonEnterConfirm();

  overlay.querySelector("#dungeon-enter-confirm-ok")?.addEventListener("click", ok, { signal });
  overlay.querySelector("#dungeon-enter-confirm-cancel")?.addEventListener("click", cancel, { signal });
  overlay.addEventListener(
    "click",
    (e) => {
      if (e.target === overlay) cancel();
    },
    { signal },
  );
  document.addEventListener(
    "keydown",
    (e) => {
      if (e.key === "Escape") cancel();
    },
    { signal },
  );
}

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
    dungeonBossPrepSnapshot,
    requestBossChallenge,
  } = deps;

  dungeonInteractionAbort?.abort();
  dungeonInteractionAbort = new AbortController();
  const { signal } = dungeonInteractionAbort;

  const readEntryWave = (): number => {
    const inp = document.getElementById("dungeon-entry-wave") as HTMLInputElement | null;
    const raw = inp?.valueAsNumber;
    const d = state.dungeon;
    const cap = dungeonFrontierWave(state);
    if (raw == null || !Number.isFinite(raw)) return Math.max(1, Math.min(cap, d.entryWave));
    return Math.max(1, Math.min(cap, Math.floor(raw)));
  };

  document.body.addEventListener(
    "click",
    (ev) => {
      const t = ev.target as HTMLElement | null;
      if (!t) return;

      if (t.closest("#btn-dungeon-entry-frontier")) {
        const n = dungeonFrontierWave(state);
        const inp = document.getElementById("dungeon-entry-wave") as HTMLInputElement | null;
        if (inp) inp.value = String(n);
        state.dungeon.entryWave = n;
        save();
        render();
        return;
      }

      if (t.closest("#btn-dungeon-enter")) {
        const btn = document.getElementById("btn-dungeon-enter") as HTMLButtonElement | null;
        if (btn?.disabled) return;
        const w = readEntryWave();
        state.dungeon.entryWave = w;
        const now = nowMs();
        if (!canEnterDungeon(state, now)) {
          toast("当前无法进入：冷却中或仍在副本内。");
          return;
        }
        if (!canEnterAtWave(state, w)) {
          toast("无法从该波进入：已超过当前可推进范围，或该波不可选。");
          return;
        }
        showDungeonEnterConfirm(w, () => {
          if (enterDungeon(state, w)) {
            save();
            toast(`已进入幻域（自第 ${w} 波）`);
            render();
          } else {
            toast("无法进入副本（冷却或其它限制）");
          }
        });
        return;
      }

      if (t.closest("#btn-sanctuary-portal")) {
        const btn = document.getElementById("btn-sanctuary-portal") as HTMLButtonElement | null;
        if (btn?.disabled) return;
        const now = nowMs();
        const w = state.dungeonPortalTargetWave;
        if (!state.dungeonSanctuaryMode || state.dungeon.active || w < 1) return;
        const pmax = playerMaxHp(state);
        if (state.combatHpCurrent < pmax - 0.25) {
          toast("灵息未满");
          return;
        }
        if (!canEnterDungeon(state, now) || !canEnterAtWave(state, w)) {
          toast("当前无法进入该关卡。");
          return;
        }
        showDungeonEnterConfirm(w, () => {
          if (enterDungeon(state, w)) {
            setActiveHubBattle();
            save();
            toast(`已进入第 ${w} 关`);
            render();
          } else {
            toast("无法进入副本");
          }
        });
        return;
      }

      if (t.closest("#btn-dungeon-challenge-boss")) {
        const bossBtn = document.getElementById("btn-dungeon-challenge-boss") as HTMLButtonElement | null;
        if (bossBtn?.disabled) return;
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
        return;
      }

      if (t.closest("#btn-dungeon-boss-next-entry")) {
        state.dungeonDeferBoss = false;
        save();
        toast("已切换为首领战：下次进入该波将面对首领。");
        render();
      }
    },
    { signal },
  );

  document.body.addEventListener(
    "change",
    (e) => {
      const el = e.target as HTMLInputElement | null;
      if (!el || el.id !== "sanctuary-auto-enter") return;
      state.dungeonSanctuaryAutoEnter = el.checked;
      save();
      render();
    },
    { signal },
  );

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
  document.body.addEventListener(
    "pointerup",
    (e) => {
      const t = e.target as HTMLElement | null;
      if (!t?.closest("#dungeon-live-root")) return;
      onDungeonLivePointerUp(e);
    },
    { signal },
  );
}
