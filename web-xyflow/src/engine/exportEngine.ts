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
  PreflightOutputItem,
  TextureExportFormat,
  TextureBitDepth,
  TextureColorSpace,
  TextureCollection,
} from '../types/export';
import { BatchEngine } from './batchEngine';
import { autoDetectOutputRole } from '../graph/introspect';

export type ExportTargetResolution =
  | { mode: 'inherit' }
  | { mode: 'longEdge'; px: number }
  | { mode: 'stretch'; w: number; h: number };

export function calculateTargetDimensions(
  srcWidth: number,
  srcHeight: number,
  target?: ExportTargetResolution | number
): { width: number; height: number } {
  if (!target) {
    return { width: srcWidth, height: srcHeight };
  }

  if (typeof target === 'number') {
    return calculateTargetDimensions(srcWidth, srcHeight, { mode: 'longEdge', px: target });
  }

  if (target.mode === 'inherit') {
    return { width: srcWidth, height: srcHeight };
  }

  if (target.mode === 'stretch') {
    return { width: Math.max(1, Math.round(target.w)), height: Math.max(1, Math.round(target.h)) };
  }

  if (target.mode === 'longEdge') {
    const px = target.px;
    if (px <= 0) return { width: srcWidth, height: srcHeight };

    if (srcWidth >= srcHeight) {
      const outWidth = px;
      const outHeight = Math.max(1, Math.round((srcHeight * px) / srcWidth));
      return { width: outWidth, height: outHeight };
    } else {
      const outHeight = px;
      const outWidth = Math.max(1, Math.round((srcWidth * px) / srcHeight));
      return { width: outWidth, height: outHeight };
    }
  }

  return { width: srcWidth, height: srcHeight };
}

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

export const DEFAULT_PRESETS: ExportPreset[] = [
  {
    id: 'ue5',
    name: 'Unreal Engine 5 (T_{asset}_{slot})',
    pattern: 'T_{asset}_{slot}',
    description: 'Epic Games PBR standard: T_ prefix, asset name, and packed slot.',
    isBuiltIn: true,
  },
  {
    id: 'unity',
    name: 'Unity URP / HDRP ({asset}_{slot})',
    pattern: '{asset}_{slot}',
    description: 'Unity Standard & MaskMap standard: Asset name followed by map type.',
    isBuiltIn: true,
  },
  {
    id: 'substance',
    name: 'Substance Painter ({asset}_{slot}_{res})',
    pattern: '{asset}_{slot}_{res}',
    description: 'Substance 3D Painter classic export: Asset, Slot name, and Resolution.',
    isBuiltIn: true,
  },
  {
    id: 'blender',
    name: 'Blender Principled ({asset}_{slot})',
    pattern: '{asset}_{slot}',
    description: 'Clean Blender & glTF 2.0 PBR naming.',
    isBuiltIn: true,
  },
  {
    id: 'cryengine',
    name: 'CryEngine (T_{asset}_{slot})',
    pattern: 'T_{asset}_{slot}',
    description: 'CryEngine PBR texture standard.',
    isBuiltIn: true,
  },
];

export const EXPORT_PRESETS = DEFAULT_PRESETS;

export const DEFAULT_GLOBAL_SETTINGS: GlobalExportSettings = {
  projectName: 'TextureLab',
  assetName: 'AnthraciteConcrete',
  presetId: 'ue5',
  pattern: 'T_{asset}_{slot}',
  masterResolution: 'inherit',
  defaultFormat: 'PNG',
  defaultBitDepth: '8b',
};

/* ========================================================================= */
/* 2. TOKEN RESOLUTION ENGINE                                                */
/* ========================================================================= */

export interface TokenResolveContext {
  project?: string;
  asset?: string;
  slot?: string;
  res?: string;
  format: string;
  colorSpace?: string;
  udim?: string;
  set?: string;
  texture?: string;
  map?: string;
  index?: number | string;
}

