import type { AssetRecord } from '../types/project';

export interface UiSliceState {
  palettePos: { x: number; y: number } | null;
  isShortcutsOpen: boolean;
  isExportModalOpen: boolean;
  isRelinkModalOpen: boolean;
  missingAssets: AssetRecord[];
  statusMessage: string;
}

export interface UiSliceActions {
  setPalettePos: (pos: { x: number; y: number } | null) => void;
  setIsShortcutsOpen: (open: boolean) => void;
  setIsExportModalOpen: (open: boolean) => void;
  setIsRelinkModalOpen: (open: boolean, missing?: AssetRecord[]) => void;
  setStatusMessage: (msg: string) => void;
}

export type UiSlice = UiSliceState & UiSliceActions;

export function createUiSlice(
  set: (fn: (prev: UiSlice) => Partial<UiSlice>) => void
): UiSlice {
  return {
    palettePos: null,
    isShortcutsOpen: false,
    isExportModalOpen: false,
    isRelinkModalOpen: false,
    missingAssets: [],
    statusMessage: 'Ready | Tactical DCC Workstation online',

    setPalettePos: (pos) => set(() => ({ palettePos: pos })),
    setIsShortcutsOpen: (open) => set(() => ({ isShortcutsOpen: open })),
    setIsExportModalOpen: (open) => set(() => ({ isExportModalOpen: open })),
    setIsRelinkModalOpen: (open, missing = []) =>
      set(() => ({ isRelinkModalOpen: open, missingAssets: missing })),
    setStatusMessage: (statusMessage) => set(() => ({ statusMessage })),
  };
}
