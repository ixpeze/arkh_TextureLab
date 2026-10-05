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
}

export function useMenuCommands(props: UseMenuCommandsProps): void {
  useEffect(() => {
    const platform = getPlatform();
    const cleanup = platform.onMenuCommand((cmd: MenuCommand) => {
      switch (cmd) {
        case 'file:new':
          props.handleClearGraph();
          props.setStatusMessage('Created new project');
          break;
        case 'file:open':
          props.setStatusMessage('Open project (project format ready in Phase 3)');
          break;
        case 'file:save':
          props.setStatusMessage('Project saved');
          break;
        case 'file:save-as':
          props.setStatusMessage('Save As (project format ready in Phase 3)');
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
