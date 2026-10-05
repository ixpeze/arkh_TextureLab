import fs from 'node:fs';
import path from 'node:path';
import { protocol } from 'electron';
import { logger } from './logger';

const MIME_TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.wasm': 'application/wasm',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.ttf': 'font/ttf',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
};

export function registerAppProtocolPrivileges(): void {
  protocol.registerSchemesAsPrivileged([
    {
      scheme: 'app',
      privileges: {
        standard: true,
        secure: true,
        supportFetchAPI: true,
        corsEnabled: true,
        stream: true,
      },
    },
  ]);
}

export function setupAppProtocol(distDirectory: string): void {
  const normalizedDist = path.resolve(distDirectory);

  protocol.handle('app', async (request) => {
    try {
      const url = new URL(request.url);
      let requestPath = decodeURIComponent(url.pathname);

      // Default root to index.html
      if (!requestPath || requestPath === '/' || requestPath === '\\') {
        requestPath = '/index.html';
      }

      // Check for path traversal attempts
      const resolvedPath = path.resolve(normalizedDist, '.' + requestPath);

      // Strict root check: must be strictly inside normalizedDist
      if (!resolvedPath.startsWith(normalizedDist)) {
        logger.warn(`Path traversal blocked for app protocol: ${request.url}`);
        return new Response('Not Found', { status: 404, statusText: 'Not Found' });
      }

      // If file does not exist, return 404 (or index.html fallback for SPA if html request)
      if (!fs.existsSync(resolvedPath)) {
        // If it looks like a client-side route without extension, fallback to index.html
        const ext = path.extname(resolvedPath);
        if (!ext) {
          const indexFallback = path.join(normalizedDist, 'index.html');
          if (fs.existsSync(indexFallback)) {
            const data = await fs.promises.readFile(indexFallback);
            return new Response(data, {
              status: 200,
              headers: { 'Content-Type': 'text/html; charset=utf-8' },
            });
          }
        }
        return new Response('Not Found', { status: 404, statusText: 'Not Found' });
      }

      const stat = await fs.promises.stat(resolvedPath);
      if (stat.isDirectory()) {
        const indexFile = path.join(resolvedPath, 'index.html');
        if (fs.existsSync(indexFile)) {
          const data = await fs.promises.readFile(indexFile);
          return new Response(data, {
            status: 200,
            headers: { 'Content-Type': 'text/html; charset=utf-8' },
          });
        }
        return new Response('Not Found', { status: 404, statusText: 'Not Found' });
      }

      const ext = path.extname(resolvedPath).toLowerCase();
      const mimeType = MIME_TYPES[ext] || 'application/octet-stream';
      const fileData = await fs.promises.readFile(resolvedPath);

      return new Response(fileData, {
        status: 200,
        headers: {
          'Content-Type': mimeType,
          'Content-Length': String(stat.size),
          'Access-Control-Allow-Origin': '*',
        },
      });
    } catch (err) {
      logger.error('Error handling app:// protocol request:', err);
      return new Response('Internal Server Error', { status: 500 });
    }
  });
}
