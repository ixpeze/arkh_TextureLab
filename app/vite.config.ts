import react from '@vitejs/plugin-react'
import { defineConfig, type Plugin } from 'vite'
import type { IncomingMessage, ServerResponse } from 'node:http'
import path from 'node:path'
import fs from 'node:fs'

function serveSamplesPlugin(): Plugin {
  const handler = (req: IncomingMessage, res: ServerResponse, next: () => void) => {
    const rawUrl = req.url || '';
    if (!rawUrl.startsWith('/samples/')) {
      return next();
    }
    const cleanPath = decodeURIComponent(rawUrl.replace(/^\/samples\//, '').split('?')[0]);
    const filePath = path.resolve(import.meta.dirname, '../samples', cleanPath);
    if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
      res.setHeader('Content-Type', filePath.endsWith('.png') ? 'image/png' : 'application/octet-stream');
      fs.createReadStream(filePath).pipe(res);
      return;
    }
    next();
  };

  return {
    name: 'serve-samples',
    configureServer(server) {
      server.middlewares.use(handler);
    },
    configurePreviewServer(server) {
      server.middlewares.use(handler);
    },
  };
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), serveSamplesPlugin()],
  server: {
    fs: {
      allow: ['..'],
    },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks(id: string) {
          if (id.includes('@xyflow')) {
            return 'xyflow';
          }
          if (id.includes('node_modules')) {
            return 'vendor';
          }
        },
      },
    },
    chunkSizeWarningLimit: 600,
  },
})
