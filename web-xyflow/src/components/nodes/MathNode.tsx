import React, { useState, useEffect } from 'react';
import type { NodeProps } from '@xyflow/react';
import { Calculator } from 'lucide-react';
import { NodeCard } from '../node-system/NodeCard';
import { NodeSocket } from '../node-system/NodeSocket';
import { NodeBadge, NodeDivider } from '../node-system/NodeControls';
import { useNodeBuffers } from '../../context/NodeBufferContext';
import { nodeRegistry } from '../../nodes/registry';

export type MathOpType =
  | 'lerp'
  | 'multiply'
  | 'add'
  | 'subtract'
  | 'divide'
  | 'clamp'
  | 'saturate'
  | 'power'
  | 'oneMinus'
  | 'min'
  | 'max'
  | 'abs';

export interface MathNodeData {
  title?: string;
  op?: MathOpType;
  valA?: number;
  valB?: number;
  param1?: number; // alpha for lerp, min for clamp, exp for power
  param2?: number; // max for clamp
  isBypassed?: boolean;
}

const OP_CONFIGS: Record<
  MathOpType,
  {
    label: string;
    badge: string;
    color: string;
    hasB: boolean;
    hasAlpha?: boolean;
    param1Label?: string;
    param1Def?: number;
    param2Label?: string;
    param2Def?: number;
    defA: number;
    defB: number;
  }
> = {
  lerp: { label: 'Linear Interpolate', badge: 'LERP', color: '#38bdf8', hasB: true, hasAlpha: true, param1Label: 'Alpha', param1Def: 0.5, defA: 0.0, defB: 1.0 },
  multiply: { label: 'Multiply', badge: 'MUL', color: '#22c55e', hasB: true, defA: 1.0, defB: 1.0 },
  add: { label: 'Add', badge: 'ADD', color: '#eab308', hasB: true, defA: 0.0, defB: 0.0 },
  subtract: { label: 'Subtract', badge: 'SUB', color: '#f97316', hasB: true, defA: 0.0, defB: 0.0 },
  divide: { label: 'Divide', badge: 'DIV', color: '#ef4444', hasB: true, defA: 1.0, defB: 1.0 },
  clamp: { label: 'Clamp', badge: 'CLAMP', color: '#818cf8', hasB: false, param1Label: 'Min', param1Def: 0.0, param2Label: 'Max', param2Def: 1.0, defA: 0.0, defB: 1.0 },
  saturate: { label: 'Saturate [0..1]', badge: 'SAT', color: '#06b6d4', hasB: false, defA: 0.0, defB: 1.0 },
  power: { label: 'Power', badge: 'POW', color: '#a855f7', hasB: false, param1Label: 'Exp', param1Def: 2.0, defA: 1.0, defB: 1.0 },
  oneMinus: { label: 'One Minus (1 - X)', badge: '1 - X', color: '#ec4899', hasB: false, defA: 0.0, defB: 1.0 },
  min: { label: 'Min', badge: 'MIN', color: '#14b8a6', hasB: true, defA: 0.0, defB: 0.0 },
  max: { label: 'Max', badge: 'MAX', color: '#f59e0b', hasB: true, defA: 0.0, defB: 0.0 },
  abs: { label: 'Absolute', badge: 'ABS', color: '#6366f1', hasB: false, defA: 0.0, defB: 0.0 },
};

