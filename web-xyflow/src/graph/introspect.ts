import type { Node, Edge } from '@xyflow/react';

export interface HandleConnectionInfo {
  handleId: string;
  isConnected: boolean;
  sourceNodeId?: string;
  sourceHandle?: string;
  sourceLabel?: string;
  fallbackValue?: number;
}

export interface AutoDetectedRole {
  slot: string;
  colorSpace: 'linear' | 'sRGB';
  sourceLabel?: string;
}

/**
 * Get detailed port connection info for a specific node to display in telemetry
 */
export function getNodePortTelemetry(
  node: Node,
  edges: Edge[]
): HandleConnectionInfo[] {
  const nodeType = node.type || '';
  const data = node.data || {};

  if (nodeType === 'channelCombiner' || nodeType === 'channelPack') {
    const fallbacks = (data.fallbacks as Record<string, number | undefined>) || { r: 0, g: 0, b: 0, a: 0 };
    const ports = [
      { handleId: 'r', label: 'R (AO)', fallback: fallbacks.r ?? 0 },
      { handleId: 'g', label: 'G (Roughness)', fallback: fallbacks.g ?? 0 },
      { handleId: 'b', label: 'B (Metallic)', fallback: fallbacks.b ?? 0 },
      { handleId: 'a', label: 'A (Height)', fallback: fallbacks.a ?? 0 },
    ];

    return ports.map((p) => {
      const edge = edges.find((e) => e.target === node.id && e.targetHandle === p.handleId);
      return {
        handleId: p.handleId,
        isConnected: !!edge,
        sourceNodeId: edge?.source,
        sourceHandle: edge?.sourceHandle || undefined,
        sourceLabel: p.label,
        fallbackValue: p.fallback,
      };
    });
  }

  if (nodeType === 'channelSplitter' || nodeType === 'channelUnpack') {
    const edge = edges.find((e) => e.target === node.id && (e.targetHandle === 'rgba' || e.targetHandle === 'input' || !e.targetHandle));
    return [
      {
        handleId: 'rgba',
        isConnected: !!edge,
        sourceNodeId: edge?.source,
        sourceHandle: edge?.sourceHandle || 'rgba',
        sourceLabel: 'Input Stream',
      },
    ];
  }

  if (nodeType === 'channelSwizzle' || nodeType === 'channelMixer') {
    const edge = edges.find((e) => e.target === node.id && (e.targetHandle === 'rgba' || e.targetHandle === 'input' || !e.targetHandle));
    return [
      {
        handleId: 'rgba',
        isConnected: !!edge,
        sourceNodeId: edge?.source,
        sourceHandle: edge?.sourceHandle || 'rgba',
        sourceLabel: 'Input Stream',
      },
    ];
  }

  if (
    nodeType === 'lerp' ||
    nodeType === 'multiply' ||
    nodeType === 'add' ||
    nodeType === 'subtract' ||
    nodeType === 'divide' ||
    nodeType === 'min' ||
    nodeType === 'max' ||
    nodeType === 'math'
  ) {
    const edgeA = edges.find((e) => e.target === node.id && (e.targetHandle === 'a' || !e.targetHandle));
    const edgeB = edges.find((e) => e.target === node.id && e.targetHandle === 'b');
    const edgeAlpha = edges.find((e) => e.target === node.id && e.targetHandle === 'alpha');

    const ports: HandleConnectionInfo[] = [
      { handleId: 'a', isConnected: !!edgeA, sourceNodeId: edgeA?.source, sourceLabel: 'Input A' },
      { handleId: 'b', isConnected: !!edgeB, sourceNodeId: edgeB?.source, sourceLabel: 'Input B' },
    ];
    if (nodeType === 'lerp') {
      ports.push({ handleId: 'alpha', isConnected: !!edgeAlpha, sourceNodeId: edgeAlpha?.source, sourceLabel: 'Alpha' });
    }
    return ports;
  }

  if (nodeType === 'clamp' || nodeType === 'saturate' || nodeType === 'power' || nodeType === 'oneMinus' || nodeType === 'abs') {
    const edge = edges.find((e) => e.target === node.id);
    return [
      {
        handleId: 'input',
        isConnected: !!edge,
        sourceNodeId: edge?.source,
        sourceHandle: edge?.sourceHandle || undefined,
        sourceLabel: 'Value',
      },
    ];
  }

  if (nodeType === 'compare') {
    const edgeA = edges.find((e) => e.target === node.id && e.targetHandle === 'a');
    const edgeB = edges.find((e) => e.target === node.id && e.targetHandle === 'b');
    return [
      { handleId: 'a', isConnected: !!edgeA, sourceNodeId: edgeA?.source, sourceLabel: 'Input A' },
      { handleId: 'b', isConnected: !!edgeB, sourceNodeId: edgeB?.source, sourceLabel: 'Input B' },
    ];
  }

  if (nodeType === 'textureOutput') {
    const edge = edges.find((e) => e.target === node.id && (e.targetHandle === 'rgba' || e.targetHandle === 'input' || !e.targetHandle));
    return [
      {
        handleId: 'rgba',
        isConnected: !!edge,
        sourceNodeId: edge?.source,
        sourceHandle: edge?.sourceHandle || 'rgba',
        sourceLabel: 'Packed RGBA Stream',
      },
    ];
  }

  if (nodeType === 'blend') {
    const edgeA = edges.find((e) => e.target === node.id && e.targetHandle === 'a');
    const edgeB = edges.find((e) => e.target === node.id && e.targetHandle === 'b');
    const edgeMask = edges.find((e) => e.target === node.id && e.targetHandle === 'mask');
    return [
      { handleId: 'a', isConnected: !!edgeA, sourceNodeId: edgeA?.source, sourceLabel: 'Base (A)' },
      { handleId: 'b', isConnected: !!edgeB, sourceNodeId: edgeB?.source, sourceLabel: 'Blend (B)' },
      { handleId: 'mask', isConnected: !!edgeMask, sourceNodeId: edgeMask?.source, sourceLabel: 'Alpha Mask' },
    ];
  }

  if (nodeType === 'invert' || nodeType === 'levels' || nodeType === 'normalFlip') {
    const edge = edges.find((e) => e.target === node.id);
    return [
      {
        handleId: 'input',
        isConnected: !!edge,
        sourceNodeId: edge?.source,
        sourceHandle: edge?.sourceHandle || undefined,
        sourceLabel: 'Input Stream',
      },
    ];
  }

  return [];
}

