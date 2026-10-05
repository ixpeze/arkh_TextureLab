import path from 'node:path';
import { app, BrowserWindow, dialog, session } from 'electron';
import { initLogger, logger } from './logger';
import { restoreWindowState, trackWindowState, MIN_WIDTH, MIN_HEIGHT } from './windowState';
import { registerAppProtocolPrivileges, setupAppProtocol } from './protocol';
import { registerIpcHandlers } from './ipc';
import { setupApplicationMenu } from './menu';

// Force dedicated high-performance GPU on hybrid/dual-GPU laptops (02 §7)
app.commandLine.appendSwitch('force_high_performance_gpu');

// Early logger init
initLogger();

// Register custom protocol privileges before app is ready
registerAppProtocolPrivileges();

const isDev = Boolean(process.env.VITE_DEV_SERVER_URL);
const devServerUrl = process.env.VITE_DEV_SERVER_URL || 'http://localhost:5173';

// Enforce single instance lock (P2-T8)
const gotTheLock = app.requestSingleInstanceLock();
if (!gotTheLock) {
  logger.info('Another instance is already running. Quitting.');
  app.quit();
}

let mainWindow: BrowserWindow | null = null;

function getIconPath(): string {
  // Try custom icon in build directory, then fallback to packaged/asset icon
  const candidates = [
    path.join(__dirname, '../build/icon.ico'),
    path.join(__dirname, '../../build/icon.ico'),
    path.join(app.getAppPath(), 'build/icon.ico'),
    path.join(__dirname, '../dist/favicon.ico'),
  ];
  for (const candidate of candidates) {
    if (require('node:fs').existsSync(candidate)) {
      return candidate;
    }
  }
  return '';
}

function extractFileArg(argv: string[]): string | null {
  for (let i = 1; i < argv.length; i++) {
    const arg = argv[i];
    if (!arg.startsWith('-') && !arg.startsWith('--')) {
      if (arg.endsWith('.tlab') || arg.endsWith('.png') || arg.endsWith('.jpg')) {
        return arg;
      }
    }
  }
  return null;
}

async function createWindow(): Promise<BrowserWindow> {
  const { bounds, isMaximized } = restoreWindowState();

  const iconPath = getIconPath();

  const win = new BrowserWindow({
    x: bounds.x,
    y: bounds.y,
    width: bounds.width,
    height: bounds.height,
    minWidth: MIN_WIDTH,
    minHeight: MIN_HEIGHT,
    title: 'TextureLab',
    icon: iconPath || undefined,
    show: false,
    backgroundColor: '#18181b', // Dark zinc background matching target theme
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webSecurity: true,
      spellcheck: false,
    },
  });

  // Track window state on move/resize
  trackWindowState(win);

  // Security: deny new window creation (P2-T3)
  win.webContents.setWindowOpenHandler(() => {
    logger.warn('Blocked window open attempt');
    return { action: 'deny' };
  });

  // Security: block navigation to external URLs (P2-T3)
  win.webContents.on('will-navigate', (event, navigationUrl) => {
    try {
      const parsed = new URL(navigationUrl);
      if (isDev && parsed.origin === new URL(devServerUrl).origin) {
        return;
      }
      if (!isDev && parsed.protocol === 'app:') {
        return;
      }
    } catch {
      // invalid URL
    }
    event.preventDefault();
    logger.warn(`Blocked navigation to: ${navigationUrl}`);
  });

  // Crash handling (P2-T9, TC-218)
  win.webContents.on('render-process-gone', (_event, details) => {
    logger.error('Render process gone:', details);
    const choice = dialog.showMessageBoxSync(win, {
      type: 'error',
      title: 'TextureLab Renderer Crash',
      message: 'The graphics or user interface process crashed unexpectedly.',
      detail: `Reason: ${details.reason} (exit code ${details.exitCode}).\nWould you like to reload or exit?`,
      buttons: ['&Reload', '&Quit', '&Open Logs'],
      defaultId: 0,
    });

    if (choice === 0) {
      win.reload();
    } else if (choice === 2) {
      logger.openLogsFolder();
    } else {
      app.quit();
    }
  });

  // Show window once ready to avoid white flash
  win.once('ready-to-show', () => {
    if (isMaximized) {
      win.maximize();
    }
    win.show();
  });

  // Load URL
  if (isDev) {
    logger.info(`Loading development URL: ${devServerUrl}`);
    await win.loadURL(devServerUrl);
  } else {
    logger.info('Loading production app://./index.html');
    await win.loadURL('app://./index.html');
  }

  // Setup menus
  setupApplicationMenu(win, isDev);
  registerIpcHandlers(win);

  return win;
}

