type ToastBaseOptions = {
  wrapId?: string;
  iconSrc: string;
  durationMs: number;
  className?: string;
};

function appendToastProgress(el: HTMLElement, durationMs: number): void {
  const track = document.createElement("div");
  track.className = "toast-progress";
  track.setAttribute("aria-hidden", "true");
  const bar = document.createElement("span");
  bar.className = "toast-progress-bar";
  bar.style.animationDuration = `${durationMs}ms`;
  track.appendChild(bar);
  el.appendChild(track);
}

function prependToastIcon(body: HTMLElement, iconSrc: string): void {
  const ico = document.createElement("img");
  ico.className = "toast-feedback-ico";
  ico.src = iconSrc;
  ico.alt = "";
  ico.width = 16;
  ico.height = 16;
  ico.loading = "lazy";
  body.prepend(ico);
}

function getToastWrap(id: string): HTMLElement | null {
  return document.getElementById(id);
}

export function showPlainFeedbackToast(msg: string, opts: ToastBaseOptions): boolean {
  const wrapId = opts.wrapId ?? "toast-wrap";
  const w = getToastWrap(wrapId);
  if (!w) return false;
  const el = document.createElement("div");
  el.className = opts.className ?? "toast feedback-toast";
  const body = document.createElement("div");
  body.className = "toast-msg";
  body.textContent = msg;
  if (msg.includes("\n")) body.style.whiteSpace = "pre-line";
  prependToastIcon(body, opts.iconSrc);
  el.appendChild(body);
  appendToastProgress(el, opts.durationMs);
  w.appendChild(el);
  window.setTimeout(() => el.remove(), opts.durationMs);
  return true;
}

export function showHtmlFeedbackToast(html: string, opts: ToastBaseOptions): boolean {
  const wrapId = opts.wrapId ?? "toast-wrap";
  const w = getToastWrap(wrapId);
  if (!w) return false;
  const el = document.createElement("div");
  el.className = opts.className ?? "toast feedback-toast";
  const body = document.createElement("div");
  body.className = "toast-msg";
  body.innerHTML = html;
  prependToastIcon(body, opts.iconSrc);
  el.appendChild(body);
  appendToastProgress(el, opts.durationMs);
  w.appendChild(el);
  window.setTimeout(() => el.remove(), opts.durationMs);
  return true;
}
