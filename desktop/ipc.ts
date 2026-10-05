import fs from 'node:fs';
import path from 'node:path';
import { app, dialog, shell, ipcMain, BrowserWindow } from 'electron';
import type {
  ShowOpenDialogOptions,
  ShowSaveDialogOptions,
  PickedImageFile,
} from '../web-xyflow/src/shared/ipc';
import { writeAtomicFile } from './atomicSave';
import { logger } from './logger';

let settingsCache: Record<string, unknown> | null = null;
let windowDirtyState = {
  isDirty: false,
  projectName: 'Anthracite_Concrete',
};

export function setWindowDirtyState(isDirty: boolean, projectName: string): void {
  windowDirtyState = { isDirty, projectName: projectName || 'Untitled' };
}

export function getWindowDirtyState(): { isDirty: boolean; projectName: string } {
  return windowDirtyState;
}

function getSettingsPath(): string {
  return path.join(app.getPath('userData'), 'settings.json');
}

function getRecentPath(): string {
  return path.join(app.getPath('userData'), 'recent.json');
}

function loadRecentProjects(): string[] {
  const p = getRecentPath();
  try {
    if (fs.existsSync(p)) {
      const data = fs.readFileSync(p, 'utf-8');
      const list = JSON.parse(data);
      if (Array.isArray(list)) return list.filter((item) => typeof item === 'string');
    }
  } catch (err) {
    logger.warn('Could not read recent.json:', err);
  }
  return [];
}

function saveRecentProjects(list: string[]): void {
  const p = getRecentPath();
  try {
    fs.writeFileSync(p, JSON.stringify(list, null, 2), 'utf-8');
  } catch (err) {
    logger.error('Failed to write recent.json:', err);
  }
}

function addRecentProject(filePath: string): string[] {
  const current = loadRecentProjects();
  const norm = path.resolve(filePath);
  const filtered = current.filter((p) => path.resolve(p) !== norm);
  const updated = [norm, ...filtered].slice(0, 10);
  saveRecentProjects(updated);
  return updated;
}

function removeRecentProject(filePath: string): string[] {
  const current = loadRecentProjects();
  const norm = path.resolve(filePath);
  const updated = current.filter((p) => path.resolve(p) !== norm);
  saveRecentProjects(updated);
  return updated;
}

function getAutosaveDir(): string {
  const d = path.join(app.getPath('userData'), 'autosave');
  if (!fs.existsSync(d)) {
    fs.mkdirSync(d, { recursive: true });
  }
  return d;
}

function loadSettings(): Record<string, unknown> {
  if (settingsCache) return settingsCache;
  const filePath = getSettingsPath();
  try {
    if (fs.existsSync(filePath)) {
      const data = fs.readFileSync(filePath, 'utf-8');
      settingsCache = JSON.parse(data) as Record<string, unknown>;
      return settingsCache;
    }
  } catch (err) {
    logger.warn('Could not read settings.json:', err);
  }
  settingsCache = {};
  return settingsCache;
}

function saveSettings(settings: Record<string, unknown>): void {
  settingsCache = settings;
  const filePath = getSettingsPath();
  try {
    fs.writeFileSync(filePath, JSON.stringify(settings, null, 2), 'utf-8');
  } catch (err) {
    logger.error('Failed to write settings.json:', err);
  }
}

