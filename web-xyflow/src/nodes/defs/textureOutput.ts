import { defineNode, type NodeDef } from '../registry';
import { PixelEngine } from '../../engine/pixelEngine';
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
        { value: '16b', label: '16-bit (Coming in v1.0 final)' },
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
  cpuRef: (ctx) => {
    const inConn =
      ctx.getInputConnection('rgba') ||
      ctx.getInputConnection('input') ||
      ctx.getInputConnection();
    if (inConn) {
      let coerced = ctx.coerceUE5(inConn.buffer, inConn.sourceHandle || 'rgba', 'rgba');
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
    }
    return null;
  },
  body: TextureOutputNode,
});

export default textureOutputDef;
