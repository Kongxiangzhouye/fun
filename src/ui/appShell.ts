export type AppShellRenderContext = {
  bgSparklesSrc: string;
  panelRunesSrc: string;
  titleSpiritSrc: string;
  titleSpiritTitle: string;
  appTitle: string;
  topBarHtml: string;
  taglineHtml: string;
  hubAssistHtml: string;
  subNavHtml: string;
  hubContentHtml: string;
  nextBoostHtml: string;
  tutorialHtml: string;
  flyOverlayHtml: string;
  bottomNavHtml: string;
  aiAgentHtml: string;
  modalHtml: string;
};

export function renderAppShell(ctx: AppShellRenderContext): string {
  return `
    <div class="app-visual-bg" style="--ui-sparkles:url('${ctx.bgSparklesSrc}')" aria-hidden="true"></div>
    <div class="app-visual-aurora" aria-hidden="true"></div>
    <div class="app-root-content" style="--ui-panel-runes:url('${ctx.panelRunesSrc}')">
    <div class="app-head">
    <div class="app-brand-row">
      <div class="app-title-cluster">
        <img class="app-title-spirit" src="${ctx.titleSpiritSrc}" alt="" width="40" height="40" loading="eager" title="${ctx.titleSpiritTitle}" />
        <h1 class="app-title">${ctx.appTitle}</h1>
      </div>
      ${ctx.topBarHtml}
    </div>
    ${ctx.taglineHtml}
    </div>

    <main class="app-main app-main-stack" id="main-content">
    <div class="hub-page-scroll">
    ${ctx.hubAssistHtml}
    ${ctx.subNavHtml}
    ${ctx.hubContentHtml}
    </div>
    </main>

    ${ctx.nextBoostHtml}
    ${ctx.tutorialHtml}
    ${ctx.flyOverlayHtml}
    ${ctx.bottomNavHtml}
    ${ctx.aiAgentHtml}
    </div>
    ${ctx.modalHtml}
  `;
}
