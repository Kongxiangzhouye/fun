import type { GameState } from "../types";
import { bindSaveToolsEvents } from "./saveToolsEvents";

export interface SaveToolsBridgeDeps {
  getState: () => GameState;
  setState: (next: GameState) => void;
  saveGame: (state: GameState) => void;
  toast: (msg: string) => void;
  render: () => void;
  triggerDownloadSaveBackup: () => void;
  resetTransientUiState: () => void;
}

export function setupSaveToolsBridge(deps: SaveToolsBridgeDeps): void {
  bindSaveToolsEvents({
    getState: deps.getState,
    setState: deps.setState,
    saveGame: deps.saveGame,
    toast: deps.toast,
    render: deps.render,
    triggerDownloadSaveBackup: deps.triggerDownloadSaveBackup,
    afterStateReplaced: deps.resetTransientUiState,
  });
}
