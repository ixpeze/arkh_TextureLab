import { contextBridge, ipcRenderer, webUtils } from 'electron';
import type {
  LabAPI,
  MenuCommand,
  ShowOpenDialogOptions,
  ShowSaveDialogOptions,
  PickedImageFile,
} from '../web-xyflow/src/shared/ipc';

const labAPI: LabAPI = {
  isElectron: true,
  platform: process.platform as 'win32' | 'darwin' | 'linux',
  version: process.env.APP_VERSION || '0.2.0',

  getPathForFile: (file: File): string => {
    try {
      return webUtils.getPathForFile(file);
    } catch {
      return '';
    }
  },

  pickImages: (): Promise<PickedImageFile[]> => {
    return ipcRenderer.invoke('dialog:pickImages');
  },

  pickDirectory: (): Promise<string | null> => {
    return ipcRenderer.invoke('dialog:pickDirectory');
  },

  showOpenDialog: (options?: ShowOpenDialogOptions): Promise<string[] | null> => {
    return ipcRenderer.invoke('dialog:showOpenDialog', options);
  },

  showSaveDialog: (options?: ShowSaveDialogOptions): Promise<string | null> => {
    return ipcRenderer.invoke('dialog:showSaveDialog', options);
  },

  readFile: async (filePath: string): Promise<Uint8Array> => {
    const data = await ipcRenderer.invoke('fs:readFile', filePath);
    return new Uint8Array(data);
  },

  writeFile: (filePath: string, data: Uint8Array): Promise<void> => {
    return ipcRenderer.invoke('fs:writeFile', filePath, data);
  },

  writeAtomicFile: (filePath: string, data: Uint8Array | string): Promise<void> => {
    return ipcRenderer.invoke('fs:writeAtomicFile', filePath, data);
  },

  getRecentProjects: (): Promise<string[]> => {
    return ipcRenderer.invoke('recent:get');
  },

  addRecentProject: (filePath: string): Promise<string[]> => {
    return ipcRenderer.invoke('recent:add', filePath);
  },

  removeRecentProject: (filePath: string): Promise<string[]> => {
    return ipcRenderer.invoke('recent:remove', filePath);
  },

  clearRecentProjects: (): Promise<void> => {
    return ipcRenderer.invoke('recent:clear');
  },

  saveAutosave: (projectId: string, data: string): Promise<string> => {
    return ipcRenderer.invoke('autosave:save', projectId, data);
  },

  deleteAutosave: (projectId: string): Promise<void> => {
    return ipcRenderer.invoke('autosave:delete', projectId);
  },

  getAutosaves: (): Promise<Array<{ projectId: string; filePath: string; mtimeMs: number }>> => {
    return ipcRenderer.invoke('autosave:list');
  },

  readAutosave: (filePath: string): Promise<string> => {
    return ipcRenderer.invoke('autosave:read', filePath);
  },

  openExternal: (url: string): Promise<void> => {
    return ipcRenderer.invoke('app:openExternal', url);
  },

  setDirty: (isDirty: boolean): Promise<void> => {
    return ipcRenderer.invoke('app:setDirty', isDirty);
  },

  setDirtyState: (isDirty: boolean, projectName: string): Promise<void> => {
    return ipcRenderer.invoke('app:setDirtyState', isDirty, projectName);
  },

  showCloseGuardDialog: (projectName: string): Promise<'save' | 'dont-save' | 'cancel'> => {
    return ipcRenderer.invoke('dialog:closeGuard', projectName);
  },

  setTitle: (title: string): Promise<void> => {
    return ipcRenderer.invoke('app:setTitle', title);
  },

  getUserData: <T = unknown>(key: string, defaultValue?: T): Promise<T> => {
    return ipcRenderer.invoke('store:getUserData', key, defaultValue);
  },

  setUserData: <T = unknown>(key: string, value: T): Promise<void> => {
    return ipcRenderer.invoke('store:setUserData', key, value);
  },

  onMenuCommand: (callback: (cmd: MenuCommand) => void): (() => void) => {
    const handler = (_event: Electron.IpcRendererEvent, cmd: MenuCommand) => {
      callback(cmd);
    };
    ipcRenderer.on('lab:menu-command', handler);
    return () => {
      ipcRenderer.removeListener('lab:menu-command', handler);
    };
  },

  onOpenFile: (callback: (filePath: string) => void): (() => void) => {
    const handler = (_event: Electron.IpcRendererEvent, filePath: string) => {
      callback(filePath);
    };
    ipcRenderer.on('app:second-instance-file', handler);
    return () => {
      ipcRenderer.removeListener('app:second-instance-file', handler);
    };
  },
};

contextBridge.exposeInMainWorld('lab', labAPI);