export const MathNode: React.FC<NodeProps> = ({ id, data, selected, type }) => {
  const d = (data as MathNodeData) || {};
  const isBypassed = !!d.isBypassed;
  const { onUpdateNodeData } = useNodeBuffers();

  // Infer op from canonical node type or data.op
  const canonicalType = nodeRegistry.resolveCanonicalType(type || '');
  const currentOp: MathOpType = (
    canonicalType && canonicalType !== 'math' ? canonicalType : d.op || 'multiply'
  ) as MathOpType;

  const cfg = OP_CONFIGS[currentOp] || OP_CONFIGS.multiply;

  const [valA, setValA] = useState<number>(d.valA ?? cfg.defA);
  const [valB, setValB] = useState<number>(d.valB ?? cfg.defB);
  const [param1, setParam1] = useState<number>(d.param1 ?? cfg.param1Def ?? 0.5);
  const [param2, setParam2] = useState<number>(d.param2 ?? cfg.param2Def ?? 1.0);

  useEffect(() => {
    if (d.valA !== undefined) setValA(d.valA);
  }, [d.valA]);
  useEffect(() => {
    if (d.valB !== undefined) setValB(d.valB);
  }, [d.valB]);
  useEffect(() => {
    if (d.param1 !== undefined) setParam1(d.param1);
  }, [d.param1]);
  useEffect(() => {
    if (d.param2 !== undefined) setParam2(d.param2);
  }, [d.param2]);

  const updateParam = (key: string, val: number) => {
    onUpdateNodeData(id, { [key]: val });
  };

  return (
    <NodeCard
      selected={selected}
      title={d.title || (canonicalType === 'math' ? `Math (${cfg.label})` : cfg.label)}
      icon={<Calculator size={11} />}
      accentColor={cfg.color}
      headerAction={<NodeBadge color={cfg.color}>{cfg.badge}</NodeBadge>}
      isBypassed={isBypassed}
      width={170}
    >
      {/* Dynamic Op Selector for generic Math node */}
      {canonicalType === 'math' && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '1px 6px', marginBottom: 3 }}>
          <span style={{ fontSize: 7.5, color: '#94a3b8' }}>Op</span>
          <select
            value={currentOp}
            onChange={(e) => {
              onUpdateNodeData(id, { op: e.target.value as MathOpType });
            }}
            className="nodrag nopan"
            style={{
              background: '#0a0d14',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              color: '#f8fafc',
              fontSize: 7.5,
              padding: '1px 2px',
              borderRadius: 2,
            }}
          >
            {Object.entries(OP_CONFIGS).map(([k, c]) => (
              <option key={k} value={k}>
                {c.label}
              </option>
            ))}
          </select>
        </div>
      )}
      {/* Input A Socket with inline scalar fallback */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingRight: 6 }}>
        <NodeSocket
          id="a"
          type="target"
          label={currentOp === 'power' ? 'Base' : 'A'}
          color="#ffffff"
          shape="circle"
        />
        <input
          type="number"
          step="0.1"
          value={valA}
          onChange={(e) => {
            const v = parseFloat(e.target.value) || 0;
            setValA(v);
            updateParam('valA', v);
          }}
          className="nodrag nopan"
          style={{
            width: 36,
            background: '#0a0d14',
            border: '1px solid rgba(255, 255, 255, 0.1)',
            color: '#f8fafc',
            fontSize: 7.5,
            padding: '1px 2px',
            borderRadius: 2,
            textAlign: 'right',
          }}
          title="Default scalar if unconnected"
        />
      </div>

      {/* Input B Socket (for binary ops) */}
      {cfg.hasB && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingRight: 6, marginTop: 2 }}>
          <NodeSocket
            id="b"
            type="target"
            label="B"
            color="#ffffff"
            shape="circle"
          />
          <input
            type="number"
            step="0.1"
            value={valB}
            onChange={(e) => {
              const v = parseFloat(e.target.value) || 0;
              setValB(v);
              updateParam('valB', v);
            }}
            className="nodrag nopan"
            style={{
              width: 36,
              background: '#0a0d14',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              color: '#f8fafc',
              fontSize: 7.5,
              padding: '1px 2px',
              borderRadius: 2,
              textAlign: 'right',
            }}
            title="Default scalar if unconnected"
          />
        </div>
      )}

      {/* Alpha Socket for Lerp */}
      {cfg.hasAlpha && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingRight: 6, marginTop: 2 }}>
          <NodeSocket
            id="alpha"
            type="target"
            label="Alpha"
            color="#94a3b8"
            shape="circle"
          />
          <input
            type="number"
            min="0"
            max="1"
            step="0.05"
            value={param1}
            onChange={(e) => {
              const v = parseFloat(e.target.value) || 0;
              setParam1(v);
              updateParam('param1', v);
            }}
            className="nodrag nopan"
            style={{
              width: 36,
              background: '#0a0d14',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              color: '#38bdf8',
              fontSize: 7.5,
              padding: '1px 2px',
              borderRadius: 2,
              textAlign: 'right',
            }}
            title="Lerp factor [0..1]"
          />
        </div>
      )}

      {/* Param1 for Clamp or Power */}
      {!cfg.hasAlpha && cfg.param1Label && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '1px 6px', marginTop: 2 }}>
          <span style={{ fontSize: 7.5, color: '#94a3b8' }}>{cfg.param1Label}</span>
          <input
            type="number"
            step="0.1"
            value={param1}
            onChange={(e) => {
              const v = parseFloat(e.target.value) || 0;
              setParam1(v);
              updateParam('param1', v);
            }}
            className="nodrag nopan"
            style={{
              width: 44,
              background: '#0a0d14',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              color: '#f8fafc',
              fontSize: 7.5,
              padding: '1px 2px',
              borderRadius: 2,
              textAlign: 'right',
            }}
          />
        </div>
      )}

      {/* Param2 for Clamp */}
      {cfg.param2Label && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '1px 6px', marginTop: 1 }}>
          <span style={{ fontSize: 7.5, color: '#94a3b8' }}>{cfg.param2Label}</span>
          <input
            type="number"
            step="0.1"
            value={param2}
            onChange={(e) => {
              const v = parseFloat(e.target.value) || 0;
              setParam2(v);
              updateParam('param2', v);
            }}
            className="nodrag nopan"
            style={{
              width: 44,
              background: '#0a0d14',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              color: '#f8fafc',
              fontSize: 7.5,
              padding: '1px 2px',
              borderRadius: 2,
              textAlign: 'right',
            }}
          />
        </div>
      )}

      <NodeDivider />

      {/* Output Socket */}
      <NodeSocket
        id="output"
        type="source"
        label="Result"
        color="#ffffff"
        shape="circle"
      />
    </NodeCard>
  );
};

// Aliases for individual composable node registration
export const LerpNode = (props: NodeProps) => <MathNode {...props} type="lerp" />;
export const MultiplyNode = (props: NodeProps) => <MathNode {...props} type="multiply" />;
export const AddNode = (props: NodeProps) => <MathNode {...props} type="add" />;
export const SubtractNode = (props: NodeProps) => <MathNode {...props} type="subtract" />;
export const DivideNode = (props: NodeProps) => <MathNode {...props} type="divide" />;
export const ClampNode = (props: NodeProps) => <MathNode {...props} type="clamp" />;
export const SaturateNode = (props: NodeProps) => <MathNode {...props} type="saturate" />;
export const PowerNode = (props: NodeProps) => <MathNode {...props} type="power" />;
export const OneMinusNode = (props: NodeProps) => <MathNode {...props} type="oneMinus" />;
export const MinNode = (props: NodeProps) => <MathNode {...props} type="min" />;
export const MaxNode = (props: NodeProps) => <MathNode {...props} type="max" />;
export const AbsNode = (props: NodeProps) => <MathNode {...props} type="abs" />;
