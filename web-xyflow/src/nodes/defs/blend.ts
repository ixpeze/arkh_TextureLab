import { defineNode, type NodeDef } from '../registry';
import { BlendNode } from '../../components/nodes/BlendNode';
import { NormalBlendNode } from '../../components/nodes/NormalBlendNode';

export type BlendMode = 'lerp' | 'add' | 'multiply' | 'screen' | 'overlay' | 'min' | 'max';

export interface BlendParams {
  mode?: BlendMode;
  opacity?: number;
  isBypassed?: boolean;
  [key: string]: unknown;
}

export interface NormalBlendParams {
  detailStrength?: number;
  isBypassed?: boolean;
  [key: string]: unknown;
}

export const blendDef: NodeDef<BlendParams> = defineNode<BlendParams>({
  type: 'blend',
  label: 'Texture Blend',
  category: 'Blend',
  hotkey: 'b',
  inputs: [
    { id: 'a', kind: 'color', label: 'Base (A)' },
    { id: 'b', kind: 'color', label: 'Blend (B)' },
    { id: 'mask', kind: 'scalar', label: 'Mask (Alpha)' },
  ],
  outputs: [{ id: 'output', kind: 'color', label: 'Result' }],
  params: {
    mode: {
      type: 'enum',
      label: 'Blend Mode',
      options: [
        { value: 'lerp', label: 'Normal (Lerp)' },
        { value: 'add', label: 'Add' },
        { value: 'subtract', label: 'Subtract' },
        { value: 'multiply', label: 'Multiply' },
        { value: 'screen', label: 'Screen' },
        { value: 'overlay', label: 'Overlay' },
      ],
      default: 'lerp',
    },
    opacity: { type: 'number', min: 0, max: 1.0, step: 0.05, label: 'Opacity', default: 1.0 },
  },
  defaults: {
    mode: 'lerp',
    opacity: 1.0,
  },
  description: 'Multi-layer blending with optional mask and opacity',
  color: '#f59e0b',
  gpu: {
    shaderId: 'blend',
  },
  body: BlendNode,
});

export const normalBlendDef: NodeDef<NormalBlendParams> = defineNode<NormalBlendParams>({
  type: 'normalBlend',
  label: 'Normal Blend (RNM)',
  category: 'Blend',
  inputs: [
    { id: 'base', kind: 'color', label: 'Base Normal' },
    { id: 'detail', kind: 'color', label: 'Detail Normal' },
  ],
  outputs: [{ id: 'output', kind: 'color', label: 'Blended Normal' }],
  params: {
    detailStrength: {
      type: 'number',
      min: 0,
      max: 5.0,
      step: 0.1,
      label: 'Detail Strength',
      default: 1.0,
    },
  },
  defaults: {
    detailStrength: 1.0,
  },
  description: 'Reoriented Normal Mapping (RNM) for mathematically correct tangent normal combination',
  color: '#06b6d4',
  gpu: {
    shaderId: 'normal_blend_rnm',
  },
  body: NormalBlendNode,
});

export default blendDef;
