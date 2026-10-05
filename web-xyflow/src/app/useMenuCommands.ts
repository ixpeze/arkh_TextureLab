import { useEffect } from 'react';
import { getPlatform } from '../platform/PlatformService';
import type { MenuCommand } from '../shared/ipc';

export interface UseMenuCommandsProps {
  handleUndo: () => void;
  handleRedo: () => void;
  fitView: () => void;
  handleDuplicate: () => void;
  handleDelete: () => void;
  selectAll: () => void;
  toggleExportModal: () => void;
  toggleShortcuts: () => void;
  handleClearGraph: () => void;
  setStatusMessage: (msg: string) => void;
  handleNewProject?: () => void;
  handleOpenDialog?: () => void;
  handleSave?: () => void;
  handleSaveAs?: () => void;
  handleCopy?: () => void;
  handlePaste?: () => void;
  handleCut?: () => void;
}

export function useMenuCommands(props: UseMenuCommandsProps): void {
  useEffect(() => {
    const platform = getPlatform();
    const cleanup = platform.onMenuCommand((cmd: MenuCommand) => {
      switch (cmd) {
        case 'file:new':
          if (props.handleNewProject) props.handleNewProject();
          else props.handleClearGraph();
          break;
        case 'file:open':
          if (props.handleOpenDialog) props.handleOpenDialog();
          break;
        case 'file:save':
          if (props.handleSave) props.handleSave();
          break;
        case 'file:save-as':
          if (props.handleSaveAs) props.handleSaveAs();
          break;
        case 'file:export':
          props.toggleExportModal();
          break;
        case 'edit:undo':
          props.handleUndo();
          break;
        case 'edit:redo':
          props.handleRedo();
          break;
        case 'edit:copy':
          props.handleCopy?.();
          break;
        case 'edit:paste':
          props.handlePaste?.();
          break;
        case 'edit:cut':
          props.handleCut?.();
          break;
        case 'edit:duplicate':
          props.handleDuplicate();
          break;
        case 'edit:select-all':
          props.selectAll();
          break;
        case 'edit:delete':
          props.handleDelete();
          break;
        case 'view:fit':
          props.fitView();
          break;
        case 'help:shortcuts':
          props.toggleShortcuts();
          break;
        default:
          break;
      }
    });

    return cleanup;
  }, [props]);
}
