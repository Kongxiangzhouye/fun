import { SAVE_SLOT_COUNT, SAVE_SLOT_LABEL_MAX, getActiveSlotIndex, getSlotLabel, peekSlotSummary } from "../storage";
import {
  UI_FLOW_ACTION_ROW_DECO,
  UI_FLOW_PANEL_HEADER_DECO,
  UI_FLOW_SECTION_TAG_DECO,
  UI_SAVE_DOWNLOAD_DECO,
  UI_SAVE_IMPORT_BADGE_WARN,
  UI_SAVE_IMPORT_TIP_DECO,
  UI_SAVE_SLOT_LABEL_DECO,
  UI_SAVE_SLOTS_DECO,
} from "./visualAssets";

function escapeHtmlAttr(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function renderSaveSlotRow(i: number, fmtPlaytimeSec: (sec: number) => string): string {
  const active = getActiveSlotIndex();
  const sum = peekSlotSummary(i);
  const meta = sum.empty ? "空槽" : `境界 ${sum.realmLevel} · ${fmtPlaytimeSec(sum.playtimeSec ?? 0)}`;
  const isActive = i === active;
  const labelVal = escapeHtmlAttr(getSlotLabel(i));
  return `<li class="save-slot-row">
    <div class="save-slot-main">
      <div class="save-slot-title-row ui-section-tag">
        <img class="ui-section-tag-ico" src="${UI_FLOW_SECTION_TAG_DECO}" alt="" width="16" height="16" loading="lazy" />
        <strong class="save-slot-title">槽位 ${i + 1}</strong>
        ${isActive ? `<span class="save-slot-badge">当前</span>` : ""}
      </div>
      <span class="save-slot-meta">${meta}</span>
      <div class="save-slot-label-row">
        <label class="save-slot-label-field" for="save-slot-label-${i}">备注</label>
        <input
          type="text"
          id="save-slot-label-${i}"
          class="save-slot-label-input"
          data-save-slot-label="${i}"
          maxlength="${SAVE_SLOT_LABEL_MAX}"
          autocomplete="off"
          placeholder="本机备注，最多 ${SAVE_SLOT_LABEL_MAX} 字"
          value="${labelVal}"
        />
      </div>
    </div>
    <div class="save-slot-actions ui-compact-action-row">
      <img class="ui-compact-action-row-ico" src="${UI_FLOW_ACTION_ROW_DECO}" alt="" width="16" height="16" loading="lazy" />
      ${
        !isActive
          ? `<button type="button" class="btn save-slot-btn" data-save-slot-activate="${i}">切换到此槽</button><button type="button" class="btn save-slot-btn" data-save-slot-copy="${i}">将当前复制到此槽</button>`
          : ""
      }
    </div>
  </li>`;
}

export function renderSaveToolsPanel(fmtPlaytimeSec: (sec: number) => string): string {
  const rows = Array.from({ length: SAVE_SLOT_COUNT }, (_, i) => renderSaveSlotRow(i, fmtPlaytimeSec)).join("");
  return `<section class="panel save-tools-panel">
    <div class="ui-panel-header">
      <img class="ui-panel-header-ico" src="${UI_FLOW_PANEL_HEADER_DECO}" alt="" width="20" height="20" loading="lazy" />
      <h2>存档管理</h2>
    </div>
    <p class="hint">保存/导出/导入与重置都集中在这里。重置前建议先导出备份。</p>
    <div class="save-import-tipbar" role="note" aria-label="导入提示">
      <img class="save-import-tipbar-ico" src="${UI_SAVE_IMPORT_TIP_DECO}" alt="" width="16" height="16" loading="lazy" />
      <span>导入前建议先导出；仅接受完整存档字符串，导入会先校验，校验通过后才覆盖当前进度。</span>
    </div>
    <div class="save-slots-block">
      <div class="save-slots-head">
        <img class="save-slots-head-ico" src="${UI_SAVE_SLOTS_DECO}" alt="" width="26" height="26" loading="lazy" />
        <h3 class="save-slots-heading">本机存档位</h3>
        <img
          class="save-slots-label-head-ico"
          src="${UI_SAVE_SLOT_LABEL_DECO}"
          alt=""
          width="22"
          height="22"
          loading="lazy"
          title="槽位备注仅保存在本机，不随导出存档字符串迁移"
        />
      </div>
      <p class="hint sm save-slots-hint">共 ${SAVE_SLOT_COUNT} 个独立槽位；可填备注区分周目。切换前会自动保存当前槽；空槽切换将新开局。备注不写入导出字符串。</p>
      <ul class="save-slots-list">${rows}</ul>
    </div>
    <div class="footer-tools">
      <button class="btn" type="button" id="btn-save">保存到本机</button>
      <button class="btn" type="button" id="btn-export">导出存档字符串</button>
      <button class="btn btn-save-download" type="button" id="btn-save-download">
        <img src="${UI_SAVE_DOWNLOAD_DECO}" alt="" width="18" height="18" class="btn-save-download-ico" loading="lazy" />
        下载备份文件
      </button>
      <input type="text" id="import-input" class="import-input" placeholder="粘贴存档字符串" />
      <button class="btn" type="button" id="btn-import">导入存档</button>
    </div>
    <section class="save-import-result-panel is-idle" id="save-import-result-panel" aria-live="polite" aria-atomic="true">
      <header class="save-import-result-head">
        <img
          class="save-import-result-badge"
          id="save-import-result-badge"
          src="${UI_SAVE_IMPORT_BADGE_WARN}"
          alt=""
          width="18"
          height="18"
          loading="lazy"
        />
        <strong class="save-import-result-title" id="save-import-result-title">等待导入操作</strong>
        <span class="save-import-result-chip" id="save-import-result-chip">待机</span>
      </header>
      <p class="save-import-result-message" id="save-import-result-message">粘贴完整存档字符串后点击“导入存档”。</p>
      <p class="save-import-result-detail" id="save-import-result-detail">当前不会修改进度，直到确认导入。</p>
    </section>
    <div class="reset-strip">
      <button type="button" class="btn btn-danger" id="btn-reset-world">重置存档</button>
      <span class="reset-strip-hint">会清空当前存档并从头开始，建议先导出备份</span>
    </div>
  </section>`;
}
