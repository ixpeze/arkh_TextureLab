import React, { useState } from 'react';
import type { NodeProps } from '@xyflow/react';
import { ArrowUpDown, RefreshCw } from 'lucide-react';
import { NodeCard } from '../node-system/NodeCard';
import { NodeDualSocket } from '../node-system/NodeSocket';
import { NodeSlider, NodeBadge, NodeDivider } from '../node-system/NodeControls';

export interface NormalFlipNodeData {
  title?: string;
  mode?: 'dx_to_gl' | 'gl_to_dx';
  strength?: number;
  isBypassed?: boolean;
  onToggleBypass?: () => void;
  onChange?: (params: { mode: 'dx_to_gl' | 'gl_to_dx'; strength: number }) => void;
}

export const NormalFlipNode: React.FC<NodeProps<any>> = ({ data, selected }) => {
  const d = (data as NormalFlipNodeData) || {};
  const [mode, setMode] = useState<'dx_to_gl' | 'gl_to_dx'>(d.mode || 'dx_to_gl');
  const [strength, setStrength] = useState<number>(d.strength ?? 1.0);
  const isBypassed = !!d.isBypassed;

  const toggleMode = () => {
    const nextMode = mode === 'dx_to_gl' ? 'gl_to_dx' : 'dx_to_gl';
    setMode(nextMode);
    d.onChange?.({ mode: nextMode, strength });
  };

  const handleStrength = (val: number) => {
    setStrength(val);
    d.onChange?.({ mode, strength: val });
  };

  return (
    <NodeCard
      selected={selected}
      title={d.title || 'Normal Green Flip'}
      icon={<ArrowUpDown size={11} />}
      accentColor="var(--pbr-normal)"
      headerAction={<NodeBadge color="var(--pbr-normal)">NORMAL</NodeBadge>}
      isBypassed={isBypassed}
      width={176}
    >
      {/* Sockets Row with Dual Horizontal Hit-Zones */}
      <NodeDualSocket
        input={{ id: 'input', label: 'In', color: 'var(--pbr-normal)', shape: 'diamond' }}
        output={{ id: 'output', label: 'Out', color: 'var(--pbr-normal)', shape: 'diamond' }}
        centerLabel="Flip G"
      />

      <NodeDivider />

      {/* 1-Click Interactive Format Toggle Chip */}
      <button
        onClick={toggleMode}
        title="Click to toggle DirectX (-Y) and OpenGL (+Y)"
        style={{
          width: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          backgroundColor: '#0c0e14',
          border: '1px solid rgba(6, 182, 212, 0.25)',
          borderRadius: 4,
          padding: '4px 6px',
          cursor: 'pointer',
          transition: 'all 120ms ease',
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.borderColor = 'rgba(6, 182, 212, 0.55)';
          e.currentTarget.style.backgroundColor = 'rgba(6, 182, 212, 0.08)';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.borderColor = 'rgba(6, 182, 212, 0.25)';
          e.currentTarget.style.backgroundColor = '#0c0e14';
        }}
      >
        <span style={{ fontSize: 8.5, color: '#f8fafc', fontWeight: 600 }}>
          {mode === 'dx_to_gl' ? 'DirectX (-Y) → OpenGL' : 'OpenGL (+Y) → DirectX'}
        </span>
        <RefreshCw size={10} color="#06b6d4" />
      </button>

      <NodeDivider />

      {/* Normal Strength Scaling Slider */}
      <NodeSlider
        label="Normal Strength"
        min={0.0}
        max={2.0}
        step={0.05}
        value={strength}
        accentColor="var(--pbr-normal)"
        onChange={handleStrength}
      />
    </NodeCard>
  );
};
