import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { writeAtomicFile } from '../../../../desktop/atomicSave';

describe('Atomic Save Operations (P3-T6: TC-330..333)', () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'tlab_atomic_test_'));
  });

  afterEach(() => {
    try {
      fs.rmSync(tempDir, { recursive: true, force: true });
    } catch {
      // ignore
    }
  });

  it('TC-330: Successfully saves new file atomically', async () => {
    const target = path.join(tempDir, 'project_alpha.tlab');
    await writeAtomicFile(target, '{"test": 1}');

    expect(fs.existsSync(target)).toBe(true);
    expect(fs.readFileSync(target, 'utf-8')).toBe('{"test": 1}');
    // .tmp file should be cleaned up
    expect(fs.existsSync(`${target}.tmp`)).toBe(false);
  });

  it('TC-332: Mid-save crash simulation leaves original file intact with untouched content', async () => {
    const target = path.join(tempDir, 'original_valuable_project.tlab');
    const originalContent = '{"version": 1, "original": true}';
    fs.writeFileSync(target, originalContent, 'utf-8');

    // Attempt save with simulated process death / failure before rename
    await expect(
      writeAtomicFile(target, '{"version": 2, "corrupted": true}', {
        simulateFailureBeforeRename: true,
      })
    ).rejects.toThrow(/SIMULATED_FAILURE_MID_SAVE/);

    // Original file must be completely intact and uncorrupted!
    expect(fs.existsSync(target)).toBe(true);
    expect(fs.readFileSync(target, 'utf-8')).toBe(originalContent);
  });

  it('TC-333: Saves to path with unicode characters, spaces, and brackets', async () => {
    const unicodeDir = path.join(tempDir, 'Textures [PBR] 4K — 日本語 Projekt');
    const target = path.join(unicodeDir, 'Concrete [High-Res] (Rough) 2026.tlab');
    const testData = '{"unicode": true, "name": "日本語 PBR"}';

    await writeAtomicFile(target, testData);

    expect(fs.existsSync(target)).toBe(true);
    expect(fs.readFileSync(target, 'utf-8')).toBe(testData);
  });

  it('Creates a .bak backup of the existing file when overwriting', async () => {
    const target = path.join(tempDir, 'backed_up_file.tlab');
    await writeAtomicFile(target, 'VERSION_1');

    await writeAtomicFile(target, 'VERSION_2');

    expect(fs.readFileSync(target, 'utf-8')).toBe('VERSION_2');
    expect(fs.existsSync(`${target}.bak`)).toBe(true);
    expect(fs.readFileSync(`${target}.bak`, 'utf-8')).toBe('VERSION_1');
  });

  it('TC-331: Save to non-writable target throws error', async () => {
    // Attempting to write into a directory that is actually a file
    const blockerFile = path.join(tempDir, 'blocker_file');
    fs.writeFileSync(blockerFile, 'not-a-directory');
    const invalidTarget = path.join(blockerFile, 'sub', 'project.tlab');

    await expect(writeAtomicFile(invalidTarget, 'DATA')).rejects.toThrow();
  });
});
