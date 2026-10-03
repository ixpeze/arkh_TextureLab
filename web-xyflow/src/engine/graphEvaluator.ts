import type { Edge, Node } from '@xyflow/react';
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
          const val = typeof data.value === 'number' ? data.value : 1.0;
          const byteVal = Math.min(255, Math.max(0, Math.round(val * 255)));
          result = PixelEngine.createSolid(512, 512, byteVal, byteVal, byteVal, 255);
        } else if (nodeType === 'constantColor') {
          const hex = (data.color as string) || '#ffffff';
          const rgb = this.hexToRgb(hex);
          result = PixelEngine.createSolid(512, 512, rgb.r, rgb.g, rgb.b, 255);
        } else if (nodeType === 'channelCombiner') {
          // Find incoming edges for handles r, g, b, a
          const rEdge = edges.find((e) => e.target === nodeId && e.targetHandle === 'r');
          const gEdge = edges.find((e) => e.target === nodeId && e.targetHandle === 'g');
          const bEdge = edges.find((e) => e.target === nodeId && e.targetHandle === 'b');
          const aEdge = edges.find((e) => e.target === nodeId && e.targetHandle === 'a');

          const getChannelBuffer = (edge?: Edge): TextureBuffer | undefined => {
            if (!edge) return undefined;
            const srcBuf = evaluateNode(edge.source);
            if (!srcBuf) return undefined;

            const sh = edge.sourceHandle || 'r';
            if (sh === 'r') return PixelEngine.getIsolatedChannel(srcBuf, 0);
            if (sh === 'g') return PixelEngine.getIsolatedChannel(srcBuf, 1);
            if (sh === 'b') return PixelEngine.getIsolatedChannel(srcBuf, 2);
            if (sh === 'a') return PixelEngine.getIsolatedChannel(srcBuf, 3);
            return srcBuf;
          };

          const rBuf = getChannelBuffer(rEdge);
          const gBuf = getChannelBuffer(gEdge);
          const bBuf = getChannelBuffer(bEdge);
          const aBuf = getChannelBuffer(aEdge);

          const fallbacks = (data.fallbacks as any) || { r: 255, g: 128, b: 0, a: 255 };

          // Combine channels: missing / disconnected channels automatically use fallback values!
          result = PixelEngine.combineChannels(rBuf, gBuf, bBuf, aBuf, undefined, fallbacks);
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
              result = data.isBypassed
                ? inBuf
                : PixelEngine.applyLevels(
                    inBuf,
                    typeof data.blackPoint === 'number' ? data.blackPoint : 0,
                    typeof data.gamma === 'number' ? data.gamma : 1.0,
                    typeof data.whitePoint === 'number' ? data.whitePoint : 255
                  );
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
            result = data.isBypassed
              ? bufA
              : PixelEngine.blendBuffers(
                  bufA,
                  bufB,
                  bufMask || undefined,
                  (data.mode as any) || 'lerp',
                  typeof data.opacity === 'number' ? data.opacity : 1.0
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
            result = data.isBypassed
              ? bufBase
              : PixelEngine.blendNormalRNM(
                  bufBase,
                  bufDetail,
                  typeof data.detailStrength === 'number' ? data.detailStrength : 1.0
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
