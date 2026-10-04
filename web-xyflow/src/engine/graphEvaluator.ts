import type { Edge, Node, Connection } from '@xyflow/react';
import { PixelEngine, type TextureBuffer } from './pixelEngine';
import { nodeRegistry, type NodeEvalContext } from '../nodes/registry';

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

        const regDef = nodeRegistry.get(nodeType);
        if (regDef?.cpuRef) {
          const ctx: NodeEvalContext = {
            nodeId,
            nodes,
            edges,
            sourceBuffers,
            evaluateNode,
            getInputBuffer: (handle?: string) => {
              const edge = edges.find((e) => e.target === nodeId && (handle ? e.targetHandle === handle : true));
              return edge ? evaluateNode(edge.source) : null;
            },
            getInputConnection: (handle?: string) => {
              const edge = edges.find((e) => e.target === nodeId && (handle ? e.targetHandle === handle : true));
              if (!edge) return null;
              const buf = evaluateNode(edge.source);
              return buf ? { buffer: buf, sourceHandle: edge.sourceHandle || 'rgba' } : null;
            },
            coerceUE5: (buf, srcHandle, dstHandle) =>
              this.coerceUE5(buf, srcHandle, (dstHandle as any) || 'rgba'),
          };

          const inputs: Record<string, TextureBuffer | undefined> = {};
          for (const port of regDef.inputs) {
            const edge = edges.find(
              (e) => e.target === nodeId && (e.targetHandle === port.id || (!e.targetHandle && regDef.inputs.length === 1))
            );
            if (edge) {
              const b = evaluateNode(edge.source);
              if (b) inputs[port.id] = b;
            }
          }

          result = regDef.cpuRef(ctx, inputs, data);
        } else if (nodeType === 'channelSwizzle' || nodeType === 'channelMixer') {
          // Channel Mixer: straight wires, scalar slots, custom remapping
          const inEdge = edges.find((e) => e.target === nodeId && (e.targetHandle === 'rgba' || e.targetHandle === 'input' || !e.targetHandle));
          const inBuf = inEdge ? evaluateNode(inEdge.source) : null;
          const rSrc = (data.rSrc as string) || 'r';
          const gSrc = (data.gSrc as string) || 'g';
          const bSrc = (data.bSrc as string) || 'b';
          const aSrc = (data.aSrc as string) || 'a';
          const routes = data.routes as any;
          const scalarSlots = (data.scalarSlots as { id: string; value: number }[]) || [];
          const scalarValues: Record<string, number> = {};
          for (const s of scalarSlots) {
            scalarValues[s.id] = s.value;
          }

          if (inBuf) {
            result = data.isBypassed
              ? inBuf
              : PixelEngine.mixChannels(inBuf, routes, scalarValues, rSrc, gSrc, bSrc, aSrc);
          } else {
            // Check if individual channel pins are connected
            const rEdge = edges.find((e) => e.target === nodeId && e.targetHandle === 'r');
            const gEdge = edges.find((e) => e.target === nodeId && e.targetHandle === 'g');
            const bEdge = edges.find((e) => e.target === nodeId && e.targetHandle === 'b');
            const aEdge = edges.find((e) => e.target === nodeId && e.targetHandle === 'a');

            if (rEdge || gEdge || bEdge || aEdge) {
              const rB = rEdge ? evaluateNode(rEdge.source) : null;
              const gB = gEdge ? evaluateNode(gEdge.source) : null;
              const bB = bEdge ? evaluateNode(bEdge.source) : null;
              const aB = aEdge ? evaluateNode(aEdge.source) : null;
              const combined = PixelEngine.combineChannels(
                { buffer: rB || undefined, channel: 0 },
                { buffer: gB || undefined, channel: 1 },
                { buffer: bB || undefined, channel: 2 },
                { buffer: aB || undefined, channel: 3 },
                undefined,
                { r: 0, g: 0, b: 0, a: 255 }
              );
              result = routes ? PixelEngine.mixChannels(combined, routes, scalarValues, rSrc, gSrc, bSrc, aSrc) : combined;
            }
          }
        } else if (nodeType === 'resize') {
          const inEdge = edges.find((e) => e.target === nodeId);
          if (inEdge) {
            const inBuf = evaluateNode(inEdge.source);
            if (inBuf) {
              let tw = typeof data.targetWidth === 'number' ? data.targetWidth : 1024;
              let th = typeof data.targetHeight === 'number' ? data.targetHeight : 1024;
              const potMode = (data.potMode as 'none' | 'nearest' | 'up' | 'down') || 'none';
              if (potMode !== 'none') {
                tw = PixelEngine.toPowerOfTwo(tw, potMode);
                th = PixelEngine.toPowerOfTwo(th, potMode);
              }
              const mode = (data.mode as 'preserve' | 'pad' | 'crop' | 'stretch') || 'preserve';
              result = data.isBypassed ? inBuf : PixelEngine.resizeBuffer(inBuf, tw, th, mode);
            }
          }
        } else if (nodeType === 'upscale') {
          const inEdge = edges.find((e) => e.target === nodeId);
          if (inEdge) {
            const inBuf = evaluateNode(inEdge.source);
            if (inBuf) {
              const scale = (data.scale === 4 ? 4 : 2) as 2 | 4;
              // Synchronous preview: fast bilinear resize; export uses upscaleBufferAsync
              result = data.isBypassed ? inBuf : PixelEngine.resizeBuffer(inBuf, inBuf.width * scale, inBuf.height * scale, 'stretch');
            }
          }
        } else if (nodeType === 'compare') {
          const edgeA = edges.find((e) => e.target === nodeId && e.targetHandle === 'a');
          const edgeB = edges.find((e) => e.target === nodeId && e.targetHandle === 'b');
          const bufA = edgeA ? evaluateNode(edgeA.source) : null;
          const bufB = edgeB ? evaluateNode(edgeB.source) : null;

          if (bufA && bufB) {
            const mode = (data.mode as 'wipe' | 'sideBySide' | 'difference') || 'wipe';
            const wipeProgress = typeof data.wipeProgress === 'number' ? data.wipeProgress : 0.5;
            const diffGain = typeof data.diffGain === 'number' ? data.diffGain : 1.0;
            result = PixelEngine.createCompareBuffer(bufA, bufB, mode, wipeProgress, diffGain);
          } else if (bufA) {
            result = bufA;
          } else if (bufB) {
            result = bufB;
          }
        } else if (nodeType === 'seamCheck') {
          const inEdge = edges.find((e) => e.target === nodeId);
          if (inEdge) {
            const inBuf = evaluateNode(inEdge.source);
            if (inBuf) {
              const repeats = (data.repeats === 3 ? 3 : data.repeats === 4 ? 4 : 2) as 2 | 3 | 4;
              const showBorders = data.showBorders !== false;
              result = PixelEngine.createSeamCheckBuffer(inBuf, repeats, showBorders);
            }
          }
        } else if (nodeType === 'loadFolder' || nodeType === 'forEach' || nodeType === 'batchExport') {
          // Pass-through or active item buffer
          const inEdge = edges.find((e) => e.target === nodeId);
          if (inEdge) {
            result = evaluateNode(inEdge.source);
          } else if (data.activeBuffer) {
            result = data.activeBuffer as TextureBuffer;
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
   * UE5-Compatible Pin & Type Coercion:
   * 1. Scalar extraction: 'r', 'g', 'b', 'a'
   *    - To Scalar: solid/channel buffer with extracted scalar.
   *    - To Vector3 (RGB) or Vector4 (RGBA): Replicates scalar across lanes (R=S, G=S, B=S, A=255).
   * 2. Vector3 (RGB):
   *    - To Vector4 (RGBA): Appends Alpha=255 (1.0).
   *    - To Scalar: Takes Red channel.
   * 3. Vector4 (RGBA):
   *    - To Vector3 (RGB): Drops Alpha.
   *    - To Scalar: Takes Red channel.
   */
  public static coerceUE5(
    buffer: TextureBuffer,
    sourceHandle = 'rgba',
    expectedType: 'rgba' | 'rgb' | 'scalar' | 'r' | 'g' | 'b' | 'a' = 'rgba'
  ): TextureBuffer {
    const sh = sourceHandle.toLowerCase();
    const isScalarSource = ['r', 'g', 'b', 'a'].includes(sh);
    const exp = expectedType.toLowerCase();
    const isScalarExpected = exp === 'scalar' || ['r', 'g', 'b', 'a'].includes(exp);

    if (isScalarSource) {
      const chIdx = sh === 'r' ? 0 : sh === 'g' ? 1 : sh === 'b' ? 2 : 3;
      const w = buffer.width;
      const h = buffer.height;
      const outData = new Uint8ClampedArray(w * h * 4);
      const data = buffer.data;

      for (let i = 0; i < data.length; i += 4) {
        const val = data[i + chIdx];
        outData[i + 0] = val;
        outData[i + 1] = val;
        outData[i + 2] = val;
        outData[i + 3] = exp === 'rgba' ? val : 255;
      }
      return { width: w, height: h, data: outData, dataUrl: PixelEngine.toDataUrl({ width: w, height: h, data: outData }) };
    }

    if (sh === 'rgb') {
      const w = buffer.width;
      const h = buffer.height;
      const outData = new Uint8ClampedArray(buffer.data);
      for (let i = 0; i < outData.length; i += 4) {
        outData[i + 3] = 255;
      }
      return { width: w, height: h, data: outData, dataUrl: PixelEngine.toDataUrl({ width: w, height: h, data: outData }) };
    }

    if (isScalarExpected) {
      const chIdx = exp === 'g' ? 1 : exp === 'b' ? 2 : exp === 'a' ? 3 : 0; // Default to Red channel
      const w = buffer.width;
      const h = buffer.height;
      const outData = new Uint8ClampedArray(w * h * 4);
      const data = buffer.data;
      for (let i = 0; i < data.length; i += 4) {
        const val = data[i + chIdx];
        outData[i + 0] = val;
        outData[i + 1] = val;
        outData[i + 2] = val;
        outData[i + 3] = 255;
      }
      return { width: w, height: h, data: outData, dataUrl: PixelEngine.toDataUrl({ width: w, height: h, data: outData }) };
    }

    return buffer;
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

    if (nodeType === 'channelCombiner' || nodeType === 'channelPack') {
      const fallbacks = (data.fallbacks as any) || { r: 0, g: 0, b: 0, a: 0 };
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

      if (type === 'channelCombiner' || type === 'channelPack') {
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
          return { slot: isA_Height ? 'ORMH' : 'ORM', colorSpace: 'linear', sourceLabel: 'Pack (ORM)' };
        }
        if (roleR.includes('rough') && roleG.includes('metal') && (roleB.includes('ambient') || roleB.includes('ao'))) {
          return { slot: 'RMA', colorSpace: 'linear', sourceLabel: 'Pack (RMA)' };
        }
        return { slot: (data as any)?.slot || 'Packed_RGBA', colorSpace: 'linear', sourceLabel: 'Channel Pack' };
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
        return { slot: data.slot || 'Mixed_RGBA', colorSpace: 'linear', sourceLabel: 'Channel Mixer' };
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
}
