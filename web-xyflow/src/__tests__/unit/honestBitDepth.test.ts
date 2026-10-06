import { describe, it, expect } from 'vitest';
import { ExportEngine, DEFAULT_GLOBAL_SETTINGS } from '../../engine/exportEngine';
import { decodeImage } from '../../io/decode';
import type { Node, Edge } from '@xyflow/react';

describe('P4-E2: True 16-Bit Export Pipeline (TC-490..493)', () => {
  it('TC-490: preflight honors 16-bit precision when requested by node or global settings', () => {
    const nodes: Node[] = [
      {
        id: 'out1',
        type: 'textureOutput',
        position: { x: 0, y: 0 },
        data: {
          slot: 'BaseColor',
          bitDepthOverride: '16b',
        },
      },
      {
        id: 'batch1',
        type: 'batchExport',
        position: { x: 100, y: 0 },
        data: {
          bitDepth: '16b',
        },
      },
    ];

    const edges: Edge[] = [];
    const settings = {
      ...DEFAULT_GLOBAL_SETTINGS,
      defaultBitDepth: '16b' as const,
    };

    const preflightItems = ExportEngine.buildPreflightRegistry(
      nodes,
      edges,
      {},
      settings,
      '{project}_{asset}_{slot}.{format}'
    );

    expect(preflightItems.length).toBeGreaterThan(0);
    for (const item of preflightItems) {
      expect(item.bitDepth).toBe('16b');
    }
  });

  it('TC-491: encodeImageBlob produces valid 16-bit PNG verified by decoder', async () => {
    const rawData = new Uint8ClampedArray(4 * 4 * 4);
    for (let i = 0; i < rawData.length; i++) {
      rawData[i] = (i * 17) % 256;
    }

    const buffer = {
      width: 4,
      height: 4,
      data: rawData,
    };

    const blob = await ExportEngine.encodeImageBlob(buffer, 'PNG', undefined, '16b');
    expect(blob.type).toBe('image/png');

    const arrayBuf = await blob.arrayBuffer();
    const decoded = await decodeImage(new Uint8Array(arrayBuf));
    expect(decoded.bitDepth).toBe(16);
    expect(decoded.width).toBe(4);
    expect(decoded.height).toBe(4);
  });
});
