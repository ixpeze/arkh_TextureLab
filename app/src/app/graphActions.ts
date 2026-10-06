import type { Node, Edge } from '@xyflow/react';

export interface DuplicateResult {
  nodes: Node[];
  edges: Edge[];
  newNodes: Node[];
  newEdges: Edge[];
}

export interface DeleteResult {
  nodes: Node[];
  edges: Edge[];
  deletedNodeIds: string[];
  deletedEdgeIds: string[];
}

export interface DuplicateOptions {
  offset?: { x: number; y: number };
}

/**
 * Pure graph helper to duplicate selected nodes and internal edges connecting them.
 * - Leaves original nodes with selected: false
 * - Assigns collision-safe crypto.randomUUID() ids to duplicates
 * - Offsets duplicate positions
 * - Preserves edges whose source AND target are in the duplicated set
 */
export function duplicateNodes(
  nodes: Node[],
  edges: Edge[],
  nodeIdsToDuplicate: string[],
  options?: DuplicateOptions
): DuplicateResult {
  const idsSet = new Set(nodeIdsToDuplicate);
  const toDuplicate = nodes.filter((n) => idsSet.has(n.id));

  if (toDuplicate.length === 0) {
    return {
      nodes,
      edges,
      newNodes: [],
      newEdges: [],
    };
  }

  const offset = options?.offset ?? { x: 40, y: 40 };
  const idMap = new Map<string, string>();

  const newNodes: Node[] = toDuplicate.map((n) => {
    const newId = `node_${crypto.randomUUID()}`;
    idMap.set(n.id, newId);

    return {
      ...n,
      id: newId,
      selected: true,
      position: {
        x: n.position.x + offset.x,
        y: n.position.y + offset.y,
      },
    };
  });

  // Duplicate edges where BOTH source and target were duplicated
  const newEdges: Edge[] = [];
  for (const edge of edges) {
    const newSource = idMap.get(edge.source);
    const newTarget = idMap.get(edge.target);

    if (newSource && newTarget) {
      newEdges.push({
        ...edge,
        id: `edge_${crypto.randomUUID()}`,
        source: newSource,
        target: newTarget,
      });
    }
  }

  const unselectedOriginals = nodes.map((n) => (n.selected ? { ...n, selected: false } : n));

  return {
    nodes: [...unselectedOriginals, ...newNodes],
    edges: [...edges, ...newEdges],
    newNodes,
    newEdges,
  };
}

/**
 * Pure graph helper to delete nodes and any edges connected to them.
 */
export function deleteNodes(
  nodes: Node[],
  edges: Edge[],
  nodeIdsToDelete: string[]
): DeleteResult {
  const toDeleteSet = new Set(nodeIdsToDelete);
  const remainingNodes = nodes.filter((n) => !toDeleteSet.has(n.id));

  const deletedEdgeIds: string[] = [];
  const remainingEdges: Edge[] = [];

  for (const edge of edges) {
    if (toDeleteSet.has(edge.source) || toDeleteSet.has(edge.target)) {
      deletedEdgeIds.push(edge.id);
    } else {
      remainingEdges.push(edge.id === edge.id ? edge : edge);
    }
  }

  return {
    nodes: remainingNodes,
    edges: remainingEdges,
    deletedNodeIds: Array.from(toDeleteSet),
    deletedEdgeIds,
  };
}
