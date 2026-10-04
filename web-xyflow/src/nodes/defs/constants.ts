import { defineNode, type NodeDef } from '../registry';
import { PixelEngine } from '../../engine/pixelEngine';
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

function hexToRgb(hex: string): { r: number; g: number; b: number } {
  let clean = hex.replace('#', '');
  if (clean.length === 3) {
    clean = clean
      .split('')
      .map((c) => c + c)
      .join('');
  }
  const num = parseInt(clean, 16);
  if (isNaN(num)) {
    return { r: 255, g: 255, b: 255 };
  }
  return {
    r: (num >> 16) & 255,
    g: (num >> 8) & 255,
    b: num & 255,
  };
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
  cpuRef: (_ctx, _inputs, params) => {
    const rawHex = typeof params.color === 'string' ? params.color : '#ffffff';
    const hex = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(rawHex) ? rawHex : '#ffffff';
    const rgb = hexToRgb(hex);
    return PixelEngine.createSolid(1, 1, rgb.r, rgb.g, rgb.b, 255);
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
  cpuRef: (_ctx, _inputs, params) => {
    const rawVal = typeof params.value === 'number' && !isNaN(params.value) ? params.value : 1.0;
    const val = Math.max(0, Math.min(1, rawVal));
    const byteVal = Math.min(255, Math.max(0, Math.round(val * 255)));
    return PixelEngine.createSolid(1, 1, byteVal, byteVal, byteVal, 255);
  },
  body: ConstantScalarNode,
});

export default constantColorDef;
