import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { app, shell } from 'electron';

const MAX_LOG_SIZE_BYTES = 1024 * 1024; // 1 MB
const MAX_BACKUP_COUNT = 5;

let logDirectory: string | null = null;
let currentLogFilePath: string | null = null;

function redactSensitiveData(input: string): string {
  const username = os.userInfo().username;
  if (!username) return input;
  // Redact username in both Windows and POSIX path formats
  const escapedUser = username.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const regex = new RegExp(`([/\\\\]users[/\\\\])${escapedUser}([/\\\\]|$)`, 'gi');
  return input.replace(regex, '$1<user>$2');
}

export function initLogger(): void {
  try {
    const userData = app.getPath('userData');
    logDirectory = path.join(userData, 'logs');
    if (!fs.existsSync(logDirectory)) {
      fs.mkdirSync(logDirectory, { recursive: true });
    }
    currentLogFilePath = path.join(logDirectory, 'main.log');
    rotateLogIfNeeded();
  } catch (err) {
    console.error('Failed to initialize logger directory:', err);
  }
}

function rotateLogIfNeeded(): void {
  if (!currentLogFilePath || !logDirectory) return;
  try {
    if (!fs.existsSync(currentLogFilePath)) return;
    const stats = fs.statSync(currentLogFilePath);
    if (stats.size < MAX_LOG_SIZE_BYTES) return;

    for (let i = MAX_BACKUP_COUNT - 1; i >= 1; i--) {
      const src = path.join(logDirectory, `main.${i}.log`);
      const dst = path.join(logDirectory, `main.${i + 1}.log`);
      if (fs.existsSync(src)) {
        fs.renameSync(src, dst);
      }
    }
    const firstBackup = path.join(logDirectory, 'main.1.log');
    fs.renameSync(currentLogFilePath, firstBackup);
  } catch (err) {
    console.error('Error rotating logs:', err);
  }
}

function writeLine(level: string, message: string, ...args: unknown[]): void {
  const timestamp = new Date().toISOString();
  let fullMessage = message;
  if (args.length > 0) {
    const serializedArgs = args.map((a) => {
      if (a instanceof Error) {
        return a.stack || a.message;
      }
      if (typeof a === 'object') {
        try {
          return JSON.stringify(a);
        } catch {
          return String(a);
        }
      }
      return String(a);
    });
    fullMessage = `${message} ${serializedArgs.join(' ')}`;
  }

  const sanitized = redactSensitiveData(`[${timestamp}] [${level}] ${fullMessage}\n`);
  recentLogsRingBuffer.push(sanitized.trimEnd());
  if (recentLogsRingBuffer.length > MAX_RECENT_LOGS) {
    recentLogsRingBuffer.shift();
  }

  // Always log to stdout/stderr in dev/terminal
  if (level === 'ERROR') {
    process.stderr.write(sanitized);
  } else {
    process.stdout.write(sanitized);
  }

  if (!currentLogFilePath) return;
  try {
    rotateLogIfNeeded();
    fs.appendFileSync(currentLogFilePath, sanitized, 'utf-8');
  } catch (err) {
    console.error('Failed to append log:', err);
  }
}

const MAX_RECENT_LOGS = 200;
const recentLogsRingBuffer: string[] = [];

export const logger = {
  init: initLogger,
  info: (msg: string, ...args: unknown[]) => writeLine('INFO', msg, ...args),
  warn: (msg: string, ...args: unknown[]) => writeLine('WARN', msg, ...args),
  error: (msg: string, ...args: unknown[]) => writeLine('ERROR', msg, ...args),
  getLogPath: (): string => currentLogFilePath || '',
  getLogDir: (): string => logDirectory || '',
  getRecentLogs: (limit = 200): string[] => {
    return recentLogsRingBuffer.slice(-Math.min(limit, MAX_RECENT_LOGS));
  },
  openLogsFolder: (): void => {
    if (logDirectory && fs.existsSync(logDirectory)) {
      shell.openPath(logDirectory).catch((err) => {
        logger.error('Failed to open log folder:', err);
      });
    }
  },
};

