import type { Node } from '@xyflow/react';
import { nodeRegistry } from '../nodes/registry';

export interface SpawnNodeOptions {
  typeKey: string;
  position: { x: number; y: number };
  primaryAsset?: string;
  customId?: string;
}

/**
 * Registry-driven node factory for canvas spawning.
 */
export function createSpawnedNode({
  typeKey,
  position,
  primaryAsset = 'Anthracite_Concrete',
  customId,
}: SpawnNodeOptions): Node {
  const id = customId || `node_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

  if (nodeRegistry.has(typeKey)) {
    const { type: canonicalType, data: defaultData } = nodeRegistry.createNodeData(typeKey);
    const node: Node = {
      id,
      type: canonicalType,
      position,
      data: { ...defaultData },
    };

    if (canonicalType === 'commentBox') {
      node.style = { width: 340, height: 220, zIndex: -1 };
    } else if (canonicalType === 'textureOutput') {
      node.data = {
        ...node.data,
        outputFilename: `T_${primaryAsset}_ORM.png`,
      };
    }

    return node;
  }

  // Fallback if unregistered type
  return {
    id,
    type: typeKey,
    position,
    data: {},
  };
}

/**
 * Creates a comment box node bounding selected nodes, or at a fallback position.
 */
export function createCommentBoxNode(
  targetNodes: Node[],
  fallbackPos: { x: number; y: number }
): Node {
  const id = `comment_${Date.now()}`;
  let pos: { x: number; y: number };
  let size: { width: number; height: number };

  if (targetNodes.length > 0) {
    const minX = Math.min(...targetNodes.map((n) => n.position.x));
    const minY = Math.min(...targetNodes.map((n) => n.position.y));
    const maxX = Math.max(...targetNodes.map((n) => n.position.x + (Number(n.width) || 172)));
    const maxY = Math.max(...targetNodes.map((n) => n.position.y + (Number(n.height) || 180)));

    pos = { x: minX - 25, y: minY - 36 };
    size = { width: Math.max(220, maxX - minX + 50), height: Math.max(140, maxY - minY + 56) };
  } else {
    pos = { x: fallbackPos.x - 120, y: fallbackPos.y - 20 };
    size = { width: 340, height: 220 };
  }

  return {
    id,
    type: 'commentBox',
    position: pos,
    style: { width: size.width, height: size.height, zIndex: -1 },
    data: {
      title: targetNodes.length > 0 ? 'PBR Channel Group' : 'Comment Group',
      color: '#38bdf8',
    },
  };
}

