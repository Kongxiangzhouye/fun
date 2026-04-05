import type { GameState } from "./types";

let ctx: AudioContext | null = null;

export function getAudioContext(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (!ctx) ctx = new AudioContext();
  return ctx;
}

export async function resumeAudioContext(): Promise<void> {
  const c = getAudioContext();
  if (c?.state === "suspended") await c.resume();
}

/** 0–1，已考虑静音与边界 */
export function effectiveMasterVolume(state: GameState): number {
  if (state.uiPrefs.soundMuted) return 0;
  return normalizeVol(state.uiPrefs.masterVolume);
}

function normalizeVol(v: number | undefined): number {
  if (v == null || !Number.isFinite(v)) return 0.85;
  return Math.max(0, Math.min(1, v));
}

/** 短促 UI 提示音（Web Audio，无外部资源） */
export function playUiBlip(state: GameState): void {
  const gain = effectiveMasterVolume(state);
  if (gain <= 0) return;
  const c = getAudioContext();
  if (!c) return;
  void resumeAudioContext().then(() => {
    const o = c.createOscillator();
    const g = c.createGain();
    o.type = "sine";
    o.frequency.value = 880;
    const t0 = c.currentTime;
    g.gain.setValueAtTime(0, t0);
    g.gain.linearRampToValueAtTime(0.11 * gain, t0 + 0.018);
    g.gain.linearRampToValueAtTime(0, t0 + 0.09);
    o.connect(g);
    g.connect(c.destination);
    o.start(t0);
    o.stop(t0 + 0.1);
  });
}
