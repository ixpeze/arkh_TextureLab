import type { Edge, Node, Connection } from '@xyflow/react';
import { PixelEngine, type TextureBuffer } from './pixelEngine';

export interface HandleConnectionInfo {
  handleId: string;
  isConnected: boolean;
  sourceNodeId?: string;
  sourceHandle?: string;
  sourceLabel?: string;
  fallbackValue?: number;
}

export class GraphEvaluator {
  /**
   * Validate whether a proposed edge/connection is permissible.
   * Checks for self-connections, cycle creation, and duplicate edges.
   */
  public static validateConnection(
    connection: Connection | Edge,
    edges: Edge[]
  ): { isValid: boolean; reason?: string } {
    const { source, target, sourceHandle, targetHandle } = connection;

    // 1. Edge Case: Self-connection
    if (!source || !target || source === target) {
      return { isValid: false, reason: 'Self-connection not allowed' };
    }

    // 2. Edge Case: Exact duplicate edge
    const isDuplicate = edges.some(
      (e) =>
        e.source === source &&
        e.target === target &&
        (e.sourceHandle || null) === (sourceHandle || null) &&
        (e.targetHandle || null) === (targetHandle || null)
    );
    if (isDuplicate) {
      return { isValid: false, reason: 'Wire already exists' };
    }

    // 3. Edge Case: Directed cycle detection (DAG enforcement)
    // Adding (source -> target) causes a cycle if and only if target can already reach source.
    const visited = new Set<string>();
    const queue: string[] = [target];

    while (queue.length > 0) {
      const curr = queue.shift()!;
      if (curr === source) {
        return { isValid: false, reason: 'Cycle detected: Recursive loop is not permitted in DAG' };
      }
      visited.add(curr);

      for (const e of edges) {
        if (e.source === curr && !visited.has(e.target)) {
          queue.push(e.target);
        }
      }
    }

    return { isValid: true };
  }

