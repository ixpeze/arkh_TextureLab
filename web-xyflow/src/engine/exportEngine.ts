/**
 * Export Engine & Pipeline Processor
 * Handles token resolution, Truevision TGA binary encoding, client-side ZIP packaging,
 * and File System Access API direct-disk export.
 */

import type { TextureBuffer } from './pixelEngine';
import type {
  ExportPreset,
  GlobalExportSettings,
  PreflightOutputItem,
  TextureExportFormat,
  TextureCollection,
  TokenItem,
} from '../types/export';
import type { Node, Edge } from '@xyflow/react';
import {
  calculateTargetDimensions,
  loadPresets,
  savePresets,
  validatePattern,
  resolveFilename,
  type ExportTargetResolution,
  type TokenResolveContext,
} from './exportPresets';
import { getPlatform, type DirectoryExportTarget } from '../platform/PlatformService';
export type { DirectoryExportTarget };
import { createZip } from './exportZip';
import { encodeTGA } from './exportTga';
import { buildPreflightRegistry } from './exportPreflight';

// Re-exports for backwards compatibility across existing imports
export {
  calculateTargetDimensions,
  AVAILABLE_TOKENS,
  DEFAULT_PRESETS,
  EXPORT_PRESETS,
  DEFAULT_GLOBAL_SETTINGS,
  loadPresets,
  savePresets,
  validatePattern,
  resolveFilename,
  type ExportTargetResolution,
  type TokenResolveContext,
} from './exportPresets';
export { createZip } from './exportZip';
export { encodeTGA } from './exportTga';
export { buildPreflightRegistry } from './exportPreflight';

export class ExportEngine {
  public static loadPresets(): ExportPreset[] {
    return loadPresets();
  }

  public static savePresets(presets: ExportPreset[]): void {
    savePresets(presets);
  }

  public static validatePattern(pattern: string): { isValid: boolean; warning?: string; error?: string } {
    return validatePattern(pattern);
  }

  public static resolveFilename(
    patternOrTokens: string | TokenItem[],
    ctx: TokenResolveContext
  ): string {
    return resolveFilename(patternOrTokens, ctx);
  }

  public static buildPreflightRegistry(
    nodes: Node[],
    edges: Edge[],
    evaluatedBuffers: Record<string, TextureBuffer>,
    settings: GlobalExportSettings,
    pattern: string,
    batchCollections?: Record<string, TextureCollection>
  ): PreflightOutputItem[] {
    return buildPreflightRegistry(nodes, edges, evaluatedBuffers, settings, pattern, batchCollections);
  }

  public static encodeTGA(buffer: TextureBuffer): Blob {
    return encodeTGA(buffer);
  }

  public static async encodeImageBlob(
    buffer: TextureBuffer,
    format: TextureExportFormat,
    target?: ExportTargetResolution | number
  ): Promise<Blob> {
    const { width: outWidth, height: outHeight } = calculateTargetDimensions(buffer.width, buffer.height, target);

    if (format === 'TGA') {
      let targetBuf = buffer;
      if (outWidth !== buffer.width || outHeight !== buffer.height) {
        targetBuf = this.resizeBuffer(buffer, outWidth, outHeight);
      }
      return this.encodeTGA(targetBuf);
    }

    const canvas = document.createElement('canvas');
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

  public static resizeBuffer(buffer: TextureBuffer, newWidth: number, newHeight: number): TextureBuffer {
    if (buffer.width === newWidth && buffer.height === newHeight) {
      return buffer;
    }

    // Pure CPU bilinear resample (works in both Node test env and browser without Canvas2D premultiplication)
    const srcData = buffer.data;
    const srcW = buffer.width;
    const srcH = buffer.height;
    const dstData = new Uint8ClampedArray(newWidth * newHeight * 4);

    const xRatio = srcW > 1 ? (srcW - 1) / (newWidth > 1 ? newWidth - 1 : 1) : 0;
    const yRatio = srcH > 1 ? (srcH - 1) / (newHeight > 1 ? newHeight - 1 : 1) : 0;

    for (let y = 0; y < newHeight; y++) {
      const srcY = y * yRatio;
      const yLow = Math.floor(srcY);
      const yHigh = Math.min(yLow + 1, srcH - 1);
      const yWeight = srcY - yLow;

      for (let x = 0; x < newWidth; x++) {
        const srcX = x * xRatio;
        const xLow = Math.floor(srcX);
        const xHigh = Math.min(xLow + 1, srcW - 1);
        const xWeight = srcX - xLow;

        const dstIdx = (y * newWidth + x) * 4;

        const idx00 = (yLow * srcW + xLow) * 4;
        const idx10 = (yLow * srcW + xHigh) * 4;
        const idx01 = (yHigh * srcW + xLow) * 4;
        const idx11 = (yHigh * srcW + xHigh) * 4;

        for (let c = 0; c < 4; c++) {
          const top = srcData[idx00 + c] * (1 - xWeight) + srcData[idx10 + c] * xWeight;
          const bottom = srcData[idx01 + c] * (1 - xWeight) + srcData[idx11 + c] * xWeight;
          dstData[dstIdx + c] = Math.round(top * (1 - yWeight) + bottom * yWeight);
        }
      }
    }

    return {
      width: newWidth,
      height: newHeight,
      data: dstData,
    };
  }

  public static async createZip(files: { filename: string; blob: Blob }[]): Promise<Blob> {
    return createZip(files);
  }

  public static isDirectoryPickerSupported(): boolean {
    return getPlatform().isFolderExportSupported();
  }

  public static async pickDirectory(): Promise<DirectoryExportTarget | null> {
    return await getPlatform().pickDirectory();
  }

  public static async exportToDirectory(
    files: { filename: string; blob: Blob }[],
    target: DirectoryExportTarget
  ): Promise<void> {
    return await getPlatform().exportFiles(files, target);
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
