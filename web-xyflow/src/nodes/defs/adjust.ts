import { defineNode, type NodeDef } from '../registry';
import { PixelEngine } from '../../engine/pixelEngine';
import { InvertNode } from '../../components/nodes/InvertNode';
import { NormalFlipNode } from '../../components/nodes/NormalFlipNode';
import { NormalizeNode } from '../../components/nodes/NormalizeNode';

export interface InvertParams {
  isBypassed?: boolean;
  [key: string]: unknown;
}

export interface NormalFlipParams {
  strength?: number;
  isBypassed?: boolean;
  [key: string]: unknown;
}

export interface NormalizeParams {
  flipGreen?: boolean;
  requiresGreenFlip?: boolean;
  [key: string]: unknown;
}

export const invertDef: NodeDef<InvertParams> = defineNode<InvertParams>({
  type: 'invert',
  label: 'Invert (1 - x)',
  category: 'Adjust',
  hotkey: 'i',
  inputs: [{ id: 'input', kind: 'any', label: 'Input' }],
  outputs: [{ id: 'output', kind: 'any', label: 'Output' }],
  params: {},
  defaults: {},
  description: '1 - x inversion: e.g. Glossiness to Roughness, or inverted masks',
  color: '#fb7185',
  gpu: {
    shaderId: 'invert',
  },
  cpuRef: (ctx, inputs, params) => {
    const inBuf = inputs.input || ctx.getInputBuffer();
    if (!inBuf) return null;
    return params.isBypassed ? inBuf : PixelEngine.invertBuffer(inBuf);
  },
  body: InvertNode,
});

export const normalFlipDef: NodeDef<NormalFlipParams> = defineNode<NormalFlipParams>({
  type: 'normalFlip',
  label: 'Normal Flip Green',
  category: 'Adjust',
  hotkey: 'n',
  inputs: [{ id: 'input', kind: 'color', label: 'Normal Map' }],
  outputs: [{ id: 'output', kind: 'color', label: 'Flipped Normal' }],
  params: {
    strength: { type: 'number', min: 0, max: 2, step: 0.1, label: 'Strength', default: 1.0 },
  },
  defaults: {
    strength: 1.0,
  },
  description: 'Green channel invert for DirectX (-Y) <=> OpenGL (+Y) normal map standards',
  color: '#06b6d4',
  gpu: {
    shaderId: 'normal_flip',
  },
  cpuRef: (ctx, inputs, params) => {
    const inBuf = inputs.input || ctx.getInputBuffer();
    if (!inBuf) return null;
    return params.isBypassed ? inBuf : PixelEngine.flipGreenChannel(inBuf);
  },
  body: NormalFlipNode,
});

export const normalizeDef: NodeDef<NormalizeParams> = defineNode<NormalizeParams>({
  type: 'normalize',
  label: 'Normalize',
  category: 'Adjust',
  inputs: [{ id: 'input', kind: 'color', label: 'Input' }],
  outputs: [{ id: 'output', kind: 'color', label: 'Normalized' }],
  params: {
    flipGreen: { type: 'bool', label: 'Flip Green Channel', default: false },
  },
  defaults: {
    flipGreen: false,
  },
  description: 'Vector normalization and normal standard alignment',
  color: '#10b981',
  gpu: {
    shaderId: 'normalize',
  },
  cpuRef: (ctx, inputs, params) => {
    const inBuf = inputs.input || ctx.getInputBuffer();
    if (!inBuf) return null;
    const shouldFlipGreen = !!(params.requiresGreenFlip || params.flipGreen);
    return shouldFlipGreen ? PixelEngine.flipGreenChannel(inBuf) : inBuf;
  },
  body: NormalizeNode,
});

export default invertDef;
