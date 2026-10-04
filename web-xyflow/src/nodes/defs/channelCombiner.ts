import { defineNode, type NodeDef } from '../registry';
import { PixelEngine, type TextureBuffer } from '../../engine/pixelEngine';
import { ChannelCombinerNode } from '../../components/nodes/ChannelCombinerNode';

export interface ChannelCombinerParams {
  slot?: string;
  fallbacks?: {
    r?: number;
    g?: number;
    b?: number;
    a?: number;
  };
  [key: string]: unknown;
}

export const channelCombinerDef: NodeDef<ChannelCombinerParams> = defineNode<ChannelCombinerParams>({
  type: 'channelCombiner',
  label: 'Channel Combiner',
  category: 'Channel',
  hotkey: 'm',
  legacyAliases: ['channelPack'],
  inputs: [
    { id: 'r', kind: 'scalar', label: 'R (AO)' },
    { id: 'g', kind: 'scalar', label: 'G (Roughness)' },
    { id: 'b', kind: 'scalar', label: 'B (Metallic)' },
    { id: 'a', kind: 'scalar', label: 'A (Height)' },
  ],
  outputs: [{ id: 'rgba', kind: 'color', label: 'Packed RGBA' }],
  params: {
    slot: {
      type: 'enum',
      label: 'Packing Preset',
      options: [
        { value: 'ORM', label: 'ORM (UE5 Standard)' },
        { value: 'ORMH', label: 'ORMH (AO, Rough, Metal, Height)' },
        { value: 'RMA', label: 'RMA' },
        { value: 'Packed_RGBA', label: 'Packed RGBA' },
      ],
      default: 'ORM',
    },
  },
  defaults: {
    slot: 'ORM',
    fallbacks: { r: 0, g: 0, b: 0, a: 0 },
  },
  description: 'Multiplex up to 4 discrete channel streams into a single packed RGBA texture',
  color: '#a855f7',
  gpu: {
    shaderId: 'channel_combiner',
  },
  cpuRef: (ctx, _inputs, params) => {
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
  body: ChannelCombinerNode,
});

export default channelCombinerDef;
