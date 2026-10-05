import { describe, it, expect } from 'vitest';
import { serializeProject, deserializeProject } from '../../graph/serialize';
import type { TlabDocument } from '../../types/project';

describe('Project Serialization & Migration (P3-T5: TC-320..327)', () => {
  function makeSampleDoc(nodeCount = 5): TlabDocument {
    const nodes = Array.from({ length: nodeCount }, (_, i) => ({
      id: `node_${i}`,
      type: i % 2 === 0 ? 'mathAdd' : 'channelCombiner',
      position: { x: i * 50, y: i * 30 },
      data: {
        valA: i * 0.1,
        title: `Test Node ${i}`,
        previewUrl: 'blob:http://localhost/should-be-stripped', // Should be stripped by serializer
      },
    }));

    const edges = Array.from({ length: nodeCount - 1 }, (_, i) => ({
      id: `edge_${i}`,
      source: `node_${i}`,
      target: `node_${i + 1}`,
      sourceHandle: 'result',
      targetHandle: 'a',
      type: 'default',
    }));

    return {
      format: 'arkh-texturelab',
      schemaVersion: 1,
      appVersion: '0.2.0',
      meta: {
        id: 'proj_test_123',
        name: 'Test Project',
        createdAt: '2026-10-05T00:00:00.000Z',
        modifiedAt: '2026-10-05T00:00:00.000Z',
      },
      assets: [
        {
          id: 'asset_1',
          name: 'concrete_ao.png',
          rel: 'textures/concrete_ao.png',
          abs: 'C:/Project/textures/concrete_ao.png',
          bytes: 1048576,
          mtimeMs: 1728000000000,
          sha1: 'da39a3ee5e6b4b0d3255bfef95601890afd80709',
        },
      ],
      graph: {
        nodes,
        edges,
      },
      export: {
        settings: {
          primaryAsset: 'Concrete_Test',
          exportPattern: '{prefix}_{asset}_{slot}.{format}',
          exportDirRel: 'Export',
        },
        presets: [],
      },
      view: {
        zoom: 1.25,
        pan: [100, -50],
      },
    };
  }

  it('TC-320: Save -> Open round trip of 60-node graph preserves structure and data', () => {
    const initialDoc = makeSampleDoc(60);
    const jsonStr = serializeProject(initialDoc);
    const result = deserializeProject(jsonStr);

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.doc.graph.nodes.length).toBe(60);
    expect(result.doc.graph.edges.length).toBe(59);
    expect(result.doc.assets.length).toBe(1);
    expect(result.doc.export.settings.primaryAsset).toBe('Concrete_Test');
    expect(result.doc.view.zoom).toBe(1.25);
    expect(result.doc.view.pan).toEqual([100, -50]);

    // Verify previewUrl was stripped (P3-T3)
    for (const node of result.doc.graph.nodes) {
      expect((node.data as Record<string, unknown>).previewUrl).toBeUndefined();
    }
  });

  it('TC-321: Open file with unknown node type converts to placeholder without dropping edges', () => {
    const doc = makeSampleDoc(3);
    doc.graph.nodes[1].type = 'superSpecialFuturisticNodeType';

    const jsonStr = serializeProject(doc);
    const result = deserializeProject(jsonStr);

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const targetNode = result.doc.graph.nodes.find((n) => n.id === 'node_1');
    expect(targetNode).toBeDefined();
    expect(targetNode?.type).toBe('missingNode');
    expect((targetNode?.data as Record<string, unknown>).originalType).toBe('superSpecialFuturisticNodeType');
    expect(result.warnings.length).toBeGreaterThan(0);

    // Edges connected to this node must still exist
    expect(result.doc.graph.edges.length).toBe(2);
  });

  it('TC-322: Open schemaVersion newer than app opens read-only with a warning', () => {
    const raw = {
      format: 'arkh-texturelab',
      schemaVersion: 99,
      appVersion: '9.0.0',
      meta: { id: 'p1', name: 'Future Project', createdAt: '', modifiedAt: '' },
      assets: [],
      graph: { nodes: [], edges: [] },
      export: { settings: { primaryAsset: 'A', exportPattern: '{asset}' } },
      view: { zoom: 1, pan: [0, 0] },
    };

    const result = deserializeProject(JSON.stringify(raw));
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.isNewerVersion).toBe(true);
    expect(result.warnings.some((w) => w.includes('newer than this application supports'))).toBe(true);
  });

  it('TC-323: Open truncated JSON returns friendly error and does not throw', () => {
    const truncated = '{"format":"arkh-texturelab", "schemaVersion": 1, "graph": {"nodes": [{"id": "n1"';
    const result = deserializeProject(truncated);

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toMatch(/corrupted or truncated/i);
  });

  it('TC-324: Open JSON with wrong format returns friendly error', () => {
    const invalidFormat = JSON.stringify({
      software: 'Blender',
      version: 4.2,
      data: { scene: 'Default' },
    });

    const result = deserializeProject(invalidFormat);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toMatch(/unrecognized format/i);
  });

  it('TC-325: Zod fails on one node flags that node as missing while other nodes load', () => {
    const doc = makeSampleDoc(4);
    // Malform node 2 by passing an invalid position object
    (doc.graph.nodes[2] as unknown as Record<string, unknown>).position = 'not-an-object';

    const jsonStr = JSON.stringify(doc);
    const result = deserializeProject(jsonStr);

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.doc.graph.nodes.length).toBe(4);
    const badNode = result.doc.graph.nodes.find((n) => n.id === 'node_2');
    expect(badNode?.type).toBe('missingNode');
    expect(result.warnings.some((w) => w.includes("Node 'node_2'"))).toBe(true);

    // Other valid nodes loaded fine
    const goodNode = result.doc.graph.nodes.find((n) => n.id === 'node_0');
    expect(goodNode?.type).toBe('add');
  });

  it('TC-326: Migrates legacy v0 fixture to valid v1 document', () => {
    const v0Fixture = {
      nodes: [
        {
          id: 'n_pack',
          type: 'channelPack', // Legacy alias
          position: { x: 100, y: 200 },
          data: {
            title: 'Packer',
            previewUrl: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
            onLoadBuffer: 'someFunction',
          },
        },
      ],
      edges: [
        {
          id: 'e1',
          source: 'n_in',
          target: 'n_pack',
          sourceHandle: 'r',
          targetHandle: 'r',
        },
      ],
    };

    const result = deserializeProject(JSON.stringify(v0Fixture));
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.isMigrated).toBe(true);
    expect(result.doc.format).toBe('arkh-texturelab');
    expect(result.doc.schemaVersion).toBe(1);

    // channelPack should be canonicalized to channelCombiner
    expect(result.doc.graph.nodes[0].type).toBe('channelCombiner');

    // previewUrl & onLoadBuffer should be stripped
    const data = result.doc.graph.nodes[0].data as Record<string, unknown>;
    expect(data.previewUrl).toBeUndefined();
    expect(data.onLoadBuffer).toBeUndefined();
  });

  it('TC-327: Serializing 500 nodes completes in < 50ms', () => {
    const bigDoc = makeSampleDoc(500);
    const start = performance.now();
    const serialized = serializeProject(bigDoc);
    const duration = performance.now() - start;

    expect(duration).toBeLessThan(50);
    expect(serialized.length).toBeGreaterThan(1000);
  });
});