  /**
   * Topologically evaluate the entire node graph.
   * Returns a map of nodeId -> evaluated TextureBuffer.
   */
  public static evaluate(
    nodes: Node[],
    edges: Edge[],
    sourceBuffers: Record<string, TextureBuffer>
  ): Record<string, TextureBuffer> {
    const evaluated: Record<string, TextureBuffer> = {};
    const nodeMap = new Map<string, Node>(nodes.map((n) => [n.id, n]));
    const visiting = new Set<string>();

    // Helper to evaluate a node recursively with cycle detection
    const evaluateNode = (nodeId: string): TextureBuffer | null => {
      if (evaluated[nodeId]) {
        return evaluated[nodeId];
      }
      if (visiting.has(nodeId)) {
        // Cycle detected, break infinite loop
        return null;
      }

      const node = nodeMap.get(nodeId);
      if (!node) return null;

      visiting.add(nodeId);
      let result: TextureBuffer | null = null;

      try {
        const nodeType = node.type || '';
        const data = node.data || {};

        if (nodeType === 'textureInput') {
          // Source buffer from upload or benchmark load
          result = sourceBuffers[nodeId] || null;
        } else if (nodeType === 'constantScalar') {
          const rawVal = typeof data.value === 'number' && !isNaN(data.value) ? data.value : 1.0;
          const val = Math.max(0, Math.min(1, rawVal));
          const byteVal = Math.min(255, Math.max(0, Math.round(val * 255)));
          result = PixelEngine.createSolid(512, 512, byteVal, byteVal, byteVal, 255);
        } else if (nodeType === 'constantColor') {
          const rawHex = typeof data.color === 'string' ? data.color : '#ffffff';
          const hex = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(rawHex) ? rawHex : '#ffffff';
          const rgb = this.hexToRgb(hex);
          result = PixelEngine.createSolid(512, 512, rgb.r, rgb.g, rgb.b, 255);
        } else if (nodeType === 'channelCombiner') {
          // Find incoming edges for handles r, g, b, a
          const rEdge = edges.find((e) => e.target === nodeId && e.targetHandle === 'r');
          const gEdge = edges.find((e) => e.target === nodeId && e.targetHandle === 'g');
          const bEdge = edges.find((e) => e.target === nodeId && e.targetHandle === 'b');
          const aEdge = edges.find((e) => e.target === nodeId && e.targetHandle === 'a');

          const getChannelSource = (edge?: Edge, defaultCh = 0): { buffer?: TextureBuffer; channel: number } => {
            if (!edge) return { channel: defaultCh };
            const srcBuf = evaluateNode(edge.source);
            if (!srcBuf) return { channel: defaultCh };

            const sh = edge.sourceHandle || 'r';
            let ch = defaultCh;
            if (sh === 'r') ch = 0;
            else if (sh === 'g') ch = 1;
            else if (sh === 'b') ch = 2;
            else if (sh === 'a') ch = 3;

            return { buffer: srcBuf, channel: ch };
          };

          const rSrc = getChannelSource(rEdge, 0);
          const gSrc = getChannelSource(gEdge, 1);
          const bSrc = getChannelSource(bEdge, 2);
          const aSrc = getChannelSource(aEdge, 3);

          const rawFallbacks = (data.fallbacks as any) || {};
          const parseFallback = (val: any, def: number) => {
            const n = Number(val);
            return isNaN(n) ? def : Math.max(0, Math.min(255, Math.round(n)));
          };
          const fallbacks = {
            r: parseFallback(rawFallbacks.r, 255),
            g: parseFallback(rawFallbacks.g, 128),
            b: parseFallback(rawFallbacks.b, 0),
            a: parseFallback(rawFallbacks.a, 255),
          };

          // Combine channels: zero intermediate buffer allocations, ultra-fast direct multiplexing!
          result = PixelEngine.combineChannels(rSrc, gSrc, bSrc, aSrc, undefined, fallbacks);
        } else if (nodeType === 'channelSplitter') {
          const inEdge = edges.find((e) => e.target === nodeId && (e.targetHandle === 'rgba' || !e.targetHandle));
          if (inEdge) {
            result = evaluateNode(inEdge.source);
          }
        } else if (nodeType === 'invert') {
          const inEdge = edges.find((e) => e.target === nodeId);
          if (inEdge) {
            const inBuf = evaluateNode(inEdge.source);
            if (inBuf) {
              result = data.isBypassed ? inBuf : PixelEngine.invertBuffer(inBuf);
            }
          }
        } else if (nodeType === 'levels') {
          const inEdge = edges.find((e) => e.target === nodeId);
          if (inEdge) {
            const inBuf = evaluateNode(inEdge.source);
            if (inBuf) {
              const bp = typeof data.blackPoint === 'number' && !isNaN(data.blackPoint) ? Math.max(0, Math.min(255, data.blackPoint)) : 0;
              const wp = typeof data.whitePoint === 'number' && !isNaN(data.whitePoint) ? Math.max(0, Math.min(255, data.whitePoint)) : 255;
              const gm = typeof data.gamma === 'number' && !isNaN(data.gamma) ? Math.max(0.01, Math.min(5.0, data.gamma)) : 1.0;
              result = data.isBypassed
                ? inBuf
                : PixelEngine.applyLevels(inBuf, bp, gm, wp);
            }
          }
        } else if (nodeType === 'normalFlip') {
          const inEdge = edges.find((e) => e.target === nodeId);
          if (inEdge) {
            const inBuf = evaluateNode(inEdge.source);
            if (inBuf) {
              result = data.isBypassed ? inBuf : PixelEngine.flipGreenChannel(inBuf);
            }
          }
        } else if (nodeType === 'blend') {
          const edgeA = edges.find((e) => e.target === nodeId && e.targetHandle === 'a');
          const edgeB = edges.find((e) => e.target === nodeId && e.targetHandle === 'b');
          const edgeMask = edges.find((e) => e.target === nodeId && e.targetHandle === 'mask');

          const bufA = edgeA ? evaluateNode(edgeA.source) : null;
          const bufB = edgeB ? evaluateNode(edgeB.source) : null;
          const bufMask = edgeMask ? evaluateNode(edgeMask.source) : undefined;

          if (bufA && bufB) {
            const safeOpacity = typeof data.opacity === 'number' && !isNaN(data.opacity) ? Math.max(0, Math.min(1.0, data.opacity)) : 1.0;
            result = data.isBypassed
              ? bufA
              : PixelEngine.blendBuffers(
                  bufA,
                  bufB,
                  bufMask || undefined,
                  (data.mode as any) || 'lerp',
                  safeOpacity
                );
          } else if (bufA) {
            result = bufA;
          } else if (bufB) {
            result = bufB;
          }
        } else if (nodeType === 'normalBlend') {
          const edgeBase = edges.find((e) => e.target === nodeId && e.targetHandle === 'base');
          const edgeDetail = edges.find((e) => e.target === nodeId && e.targetHandle === 'detail');

          const bufBase = edgeBase ? evaluateNode(edgeBase.source) : null;
          const bufDetail = edgeDetail ? evaluateNode(edgeDetail.source) : null;

          if (bufBase && bufDetail) {
            const safeStrength = typeof data.detailStrength === 'number' && !isNaN(data.detailStrength) ? Math.max(0, Math.min(5.0, data.detailStrength)) : 1.0;
            result = data.isBypassed
              ? bufBase
              : PixelEngine.blendNormalRNM(
                  bufBase,
                  bufDetail,
                  safeStrength
                );
          } else if (bufBase) {
            result = bufBase;
          }
        } else if (nodeType === 'channelSwizzle') {
          const inEdge = edges.find((e) => e.target === nodeId && (e.targetHandle === 'rgba' || !e.targetHandle));
          if (inEdge) {
            const inBuf = evaluateNode(inEdge.source);
            if (inBuf) {
              result = data.isBypassed
                ? inBuf
                : PixelEngine.swizzleBuffer(
                    inBuf,
                    (data.rSrc as string) || 'r',
                    (data.gSrc as string) || 'g',
                    (data.bSrc as string) || 'b',
                    (data.aSrc as string) || 'a'
                  );
            }
          }
        } else if (nodeType === 'textureOutput') {
          const inEdge = edges.find((e) => e.target === nodeId && (e.targetHandle === 'rgba' || !e.targetHandle));
          if (inEdge) {
            result = evaluateNode(inEdge.source);
          }
        }
      } finally {
        visiting.delete(nodeId);
      }

      if (result) {
        evaluated[nodeId] = result;
      }
      return result;
    };

    // Evaluate all nodes
    for (const node of nodes) {
      evaluateNode(node.id);
    }

    return evaluated;
  }

