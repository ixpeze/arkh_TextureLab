import { describe, it, expect } from 'vitest';
import { nodeContentHash, graphContentHash } from '../../graph/hash';

describe('P1-A1: Stable Graph & Node Content Hash (TC-101..108)', () => {
  it('TC-101: changing Math valA changes the node hash', () => {
    const nodeA = { id: 'math-1', type: 'math', data: { op: 'add', valA: 1.0, valB: 2.0 } };
    const nodeB = { id: 'math-1', type: 'math', data: { op: 'add', valA: 1.5, valB: 2.0 } };
    expect(nodeContentHash(nodeA)).not.toBe(nodeContentHash(nodeB));
  });

  it('TC-102: changing Math op changes the node hash', () => {
    const nodeA = { id: 'math-1', type: 'math', data: { op: 'add', valA: 1.0 } };
    const nodeB = { id: 'math-1', type: 'math', data: { op: 'multiply', valA: 1.0 } };
    expect(nodeContentHash(nodeA)).not.toBe(nodeContentHash(nodeB));
  });

  it('TC-103: changing Resize targetWidth changes the node hash', () => {
    const nodeA = { id: 'resize-1', type: 'resize', data: { targetWidth: 1024, targetHeight: 1024 } };
    const nodeB = { id: 'resize-1', type: 'resize', data: { targetWidth: 2048, targetHeight: 1024 } };
    expect(nodeContentHash(nodeA)).not.toBe(nodeContentHash(nodeB));
  });

  it('TC-104: changing Upscale scale changes the node hash', () => {
    const nodeA = { id: 'upscale-1', type: 'upscale', data: { scale: 2 } };
    const nodeB = { id: 'upscale-1', type: 'upscale', data: { scale: 4 } };
    expect(nodeContentHash(nodeA)).not.toBe(nodeContentHash(nodeB));
  });

  it('TC-105: changing Seam repeats changes the node hash', () => {
    const nodeA = { id: 'seam-1', type: 'seamCheck', data: { repeats: 2 } };
    const nodeB = { id: 'seam-1', type: 'seamCheck', data: { repeats: 3 } };
    expect(nodeContentHash(nodeA)).not.toBe(nodeContentHash(nodeB));
  });

  it('TC-106: changing NormalFlip strength changes the node hash', () => {
    const nodeA = { id: 'flip-1', type: 'normalFlip', data: { strength: 1.0, flipG: true } };
    const nodeB = { id: 'flip-1', type: 'normalFlip', data: { strength: 2.0, flipG: true } };
    expect(nodeContentHash(nodeA)).not.toBe(nodeContentHash(nodeB));
  });

  it('TC-107: changing Levels channel changes the node hash', () => {
    const nodeA = { id: 'lvl-1', type: 'levels', data: { channel: 'rgb', gamma: 1.0 } };
    const nodeB = { id: 'lvl-1', type: 'levels', data: { channel: 'r', gamma: 1.0 } };
    expect(nodeContentHash(nodeA)).not.toBe(nodeContentHash(nodeB));
  });

  it('TC-108: changing Mixer routes changes the node hash', () => {
    const nodeA = { id: 'mix-1', type: 'channelMixer', data: { routes: { r: 'g', g: 'r' } } };
    const nodeB = { id: 'mix-1', type: 'channelMixer', data: { routes: { r: 'b', g: 'r' } } };
    expect(nodeContentHash(nodeA)).not.toBe(nodeContentHash(nodeB));
  });

  it('TC-109: UI-only keys, node position, selection, and previewUrl do NOT change the hash', () => {
    const baseNode = {
      id: 'node-1',
      type: 'textureInput',
      position: { x: 100, y: 200 },
      selected: false,
      data: {
        colorSpace: 'sRGB',
        previewUrl: 'blob:http://localhost:5173/abc-123',
        preview: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
        title: 'Input Map',
        isPinned: false,
        roleColor: '#ff0000',
        res: '2048x2048',
        onLoadBuffer: () => {},
      },
    };

    const modifiedNode = {
      id: 'node-1',
      type: 'textureInput',
      position: { x: 999, y: 888 },
      selected: true,
      data: {
        colorSpace: 'sRGB',
        previewUrl: 'blob:http://localhost:5173/different-url',
        preview: 'data:image/png;base64,DIFFERENT',
        title: 'Renamed Title',
        isPinned: true,
        roleColor: '#00ff00',
        res: '4096x4096',
        onLoadBuffer: () => {},
      },
    };

    expect(nodeContentHash(baseNode as any)).toBe(nodeContentHash(modifiedNode as any));
  });

  describe('Edge cases', () => {
    it('canonicalizes NaN, -0, and undefined', () => {
      const node1 = { id: 'n1', type: 'math', data: { a: NaN, b: -0, c: undefined } };
      const node2 = { id: 'n1', type: 'math', data: { a: NaN, b: 0, c: undefined } };
      expect(nodeContentHash(node1)).toBe(nodeContentHash(node2));
    });

    it('ignores key insertion order in data', () => {
      const node1 = { id: 'n1', type: 'math', data: { valA: 1, valB: 2, op: 'add' } };
      const node2 = { id: 'n1', type: 'math', data: { op: 'add', valB: 2, valA: 1 } };
      expect(nodeContentHash(node1)).toBe(nodeContentHash(node2));
    });

    it('excludes large strings (e.g. data URLs) from hash calculation', () => {
      const bigString1 = 'data:image/png;base64,' + 'A'.repeat(3000);
      const bigString2 = 'data:image/png;base64,' + 'B'.repeat(3000);
      const node1 = { id: 'n1', type: 'custom', data: { largePayload: bigString1, param: 10 } };
      const node2 = { id: 'n1', type: 'custom', data: { largePayload: bigString2, param: 10 } };
      expect(nodeContentHash(node1)).toBe(nodeContentHash(node2));
    });

    it('graphContentHash sorts edges and nodes deterministically', () => {
      const nodesA = [
        { id: 'b', type: 'math', data: { valA: 2 } },
        { id: 'a', type: 'math', data: { valA: 1 } },
      ];
      const nodesB = [
        { id: 'a', type: 'math', data: { valA: 1 } },
        { id: 'b', type: 'math', data: { valA: 2 } },
      ];
      const edgesA = [
        { id: 'e2', source: 'b', sourceHandle: 'out', target: 'c', targetHandle: 'in' },
        { id: 'e1', source: 'a', sourceHandle: 'out', target: 'b', targetHandle: 'in' },
      ];
      const edgesB = [
        { id: 'e1', source: 'a', sourceHandle: 'out', target: 'b', targetHandle: 'in' },
        { id: 'e2', source: 'b', sourceHandle: 'out', target: 'c', targetHandle: 'in' },
      ];

      expect(graphContentHash(nodesA as any, edgesA as any)).toBe(
        graphContentHash(nodesB as any, edgesB as any)
      );
    });
  });
});