export class ExportEngine {
  /**
   * Load presets from localStorage merged with built-in presets.
   */
  public static loadPresets(): ExportPreset[] {
    try {
      if (typeof window !== 'undefined') {
        const stored = localStorage.getItem('texturelab_export_presets');
        if (stored) {
          const parsed = JSON.parse(stored);
          if (Array.isArray(parsed) && parsed.length > 0) {
            const custom = parsed.filter((p: ExportPreset) => !DEFAULT_PRESETS.some((dp) => dp.id === p.id));
            return [...DEFAULT_PRESETS, ...custom];
          }
        }
      }
    } catch (e) {
      console.warn('Failed to load presets from localStorage', e);
    }
    return [...DEFAULT_PRESETS];
  }

  /**
   * Persist presets to localStorage.
   */
  public static savePresets(presets: ExportPreset[]): void {
    try {
      if (typeof window !== 'undefined') {
        localStorage.setItem('texturelab_export_presets', JSON.stringify(presets));
      }
    } catch (e) {
      console.warn('Failed to save presets to localStorage', e);
    }
  }

  /**
   * Validate a naming template for edge cases (empty, missing slot, illegal characters).
   * Note: '/' is allowed for organizing maps into subfolders.
   */
  public static validatePattern(pattern: string): { isValid: boolean; warning?: string; error?: string } {
    if (!pattern || pattern.trim().length === 0) {
      return { isValid: false, error: 'Output template cannot be empty' };
    }
    if (/[\\:*?"<>|]/.test(pattern)) {
      return { isValid: false, error: 'Illegal characters (\\ : * ? " < > |) detected. Use / for subfolders.' };
    }
    if (/\/{2,}/.test(pattern)) {
      return { isValid: false, error: 'Consecutive slashes (//) are not allowed in folder paths.' };
    }
    const hasSlot = /\{slot\}|\$slot|\{map\}|\$map/i.test(pattern);
    if (!hasSlot) {
      return { isValid: true, warning: 'Warning: Missing {slot} or {map} token. Output filenames may overwrite each other.' };
    }
    return { isValid: true };
  }

  /**
   * Resolve an output template string (or legacy TokenItem array) into a sanitized filename/subfolder path.
   */
  public static resolveFilename(
    patternOrTokens: string | TokenItem[],
    ctx: TokenResolveContext
  ): string {
    let raw = '';
    if (typeof patternOrTokens === 'string') {
      raw = patternOrTokens;
      const replaceMap: Record<string, string> = {
        project: ctx.project || 'Project',
        asset: ctx.asset || 'Asset',
        slot: ctx.slot || ctx.map || 'ORM',
        res: ctx.res || '4K',
        format: ctx.format.toLowerCase() || 'png',
        colorspace: ctx.colorSpace || 'Linear',
        udim: ctx.udim || '1001',
        set: ctx.set || ctx.asset || 'Set',
        texture: ctx.texture || ctx.asset || 'Texture',
        map: ctx.map || ctx.slot || 'Map',
        index: ctx.index !== undefined ? String(ctx.index) : '1',
      };
      for (const [key, val] of Object.entries(replaceMap)) {
        raw = raw.replace(new RegExp(`\\{${key}\\}`, 'gi'), val);
        raw = raw.replace(new RegExp(`\\$${key}\\b`, 'gi'), val);
      }
    } else {
      raw = patternOrTokens.map((t) => {
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
      }).join('');
    }

    // Ensure there's a valid extension delimiter before format if missing
    const ext = ctx.format.toLowerCase();
    if (!raw.toLowerCase().endsWith(`.${ext}`)) {
      raw = raw.replace(/[._-]+$/, '') + `.${ext}`;
    }

    // Split by '/' to preserve subfolder hierarchy while sanitizing each path segment
    const segments = raw
      .split('/')
      .map((seg) => seg.replace(/[\\:*?"<>|]/g, '_').trim())
      .filter(Boolean);

    return segments.join('/');
  }

  /**
   * Unified Preflight Registry: Aggregates explicit TextureOutput nodes, auto-registered
   * routing nodes (Pack, Unpack, Mixer), and BatchExport nodes with replacement rules and collision handling.
   */
  public static buildPreflightRegistry(
    nodes: any[],
    edges: any[],
    evaluatedBuffers: Record<string, TextureBuffer>,
    settings: GlobalExportSettings,
    pattern: string,
    batchCollections?: Record<string, TextureCollection>
  ): PreflightOutputItem[] {
    const consumedOutputs = new Set<string>();

    // 1. Identify all outputs that are explicitly consumed by TextureOutput or BatchExport
    for (const edge of edges) {
      const targetNode = nodes.find((n) => n.id === edge.target);
      if (targetNode && (targetNode.type === 'textureOutput' || targetNode.type === 'batchExport')) {
        const srcHandle = edge.sourceHandle || 'rgba';
        consumedOutputs.add(`${edge.source}:${srcHandle}`);
      }
    }

    const items: PreflightOutputItem[] = [];

    // Helper to resolve standard item attributes
    const formatFromNode = (d: any): TextureExportFormat =>
      d.formatOverride && d.formatOverride !== 'inherit' ? d.formatOverride : settings.defaultFormat;
    // Honest 16-bit (F-04, P1-A5): Force '8b' at export until true 16-bit pipeline arrives in Phase 4
    const bitDepthFromNode = (_d: any): TextureBitDepth => '8b';
    const colorSpaceFromNode = (d: any, autoCs: TextureColorSpace = 'linear'): TextureColorSpace =>
      d.isColorSpaceOverridden && d.colorSpace ? d.colorSpace : (d.autoDetectedColorSpace || d.colorSpace || autoCs);
    const resFromNode = (d: any, buf?: TextureBuffer): string => {
      if (d.resolutionOverride && d.resolutionOverride !== 'inherit') {
        return `${Math.round(parseInt(d.resolutionOverride) / 1024)}K`;
      }
      if (settings.masterResolution !== 'inherit') {
        return `${Math.round(parseInt(settings.masterResolution) / 1024)}K`;
      }
      if (buf) {
        return `${Math.round(buf.width / 1024)}K`;
      }
      return '4K';
    };

    // 2. Explicit TextureOutput Nodes
    const outputNodes = nodes.filter((n) => n.type === 'textureOutput');
    for (const n of outputNodes) {
      const d = n.data || {};
      const inEdge = edges.find((e) => e.target === n.id && (e.targetHandle === 'rgba' || !e.targetHandle));
      const isConnected = !!inEdge;
      const buf = evaluatedBuffers[n.id];
      const autoInfo = isConnected ? autoDetectOutputRole(n.id, nodes, edges) : null;

      const slot = (d.slot && typeof d.slot === 'string' && d.slot.trim() !== '')
        ? d.slot
        : (autoInfo?.slot || d.autoDetectedSlot || 'ORM');
      const format = formatFromNode(d);
      const bitDepth = bitDepthFromNode(d);
      const colorSpace = colorSpaceFromNode(d, autoInfo?.colorSpace || 'linear');
      const resLabel = resFromNode(d, buf);

      const resolvedFilename = this.resolveFilename(pattern, {
        project: settings.projectName,
        asset: settings.assetName,
        slot,
        res: resLabel,
        format,
        colorSpace: colorSpace === 'sRGB' ? 'sRGB' : 'Linear',
      });

      const srcHandle = inEdge?.sourceHandle || 'rgba';
      const sourceOutput = inEdge ? `${inEdge.source}:${srcHandle}` : undefined;

      items.push({
        nodeId: n.id,
        title: d.title || 'Texture Output',
        slot,
        isSlotOverridden: !!d.isSlotOverridden,
        isConnected,
        previewUrl: buf?.dataUrl,
        format,
        bitDepth,
        colorSpace,
        resolution: resLabel,
        resolvedFilename,
        enabled: d.enabled !== false,
        sourceType: 'explicit',
        sourceOutput,
        buffer: buf,
      });
    }

    // 3. Auto-registered ChannelPack / ChannelCombiner Nodes (Output: RGBA)
    const packNodes = nodes.filter((n) => n.type === 'channelPack' || n.type === 'channelCombiner');
    for (const n of packNodes) {
      const srcKey = `${n.id}:rgba`;
      if (!consumedOutputs.has(srcKey)) {
        const d = n.data || {};
        const buf = evaluatedBuffers[n.id];
        const isConnected = edges.some((e) => e.target === n.id);
        const slot = d.slot || 'ORM';
        const format = formatFromNode(d);
        const bitDepth = bitDepthFromNode(d);
        const colorSpace: TextureColorSpace = 'linear';
        const resLabel = resFromNode(d, buf);

        const resolvedFilename = this.resolveFilename(pattern, {
          project: settings.projectName,
          asset: settings.assetName,
          slot,
          res: resLabel,
          format,
          colorSpace: 'Linear',
        });

        items.push({
          nodeId: n.id,
          title: `Auto-Pack: ${slot}`,
          slot,
          isSlotOverridden: false,
          isConnected,
          previewUrl: buf?.dataUrl,
          format,
          bitDepth,
          colorSpace,
          resolution: resLabel,
          resolvedFilename,
          enabled: d.enabled !== false,
          sourceType: 'channelPack',
          sourceOutput: srcKey,
          buffer: buf,
        });
      }
    }

    // 4. Auto-registered ChannelUnpack / ChannelSplitter Nodes (Outputs: R, G, B, A)
    const unpackNodes = nodes.filter((n) => n.type === 'channelUnpack' || n.type === 'channelSplitter');
    for (const n of unpackNodes) {
      const d = n.data || {};
      const inEdge = edges.find((e) => e.target === n.id);
      const isConnected = !!inEdge;
      const buf = evaluatedBuffers[n.id];
      const channels = (d.channels as Record<string, string>) || { r: 'R', g: 'G', b: 'B', a: 'A' };

      const activeChannels: ('r' | 'g' | 'b' | 'a')[] = ['r', 'g', 'b', 'a'];
      for (const ch of activeChannels) {
        const srcKey = `${n.id}:${ch}`;
        if (!consumedOutputs.has(srcKey)) {
          const slot = channels[ch] || ch.toUpperCase();
          const format = formatFromNode(d);
          const bitDepth = bitDepthFromNode(d);
          const colorSpace: TextureColorSpace = 'linear';
          const resLabel = resFromNode(d, buf);

          const resolvedFilename = this.resolveFilename(pattern, {
            project: settings.projectName,
            asset: settings.assetName,
            slot,
            res: resLabel,
            format,
            colorSpace: 'Linear',
          });

          items.push({
            nodeId: n.id,
            title: `Auto-Unpack: ${slot}`,
            slot,
            isSlotOverridden: false,
            isConnected,
            previewUrl: buf?.dataUrl,
            format,
            bitDepth,
            colorSpace,
            resolution: resLabel,
            resolvedFilename,
            enabled: d.enabled !== false,
            sourceType: 'channelUnpack',
            sourceOutput: srcKey,
            sourceHandle: ch,
            buffer: buf,
          });
        }
      }
    }

    // 5. Auto-registered ChannelMixer / ChannelSwizzle Nodes
    const mixerNodes = nodes.filter((n) => n.type === 'channelMixer' || n.type === 'channelSwizzle');
    for (const n of mixerNodes) {
      const d = n.data || {};
      const registeredOutputs: string[] = d.exportOutputs || ['rgba'];
      const buf = evaluatedBuffers[n.id];
      const isConnected = edges.some((e) => e.target === n.id);

      for (const outKey of registeredOutputs) {
        const srcKey = `${n.id}:${outKey}`;
        if (!consumedOutputs.has(srcKey)) {
          const slot = d.slot || outKey.toUpperCase();
          const format = formatFromNode(d);
          const bitDepth = bitDepthFromNode(d);
          const colorSpace: TextureColorSpace = 'linear';
          const resLabel = resFromNode(d, buf);

          const resolvedFilename = this.resolveFilename(pattern, {
            project: settings.projectName,
            asset: settings.assetName,
            slot,
            res: resLabel,
            format,
            colorSpace: 'Linear',
          });

          items.push({
            nodeId: n.id,
            title: `Mixer Output: ${slot}`,
            slot,
            isSlotOverridden: false,
            isConnected,
            previewUrl: buf?.dataUrl,
            format,
            bitDepth,
            colorSpace,
            resolution: resLabel,
            resolvedFilename,
            enabled: d.enabled !== false,
            sourceType: 'channelMixer',
            sourceOutput: srcKey,
            buffer: buf,
          });
        }
      }
    }

    // 6. BatchExport Nodes (Registered Collections / ForEach outputs)
    const batchNodes = nodes.filter((n) => n.type === 'batchExport');
    for (const n of batchNodes) {
      const d = n.data || {};
      const colId = d.collectionId;
      const collection = batchCollections?.[colId] || (d.collection as TextureCollection);
      if (collection && collection.items) {
        for (const texItem of collection.items) {
          if (texItem.isExcluded) continue;
          const slot = texItem.canonicalSuffix || texItem.mapType.toUpperCase();
          const format = (d.format as TextureExportFormat) || settings.defaultFormat;
          const bitDepth: TextureBitDepth = '8b';
          const colorSpace = texItem.mapType === 'base_color' ? 'sRGB' : 'linear';
          const resLabel = settings.masterResolution !== 'inherit' ? `${Math.round(parseInt(settings.masterResolution) / 1024)}K` : '4K';

          const resolvedFilename = this.resolveFilename(d.pattern || pattern, {
            project: settings.projectName,
            asset: texItem.setName || settings.assetName,
            slot,
            res: resLabel,
            format,
            colorSpace: colorSpace === 'sRGB' ? 'sRGB' : 'Linear',
          });

          items.push({
            nodeId: n.id,
            title: `Batch: ${texItem.filename}`,
            slot,
            isSlotOverridden: false,
            isConnected: true,
            previewUrl: texItem.dataUrl,
            format,
            bitDepth,
            colorSpace,
            resolution: resLabel,
            resolvedFilename,
            enabled: d.enabled !== false,
            sourceType: 'batchExport',
            batchItemIdentity: `${n.id}:${texItem.id}`,
            buffer: texItem.buffer,
          });
        }
      }
    }

    // 7. Deduplication & Collision Policy
    // Deduplicate by sourceOutput (if explicit exists, it replaces auto entry)
    const deduped: PreflightOutputItem[] = [];
    const sourceSeen = new Map<string, PreflightOutputItem>();

    for (const item of items) {
      if (item.sourceOutput) {
        const existing = sourceSeen.get(item.sourceOutput);
        if (existing) {
          if (item.sourceType === 'explicit' && existing.sourceType !== 'explicit') {
            // Replace automatic with explicit!
            const idx = deduped.indexOf(existing);
            if (idx !== -1) {
              deduped[idx] = item;
              sourceSeen.set(item.sourceOutput, item);
            }
          }
          continue;
        }
        sourceSeen.set(item.sourceOutput, item);
      }
      deduped.push(item);
    }

    // Resolve Filename Collisions
    const rawFilenames = deduped.map((i) => i.resolvedFilename);
    const { resolved } = BatchEngine.resolveCollisions(rawFilenames, settings.collisionPolicy || 'rename');
    for (let i = 0; i < deduped.length; i++) {
      if (resolved[i]) {
        deduped[i].resolvedFilename = resolved[i];
      }
    }

    return deduped;
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
      const parts = f.filename.split('/').filter(Boolean);
      let targetDir = dirHandle;
      for (let i = 0; i < parts.length - 1; i++) {
        targetDir = await targetDir.getDirectoryHandle(parts[i], { create: true });
      }
      const leafName = parts[parts.length - 1];
      const fileHandle = await targetDir.getFileHandle(leafName, { create: true });
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
