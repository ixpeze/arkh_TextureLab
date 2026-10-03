import React from 'react';
import type { NodeProps } from '@xyflow/react';
import { UnfoldHorizontal } from 'lucide-react';
import { NodeCard } from '../node-system/NodeCard';
import { NodeSocket, NodeSocketGroup } from '../node-system/NodeSocket';
import { NodeBadge, NodeDivider } from '../node-system/NodeControls';

export interface ChannelSplitterData {
  title?: string;
  labels?: { r?: string; g?: string; b?: string; a?: string };
  isLivePreview?: boolean;
}

export const ChannelSplitterNode: React.FC<NodeProps<any>> = ({ data, selected }) => {
  const d = (data as ChannelSplitterData) || {};
  const isPreview = !!d.isLivePreview;
  const labels = d.labels || { r: 'Red / AO', g: 'Green / Rough', b: 'Blue / Metal', a: 'Alpha / Height' };

  return (
    <NodeCard
      selected={selected}
      title={d.title || 'Channel Splitter'}
      icon={<UnfoldHorizontal size={11} />}
      accentColor="var(--pbr-packed)"
      headerAction={
        isPreview ? (
          <NodeBadge color="#22d3ee">PREVIEW</NodeBadge>
        ) : (
          <NodeBadge color="var(--pbr-packed)">UNPACK</NodeBadge>
        )
      }
      width={172}
    >
      {/* Composite Input on Left with Dedicated Horizontal Section */}
      <NodeSocket
        isSection
        id="rgba"
        type="target"
        label="RGBA Input Stream"
        color="var(--pbr-packed)"
        shape="diamond"
        sectionTag="STREAM"
      />

      <NodeDivider />

      {/* 4 Output Channels on Right (Full-Width Sections) */}
      <NodeSocketGroup>
        <NodeSocket
          id="r"
          type="source"
          label={labels.r || 'R: AO'}
          color="var(--pbr-ao)"
        />
        <NodeSocket
          id="g"
          type="source"
          label={labels.g || 'G: Rough'}
          color="var(--pbr-rough)"
        />
        <NodeSocket
          id="b"
          type="source"
          label={labels.b || 'B: Metal'}
          color="var(--pbr-metal)"
        />
        <NodeSocket
          id="a"
          type="source"
          label={labels.a || 'A: Height'}
          color="var(--pbr-height)"
        />
      </NodeSocketGroup>
    </NodeCard>
  );
};
