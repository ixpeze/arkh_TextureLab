import fs from 'node:fs';
import path from 'node:path';

export interface AtomicWriteOptions {
  createBackup?: boolean;
  maxRetries?: number;
  retryDelayMs?: number;
  simulateFailureBeforeRename?: boolean;
}

export async function writeAtomicFile(
  filePath: string,
  content: string | Uint8Array,
  options: AtomicWriteOptions = {}
): Promise<void> {
  const {
    createBackup = true,
    maxRetries = 3,
    retryDelayMs = 100,
    simulateFailureBeforeRename = false,
  } = options;

  const resolved = path.resolve(filePath);
  const dir = path.dirname(resolved);
  const tmpPath = `${resolved}.tmp`;
  const bakPath = `${resolved}.bak`;

  // 1. Ensure directory exists
  if (!fs.existsSync(dir)) {
    await fs.promises.mkdir(dir, { recursive: true });
  }

  // 2. Write temp file and flush with fsync
  const buffer = typeof content === 'string' ? Buffer.from(content, 'utf-8') : Buffer.from(content);
  const handle = await fs.promises.open(tmpPath, 'w');
  try {
    await handle.writeFile(buffer);
    await handle.sync();
  } finally {
    await handle.close();
  }

  // Fault injection point for TC-332: simulate crash between write and rename
  if (simulateFailureBeforeRename) {
    throw new Error('SIMULATED_FAILURE_MID_SAVE: Process terminated before rename');
  }

  // 3. Backup previous version if it exists
  if (createBackup && fs.existsSync(resolved)) {
    try {
      await fs.promises.copyFile(resolved, bakPath);
    } catch {
      // Non-fatal
    }
  }

  // 4. Atomic rename with Windows retry loop
  let attempts = 0;
  while (true) {
    try {
      await fs.promises.rename(tmpPath, resolved);
      break;
    } catch (err: unknown) {
      attempts++;
      const code = (err as { code?: string })?.code;
      if (attempts >= maxRetries || (code !== 'EBUSY' && code !== 'EPERM')) {
        if (fs.existsSync(tmpPath)) {
          try {
            await fs.promises.unlink(tmpPath);
          } catch {
            // ignore
          }
        }
        throw err;
      }
      await new Promise((r) => setTimeout(r, retryDelayMs * attempts));
    }
  }
}
