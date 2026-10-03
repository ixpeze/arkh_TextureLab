/**
 * Export Engine & Pipeline Processor
 * Handles token resolution, Truevision TGA binary encoding, client-side ZIP packaging,
 * and File System Access API direct-disk export.
 */

import type { TextureBuffer } from './pixelEngine';
import type {
  ExportPreset,
  GlobalExportSettings,
  NamingTokenId,
  TokenItem,
} from '../types/export';

/* ========================================================================= */
/* 1. INDUSTRY STANDARD PRESETS & TOKENS                                     */
/* ========================================================================= */

export const AVAILABLE_TOKENS: { id: NamingTokenId; label: string; example: string }[] = [
  { id: '$project', label: 'Project', example: 'TextureLab' },
  { id: '$asset', label: 'Asset', example: 'AnthraciteConcrete' },
  { id: '$slot', label: 'Map Slot', example: 'ORM' },
  { id: '$res', label: 'Resolution', example: '4K' },
  { id: '$colorspace', label: 'Color Space', example: 'Linear' },
  { id: '$format', label: 'Format', example: 'png' },
  { id: '$udim', label: 'UDIM Tile', example: '1001' },
];

export const EXPORT_PRESETS: ExportPreset[] = [
  {
    id: 'ue5',
    name: 'Unreal Engine 5 (T_Asset_Slot)',
    description: 'Epic Games PBR convention: T_ prefix, asset name, and packed slot.',
    tokens: [
      { id: 't_prefix', type: 'literal', value: 'T' },
      { id: 'd1', type: 'delimiter', value: '_' },
      { id: 't_asset', type: 'token', value: '$asset', label: 'Asset' },
      { id: 'd2', type: 'delimiter', value: '_' },
      { id: 't_slot', type: 'token', value: '$slot', label: 'Map Slot' },
      { id: 'd3', type: 'delimiter', value: '.' },
      { id: 't_fmt', type: 'token', value: '$format', label: 'Format' },
    ],
  },
  {
    id: 'unity',
    name: 'Unity URP / HDRP (Asset_Slot)',
    description: 'Unity Standard & MaskMap standard: Asset name followed by map type.',
    tokens: [
      { id: 't_asset', type: 'token', value: '$asset', label: 'Asset' },
      { id: 'd1', type: 'delimiter', value: '_' },
      { id: 't_slot', type: 'token', value: '$slot', label: 'Map Slot' },
      { id: 'd2', type: 'delimiter', value: '.' },
      { id: 't_fmt', type: 'token', value: '$format', label: 'Format' },
    ],
  },
  {
    id: 'substance',
    name: 'Substance Painter (Asset_Slot_Res)',
    description: 'Substance 3D Painter classic export: Asset, Slot name, and Resolution.',
    tokens: [
      { id: 't_asset', type: 'token', value: '$asset', label: 'Asset' },
      { id: 'd1', type: 'delimiter', value: '_' },
      { id: 't_slot', type: 'token', value: '$slot', label: 'Map Slot' },
      { id: 'd2', type: 'delimiter', value: '_' },
      { id: 't_res', type: 'token', value: '$res', label: 'Resolution' },
      { id: 'd3', type: 'delimiter', value: '.' },
      { id: 't_fmt', type: 'token', value: '$format', label: 'Format' },
    ],
  },
  {
    id: 'blender',
    name: 'Blender Principled (Asset_Slot)',
    description: 'Clean Blender & glTF 2.0 PBR naming.',
    tokens: [
      { id: 't_asset', type: 'token', value: '$asset', label: 'Asset' },
      { id: 'd1', type: 'delimiter', value: '_' },
      { id: 't_slot', type: 'token', value: '$slot', label: 'Map Slot' },
      { id: 'd2', type: 'delimiter', value: '.' },
      { id: 't_fmt', type: 'token', value: '$format', label: 'Format' },
    ],
  },
  {
    id: 'custom',
    name: 'Custom User Template',
    description: 'Freely configured token sequence and delimiters.',
    tokens: [
      { id: 't_asset', type: 'token', value: '$asset', label: 'Asset' },
      { id: 'd1', type: 'delimiter', value: '_' },
      { id: 't_slot', type: 'token', value: '$slot', label: 'Map Slot' },
      { id: 'd2', type: 'delimiter', value: '.' },
      { id: 't_fmt', type: 'token', value: '$format', label: 'Format' },
    ],
  },
];

