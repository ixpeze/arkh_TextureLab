import type {
  IPlatformService,
  DirectoryExportTarget,
} from './PlatformService';
import type {
  MenuCommand,
  ShowOpenDialogOptions,
  ShowSaveDialogOptions,
  PickedImageFile,
} from '../shared/ipc';

export class ElectronPlatformService implements IPlatformService {
  public readonly isElectron = true;
  public readonly platform: 'win32' | 'darwin' | 'linux';
  public readonly version: string;

  constructor() {
    this.platform = window.lab?.platform || 'win32';
    this.version = window.lab?.version || '0.2.0';
  }

  public isFolderExportSupported(): boolean {
    return true;
  }

  public async pickImages(): Promise<PickedImageFile[]> {
    if (!window.lab) return [];
    return await window.lab.pickImages();
  }

  public async pickDirectory(): Promise<DirectoryExportTarget | null> {
    if (!window.lab) return null;
    const selectedPath = await window.lab.pickDirectory();
    if (!selectedPath) return null;
    const name = selectedPath.split(/[\\/]/).filter(Boolean).pop() || selectedPath;
    return {
      type: 'native',
      name,
      path: selectedPath,
    };
  }

  public async showOpenDialog(options?: ShowOpenDialogOptions): Promise<string[] | null> {
    if (!window.lab) return null;
    return await window.lab.showOpenDialog(options);
  }

  public async showSaveDialog(options?: ShowSaveDialogOptions): Promise<string | null> {
    if (!window.lab) return null;
    return await window.lab.showSaveDialog(options);
  }

  public async readFile(filePath: string): Promise<Uint8Array> {
    if (!window.lab) throw new Error('Electron API not available');
    return await window.lab.readFile(filePath);
  }

  public async writeFile(filePath: string, data: Uint8Array): Promise<void> {
    if (!window.lab) throw new Error('Electron API not available');
    await window.lab.writeFile(filePath, data);
  }

  public getPathForFile(file: File): string {
    if (!window.lab) return '';
    return window.lab.getPathForFile(file);
  }

  public async openExternal(url: string): Promise<void> {
    if (!window.lab) return;
    await window.lab.openExternal(url);
  }

  public async getUserData<T = unknown>(key: string, defaultValue?: T): Promise<T> {
    if (!window.lab) return defaultValue as T;
    return await window.lab.getUserData<T>(key, defaultValue);
  }

  public async setUserData<T = unknown>(key: string, value: T): Promise<void> {
    if (!window.lab) return;
    await window.lab.setUserData(key, value);
  }

  public async setDirty(dirty: boolean): Promise<void> {
    if (!window.lab) return;
    await window.lab.setDirty(dirty);
  }

  public async setTitle(title: string): Promise<void> {
    if (!window.lab) return;
    await window.lab.setTitle(title);
  }

  public onMenuCommand(callback: (command: MenuCommand) => void): () => void {
    if (!window.lab) return () => {};
    return window.lab.onMenuCommand(callback);
  }

  public onOpenFile(callback: (filePath: string) => void): () => void {
    if (!window.lab) return () => {};
    return window.lab.onOpenFile(callback);
  }

  public async exportFiles(
    files: { filename: string; blob: Blob }[],
    target: DirectoryExportTarget
  ): Promise<void> {
    if (!window.lab) throw new Error('Electron API not available');
    if (target.type !== 'native' || !target.path) {
      throw new Error('Invalid native export target');
    }

    const basePath = target.path.replace(/[\\/]+$/, '');
    for (const file of files) {
      const normalizedRelative = file.filename.replace(/^[\\/]+/, '').replace(/\//g, '\\');
      const targetFilePath = `${basePath}\\${normalizedRelative}`;
      const buffer = new Uint8Array(await file.blob.arrayBuffer());
      await window.lab.writeFile(targetFilePath, buffer);
    }
  }
}
