/**
 * ARKH TextureLab - GPU Readback Histogram Engine (P4-C8)
 * Computes 4x256 bins (R, G, B, Luminance) from readback pixel data.
 */

import type { ReadbackResult } from './readback';

export interface HistogramBins {
  r: Uint32Array;
  g: Uint32Array;
  b: Uint32Array;
  lum: Uint32Array;
  maxCount: number;
}

export function computeHistogram(readback: ReadbackResult): HistogramBins {
  const rBins = new Uint32Array(256);
  const gBins = new Uint32Array(256);
  const bBins = new Uint32Array(256);
  const lumBins = new Uint32Array(256);

  const { data, width, height } = readback;
  const totalPixels = width * height;
  let maxCount = 0;

  if (data instanceof Uint8Array) {
    for (let i = 0; i < totalPixels; i++) {
      const idx = i * 4;
      const r = data[idx + 0];
      const g = data[idx + 1];
      const b = data[idx + 2];
      const lum = Math.round(0.2126 * r + 0.7152 * g + 0.0722 * b);

      rBins[r]++;
      gBins[g]++;
      bBins[b]++;
      lumBins[lum]++;

      if (rBins[r] > maxCount) maxCount = rBins[r];
      if (gBins[g] > maxCount) maxCount = gBins[g];
      if (bBins[b] > maxCount) maxCount = bBins[b];
      if (lumBins[lum] > maxCount) maxCount = lumBins[lum];
    }
  } else {
    // Float32Array (normalized 0.0 .. 1.0)
    for (let i = 0; i < totalPixels; i++) {
      const idx = i * 4;
      const r = Math.min(255, Math.max(0, Math.round(data[idx + 0] * 255)));
      const g = Math.min(255, Math.max(0, Math.round(data[idx + 1] * 255)));
      const b = Math.min(255, Math.max(0, Math.round(data[idx + 2] * 255)));
      const lum = Math.round(0.2126 * r + 0.7152 * g + 0.0722 * b);

      rBins[r]++;
      gBins[g]++;
      bBins[b]++;
      lumBins[lum]++;

      if (rBins[r] > maxCount) maxCount = rBins[r];
      if (gBins[g] > maxCount) maxCount = gBins[g];
      if (bBins[b] > maxCount) maxCount = bBins[b];
      if (lumBins[lum] > maxCount) maxCount = lumBins[lum];
    }
  }

  return {
    r: rBins,
    g: gBins,
    b: bBins,
    lum: lumBins,
    maxCount,
  };
}