// Security: configure CSP and deny permissions (P2-T3)
function setupSessionSecurity(): void {
  const sess = session.defaultSession;

  sess.webRequest.onHeadersReceived((details, callback) => {
    const csp = isDev
      ? "default-src 'self' 'unsafe-inline' blob: data: http://localhost:* ws://localhost:*; script-src 'self' 'unsafe-inline' 'unsafe-eval' blob:; style-src 'self' 'unsafe-inline'; img-src 'self' blob: data:; font-src 'self' data:; worker-src 'self' blob:; connect-src 'self' http://localhost:* ws://localhost:*;"
      : "default-src 'self'; script-src 'self' blob:; style-src 'self' 'unsafe-inline'; img-src 'self' blob: data:; font-src 'self' data:; worker-src 'self' blob:; connect-src 'none';";

    const responseHeaders = { ...details.responseHeaders };
    responseHeaders['Content-Security-Policy'] = [csp];

    callback({ responseHeaders });
  });

  sess.setPermissionRequestHandler((_webContents, permission, callback) => {
    logger.warn(`Permission request denied: ${permission}`);
    callback(false);
  });
}

// App lifecycle
app.whenReady().then(async () => {
  // Determine dist folder containing index.html
  const candidateDirs = [
    path.join(__dirname, '../dist'),
    path.join(__dirname, 'dist'),
    path.join(app.getAppPath(), 'dist'),
    path.join(__dirname, '../web-xyflow/dist'),
  ];
  let distDir = candidateDirs[0];
  for (const c of candidateDirs) {
    if (require('node:fs').existsSync(path.join(c, 'index.html'))) {
      distDir = c;
      break;
    }
  }

  setupAppProtocol(distDir);
  setupSessionSecurity();

  mainWindow = await createWindow();

  // Forward initial file argument if passed
  const initialFile = extractFileArg(process.argv);
  if (initialFile) {
    mainWindow.webContents.once('did-finish-load', () => {
      mainWindow?.webContents.send('app:second-instance-file', path.resolve(initialFile));
    });
  }

  app.on('activate', async () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      mainWindow = await createWindow();
    }
  });
});

// Single instance event (P2-T8, TC-216)
app.on('second-instance', (_event, argv) => {
  if (mainWindow) {
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.focus();

    const fileArg = extractFileArg(argv);
    if (fileArg) {
      mainWindow.webContents.send('app:second-instance-file', path.resolve(fileArg));
    }
  }
});

// Global crash / child-process handlers (P2-T9)
app.on('child-process-gone', (_event, details) => {
  logger.warn('Child process gone:', details);
});

process.on('uncaughtException', (err) => {
  logger.error('Uncaught Exception in main process:', err);
  if (mainWindow && !mainWindow.isDestroyed()) {
    dialog.showMessageBoxSync(mainWindow, {
      type: 'error',
      title: 'Unexpected Error',
      message: 'An unexpected error occurred in TextureLab.',
      detail: err.stack || err.message,
      buttons: ['OK'],
    });
  }
});

process.on('unhandledRejection', (reason) => {
  logger.error('Unhandled Promise Rejection in main process:', reason);
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
