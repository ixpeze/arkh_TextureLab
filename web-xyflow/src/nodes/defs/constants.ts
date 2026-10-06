import { defineNode, type NodeDef } from '../registry';
import { ConstantColorNode } from '../../components/nodes/ConstantColorNode';
import { ConstantScalarNode } from '../../components/nodes/ConstantScalarNode';

export interface ConstantColorParams {
  color?: string;
  [key: string]: unknown;
}

export interface ConstantScalarParams {
  value?: number;
  [key: string]: unknown;
}

export const constantColorDef: NodeDef<ConstantColorParams> = defineNode<ConstantColorParams>({
  type: 'constantColor',
  label: 'Constant Color',
  category: 'Input',
  hotkey: '3',
  legacyAliases: ['color'],
  inputs: [],
  outputs: [
    { id: 'rgba', kind: 'color', label: 'Color (RGBA)' },
    { id: 'r', kind: 'scalar', label: 'R' },
    { id: 'g', kind: 'scalar', label: 'G' },
    { id: 'b', kind: 'scalar', label: 'B' },
    { id: 'a', kind: 'scalar', label: 'A' },
  ],
  params: {
    color: { type: 'color', label: 'Color', default: '#ffffff' },
  },
  defaults: {
    color: '#ffffff',
  },
  description: 'Constant solid RGB/RGBA color generator',
  color: 'var(--pbr-albedo)',
  gpu: {
    shaderId: 'constant_color',
    uniforms: { color: 'u_color' },
  },
  body: ConstantColorNode,
});

export const constantScalarDef: NodeDef<ConstantScalarParams> = defineNode<ConstantScalarParams>({
  type: 'constantScalar',
  label: 'Constant Scalar',
  category: 'Input',
  hotkey: '1',
  inputs: [],
  outputs: [{ id: 'value', kind: 'scalar', label: 'Scalar' }],
  params: {
    value: { type: 'number', min: 0, max: 1, step: 0.01, label: 'Value', default: 1.0 },
  },
  defaults: {
    value: 1.0,
  },
  description: 'Constant floating-point scalar value in range [0, 1]',
  color: '#e2e8f0',
  gpu: {
    shaderId: 'constant_scalar',
    uniforms: { value: 'u_value' },
  },
  body: ConstantScalarNode,
});

export default constantColorDef;
