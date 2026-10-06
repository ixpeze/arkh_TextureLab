/**
 * ARKH TextureLab - Magic-Byte Sniffing Image Decoder
 * Pure-JS exact decoders for PNG, TGA, and color-unmanaged JPEG/WebP.
 */

import { decode as decodePng, hasPngSignature } from 'fast-png';
import { decodeTga } from './tga';

export interface DecodedImage {
  width: number;
  height: number;
  channels: 4;
  bitDepth: 8 | 16;
  data: Uint8Array | Uint16Array;
  format: 'png' | 'jpeg' | 'webp' | 'tga';
}

export type ImageFormatType = 'png' | 'jpeg' | 'webp' | 'tga' | 'tiff' | 'exr' | 'unknown';

export function sniffFormat(bytes: Uint8Array): ImageFormatType {
  if (bytes.length < 4) return 'unknown';

  // PNG: 89 50 4E 47 0D 0A 1A 0A
  if (hasPngSignature(bytes)) return 'png';

  // JPEG: FF D8 FF
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return 'jpeg';

  // WebP: RIFF ... WEBP
  if (
    bytes.length >= 12 &&
    bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46 &&
    bytes[8] === 0x57 && bytes[9] === 0x45 && bytes[10] === 0x42 && bytes[11] === 0x50
  ) {
    return 'webp';
  }

  // TIFF: II*. or MM.*
  if (
    (bytes[0] === 0x49 && bytes[1] === 0x49 && bytes[2] === 0x2a && bytes[3] === 0x00) ||
    (bytes[0] === 0x4d && bytes[1] === 0x4d && bytes[2] === 0x00 && bytes[3] === 0x2a)
  ) {
    return 'tiff';
  }

  // EXR: 76 2F 31 01
  if (bytes[0] === 0x76 && bytes[1] === 0x2f && bytes[2] === 0x31 && bytes[3] === 0x01) {
    return 'exr';
  }

  // TGA: header inspection (imageType 1, 2, 3, 9, 10, 11)
  if (bytes.length >= 18) {
    const imgType = bytes[2];
    const depth = bytes[16];
    if (
      (imgType === 2 || imgType === 3 || imgType === 10 || imgType === 11) &&
      (depth === 8 || depth === 24 || depth === 32)
    ) {
      return 'tga';
    }
  }

  return 'unknown';
}

export async function decodeImage(
  buffer: ArrayBuffer | Uint8Array,
  filename = 'file'
): Promise<DecodedImage> {
  const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);

  if (bytes.length === 0) {
    throw new Error(`Cannot load "${filename}": file is empty (0 bytes).`);
  }

  const format = sniffFormat(bytes);

  if (format === 'tiff') {
    throw new Error(`Cannot load "${filename}": TIFF format is not supported in v1.0 (deferred to v1.1).`);
  }

  if (format === 'exr') {
    throw new Error(`Cannot load "${filename}": EXR format is not supported in v1.0 (deferred to v1.1).`);
  }

  if (format === 'unknown') {
    throw new Error(
      `Cannot load "${filename}": unrecognized or unsupported image format. Supported formats: PNG, TGA, JPEG, WebP.`
    );
  }

  try {
    if (format === 'png') {
      return decodePngImage(bytes);
    }

    if (format === 'tga') {
      const tga = decodeTga(bytes);
      return {
        width: tga.width,
        height: tga.height,
        channels: 4,
        bitDepth: 8,
        data: tga.data,
        format: 'tga',
      };
    }

    if (format === 'jpeg' || format === 'webp') {
      return await decodeBrowserImage(bytes, format);
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    throw new Error(`Failed to decode image "${filename}": ${msg}`);
  }

  throw new Error(`Unsupported decoder for format: ${format}`);
}

function decodePngImage(bytes: Uint8Array): DecodedImage {
  const raw = decodePng(bytes);
  const width = raw.width;
  const height = raw.height;
  const depth = raw.depth === 16 ? 16 : 8;
  const totalPixels = width * height;

  if (depth === 16) {
    // 16-bit PNG
    const rawData = raw.data as Uint16Array;
    if (raw.channels === 4) {
      return { width, height, channels: 4, bitDepth: 16, data: rawData, format: 'png' };
    }

    // Expand 16-bit 1-channel or 3-channel to 16-bit 4-channel
    const rgba16 = new Uint16Array(totalPixels * 4);
    if (raw.channels === 1) {
      for (let i = 0; i < totalPixels; i++) {
        const v = rawData[i];
        rgba16[i * 4 + 0] = v;
        rgba16[i * 4 + 1] = v;
        rgba16[i * 4 + 2] = v;
        rgba16[i * 4 + 3] = 65535;
      }
    } else if (raw.channels === 3) {
      for (let i = 0; i < totalPixels; i++) {
        rgba16[i * 4 + 0] = rawData[i * 3 + 0];
        rgba16[i * 4 + 1] = rawData[i * 3 + 1];
        rgba16[i * 4 + 2] = rawData[i * 3 + 2];
        rgba16[i * 4 + 3] = 65535;
      }
    }
    return { width, height, channels: 4, bitDepth: 16, data: rgba16, format: 'png' };
  }

  // 8-bit PNG
  const rawData = raw.data as Uint8Array;
  if (raw.channels === 4) {
    return { width, height, channels: 4, bitDepth: 8, data: rawData, format: 'png' };
  }

  const rgba8 = new Uint8Array(totalPixels * 4);
  if (raw.channels === 1) {
    for (let i = 0; i < totalPixels; i++) {
      const v = rawData[i];
      rgba8[i * 4 + 0] = v;
      rgba8[i * 4 + 1] = v;
      rgba8[i * 4 + 2] = v;
      rgba8[i * 4 + 3] = 255;
    }
  } else if (raw.channels === 2) {
    for (let i = 0; i < totalPixels; i++) {
      const v = rawData[i * 2 + 0];
      const a = rawData[i * 2 + 1];
      rgba8[i * 4 + 0] = v;
      rgba8[i * 4 + 1] = v;
      rgba8[i * 4 + 2] = v;
      rgba8[i * 4 + 3] = a;
    }
  } else if (raw.channels === 3) {
    for (let i = 0; i < totalPixels; i++) {
      rgba8[i * 4 + 0] = rawData[i * 3 + 0];
      rgba8[i * 4 + 1] = rawData[i * 3 + 1];
      rgba8[i * 4 + 2] = rawData[i * 3 + 2];
      rgba8[i * 4 + 3] = 255;
    }
  }

  return { width, height, channels: 4, bitDepth: 8, data: rgba8, format: 'png' };
}

async function decodeBrowserImage(
  bytes: Uint8Array,
  format: 'jpeg' | 'webp'
): Promise<DecodedImage> {
  const mime = format === 'jpeg' ? 'image/jpeg' : 'image/webp';
  const blob = new Blob([bytes as unknown as BlobPart], { type: mime });

  if (typeof createImageBitmap !== 'undefined') {
    const bmp = await createImageBitmap(blob, {
      colorSpaceConversion: 'none',
      premultiplyAlpha: 'none',
    });
    const canvas = new OffscreenCanvas(bmp.width, bmp.height);
    const ctx = canvas.getContext('2d')!;
    ctx.drawImage(bmp, 0, 0);
    const imgData = ctx.getImageData(0, 0, bmp.width, bmp.height);
    bmp.close();

    return {
      width: imgData.width,
      height: imgData.height,
      channels: 4,
      bitDepth: 8,
      data: new Uint8Array(imgData.data.buffer),
      format,
    };
  }

  throw new Error(`createImageBitmap is not available to decode ${format}`);
}
