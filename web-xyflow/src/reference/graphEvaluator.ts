import type { Edge, Node, Connection } from '@xyflow/react';
import { PixelEngine } from './cpuOracle';
import type { TextureBuffer } from '../types/buffer';

export interface NodeEvalContext {
  nodeId: string;
  nodes: Node[];
  edges: Edge[];
  sourceBuffers: Record<string, TextureBuffer>;
  evaluateNode: (nodeId: string) => TextureBuffer | null;
  getInputBuffer: (handle?: string) => TextureBuffer | null;
  getInputConnection: (handle?: string) => { buffer: TextureBuffer; sourceHandle: string } | null;
  coerceUE5: (
    buf: TextureBuffer,
    srcHandle?: string,
    dstHandle?: 'rgba' | 'rgb' | 'scalar' | 'r' | 'g' | 'b' | 'a' | string
  ) => TextureBuffer;
}

export type CpuNodeHandler = (
  ctx: NodeEvalContext,
  inputs: Record<string, TextureBuffer | undefined>,
  params: Record<string, unknown>
) => TextureBuffer | null;

export const cpuReferenceDefs: Record<string, CpuNodeHandler> = {
  textureInput: (ctx) => {
    return ctx.sourceBuffers[ctx.nodeId] || null;
  },

  channelCombiner: (ctx, _inputs, params) => {
    const getChannelSource = (
      conn: { buffer: TextureBuffer; sourceHandle: string } | null,
      defaultCh = 0
    ): { buffer?: TextureBuffer; channel: number } => {
      if (!conn) return { channel: defaultCh };
      const sh = conn.sourceHandle || 'r';
      let ch = defaultCh;
      if (sh === 'r') ch = 0;
      else if (sh === 'g') ch = 1;
      else if (sh === 'b') ch = 2;
      else if (sh === 'a') ch = 3;
      return { buffer: conn.buffer, channel: ch };
    };

    const rSrc = getChannelSource(ctx.getInputConnection('r'), 0);
    const gSrc = getChannelSource(ctx.getInputConnection('g'), 1);
    const bSrc = getChannelSource(ctx.getInputConnection('b'), 2);
    const aSrc = getChannelSource(ctx.getInputConnection('a'), 3);

    const rawFallbacks = (params.fallbacks as Record<string, unknown>) || {};
    const parseFallback = (val: unknown, def: number) => {
      const n = Number(val);
      return isNaN(n) ? def : Math.max(0, Math.min(255, Math.round(n)));
    };
    const fallbacks = {
      r: parseFallback(rawFallbacks.r, 0),
      g: parseFallback(rawFallbacks.g, 0),
      b: parseFallback(rawFallbacks.b, 0),
      a: parseFallback(rawFallbacks.a, 0),
    };

    return PixelEngine.combineChannels(rSrc, gSrc, bSrc, aSrc, undefined, fallbacks);
  },

  channelPack: (ctx, inputs, params) => {
    return cpuReferenceDefs.channelCombiner(ctx, inputs, params);
  },

  channelSplitter: (ctx) => {
    const inBuf = ctx.getInputBuffer();
    if (!inBuf) return null;
    return inBuf;
  },

  channelUnpack: (ctx, inputs, params) => {
    return cpuReferenceDefs.channelSplitter(ctx, inputs, params);
  },

  channelMixer: (ctx, inputs, params) => {
    const inBuf = ctx.getInputBuffer('rgba') || ctx.getInputBuffer();
    const routes = params.routes as { r: string; g: string; b: string; a: string } | undefined;
    const scalarValues = params.scalarValues as { r: number; g: number; b: number; a: number } | undefined;

    const rSrc = inputs.r ? { buffer: inputs.r, channel: 0 } : undefined;
    const gSrc = inputs.g ? { buffer: inputs.g, channel: 1 } : undefined;
    const bSrc = inputs.b ? { buffer: inputs.b, channel: 2 } : undefined;
    const aSrc = inputs.a ? { buffer: inputs.a, channel: 3 } : undefined;

    if (inBuf) {
      return (PixelEngine.mixChannels as any)(inBuf, routes, scalarValues, rSrc, gSrc, bSrc, aSrc);
    }
    if (rSrc || gSrc || bSrc || aSrc) {
      const combined = PixelEngine.combineChannels(rSrc, gSrc, bSrc, aSrc);
      return routes
        ? (PixelEngine.mixChannels as any)(combined, routes, scalarValues, rSrc, gSrc, bSrc, aSrc)
        : combined;
    }
    return null;
  },

  constantColor: (_ctx, _inputs, params) => {
    const hex = (params.color as string) || '#ffffff';
    const clean = hex.replace('#', '');
    const r = parseInt(clean.substring(0, 2), 16) || 0;
    const g = parseInt(clean.substring(2, 4), 16) || 0;
    const b = parseInt(clean.substring(4, 6), 16) || 0;
    return PixelEngine.createSolid(1, 1, r, g, b, 255);
  },

  constantScalar: (_ctx, _inputs, params) => {
    const v = typeof params.value === 'number' ? params.value : 0.5;
    const byteVal = Math.max(0, Math.min(255, Math.round(v * 255)));
    return PixelEngine.createSolid(1, 1, byteVal, byteVal, byteVal, 255);
  },

  mathOp: (ctx, inputs, params) => {
    const op = (params.__opOverride as any) || (params.operation as any) || (params.op as any) || 'add';
    const connA = ctx.getInputConnection('a') || ctx.getInputConnection('base') || ctx.getInputConnection('input') || ctx.getInputConnection();
    const connB = ctx.getInputConnection('b') || ctx.getInputConnection('exp');
    const connAlpha = ctx.getInputConnection('alpha') || ctx.getInputConnection('mask');

    const bufA = connA ? ctx.coerceUE5(connA.buffer, connA.sourceHandle, 'rgba') : inputs.a;
    const bufB = connB ? ctx.coerceUE5(connB.buffer, connB.sourceHandle, 'rgba') : inputs.b;
    const bufAlpha = connAlpha ? ctx.coerceUE5(connAlpha.buffer, connAlpha.sourceHandle, 'scalar') : inputs.alpha;

    if (params.isBypassed && bufA) {
      return bufA;
    }

    const scalarA = typeof params.valA === 'number' ? params.valA : (typeof params.a === 'number' ? params.a : (typeof params.scalarA === 'number' ? params.scalarA : undefined));
    const scalarB = typeof params.valB === 'number' ? params.valB : (typeof params.b === 'number' ? params.b : (typeof params.scalarB === 'number' ? params.scalarB : undefined));
    const param1 = typeof params.param1 === 'number' ? params.param1 : (typeof params.min === 'number' ? params.min : (typeof params.exp === 'number' ? params.exp : (typeof params.alpha === 'number' ? params.alpha : undefined)));
    const param2 = typeof params.param2 === 'number' ? params.param2 : (typeof params.max === 'number' ? params.max : undefined);

    return PixelEngine.applyMath(op, bufA || null, bufB || null, bufAlpha || null, scalarA, scalarB, param1, param2);
  },

  levels: (ctx, inputs, params) => {
    const conn = ctx.getInputConnection('in') || ctx.getInputConnection();
    const inBuf = conn ? ctx.coerceUE5(conn.buffer, conn.sourceHandle, 'rgba') : inputs.in;
    if (!inBuf) return null;

    const rawCh = (params.channel as string) || 'rgb';
    const ch = (rawCh === 'rgb' ? 'all' : rawCh) as 'all' | 'r' | 'g' | 'b' | 'a';
    const bp = typeof params.blackPoint === 'number' ? params.blackPoint : 0;
    const gm = typeof params.gamma === 'number' ? params.gamma : 1.0;
    const wp = typeof params.whitePoint === 'number' ? params.whitePoint : 255;
    const ob = typeof params.outBlack === 'number' ? params.outBlack : 0;
    const ow = typeof params.outWhite === 'number' ? params.outWhite : 255;

    return PixelEngine.applyLevelsChannel(inBuf, ch, bp, gm, wp, ob, ow);
  },

  blend: (ctx, inputs, params) => {
    const connBase = ctx.getInputConnection('base');
    const connTop = ctx.getInputConnection('top');
    const connMask = ctx.getInputConnection('mask');

    const bufBase = connBase ? ctx.coerceUE5(connBase.buffer, connBase.sourceHandle, 'rgba') : inputs.base;
    const bufTop = connTop ? ctx.coerceUE5(connTop.buffer, connTop.sourceHandle, 'rgba') : inputs.top;
    const bufMask = connMask ? ctx.coerceUE5(connMask.buffer, connMask.sourceHandle, 'scalar') : inputs.mask;

    if (!bufBase) return null;
    const opacity = typeof params.opacity === 'number' ? params.opacity : 1.0;
    const mode = (params.mode as any) || 'normal';

    return params.isBypassed
      ? bufBase
      : PixelEngine.blendBuffers(bufBase, bufTop || bufBase, bufMask || undefined, mode, opacity);
  },

  normalBlend: (ctx, inputs, params) => {
    const connBase = ctx.getInputConnection('base');
    const connDetail = ctx.getInputConnection('detail');
    const bufBase = connBase ? ctx.coerceUE5(connBase.buffer, connBase.sourceHandle, 'rgba') : inputs.base;
    const bufDetail = connDetail ? ctx.coerceUE5(connDetail.buffer, connDetail.sourceHandle, 'rgba') : inputs.detail;

    if (!bufBase) return null;
    const strength = typeof params.strength === 'number' ? params.strength : 1.0;
    const safeStrength = isNaN(strength) ? 1.0 : Math.max(0, Math.min(5, strength));

    return params.isBypassed
      ? bufBase
      : PixelEngine.blendNormalRNM(bufBase, bufDetail || bufBase, safeStrength);
  },

  invert: (ctx, inputs, params) => {
    const conn = ctx.getInputConnection('in') || ctx.getInputConnection();
    const inBuf = conn ? ctx.coerceUE5(conn.buffer, conn.sourceHandle, 'rgba') : inputs.in;
    if (!inBuf) return null;
    return params.isBypassed ? inBuf : PixelEngine.invertBuffer(inBuf);
  },

  normalFlip: (ctx, inputs, params) => {
    const conn = ctx.getInputConnection('in') || ctx.getInputConnection();
    const inBuf = conn ? ctx.coerceUE5(conn.buffer, conn.sourceHandle, 'rgba') : inputs.in;
    if (!inBuf) return null;
    return params.isBypassed ? inBuf : PixelEngine.flipGreenChannel(inBuf);
  },

  resize: (ctx, inputs, params) => {
    const conn = ctx.getInputConnection('in') || ctx.getInputConnection();
    const inBuf = conn ? ctx.coerceUE5(conn.buffer, conn.sourceHandle, 'rgba') : inputs.in;
    if (!inBuf) return null;

    const w = typeof params.width === 'number' ? params.width : inBuf.width;
    const h = typeof params.height === 'number' ? params.height : inBuf.height;
    const mode = (params.filter as any) || 'stretch';
    const potMode = (params.potMode as any) || 'none';

    let tw = w;
    let th = h;
    if (potMode !== 'none') {
      tw = PixelEngine.toPowerOfTwo(tw, potMode);
      th = PixelEngine.toPowerOfTwo(th, potMode);
    }
    return PixelEngine.resizeBuffer(inBuf, tw, th, mode);
  },

  compare: (ctx, inputs, params) => {
    const connA = ctx.getInputConnection('a');
    const connB = ctx.getInputConnection('b');
    const bufA = connA ? ctx.coerceUE5(connA.buffer, connA.sourceHandle, 'rgba') : inputs.a;
    const bufB = connB ? ctx.coerceUE5(connB.buffer, connB.sourceHandle, 'rgba') : inputs.b;

    if (!bufA || !bufB) return bufA || bufB || null;
    const mode = (params.mode as any) || 'wipe';
    const wipeProgress = typeof params.wipeProgress === 'number' ? params.wipeProgress : 0.5;
    const diffGain = typeof params.diffGain === 'number' ? params.diffGain : 1.0;
    return PixelEngine.createCompareBuffer(bufA, bufB, mode, wipeProgress, diffGain);
  },

  seamCheck: (ctx, inputs, params) => {
    const conn = ctx.getInputConnection('in') || ctx.getInputConnection();
    const inBuf = conn ? ctx.coerceUE5(conn.buffer, conn.sourceHandle, 'rgba') : inputs.in;
    if (!inBuf) return null;
    const repeats = (typeof params.repeats === 'number' ? params.repeats : 2) as 2 | 3 | 4;
    const showBorders = typeof params.showBorders === 'boolean' ? params.showBorders : true;
    return PixelEngine.createSeamCheckBuffer(inBuf, repeats, showBorders);
  },

  textureOutput: (ctx, inputs) => {
    const inConn = ctx.getInputConnection('rgba') || ctx.getInputConnection('input') || ctx.getInputConnection();
    const inBuf = inConn ? inConn.buffer : inputs.rgba;
    if (!inBuf) return null;
    let coerced = inConn ? ctx.coerceUE5(inBuf, inConn.sourceHandle || 'rgba', 'rgba') : inBuf;
    if (coerced && coerced.width === 1 && coerced.height === 1) {
      coerced = PixelEngine.createSolid(
        512,
        512,
        coerced.data[0],
        coerced.data[1],
        coerced.data[2],
        coerced.data[3]
      );
    }
    return coerced;
  },
};

