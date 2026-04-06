import {
  UI_SAVE_IMPORT_BADGE_FAIL,
  UI_SAVE_IMPORT_BADGE_SUCCESS,
  UI_SAVE_IMPORT_BADGE_WARN,
} from "./visualAssets";

function escapeHtmlText(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

export function setSaveImportFeedback(
  stateKind: "success" | "warn" | "fail",
  title: string,
  message: string,
  detail = "",
): void {
  const panel = document.getElementById("save-import-result-panel");
  if (!panel) return;
  panel.classList.remove("is-success", "is-warn", "is-fail", "is-idle");
  panel.classList.add(`is-${stateKind}`);

  const badge = document.getElementById("save-import-result-badge") as HTMLImageElement | null;
  const titleEl = document.getElementById("save-import-result-title");
  const chip = document.getElementById("save-import-result-chip");
  const messageEl = document.getElementById("save-import-result-message");
  const detailEl = document.getElementById("save-import-result-detail");
  if (badge) {
    badge.src =
      stateKind === "success"
        ? UI_SAVE_IMPORT_BADGE_SUCCESS
        : stateKind === "fail"
          ? UI_SAVE_IMPORT_BADGE_FAIL
          : UI_SAVE_IMPORT_BADGE_WARN;
  }
  if (titleEl) titleEl.textContent = title;
  if (chip) chip.textContent = stateKind === "success" ? "成功" : stateKind === "fail" ? "失败" : "警告";
  if (messageEl) messageEl.textContent = message;
  if (detailEl) detailEl.innerHTML = detail ? escapeHtmlText(detail) : "&nbsp;";
}
