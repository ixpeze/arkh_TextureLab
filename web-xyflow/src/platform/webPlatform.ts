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

export class WebPlatformService implements IPlatformService {
  public readonly isElectron = false;
  public readonly platform = 'browser' as const;
  public readonly version = '0.2.0';

  public isFolderExportSupported(): boolean {
    return typeof window !== 'undefined' && 'showDirectoryPicker' in window;
  }

  public async pickImages(): Promise<PickedImageFile[]> {
    return new Promise((resolve) => {
      const input = document.createElement('input');
      input.type = 'file';
      input.multiple = true;
      input.accept = 'image/png,image/jpeg,image/webp,image/x-tga,.tga';

      input.onchange = () => {
        if (!input.files || input.files.length === 0) {
          resolve([]);
          return;
        }
        const results: PickedImageFile[] = Array.from(input.files).map((f) => ({
          name: f.name,
          path: f.name,
          size: f.size,
        }));
        resolve(results);
      };

      input.oncancel = () => resolve([]);
      input.click();
    });
  }

  public async pickDirectory(): Promise<DirectoryExportTarget | null> {
    if (typeof window === 'undefined') return null;
    const picker = (
      window as unknown as {
        showDirectoryPicker?: (opts: { mode: string }) => Promise<FileSystemDirectoryHandle>;
      }
    ).showDirectoryPicker;

    if (!picker) return null;

    try {
      const handle = await picker({ mode: 'readwrite' });
      return {
        type: 'handle',
        name: handle.name,
        handle,
      };
    } catch (err: unknown) {
      if (
        err &&
        typeof err === 'object' &&
        'name' in err &&
        (err as { name: string }).name === 'AbortError'
      ) {
        return null;
      }
      console.warn('Web directory picker rejected:', err);
      return null;
    }
  }

  public async showOpenDialog(_options?: ShowOpenDialogOptions): Promise<string[] | null> {
    const files = await this.pickImages();
    return files.length ? files.map((f) => f.name) : null;
  }

  public async showSaveDialog(_options?: ShowSaveDialogOptions): Promise<string | null> {
    return null;
  }

  public async readFile(_pathOrName: string): Promise<Uint8Array> {
    throw new Error('Direct readFile not supported in web browser environment');
  }

  public async writeFile(pathOrName: string, data: Uint8Array): Promise<void> {
    const blob = new Blob([data as unknown as BlobPart]);
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = pathOrName.split('/').pop() || 'download';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  public getPathForFile(file: File): string {
    return file.name;
  }

  public async openExternal(url: string): Promise<void> {
    window.open(url, '_blank', 'noopener,noreferrer');
  }

  public async getUserData<T = unknown>(key: string, defaultValue?: T): Promise<T> {
    try {
      const raw = localStorage.getItem(`tl_${key}`);
      if (raw !== null) {
        return JSON.parse(raw) as T;
      }
    } catch {
      // fallback
    }
    return defaultValue as T;
  }

  public async setUserData<T = unknown>(key: string, value: T): Promise<void> {
    try {
      localStorage.setItem(`tl_${key}`, JSON.stringify(value));
    } catch {
      // fallback
    }
  }

  public async setDirty(dirty: boolean): Promise<void> {
    if (dirty) {
      window.onbeforeunload = () => 'You have unsaved changes.';
    } else {
      window.onbeforeunload = null;
    }
  }

  public async setTitle(title: string): Promise<void> {
    document.title = title;
  }

  public onMenuCommand(_callback: (command: MenuCommand) => void): () => void {
    return () => {};
  }

  public onOpenFile(_callback: (filePath: string) => void): () => void {
    return () => {};
  }

  public async exportFiles(
    files: { filename: string; blob: Blob }[],
    target: DirectoryExportTarget
  ): Promise<void> {
    if (target.type !== 'handle' || !target.handle) {
      throw new Error('Web environment requires FileSystemDirectoryHandle for folder export');
    }

    const dirHandle = target.handle;
    for (const f of files) {
      const parts = f.filename.split('/').filter(Boolean);
      let targetDir = dirHandle;
      for (let i = 0; i < parts.length - 1; i++) {
        targetDir = await targetDir.getDirectoryHandle(parts[i], { create: true });
      }
      const leafName = parts[parts.length - 1];
      const fileHandle = await targetDir.getFileHandle(leafName, { create: true });
      const writable = await fileHandle.createWritable();
      await writable.write(f.blob);
      await writable.close();
    }
  }
}
