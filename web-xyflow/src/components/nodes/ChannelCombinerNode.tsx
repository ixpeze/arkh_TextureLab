import React, { useState } from 'react';
import type { NodeProps } from '@xyflow/react';
import { FoldHorizontal, Settings2 } from 'lucide-react';
import { NodeCard } from '../node-system/NodeCard';
import { NodeSocket, NodeSocketGroup } from '../node-system/NodeSocket';
import { NodeBadge, NodeDivider } from '../node-system/NodeControls';

export interface ChannelCombinerData {
  title?: string;
  isBypassed?: boolean;
  fallbacks?: {
    r?: number;
    g?: number;
    b?: number;
    a?: number;
  };
  onChange?: (data: { fallbacks: { r: number; g: number; b: number; a: number } }) => void;
}

export const ChannelCombinerNode: React.FC<NodeProps<any>> = ({ data, selected }) => {
  const d = (data as ChannelCombinerData) || {};
  const isBypassed = !!d.isBypassed;
  const [showFallbacks, setShowFallbacks] = useState(false);

  const [fallbacks, setFallbacks] = useState({
    r: d.fallbacks?.r ?? 255,
    g: d.fallbacks?.g ?? 128,
    b: d.fallbacks?.b ?? 0,
    a: d.fallbacks?.a ?? 255,
  });

  const updateFallback = (ch: 'r' | 'g' | 'b' | 'a', val: number) => {
    const updated = { ...fallbacks, [ch]: val };
    setFallbacks(updated);
    d.onChange?.({ fallbacks: updated });
  };

  return (
    <NodeCard
      selected={selected}
      title="Channel Combiner"
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
            title="Toggle Unconnected Fallback Constants"
            style={{
              background: showFallbacks ? 'rgba(168, 85, 247, 0.25)' : 'rgba(255, 255, 255, 0.05)',
              border: `1px solid ${showFallbacks ? 'var(--pbr-packed)' : 'rgba(255, 255, 255, 0.08)'}`,
              borderRadius: 3,
              color: showFallbacks ? 'var(--pbr-packed)' : '#94a3b8',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: 16,
              height: 16,
              padding: 0,
            }}
          >
            <Settings2 size={9} />
          </button>
          <NodeBadge color="var(--pbr-packed)">ORMH</NodeBadge>
        </div>
      }
      isBypassed={isBypassed}
      width={176}
    >
      {/* 4 Inputs on Left */}
      <NodeSocketGroup>
        <NodeSocket
          id="r"
          type="target"
          label={showFallbacks ? `R: AO (${fallbacks.r})` : 'R: AO'}
          color="var(--pbr-ao)"
        />
        <NodeSocket
          id="g"
          type="target"
          label={showFallbacks ? `G: Rough (${fallbacks.g})` : 'G: Rough'}
          color="var(--pbr-rough)"
        />
        <NodeSocket
          id="b"
          type="target"
          label={showFallbacks ? `B: Metal (${fallbacks.b})` : 'B: Metal'}
          color="var(--pbr-metal)"
        />
        <NodeSocket
          id="a"
          type="target"
          label={showFallbacks ? `A: Height (${fallbacks.a})` : 'A: Height'}
          color="var(--pbr-height)"
        />
      </NodeSocketGroup>

      {/* Fallback Defaults Micro Panel when toggled */}
      {showFallbacks && (
        <>
          <NodeDivider />
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: 4,
              backgroundColor: 'rgba(10, 12, 18, 0.75)',
              padding: 6,
              borderRadius: 4,
              border: '1px solid rgba(255, 255, 255, 0.06)',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: 7.5, color: '#94a3b8', fontWeight: 600, letterSpacing: '0.04em' }}>
                FALLBACK VALUES (0-255)
              </span>
            </div>

            <div className="nodrag nopan" onPointerDown={(e) => e.stopPropagation()} onMouseDown={(e) => e.stopPropagation()} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 4 }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 8, color: 'var(--pbr-ao)' }}>
                R:
                <input
                  type="number"
                  min={0}
                  max={255}
                  value={fallbacks.r}
                  onChange={(e) => updateFallback('r', Math.min(255, Math.max(0, parseInt(e.target.value) || 0)))}
                  className="nodrag nopan"
                  onPointerDown={(e) => e.stopPropagation()}
                  onMouseDown={(e) => e.stopPropagation()}
                  style={{
                    width: '100%',
                    background: '#12151e',
                    border: '1px solid rgba(255,255,255,0.1)',
                    borderRadius: 2,
                    color: '#f8fafc',
                    fontSize: 8.5,
                    fontFamily: 'monospace',
                    padding: '1px 3px',
                    outline: 'none',
                  }}
                />
              </label>

              <label style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 8, color: 'var(--pbr-rough)' }}>
                G:
                <input
                  type="number"
                  min={0}
                  max={255}
                  value={fallbacks.g}
                  onChange={(e) => updateFallback('g', Math.min(255, Math.max(0, parseInt(e.target.value) || 0)))}
                  className="nodrag nopan"
                  onPointerDown={(e) => e.stopPropagation()}
                  onMouseDown={(e) => e.stopPropagation()}
                  style={{
                    width: '100%',
                    background: '#12151e',
                    border: '1px solid rgba(255,255,255,0.1)',
                    borderRadius: 2,
                    color: '#f8fafc',
                    fontSize: 8.5,
                    fontFamily: 'monospace',
                    padding: '1px 3px',
                    outline: 'none',
                  }}
                />
              </label>

              <label style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 8, color: 'var(--pbr-metal)' }}>
                B:
                <input
                  type="number"
                  min={0}
                  max={255}
                  value={fallbacks.b}
                  onChange={(e) => updateFallback('b', Math.min(255, Math.max(0, parseInt(e.target.value) || 0)))}
                  className="nodrag nopan"
                  onPointerDown={(e) => e.stopPropagation()}
                  onMouseDown={(e) => e.stopPropagation()}
                  style={{
                    width: '100%',
                    background: '#12151e',
                    border: '1px solid rgba(255,255,255,0.1)',
                    borderRadius: 2,
                    color: '#f8fafc',
                    fontSize: 8.5,
                    fontFamily: 'monospace',
                    padding: '1px 3px',
                    outline: 'none',
                  }}
                />
              </label>

              <label style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 8, color: 'var(--pbr-height)' }}>
                A:
                <input
                  type="number"
                  min={0}
                  max={255}
                  value={fallbacks.a}
                  onChange={(e) => updateFallback('a', Math.min(255, Math.max(0, parseInt(e.target.value) || 0)))}
                  className="nodrag nopan"
                  onPointerDown={(e) => e.stopPropagation()}
                  onMouseDown={(e) => e.stopPropagation()}
                  style={{
                    width: '100%',
                    background: '#12151e',
                    border: '1px solid rgba(255,255,255,0.1)',
                    borderRadius: 2,
                    color: '#f8fafc',
                    fontSize: 8.5,
                    fontFamily: 'monospace',
                    padding: '1px 3px',
                    outline: 'none',
                  }}
                />
              </label>
            </div>
          </div>
        </>
      )}

      <NodeDivider />

      {/* Output on Right */}
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
