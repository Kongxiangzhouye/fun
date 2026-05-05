import type { Application, Container, Graphics, Ticker } from "pixi.js";
import type { HubId } from "./navigationState";

export type FxPreferences = {
  reduceMotion: boolean;
};

type FxVisualState = {
  activeHub: HubId;
  totalPulls: number;
  wishResonance: number;
};

type GsapRuntime = typeof import("gsap")["gsap"];
type PixiRuntime = {
  ApplicationCtor: typeof import("pixi.js").Application;
  ContainerCtor: typeof import("pixi.js").Container;
  GraphicsCtor: typeof import("pixi.js").Graphics;
};

const reducedMotionQuery =
  typeof window !== "undefined" ? window.matchMedia("(prefers-reduced-motion: reduce)") : null;
let prefersReducedMotion = reducedMotionQuery?.matches ?? false;
let modernFxPointerBound = false;
let modernFxPointerX = 0.5;
let modernFxPointerY = 0.2;
let motionUiFxBound = false;
let mobileLiteFx = false;
let pixiFxBooted = false;
let gsapRuntime: GsapRuntime | null = null;
let gsapLoading: Promise<GsapRuntime | null> | null = null;
let pixiRuntime: PixiRuntime | null = null;
let pixiLoading: Promise<PixiRuntime | null> | null = null;
let pixiApp: Application | null = null;
let pixiLayer: Container | null = null;
type PixiParticle = { g: Graphics; vx: number; vy: number; ttl: number; life: number };
const pixiParticles: PixiParticle[] = [];

let getFxPreferences: () => FxPreferences = () => ({ reduceMotion: false });
let getFxVisualState: () => FxVisualState = () => ({ activeHub: "estate", totalPulls: 0, wishResonance: 0 });

export function configureFxLayer(options: {
  getPreferences: () => FxPreferences;
  getVisualState: () => FxVisualState;
}): void {
  getFxPreferences = options.getPreferences;
  getFxVisualState = options.getVisualState;
}

async function getGsapRuntime(): Promise<GsapRuntime | null> {
  if (gsapRuntime) return gsapRuntime;
  if (!gsapLoading) {
    gsapLoading = import("gsap")
      .then((mod) => {
        gsapRuntime = mod.gsap;
        return gsapRuntime;
      })
      .catch(() => null);
  }
  return gsapLoading;
}

async function getPixiRuntime(): Promise<PixiRuntime | null> {
  if (pixiRuntime) return pixiRuntime;
  if (!pixiLoading) {
    pixiLoading = import("pixi.js")
      .then((mod) => {
        pixiRuntime = {
          ApplicationCtor: mod.Application,
          ContainerCtor: mod.Container,
          GraphicsCtor: mod.Graphics,
        };
        return pixiRuntime;
      })
      .catch(() => null);
  }
  return pixiLoading;
}

export function motionReduced(): boolean {
  return prefersReducedMotion || getFxPreferences().reduceMotion;
}

export function setMobileLiteFx(value: boolean): void {
  mobileLiteFx = value;
}

export function isMobileLiteFx(): boolean {
  return mobileLiteFx;
}

export function loopIntervalMs(baseMs: number): number {
  if (mobileLiteFx && motionReduced()) return 160;
  if (motionReduced()) return 120;
  if (mobileLiteFx) return 80;
  return baseMs;
}

export function initPixiFxLayer(): void {
  if (typeof document === "undefined" || pixiFxBooted) return;
  pixiFxBooted = true;
  void (async () => {
    try {
      const runtime = await getPixiRuntime();
      if (!runtime) return;
      const app = new runtime.ApplicationCtor();
      await app.init({
        width: Math.max(1, window.innerWidth),
        height: Math.max(1, window.innerHeight),
        backgroundAlpha: 0,
        antialias: true,
        autoDensity: true,
        resolution: Math.min(2, window.devicePixelRatio || 1),
      });
      const canvas = app.canvas as HTMLCanvasElement;
      canvas.className = "modern-pixi-layer";
      document.body.appendChild(canvas);
      const layer = new runtime.ContainerCtor();
      app.stage.addChild(layer);
      app.ticker.add((ticker: Ticker) => {
        const deltaMs = ticker.deltaMS;
        for (let i = pixiParticles.length - 1; i >= 0; i -= 1) {
          const p = pixiParticles[i]!;
          p.life += deltaMs;
          const t = Math.min(1, p.life / p.ttl);
          p.g.x += (p.vx * deltaMs) / 16.6667;
          p.g.y += (p.vy * deltaMs) / 16.6667;
          p.g.alpha = 1 - t;
          const s = 1 + t * 0.9;
          p.g.scale.set(s, s);
          if (t >= 1) {
            p.g.removeFromParent();
            p.g.destroy();
            pixiParticles.splice(i, 1);
          }
        }
      });
      window.addEventListener(
        "resize",
        () => {
          app.renderer.resize(Math.max(1, window.innerWidth), Math.max(1, window.innerHeight));
        },
        { passive: true },
      );
      pixiApp = app;
      pixiLayer = layer;
    } catch {
      pixiApp = null;
      pixiLayer = null;
    }
  })();
}

