import { defineNode, type NodeDef } from '../registry';
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
  body: ChannelCombinerNode,
});

export default channelCombinerDef;
