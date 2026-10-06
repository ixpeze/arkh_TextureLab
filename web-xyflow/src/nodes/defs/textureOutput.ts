import { defineNode, type NodeDef } from '../registry';
import { TextureOutputNode } from '../../components/nodes/TextureOutputNode';

export interface TextureOutputParams {
  slot?: string;
  format?: 'png' | 'tga' | 'jpg' | 'webp';
  bitDepth?: '8b' | '16b';
  autoDetectedSlot?: string;
  isSlotOverridden?: boolean;
  resolutionOverride?: string;
  [key: string]: unknown;
}

export const textureOutputDef: NodeDef<TextureOutputParams> = defineNode<TextureOutputParams>({
  type: 'textureOutput',
  label: 'Texture Output',
  category: 'Output',
  hotkey: 'o',
  inputs: [{ id: 'rgba', kind: 'color', label: 'Packed RGBA Stream' }],
  outputs: [],
  params: {
    format: {
      type: 'enum',
      label: 'Format',
      options: [
        { value: 'png', label: 'PNG' },
        { value: 'tga', label: 'TGA' },
        { value: 'jpg', label: 'JPEG' },
        { value: 'webp', label: 'WebP' },
      ],
      default: 'png',
    },
    bitDepth: {
      type: 'enum',
      label: 'Bit Depth',
      options: [
        { value: '8b', label: '8-bit' },
        { value: '16b', label: '16-bit Precision' },
      ],
      default: '8b',
    },
  },
  defaults: {
    slot: 'ORM',
    format: 'png',
    bitDepth: '8b',
  },
  description: 'Dedicated export terminal node for final PBR map baking and download',
  color: '#4ade80',
  gpu: {
    shaderId: 'texture_output',
  },
  body: TextureOutputNode,
});

export default textureOutputDef;
