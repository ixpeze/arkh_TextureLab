import { defineNode, type NodeDef, type PortDef } from '../registry';
import { PixelEngine } from '../../engine/pixelEngine';
import {
  MathNode,
  LerpNode,
  MultiplyNode,
  AddNode,
  SubtractNode,
  DivideNode,
  ClampNode,
  SaturateNode,
  PowerNode,
  OneMinusNode,
  MinNode,
  MaxNode,
  AbsNode,
  type MathOpType,
} from '../../components/nodes/MathNode';

export interface MathParams {
  op?: MathOpType;
  valA?: number;
  valB?: number;
  a?: number;
  b?: number;
  param1?: number;
  param2?: number;
  min?: number;
  max?: number;
  exp?: number;
  alpha?: number;
  isBypassed?: boolean;
  [key: string]: unknown;
}

interface MathConfig {
  type: string;
  op: MathOpType;
  label: string;
  color: string;
  hasB: boolean;
  hasAlpha?: boolean;
  defA: number;
  defB: number;
  param1Label?: string;
  param1Def?: number;
  param2Label?: string;
  param2Def?: number;
  legacyAliases?: string[];
  body: typeof MathNode;
}

function createMathDef(cfg: MathConfig): NodeDef<MathParams> {
  const inputs: PortDef[] = [{ id: 'a', kind: 'any', label: 'Input A' }];
  if (cfg.hasB) {
    inputs.push({ id: 'b', kind: 'any', label: 'Input B' });
  }
  if (cfg.hasAlpha) {
    inputs.push({ id: 'alpha', kind: 'scalar', label: 'Alpha' });
  }

  return defineNode<MathParams>({
    type: cfg.type,
    label: cfg.label,
    category: 'Math',
    inputs,
    outputs: [{ id: 'output', kind: 'any', label: 'Result' }],
    legacyAliases: cfg.legacyAliases,
    params: {
      valA: { type: 'number', label: 'Value A', default: cfg.defA },
      ...(cfg.hasB ? { valB: { type: 'number', label: 'Value B', default: cfg.defB } } : {}),
      ...(cfg.param1Label
        ? { param1: { type: 'number', label: cfg.param1Label, default: cfg.param1Def } }
        : {}),
      ...(cfg.param2Label
        ? { param2: { type: 'number', label: cfg.param2Label, default: cfg.param2Def } }
        : {}),
    },
    defaults: {
      op: cfg.op,
      valA: cfg.defA,
      valB: cfg.defB,
      ...(cfg.param1Def !== undefined ? { param1: cfg.param1Def } : {}),
      ...(cfg.param2Def !== undefined ? { param2: cfg.param2Def } : {}),
    },
    description: `${cfg.label} mathematical operation`,
    color: cfg.color,
    gpu: {
      shaderId: 'math_op',
      uniforms: { op: cfg.op },
    },
    cpuRef: (ctx, inputs, params) => {
      const op = (cfg.type === 'math' ? params.op || 'multiply' : cfg.op) as MathOpType;
      const bufA = inputs.a || ctx.getInputBuffer('a') || ctx.getInputBuffer('base') || ctx.getInputBuffer('input') || ctx.getInputBuffer();
      const bufB = inputs.b || ctx.getInputBuffer('b') || ctx.getInputBuffer('exp');
      const bufAlpha = inputs.alpha || ctx.getInputBuffer('alpha') || ctx.getInputBuffer('mask');

      if (params.isBypassed && bufA) {
        return bufA;
      }

      const scalarA = typeof params.valA === 'number' ? params.valA : (typeof params.a === 'number' ? params.a : undefined);
      const scalarB = typeof params.valB === 'number' ? params.valB : (typeof params.b === 'number' ? params.b : undefined);
      const param1 = typeof params.param1 === 'number' ? params.param1 : (typeof params.min === 'number' ? params.min : (typeof params.exp === 'number' ? params.exp : (typeof params.alpha === 'number' ? params.alpha : undefined)));
      const param2 = typeof params.param2 === 'number' ? params.param2 : (typeof params.max === 'number' ? params.max : undefined);

      return PixelEngine.applyMath(op, bufA || null, bufB || null, bufAlpha || null, scalarA, scalarB, param1, param2);
    },
    body: cfg.body,
  });
}

