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
  public readonly version = '1.0.0';

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

  public async writeAtomicFile(pathOrName: string, data: Uint8Array | string): Promise<void> {
    const blob = typeof data === 'string' ? new Blob([data], { type: 'application/json' }) : new Blob([data as unknown as BlobPart]);
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = pathOrName.split('/').pop() || 'project.tlab';
    a.click();
    URL.revokeObjectURL(url);
  }

  public async getRecentProjects(): Promise<string[]> {
    try {
      const data = localStorage.getItem('tl_recent_projects');
      if (data) return JSON.parse(data);
    } catch {
      // fallback
    }
    return [];
  }

  public async addRecentProject(filePath: string): Promise<string[]> {
    const list = await this.getRecentProjects();
    const filtered = list.filter((p) => p !== filePath);
    const updated = [filePath, ...filtered].slice(0, 10);
    try {
      localStorage.setItem('tl_recent_projects', JSON.stringify(updated));
    } catch {
      // fallback
    }
    return updated;
  }

  public async removeRecentProject(filePath: string): Promise<string[]> {
    const list = await this.getRecentProjects();
    const updated = list.filter((p) => p !== filePath);
    try {
      localStorage.setItem('tl_recent_projects', JSON.stringify(updated));
    } catch {
      // fallback
    }
    return updated;
  }

  public async clearRecentProjects(): Promise<void> {
    try {
      localStorage.removeItem('tl_recent_projects');
    } catch {
      // fallback
    }
  }

  public async saveAutosave(projectId: string, data: string): Promise<string> {
    try {
      localStorage.setItem(`tl_autosave_${projectId}`, data);
      localStorage.setItem(`tl_autosave_mtime_${projectId}`, String(Date.now()));
    } catch {
      // fallback
    }
    return `localStorage://tl_autosave_${projectId}`;
  }

  public async deleteAutosave(projectId: string): Promise<void> {
    try {
      localStorage.removeItem(`tl_autosave_${projectId}`);
      localStorage.removeItem(`tl_autosave_mtime_${projectId}`);
    } catch {
      // fallback
    }
  }

  public async getAutosaves(): Promise<Array<{ projectId: string; filePath: string; mtimeMs: number }>> {
    const results: Array<{ projectId: string; filePath: string; mtimeMs: number }> = [];
    try {
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k && k.startsWith('tl_autosave_') && !k.startsWith('tl_autosave_mtime_')) {
          const projectId = k.replace(/^tl_autosave_/, '');
          const mtimeStr = localStorage.getItem(`tl_autosave_mtime_${projectId}`);
          results.push({
            projectId,
            filePath: k,
            mtimeMs: mtimeStr ? Number(mtimeStr) : Date.now(),
          });
        }
      }
    } catch {
      // fallback
    }
    return results;
  }

  public async readAutosave(filePath: string): Promise<string> {
    try {
      return localStorage.getItem(filePath) || '';
    } catch {
      return '';
    }
  }

  public async setDirty(dirty: boolean): Promise<void> {
    if (dirty) {
      window.onbeforeunload = () => 'You have unsaved changes.';
    } else {
      window.onbeforeunload = null;
    }
  }

  public async setDirtyState(dirty: boolean, projectName: string): Promise<void> {
    await this.setDirty(dirty);
    await this.setTitle(`${projectName}${dirty ? '*' : ''} - TextureLab`);
  }

  public async showCloseGuardDialog(projectName: string): Promise<'save' | 'dont-save' | 'cancel'> {
    const confirmed = window.confirm(`Save changes to "${projectName}" before closing?`);
    return confirmed ? 'save' : 'dont-save';
  }

  public async setTitle(title: string): Promise<void> {
    document.title = title;
  }

  public async getRecentLogs(_limit?: number): Promise<string[]> {
    return ['[INFO] Web platform environment'];
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
