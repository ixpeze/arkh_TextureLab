/**
 * ARKH TextureLab - Image Encoder (PNG 8/16b, TGA 24/32b, JPEG, WebP)
 */

import { encode as encodePng } from 'fast-png';
import { encodeTga } from './tga';

export type ExportFormat = 'png' | 'tga' | 'jpg' | 'jpeg' | 'webp';

export interface EncodeOptions {
  width: number;
  height: number;
  data: Uint8Array | Uint16Array;
  format: ExportFormat;
  bitDepth?: 8 | 16;
  quality?: number; // 0..1 for jpeg/webp
}

export interface EncodeResult {
  data: Uint8Array;
  mimeType: string;
  warning?: string;
}

export async function encodeImage(options: EncodeOptions): Promise<EncodeResult> {
  const { width, height, data, format, bitDepth = 8, quality = 0.92 } = options;
  const normFormat = format === 'jpg' ? 'jpeg' : format;

  if (normFormat === 'png') {
    const is16 = bitDepth === 16;
    const pngBytes = encodePng({
      width,
      height,
      data: is16
        ? (data instanceof Uint16Array ? data : new Uint16Array(data.buffer))
        : (data instanceof Uint8Array ? data : new Uint8Array(data.buffer)),
      depth: is16 ? 16 : 8,
      channels: 4,
    });

    return {
      data: new Uint8Array(pngBytes),
      mimeType: 'image/png',
    };
  }

  if (normFormat === 'tga') {
    const raw8 = data instanceof Uint8Array ? data : convert16To8(data as Uint16Array);
    const tgaBytes = encodeTga({
      width,
      height,
      data: raw8,
      channels: 4,
    });

    return {
      data: tgaBytes,
      mimeType: 'image/x-tga',
    };
  }

  if (normFormat === 'jpeg' || normFormat === 'webp') {
    const raw8 = data instanceof Uint8Array ? data : convert16To8(data as Uint16Array);
    let hasMeaningfulAlpha = false;

    // Check if alpha channel has non-255 values
    for (let i = 3; i < raw8.length; i += 4) {
      if (raw8[i] < 255) {
        hasMeaningfulAlpha = true;
        break;
      }
    }

    const mime = normFormat === 'jpeg' ? 'image/jpeg' : 'image/webp';
    const bytes = await encodeViaCanvas(width, height, raw8, mime, quality);

    let warning: string | undefined;
    if (hasMeaningfulAlpha && normFormat === 'jpeg') {
      warning = 'JPEG does not support alpha channel; alpha was discarded.';
    } else if (hasMeaningfulAlpha && normFormat === 'webp') {
      warning = 'Lossy WebP format may quantize packed data channels.';
    }

    return {
      data: bytes,
      mimeType: mime,
      warning,
    };
  }

  throw new Error(`Unsupported export format: ${format}`);
}

function convert16To8(data16: Uint16Array): Uint8Array {
  const out8 = new Uint8Array(data16.length);
  for (let i = 0; i < data16.length; i++) {
    out8[i] = Math.round(data16[i] / 257);
  }
  return out8;
}

async function encodeViaCanvas(
  width: number,
  height: number,
  rgba8: Uint8Array,
  mime: string,
  quality: number
): Promise<Uint8Array> {
  if (typeof OffscreenCanvas !== 'undefined') {
    const canvas = new OffscreenCanvas(width, height);
    const ctx = canvas.getContext('2d')!;
    const imgData = ctx.createImageData(width, height);
    imgData.data.set(rgba8);
    ctx.putImageData(imgData, 0, 0);

    const blob = await canvas.convertToBlob({ type: mime, quality });
    const buf = await blob.arrayBuffer();
    return new Uint8Array(buf);
  }

  throw new Error(`OffscreenCanvas is not available to encode ${mime}`);
}
