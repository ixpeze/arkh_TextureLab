import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createServer } from 'vite';
import { build } from 'tsup';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');

async function runDevDesktop() {
  console.log('[dev:desktop] Compiling desktop process...');
  await build({
    entry: [path.resolve(root, '../desktop/main.ts'), path.resolve(root, '../desktop/preload.ts')],
    format: ['cjs'],
    outDir: path.resolve(root, 'dist-desktop'),
    external: ['electron'],
    clean: false,
    silent: true,
  });

  console.log('[dev:desktop] Starting Vite dev server...');
  const server = await createServer({
    configFile: path.resolve(root, 'vite.config.ts'),
    server: { port: 5173 },
  });
  await server.listen();
  const address = server.httpServer?.address();
  const port = typeof address === 'object' && address ? address.port : 5173;
  const url = `http://localhost:${port}`;
  console.log(`[dev:desktop] Vite listening on ${url}`);

  const electronModule = await import('electron');
  const electronPath = electronModule.default || electronModule;

  const child = spawn(String(electronPath), ['.'], {
    cwd: root,
    stdio: 'inherit',
    env: {
      ...process.env,
      NODE_ENV: 'development',
      VITE_DEV_SERVER_URL: url,
    },
  });

  child.on('close', async (code) => {
    console.log(`[dev:desktop] Electron closed with code ${code}`);
    await server.close();
    process.exit(code || 0);
  });
}

runDevDesktop().catch((err) => {
  console.error('[dev:desktop] Error:', err);
  process.exit(1);
});
