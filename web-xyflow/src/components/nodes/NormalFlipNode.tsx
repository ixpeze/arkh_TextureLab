import React, { useState } from 'react';
import type { NodeProps } from '@xyflow/react';
import { ArrowUpDown } from 'lucide-react';
import { NodeCard } from '../node-system/NodeCard';
import { NodeDualSocket } from '../node-system/NodeSocket';
import { NodeSelect, NodeBadge, NodeDivider } from '../node-system/NodeControls';

export interface NormalFlipNodeData {
  title?: string;
  mode?: 'dx_to_gl' | 'gl_to_dx';
  onChange?: (mode: 'dx_to_gl' | 'gl_to_dx') => void;
}

export const NormalFlipNode: React.FC<NodeProps<any>> = ({ data, selected }) => {
  const d = (data as NormalFlipNodeData) || {};
  const [mode, setMode] = useState<'dx_to_gl' | 'gl_to_dx'>(d.mode || 'dx_to_gl');

  const handleModeChange = (val: string) => {
    const newMode = val as 'dx_to_gl' | 'gl_to_dx';
    setMode(newMode);
    d.onChange?.(newMode);
  };

  return (
    <NodeCard
      selected={selected}
      title={d.title || 'Normal Flip Green'}
      icon={<ArrowUpDown size={11} />}
      accentColor="var(--pbr-normal)"
      headerAction={<NodeBadge color="var(--pbr-normal)">NORMAL</NodeBadge>}
      width={172}
    >
      {/* Sockets Row with Dual Horizontal Hit-Zones */}
      <NodeDualSocket
        input={{ id: 'input', label: 'In', color: 'var(--pbr-normal)', shape: 'diamond' }}
        output={{ id: 'output', label: 'Out', color: 'var(--pbr-normal)', shape: 'diamond' }}
        centerLabel="Flip G"
      />

      <NodeDivider />

      {/* Mode Dropdown Selector */}
      <NodeSelect
        label="Format Conversion"
        value={mode}
        options={[
          { label: 'DX (-Y) → GL (+Y)', value: 'dx_to_gl' },
          { label: 'GL (+Y) → DX (-Y)', value: 'gl_to_dx' },
        ]}
        onChange={handleModeChange}
      />
    </NodeCard>
  );
};
