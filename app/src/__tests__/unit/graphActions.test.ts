import { describe, it, expect } from 'vitest';
import type { Node, Edge } from '@xyflow/react';
import { deleteNodes, duplicateNodes } from '../../app/graphActions';

describe('P1-A3: Pure Graph Actions (F-10, TC-120..123)', () => {
  const initialNodes: Node[] = [
    { id: 'node_1', type: 'textureInput', position: { x: 0, y: 0 }, data: { role: 'ao' } },
    { id: 'node_2', type: 'channelCombiner', position: { x: 200, y: 0 }, data: {} },
    { id: 'node_3', type: 'textureOutput', position: { x: 400, y: 0 }, data: {} },
  ];

  const initialEdges: Edge[] = [
    { id: 'e1', source: 'node_1', sourceHandle: 'r', target: 'node_2', targetHandle: 'r' },
    { id: 'e2', source: 'node_2', sourceHandle: 'out', target: 'node_3', targetHandle: 'in' },
  ];

  it('TC-120: duplicating 2 connected nodes preserves internal edges between duplicates', () => {
    const result = duplicateNodes(initialNodes, initialEdges, ['node_1', 'node_2']);

    expect(result.nodes.length).toBe(5); // 3 original + 2 duplicated
    expect(result.newNodes.length).toBe(2);
    // All original nodes kept unselected, new nodes selected
    expect(result.newNodes.every((n) => n.selected)).toBe(true);

    // Duplicated nodes have offset position
    expect(result.newNodes[0].position.x).toBe(initialNodes[0].position.x + 40);
    expect(result.newNodes[0].position.y).toBe(initialNodes[0].position.y + 40);

    // Internal edge between node_1 and node_2 must be duplicated connecting the new nodes
    expect(result.newEdges.length).toBe(1);
    expect(result.edges.length).toBe(3); // 2 original + 1 duplicated

    const duplicatedEdge = result.newEdges[0];
    const newSourceNode = result.newNodes.find((n) => n.data.role === 'ao')!;
    const newTargetNode = result.newNodes.find((n) => n.type === 'channelCombiner')!;

    expect(duplicatedEdge.source).toBe(newSourceNode.id);
    expect(duplicatedEdge.target).toBe(newTargetNode.id);
    expect(duplicatedEdge.sourceHandle).toBe('r');
    expect(duplicatedEdge.targetHandle).toBe('r');
  });

  it('TC-121: duplicating 1 of 2 connected nodes leaves no dangling edge', () => {
    const result = duplicateNodes(initialNodes, initialEdges, ['node_1']);

    expect(result.nodes.length).toBe(4); // 3 original + 1 duplicate
    expect(result.newNodes.length).toBe(1);
    expect(result.newEdges.length).toBe(0); // No edges duplicated because target was not duplicated
    expect(result.edges.length).toBe(2); // Only original edges
  });

  it('TC-122: deleting a node with connected edges removes the node and all connected edges', () => {
    // node_2 has 2 connected edges (e1 and e2)
    const result = deleteNodes(initialNodes, initialEdges, ['node_2']);

    expect(result.nodes.length).toBe(2);
    expect(result.nodes.find((n) => n.id === 'node_2')).toBeUndefined();

    // Both e1 and e2 connect to node_2, so both must be deleted
    expect(result.edges.length).toBe(0);
    expect(result.deletedNodeIds).toEqual(['node_2']);
    expect(result.deletedEdgeIds).toContain('e1');
    expect(result.deletedEdgeIds).toContain('e2');
  });

  it('TC-123: duplicating 1000 times generates collision-free UUIDs', () => {
    const ids = new Set<string>();
    let currentNodes: Node[] = [{ id: 'seed', type: 'math', position: { x: 0, y: 0 }, data: {} }];
    let currentEdges: Edge[] = [];

    for (let i = 0; i < 1000; i++) {
      const res = duplicateNodes(currentNodes, currentEdges, ['seed']);
      const newId = res.newNodes[0].id;
      expect(ids.has(newId)).toBe(false);
      ids.add(newId);
    }

    expect(ids.size).toBe(1000);
  });
});
