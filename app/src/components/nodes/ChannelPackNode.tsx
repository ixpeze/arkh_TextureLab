import React, { useState } from 'react';
import { type NodeProps, useNodeConnections } from '@xyflow/react';
import { FoldHorizontal, Settings2, Download } from 'lucide-react';
import { NodeCard } from '../node-system/NodeCard';
import { NodeSocket, NodeSocketGroup } from '../node-system/NodeSocket';
import { NodeBadge, NodeDivider } from '../node-system/NodeControls';
import { useNodeBuffers } from '../../context/NodeBufferContext';

export interface ChannelPackData {
  title?: string;
  slot?: string;
  isBypassed?: boolean;
  fallbacks?: {
    r?: number;
    g?: number;
    b?: number;
    a?: number;
  };
  onChange?: (data: { fallbacks: { r: number; g: number; b: number; a: number } }) => void;
}

export const ChannelPackNode: React.FC<NodeProps<any>> = ({ id, data, selected }) => {
  const d = (data as ChannelPackData) || {};
  const isBypassed = !!d.isBypassed;
  const [showFallbacks, setShowFallbacks] = useState(false);
  const { evaluatedBuffers, onUpdateNodeData } = useNodeBuffers();

  const myBuffer = evaluatedBuffers[id];
  const previewUrl = myBuffer?.dataUrl;

  // Track live connections for each channel socket
  const rConns = useNodeConnections({ handleType: 'target', handleId: 'r' });
  const gConns = useNodeConnections({ handleType: 'target', handleId: 'g' });
  const bConns = useNodeConnections({ handleType: 'target', handleId: 'b' });
  const aConns = useNodeConnections({ handleType: 'target', handleId: 'a' });

  const isRConnected = rConns.length > 0;
  const isGConnected = gConns.length > 0;
  const isBConnected = bConns.length > 0;
  const isAConnected = aConns.length > 0;

  // Each channel defaults to 0 per UE5 specification
  const [fallbacks, setFallbacks] = useState({
    r: d.fallbacks?.r ?? 0,
    g: d.fallbacks?.g ?? 0,
    b: d.fallbacks?.b ?? 0,
    a: d.fallbacks?.a ?? 0,
  });

  const updateFallback = (ch: 'r' | 'g' | 'b' | 'a', val: number | string) => {
    const parsed = typeof val === 'number' ? val : parseInt(String(val), 10);
    const clamped = isNaN(parsed) ? 0 : Math.min(255, Math.max(0, Math.round(parsed)));
    const updated = { ...fallbacks, [ch]: clamped };
    setFallbacks(updated);
    d.onChange?.({ fallbacks: updated });
    onUpdateNodeData(id, { fallbacks: updated });
  };

  return (
    <NodeCard
      selected={selected}
      title={d.title || 'Channel Pack'}
      icon={<FoldHorizontal size={11} />}
      accentColor="var(--pbr-packed)"
      headerAction={
        <div style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
          <button
            type="button"
            className="nodrag nopan"
            onPointerDown={(e) => e.stopPropagation()}
            onMouseDown={(e) => e.stopPropagation()}
            onClick={(e) => {
              e.stopPropagation();
              setShowFallbacks(!showFallbacks);
            }}
            title="Configure Unconnected Defaults (Default: 0)"
            style={{
              background: showFallbacks ? 'rgba(168, 85, 247, 0.25)' : 'rgba(255, 255, 255, 0.05)',
              border: `1px solid ${showFallbacks ? 'var(--pbr-packed)' : 'rgba(255, 255, 255, 0.08)'}`,
              borderRadius: 3,
              color: showFallbacks ? 'var(--pbr-packed)' : '#94a3b8',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: 15,
              height: 15,
              padding: 0,
            }}
          >
            <Settings2 size={8} />
          </button>
          <NodeBadge color="var(--pbr-packed)">RGBA</NodeBadge>
        </div>
      }
      isBypassed={isBypassed}
      width={184}
    >
      {/* 4 Inputs with UE5 Pin Colors: R Red, G Green, B Blue, A Gray */}
      <NodeSocketGroup>
        <NodeSocket
          id="r"
          type="target"
          label={isRConnected ? 'R: In' : `R [${fallbacks.r}]`}
          color="#ef4444"
        />
        <NodeSocket
          id="g"
          type="target"
          label={isGConnected ? 'G: In' : `G [${fallbacks.g}]`}
          color="#22c55e"
        />
        <NodeSocket
          id="b"
          type="target"
          label={isBConnected ? 'B: In' : `B [${fallbacks.b}]`}
          color="#3b82f6"
        />
        <NodeSocket
          id="a"
          type="target"
          label={isAConnected ? 'A: In' : `A [${fallbacks.a}]`}
          color="#94a3b8"
        />
      </NodeSocketGroup>

      {/* Fallback numeric controls */}
      {showFallbacks && (
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
                type="number"
                min="0"
                max="255"
                value={fallbacks[ch]}
                onChange={(e) => updateFallback(ch, e.target.value)}
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

      {/* Live Preview Bar with Auto-Export Registration Indicator */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          marginTop: 4,
          padding: '3px 4px',
          background: 'rgba(15, 23, 42, 0.5)',
          borderRadius: 4,
        }}
      >
        <div
          style={{
            width: 24,
            height: 24,
            borderRadius: 3,
            backgroundColor: '#0a0c12',
            border: '1px solid var(--border-subtle)',
            overflow: 'hidden',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
          }}
        >
          {previewUrl ? (
            <img src={previewUrl} alt="Packed RGBA" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          ) : (
            <span style={{ fontSize: 7, color: '#64748b' }}>Empty</span>
          )}
        </div>
        <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
          <span style={{ fontSize: 8.5, color: '#e2e8f0', fontWeight: 600 }}>Packed Stream</span>
          <span style={{ fontSize: 7, color: '#38bdf8', display: 'flex', alignItems: 'center', gap: 2 }}>
            <Download size={7} /> Auto-Registered Export
          </span>
        </div>
      </div>

      <NodeDivider />

      {/* Output Socket: RGBA (White, Diamond) */}
      <NodeSocket
        isSection
        id="rgba"
        type="source"
        label="RGBA"
        color="#ffffff"
        shape="diamond"
        sectionTag="RGBA"
      />
    </NodeCard>
  );
};

export const ChannelCombinerNode = ChannelPackNode;
