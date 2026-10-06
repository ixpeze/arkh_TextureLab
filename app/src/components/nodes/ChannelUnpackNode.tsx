import React, { useState, useMemo } from 'react';
import { type NodeProps, useNodeConnections, useReactFlow } from '@xyflow/react';
import { UnfoldHorizontal, Download, Edit2 } from 'lucide-react';
import { NodeCard } from '../node-system/NodeCard';
import { NodeSocket, NodeSocketGroup } from '../node-system/NodeSocket';
import { NodeBadge, NodeDivider } from '../node-system/NodeControls';
import { useNodeBuffers } from '../../context/NodeBufferContext';
import { LexicalNormalizer } from '../../engine/normalizer';

export interface ChannelUnpackData {
  title?: string;
  isBypassed?: boolean;
  channels?: {
    r: string;
    g: string;
    b: string;
    a: string;
  };
  scalarMode?: 'replicate' | 'single';
}

export const ChannelUnpackNode: React.FC<NodeProps<any>> = ({ id, data, selected }) => {
  const d = (data as ChannelUnpackData) || {};
  const isBypassed = !!d.isBypassed;
  const { onUpdateNodeData } = useNodeBuffers();
  const { getNode } = useReactFlow();

  const [isEditingLabels, setIsEditingLabels] = useState(false);

  // Ingest connection to auto-infer channel semantics
  const inConns = useNodeConnections({ handleType: 'target', handleId: 'rgba' });
  const connectedSourceNode = inConns.length > 0 ? getNode(inConns[0].source) : null;
  const inferredChannels = useMemo(() => {
    if (!connectedSourceNode?.data) return null;
    const srcData = connectedSourceNode.data as any;
    return (
      srcData.channels ||
      (srcData.title || srcData.filename
        ? LexicalNormalizer.normalizeFilename(srcData.title || srcData.filename || '').channels
        : null)
    );
  }, [connectedSourceNode]);

  const channelLabels = d.channels || inferredChannels || { r: 'R', g: 'G', b: 'B', a: 'A' };

  const updateLabel = (ch: 'r' | 'g' | 'b' | 'a', newLabel: string) => {
    const updated = { ...channelLabels, [ch]: newLabel };
    onUpdateNodeData(id, { channels: updated });
  };

  return (
    <NodeCard
      selected={selected}
      title={d.title || 'Channel Unpack'}
      icon={<UnfoldHorizontal size={11} />}
      accentColor="var(--pbr-packed)"
      headerAction={
        <div style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
          <button
            type="button"
            className="nodrag nopan"
            onPointerDown={(e) => e.stopPropagation()}
            onMouseDown={(e) => e.stopPropagation()}
            onClick={() => setIsEditingLabels(!isEditingLabels)}
            title="Edit Semantic Channel Labels"
            style={{
              background: isEditingLabels ? 'rgba(56, 189, 248, 0.25)' : 'rgba(255, 255, 255, 0.05)',
              border: `1px solid ${isEditingLabels ? '#38bdf8' : 'rgba(255, 255, 255, 0.08)'}`,
              borderRadius: 3,
              color: isEditingLabels ? '#38bdf8' : '#94a3b8',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: 15,
              height: 15,
              padding: 0,
            }}
          >
            <Edit2 size={8} />
          </button>
          <NodeBadge color="var(--pbr-packed)">UNPACK</NodeBadge>
        </div>
      }
      isBypassed={isBypassed}
      width={184}
    >
      {/* Input Socket: Accepts RGBA, RGB, or Scalar with UE5 Coercion */}
      <NodeSocket
        id="rgba"
        type="target"
        label="Input Stream"
        color="#ffffff"
        shape="diamond"
      />

      {/* Editable Semantic Labels popdown */}
      {isEditingLabels && (
        <div
          className="nodrag nopan"
          onPointerDown={(e) => e.stopPropagation()}
          onMouseDown={(e) => e.stopPropagation()}
          style={{
            margin: '4px 0',
            padding: '4px 6px',
            backgroundColor: 'rgba(10, 12, 18, 0.9)',
            border: '1px solid var(--border-subtle)',
            borderRadius: 4,
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: 4,
          }}
        >
          {(['r', 'g', 'b', 'a'] as const).map((ch) => (
            <div key={ch} style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
              <span style={{ fontSize: 7.5, color: '#94a3b8', fontFamily: 'monospace', textTransform: 'uppercase' }}>
                {ch}:
              </span>
              <input
                type="text"
                value={channelLabels[ch]}
                onChange={(e) => updateLabel(ch, e.target.value)}
                style={{
                  width: '100%',
                  background: 'rgba(0, 0, 0, 0.5)',
                  border: '1px solid rgba(255, 255, 255, 0.1)',
                  color: '#fff',
                  fontSize: 8.5,
                  padding: '1px 3px',
                  borderRadius: 2,
                }}
              />
            </div>
          ))}
        </div>
      )}

      {/* Auto-Export Registration Telemetry Tag */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 4,
          margin: '3px 0',
          padding: '2px 4px',
          background: 'rgba(15, 23, 42, 0.4)',
          borderRadius: 3,
        }}
      >
        <Download size={8} color="#38bdf8" />
        <span style={{ fontSize: 7, color: '#94a3b8' }}>
          Auto-Registers R, G, B, A Output Exports
        </span>
      </div>

      <NodeDivider />

      {/* Output Sockets: R, G, B, A with UE5 Pin Colors */}
      <NodeSocketGroup>
        <NodeSocket
          id="r"
          type="source"
          label={`R: ${channelLabels.r || 'Red'}`}
          color="#ef4444"
        />
        <NodeSocket
          id="g"
          type="source"
          label={`G: ${channelLabels.g || 'Green'}`}
          color="#22c55e"
        />
        <NodeSocket
          id="b"
          type="source"
          label={`B: ${channelLabels.b || 'Blue'}`}
          color="#3b82f6"
        />
        <NodeSocket
          id="a"
          type="source"
          label={`A: ${channelLabels.a || 'Alpha'}`}
          color="#94a3b8"
        />
      </NodeSocketGroup>
    </NodeCard>
  );
};

export const ChannelSplitterNode = ChannelUnpackNode;
