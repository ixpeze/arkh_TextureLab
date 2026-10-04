import { describe, it, expect } from 'vitest';
import { ExportEngine, calculateTargetDimensions } from '../../engine/exportEngine';
import type { TextureBuffer } from '../../engine/pixelEngine';

describe('P1-A4: Export Aspect Ratio Preservation (F-05, TC-125..127)', () => {
  it('TC-125: non-square 4096x2048 with longEdge 2048 scales to 2048x1024', () => {
    const dims = calculateTargetDimensions(4096, 2048, { mode: 'longEdge', px: 2048 });
    expect(dims).toEqual({ width: 2048, height: 1024 });
  });

  it('TC-125b: non-square vertical 2048x4096 with longEdge 2048 scales to 1024x2048', () => {
    const dims = calculateTargetDimensions(2048, 4096, { mode: 'longEdge', px: 2048 });
    expect(dims).toEqual({ width: 1024, height: 2048 });
  });

  it('TC-126: square 1000x1000 with longEdge 512 scales to 512x512', () => {
    const dims = calculateTargetDimensions(1000, 1000, { mode: 'longEdge', px: 512 });
    expect(dims).toEqual({ width: 512, height: 512 });
  });

  it('TC-127: inherit mode preserves exact original dimensions without distortion', () => {
    const dims = calculateTargetDimensions(4096, 2048, { mode: 'inherit' });
    expect(dims).toEqual({ width: 4096, height: 2048 });
  });

  it('TC-127b: stretch mode sets exact explicit width and height', () => {
    const dims = calculateTargetDimensions(4096, 2048, { mode: 'stretch', w: 1024, h: 512 });
    expect(dims).toEqual({ width: 1024, height: 512 });
  });

  it('TC-127c: TGA encoding of 4096x2048 at 2048 preserves 2:1 aspect in header', async () => {
    // Create a 4096x2048 dummy buffer (1 pixel repeated or 4x2 for lightweight test)
    const testBuf: TextureBuffer = {
      width: 4,
      height: 2,
      data: new Uint8ClampedArray(4 * 2 * 4),
    };

    // longEdge = 2 should give width=2, height=1
    const blob = await ExportEngine.encodeImageBlob(testBuf, 'TGA', { mode: 'longEdge', px: 2 });
    const arrayBuf = await blob.arrayBuffer();
    const view = new DataView(arrayBuf);

    // TGA header width at byte 12 (uint16 little endian), height at byte 14
    const outWidth = view.getUint16(12, true);
    const outHeight = view.getUint16(14, true);

    expect(outWidth).toBe(2);
    expect(outHeight).toBe(1);
  });
});
