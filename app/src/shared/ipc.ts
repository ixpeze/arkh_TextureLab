/**
 * Shared IPC contracts and types for ARKH TextureLab.
 * Used by both Electron main/preload (desktop/) and renderer (src/).
 */

export type MenuCommand =
  // File
  | 'file:new'
  | 'file:open'
  | 'file:save'
  | 'file:save-as'
  | 'file:recent'
  | 'file:export'
  | 'file:quit'
  // Edit
  | 'edit:undo'
  | 'edit:redo'
  | 'edit:cut'
  | 'edit:copy'
  | 'edit:paste'
  | 'edit:duplicate'
  | 'edit:select-all'
  | 'edit:delete'
  // View
  | 'view:fit'
  | 'view:zoom-in'
  | 'view:zoom-out'
  | 'view:toggle-inspector'
  | 'view:toggle-library'
  | 'view:reload'
  // Help
  | 'help:shortcuts'
  | 'help:about'
  | 'help:open-logs';

export interface OpenDialogFilter {
  name: string;
  extensions: string[];
}

export interface ShowOpenDialogOptions {
  title?: string;
  defaultPath?: string;
  filters?: OpenDialogFilter[];
  properties?: Array<
    | 'openFile'
    | 'openDirectory'
    | 'multiSelections'
    | 'showHiddenFiles'
    | 'createDirectory'
    | 'dontAddToRecent'
  >;
}

export interface ShowSaveDialogOptions {
  title?: string;
  defaultPath?: string;
  filters?: OpenDialogFilter[];
}

export interface PickedImageFile {
  name: string;
  path: string;
  size: number;
  dataUrl?: string;
}

export interface IpcFileReadResult {
  data: Uint8Array;
  mimeType?: string;
}

export interface LabAPI {
  readonly isElectron: boolean;
  readonly platform: 'win32' | 'darwin' | 'linux';
  readonly version: string;

  // File dialogs & filesystem
  getPathForFile: (file: File) => string;
  pickImages: () => Promise<PickedImageFile[]>;
  pickDirectory: () => Promise<string | null>;
  showOpenDialog: (options?: ShowOpenDialogOptions) => Promise<string[] | null>;
  showSaveDialog: (options?: ShowSaveDialogOptions) => Promise<string | null>;
  readFile: (filePath: string) => Promise<Uint8Array>;
  writeFile: (filePath: string, data: Uint8Array) => Promise<void>;
  writeAtomicFile: (filePath: string, data: Uint8Array | string) => Promise<void>;

  // Recent projects
  getRecentProjects: () => Promise<string[]>;
  addRecentProject: (filePath: string) => Promise<string[]>;
  removeRecentProject: (filePath: string) => Promise<string[]>;
  clearRecentProjects: () => Promise<void>;

  // Autosave & recovery
  saveAutosave: (projectId: string, data: string) => Promise<string>;
  deleteAutosave: (projectId: string) => Promise<void>;
  getAutosaves: () => Promise<Array<{ projectId: string; filePath: string; mtimeMs: number }>>;
  readAutosave: (filePath: string) => Promise<string>;

  // Shell & window
  openExternal: (url: string) => Promise<void>;
  setDirty: (isDirty: boolean) => Promise<void>;
  setDirtyState: (isDirty: boolean, projectName: string) => Promise<void>;
  setTitle: (title: string) => Promise<void>;
  showCloseGuardDialog: (projectName: string) => Promise<'save' | 'dont-save' | 'cancel'>;

  // Local persistent state
  getUserData: <T = unknown>(key: string, defaultValue?: T) => Promise<T>;
  setUserData: <T = unknown>(key: string, value: T) => Promise<void>;

  // Diagnostics & logging (P6-T4)
  getRecentLogs?: (limit?: number) => Promise<string[]>;

  // Event listeners
  onMenuCommand: (callback: (command: MenuCommand) => void) => () => void;
  onOpenFile: (callback: (filePath: string) => void) => () => void;
}

declare global {
  interface Window {
    lab?: LabAPI;
  }
}
