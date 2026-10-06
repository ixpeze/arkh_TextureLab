import { defineNode, type NodeDef } from '../registry';
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
  body: LevelsNode,
});

export default levelsDef;
