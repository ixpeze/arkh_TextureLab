import React, { useState } from 'react';
import type { NodeProps } from '@xyflow/react';
import { FoldHorizontal } from 'lucide-react';
import { NodeCard } from '../node-system/NodeCard';
import { NodeSocket, NodeSocketGroup } from '../node-system/NodeSocket';
import { NodeBadge, NodeDivider } from '../node-system/NodeControls';

export interface ChannelCombinerData {
  title?: string;
  isBypassed?: boolean;
  onToggleBypass?: () => void;
}

export const ChannelCombinerNode: React.FC<NodeProps<any>> = ({ data, selected }) => {
  const d = (data as ChannelCombinerData) || {};
  const [isBypassed, setIsBypassed] = useState(d.isBypassed ?? false);

  const handleToggleBypass = () => {
    const next = !isBypassed;
    setIsBypassed(next);
    d.onToggleBypass?.();
  };

  return (
    <NodeCard
      selected={selected}
      title="Channel Combiner"
      icon={<FoldHorizontal size={11} />}
      accentColor="var(--pbr-packed)"
      headerAction={<NodeBadge color="var(--pbr-packed)">ORMH</NodeBadge>}
      isBypassed={isBypassed}
      onToggleBypass={handleToggleBypass}
      width={172}
    >
      {/* 4-Quadrant Multiplex Telemetry Chip */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: 2,
          padding: '2px',
          backgroundColor: '#0a0c12',
          borderRadius: 4,
          border: '1px solid rgba(255, 255, 255, 0.05)',
        }}
      >
        <div style={{ backgroundColor: 'rgba(251, 113, 133, 0.12)', border: '1px solid rgba(251, 113, 133, 0.25)', borderRadius: 2, padding: '2px 4px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ fontSize: 7, color: 'var(--pbr-ao)', fontWeight: 700 }}>R</span>
          <span style={{ fontSize: 7, color: '#f8fafc' }}>AO</span>
        </div>
        <div style={{ backgroundColor: 'rgba(34, 197, 94, 0.12)', border: '1px solid rgba(34, 197, 94, 0.25)', borderRadius: 2, padding: '2px 4px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ fontSize: 7, color: 'var(--pbr-rough)', fontWeight: 700 }}>G</span>
          <span style={{ fontSize: 7, color: '#f8fafc' }}>ROUGH</span>
        </div>
        <div style={{ backgroundColor: 'rgba(56, 189, 248, 0.12)', border: '1px solid rgba(56, 189, 248, 0.25)', borderRadius: 2, padding: '2px 4px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ fontSize: 7, color: 'var(--pbr-metal)', fontWeight: 700 }}>B</span>
          <span style={{ fontSize: 7, color: '#f8fafc' }}>METAL</span>
        </div>
        <div style={{ backgroundColor: 'rgba(250, 204, 21, 0.12)', border: '1px solid rgba(250, 204, 21, 0.25)', borderRadius: 2, padding: '2px 4px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ fontSize: 7, color: 'var(--pbr-height)', fontWeight: 700 }}>A</span>
          <span style={{ fontSize: 7, color: '#f8fafc' }}>HEIGHT</span>
        </div>
      </div>

      <NodeDivider />

      {/* 4 Inputs on Left (Full-Width Sections) */}
      <NodeSocketGroup>
        <NodeSocket
          id="r"
          type="target"
          label="R: AO"
          color="var(--pbr-ao)"
        />
        <NodeSocket
          id="g"
          type="target"
          label="G: Rough"
          color="var(--pbr-rough)"
        />
        <NodeSocket
          id="b"
          type="target"
          label="B: Metal"
          color="var(--pbr-metal)"
        />
        <NodeSocket
          id="a"
          type="target"
          label="A: Height"
          color="var(--pbr-height)"
        />
      </NodeSocketGroup>

      <NodeDivider />

      {/* Output on Right (Full-Width Section) */}
      <NodeSocket
        id="rgba"
        type="source"
        label="Packed Buffer"
        color="var(--pbr-packed)"
        shape="diamond"
      />
    </NodeCard>
  );
};
