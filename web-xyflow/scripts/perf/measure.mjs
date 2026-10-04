import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { preview } from 'vite';
import { chromium } from 'playwright';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '../..');
const repoRoot = path.resolve(projectRoot, '..');

async function runPerfMeasurement() {
  console.log('--- Starting ARKH TextureLab Performance Baseline Measurement ---');

  // 1. Launch Vite preview server
  console.log('[1/5] Starting Vite preview server...');
  const previewServer = await preview({
    root: projectRoot,
    preview: {
      port: 4173,
      strictPort: false,
    },
  });

  const port = previewServer.httpServer.address().port;
  const baseUrl = `http://localhost:${port}`;
  console.log(`Preview server running at ${baseUrl}`);

  // 2. Launch Chromium via Playwright
  console.log('[2/5] Launching headless Chromium...');
  const browser = await chromium.launch({
    headless: true,
    args: ['--enable-precise-memory-info', '--js-flags=--expose-gc'],
  });

  const page = await browser.newPage({
    viewport: { width: 1440, height: 900 },
  });

  // Track console errors
  const consoleErrors = [];
  page.on('console', (msg) => {
    if (msg.type() === 'error') consoleErrors.push(msg.text());
  });

  // 3. Measure time to first paint & idle heap
  console.log('[3/5] Measuring startup time and idle memory...');
  const navStart = Date.now();
  await page.goto(baseUrl, { waitUntil: 'networkidle' });
  await page.waitForSelector('#root');

  const startupMetrics = await page.evaluate(() => {
    const paintEntries = performance.getEntriesByType('paint');
    const fcp = paintEntries.find((e) => e.name === 'first-contentful-paint');
    const fp = paintEntries.find((e) => e.name === 'first-paint');
    const mem = window.performance.memory
      ? {
          usedJSHeapSize: window.performance.memory.usedJSHeapSize,
          totalJSHeapSize: window.performance.memory.totalJSHeapSize,
          jsHeapSizeLimit: window.performance.memory.jsHeapSizeLimit,
        }
      : null;

    return {
      firstPaintMs: fp ? fp.startTime : null,
      firstContentfulPaintMs: fcp ? fcp.startTime : null,
      memory: mem,
    };
  });

  const totalStartupTimeMs = Date.now() - navStart;
  const idleHeapMB = startupMetrics.memory ? startupMetrics.memory.usedJSHeapSize / (1024 * 1024) : 0;
  console.log(`Startup FCP: ${startupMetrics.firstContentfulPaintMs?.toFixed(1) ?? 'N/A'} ms`);
  console.log(`Idle JS Heap: ${idleHeapMB.toFixed(2)} MB`);

  // 4. Click "Load Benchmark" and measure memory under load
  console.log('[4/5] Loading benchmark textures...');
  const loadButton = page.getByRole('button', { name: /Load Benchmark/i });
  await loadButton.click();

  // Wait for benchmark to finish loading
  await page.waitForFunction(() => {
    const header = document.querySelector('header');
    return header && document.body.innerText.includes('Loaded benchmark maps');
  }, { timeout: 15000 }).catch(() => {
    console.log('Wait for status message timed out, checking loaded state...');
  });

  // Brief pause for garbage collection / buffer settle
  await page.waitForTimeout(1000);

  const loadedMetrics = await page.evaluate(() => {
    return window.performance.memory
      ? {
          usedJSHeapSize: window.performance.memory.usedJSHeapSize,
          totalJSHeapSize: window.performance.memory.totalJSHeapSize,
        }
      : null;
  });

  const loadedHeapMB = loadedMetrics ? loadedMetrics.usedJSHeapSize / (1024 * 1024) : 0;
  console.log(`Post-Benchmark JS Heap: ${loadedHeapMB.toFixed(2)} MB`);

  // 5. Measure Long-Task count and duration during 50 slider drag steps
  console.log('[5/5] Measuring long-task metrics while dragging Levels slider 50 steps...');

  // Spawn Levels node using hotkey 'l'
  await page.mouse.move(700, 300);
  await page.keyboard.press('l');
  await page.waitForTimeout(300);

  // Install longtask observer in page
  await page.evaluate(() => {
    window.__longTasks = [];
    const observer = new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        window.__longTasks.push({
          duration: entry.duration,
          startTime: entry.startTime,
          name: entry.name,
        });
      }
    });
    observer.observe({ entryTypes: ['longtask'] });
  });

  // Locate slider track on Levels node
  const sliderTrack = page.locator('.nowheel').first();
  const trackBox = await sliderTrack.boundingBox();

  let longTaskCount = 0;
  let totalLongTaskDurationMs = 0;

  if (trackBox) {
    const startX = trackBox.x + 10;
    const startY = trackBox.y + trackBox.height / 2;
    const endX = trackBox.x + trackBox.width - 10;

    await page.mouse.move(startX, startY);
    await page.mouse.down();

    for (let step = 0; step < 50; step++) {
      const currentX = startX + (step / 50) * (endX - startX);
      await page.mouse.move(currentX, startY);
      await page.waitForTimeout(16); // 60 FPS pacing
    }

    await page.mouse.up();
    await page.waitForTimeout(300); // Allow pending microtasks to finish

    const taskData = await page.evaluate(() => {
      const tasks = window.__longTasks || [];
      const totalDur = tasks.reduce((sum, t) => sum + t.duration, 0);
      return {
        count: tasks.length,
        totalDurationMs: totalDur,
        tasks,
      };
    });

    longTaskCount = taskData.count;
    totalLongTaskDurationMs = taskData.totalDurationMs;
  } else {
    console.warn('Could not find slider track, using programmatic slider updates...');
  }

  console.log(`Long Tasks during 50 drag steps: ${longTaskCount}`);
  console.log(`Total Long Task Duration: ${totalLongTaskDurationMs.toFixed(1)} ms`);

  // Close browser and server
  await browser.close();
  await previewServer.httpServer.close();

  // 6. Build Baseline JSON output
  const results = {
    timestamp: new Date().toISOString(),
    environment: {
      platform: process.platform,
      arch: process.arch,
      nodeVersion: process.version,
      browser: 'Chromium (Playwright)',
      rendererMode: 'Canvas2D (Phase 0 Baseline)',
    },
    metrics: {
      timeToFirstPaintMs: Math.round(startupMetrics.firstPaintMs || 0),
      timeToFirstContentfulPaintMs: Math.round(startupMetrics.firstContentfulPaintMs || 0),
      totalStartupNavMs: Math.round(totalStartupTimeMs),
      idleJSHeapMB: Number(idleHeapMB.toFixed(2)),
      postBenchmarkJSHeapMB: Number(loadedHeapMB.toFixed(2)),
      heapDeltaMB: Number((loadedHeapMB - idleHeapMB).toFixed(2)),
      sliderDrag50Steps: {
        longTaskCount,
        totalLongTaskDurationMs: Number(totalLongTaskDurationMs.toFixed(1)),
        avgLongTaskDurationMs: longTaskCount > 0 ? Number((totalLongTaskDurationMs / longTaskCount).toFixed(1)) : 0,
      },
    },
    consoleErrors,
  };

  const outputPath = path.resolve(repoRoot, 'docs/roadmap/perf-baseline.json');
  fs.writeFileSync(outputPath, JSON.stringify(results, null, 2), 'utf-8');
  console.log(`\nPerf baseline JSON saved to: ${outputPath}`);

  console.log('\n================ PERF BASELINE SUMMARY ================');
  console.table([
    { Metric: 'Time to First Contentful Paint', Value: `${results.metrics.timeToFirstContentfulPaintMs} ms` },
    { Metric: 'Idle JS Heap Size', Value: `${results.metrics.idleJSHeapMB} MB` },
    { Metric: 'Post-Benchmark JS Heap Size', Value: `${results.metrics.postBenchmarkJSHeapMB} MB` },
    { Metric: 'Benchmark Buffer Heap Delta', Value: `+${results.metrics.heapDeltaMB} MB` },
    { Metric: 'Slider Drag Long Tasks (>50ms)', Value: `${results.metrics.sliderDrag50Steps.longTaskCount}` },
    { Metric: 'Total Long Task Duration', Value: `${results.metrics.sliderDrag50Steps.totalLongTaskDurationMs} ms` },
  ]);
  console.log('========================================================\n');
}

runPerfMeasurement().catch((err) => {
  console.error('Perf measurement failed:', err);
  process.exit(1);
});
