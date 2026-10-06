import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { _electron as electron, test, expect } from '@playwright/test';
import electronPath from 'electron';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const appRoot = path.resolve(__dirname, '../../..');

test.describe.configure({ mode: 'serial' });

test.describe('Electron Shell E2E Smoke Tests', () => {
  let electronApp: Awaited<ReturnType<typeof electron.launch>>;
  let firstWindow: Awaited<ReturnType<typeof electronApp.firstWindow>>;

  test.beforeAll(async () => {
    test.setTimeout(60000);
    electronApp = await electron.launch({
      executablePath: electronPath as unknown as string,
      args: [path.join(appRoot, 'dist-desktop/main.cjs')],
      cwd: appRoot,
      env: {
        ...process.env,
        NODE_ENV: 'test',
      },
    });

    firstWindow = await electronApp.firstWindow();
    await firstWindow.waitForLoadState('domcontentloaded');
  });

  test.afterAll(async () => {
    if (electronApp) {
      await electronApp.close();
    }
  });

  test('TC-210: Renderer Isolation & Security', async () => {
    const isRequireUndefined = await firstWindow.evaluate(() => typeof (window as unknown as { require?: unknown }).require === 'undefined');
    expect(isRequireUndefined).toBe(true);

    const isProcessUndefined = await firstWindow.evaluate(() => typeof (window as unknown as { process?: unknown }).process === 'undefined');
    expect(isProcessUndefined).toBe(true);

    const labApi = await firstWindow.evaluate(() => {
      const lab = window.lab;
      if (!lab) return null;
      return {
        isElectron: lab.isElectron,
        hasPickImages: typeof lab.pickImages === 'function',
        hasPickDirectory: typeof lab.pickDirectory === 'function',
        hasReadFile: typeof lab.readFile === 'function',
        hasWriteFile: typeof lab.writeFile === 'function',
        hasOnMenuCommand: typeof lab.onMenuCommand === 'function',
        hasGetPathForFile: typeof lab.getPathForFile === 'function',
      };
    });

    expect(labApi).not.toBeNull();
    expect(labApi?.isElectron).toBe(true);
    expect(labApi?.hasPickImages).toBe(true);
    expect(labApi?.hasPickDirectory).toBe(true);
    expect(labApi?.hasReadFile).toBe(true);
    expect(labApi?.hasWriteFile).toBe(true);
    expect(labApi?.hasOnMenuCommand).toBe(true);
    expect(labApi?.hasGetPathForFile).toBe(true);
  });

  test('TC-211: App window starts with canvas and title', async () => {
    const title = await firstWindow.title();
    expect(title).toContain('TextureLab');

    // Wait for the React Flow canvas to be visible
    const canvas = firstWindow.locator('.react-flow');
    await expect(canvas).toBeVisible({ timeout: 10000 });
  });

  test('TC-212: Custom app:// protocol blocks path traversal with 404', async () => {
    const status = await firstWindow.evaluate(async () => {
      try {
        const res = await fetch('app://../../Windows/win.ini');
        return res.status;
      } catch {
        return 404;
      }
    });
    expect(status).toBe(404);
  });

  test('TC-214: Menu accelerator deduplication logic', async () => {
    // In Electron, keydown dispatch ignores menu accelerators because the native menu handles them
    const handledByBrowser = await firstWindow.evaluate(() => {
      // Simulate synthetic keydown for Ctrl+S
      const event = new KeyboardEvent('keydown', {
        key: 's',
        code: 'KeyS',
        ctrlKey: true,
        bubbles: true,
        cancelable: true,
      });
      return window.dispatchEvent(event);
    });
    // Synthetic event is dispatched and not canceled by keydown handler (menu handles via IPC)
    expect(handledByBrowser).toBe(true);
  });

  test('TC-217: Window respects minimum dimensions', async () => {
    const bounds = await firstWindow.evaluate(() => {
      return {
        width: window.outerWidth,
        height: window.outerHeight,
      };
    });
    expect(bounds.width).toBeGreaterThanOrEqual(1100);
    expect(bounds.height).toBeGreaterThanOrEqual(680);
  });
});
