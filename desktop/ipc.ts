import fs from 'node:fs';
import path from 'node:path';
import { app, dialog, shell, ipcMain, BrowserWindow } from 'electron';
import type {
  ShowOpenDialogOptions,
  ShowSaveDialogOptions,
  PickedImageFile,
} from '../web-xyflow/src/shared/ipc';
import { logger } from './logger';

let settingsCache: Record<string, unknown> | null = null;

function getSettingsPath(): string {
  return path.join(app.getPath('userData'), 'settings.json');
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

  // Set window title
  ipcMain.handle('app:setTitle', async (_event, title: string): Promise<void> => {
    if (!mainWindow.isDestroyed() && typeof title === 'string') {
      mainWindow.setTitle(title);
    }
  });

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
