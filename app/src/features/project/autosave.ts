export interface AutosaveCheckOptions {
  isDirty: boolean;
  lastEditTimeMs: number;
  lastAutosaveTimeMs: number;
  nowMs?: number;
  idleThresholdMs?: number;
  intervalMs?: number;
}

export function shouldPerformAutosave({
  isDirty,
  lastEditTimeMs,
  lastAutosaveTimeMs,
  nowMs = Date.now(),
  idleThresholdMs = 2000,
  intervalMs = 30000,
}: AutosaveCheckOptions): boolean {
  if (!isDirty) return false;
  const isIdle = nowMs - lastEditTimeMs >= idleThresholdMs;
  const isIntervalElapsed = nowMs - lastAutosaveTimeMs >= intervalMs;
  return isIdle && isIntervalElapsed;
}

export function getAutosaveFilename(projectId: string): string {
  const sanitized = projectId.replace(/[^a-zA-Z0-9_-]/g, '_');
  return `${sanitized}.tlab.autosave`;
}

export interface RecoveryCheckResult {
  eligible: boolean;
  reason: 'newer_than_project' | 'unsaved_project' | 'none';
}

export function checkRecoveryEligibility(
  autosaveMtimeMs: number,
  projectMtimeMs: number | undefined
): RecoveryCheckResult {
  if (projectMtimeMs === undefined || projectMtimeMs <= 0) {
    return { eligible: true, reason: 'unsaved_project' };
  }
  if (autosaveMtimeMs > projectMtimeMs) {
    return { eligible: true, reason: 'newer_than_project' };
  }
  return { eligible: false, reason: 'none' };
}
