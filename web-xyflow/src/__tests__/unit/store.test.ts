import { describe, it, expect, beforeEach } from 'vitest';
import { useAppStore } from '../../store/useAppStore';
import { createDefaultDocument } from '../../store/documentSlice';
import {
  createClipboardPayload,
  parseClipboardText,
  preparePasteNodes,
  duplicateWithWires,
} from '../../features/project/clipboard';
import type { Node, Edge } from '@xyflow/react';
import type { AssetRecord } from '../../types/project';

describe('Store & Clipboard (P3-T1, P3-T3, P3-T10: TC-350..356)', () => {
  beforeEach(() => {
    useAppStore.setState({
      doc: createDefaultDocument(),
      activeNodeId: null,
      selectedNodeIds: [],
      isDirty: false,
    });
    useAppStore.getState().historyManager.clear();
  });

  it('P3-T3: JSON.stringify(document).length for sample graph is < 20 KB', () => {
    const defaultDoc = createDefaultDocument();
    const str = JSON.stringify(defaultDoc);
    expect(str.length).toBeLessThan(20480); // < 20 KB requirement
    // Verify no previewUrl or base64 dataUrl exists in the document
    expect(str.includes('data:image')).toBe(false);
  });

  it('TC-350: Copy 3 connected nodes and paste creates 3 nodes + 2 internal edges with new ids', () => {
    const nodes: Node[] = [
      { id: 'n1', type: 'textureInput', position: { x: 0, y: 0 }, data: { role: 'ao' } },
      { id: 'n2', type: 'channelCombiner', position: { x: 200, y: 0 }, data: {} },
      { id: 'n3', type: 'textureOutput', position: { x: 400, y: 0 }, data: { slot: 'ORM' } },
    ];

    const edges: Edge[] = [
      { id: 'e1', source: 'n1', target: 'n2', sourceHandle: 'r', targetHandle: 'r' },
      { id: 'e2', source: 'n2', target: 'n3', sourceHandle: 'rgba', targetHandle: 'rgba' },
      { id: 'e_external', source: 'n_outside', target: 'n2' }, // External edge
    ];

    const payload = createClipboardPayload(nodes, edges, []);
    expect(payload).not.toBeNull();
    if (!payload) return;

    // External edge must be excluded; only the 2 internal edges are copied
    expect(payload.nodes.length).toBe(3);
    expect(payload.edges.length).toBe(2);

    const pasteResult = preparePasteNodes(payload, { x: 50, y: 50 });
    expect(pasteResult.nodes.length).toBe(3);
    expect(pasteResult.edges.length).toBe(2);

    // All IDs must be new
    const originalNodeIds = new Set(nodes.map((n) => n.id));
    for (const n of pasteResult.nodes) {
      expect(originalNodeIds.has(n.id)).toBe(false);
    }

    // Rewired edges must point to the new node IDs
    const newNodeIds = new Set(pasteResult.nodes.map((n) => n.id));
    for (const e of pasteResult.edges) {
      expect(newNodeIds.has(e.source)).toBe(true);
      expect(newNodeIds.has(e.target)).toBe(true);
      expect(e.id).not.toBe('e1');
      expect(e.id).not.toBe('e2');
    }
  });

  it('TC-351: Pasting text that is not TextureLab JSON is safely ignored', () => {
    const nonTlabTexts = [
      'Just some plain copied text from browser',
      '{"hello": "world"}',
      '<html><body>not nodes</body></html>',
      '{"format": "blender-nodes", "version": 1}',
      '',
    ];

    for (const text of nonTlabTexts) {
      const parsed = parseClipboardText(text);
      expect(parsed).toBeNull();
    }
  });

  it('TC-352: Pasting into another project imports referenced assets by absolute path', () => {
    const asset1: AssetRecord = {
      id: 'asset_ao',
      name: 'concrete_ao.png',
      abs: 'C:/Maps/concrete_ao.png',
      rel: 'concrete_ao.png',
      bytes: 5000,
    };

    const node: Node = {
      id: 'n_in',
      type: 'textureInput',
      position: { x: 0, y: 0 },
      data: { assetId: 'asset_ao' },
    };

    const payload = createClipboardPayload([node], [], [asset1]);
    expect(payload?.assets.length).toBe(1);

    // Destination project does NOT have asset_ao
    const pasteResult = preparePasteNodes(payload!, undefined, []);
    expect(pasteResult.assetsToAdd.length).toBe(1);
    expect(pasteResult.assetsToAdd[0].abs).toBe('C:/Maps/concrete_ao.png');

    // If destination project ALREADY has asset_ao, do not duplicate
    const pasteResultExisting = preparePasteNodes(payload!, undefined, [asset1]);
    expect(pasteResultExisting.assetsToAdd.length).toBe(0);
  });

  it('Duplicate-with-wires duplicates selected nodes and internal edges with offset', () => {
    const nodes: Node[] = [
      { id: 'a', type: 'mathAdd', position: { x: 10, y: 20 }, data: {} },
      { id: 'b', type: 'mathMultiply', position: { x: 100, y: 20 }, data: {} },
    ];
    const edges: Edge[] = [{ id: 'e_ab', source: 'a', target: 'b' }];

    const { newNodes, newEdges } = duplicateWithWires(nodes, edges, { x: 50, y: 50 });
    expect(newNodes.length).toBe(2);
    expect(newEdges.length).toBe(1);
    expect(newNodes[0].position).toEqual({ x: 60, y: 70 });
    expect(newNodes[1].position).toEqual({ x: 150, y: 70 });
  });

  it('P3-T1: Re-render count isolation: selecting a node notifies only selection listeners', () => {
    let selectionListenerCalls = 0;
    let nodeDataListenerCalls = 0;

    // Listener 1: subscribed only to activeNodeId
    const unsub1 = useAppStore.subscribe(
      (state) => state.activeNodeId,
      () => {
        selectionListenerCalls++;
      }
    );

    // Listener 2: subscribed only to node count or specific node data
    const unsub2 = useAppStore.subscribe(
      (state) => state.doc.graph.nodes.length,
      () => {
        nodeDataListenerCalls++;
      }
    );

    // Change selection
    useAppStore.getState().setActiveNodeId('combiner_ormh');

    expect(selectionListenerCalls).toBe(1);
    expect(nodeDataListenerCalls).toBe(0); // Unrelated listener NOT triggered

    unsub1();
    unsub2();
  });
});
