import type { Connection, Edge, Node } from '@xyflow/react';

export interface EdgeConfig {
  type: string;
  style: { stroke: string };
}

/**
 * Automatic semantic wire configuration based on source handle and target handle.
 */
export function getEdgeConfig(
  sourceHandle?: string | null,
  targetHandle?: string | null
): EdgeConfig {
  if (sourceHandle === 'rgba' || targetHandle === 'rgba') {
    return {
      type: 'dualMarching',
      style: { stroke: 'var(--pbr-packed)' },
    };
  }

  let strokeColor = 'var(--pbr-metal)';
  if (sourceHandle === 'r') strokeColor = 'var(--pbr-ao)';
  else if (sourceHandle === 'g') strokeColor = 'var(--pbr-rough)';
  else if (sourceHandle === 'b') strokeColor = 'var(--pbr-metal)';
  else if (sourceHandle === 'a') strokeColor = 'var(--pbr-height)';
  else if (
    sourceHandle === 'base' ||
    targetHandle === 'base' ||
    sourceHandle === 'detail' ||
    targetHandle === 'detail'
  )
    strokeColor = 'var(--pbr-normal)';
  else if (sourceHandle === 'mask' || targetHandle === 'mask') strokeColor = 'var(--pbr-scalar)';
  else if (sourceHandle === 'output' || targetHandle === 'output') strokeColor = 'var(--pbr-rough)';

  return {
    type: 'pulsingChannel',
    style: { stroke: strokeColor },
  };
}

/**
 * Attempt to auto-wire a source node to a target node based on available ports.
 */
export function findAutoWireConnection(
  sourceNode: Node,
  targetNode: Node,
  existingEdges: Edge[]
): Connection | null {
  const occupiedTargetHandles = new Set(
    existingEdges
      .filter((e) => e.target === targetNode.id)
      .map((e) => e.targetHandle || 'input')
  );

  // Default fallback candidates
  const defaultPairs: [string, string][] = [
    ['rgba', 'rgba'],
    ['rgba', 'input'],
    ['output', 'input'],
    ['output', 'a'],
    ['r', 'r'],
    ['g', 'g'],
    ['b', 'b'],
    ['a', 'a'],
  ];

  for (const [srcH, dstH] of defaultPairs) {
    if (!occupiedTargetHandles.has(dstH)) {
      return {
        source: sourceNode.id,
        sourceHandle: srcH,
        target: targetNode.id,
        targetHandle: dstH,
      };
    }
  }

  return null;
}

/**
 * Auto-wires PBR texture inputs to an ORMH combiner node.
 */
export function buildORMHEdges(nodes: Node[], existingEdges: Edge[]): Edge[] | null {
  const matchesRole = (n: Node, roleKey: string) => {
    const d = (n.data as Record<string, unknown>) || {};
    const r = `${String(d.detectedRole || '')} ${String(d.role || '')}`.toLowerCase();
    if (roleKey === 'ao') return r.includes('ambient') || r.includes('ao') || r.includes('occlusion');
    if (roleKey === 'roughness') return r.includes('rough') || r.includes('gloss');
    if (roleKey === 'metallic') return r.includes('metal');
    if (roleKey === 'height') return r.includes('height') || r.includes('disp');
    return false;
  };

  const inputAo = nodes.find((n) => matchesRole(n, 'ao'));
  const inputRough = nodes.find((n) => matchesRole(n, 'roughness'));
  const inputMetal = nodes.find((n) => matchesRole(n, 'metallic'));
  const inputHeight = nodes.find((n) => matchesRole(n, 'height'));
  const combiner = nodes.find((n) => n.type === 'channelCombiner' || n.type === 'channelPack');
  const output = nodes.find((n) => n.type === 'textureOutput');

  if (!combiner) return null;

  const newEdges: Edge[] = [];
  if (inputAo) {
    newEdges.push({
      id: `e_${inputAo.id}_r`,
      source: inputAo.id,
      sourceHandle: 'r',
      target: combiner.id,
      targetHandle: 'r',
      type: 'pulsingChannel',
      style: { stroke: 'var(--pbr-ao)' },
    });
  }
  if (inputRough) {
    newEdges.push({
      id: `e_${inputRough.id}_g`,
      source: inputRough.id,
      sourceHandle: 'g',
      target: combiner.id,
      targetHandle: 'g',
      type: 'pulsingChannel',
      style: { stroke: 'var(--pbr-rough)' },
    });
  }
  if (inputMetal) {
    newEdges.push({
      id: `e_${inputMetal.id}_b`,
      source: inputMetal.id,
      sourceHandle: 'b',
      target: combiner.id,
      targetHandle: 'b',
      type: 'pulsingChannel',
      style: { stroke: 'var(--pbr-metal)' },
    });
  }
  if (inputHeight) {
    newEdges.push({
      id: `e_${inputHeight.id}_a`,
      source: inputHeight.id,
      sourceHandle: 'a',
      target: combiner.id,
      targetHandle: 'a',
      type: 'pulsingChannel',
      style: { stroke: 'var(--pbr-height)' },
    });
  }
  if (output) {
    newEdges.push({
      id: `e_${combiner.id}_out`,
      source: combiner.id,
      sourceHandle: 'rgba',
      target: output.id,
      targetHandle: 'rgba',
      type: 'dualMarching',
      style: { stroke: 'var(--pbr-packed)' },
    });
  }

  return [...existingEdges.filter((e) => e.target !== combiner.id && e.source !== combiner.id), ...newEdges];
}

