import React, { useState } from 'react';
import { type NodeProps, useNodeConnections } from '@xyflow/react';
import { FoldHorizontal, Settings2, Sparkles } from 'lucide-react';
import { NodeCard } from '../node-system/NodeCard';
import { NodeSocket, NodeSocketGroup } from '../node-system/NodeSocket';
import { NodeBadge, NodeDivider } from '../node-system/NodeControls';
import { useNodeBuffers } from '../../context/NodeBufferContext';

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

export const ChannelCombinerNode: React.FC<NodeProps<any>> = ({ id, data, selected }) => {
  const d = (data as ChannelCombinerData) || {};
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
    onUpdateNodeData(id, { fallbacks: updated });
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
      {/* 4 Inputs on Left with Live Dynamic Connection Badging */}
      <NodeSocketGroup>
        <NodeSocket
          id="r"
          type="target"
          label={isRConnected ? 'R: AO (Active)' : `R: AO [${fallbacks.r}]`}
          color="var(--pbr-ao)"
        />
        <NodeSocket
          id="g"
          type="target"
          label={isGConnected ? 'G: Rough (Active)' : `G: Rough [${fallbacks.g}]`}
          color="var(--pbr-rough)"
        />
        <NodeSocket
          id="b"
          type="target"
          label={isBConnected ? 'B: Metal (Active)' : `B: Metal [${fallbacks.b}]`}
          color="var(--pbr-metal)"
        />
        <NodeSocket
          id="a"
          type="target"
          label={isAConnected ? 'A: Height (Active)' : `A: Height [${fallbacks.a}]`}
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

      {/* Live Packed ORMH Mini Preview Thumbnail */}
      {previewUrl && (
        <>
          <NodeDivider />
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              padding: '4px 6px',
              backgroundColor: 'rgba(10, 12, 18, 0.75)',
              borderRadius: 4,
              border: '1px solid rgba(255, 255, 255, 0.06)',
            }}
          >
            <div
              style={{
                width: 28,
                height: 28,
                borderRadius: 3,
                border: '1px solid rgba(168, 85, 247, 0.35)',
                overflow: 'hidden',
                backgroundColor: '#0a0c12',
                flexShrink: 0,
                boxShadow: 'inset 0 0 6px rgba(0, 0, 0, 0.6)',
              }}
            >
              <img
                src={previewUrl}
                alt="Packed Preview"
                style={{ width: '100%', height: '100%', objectFit: 'cover' }}
              />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0, flex: 1 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <Sparkles size={8} color="var(--pbr-packed)" />
                <span style={{ fontSize: 8, color: '#f8fafc', fontWeight: 700, letterSpacing: '0.04em' }}>
                  LIVE PACKED ORMH
                </span>
              </div>
              <div style={{ display: 'flex', gap: 3, fontSize: 7, fontFamily: "'Geist Mono', monospace" }}>
                <span style={{ color: isRConnected ? 'var(--pbr-ao)' : '#64748b' }}>R</span>
                <span style={{ color: isGConnected ? 'var(--pbr-rough)' : '#64748b' }}>G</span>
                <span style={{ color: isBConnected ? 'var(--pbr-metal)' : '#64748b' }}>B</span>
                <span style={{ color: isAConnected ? 'var(--pbr-height)' : '#64748b' }}>A</span>
              </div>
            </div>
          </div>
        </>
      )}

      <NodeDivider />

      {/* Output on Right with Dedicated Horizontal Section on RGBA */}
      <NodeSocket
        isSection
        id="rgba"
        type="source"
        label="Packed RGBA Buffer"
        color="var(--pbr-packed)"
        shape="diamond"
        sectionTag="PACKED"
      />
    </NodeCard>
  );
};
