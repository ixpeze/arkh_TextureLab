import type { Edge, Node, Connection } from '@xyflow/react';
import { PixelEngine, type TextureBuffer } from './pixelEngine';
import { nodeRegistry, type NodeEvalContext } from '../nodes/registry';


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
              this.coerceUE5(buf, srcHandle, (dstHandle as 'rgba' | 'rgb' | 'scalar' | 'r' | 'g' | 'b' | 'a') || 'rgba'),
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
}

