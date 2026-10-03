import React, { useState } from 'react';
import type { NodeProps } from '@xyflow/react';
import { RotateCcw } from 'lucide-react';
import { NodeCard } from '../node-system/NodeCard';
import { NodeDualSocket } from '../node-system/NodeSocket';
import { NodeBadge, NodeDivider } from '../node-system/NodeControls';

export interface InvertNodeData {
  title?: string;
  isBypassed?: boolean;
  onToggleBypass?: () => void;
}

export const InvertNode: React.FC<NodeProps<any>> = ({ data, selected }) => {
  const d = (data as InvertNodeData) || {};
  const [isBypassed, setIsBypassed] = useState(d.isBypassed ?? false);

  const handleToggleBypass = () => {
    const next = !isBypassed;
    setIsBypassed(next);
    d.onToggleBypass?.();
  };

  return (
    <NodeCard
      selected={selected}
      title={d.title || 'Invert (1 - x)'}
      icon={<RotateCcw size={11} />}
      accentColor="var(--pbr-ao)"
      headerAction={<NodeBadge color="var(--pbr-ao)">MATH</NodeBadge>}
      isBypassed={isBypassed}
      onToggleBypass={handleToggleBypass}
      width={168}
    >
      <NodeDualSocket
        input={{ id: 'input', label: 'In', color: 'var(--pbr-rough)' }}
        output={{ id: 'output', label: 'Out', color: 'var(--pbr-rough)' }}
        centerLabel="Gloss ⇄ Rough"
      />

      <NodeDivider />

      {/* Mini Inversion Graphic */}
      <div
        style={{
          width: '100%',
          height: 22,
          backgroundColor: '#0c0e14',
          borderRadius: 3,
          border: '1px solid rgba(255, 255, 255, 0.05)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '0 6px',
        }}
      >
        <svg width="140" height="18" style={{ display: 'block' }}>
          <line x1="10" y1="15" x2="130" y2="3" stroke="var(--pbr-ao)" strokeWidth="1.5" strokeDasharray="3 2" />
          <circle cx="10" cy="15" r="2.5" fill="var(--pbr-rough)" />
          <circle cx="130" cy="3" r="2.5" fill="var(--pbr-ao)" />
        </svg>
      </div>
    </NodeCard>
  );
};
