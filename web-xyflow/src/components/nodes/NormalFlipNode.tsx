import React, { useState } from 'react';
import type { NodeProps } from '@xyflow/react';
import { ArrowUpDown } from 'lucide-react';
import { NodeCard } from '../node-system/NodeCard';
import { NodeDualSocket } from '../node-system/NodeSocket';
import { NodeSelect, NodeBadge, NodeDivider } from '../node-system/NodeControls';

export interface NormalFlipNodeData {
  title?: string;
  mode?: 'dx_to_gl' | 'gl_to_dx';
  isBypassed?: boolean;
  onToggleBypass?: () => void;
  onChange?: (mode: 'dx_to_gl' | 'gl_to_dx') => void;
}

export const NormalFlipNode: React.FC<NodeProps<any>> = ({ data, selected }) => {
  const d = (data as NormalFlipNodeData) || {};
  const [mode, setMode] = useState<'dx_to_gl' | 'gl_to_dx'>(d.mode || 'dx_to_gl');
  const [isBypassed, setIsBypassed] = useState(d.isBypassed ?? false);

  const handleModeChange = (val: string) => {
    const newMode = val as 'dx_to_gl' | 'gl_to_dx';
    setMode(newMode);
    d.onChange?.(newMode);
  };

  const handleToggleBypass = () => {
    const next = !isBypassed;
    setIsBypassed(next);
    d.onToggleBypass?.();
  };

  const isGlTarget = mode === 'dx_to_gl';

  return (
    <NodeCard
      selected={selected}
      title={d.title || 'Normal Green Flip'}
      icon={<ArrowUpDown size={11} />}
      accentColor="var(--pbr-normal)"
      headerAction={<NodeBadge color="var(--pbr-normal)">NORMAL</NodeBadge>}
      isBypassed={isBypassed}
      onToggleBypass={handleToggleBypass}
      width={172}
    >
      {/* Sockets Row with Dual Horizontal Hit-Zones */}
      <NodeDualSocket
        input={{ id: 'input', label: 'In', color: 'var(--pbr-normal)', shape: 'diamond' }}
        output={{ id: 'output', label: 'Out', color: 'var(--pbr-normal)', shape: 'diamond' }}
        centerLabel="Flip G"
      />

      <NodeDivider />

      {/* Mini Normal Orientation Visualizer */}
      <div
        style={{
          width: '100%',
          height: 28,
          backgroundColor: '#0c0e14',
          borderRadius: 4,
          border: '1px solid rgba(255, 255, 255, 0.06)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0 8px',
          fontSize: 8.5,
          fontFamily: "'Geist Mono', monospace",
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <span style={{ color: '#94a3b8' }}>IN:</span>
          <span style={{ color: isGlTarget ? '#f87171' : '#4ade80' }}>
            {isGlTarget ? 'DX (-Y)' : 'GL (+Y)'}
          </span>
        </div>

        <div style={{ color: 'var(--pbr-normal)', fontWeight: 700 }}>➔</div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <span style={{ color: '#94a3b8' }}>OUT:</span>
          <span style={{ color: isGlTarget ? '#4ade80' : '#f87171', fontWeight: 700 }}>
            {isGlTarget ? 'GL (+Y)' : 'DX (-Y)'}
          </span>
        </div>
      </div>

      <NodeDivider />

      {/* Mode Dropdown Selector */}
      <NodeSelect
        label="Format Conversion"
        value={mode}
        options={[
          { label: 'DirectX (-Y) → OpenGL (+Y)', value: 'dx_to_gl' },
          { label: 'OpenGL (+Y) → DirectX (-Y)', value: 'gl_to_dx' },
        ]}
        onChange={handleModeChange}
      />
    </NodeCard>
  );
};