export class GraphEvaluator {
  public static validateConnection(
    connection: Connection | Edge,
    edges: Edge[]
  ): { isValid: boolean; reason?: string } {
    const { source, target, sourceHandle, targetHandle } = connection;
    if (!source || !target || source === target) {
      return { isValid: false, reason: 'Self-connection not allowed' };
    }
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

  public static evaluate(
    nodes: Node[],
    edges: Edge[],
    sourceBuffers: Record<string, TextureBuffer>
  ): Record<string, TextureBuffer> {
    const evaluated: Record<string, TextureBuffer> = {};
    const nodeMap = new Map<string, Node>(nodes.map((n) => [n.id, n]));
    const visiting = new Set<string>();

    const evaluateNode = (nodeId: string): TextureBuffer | null => {
      if (evaluated[nodeId]) return evaluated[nodeId];
      if (visiting.has(nodeId)) return null;

      const node = nodeMap.get(nodeId);
      if (!node) return null;

      visiting.add(nodeId);
      let result: TextureBuffer | null = null;

      try {
        const nodeType = node.type || '';
        const data = (node.data || {}) as Record<string, unknown>;
        let handler = cpuReferenceDefs[nodeType];
        let opOverride: string | undefined;

        const mathOpMap: Record<string, string> = {
          math: (data.op as string) || (data.operation as string) || 'multiply',
          add: 'add',
          subtract: 'subtract',
          multiply: 'multiply',
          divide: 'divide',
          lerp: 'lerp',
          clamp: 'clamp',
          min: 'min',
          max: 'max',
          abs: 'abs',
          power: 'power',
          saturate: 'saturate',
          step: 'step',
          smoothstep: 'smoothstep',
          sin: 'sin',
          cos: 'cos',
          oneMinus: 'oneMinus',
          mathAdd: 'add',
          mathSubtract: 'subtract',
          mathMultiply: 'multiply',
          mathDivide: 'divide',
          mathLerp: 'lerp',
          mathClamp: 'clamp',
          mathMin: 'min',
          mathMax: 'max',
          mathAbs: 'abs',
          mathPower: 'power',
          mathSaturate: 'saturate',
          mathOneMinus: 'oneMinus',
          mathOp: 'multiply',
          mathInvert: 'invert',
          mathDot: 'multiply',
          mathCross: 'multiply',
          linearInterpolate: 'lerp',
        };

        if (mathOpMap[nodeType]) {
          handler = cpuReferenceDefs.mathOp;
          opOverride = mathOpMap[nodeType];
        }

        if (handler) {
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
          for (const edge of edges.filter((e) => e.target === nodeId)) {
            const h = edge.targetHandle || 'in';
            const b = evaluateNode(edge.source);
            if (b) inputs[h] = b;
          }

          result = handler(ctx, inputs, { ...data, ...(opOverride ? { __opOverride: opOverride } : {}) });
        }
      } finally {
        visiting.delete(nodeId);
      }

      if (result) {
        evaluated[nodeId] = result;
      }
      return result;
    };

    for (const node of nodes) {
      evaluateNode(node.id);
    }

    return evaluated;
  }

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
      const chIdx = exp === 'g' ? 1 : exp === 'b' ? 2 : exp === 'a' ? 3 : 0;
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
