import { describe, it, expect } from 'vitest';
import {
  shouldPerformAutosave,
  checkRecoveryEligibility,
  getAutosaveFilename,
} from '../../features/project/autosave';

describe('Autosave & Recovery Logic (P3-T8: TC-340..343)', () => {
  it('TC-340: Should only autosave if dirty, idle for 2s, and 30s elapsed', () => {
    const t0 = 100000;

    // Not dirty -> false
    expect(
      shouldPerformAutosave({
        isDirty: false,
        lastEditTimeMs: t0 - 5000,
        lastAutosaveTimeMs: t0 - 35000,
        nowMs: t0,
      })
    ).toBe(false);

    // Dirty, but actively typing/editing (< 2s idle) -> false
    expect(
      shouldPerformAutosave({
        isDirty: true,
        lastEditTimeMs: t0 - 500, // 500ms ago
        lastAutosaveTimeMs: t0 - 35000,
        nowMs: t0,
      })
    ).toBe(false);

    // Dirty, idle for 3s, but interval < 30s -> false
    expect(
      shouldPerformAutosave({
        isDirty: true,
        lastEditTimeMs: t0 - 3000,
        lastAutosaveTimeMs: t0 - 15000, // 15s ago
        nowMs: t0,
      })
    ).toBe(false);

    // Dirty, idle >= 2s, interval >= 30s -> true!
    expect(
      shouldPerformAutosave({
        isDirty: true,
        lastEditTimeMs: t0 - 2500,
        lastAutosaveTimeMs: t0 - 31000,
        nowMs: t0,
      })
    ).toBe(true);
  });

  it('TC-341: Recovery offered if autosave is newer than project file or unsaved', () => {
    // Unsaved project
    const res1 = checkRecoveryEligibility(1700000030000, undefined);
    expect(res1.eligible).toBe(true);
    expect(res1.reason).toBe('unsaved_project');

    // Autosave is newer than project file on disk
    const res2 = checkRecoveryEligibility(1700000050000, 1700000010000);
    expect(res2.eligible).toBe(true);
    expect(res2.reason).toBe('newer_than_project');

    // Project file on disk is newer or same as autosave
    const res3 = checkRecoveryEligibility(1700000010000, 1700000050000);
    expect(res3.eligible).toBe(false);
  });

  it('Generates sanitized autosave filename', () => {
    expect(getAutosaveFilename('proj:123/alpha')).toBe('proj_123_alpha.tlab.autosave');
  });
});
