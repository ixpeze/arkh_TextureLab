// src/nodes/ui/NodeShell.tsx
import React from 'react';
import { useViewport, type NodeProps } from '@xyflow/react';
import { NodeCard } from '../../components/node-system/NodeCard';
import { NodeSocket } from '../../components/node-system/NodeSocket';
import { nodeRegistry } from '../registry';

export interface NodeShellProps extends NodeProps {
  categoryColor?: string;
}

export const NodeShell: React.FC<NodeShellProps> = (props) => {
  const { id, type, data, selected } = props;
  const { zoom } = useViewport();
  const def = type ? nodeRegistry.get(type) : undefined;

  const title = (data?.title as string) || def?.label || type || 'Node';
  const isBypassed = Boolean(data?.isBypassed);
  const category = def?.category || 'Utility';

  // Category Color Map
  const categoryColors: Record<string, string> = {
    Input: '#5CC8E8',
    Channel: 'var(--pbr-packed)',
    Math: '#FFB02E',
    Adjust: '#6FD08C',
    Blend: '#F08A8A',
    Output: '#5CB6F0',
    Utility: '#ECE8E1',
    Labs: '#A39E94',
  };

  const accentColor = props.categoryColor || categoryColors[category] || 'var(--accent)';

  // TC-501 & TC-502 LOD: zoom thresholds
  const isBlockLod = zoom < 0.35;
  const isCompactLod = zoom < 0.6;

  return (
    <NodeCard
      selected={selected}
      title={title}
      accentColor={accentColor}
      isBypassed={isBypassed}
      nodeId={id}
    >
      {/* Target (Input) Ports */}
      {def?.inputs.map((inp) => (
        <NodeSocket
          key={`in-${inp.id}`}
          id={inp.id}
          type="target"
          label={isCompactLod ? '' : inp.label}
          color={inp.kind === 'color' ? 'var(--pbr-packed)' : 'var(--pbr-scalar)'}
        />
      ))}

      {/* Body content if not compact LOD */}
      {!isCompactLod && !isBlockLod && (
        <div className="node-shell__content">
          {/* Custom or generic parameter controls rendered here */}
        </div>
      )}

      {/* Source (Output) Ports */}
      {def?.outputs.map((out) => (
        <NodeSocket
          key={`out-${out.id}`}
          id={out.id}
          type="source"
          label={isCompactLod ? '' : out.label}
          color={out.kind === 'color' ? 'var(--pbr-packed)' : 'var(--pbr-scalar)'}
        />
      ))}
    </NodeCard>
  );
};
