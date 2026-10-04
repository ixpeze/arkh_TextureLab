import { defineNode, type NodeDef } from '../registry';
import { ChannelSplitterNode } from '../../components/nodes/ChannelSplitterNode';

export interface ChannelSplitterParams {
  channels?: {
    r?: string;
    g?: string;
    b?: string;
    a?: string;
  };
  [key: string]: unknown;
}

export const channelSplitterDef: NodeDef<ChannelSplitterParams> = defineNode<ChannelSplitterParams>({
  type: 'channelSplitter',
  label: 'Channel Splitter',
  category: 'Channel',
  hotkey: 's',
  legacyAliases: ['channelUnpack'],
  inputs: [{ id: 'rgba', kind: 'color', label: 'Input Stream' }],
  outputs: [
    { id: 'r', kind: 'scalar', label: 'R' },
    { id: 'g', kind: 'scalar', label: 'G' },
    { id: 'b', kind: 'scalar', label: 'B' },
    { id: 'a', kind: 'scalar', label: 'A' },
  ],
  params: {},
  defaults: {
    channels: { r: 'R', g: 'G', b: 'B', a: 'A' },
  },
  description: 'Split a packed texture stream into discrete single-channel streams',
  color: '#a855f7',
  gpu: {
    shaderId: 'channel_splitter',
  },
  cpuRef: (ctx) => {
    const inConn =
      ctx.getInputConnection('rgba') ||
      ctx.getInputConnection('input') ||
      ctx.getInputConnection();
    if (inConn) {
      return ctx.coerceUE5(inConn.buffer, inConn.sourceHandle || 'rgba', 'rgba');
    }
    return null;
  },
  body: ChannelSplitterNode,
});

export default channelSplitterDef;
