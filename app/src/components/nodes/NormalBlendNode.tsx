import React, { useState } from 'react';
import type { NodeProps } from '@xyflow/react';
import { Layers } from 'lucide-react';
import { NodeCard } from '../node-system/NodeCard';
import { NodeSocket, NodeSocketGroup } from '../node-system/NodeSocket';
import { NodeSlider, NodeBadge, NodeDivider } from '../node-system/NodeControls';

import { useNodeBuffers } from '../../context/NodeBufferContext';

export interface NormalBlendNodeData {
  title?: string;
  detailStrength?: number;
  isBypassed?: boolean;
  onToggleBypass?: () => void;
  onChange?: (params: { detailStrength: number }) => void;
}

export const NormalBlendNode: React.FC<NodeProps<any>> = ({ id, data, selected }) => {
  const d = (data as NormalBlendNodeData) || {};
  const { onUpdateNodeData } = useNodeBuffers();
  const [strength, setStrength] = useState<number>(d.detailStrength ?? 1.0);
  const isBypassed = !!d.isBypassed;

  const handleStrengthChange = (val: number) => {
    const parsed = Number(val);
    const safeStrength = Math.max(0.0, Math.min(5.0, isNaN(parsed) ? 1.0 : parsed));
    setStrength(safeStrength);
    d.onChange?.({ detailStrength: safeStrength });
    onUpdateNodeData(id, { detailStrength: safeStrength });
  };

  return (
    <NodeCard
      selected={selected}
      title={d.title || 'Normal Blend (RNM)'}
      icon={<Layers size={11} />}
      accentColor="var(--pbr-normal)"
      headerAction={<NodeBadge color="var(--pbr-normal)">RNM</NodeBadge>}
      isBypassed={isBypassed}
      width={176}
    >
      {/* Dual Inputs: Base Normal & Micro-Detail Normal */}
      <NodeSocketGroup>
        <NodeSocket
          id="base"
          type="target"
          label="Base Normal"
          color="var(--pbr-normal)"
          shape="diamond"
        />
        <NodeSocket
          id="detail"
          type="target"
          label="Detail Normal"
          color="#38bdf8"
          shape="diamond"
        />
      </NodeSocketGroup>

      <NodeDivider />

      {/* Detail Normal Strength Slider */}
      <NodeSlider
        label="Detail Intensity"
        min={0.0}
        max={2.0}
        step={0.05}
        value={strength}
        defaultValue={1.0}
        accentColor="var(--pbr-normal)"
        onChange={handleStrengthChange}
      />

      {/* Algorithm indicator */}
      <div
        style={{
          marginTop: 2,
          padding: '2px 4px',
          backgroundColor: 'rgba(6, 182, 212, 0.08)',
          borderRadius: 3,
          border: '1px solid rgba(6, 182, 212, 0.2)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}
      >
        <span style={{ fontSize: 7, color: '#06b6d4', fontWeight: 600 }}>ALGORITHM</span>
        <span style={{ fontSize: 7, color: '#94a3b8', fontFamily: 'monospace' }}>UE5 Reoriented</span>
      </div>

      <NodeDivider />

      {/* Output Normal */}
      <NodeSocket
        id="output"
        type="source"
        label="Blended Normal"
        color="var(--pbr-normal)"
        shape="diamond"
      />
    </NodeCard>
  );
};
