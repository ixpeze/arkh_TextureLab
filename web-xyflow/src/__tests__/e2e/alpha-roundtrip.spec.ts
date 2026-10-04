import { test, expect } from '@playwright/test';

test.describe('F-01: Canvas2D Premultiplied Alpha Corruption Proof', () => {
  test('proves Canvas2D putImageData and toBlob quantize RGB channels where Alpha < 255', async ({ page }) => {
    await page.goto('about:blank');

    const result = await page.evaluate(async () => {
      const width = 64;
      const height = 64;
      const totalPixels = width * height; // 4096

      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d', { willReadFrequently: true })!;

      // 1. Generate 64x64 buffer with Alpha ramp 0..255 and distinct RGB values
      const original = ctx.createImageData(width, height);
      for (let i = 0; i < totalPixels; i++) {
        const idx = i * 4;
        const a = Math.floor((i / (totalPixels - 1)) * 255); // 0 to 255 ramp
        const r = (i * 7) % 256;
        const g = (i * 13) % 256;
        const b = (i * 19) % 256;

        original.data[idx + 0] = r;
        original.data[idx + 1] = g;
        original.data[idx + 2] = b;
        original.data[idx + 3] = a;
      }

      // 2. Put into canvas and immediately read back
      ctx.putImageData(original, 0, 0);
      const putGetRead = ctx.getImageData(0, 0, width, height);

      // 3. toBlob -> decode roundtrip
      const blob = await new Promise<Blob>((resolve) =>
        canvas.toBlob((b) => resolve(b!), 'image/png')
      );
      const img = new Image();
      const blobUrl = URL.createObjectURL(blob);
      await new Promise<void>((resolve, reject) => {
        img.onload = () => resolve();
        img.onerror = reject;
        img.src = blobUrl;
      });

      ctx.clearRect(0, 0, width, height);
      ctx.drawImage(img, 0, 0);
      URL.revokeObjectURL(blobUrl);
      const toBlobRead = ctx.getImageData(0, 0, width, height);

      // Measure differences
      let putGetDiffCount = 0;
      let toBlobDiffCount = 0;
      let maxPutGetDelta = 0;
      let maxToBlobDelta = 0;
      let zeroAlphaTotalLossCount = 0;

      for (let i = 0; i < totalPixels; i++) {
        const idx = i * 4;
        const origR = original.data[idx + 0];
        const origG = original.data[idx + 1];
        const origB = original.data[idx + 2];
        const origA = original.data[idx + 3];

        const pgR = putGetRead.data[idx + 0];
        const pgG = putGetRead.data[idx + 1];
        const pgB = putGetRead.data[idx + 2];
        const pgA = putGetRead.data[idx + 3];

        const tbR = toBlobRead.data[idx + 0];
        const tbG = toBlobRead.data[idx + 1];
        const tbB = toBlobRead.data[idx + 2];
        const tbA = toBlobRead.data[idx + 3];

        const pgDelta = Math.max(
          Math.abs(origR - pgR),
          Math.abs(origG - pgG),
          Math.abs(origB - pgB),
          Math.abs(origA - pgA)
        );

        const tbDelta = Math.max(
          Math.abs(origR - tbR),
          Math.abs(origG - tbG),
          Math.abs(origB - tbB),
          Math.abs(origA - tbA)
        );

        if (pgDelta > 0) {
          putGetDiffCount++;
          if (pgDelta > maxPutGetDelta) maxPutGetDelta = pgDelta;
        }

        if (tbDelta > 0) {
          toBlobDiffCount++;
          if (tbDelta > maxToBlobDelta) maxToBlobDelta = tbDelta;
        }

        if (origA === 0 && (origR > 0 || origG > 0 || origB > 0)) {
          if (pgR === 0 && pgG === 0 && pgB === 0) {
            zeroAlphaTotalLossCount++;
          }
        }
      }

      return {
        totalPixels,
        putGetDiffCount,
        toBlobDiffCount,
        maxPutGetDelta,
        maxToBlobDelta,
        zeroAlphaTotalLossCount,
      };
    });

    console.log('[F-01 PROOF RESULTS]');
    console.log(`Total pixels tested: ${result.totalPixels}`);
    console.log(`putImageData -> getImageData corrupted pixels: ${result.putGetDiffCount} (${((result.putGetDiffCount / result.totalPixels) * 100).toFixed(1)}%)`);
    console.log(`Max delta (putImageData): ${result.maxPutGetDelta}`);
    console.log(`toBlob -> decode corrupted pixels: ${result.toBlobDiffCount} (${((result.toBlobDiffCount / result.totalPixels) * 100).toFixed(1)}%)`);
    console.log(`Max delta (toBlob): ${result.maxToBlobDelta}`);
    console.log(`Zero-alpha total RGB erasure count: ${result.zeroAlphaTotalLossCount}`);

    // Concrete empirical proof of F-01:
    // Corruption MUST occur whenever alpha < 255 due to canvas premultiplication
    expect(result.putGetDiffCount).toBeGreaterThan(0);
    expect(result.toBlobDiffCount).toBeGreaterThan(0);
    expect(result.maxPutGetDelta).toBeGreaterThan(0);
  });

  test('F-01 exact round-trip preservation (xfail until Phase 4 exact I/O replaces Canvas2D)', async ({ page }) => {
    test.fail(true, 'Expected failure: Canvas2D inherently premultiplies alpha; replaced in Phase 4');

    await page.goto('about:blank');
    const diffCount = await page.evaluate(() => {
      const width = 64;
      const height = 64;
      const totalPixels = width * height;
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d')!;

      const original = ctx.createImageData(width, height);
      for (let i = 0; i < totalPixels; i++) {
        const idx = i * 4;
        original.data[idx + 0] = (i * 7) % 256;
        original.data[idx + 1] = (i * 13) % 256;
        original.data[idx + 2] = (i * 19) % 256;
        original.data[idx + 3] = Math.floor((i / (totalPixels - 1)) * 255);
      }
      ctx.putImageData(original, 0, 0);
      const read = ctx.getImageData(0, 0, width, height);

      let diffs = 0;
      for (let i = 0; i < original.data.length; i++) {
        if (original.data[i] !== read.data[i]) diffs++;
      }
      return diffs;
    });

    // An ideal exact pipeline would have 0 differences; Canvas2D fails this assertion.
    expect(diffCount).toBe(0);
  });
});
