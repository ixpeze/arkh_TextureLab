import { defineNode, type NodeDef } from '../registry';
import { PixelEngine } from '../../engine/pixelEngine';
import { ResizeNode } from '../../components/nodes/ResizeNode';
import { UpscaleNode } from '../../components/nodes/UpscaleNode';

export interface ResizeParams {
  targetWidth?: number;
  targetHeight?: number;
  potMode?: 'none' | 'nearest' | 'up' | 'down';
  mode?: 'preserve' | 'pad' | 'crop' | 'stretch';
  isBypassed?: boolean;
  [key: string]: unknown;
}

export interface UpscaleParams {
  scale?: 2 | 4;
  tileSize?: number;
  isBypassed?: boolean;
  [key: string]: unknown;
}

export const resizeDef: NodeDef<ResizeParams> = defineNode<ResizeParams>({
  type: 'resize',
  label: 'Resize',
  category: 'Utility',
  inputs: [{ id: 'input', kind: 'any', label: 'Input' }],
  outputs: [{ id: 'output', kind: 'any', label: 'Output' }],
  params: {
    targetWidth: { type: 'number', min: 16, max: 8192, step: 16, label: 'Width', default: 1024 },
    targetHeight: { type: 'number', min: 16, max: 8192, step: 16, label: 'Height', default: 1024 },
    potMode: {
      type: 'enum',
      label: 'POT Alignment',
      options: [
        { value: 'none', label: 'None' },
        { value: 'nearest', label: 'Nearest POT' },
        { value: 'up', label: 'Round Up' },
        { value: 'down', label: 'Round Down' },
      ],
      default: 'none',
    },
    mode: {
      type: 'enum',
      label: 'Aspect Mode',
      options: [
        { value: 'preserve', label: 'Preserve Aspect' },
        { value: 'pad', label: 'Pad with Black' },
        { value: 'crop', label: 'Center Crop' },
        { value: 'stretch', label: 'Stretch to Fit' },
      ],
      default: 'preserve',
    },
  },
  defaults: {
    targetWidth: 1024,
    targetHeight: 1024,
    potMode: 'none',
    mode: 'preserve',
  },
  description: 'Arbitrary or Power-of-Two (POT) buffer dimension scaling',
  color: '#38bdf8',
  gpu: {
    shaderId: 'resize',
  },
  cpuRef: (ctx, inputs, params) => {
    const inBuf = inputs.input || ctx.getInputBuffer();
    if (!inBuf) return null;
    if (params.isBypassed) return inBuf;

    let tw = typeof params.targetWidth === 'number' ? params.targetWidth : 1024;
    let th = typeof params.targetHeight === 'number' ? params.targetHeight : 1024;
    const potMode = (params.potMode as 'none' | 'nearest' | 'up' | 'down') || 'none';
    if (potMode !== 'none') {
      tw = PixelEngine.toPowerOfTwo(tw, potMode);
      th = PixelEngine.toPowerOfTwo(th, potMode);
    }
    const mode = (params.mode as 'preserve' | 'pad' | 'crop' | 'stretch') || 'preserve';
    return PixelEngine.resizeBuffer(inBuf, tw, th, mode);
  },
  body: ResizeNode,
});

export const upscaleDef: NodeDef<UpscaleParams> = defineNode<UpscaleParams>({
  type: 'upscale',
  label: 'Upscale',
  category: 'Utility',
  inputs: [{ id: 'input', kind: 'any', label: 'Input' }],
  outputs: [{ id: 'output', kind: 'any', label: 'Output' }],
  params: {
    scale: {
      type: 'enum',
      label: 'Scale Factor',
      options: [
        { value: '2', label: '2x Super-Res' },
        { value: '4', label: '4x Super-Res' },
      ],
      default: '2',
    },
    tileSize: { type: 'number', min: 128, max: 1024, step: 128, label: 'Tile Size', default: 512 },
  },
  defaults: {
    scale: 2,
    tileSize: 512,
  },
  description: '2x and 4x neural/bilinear super-resolution upscaling',
  color: '#a855f7',
  gpu: {
    shaderId: 'upscale',
  },
  cpuRef: (ctx, inputs, params) => {
    const inBuf = inputs.input || ctx.getInputBuffer();
    if (!inBuf) return null;
    if (params.isBypassed) return inBuf;

    const scale = (params.scale === 4 ? 4 : 2) as 2 | 4;
    return PixelEngine.resizeBuffer(inBuf, inBuf.width * scale, inBuf.height * scale, 'stretch');
  },
  body: UpscaleNode,
});

export default resizeDef;
