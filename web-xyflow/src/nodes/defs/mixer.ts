import { defineNode, type NodeDef } from '../registry';
import { PixelEngine } from '../../engine/pixelEngine';
import { ChannelMixerNode } from '../../components/nodes/ChannelMixerNode';

export interface ChannelMixerParams {
  rSrc?: string;
  gSrc?: string;
  bSrc?: string;
  aSrc?: string;
  routes?: Record<string, unknown>;
  scalarSlots?: { id: string; value: number }[];
  isBypassed?: boolean;
  exportOutputs?: string[];
  [key: string]: unknown;
}

export const channelMixerDef: NodeDef<ChannelMixerParams> = defineNode<ChannelMixerParams>({
  type: 'channelMixer',
  label: 'Channel Mixer',
  category: 'Channel',
  legacyAliases: ['channelSwizzle'],
  inputs: [
    { id: 'rgba', kind: 'color', label: 'Input Stream' },
    { id: 'r', kind: 'scalar', label: 'R' },
    { id: 'g', kind: 'scalar', label: 'G' },
    { id: 'b', kind: 'scalar', label: 'B' },
    { id: 'a', kind: 'scalar', label: 'A' },
  ],
  outputs: [{ id: 'rgba', kind: 'color', label: 'Mixed RGBA' }],
  params: {},
  defaults: {
    rSrc: 'r',
    gSrc: 'g',
    bSrc: 'b',
    aSrc: 'a',
    exportOutputs: ['rgba'],
  },
  description: 'Arbitrary cross-channel routing, inversion, and constant scalar remapping',
  color: '#818cf8',
  gpu: {
    shaderId: 'channel_mixer',
  },
  cpuRef: (ctx, inputs, params) => {
    const inConn =
      ctx.getInputConnection('rgba') ||
      ctx.getInputConnection('input') ||
      ctx.getInputConnection();
    const inBuf = inConn ? inConn.buffer : null;
    const rSrc = (params.rSrc as string) || 'r';
    const gSrc = (params.gSrc as string) || 'g';
    const bSrc = (params.bSrc as string) || 'b';
    const aSrc = (params.aSrc as string) || 'a';
    const routes = params.routes as
      | Record<string, { sources: string[]; combineOp?: string; modifier?: string; modifierVal?: number }>
      | undefined;
    const scalarSlots = (params.scalarSlots as { id: string; value: number }[]) || [];
    const scalarValues: Record<string, number> = {};
    for (const s of scalarSlots) {
      scalarValues[s.id] = s.value;
    }

    if (inBuf) {
      return params.isBypassed
        ? inBuf
        : PixelEngine.mixChannels(inBuf, routes, scalarValues, rSrc, gSrc, bSrc, aSrc);
    } else {
      const rB = inputs.r || ctx.getInputBuffer('r');
      const gB = inputs.g || ctx.getInputBuffer('g');
      const bB = inputs.b || ctx.getInputBuffer('b');
      const aB = inputs.a || ctx.getInputBuffer('a');

      if (rB || gB || bB || aB) {
        const combined = PixelEngine.combineChannels(
          { buffer: rB || undefined, channel: 0 },
          { buffer: gB || undefined, channel: 1 },
          { buffer: bB || undefined, channel: 2 },
          { buffer: aB || undefined, channel: 3 },
          undefined,
          { r: 0, g: 0, b: 0, a: 255 }
        );
        return routes
          ? PixelEngine.mixChannels(combined, routes, scalarValues, rSrc, gSrc, bSrc, aSrc)
          : combined;
      }
    }
    return null;
  },
  body: ChannelMixerNode,
});

export default channelMixerDef;
