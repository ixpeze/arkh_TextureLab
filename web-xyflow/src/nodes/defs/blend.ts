import { defineNode, type NodeDef } from '../registry';
import { PixelEngine } from '../../engine/pixelEngine';
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
  cpuRef: (ctx, inputs, params) => {
    const bufA = inputs.a || ctx.getInputBuffer('a');
    const bufB = inputs.b || ctx.getInputBuffer('b');
    const bufMask = inputs.mask || ctx.getInputBuffer('mask');

    if (bufA && bufB) {
      const safeOpacity =
        typeof params.opacity === 'number' && !isNaN(params.opacity)
          ? Math.max(0, Math.min(1.0, params.opacity))
          : 1.0;
      return params.isBypassed
        ? bufA
        : PixelEngine.blendBuffers(
            bufA,
            bufB,
            bufMask || undefined,
            (params.mode as 'add' | 'multiply' | 'overlay' | 'screen' | 'min' | 'max' | 'lerp') || 'lerp',
            safeOpacity
          );
    } else if (bufA) {
      return bufA;
    } else if (bufB) {
      return bufB;
    }
    return null;
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
  cpuRef: (ctx, inputs, params) => {
    const bufBase = inputs.base || ctx.getInputBuffer('base');
    const bufDetail = inputs.detail || ctx.getInputBuffer('detail');

    if (bufBase && bufDetail) {
      const safeStrength =
        typeof params.detailStrength === 'number' && !isNaN(params.detailStrength)
          ? Math.max(0, Math.min(5.0, params.detailStrength))
          : 1.0;
      return params.isBypassed
        ? bufBase
        : PixelEngine.blendNormalRNM(bufBase, bufDetail, safeStrength);
    } else if (bufBase) {
      return bufBase;
    }
    return null;
  },
  body: NormalBlendNode,
});

export default blendDef;
