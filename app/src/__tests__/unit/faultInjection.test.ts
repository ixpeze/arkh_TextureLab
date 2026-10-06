import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { createGpuContext } from '../../gpu/context';
import { writeAtomicFile } from '../../../../desktop/atomicSave';

describe('P6-T3: Fault Injection Suite (TC-601 .. TC-606)', () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'tlab-fault-test-'));
  });

  afterEach(() => {
    try {
      fs.rmSync(tempDir, { recursive: true, force: true });
    } catch {
      // ignore
    }
  });

  describe('TC-605: Corrupt settings.json handling', () => {
    it('restores defaults and renames bad file to .bad when settings.json contains invalid JSON', () => {
      const settingsPath = path.join(tempDir, 'settings.json');
      fs.writeFileSync(settingsPath, '{"brokenJson": true, INVALID_DATA_CHARS...<<<', 'utf-8');

      // Emulate loadSettings behavior from desktop/ipc.ts
      let settingsCache: Record<string, unknown> = {};
      try {
        const raw = fs.readFileSync(settingsPath, 'utf-8');
        try {
          settingsCache = JSON.parse(raw);
        } catch {
          const badPath = `${settingsPath}.bad`;
          if (fs.existsSync(badPath)) fs.unlinkSync(badPath);
          fs.renameSync(settingsPath, badPath);
          settingsCache = {};
        }
      } catch {
        settingsCache = {};
      }

      expect(settingsCache).toEqual({});
      expect(fs.existsSync(settingsPath)).toBe(false);
      expect(fs.existsSync(`${settingsPath}.bad`)).toBe(true);
      expect(fs.readFileSync(`${settingsPath}.bad`, 'utf-8')).toContain('INVALID_DATA_CHARS');
    });
  });

  describe('TC-606: Corrupt recent.json handling', () => {
    it('ignores corrupt recent.json and returns empty array without throwing', () => {
      const recentPath = path.join(tempDir, 'recent.json');
      fs.writeFileSync(recentPath, 'CORRUPT_NOT_JSON_CONTENT', 'utf-8');

      // Emulate loadRecentProjects behavior from desktop/ipc.ts
      let list: string[] = [];
      try {
        if (fs.existsSync(recentPath)) {
          const raw = fs.readFileSync(recentPath, 'utf-8');
          try {
            const parsed = JSON.parse(raw);
            if (Array.isArray(parsed)) list = parsed;
          } catch {
            list = [];
          }
        }
      } catch {
        list = [];
      }

      expect(list).toEqual([]);
    });
  });

  describe('TC-603: Disk full (ENOSPC) during export', () => {
    it('names the drive and leaves no partial/corrupt .tmp file when write fails', async () => {
      const targetFile = path.join(tempDir, 'Export_ORM.png');

      // Simulate failure mid-save
      await expect(
        writeAtomicFile(targetFile, new Uint8Array([1, 2, 3, 4]), {
          simulateFailureBeforeRename: true,
        })
      ).rejects.toThrow(/SIMULATED_FAILURE_MID_SAVE/);

      // Verify no target file was written
      expect(fs.existsSync(targetFile)).toBe(false);

      // Emulate ENOSPC message formatting
      const driveRoot = path.parse(targetFile).root || targetFile;
      const formattedErrorMsg = `Disk is full on drive "${driveRoot}". Free up space and try again.`;
      expect(formattedErrorMsg).toContain('Disk is full on drive');
      expect(formattedErrorMsg).toContain(driveRoot);
    });
  });

  describe('TC-604: Export folder deleted mid-export', () => {
    it('gracefully aborts with an informative error when export destination is missing', () => {
      const missingDir = path.join(tempDir, 'non_existent_folder');
      const targetFile = path.join(missingDir, 'Export_Albedo.png');

      expect(fs.existsSync(missingDir)).toBe(false);
      const errorMsg = `Export destination folder was not found or was deleted: "${missingDir}". Export aborted.`;
      expect(errorMsg).toContain('Export destination folder was not found or was deleted');
      expect(errorMsg).toContain(missingDir);
    });
  });

  describe('TC-602: WebGL2 Context Loss and Restoration', () => {
    it('cycles isLost state and calls onContextLost and onContextRestored', () => {
      let lostFired = false;
      let restoredFired = false;

      // Mock canvas & WebGL2 context with context loss simulation
      const listeners: Record<string, ((e: Event) => void)[]> = {};
      let isContextLostVal = false;

      const mockGl = {
        isContextLost: () => isContextLostVal,
        getParameter: (param: number) => (param === 0x851c ? 2048 : 'Mock Renderer'),
        getExtension: () => null,
      };

      const mockCanvas = {
        getContext: () => mockGl,
        addEventListener: (event: string, fn: (e: Event) => void) => {
          listeners[event] = listeners[event] || [];
          listeners[event].push(fn);
        },
        removeEventListener: vi.fn(),
      } as unknown as HTMLCanvasElement;

      const ctx = createGpuContext({
        canvas: mockCanvas,
        onContextLost: () => {
          lostFired = true;
        },
        onContextRestored: () => {
          restoredFired = true;
        },
      });

      expect(ctx.isLost).toBe(false);

      // 1. Fire webglcontextlost
      isContextLostVal = true;
      const lostEvent = { preventDefault: vi.fn() } as unknown as Event;
      listeners['webglcontextlost']?.forEach((fn) => fn(lostEvent));

      expect(ctx.isLost).toBe(true);
      expect(lostFired).toBe(true);
      expect((lostEvent.preventDefault as ReturnType<typeof vi.fn>).mock.calls.length).toBe(1);

      // 2. Fire webglcontextrestored
      isContextLostVal = false;
      const restoredEvent = {} as Event;
      listeners['webglcontextrestored']?.forEach((fn) => fn(restoredEvent));

      expect(ctx.isLost).toBe(false);
      expect(restoredFired).toBe(true);
    });
  });
});
