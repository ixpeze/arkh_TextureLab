import React, { useState } from 'react';
import type { NodeProps } from '@xyflow/react';
import { Binary } from 'lucide-react';
import { NodeCard } from '../node-system/NodeCard';
import { NodeSocket } from '../node-system/NodeSocket';
import { NodeSlider, NodeBadge, NodeDivider } from '../node-system/NodeControls';

export const ConstantScalarNode: React.FC<NodeProps<any>> = ({ data, selected }) => {
  const [val, setVal] = useState<number>(data?.value ?? 1.0);

  return (
    <NodeCard
      selected={selected}
      title="Constant Scalar"
      icon={<Binary size={11} />}
      accentColor="var(--pbr-scalar)"
      headerAction={<NodeBadge color="var(--pbr-scalar)">1</NodeBadge>}
      width={160}
    >
      <NodeSlider
        label="Float Value"
        min={0}
        max={1}
        step={0.01}
        value={val}
        accentColor="var(--pbr-scalar)"
        onChange={setVal}
      />

      <NodeDivider />

      <NodeSocket
        id="scalar"
        type="source"
        label="Out (Float)"
        color="var(--pbr-scalar)"
      />
    </NodeCard>
  );
};