export const DEFAULT_GLOBAL_SETTINGS: GlobalExportSettings = {
  projectName: 'TextureLab',
  assetName: 'AnthraciteConcrete',
  presetId: 'ue5',
  tokens: [...EXPORT_PRESETS[0].tokens],
  masterResolution: 'inherit',
  defaultFormat: 'PNG',
  defaultBitDepth: '8b',
};

/* ========================================================================= */
/* 2. TOKEN RESOLUTION ENGINE                                                */
/* ========================================================================= */

export interface TokenResolveContext {
  project: string;
  asset: string;
  slot: string;
  res: string;
  format: string;
  colorSpace: string;
  udim?: string;
}

export class ExportEngine {
  /**
   * Resolve an array of tokens into a sanitized, safe filename.
   */
  public static resolveFilename(tokens: TokenItem[], ctx: TokenResolveContext): string {
    const rawParts = tokens.map((t) => {
      switch (t.value) {
        case '$project':
          return ctx.project || 'Project';
        case '$asset':
          return ctx.asset || 'Asset';
        case '$slot':
          return ctx.slot || 'ORM';
        case '$res':
          return ctx.res || '4K';
        case '$format':
          return ctx.format.toLowerCase() || 'png';
        case '$colorspace':
          return ctx.colorSpace || 'Linear';
        case '$udim':
          return ctx.udim || '1001';
        default:
          return t.value;
      }
    });

    let result = rawParts.join('');

    // Ensure there's a valid extension delimiter before format if missing
    const ext = ctx.format.toLowerCase();
    if (!result.toLowerCase().endsWith(`.${ext}`)) {
      // Strip any trailing dots or delimiters before appending
      result = result.replace(/[._-]+$/, '') + `.${ext}`;
    }

    // Clean up illegal filesystem characters
    result = result.replace(/[\\/:*?"<>|]/g, '_');

    return result;
  }

  /* ========================================================================= */
  /* 3. BINARY TRUEVISION TGA ENCODER (32-bit BGRA Uncompressed)               */
  /* ========================================================================= */

  /**
   * Encode an RGBA TextureBuffer directly into uncompressed 32-bit Truevision TGA binary format.
   * Standard for 3ds Max, Maya, Unreal Engine, and Marmoset pipelines.
   */
  public static encodeTGA(buffer: TextureBuffer): Blob {
    const width = buffer.width;
    const height = buffer.height;
    const headerSize = 18;
    const pixelBytes = width * height * 4;
    const totalBytes = headerSize + pixelBytes;

    const out = new Uint8Array(totalBytes);

    // 18-byte Truevision TGA Header
    out[0] = 0; // ID Length: 0 (no identification field)
    out[1] = 0; // Color Map Type: 0 (no color map)
    out[2] = 2; // Image Type: 2 (Uncompressed, True-color Image)
    out[3] = 0; // Color Map Spec (5 bytes unused)
    out[4] = 0;
    out[5] = 0;
    out[6] = 0;
    out[7] = 0;
    out[8] = 0; // X Origin: 0
    out[9] = 0;
    out[10] = 0; // Y Origin: 0
    out[11] = 0;
    out[12] = width & 0xff; // Width (Little-endian 16-bit)
    out[13] = (width >> 8) & 0xff;
    out[14] = height & 0xff; // Height (Little-endian 16-bit)
    out[15] = (height >> 8) & 0xff;
    out[16] = 32; // Bits per pixel (32-bit BGRA)
    out[17] = 0x20; // Image Descriptor: Top-to-bottom, Left-to-right (0x20), 8-bit alpha

    // Convert RGBA -> BGRA in uncompressed TGA byte order
    const src = buffer.data;
    let dstIdx = headerSize;
    const totalPixels = width * height;

    for (let i = 0; i < totalPixels; i++) {
      const srcIdx = i * 4;
      out[dstIdx + 0] = src[srcIdx + 2]; // Blue
      out[dstIdx + 1] = src[srcIdx + 1]; // Green
      out[dstIdx + 2] = src[srcIdx + 0]; // Red
      out[dstIdx + 3] = src[srcIdx + 3]; // Alpha
      dstIdx += 4;
    }

    return new Blob([out], { type: 'image/x-tga' });
  }

  /* ========================================================================= */
  /* 4. CANVAS ENCODER (PNG / JPG / WebP) WITH RESOLUTION SCALING              */
  /* ========================================================================= */

  public static async encodeImageBlob(
    buffer: TextureBuffer,
    format: 'PNG' | 'TGA' | 'JPG' | 'WEBP',
    targetResolution?: number
  ): Promise<Blob> {
    if (format === 'TGA') {
      let targetBuf = buffer;
      if (targetResolution && targetResolution !== buffer.width) {
        targetBuf = this.resizeBuffer(buffer, targetResolution, targetResolution);
      }
      return this.encodeTGA(targetBuf);
    }

    const canvas = document.createElement('canvas');
    const outWidth = targetResolution || buffer.width;
    const outHeight = targetResolution || buffer.height;
    canvas.width = outWidth;
    canvas.height = outHeight;

    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Could not acquire 2D rendering context');

    if (outWidth === buffer.width && outHeight === buffer.height) {
      const imgData = ctx.createImageData(buffer.width, buffer.height);
      imgData.data.set(buffer.data);
      ctx.putImageData(imgData, 0, 0);
    } else {
      // High-quality resizing via intermediate source canvas
      const srcCanvas = document.createElement('canvas');
      srcCanvas.width = buffer.width;
      srcCanvas.height = buffer.height;
      const srcCtx = srcCanvas.getContext('2d')!;
      const srcImgData = srcCtx.createImageData(buffer.width, buffer.height);
      srcImgData.data.set(buffer.data);
      srcCtx.putImageData(srcImgData, 0, 0);

      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(srcCanvas, 0, 0, outWidth, outHeight);
    }

    let mimeType = 'image/png';
    let quality = 0.95;
    if (format === 'JPG') {
      mimeType = 'image/jpeg';
      quality = 0.92;
    } else if (format === 'WEBP') {
      mimeType = 'image/webp';
      quality = 0.95;
    }

    return new Promise<Blob>((resolve, reject) => {
      canvas.toBlob(
        (blob) => {
          if (blob) resolve(blob);
          else reject(new Error('Failed to encode image blob from canvas'));
        },
        mimeType,
        quality
      );
    });
  }

  private static resizeBuffer(buffer: TextureBuffer, newWidth: number, newHeight: number): TextureBuffer {
    const canvas = document.createElement('canvas');
    canvas.width = newWidth;
    canvas.height = newHeight;
    const ctx = canvas.getContext('2d', { willReadFrequently: true })!;

    const srcCanvas = document.createElement('canvas');
    srcCanvas.width = buffer.width;
    srcCanvas.height = buffer.height;
    const srcCtx = srcCanvas.getContext('2d')!;
    const srcData = srcCtx.createImageData(buffer.width, buffer.height);
    srcData.data.set(buffer.data);
    srcCtx.putImageData(srcData, 0, 0);

    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(srcCanvas, 0, 0, newWidth, newHeight);

    const outData = ctx.getImageData(0, 0, newWidth, newHeight);
    return {
      width: newWidth,
      height: newHeight,
      data: outData.data,
    };
  }

  /* ========================================================================= */
  /* 5. LIGHTWEIGHT ZERO-DEPENDENCY ZIP GENERATOR                              */
  /* ========================================================================= */

  /**
   * Fast client-side ZIP generator in pure TypeScript.
   * Creates standard PKZip uncompressed (Store) archives without external dependencies.
   */
  public static async createZip(files: { filename: string; blob: Blob }[]): Promise<Blob> {
    const fileEntries: {
      filenameBytes: Uint8Array;
      dataBytes: Uint8Array;
      crc32: number;
      offset: number;
    }[] = [];

    let currentOffset = 0;
    const parts: Uint8Array[] = [];

    for (const f of files) {
      const dataBytes = new Uint8Array(await f.blob.arrayBuffer());
      const encoder = new TextEncoder();
      const filenameBytes = encoder.encode(f.filename);
      const crc = this.computeCRC32(dataBytes);

      const localHeader = new Uint8Array(30 + filenameBytes.length);
      const view = new DataView(localHeader.buffer);

      // Local File Header Signature: 0x04034b50
      view.setUint32(0, 0x04034b50, true);
      view.setUint16(4, 20, true); // Version needed to extract: 2.0
      view.setUint16(6, 0, true); // General purpose bit flag
      view.setUint16(8, 0, true); // Compression method: 0 (Store)
      view.setUint16(10, 0, true); // Last mod file time
      view.setUint16(12, 0, true); // Last mod file date
      view.setUint32(14, crc, true); // CRC-32
      view.setUint32(18, dataBytes.length, true); // Compressed size
      view.setUint32(22, dataBytes.length, true); // Uncompressed size
      view.setUint16(26, filenameBytes.length, true); // File name length
      view.setUint16(28, 0, true); // Extra field length
      localHeader.set(filenameBytes, 30);

      parts.push(localHeader);
      parts.push(dataBytes);

      fileEntries.push({
        filenameBytes,
        dataBytes,
        crc32: crc,
        offset: currentOffset,
      });

      currentOffset += localHeader.length + dataBytes.length;
    }

    // Build Central Directory
    const centralDirOffset = currentOffset;
    let centralDirSize = 0;

    for (const entry of fileEntries) {
      const cdh = new Uint8Array(46 + entry.filenameBytes.length);
      const view = new DataView(cdh.buffer);

      // Central Directory Header Signature: 0x02014b50
      view.setUint32(0, 0x02014b50, true);
      view.setUint16(4, 20, true); // Version made by
      view.setUint16(6, 20, true); // Version needed
      view.setUint16(8, 0, true); // Flags
      view.setUint16(10, 0, true); // Compression: 0
      view.setUint16(12, 0, true); // Time
      view.setUint16(14, 0, true); // Date
      view.setUint32(16, entry.crc32, true); // CRC
      view.setUint32(20, entry.dataBytes.length, true); // Compressed size
      view.setUint32(24, entry.dataBytes.length, true); // Uncompressed size
      view.setUint16(28, entry.filenameBytes.length, true); // Filename length
      view.setUint16(30, 0, true); // Extra field length
      view.setUint16(32, 0, true); // File comment length
      view.setUint16(34, 0, true); // Disk number start
      view.setUint16(36, 0, true); // Internal file attributes
      view.setUint32(38, 0, true); // External file attributes
      view.setUint32(42, entry.offset, true); // Relative offset of local header
      cdh.set(entry.filenameBytes, 46);

      parts.push(cdh);
      centralDirSize += cdh.length;
    }

    // End of Central Directory Record (EOCD): 22 bytes
    const eocd = new Uint8Array(22);
    const eocdView = new DataView(eocd.buffer);
    // Signature: 0x06054b50
    eocdView.setUint32(0, 0x06054b50, true);
    eocdView.setUint16(4, 0, true); // Disk number
    eocdView.setUint16(6, 0, true); // Start disk
    eocdView.setUint16(8, fileEntries.length, true); // Total entries this disk
    eocdView.setUint16(10, fileEntries.length, true); // Total entries
    eocdView.setUint32(12, centralDirSize, true); // Size of central dir
    eocdView.setUint32(16, centralDirOffset, true); // Offset of central dir
    eocdView.setUint16(20, 0, true); // Comment length
    parts.push(eocd);

    return new Blob(parts as any, { type: 'application/zip' });
  }

  private static computeCRC32(data: Uint8Array): number {
    let crc = -1;
    for (let i = 0; i < data.length; i++) {
      crc = (crc >>> 8) ^ CRC_TABLE[(crc ^ data[i]) & 0xff];
    }
    return (crc ^ -1) >>> 0;
  }

  /* ========================================================================= */
  /* 6. DIRECT DISK STREAMING VIA FILE SYSTEM ACCESS API                       */
  /* ========================================================================= */

  public static isDirectoryPickerSupported(): boolean {
    return typeof window !== 'undefined' && 'showDirectoryPicker' in window;
  }

  public static async pickDirectory(): Promise<any | null> {
    if (!this.isDirectoryPickerSupported()) return null;
    try {
      return await (window as any).showDirectoryPicker({ mode: 'readwrite' });
    } catch (err: any) {
      if (err.name === 'AbortError') return null;
      console.warn('Directory Picker rejected:', err);
      return null;
    }
  }

  public static async exportToDirectory(
    files: { filename: string; blob: Blob }[],
    dirHandle: any
  ): Promise<void> {
    for (const f of files) {
      const fileHandle = await dirHandle.getFileHandle(f.filename, { create: true });
      const writable = await fileHandle.createWritable();
      await writable.write(f.blob);
      await writable.close();
    }
  }

  public static triggerDownload(blob: Blob, filename: string): void {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 1500);
  }
}

// Precomputed CRC32 Table
const CRC_TABLE = new Uint32Array(256);
for (let i = 0; i < 256; i++) {
  let c = i;
  for (let j = 0; j < 8; j++) {
    c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  }
  CRC_TABLE[i] = c >>> 0;
}
