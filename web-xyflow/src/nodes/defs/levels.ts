import { defineNode, type NodeDef } from '../registry';
import { PixelEngine } from '../../engine/pixelEngine';
import { LevelsNode } from '../../components/nodes/LevelsNode';

export interface LevelsParams {
  blackPoint?: number;
  gamma?: number;
  whitePoint?: number;
  outBlack?: number;
  outWhite?: number;
  channel?: 'all' | 'r' | 'g' | 'b' | 'a';
  isBypassed?: boolean;
  [key: string]: unknown;
}

export const levelsDef: NodeDef<LevelsParams> = defineNode<LevelsParams>({
  type: 'levels',
  label: 'Levels',
  category: 'Adjust',
  hotkey: 'l',
  inputs: [{ id: 'input', kind: 'any', label: 'Input' }],
  outputs: [{ id: 'output', kind: 'any', label: 'Output' }],
  params: {
    blackPoint: { type: 'number', min: 0, max: 255, step: 1, label: 'In Black', default: 0 },
    gamma: { type: 'number', min: 0.01, max: 5.0, step: 0.01, label: 'Gamma', default: 1.0 },
    whitePoint: { type: 'number', min: 0, max: 255, step: 1, label: 'In White', default: 255 },
    outBlack: { type: 'number', min: 0, max: 255, step: 1, label: 'Out Black', default: 0 },
    outWhite: { type: 'number', min: 0, max: 255, step: 1, label: 'Out White', default: 255 },
    channel: {
      type: 'enum',
      label: 'Channel',
      options: [
        { value: 'all', label: 'RGB Combined' },
        { value: 'r', label: 'Red' },
        { value: 'g', label: 'Green' },
        { value: 'b', label: 'Blue' },
        { value: 'a', label: 'Alpha' },
      ],
      default: 'all',
    },
  },
  defaults: {
    blackPoint: 0,
    gamma: 1.0,
    whitePoint: 255,
    outBlack: 0,
    outWhite: 255,
    channel: 'all',
  },
  description: 'Histogram remap: black point, midtone gamma, white point, and output scaling',
  color: '#22c55e',
  gpu: {
    shaderId: 'levels',
  },
  cpuRef: (ctx, inputs, params) => {
    const inBuf = inputs.input || ctx.getInputBuffer();
    if (!inBuf) return null;
    if (params.isBypassed) return inBuf;

    const ch = (params.channel as 'all' | 'r' | 'g' | 'b' | 'a') || 'all';
    const bp =
      typeof params.blackPoint === 'number' && !isNaN(params.blackPoint)
        ? Math.max(0, Math.min(255, params.blackPoint))
        : 0;
    const wp =
      typeof params.whitePoint === 'number' && !isNaN(params.whitePoint)
        ? Math.max(0, Math.min(255, params.whitePoint))
        : 255;
    const gm =
      typeof params.gamma === 'number' && !isNaN(params.gamma)
        ? Math.max(0.01, Math.min(5.0, params.gamma))
        : 1.0;
    const ob =
      typeof params.outBlack === 'number' && !isNaN(params.outBlack)
        ? Math.max(0, Math.min(255, params.outBlack))
        : 0;
    const ow =
      typeof params.outWhite === 'number' && !isNaN(params.outWhite)
        ? Math.max(0, Math.min(255, params.outWhite))
        : 255;

    return PixelEngine.applyLevelsChannel(inBuf, ch, bp, gm, wp, ob, ow);
  },
  body: LevelsNode,
});

export default levelsDef;
