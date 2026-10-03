import React from 'react';
import type { NodeProps } from '@xyflow/react';
import { Layers } from 'lucide-react';
import { NodeCard } from '../node-system/NodeCard';
import { NodeSocket, NodeSocketGroup } from '../node-system/NodeSocket';
import { NodeBadge, NodeDivider } from '../node-system/NodeControls';

export interface TextureInputData {
  title: string;
  role: string;
  roleColor: string;
  res: string;
  previewUrl: string;
  isPinned?: boolean;
  onPinToggle?: () => void;
  channels: {
    r: string;
    g: string;
    b: string;
    a: string;
  };
}

export const TextureInputNode: React.FC<NodeProps<any>> = ({ data, selected }) => {
  const d = data as TextureInputData;

  const headerAction = (
    <NodeBadge color={d.roleColor || '#38bdf8'}>
      {d.res || '4K'}
    </NodeBadge>
  );

  return (
    <NodeCard
      selected={selected}
      title={d.title || 'Texture Input'}
      icon={<Layers size={11} />}
      accentColor={d.roleColor || '#38bdf8'}
      headerAction={headerAction}
      width={172}
    >
      {/* Thumbnail & Meta Section */}
      <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
        <div
          style={{
            width: 28,
            height: 28,
            borderRadius: 4,
            border: '1px solid var(--border-subtle)',
            backgroundColor: '#0a0c12',
            overflow: 'hidden',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
            boxShadow: 'inset 0 0 6px rgba(0, 0, 0, 0.6)',
          }}
        >
          {d.previewUrl ? (
            <img
              src={d.previewUrl}
              alt={d.title}
              style={{ width: '100%', height: '100%', objectFit: 'cover' }}
            />
          ) : (
            <Layers size={14} color="#64748b" />
          )}
        </div>

        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0 }}>
          <span
            style={{
              fontSize: 9.5,
              color: '#f8fafc',
              fontWeight: 600,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {d.role || 'Custom Map'}
          </span>
        </div>
      </div>

      <NodeDivider />

      {/* Output Sockets with Full-Width Horizontal Section Connections */}
      <NodeSocketGroup>
        <NodeSocket
          id="rgba"
          type="source"
          label="RGBA"
          color="var(--pbr-packed)"
          shape="diamond"
        />
        <NodeSocket
          id="r"
          type="source"
          label={d.channels?.r ? `R: ${d.channels.r.slice(0, 6)}` : 'R: AO'}
          color="var(--pbr-ao)"
        />
        <NodeSocket
          id="g"
          type="source"
          label={d.channels?.g ? `G: ${d.channels.g.slice(0, 6)}` : 'G: Rough'}
          color="var(--pbr-rough)"
        />
        <NodeSocket
          id="b"
          type="source"
          label={d.channels?.b ? `B: ${d.channels.b.slice(0, 6)}` : 'B: Metal'}
          color="var(--pbr-metal)"
        />
        <NodeSocket
          id="a"
          type="source"
          label={d.channels?.a ? `A: ${d.channels.a.slice(0, 6)}` : 'A: Height'}
          color="var(--pbr-height)"
        />
      </NodeSocketGroup>
    </NodeCard>
  );
};