  /**
   * Get detailed port connection info for a specific node to display in telemetry
   */
  public static getNodePortTelemetry(
    node: Node,
    edges: Edge[]
  ): HandleConnectionInfo[] {
    const nodeType = node.type || '';
    const data = node.data || {};

    if (nodeType === 'channelCombiner') {
      const fallbacks = (data.fallbacks as any) || { r: 255, g: 128, b: 0, a: 255 };
      const ports = [
        { handleId: 'r', label: 'R (AO)', fallback: fallbacks.r ?? 255 },
        { handleId: 'g', label: 'G (Roughness)', fallback: fallbacks.g ?? 128 },
        { handleId: 'b', label: 'B (Metallic)', fallback: fallbacks.b ?? 0 },
        { handleId: 'a', label: 'A (Height)', fallback: fallbacks.a ?? 255 },
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

    if (nodeType === 'textureOutput') {
      const edge = edges.find((e) => e.target === node.id && (e.targetHandle === 'rgba' || !e.targetHandle));
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
  public static autoDetectOutputRole(
    outputNodeId: string,
    nodes: Node[],
    edges: Edge[]
  ): { slot: string; colorSpace: 'linear' | 'sRGB'; sourceLabel?: string } {
    const nodeMap = new Map<string, Node>(nodes.map((n) => [n.id, n]));
    const inEdge = edges.find((e) => e.target === outputNodeId && (e.targetHandle === 'rgba' || !e.targetHandle));
    if (!inEdge) {
      return { slot: 'ORM', colorSpace: 'linear', sourceLabel: 'Unwired' };
    }

    const visited = new Set<string>();

    const traceNode = (nodeId: string): { slot: string; colorSpace: 'linear' | 'sRGB'; sourceLabel?: string } => {
      if (visited.has(nodeId)) return { slot: 'ORM', colorSpace: 'linear' };
      visited.add(nodeId);

      const node = nodeMap.get(nodeId);
      if (!node) return { slot: 'ORM', colorSpace: 'linear' };

      const type = node.type || '';
      const data = (node.data as any) || {};

      if (type === 'channelCombiner') {
        const edgeR = edges.find((e) => e.target === nodeId && e.targetHandle === 'r');
        const edgeG = edges.find((e) => e.target === nodeId && e.targetHandle === 'g');
        const edgeB = edges.find((e) => e.target === nodeId && e.targetHandle === 'b');
        const edgeA = edges.find((e) => e.target === nodeId && e.targetHandle === 'a');

        const roleR = edgeR ? (nodeMap.get(edgeR.source)?.data as any)?.role?.toLowerCase() || '' : '';
        const roleG = edgeG ? (nodeMap.get(edgeG.source)?.data as any)?.role?.toLowerCase() || '' : '';
        const roleB = edgeB ? (nodeMap.get(edgeB.source)?.data as any)?.role?.toLowerCase() || '' : '';
        const roleA = edgeA ? (nodeMap.get(edgeA.source)?.data as any)?.role?.toLowerCase() || '' : '';

        const isR_AO = roleR.includes('ambient') || roleR.includes('ao');
        const isG_Rough = roleG.includes('rough');
        const isB_Metal = roleB.includes('metal');
        const isA_Height = roleA.includes('height') || roleA.includes('disp');

        if (isR_AO && isG_Rough && isB_Metal) {
          return { slot: isA_Height ? 'ORMH' : 'ORM', colorSpace: 'linear', sourceLabel: 'Combiner (ORM)' };
        }
        if (roleR.includes('rough') && roleG.includes('metal') && (roleB.includes('ambient') || roleB.includes('ao'))) {
          return { slot: 'RMA', colorSpace: 'linear', sourceLabel: 'Combiner (RMA)' };
        }
        return { slot: 'Packed_RGBA', colorSpace: 'linear', sourceLabel: 'Combiner' };
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

  private static hexToRgb(hex: string): { r: number; g: number; b: number } {
    let clean = hex.replace('#', '');
    if (clean.length === 3) {
      clean = clean.split('').map((c) => c + c).join('');
    }
    const num = parseInt(clean, 16);
    return {
      r: (num >> 16) & 255,
      g: (num >> 8) & 255,
      b: num & 255,
    };
  }
}
