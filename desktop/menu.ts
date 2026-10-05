import { app, Menu, MenuItemConstructorOptions, BrowserWindow, dialog } from 'electron';
import type { MenuCommand } from '../web-xyflow/src/shared/ipc';
import { logger } from './logger';

export function setupApplicationMenu(mainWindow: BrowserWindow, isDev: boolean): void {
  const sendCommand = (cmd: MenuCommand) => {
    if (!mainWindow.isDestroyed()) {
      mainWindow.webContents.send('lab:menu-command', cmd);
    }
  };

  const template: MenuItemConstructorOptions[] = [
    {
      label: '&File',
      submenu: [
        {
          label: '&New Project',
          accelerator: 'CommandOrControl+N',
          click: () => sendCommand('file:new'),
        },
        {
          label: '&Open Project...',
          accelerator: 'CommandOrControl+O',
          click: () => sendCommand('file:open'),
        },
        {
          label: '&Save',
          accelerator: 'CommandOrControl+S',
          click: () => sendCommand('file:save'),
        },
        {
          label: 'Save &As...',
          accelerator: 'CommandOrControl+Shift+S',
          click: () => sendCommand('file:save-as'),
        },
        { type: 'separator' },
        {
          label: '&Export Maps...',
          accelerator: 'CommandOrControl+E',
          click: () => sendCommand('file:export'),
        },
        { type: 'separator' },
        {
          label: 'E&xit',
          accelerator: 'Alt+F4',
          click: () => {
            app.quit();
          },
        },
      ],
    },
    {
      label: '&Edit',
      submenu: [
        {
          label: '&Undo',
          accelerator: 'CommandOrControl+Z',
          click: () => sendCommand('edit:undo'),
        },
        {
          label: '&Redo',
          accelerator: 'CommandOrControl+Y',
          click: () => sendCommand('edit:redo'),
        },
        { type: 'separator' },
        {
          label: 'Cu&t',
          accelerator: 'CommandOrControl+X',
          click: () => sendCommand('edit:cut'),
        },
        {
          label: '&Copy',
          accelerator: 'CommandOrControl+C',
          click: () => sendCommand('edit:copy'),
        },
        {
          label: '&Paste',
          accelerator: 'CommandOrControl+V',
          click: () => sendCommand('edit:paste'),
        },
        {
          label: '&Duplicate',
          accelerator: 'CommandOrControl+D',
          click: () => sendCommand('edit:duplicate'),
        },
        { type: 'separator' },
        {
          label: 'Select &All',
          accelerator: 'CommandOrControl+A',
          click: () => sendCommand('edit:select-all'),
        },
        {
          label: '&Delete',
          accelerator: 'Delete',
          click: () => sendCommand('edit:delete'),
        },
      ],
    },
    {
      label: '&View',
      submenu: [
        {
          label: '&Fit View',
          accelerator: 'F',
          click: () => sendCommand('view:fit'),
        },
        {
          label: 'Zoom &In',
          accelerator: 'CommandOrControl+=',
          click: () => sendCommand('view:zoom-in'),
        },
        {
          label: 'Zoom &Out',
          accelerator: 'CommandOrControl+-',
          click: () => sendCommand('view:zoom-out'),
        },
        { type: 'separator' },
        {
          label: 'Toggle &Inspector',
          accelerator: 'I',
          click: () => sendCommand('view:toggle-inspector'),
        },
        {
          label: 'Toggle &Node Library',
          accelerator: 'L',
          click: () => sendCommand('view:toggle-library'),
        },
        ...(isDev
          ? [
              { type: 'separator' as const },
              {
                label: '&Reload',
                accelerator: 'CommandOrControl+R',
                click: () => {
                  mainWindow.reload();
                },
              },
              {
                label: 'Toggle &Developer Tools',
                accelerator: 'F12',
                click: () => {
                  mainWindow.webContents.toggleDevTools();
                },
              },
            ]
          : []),
      ],
    },
    {
      label: '&Help',
      submenu: [
        {
          label: '&Keyboard Shortcuts',
          click: () => sendCommand('help:shortcuts'),
        },
        {
          label: 'Open &Logs Folder',
          click: () => {
            logger.openLogsFolder();
          },
        },
        { type: 'separator' },
        {
          label: '&About TextureLab',
          click: () => {
            dialog.showMessageBox(mainWindow, {
              type: 'info',
              title: 'About TextureLab',
              message: 'ARKH TextureLab',
              detail: `Version: ${app.getVersion()}\nHigh-performance PBR texture authoring and channel packing.\nArchitecture: x64 Windows\nElectron: ${process.versions.electron}\nChromium: ${process.versions.chrome}`,
              buttons: ['OK'],
            });
          },
        },
      ],
    },
  ];

  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);
}
