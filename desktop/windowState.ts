import fs from 'node:fs';
import path from 'node:path';
import { app, BrowserWindow, screen, Rectangle } from 'electron';
import { logger } from './logger';

export const MIN_WIDTH = 1100;
export const MIN_HEIGHT = 680;
export const DEFAULT_WIDTH = 1380;
export const DEFAULT_HEIGHT = 880;

interface WindowState {
  x: number;
  y: number;
  width: number;
  height: number;
  isMaximized: boolean;
}

let stateFilePath: string | null = null;
let saveTimeout: NodeJS.Timeout | null = null;

function getStateFilePath(): string {
  if (!stateFilePath) {
    stateFilePath = path.join(app.getPath('userData'), 'window.json');
  }
  return stateFilePath;
}

export function restoreWindowState(): { bounds: Rectangle; isMaximized: boolean } {
  const filePath = getStateFilePath();
  let savedState: Partial<WindowState> | null = null;

  try {
    if (fs.existsSync(filePath)) {
      const data = fs.readFileSync(filePath, 'utf-8');
      savedState = JSON.parse(data) as Partial<WindowState>;
    }
  } catch (err) {
    logger.warn('Could not read window.json, using defaults:', err);
  }

  const primaryDisplay = screen.getPrimaryDisplay();
  const workArea = primaryDisplay.workArea;

  let width = typeof savedState?.width === 'number' ? savedState.width : DEFAULT_WIDTH;
  let height = typeof savedState?.height === 'number' ? savedState.height : DEFAULT_HEIGHT;

  width = Math.max(MIN_WIDTH, width);
  height = Math.max(MIN_HEIGHT, height);

  let targetRect: Rectangle = {
    x: typeof savedState?.x === 'number' ? savedState.x : Math.round(workArea.x + (workArea.width - width) / 2),
    y: typeof savedState?.y === 'number' ? savedState.y : Math.round(workArea.y + (workArea.height - height) / 2),
    width,
    height,
  };

  // Clamp to display work area (handles unplugged secondary monitors)
  const display = screen.getDisplayMatching(targetRect) || primaryDisplay;
  const da = display.workArea;

  width = Math.min(width, da.width);
  height = Math.min(height, da.height);

  targetRect = {
    x: Math.max(da.x, Math.min(targetRect.x, da.x + da.width - width)),
    y: Math.max(da.y, Math.min(targetRect.y, da.y + da.height - height)),
    width,
    height,
  };

  const isMaximized = Boolean(savedState?.isMaximized);

  return { bounds: targetRect, isMaximized };
}

export function trackWindowState(window: BrowserWindow): void {
  const saveState = () => {
    if (window.isDestroyed()) return;
    try {
      const isMaximized = window.isMaximized();
      let bounds = window.getBounds();
      if (isMaximized) {
        // If maximized, keep the restored non-maximized bounds if available
        bounds = window.getNormalBounds();
      }

      const state: WindowState = {
        x: bounds.x,
        y: bounds.y,
        width: Math.max(MIN_WIDTH, bounds.width),
        height: Math.max(MIN_HEIGHT, bounds.height),
        isMaximized,
      };

      const filePath = getStateFilePath();
      fs.writeFileSync(filePath, JSON.stringify(state, null, 2), 'utf-8');
    } catch (err) {
      logger.error('Failed to save window state:', err);
    }
  };

  const debounceSave = () => {
    if (saveTimeout) clearTimeout(saveTimeout);
    saveTimeout = setTimeout(saveState, 500);
  };

  window.on('resize', debounceSave);
  window.on('move', debounceSave);
  window.on('close', saveState);
}
