import type { GameState } from "../types";
import {
  SAVE_SLOT_COUNT,
  copyCurrentToSlot,
  exportSave,
  getActiveSlotIndex,
  getSlotLabel,
  importSave,
  peekSlotSummary,
  setSlotLabel,
  switchToSaveSlot,
} from "../storage";
import { setSaveImportFeedback } from "./saveToolsFeedback";

export interface SaveToolsEventDeps {
  getState: () => GameState;
  setState: (next: GameState) => void;
  saveGame: (state: GameState) => void;
  toast: (msg: string) => void;
  render: () => void;
  triggerDownloadSaveBackup: () => void;
  afterStateReplaced: () => void;
}

export function bindSaveToolsEvents(deps: SaveToolsEventDeps): void {
  const { getState, setState, saveGame, toast, render, triggerDownloadSaveBackup, afterStateReplaced } = deps;
  let saveFeedbackTimer = 0;
  const paintSaveScheduleFeedback = (mode: "saving" | "saved", detail: string): void => {
    const savingEl = document.getElementById("save-saving-indicator");
    const savingTextEl = document.getElementById("save-saving-text");
    const savedEl = document.getElementById("save-saved-indicator");
    if (savingTextEl) savingTextEl.textContent = `统一存盘调度：${detail}`;
    if (savingEl) savingEl.classList.toggle("is-active", mode === "saving");
    if (savedEl) savedEl.hidden = mode !== "saved";
    if (saveFeedbackTimer) window.clearTimeout(saveFeedbackTimer);
    if (mode === "saved") {
      saveFeedbackTimer = window.setTimeout(() => {
        if (savedEl) savedEl.hidden = true;
        if (savingTextEl) savingTextEl.textContent = "统一存盘调度：待机";
      }, 1500);
    }
  };

  document.getElementById("btn-save")?.addEventListener("click", () => {
    const state = getState();
    paintSaveScheduleFeedback("saving", "写入中");
    saveGame(state);
    paintSaveScheduleFeedback("saved", "本机槽位写入成功");
    toast("已保存到本机。");
    setSaveImportFeedback("success", "本机保存完成", "当前进度已写入活动存档位。", "可继续导出备份，或切换至其他槽位。");
  });

  document.getElementById("btn-export")?.addEventListener("click", () => {
    const state = getState();
    const s = exportSave(state);
    void navigator.clipboard.writeText(s).then(
      () => {
        toast("存档字符串已复制到剪贴板。");
        setSaveImportFeedback("success", "导出成功", "存档字符串已复制到剪贴板。", "可直接粘贴到导入框进行完整性验证。");
      },
      () => {
        const pasted = window.prompt("剪贴板不可用，请手动复制以下完整存档字符串：", s);
        if (pasted == null) {
          toast("导出未完成：请重试或检查剪贴板权限。");
          setSaveImportFeedback("fail", "导出未完成", "剪贴板权限不可用，且你取消了手动复制。", "请重试导出，或检查浏览器剪贴板权限。");
        } else {
          toast("已显示完整存档字符串，请手动复制。");
          setSaveImportFeedback("warn", "需手动复制", "已弹出完整存档字符串，请确认已完整复制。", "若字符串不完整，导入会失败。");
        }
      },
    );
  });

  document.getElementById("btn-save-download")?.addEventListener("click", () => {
    triggerDownloadSaveBackup();
  });

  document.querySelectorAll("[data-save-slot-activate]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const slot = Number((btn as HTMLElement).dataset.saveSlotActivate);
      if (!Number.isFinite(slot) || slot < 0 || slot >= SAVE_SLOT_COUNT) return;
      if (slot === getActiveSlotIndex()) return;
      if (peekSlotSummary(slot).empty) {
        const ok = confirm(`存档位 ${slot + 1} 当前为空。切换后将从此槽开始新开局（当前槽会先保存）。确定吗？`);
        if (!ok) return;
      }
      const switched = switchToSaveSlot(slot, getState());
      if (!switched.ok) {
        toast(`切换失败：${switched.error}`);
        setSaveImportFeedback("fail", "切换失败", "存档位切换未完成，当前进度保持不变。", switched.error);
        return;
      }
      setState(switched.value);
      afterStateReplaced();
      paintSaveScheduleFeedback("saving", "切换槽位并写入中");
      saveGame(switched.value);
      paintSaveScheduleFeedback("saved", `槽位 ${slot + 1} 已激活`);
      toast(`已切换到存档位 ${slot + 1}`);
      setSaveImportFeedback("success", "切换成功", `已切换到槽位 ${slot + 1}。`, "切换前已尝试保存当前槽，并在载入前完成目标槽校验。");
      render();
    });
  });

  document.querySelectorAll("[data-save-slot-copy]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const slot = Number((btn as HTMLElement).dataset.saveSlotCopy);
      if (!Number.isFinite(slot) || slot < 0 || slot >= SAVE_SLOT_COUNT) return;
      if (slot === getActiveSlotIndex()) return;
      const sum = peekSlotSummary(slot);
      if (!sum.empty) {
        const ok = confirm(`将用当前进度覆盖存档位 ${slot + 1} 的已有存档。确定吗？`);
        if (!ok) return;
      }
      copyCurrentToSlot(slot, getState());
      toast(`已复制当前进度到存档位 ${slot + 1}`);
      render();
    });
  });

  document.querySelectorAll(".save-slot-label-input").forEach((el) => {
    el.addEventListener("change", () => {
      const inp = el as HTMLInputElement;
      const slot = Number(inp.dataset.saveSlotLabel);
      if (!Number.isFinite(slot) || slot < 0 || slot >= SAVE_SLOT_COUNT) return;
      setSlotLabel(slot, inp.value);
      inp.value = getSlotLabel(slot);
    });
  });

  document.getElementById("btn-import")?.addEventListener("click", () => {
    const inp = document.getElementById("import-input") as HTMLInputElement | null;
    const raw = inp?.value?.trim();
    if (!raw) {
      toast("请先粘贴存档字符串。");
      setSaveImportFeedback("warn", "缺少导入内容", "尚未检测到存档字符串。", "请先粘贴完整字符串再执行导入。");
      inp?.focus();
      return;
    }
    const next = importSave(raw);
    if (!next.ok) {
      toast("导入失败：字符串无效。");
      setSaveImportFeedback("fail", "导入失败", "字符串无效或不完整，未写入任何进度。", next.error);
      return;
    }
    const state = getState();
    const curExport = exportSave(state);
    if (raw !== curExport) {
      const ok = confirm("导入会覆盖当前进度，建议先导出备份。确认继续导入吗？");
      if (!ok) {
        setSaveImportFeedback("warn", "导入已取消", "你取消了覆盖导入，当前进度保持不变。", "可先点击“导出存档字符串”进行备份。");
        return;
      }
    }
    setState(next.value);
    afterStateReplaced();
    paintSaveScheduleFeedback("saving", "导入后写入中");
    saveGame(next.value);
    paintSaveScheduleFeedback("saved", "导入存档已落盘");
    toast("存档导入成功。");
    setSaveImportFeedback("success", "导入成功", "已通过校验并写入存档，界面已刷新。", "失败场景不会覆盖当前进度。");
    render();
  });
}
