// src/store/uiSlice.ts
import type { AssetRecord } from '../types/project';

export interface UiSliceState {
  palettePos: { x: number; y: number } | null;
  isShortcutsOpen: boolean;
  isExportModalOpen: boolean;
  isRelinkModalOpen: boolean;
  isSettingsOpen: boolean;
  isPackWizardOpen: boolean;
  isUnpackWizardOpen: boolean;
  missingAssets: AssetRecord[];
  statusMessage: string;

  // Docked Layout State (P5-T4)
  isLibraryOpen: boolean;
  libraryWidth: number;
  isInspectorOpen: boolean;
  inspectorWidth: number;
  inspectorTab: 'preview' | 'histogram' | 'properties';

  // Workstation Preferences (P5-T10)
  showLabsNodes: boolean;
  previewQuality: 'Auto' | '512' | '1K' | '2K' | 'Full';
  vramBudgetMb: number;
  confirmOnDelete: boolean;
}

export interface UiSliceActions {
  setPalettePos: (pos: { x: number; y: number } | null) => void;
  setIsShortcutsOpen: (open: boolean) => void;
  setIsExportModalOpen: (open: boolean) => void;
  setIsRelinkModalOpen: (open: boolean, missing?: AssetRecord[]) => void;
  setIsSettingsOpen: (open: boolean) => void;
  setIsPackWizardOpen: (open: boolean) => void;
  setIsUnpackWizardOpen: (open: boolean) => void;
  setStatusMessage: (msg: string) => void;

  toggleLibrary: () => void;
  toggleInspector: () => void;
  setLibraryOpen: (open: boolean) => void;
  setInspectorOpen: (open: boolean) => void;
  setLibraryWidth: (w: number) => void;
  setInspectorWidth: (w: number) => void;
  setInspectorTab: (tab: 'preview' | 'histogram' | 'properties') => void;

  setShowLabsNodes: (show: boolean) => void;
  setPreviewQuality: (q: 'Auto' | '512' | '1K' | '2K' | 'Full') => void;
  setVramBudgetMb: (mb: number) => void;
  setConfirmOnDelete: (confirm: boolean) => void;
  resetLayout: () => void;
}

export type UiSlice = UiSliceState & UiSliceActions;

const STORAGE_KEY = 'texturelab_ui_layout';

interface PersistedLayout {
  isLibraryOpen?: boolean;
  libraryWidth?: number;
  isInspectorOpen?: boolean;
  inspectorWidth?: number;
  inspectorTab?: 'preview' | 'histogram' | 'properties';
  showLabsNodes?: boolean;
  previewQuality?: 'Auto' | '512' | '1K' | '2K' | 'Full';
  vramBudgetMb?: number;
  confirmOnDelete?: boolean;
}

function loadPersistedLayout(): PersistedLayout {
  try {
    const raw = typeof window !== 'undefined' ? localStorage.getItem(STORAGE_KEY) : null;
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function saveLayout(patch: Partial<PersistedLayout>) {
  try {
    if (typeof window === 'undefined') return;
    const current = loadPersistedLayout();
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...current, ...patch }));
  } catch {
    // ignore
  }
}

export function createUiSlice(
  set: (fn: (prev: UiSlice) => Partial<UiSlice>) => void
): UiSlice {
  const saved = loadPersistedLayout();

  return {
    palettePos: null,
    isShortcutsOpen: false,
    isExportModalOpen: false,
    isRelinkModalOpen: false,
    isSettingsOpen: false,
    isPackWizardOpen: false,
    isUnpackWizardOpen: false,
    missingAssets: [],
    statusMessage: 'Ready | Graphite Blueprint Workstation online',

    // Docked Layout
    isLibraryOpen: saved.isLibraryOpen ?? true,
    libraryWidth: saved.libraryWidth ?? 260,
    isInspectorOpen: saved.isInspectorOpen ?? true,
    inspectorWidth: saved.inspectorWidth ?? 340,
    inspectorTab: saved.inspectorTab ?? 'preview',

    // Preferences
    showLabsNodes: saved.showLabsNodes ?? false,
    previewQuality: saved.previewQuality ?? 'Auto',
    vramBudgetMb: saved.vramBudgetMb ?? 1536,
    confirmOnDelete: saved.confirmOnDelete ?? false,

    setPalettePos: (pos) => set(() => ({ palettePos: pos })),
    setIsShortcutsOpen: (open) => set(() => ({ isShortcutsOpen: open })),
    setIsExportModalOpen: (open) => set(() => ({ isExportModalOpen: open })),
    setIsRelinkModalOpen: (open, missing = []) =>
      set(() => ({ isRelinkModalOpen: open, missingAssets: missing })),
    setIsSettingsOpen: (open) => set(() => ({ isSettingsOpen: open })),
    setIsPackWizardOpen: (open) => set(() => ({ isPackWizardOpen: open })),
    setIsUnpackWizardOpen: (open) => set(() => ({ isUnpackWizardOpen: open })),
    setStatusMessage: (statusMessage) => set(() => ({ statusMessage })),

    toggleLibrary: () =>
      set((s) => {
        const next = !s.isLibraryOpen;
        saveLayout({ isLibraryOpen: next });
        return { isLibraryOpen: next };
      }),
    toggleInspector: () =>
      set((s) => {
        const next = !s.isInspectorOpen;
        saveLayout({ isInspectorOpen: next });
        return { isInspectorOpen: next };
      }),
    setLibraryOpen: (open) =>
      set(() => {
        saveLayout({ isLibraryOpen: open });
        return { isLibraryOpen: open };
      }),
    setInspectorOpen: (open) =>
      set(() => {
        saveLayout({ isInspectorOpen: open });
        return { isInspectorOpen: open };
      }),
    setLibraryWidth: (w) =>
      set(() => {
        const clamped = Math.max(240, Math.min(500, w));
        saveLayout({ libraryWidth: clamped });
        return { libraryWidth: clamped };
      }),
    setInspectorWidth: (w) =>
      set(() => {
        const clamped = Math.max(280, Math.min(600, w));
        saveLayout({ inspectorWidth: clamped });
        return { inspectorWidth: clamped };
      }),
    setInspectorTab: (tab) =>
      set(() => {
        saveLayout({ inspectorTab: tab });
        return { inspectorTab: tab };
      }),

    setShowLabsNodes: (show) =>
      set(() => {
        saveLayout({ showLabsNodes: show });
        return { showLabsNodes: show };
      }),
    setPreviewQuality: (q) =>
      set(() => {
        saveLayout({ previewQuality: q });
        return { previewQuality: q };
      }),
    setVramBudgetMb: (mb) =>
      set(() => {
        saveLayout({ vramBudgetMb: mb });
        return { vramBudgetMb: mb };
      }),
    setConfirmOnDelete: (confirm) =>
      set(() => {
        saveLayout({ confirmOnDelete: confirm });
        return { confirmOnDelete: confirm };
      }),
    resetLayout: () =>
      set(() => {
        const defaults = {
          isLibraryOpen: true,
          libraryWidth: 260,
          isInspectorOpen: true,
          inspectorWidth: 340,
          inspectorTab: 'preview' as const,
        };
        saveLayout(defaults);
        return defaults;
      }),
  };
}
