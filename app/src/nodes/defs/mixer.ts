import { defineNode, type NodeDef } from '../registry';
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
  body: ChannelMixerNode,
});

export default channelMixerDef;
