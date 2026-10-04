import { defineNode, type NodeDef } from '../registry';
import { TextureInputNode } from '../../components/nodes/TextureInputNode';

export interface TextureInputParams {
  title?: string;
  role?: string;
  roleColor?: string;
  res?: string;
  previewUrl?: string;
  colorSpace?: 'sRGB' | 'Linear' | 'linear';
  tileU?: number;
  tileV?: number;
  [key: string]: unknown;
}

export const textureInputDef: NodeDef<TextureInputParams> = defineNode<TextureInputParams>({
  type: 'textureInput',
  label: 'Texture Input',
  category: 'Input',
  hotkey: 't',
  inputs: [],
  outputs: [
    { id: 'rgba', kind: 'color', label: 'RGBA' },
    { id: 'r', kind: 'scalar', label: 'R' },
    { id: 'g', kind: 'scalar', label: 'G' },
    { id: 'b', kind: 'scalar', label: 'B' },
    { id: 'a', kind: 'scalar', label: 'A' },
  ],
  params: {
    colorSpace: {
      type: 'enum',
      label: 'Color Space',
      options: [
        { value: 'Linear', label: 'Linear' },
        { value: 'sRGB', label: 'sRGB' },
      ],
      default: 'Linear',
    },
  },
  defaults: {
    title: 'Texture Input',
    role: '',
    roleColor: 'var(--pbr-albedo)',
    res: '',
    previewUrl: '',
    colorSpace: 'Linear',
  },
  description: 'Load files & drag-drop with filename inference',
  color: '#38bdf8',
  gpu: {
    shaderId: 'texture_input',
  },
  cpuRef: (ctx) => {
    return ctx.sourceBuffers[ctx.nodeId] || null;
  },
  body: TextureInputNode,
});

export default textureInputDef;
