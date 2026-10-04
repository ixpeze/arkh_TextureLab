import type { Node, Edge } from '@xyflow/react';
import type { TextureBuffer } from './pixelEngine';
import type {
  GlobalExportSettings,
  PreflightOutputItem,
  TextureCollection,
  TextureExportFormat,
  TextureBitDepth,
  TextureColorSpace,
} from '../types/export';
import { autoDetectOutputRole } from '../graph/introspect';
import { BatchEngine } from './batchEngine';
import { resolveFilename } from './exportPresets';

/**
 * Unified Preflight Registry: Aggregates explicit TextureOutput nodes, auto-registered
 * routing nodes (Pack, Unpack, Mixer), and BatchExport nodes with replacement rules and collision handling.
 */
export function buildPreflightRegistry(
  nodes: Node[],
  edges: Edge[],
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
  const formatFromNode = (d: Record<string, unknown>): TextureExportFormat =>
    (typeof d.formatOverride === 'string' && d.formatOverride !== 'inherit') ? (d.formatOverride as TextureExportFormat) : settings.defaultFormat;
  // Honest 16-bit (F-04, P1-A5): Force '8b' at export until true 16-bit pipeline arrives in Phase 4
  const bitDepthFromNode = (_d: Record<string, unknown>): TextureBitDepth => '8b';
  const colorSpaceFromNode = (d: Record<string, unknown>, autoCs: TextureColorSpace = 'linear'): TextureColorSpace =>
    (d.isColorSpaceOverridden && typeof d.colorSpace === 'string')
      ? (d.colorSpace as TextureColorSpace)
      : ((d.autoDetectedColorSpace as TextureColorSpace) || (d.colorSpace as TextureColorSpace) || autoCs);
  const resFromNode = (d: Record<string, unknown>, buf?: TextureBuffer): string => {
    if (typeof d.resolutionOverride === 'string' && d.resolutionOverride !== 'inherit') {
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

    const slot = (typeof d.slot === 'string' && d.slot.trim() !== '')
      ? d.slot
      : (autoInfo?.slot || (typeof d.autoDetectedSlot === 'string' ? d.autoDetectedSlot : 'ORM'));
    const format = formatFromNode(d);
    const bitDepth = bitDepthFromNode(d);
    const colorSpace = colorSpaceFromNode(d, autoInfo?.colorSpace || 'linear');
    const resLabel = resFromNode(d, buf);

    const resolved = resolveFilename(pattern, {
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
      title: typeof d.title === 'string' ? d.title : 'Texture Output',
      slot,
      isSlotOverridden: !!d.isSlotOverridden,
      isConnected,
      previewUrl: buf?.dataUrl,
      format,
      bitDepth,
      colorSpace,
      resolution: resLabel,
      resolvedFilename: resolved,
      enabled: d.enabled !== false,
      sourceType: 'explicit',
      sourceOutput,
      buffer: buf,
    });
  }

  // 3. Channel Pack Nodes
  const packNodes = nodes.filter((n) => n.type === 'channelPack');
  for (const n of packNodes) {
    const d = n.data || {};
    const srcKey = `${n.id}:rgba`;
    const isExplicitlyConsumed = consumedOutputs.has(srcKey);

    const isExplicitExportRequested = Array.isArray(d.exportOutputs) && (d.exportOutputs as string[]).includes('rgba');
    const shouldInclude = !isExplicitlyConsumed || isExplicitExportRequested;

    if (shouldInclude) {
      const buf = evaluatedBuffers[n.id];
      const slot = typeof d.packPreset === 'string' ? d.packPreset.toUpperCase() : 'ORM';
      const format = formatFromNode(d);
      const bitDepth = bitDepthFromNode(d);
      const colorSpace: TextureColorSpace = 'linear';
      const resLabel = resFromNode(d, buf);

      const resolved = resolveFilename(pattern, {
        project: settings.projectName,
        asset: settings.assetName,
        slot,
        res: resLabel,
        format,
        colorSpace: 'Linear',
      });

      items.push({
        nodeId: n.id,
        title: `Packed: ${slot}`,
        slot,
        isSlotOverridden: false,
        isConnected: true,
        previewUrl: buf?.dataUrl,
        format,
        bitDepth,
        colorSpace,
        resolution: resLabel,
        resolvedFilename: resolved,
        enabled: d.enabled !== false,
        sourceType: 'channelPack',
        sourceOutput: srcKey,
        buffer: buf,
      });
    }
  }

  // 4. Channel Unpack Nodes
  const unpackNodes = nodes.filter((n) => n.type === 'channelUnpack');
  for (const n of unpackNodes) {
    const d = n.data || {};
    const exportOutputs = Array.isArray(d.exportOutputs) ? (d.exportOutputs as string[]) : ['r', 'g', 'b', 'a'];

    for (const ch of ['r', 'g', 'b', 'a'] as const) {
      const srcKey = `${n.id}:${ch}`;
      if (consumedOutputs.has(srcKey) && !exportOutputs.includes(ch)) {
        continue;
      }
      if (!exportOutputs.includes(ch)) {
        continue;
      }

      const buf = evaluatedBuffers[`${n.id}_${ch}`] || evaluatedBuffers[n.id];
      const inEdge = edges.find((e) => e.target === n.id);
      const isConnected = !!inEdge;

      const slot = `${ch.toUpperCase()}_Channel`;
      const format = formatFromNode(d);
      const bitDepth = bitDepthFromNode(d);
      const colorSpace: TextureColorSpace = 'linear';
      const resLabel = resFromNode(d, buf);

      const resolved = resolveFilename(pattern, {
        project: settings.projectName,
        asset: settings.assetName,
        slot,
        res: resLabel,
        format,
        colorSpace: 'Linear',
      });

      items.push({
        nodeId: n.id,
        title: `Unpacked ${ch.toUpperCase()}`,
        slot,
        isSlotOverridden: false,
        isConnected,
        previewUrl: buf?.dataUrl,
        format,
        bitDepth,
        colorSpace,
        resolution: resLabel,
        resolvedFilename: resolved,
        enabled: d.enabled !== false,
        sourceType: 'channelUnpack',
        sourceOutput: srcKey,
        buffer: buf,
      });
    }
  }

  // 5. Channel Mixer Nodes
  const mixerNodes = nodes.filter((n) => n.type === 'channelMixer');
  for (const n of mixerNodes) {
    const d = n.data || {};
    const exportOutputs = Array.isArray(d.exportOutputs) ? (d.exportOutputs as string[]) : [];

    for (const outId of exportOutputs) {
      const srcKey = `${n.id}:${outId}`;
      if (consumedOutputs.has(srcKey)) continue;

      const buf = evaluatedBuffers[`${n.id}_${outId}`] || evaluatedBuffers[n.id];
      const inEdge = edges.find((e) => e.target === n.id);
      const isConnected = !!inEdge;

      const slot = `MIX_${outId.toUpperCase()}`;
      const format = formatFromNode(d);
      const bitDepth = bitDepthFromNode(d);
      const colorSpace: TextureColorSpace = 'linear';
      const resLabel = resFromNode(d, buf);

      const resolved = resolveFilename(pattern, {
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
        resolvedFilename: resolved,
        enabled: d.enabled !== false,
        sourceType: 'channelMixer',
        sourceOutput: srcKey,
        buffer: buf,
      });
    }
  }

  // 6. BatchExport Nodes
  const batchNodes = nodes.filter((n) => n.type === 'batchExport');
  for (const n of batchNodes) {
    const d = n.data || {};
    const colId = typeof d.collectionId === 'string' ? d.collectionId : '';
    const collection = (colId && batchCollections ? batchCollections[colId] : undefined) || (d.collection as TextureCollection);
    if (collection && collection.items) {
      for (const texItem of collection.items) {
        if (texItem.isExcluded) continue;
        const slot = texItem.canonicalSuffix || texItem.mapType.toUpperCase();
        const format = (d.format as TextureExportFormat) || settings.defaultFormat;
        const bitDepth: TextureBitDepth = '8b';
        const colorSpace = texItem.mapType === 'base_color' ? 'sRGB' : 'linear';
        const resLabel = settings.masterResolution !== 'inherit' ? `${Math.round(parseInt(settings.masterResolution) / 1024)}K` : '4K';

        const pat = (typeof d.pattern === 'string' && d.pattern) ? d.pattern : pattern;
        const resolved = resolveFilename(pat, {
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
          resolvedFilename: resolved,
          enabled: d.enabled !== false,
          sourceType: 'batchExport',
          batchItemIdentity: `${n.id}:${texItem.id}`,
          buffer: texItem.buffer as TextureBuffer | undefined,
        });
      }
    }
  }

  // 7. Deduplication & Collision Policy
  const deduped: PreflightOutputItem[] = [];
  const sourceSeen = new Map<string, PreflightOutputItem>();

  for (const item of items) {
    if (item.sourceOutput) {
      const existing = sourceSeen.get(item.sourceOutput);
      if (existing) {
        if (item.sourceType === 'explicit' && existing.sourceType !== 'explicit') {
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
