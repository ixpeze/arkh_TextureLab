import type { Patch } from 'immer';
import { applyPatches, enablePatches } from 'immer';
import type { TlabDocument } from '../types/project';

enablePatches();

export interface HistoryEntry {
  id: string;
  description: string;
  patches: Patch[];
  inversePatches: Patch[];
  timestamp: number;
  revision: number;
}

export interface ActiveTransaction {
  id: string;
  description: string;
  initialDoc: TlabDocument;
  startRevision: number;
}

export const MAX_HISTORY_STEPS = 100;

export class HistoryManager {
  private undoStack: HistoryEntry[] = [];
  private redoStack: HistoryEntry[] = [];
  private activeTransaction: ActiveTransaction | null = null;
  private currentRevision = 0;
  private savedRevision = 0;

  public get revision(): number {
    return this.currentRevision;
  }

  public get isDirty(): boolean {
    return this.currentRevision !== this.savedRevision;
  }

  public markSaved(): void {
    this.savedRevision = this.currentRevision;
  }

  public setSavedRevision(rev: number): void {
    this.savedRevision = rev;
  }

  public setRevision(rev: number): void {
    this.currentRevision = rev;
  }

  public canUndo(): boolean {
    return this.undoStack.length > 0;
  }

  public canRedo(): boolean {
    return this.redoStack.length > 0;
  }

  public clear(): void {
    this.undoStack = [];
    this.redoStack = [];
    this.activeTransaction = null;
  }

  /**
   * Begins a coalescing transaction (e.g. for slider scrubbing or node dragging).
   */
  public beginTransaction(initialDoc: TlabDocument, description = 'Transaction'): void {
    if (this.activeTransaction) {
      // Already in transaction, don't overwrite the initial anchor
      return;
    }
    this.activeTransaction = {
      id: `tx_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      description,
      initialDoc,
      startRevision: this.currentRevision,
    };
  }

  public isInTransaction(): boolean {
    return this.activeTransaction !== null;
  }

  public getActiveTransaction(): ActiveTransaction | null {
    return this.activeTransaction;
  }

  /**
   * Commits the active transaction, pushing a single coalesced history entry.
   */
  public commitTransaction(finalDoc: TlabDocument, computePatches: (initial: TlabDocument, final: TlabDocument) => { patches: Patch[]; inversePatches: Patch[] }): HistoryEntry | null {
    if (!this.activeTransaction) return null;

    const tx = this.activeTransaction;
    this.activeTransaction = null;

    const { patches, inversePatches } = computePatches(tx.initialDoc, finalDoc);
    if (patches.length === 0) {
      // No actual mutations took place
      return null;
    }

    this.currentRevision++;
    const entry: HistoryEntry = {
      id: tx.id,
      description: tx.description,
      patches,
      inversePatches,
      timestamp: Date.now(),
      revision: this.currentRevision,
    };

    this.undoStack.push(entry);
    if (this.undoStack.length > MAX_HISTORY_STEPS) {
      this.undoStack.shift();
    }
    this.redoStack = [];
    return entry;
  }

  public cancelTransaction(): void {
    this.activeTransaction = null;
  }

  /**
   * Pushes discrete patches directly into history (for single clicks, spawns, deletes).
   */
  public push(patches: Patch[], inversePatches: Patch[], description = 'Action'): HistoryEntry | null {
    if (patches.length === 0) return null;

    this.currentRevision++;
    const entry: HistoryEntry = {
      id: `entry_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      description,
      patches,
      inversePatches,
      timestamp: Date.now(),
      revision: this.currentRevision,
    };

    this.undoStack.push(entry);
    if (this.undoStack.length > MAX_HISTORY_STEPS) {
      this.undoStack.shift();
    }
    this.redoStack = [];
    return entry;
  }

  public undo(currentDoc: TlabDocument): { doc: TlabDocument; entry: HistoryEntry } | null {
    if (this.undoStack.length === 0) {
      return null; // TC-303: No-op, no error
    }

    const entry = this.undoStack.pop()!;
    this.redoStack.push(entry);

    // Rollback document state
    const doc = applyPatches(currentDoc, entry.inversePatches);

    // Update revision to previous entry's revision or start
    const prevEntry = this.undoStack[this.undoStack.length - 1];
    this.currentRevision = prevEntry ? prevEntry.revision : 0;

    return { doc, entry };
  }

  public redo(currentDoc: TlabDocument): { doc: TlabDocument; entry: HistoryEntry } | null {
    if (this.redoStack.length === 0) {
      return null;
    }

    const entry = this.redoStack.pop()!;
    this.undoStack.push(entry);

    // Fast-forward document state
    const doc = applyPatches(currentDoc, entry.patches);
    this.currentRevision = entry.revision;

    return { doc, entry };
  }

  public getUndoStackSize(): number {
    return this.undoStack.length;
  }

  public getRedoStackSize(): number {
    return this.redoStack.length;
  }
}
