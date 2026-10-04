import { useMemo } from 'react';
import { useHotkeys, type KeyBinding } from '../features/hotkeys/hotkeys';

export interface UseAppHotkeysProps {
  handleUndo: () => void;
  handleRedo: () => void;
  fitView: () => void;
  autoWireORMH: () => void;
  spawnCommentBox: () => void;
  toggleBypassSelected: () => void;
  handleDuplicate: () => void;
  handleDelete: () => void;
  selectAll: () => void;
  spawnNode: (typeKey: string) => void;
  togglePalette: () => void;
  toggleShortcuts: () => void;
  toggleExportModal: () => void;
  isModalOpen: boolean;
}

export function useAppHotkeys({
  handleUndo,
  handleRedo,
  fitView,
  autoWireORMH,
  spawnCommentBox,
  toggleBypassSelected,
  handleDuplicate,
  handleDelete,
  selectAll,
  spawnNode,
  togglePalette,
  toggleShortcuts,
  toggleExportModal,
  isModalOpen,
}: UseAppHotkeysProps) {
  const hotkeyBindings = useMemo<KeyBinding[]>(
    () => [
      {
        id: 'undo',
        chord: 'ctrl+z',
        handler: (e) => {
          e.preventDefault?.();
          handleUndo();
        },
      },
      {
        id: 'redo-y',
        chord: 'ctrl+y',
        handler: (e) => {
          e.preventDefault?.();
          handleRedo();
        },
      },
      {
        id: 'redo-shift-z',
        chord: 'ctrl+shift+z',
        handler: (e) => {
          e.preventDefault?.();
          handleRedo();
        },
      },
      {
        id: 'tab-palette',
        chord: 'tab',
        handler: (e) => {
          e.preventDefault?.();
          togglePalette();
        },
      },
      {
        id: 'fit-view',
        chord: 'f',
        handler: () => {
          fitView();
        },
      },
      {
        id: 'shortcuts-modal',
        chord: '?',
        handler: (e) => {
          e.preventDefault?.();
          toggleShortcuts();
        },
      },
      {
        id: 'export-modal',
        chord: 'ctrl+e',
        handler: (e) => {
          e.preventDefault?.();
          toggleExportModal();
        },
      },
      {
        id: 'autowire',
        chord: 'w',
        handler: () => {
          autoWireORMH();
        },
      },
      {
        id: 'comment-box',
        chord: 'c',
        handler: () => {
          spawnCommentBox();
        },
      },
      {
        id: 'toggle-bypass',
        chord: 'd',
        handler: () => {
          toggleBypassSelected();
        },
      },
      {
        id: 'duplicate-nodes',
        chord: 'ctrl+d',
        handler: (e) => {
          e.preventDefault?.();
          handleDuplicate();
        },
      },
      {
        id: 'select-all',
        chord: 'ctrl+a',
        handler: (e) => {
          e.preventDefault?.();
          selectAll();
        },
      },
      {
        id: 'delete',
        chord: 'delete',
        handler: () => {
          handleDelete();
        },
      },
      {
        id: 'backspace',
        chord: 'backspace',
        handler: () => {
          handleDelete();
        },
      },
      // Single-letter spawn hotkeys (fire only with no modifiers)
      { id: 'spawn-tex-input', chord: 't', handler: () => spawnNode('textureInput') },
      { id: 'spawn-scalar', chord: '1', handler: () => spawnNode('constantScalar') },
      { id: 'spawn-color', chord: '3', handler: () => spawnNode('constantColor') },
      { id: 'spawn-combiner', chord: 'm', handler: () => spawnNode('channelCombiner') },
      { id: 'spawn-splitter', chord: 's', handler: () => spawnNode('channelSplitter') },
      { id: 'spawn-invert', chord: 'i', handler: () => spawnNode('invert') },
      { id: 'spawn-levels', chord: 'l', handler: () => spawnNode('levels') },
      { id: 'spawn-normal-flip', chord: 'n', handler: () => spawnNode('normalFlip') },
      { id: 'spawn-output', chord: 'o', handler: () => spawnNode('textureOutput') },
      { id: 'spawn-blend', chord: 'b', handler: () => spawnNode('blend') },
    ],
    [
      handleUndo,
      handleRedo,
      fitView,
      autoWireORMH,
      spawnCommentBox,
      toggleBypassSelected,
      handleDuplicate,
      handleDelete,
      selectAll,
      spawnNode,
      togglePalette,
      toggleShortcuts,
      toggleExportModal,
    ]
  );

  useHotkeys(hotkeyBindings, { isModalOpen });
}
