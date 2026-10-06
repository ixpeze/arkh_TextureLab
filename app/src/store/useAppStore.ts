import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';
import { produceWithPatches } from 'immer';
import {
  createDocumentSlice,
  type DocumentSlice,
} from './documentSlice';
import {
  createSelectionSlice,
  type SelectionSlice,
} from './selectionSlice';
import {
  createUiSlice,
  type UiSlice,
} from './uiSlice';
import {
  createSessionSlice,
  type SessionSlice,
} from './sessionSlice';
import { HistoryManager } from './history';

export interface HistoryActions {
  historyManager: HistoryManager;
  undo: () => boolean;
  redo: () => boolean;
  canUndo: () => boolean;
  canRedo: () => boolean;
  beginTransaction: (description?: string) => void;
  commitTransaction: () => boolean;
  cancelTransaction: () => void;
}

export type AppStore = DocumentSlice &
  SelectionSlice &
  UiSlice &
  SessionSlice &
  HistoryActions;

const historyManager = new HistoryManager();

export const useAppStore = create<AppStore>()(
  subscribeWithSelector((set, get) => {
  const docSlice = createDocumentSlice(
    (fn) => {
      set((state) => {
        const next = fn(state);
        // Automatically sync session isDirty with history state
        const dirty = historyManager.isDirty;
        return { ...next, isDirty: dirty };
      });
    },
    get,
    historyManager
  );

  const selSlice = createSelectionSlice((fn) => set((state) => fn(state)));
  const uiSlice = createUiSlice((fn) => set((state) => fn(state)));
  const sessionSlice = createSessionSlice((fn) => set((state) => fn(state)));

  return {
    ...docSlice,
    ...selSlice,
    ...uiSlice,
    ...sessionSlice,
    historyManager,

    canUndo: () => historyManager.canUndo(),
    canRedo: () => historyManager.canRedo(),

    undo: () => {
      const currentDoc = get().doc;
      const res = historyManager.undo(currentDoc);
      if (!res) return false;

      set({
        doc: res.doc,
        isDirty: historyManager.isDirty,
        statusMessage: `Undo: ${res.entry.description}`,
      });
      return true;
    },

    redo: () => {
      const currentDoc = get().doc;
      const res = historyManager.redo(currentDoc);
      if (!res) return false;

      set({
        doc: res.doc,
        isDirty: historyManager.isDirty,
        statusMessage: `Redo: ${res.entry.description}`,
      });
      return true;
    },

    beginTransaction: (description = 'Scrub') => {
      const currentDoc = get().doc;
      historyManager.beginTransaction(currentDoc, description);
    },

    commitTransaction: () => {
      const currentDoc = get().doc;
      const entry = historyManager.commitTransaction(currentDoc, (initial, final) => {
        const [, patches, inversePatches] = produceWithPatches(initial, () => final);
        return { patches, inversePatches };
      });

      if (entry) {
        set({ isDirty: historyManager.isDirty });
        return true;
      }
      return false;
    },

    cancelTransaction: () => {
      const tx = historyManager.getActiveTransaction();
      if (tx) {
        // Rollback to initial doc at start of transaction
        set({ doc: tx.initialDoc });
      }
      historyManager.cancelTransaction();
    },
  };
}));
