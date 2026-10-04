import { describe, it, expect } from 'vitest';
import { ExportEngine, DEFAULT_GLOBAL_SETTINGS } from '../../engine/exportEngine';
import type { Node, Edge } from '@xyflow/react';

describe('P1-A5: Honest 16-bit (F-04, TC-128)', () => {
  it('TC-128: preflight exported metadata forces 8b even if node requests 16b', () => {
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
      expect(item.bitDepth).toBe('8b');
    }
  });
});