export function emitPixiBurst(clientX: number, clientY: number, intensity: "normal" | "high" = "normal"): void {
  if (!pixiApp || !pixiLayer || motionReduced() || !pixiRuntime) return;
  const n = intensity === "high" ? 30 : 14;
  const speed = intensity === "high" ? 7.6 : 5.4;
  const palette = intensity === "high" ? [0xfff2b1, 0xffb6f8, 0x8fe8ff, 0xaac4ff] : [0x9bb8ff, 0x81d8ff, 0x9ff1d4];
  for (let i = 0; i < n; i += 1) {
    const g = new pixiRuntime.GraphicsCtor();
    const r = intensity === "high" ? 1.8 + Math.random() * 3.6 : 1.3 + Math.random() * 2.2;
    const c = palette[(Math.random() * palette.length) | 0]!;
    g.circle(0, 0, r);
    g.fill({ color: c, alpha: 0.95 });
    g.x = clientX;
    g.y = clientY;
    const a = Math.random() * Math.PI * 2;
    const mag = speed * (0.6 + Math.random() * 1.1);
    pixiLayer.addChild(g);
    pixiParticles.push({
      g,
      vx: Math.cos(a) * mag,
      vy: Math.sin(a) * mag - (intensity === "high" ? 1.8 : 0.9),
      ttl: intensity === "high" ? 720 + Math.random() * 380 : 520 + Math.random() * 260,
      life: 0,
    });
  }
}

export function bindMotionUiFx(): void {
  if (typeof document === "undefined" || motionUiFxBound) return;
  motionUiFxBound = true;
}

export function playRevealOverlayIntro(overlay: HTMLElement, liteFx: boolean): void {
  if (liteFx || motionReduced()) {
    overlay.classList.add("gacha-reveal-active");
    return;
  }
  if (!gsapRuntime) {
    void getGsapRuntime();
    overlay.classList.add("gacha-reveal-active");
    return;
  }
  const gsap = gsapRuntime;
  const content = overlay.querySelector(".gacha-reveal-content") as HTMLElement | null;
  const cards = [...overlay.querySelectorAll(".gacha-reveal-card")] as HTMLElement[];
  gsap.set(overlay, { opacity: 0 });
  if (content) gsap.set(content, { opacity: 0, y: 24, scale: 0.95, filter: "blur(8px)" });
  gsap.set(cards, { opacity: 0, y: 16, rotateX: -12, transformOrigin: "50% 100%" });
  const tl = gsap.timeline();
  tl.to(overlay, { opacity: 1, duration: 0.2, ease: "power2.out" });
  if (content) {
    tl.to(content, { opacity: 1, y: 0, scale: 1, filter: "blur(0px)", duration: 0.5, ease: "power3.out" }, 0.02);
  }
  if (cards.length > 0) {
    tl.to(cards, { opacity: 1, y: 0, rotateX: 0, duration: 0.4, stagger: 0.05, ease: "back.out(1.35)" }, 0.12);
  }
  overlay.classList.add("gacha-reveal-active");
}

export function playRevealOverlayExit(overlay: HTMLElement, liteFx: boolean, done: () => void): void {
  if (liteFx || motionReduced()) {
    window.setTimeout(done, 140);
    return;
  }
  if (!gsapRuntime) {
    void getGsapRuntime();
    window.setTimeout(done, 140);
    return;
  }
  const gsap = gsapRuntime;
  const content = overlay.querySelector(".gacha-reveal-content") as HTMLElement | null;
  gsap.to(content, {
    opacity: 0,
    y: -10,
    scale: 0.98,
    filter: "blur(4px)",
    duration: 0.22,
    ease: "power2.in",
  });
  gsap.to(overlay, {
    opacity: 0,
    duration: 0.28,
    ease: "power2.in",
    onComplete: done,
  });
}

export function bindModernFxInteraction(): void {
  if (typeof document === "undefined" || modernFxPointerBound) return;
  modernFxPointerBound = true;
  modernFxPointerX = 0.5;
  modernFxPointerY = 0.2;
  reducedMotionQuery?.addEventListener("change", (ev) => {
    prefersReducedMotion = ev.matches;
  });
}

export function shouldUseMobileLiteFx(): boolean {
  if (typeof window === "undefined") return false;
  const coarse = window.matchMedia?.("(pointer: coarse)")?.matches ?? false;
  const narrow = window.matchMedia?.("(max-width: 900px)")?.matches ?? false;
  const lowCpu = typeof navigator !== "undefined" && (navigator.hardwareConcurrency ?? 8) <= 6;
  return coarse || narrow || lowCpu;
}

export function updateModernVisualFx(now: number): void {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  const reduced = motionReduced();
  root.classList.toggle("fx-reduce-motion", reduced);
  if (reduced) return;
  const cycle = 28000;
  const t = ((now % cycle) + cycle) / cycle;
  const pulse = (Math.sin((now / 1800) * Math.PI * 2) + 1) * 0.5;
  const visualState = getFxVisualState();
  const hubHue: Record<HubId, number> = {
    estate: 0,
    cultivate: -20,
    battle: 30,
    character: -10,
  };
  const pullDensity = Math.min(1, Math.log10(Math.max(10, visualState.totalPulls + 10)) / 4);
  const resonance = (((visualState.wishResonance % 100) + 100) % 100) / 100;
  const hue = 220 + hubHue[visualState.activeHub] + pulse * 22 + resonance * 18;
  const energy = 0.34 + 0.38 * pullDensity + 0.28 * resonance;
  root.style.setProperty("--modern-fx-hue", `${hue.toFixed(2)}deg`);
  root.style.setProperty("--modern-fx-energy", energy.toFixed(3));
  root.style.setProperty("--modern-fx-t", t.toFixed(4));
  root.style.setProperty("--modern-fx-mx", `${(modernFxPointerX * 100).toFixed(2)}%`);
  root.style.setProperty("--modern-fx-my", `${(modernFxPointerY * 100).toFixed(2)}%`);
}