/**
 * Auto-detect the semantic slot and color space for a TextureOutputNode by tracing upstream wires.
 */
export function autoDetectOutputRole(
  outputNodeId: string,
  nodes: Node[],
  edges: Edge[]
): AutoDetectedRole {
  const nodeMap = new Map<string, Node>(nodes.map((n) => [n.id, n]));
  const inEdge = edges.find((e) => e.target === outputNodeId && (e.targetHandle === 'rgba' || !e.targetHandle));
  if (!inEdge) {
    return { slot: 'ORM', colorSpace: 'linear', sourceLabel: 'Unwired' };
  }

  const visited = new Set<string>();

  const traceNode = (nodeId: string): AutoDetectedRole => {
    if (visited.has(nodeId)) return { slot: 'ORM', colorSpace: 'linear' };
    visited.add(nodeId);

    const node = nodeMap.get(nodeId);
    if (!node) return { slot: 'ORM', colorSpace: 'linear' };

    const type = node.type || '';
    const data = (node.data as Record<string, unknown>) || {};

    if (type === 'channelCombiner' || type === 'channelPack') {
      const edgeR = edges.find((e) => e.target === nodeId && e.targetHandle === 'r');
      const edgeG = edges.find((e) => e.target === nodeId && e.targetHandle === 'g');
      const edgeB = edges.find((e) => e.target === nodeId && e.targetHandle === 'b');
      const edgeA = edges.find((e) => e.target === nodeId && e.targetHandle === 'a');

      const roleR = edgeR ? String((nodeMap.get(edgeR.source)?.data as Record<string, unknown>)?.role || '').toLowerCase() : '';
      const roleG = edgeG ? String((nodeMap.get(edgeG.source)?.data as Record<string, unknown>)?.role || '').toLowerCase() : '';
      const roleB = edgeB ? String((nodeMap.get(edgeB.source)?.data as Record<string, unknown>)?.role || '').toLowerCase() : '';
      const roleA = edgeA ? String((nodeMap.get(edgeA.source)?.data as Record<string, unknown>)?.role || '').toLowerCase() : '';

      const isR_AO = roleR.includes('ambient') || roleR.includes('ao');
      const isG_Rough = roleG.includes('rough');
      const isB_Metal = roleB.includes('metal');
      const isA_Height = roleA.includes('height') || roleA.includes('disp');

      if (isR_AO && isG_Rough && isB_Metal) {
        return { slot: isA_Height ? 'ORMH' : 'ORM', colorSpace: 'linear', sourceLabel: 'Pack (ORM)' };
      }
      if (roleR.includes('rough') && roleG.includes('metal') && (roleB.includes('ambient') || roleB.includes('ao'))) {
        return { slot: 'RMA', colorSpace: 'linear', sourceLabel: 'Pack (RMA)' };
      }
      return { slot: (data.slot as string) || 'Packed_RGBA', colorSpace: 'linear', sourceLabel: 'Channel Pack' };
    }

    if (type === 'channelSplitter' || type === 'channelUnpack') {
      const inEdgeUnpack = edges.find((e) => e.target === nodeId);
      if (inEdgeUnpack) {
        const upstream = traceNode(inEdgeUnpack.source);
        return { slot: `${upstream.slot}_Channel`, colorSpace: 'linear', sourceLabel: 'Unpack Channel' };
      }
      return { slot: 'Channel', colorSpace: 'linear', sourceLabel: 'Unpack' };
    }

    if (type === 'channelSwizzle' || type === 'channelMixer') {
      return { slot: (data.slot as string) || 'Mixed_RGBA', colorSpace: 'linear', sourceLabel: 'Channel Mixer' };
    }

    if (type === 'normalBlend' || type === 'normalFlip') {
      return { slot: 'Normal', colorSpace: 'linear', sourceLabel: 'Normal Stream' };
    }

    if (type === 'textureInput') {
      const role = (data.role as string) || '';
      const lower = role.toLowerCase();
      if (lower.includes('base') || lower.includes('albedo') || lower.includes('diffuse') || lower.includes('color')) {
        return { slot: 'BaseColor', colorSpace: 'sRGB', sourceLabel: role };
      }
      if (lower.includes('normal')) {
        return { slot: 'Normal', colorSpace: 'linear', sourceLabel: 'Normal' };
      }
      if (lower.includes('rough')) {
        return { slot: 'Roughness', colorSpace: 'linear', sourceLabel: 'Roughness' };
      }
      if (lower.includes('metal')) {
        return { slot: 'Metallic', colorSpace: 'linear', sourceLabel: 'Metallic' };
      }
      if (lower.includes('ambient') || lower.includes('ao')) {
        return { slot: 'AO', colorSpace: 'linear', sourceLabel: 'Ambient Occlusion' };
      }
      if (lower.includes('height') || lower.includes('disp')) {
        return { slot: 'Height', colorSpace: 'linear', sourceLabel: 'Height' };
      }
      if (lower.includes('emiss')) {
        return { slot: 'Emissive', colorSpace: 'sRGB', sourceLabel: 'Emissive' };
      }
      if (lower.includes('opacity') || lower.includes('mask') || lower.includes('alpha')) {
        return { slot: 'Mask', colorSpace: 'linear', sourceLabel: 'Mask' };
      }
      const cleanSlot = role.replace(/[^a-zA-Z0-9]/g, '_').replace(/^_+|_+$/g, '');
      return { slot: cleanSlot || 'Custom', colorSpace: 'linear', sourceLabel: role };
    }

    const upstreamEdge = edges.find((e) => e.target === nodeId);
    if (upstreamEdge) {
      return traceNode(upstreamEdge.source);
    }

    return { slot: 'ORM', colorSpace: 'linear', sourceLabel: 'Custom Stream' };
  };

  return traceNode(inEdge.source);
}