export function registerIpcHandlers(mainWindow: BrowserWindow): void {
  // Pick images dialog
  ipcMain.handle('dialog:pickImages', async (): Promise<PickedImageFile[]> => {
    const result = await dialog.showOpenDialog(mainWindow, {
      title: 'Import Textures',
      properties: ['openFile', 'multiSelections'],
      filters: [
        {
          name: 'Textures (*.png, *.jpg, *.jpeg, *.webp, *.tga)',
          extensions: ['png', 'jpg', 'jpeg', 'webp', 'tga'],
        },
        { name: 'All Files (*.*)', extensions: ['*'] },
      ],
    });

    if (result.canceled || !result.filePaths.length) {
      return [];
    }

    const files: PickedImageFile[] = [];
    for (const filePath of result.filePaths) {
      try {
        const stats = await fs.promises.stat(filePath);
        files.push({
          name: path.basename(filePath),
          path: filePath,
          size: stats.size,
        });
      } catch (err) {
        logger.error(`Failed to stat picked image: ${filePath}`, err);
      }
    }
    return files;
  });

  // Pick directory dialog
  ipcMain.handle('dialog:pickDirectory', async (): Promise<string | null> => {
    const result = await dialog.showOpenDialog(mainWindow, {
      title: 'Select Export Directory',
      properties: ['openDirectory', 'createDirectory'],
    });

    if (result.canceled || !result.filePaths.length) {
      return null;
    }
    return result.filePaths[0];
  });

  // Generic open dialog
  ipcMain.handle(
    'dialog:showOpenDialog',
    async (_event, options?: ShowOpenDialogOptions): Promise<string[] | null> => {
      const result = await dialog.showOpenDialog(mainWindow, {
        title: options?.title,
        defaultPath: options?.defaultPath,
        filters: options?.filters,
        properties: options?.properties || ['openFile'],
      });
      if (result.canceled || !result.filePaths.length) return null;
      return result.filePaths;
    }
  );

  // Generic save dialog
  ipcMain.handle(
    'dialog:showSaveDialog',
    async (_event, options?: ShowSaveDialogOptions): Promise<string | null> => {
      const result = await dialog.showSaveDialog(mainWindow, {
        title: options?.title,
        defaultPath: options?.defaultPath,
        filters: options?.filters,
      });
      if (result.canceled || !result.filePath) return null;
      return result.filePath;
    }
  );

  // Read file as binary Uint8Array
  ipcMain.handle('fs:readFile', async (_event, filePath: string): Promise<Uint8Array> => {
    if (typeof filePath !== 'string' || !filePath) {
      throw new Error('Invalid file path specified');
    }
    const resolved = path.resolve(filePath);
    return await fs.promises.readFile(resolved);
  });

  // Write file as binary
  ipcMain.handle(
    'fs:writeFile',
    async (_event, filePath: string, data: Uint8Array): Promise<void> => {
      if (typeof filePath !== 'string' || !filePath) {
        throw new Error('Invalid file path specified');
      }
      const resolved = path.resolve(filePath);
      const parentDir = path.dirname(resolved);
      if (!fs.existsSync(parentDir)) {
        await fs.promises.mkdir(parentDir, { recursive: true });
      }
      await fs.promises.writeFile(resolved, Buffer.from(data));
    }
  );

  // Open external URL (safe protocols only)
  ipcMain.handle('app:openExternal', async (_event, url: string): Promise<void> => {
    if (typeof url !== 'string') return;
    try {
      const parsed = new URL(url);
      if (['http:', 'https:', 'mailto:'].includes(parsed.protocol)) {
        await shell.openExternal(url);
      } else {
        logger.warn(`Rejected external URL opening for unsafe protocol: ${url}`);
      }
    } catch (err) {
      logger.error('Failed to open external url:', err);
    }
  });

  // Set document dirty status
  ipcMain.handle('app:setDirty', async (_event, isDirty: boolean): Promise<void> => {
    if (!mainWindow.isDestroyed()) {
      mainWindow.setDocumentEdited(Boolean(isDirty));
    }
  });

  // Set dirty state with project name for close guard
  ipcMain.handle(
    'app:setDirtyState',
    async (_event, isDirty: boolean, projectName: string): Promise<void> => {
      setWindowDirtyState(isDirty, projectName);
      if (!mainWindow.isDestroyed()) {
        mainWindow.setDocumentEdited(Boolean(isDirty));
      }
    }
  );

  // Set window title
  ipcMain.handle('app:setTitle', async (_event, title: string): Promise<void> => {
    if (!mainWindow.isDestroyed() && typeof title === 'string') {
      mainWindow.setTitle(title);
    }
  });

  // Atomic file write (P3-T6)
  ipcMain.handle(
    'fs:writeAtomicFile',
    async (_event, filePath: string, data: Uint8Array | string): Promise<void> => {
      if (typeof filePath !== 'string' || !filePath) {
        throw new Error('Invalid file path specified');
      }
      await writeAtomicFile(filePath, data);
    }
  );

  // Recent projects list (P3-T6)
  ipcMain.handle('recent:get', async (): Promise<string[]> => {
    return loadRecentProjects();
  });

  ipcMain.handle('recent:add', async (_event, filePath: string): Promise<string[]> => {
    return addRecentProject(filePath);
  });

  ipcMain.handle('recent:remove', async (_event, filePath: string): Promise<string[]> => {
    return removeRecentProject(filePath);
  });

  ipcMain.handle('recent:clear', async (): Promise<void> => {
    saveRecentProjects([]);
  });

  // Autosave operations (P3-T8)
  ipcMain.handle('autosave:save', async (_event, projectId: string, data: string): Promise<string> => {
    const autosaveDir = getAutosaveDir();
    const filename = `${projectId.replace(/[^a-zA-Z0-9_-]/g, '_')}.tlab.autosave`;
    const targetPath = path.join(autosaveDir, filename);
    await writeAtomicFile(targetPath, data, { createBackup: false });
    return targetPath;
  });

  ipcMain.handle('autosave:delete', async (_event, projectId: string): Promise<void> => {
    const autosaveDir = getAutosaveDir();
    const filename = `${projectId.replace(/[^a-zA-Z0-9_-]/g, '_')}.tlab.autosave`;
    const targetPath = path.join(autosaveDir, filename);
    if (fs.existsSync(targetPath)) {
      try {
        await fs.promises.unlink(targetPath);
      } catch (err) {
        logger.warn('Failed to delete autosave file:', err);
      }
    }
  });

  ipcMain.handle(
    'autosave:list',
    async (): Promise<Array<{ projectId: string; filePath: string; mtimeMs: number }>> => {
      const autosaveDir = getAutosaveDir();
      if (!fs.existsSync(autosaveDir)) return [];
      const entries = await fs.promises.readdir(autosaveDir);
      const results: Array<{ projectId: string; filePath: string; mtimeMs: number }> = [];

      for (const entry of entries) {
        if (entry.endsWith('.tlab.autosave')) {
          const fullPath = path.join(autosaveDir, entry);
          try {
            const stat = await fs.promises.stat(fullPath);
            const projectId = entry.replace(/\.tlab\.autosave$/, '');
            results.push({
              projectId,
              filePath: fullPath,
              mtimeMs: stat.mtimeMs,
            });
          } catch {
            // ignore
          }
        }
      }
      return results;
    }
  );

  ipcMain.handle('autosave:read', async (_event, filePath: string): Promise<string> => {
    const resolved = path.resolve(filePath);
    return await fs.promises.readFile(resolved, 'utf-8');
  });

  // Close guard dialog (P3-T7: TC-337)
  ipcMain.handle(
    'dialog:closeGuard',
    async (_event, projectName: string): Promise<'save' | 'dont-save' | 'cancel'> => {
      const choice = dialog.showMessageBoxSync(mainWindow, {
        type: 'question',
        buttons: ['&Save', "&Don't Save", '&Cancel'],
        defaultId: 0,
        cancelId: 2,
        title: 'TextureLab',
        message: `Do you want to save changes to "${projectName || 'Untitled'}" before proceeding?`,
        detail: 'Your changes will be lost if you choose not to save them.',
      });
      if (choice === 0) return 'save';
      if (choice === 1) return 'dont-save';
      return 'cancel';
    }
  );

  // Get user data setting
  ipcMain.handle(
    'store:getUserData',
    async (_event, key: string, defaultValue?: unknown): Promise<unknown> => {
      const settings = loadSettings();
      return key in settings ? settings[key] : defaultValue;
    }
  );

  // Set user data setting
  ipcMain.handle(
    'store:setUserData',
    async (_event, key: string, value: unknown): Promise<void> => {
      const settings = loadSettings();
      settings[key] = value;
      saveSettings(settings);
    }
  );
}
