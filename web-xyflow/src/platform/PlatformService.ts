import type {
  MenuCommand,
  ShowOpenDialogOptions,
  ShowSaveDialogOptions,
  PickedImageFile,
} from '../shared/ipc';
import { ElectronPlatformService } from './electronPlatform';
import { WebPlatformService } from './webPlatform';

export interface DirectoryExportTarget {
  type: 'native' | 'handle';
  name: string;
  path?: string;
  handle?: FileSystemDirectoryHandle;
}

export interface IPlatformService {
  readonly isElectron: boolean;
  readonly platform: 'win32' | 'darwin' | 'linux' | 'browser';
  readonly version: string;

  isFolderExportSupported(): boolean;
  pickImages(): Promise<PickedImageFile[]>;
  pickDirectory(): Promise<DirectoryExportTarget | null>;
  showOpenDialog(options?: ShowOpenDialogOptions): Promise<string[] | null>;
  showSaveDialog(options?: ShowSaveDialogOptions): Promise<string | null>;
  readFile(pathOrName: string): Promise<Uint8Array>;
  writeFile(pathOrName: string, data: Uint8Array): Promise<void>;
  getPathForFile(file: File): string;
  openExternal(url: string): Promise<void>;
  getUserData<T = unknown>(key: string, defaultValue?: T): Promise<T>;
  setUserData<T = unknown>(key: string, value: T): Promise<void>;
  setDirty(dirty: boolean): Promise<void>;
  setTitle(title: string): Promise<void>;
  onMenuCommand(callback: (command: MenuCommand) => void): () => void;
  onOpenFile(callback: (filePath: string) => void): () => void;
  exportFiles(
    files: { filename: string; blob: Blob }[],
    target: DirectoryExportTarget
  ): Promise<void>;
}

let platformInstance: IPlatformService | null = null;

export function getPlatform(): IPlatformService {
  if (!platformInstance) {
    if (typeof window !== 'undefined' && window.lab && window.lab.isElectron) {
      platformInstance = new ElectronPlatformService();
    } else {
      platformInstance = new WebPlatformService();
    }
  }
  return platformInstance;
}
