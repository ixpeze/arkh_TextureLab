import React from 'react';
import type { NodeProps } from '@xyflow/react';
import { RotateCcw } from 'lucide-react';
import { NodeCard } from '../node-system/NodeCard';
import { NodeDualSocket } from '../node-system/NodeSocket';
import { NodeBadge } from '../node-system/NodeControls';

export const InvertNode: React.FC<NodeProps<any>> = ({ selected }) => {
  return (
    <NodeCard
      selected={selected}
      title="Invert (1 - x)"
      icon={<RotateCcw size={11} />}
      accentColor="var(--pbr-ao)"
      headerAction={<NodeBadge color="var(--pbr-ao)">MATH</NodeBadge>}
      width={160}
    >
      <NodeDualSocket
        input={{ id: 'input', label: 'In', color: 'var(--pbr-rough)' }}
        output={{ id: 'output', label: 'Out', color: 'var(--pbr-rough)' }}
        centerLabel="Gloss ⇄ Rough"
      />
    </NodeCard>
  );
};
