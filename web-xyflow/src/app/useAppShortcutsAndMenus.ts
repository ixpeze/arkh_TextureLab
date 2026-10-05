import { useAppHotkeys } from './useAppHotkeys';
import { useMenuCommands } from './useMenuCommands';

export interface UseAppShortcutsAndMenusProps {
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
  handleSave: () => Promise<boolean>;
  handleSaveAs: () => Promise<boolean>;
  handleOpenDialog: () => Promise<void>;
  handleNewProject: () => Promise<void>;
  handleCopy: () => void;
  handlePaste: () => Promise<void>;
  handleCut: () => void;
  handleClearGraph: () => void;
  setStatusMessage: (msg: string) => void;
}

export function useAppShortcutsAndMenus(props: UseAppShortcutsAndMenusProps) {
  useAppHotkeys({
    handleUndo: props.handleUndo,
    handleRedo: props.handleRedo,
    fitView: props.fitView,
    autoWireORMH: props.autoWireORMH,
    spawnCommentBox: props.spawnCommentBox,
    toggleBypassSelected: props.toggleBypassSelected,
    handleDuplicate: props.handleDuplicate,
    handleDelete: props.handleDelete,
    selectAll: props.selectAll,
    spawnNode: props.spawnNode,
    togglePalette: props.togglePalette,
    toggleShortcuts: props.toggleShortcuts,
    toggleExportModal: props.toggleExportModal,
    isModalOpen: props.isModalOpen,
    handleSave: props.handleSave,
    handleSaveAs: props.handleSaveAs,
    handleOpenDialog: props.handleOpenDialog,
    handleNewProject: props.handleNewProject,
    handleCopy: props.handleCopy,
    handlePaste: props.handlePaste,
    handleCut: props.handleCut,
  });

  useMenuCommands({
    handleUndo: props.handleUndo,
    handleRedo: props.handleRedo,
    fitView: props.fitView,
    handleDuplicate: props.handleDuplicate,
    handleDelete: props.handleDelete,
    selectAll: props.selectAll,
    toggleExportModal: props.toggleExportModal,
    toggleShortcuts: props.toggleShortcuts,
    handleClearGraph: props.handleClearGraph,
    setStatusMessage: props.setStatusMessage,
    handleNewProject: props.handleNewProject,
    handleOpenDialog: props.handleOpenDialog,
    handleSave: props.handleSave,
    handleSaveAs: props.handleSaveAs,
    handleCopy: props.handleCopy,
    handlePaste: props.handlePaste,
    handleCut: props.handleCut,
  });
}