export const mathDef = createMathDef({
  type: 'math',
  op: 'multiply',
  label: 'Math',
  color: '#22c55e',
  hasB: true,
  defA: 1.0,
  defB: 1.0,
  legacyAliases: ['mathOp'],
  body: MathNode,
});

export const lerpDef = createMathDef({
  type: 'lerp',
  op: 'lerp',
  label: 'Linear Interpolate',
  color: '#38bdf8',
  hasB: true,
  hasAlpha: true,
  defA: 0.0,
  defB: 1.0,
  param1Label: 'Alpha',
  param1Def: 0.5,
  legacyAliases: ['mathLerp', 'linearInterpolate'],
  body: LerpNode,
});

export const multiplyDef = createMathDef({
  type: 'multiply',
  op: 'multiply',
  label: 'Multiply',
  color: '#22c55e',
  hasB: true,
  defA: 1.0,
  defB: 1.0,
  legacyAliases: ['mathMultiply', 'mathDot', 'mathCross'],
  body: MultiplyNode,
});

export const addDef = createMathDef({
  type: 'add',
  op: 'add',
  label: 'Add',
  color: '#eab308',
  hasB: true,
  defA: 0.0,
  defB: 0.0,
  legacyAliases: ['mathAdd'],
  body: AddNode,
});

export const subtractDef = createMathDef({
  type: 'subtract',
  op: 'subtract',
  label: 'Subtract',
  color: '#f97316',
  hasB: true,
  defA: 0.0,
  defB: 0.0,
  legacyAliases: ['mathSubtract'],
  body: SubtractNode,
});

export const divideDef = createMathDef({
  type: 'divide',
  op: 'divide',
  label: 'Divide',
  color: '#ef4444',
  hasB: true,
  defA: 1.0,
  defB: 1.0,
  legacyAliases: ['mathDivide'],
  body: DivideNode,
});

export const clampDef = createMathDef({
  type: 'clamp',
  op: 'clamp',
  label: 'Clamp',
  color: '#818cf8',
  hasB: false,
  defA: 0.0,
  defB: 1.0,
  param1Label: 'Min',
  param1Def: 0.0,
  param2Label: 'Max',
  param2Def: 1.0,
  legacyAliases: ['mathClamp'],
  body: ClampNode,
});

export const saturateDef = createMathDef({
  type: 'saturate',
  op: 'saturate',
  label: 'Saturate [0..1]',
  color: '#06b6d4',
  hasB: false,
  defA: 0.0,
  defB: 1.0,
  legacyAliases: ['mathSaturate'],
  body: SaturateNode,
});

export const powerDef = createMathDef({
  type: 'power',
  op: 'power',
  label: 'Power',
  color: '#a855f7',
  hasB: false,
  defA: 1.0,
  defB: 1.0,
  param1Label: 'Exp',
  param1Def: 2.0,
  legacyAliases: ['mathPower'],
  body: PowerNode,
});

export const oneMinusDef = createMathDef({
  type: 'oneMinus',
  op: 'oneMinus',
  label: 'One Minus (1 - X)',
  color: '#ec4899',
  hasB: false,
  defA: 0.0,
  defB: 1.0,
  legacyAliases: ['mathOneMinus', 'one_minus'],
  body: OneMinusNode,
});

export const minDef = createMathDef({
  type: 'min',
  op: 'min',
  label: 'Min',
  color: '#14b8a6',
  hasB: true,
  defA: 0.0,
  defB: 0.0,
  legacyAliases: ['mathMin'],
  body: MinNode,
});

export const maxDef = createMathDef({
  type: 'max',
  op: 'max',
  label: 'Max',
  color: '#f59e0b',
  hasB: true,
  defA: 0.0,
  defB: 0.0,
  legacyAliases: ['mathMax'],
  body: MaxNode,
});

export const absDef = createMathDef({
  type: 'abs',
  op: 'abs',
  label: 'Absolute',
  color: '#6366f1',
  hasB: false,
  defA: 0.0,
  defB: 0.0,
  legacyAliases: ['mathAbs'],
  body: AbsNode,
});

export default mathDef;
