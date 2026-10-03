import React from 'react';
import type { NodeProps } from '@xyflow/react';
import { FoldHorizontal } from 'lucide-react';
import { NodeCard } from '../node-system/NodeCard';
import { NodeSocket, NodeSocketGroup } from '../node-system/NodeSocket';
import { NodeBadge, NodeDivider } from '../node-system/NodeControls';

export interface ChannelCombinerData {
  title?: string;
  isBypassed?: boolean;
}

export const ChannelCombinerNode: React.FC<NodeProps<any>> = ({ data, selected }) => {
  const d = (data as ChannelCombinerData) || {};
  const isBypassed = !!d.isBypassed;

  return (
    <NodeCard
      selected={selected}
      title="Channel Combiner"
      icon={<FoldHorizontal size={11} />}
      accentColor="var(--pbr-packed)"
      headerAction={<NodeBadge color="var(--pbr-packed)">ORMH</NodeBadge>}
      isBypassed={isBypassed}
      width={172}
    >

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
