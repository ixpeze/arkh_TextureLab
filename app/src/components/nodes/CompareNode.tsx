import React, { useState } from 'react';
import type { NodeProps } from '@xyflow/react';
import { Columns, Eye } from 'lucide-react';
import { NodeCard } from '../node-system/NodeCard';
import { NodeSocket } from '../node-system/NodeSocket';
import { NodeBadge, NodeDivider } from '../node-system/NodeControls';
import { useNodeBuffers } from '../../context/NodeBufferContext';

export interface CompareNodeData {
  title?: string;
  mode?: 'wipe' | 'sideBySide' | 'difference';
  wipeProgress?: number;
  diffGain?: number;
  channel?: 'all' | 'r' | 'g' | 'b' | 'a';
  isBypassed?: boolean;
}

export const CompareNode: React.FC<NodeProps<any>> = ({ id, data, selected }) => {
  const d = (data as CompareNodeData) || {};
  const isBypassed = !!d.isBypassed;
  const { onUpdateNodeData, evaluatedBuffers } = useNodeBuffers();

  const [mode, setMode] = useState<'wipe' | 'sideBySide' | 'difference'>(d.mode || 'wipe');
  const [wipeProgress, setWipeProgress] = useState<number>(d.wipeProgress ?? 0.5);
  const [diffGain, setDiffGain] = useState<number>(d.diffGain ?? 1.0);
  const [probe, setProbe] = useState<{ x: number; y: number } | null>(null);

  const update = (patch: Partial<CompareNodeData>) => {
    onUpdateNodeData(id, patch);
  };

  const previewBuf = evaluatedBuffers[id];

  return (
    <NodeCard
      selected={selected}
      title={d.title || 'Compare'}
      icon={<Columns size={11} />}
      accentColor="#38bdf8"
      headerAction={<NodeBadge color="#38bdf8">INSPECT</NodeBadge>}
      isBypassed={isBypassed}
      width={184}
    >
      {/* Sockets for Texture A and Texture B */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 4 }}>
        <NodeSocket id="a" type="target" label="Input A" color="#ffffff" shape="diamond" />
        <NodeSocket id="b" type="target" label="Input B" color="#ffffff" shape="diamond" />
      </div>

      <NodeDivider />

      {/* Mode Buttons */}
      <div
        className="nodrag nopan"
        onPointerDown={(e) => e.stopPropagation()}
        onMouseDown={(e) => e.stopPropagation()}
        style={{ display: 'flex', gap: 2, marginBottom: 4 }}
      >
        {(['wipe', 'sideBySide', 'difference'] as const).map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => {
              setMode(m);
              update({ mode: m });
            }}
            style={{
              flex: 1,
              background: mode === m ? 'rgba(56, 189, 248, 0.25)' : 'rgba(255, 255, 255, 0.03)',
              border: `1px solid ${mode === m ? '#38bdf8' : 'rgba(255, 255, 255, 0.08)'}`,
              color: mode === m ? '#38bdf8' : '#94a3b8',
              borderRadius: 2,
              fontSize: 7.5,
              fontWeight: mode === m ? 700 : 500,
              padding: '2px 0',
              cursor: 'pointer',
            }}
          >
            {m === 'wipe' ? 'Wipe' : m === 'sideBySide' ? 'Side/Side' : 'Diff'}
          </button>
        ))}
      </div>

      {/* Mode-specific Slider */}
      <div
        className="nodrag nopan"
        onPointerDown={(e) => e.stopPropagation()}
        onMouseDown={(e) => e.stopPropagation()}
        style={{ marginBottom: 4 }}
      >
        {mode === 'wipe' ? (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 7, color: '#94a3b8' }}>
              <span>WIPE SPLIT</span>
              <span>{Math.round(wipeProgress * 100)}%</span>
            </div>
            <input
              type="range"
              min="0"
              max="1"
              step="0.01"
              value={wipeProgress}
              onChange={(e) => {
                const val = parseFloat(e.target.value);
                setWipeProgress(val);
                update({ wipeProgress: val });
              }}
              style={{ width: '100%', accentColor: '#38bdf8' }}
            />
          </div>
        ) : mode === 'difference' ? (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 7, color: '#94a3b8' }}>
              <span>GAIN AMPLIFY</span>
              <span>{diffGain.toFixed(1)}x</span>
            </div>
            <input
              type="range"
              min="1"
              max="10"
              step="0.5"
              value={diffGain}
              onChange={(e) => {
                const val = parseFloat(e.target.value);
                setDiffGain(val);
                update({ diffGain: val });
              }}
              style={{ width: '100%', accentColor: '#f43f5e' }}
            />
          </div>
        ) : (
          <div style={{ fontSize: 7, color: '#64748b', textAlign: 'center', padding: '2px 0' }}>
            50% Left (A) | 50% Right (B)
          </div>
        )}
      </div>

      {/* Pixel Inspector Preview Thumbnail */}
      {previewBuf?.dataUrl && (
        <div
          className="nodrag nopan"
          onPointerDown={(e) => e.stopPropagation()}
          onMouseDown={(e) => e.stopPropagation()}
          style={{
            position: 'relative',
            width: '100%',
            height: 54,
            borderRadius: 3,
            overflow: 'hidden',
            border: '1px solid rgba(255, 255, 255, 0.08)',
            marginBottom: 4,
          }}
          onMouseMove={(e) => {
            const rect = e.currentTarget.getBoundingClientRect();
            const px = Math.floor(((e.clientX - rect.left) / rect.width) * previewBuf.width);
            const py = Math.floor(((e.clientY - rect.top) / rect.height) * previewBuf.height);
            setProbe({ x: px, y: py });
          }}
          onMouseLeave={() => setProbe(null)}
        >
          <img
            src={previewBuf.dataUrl}
            alt="Compare preview"
            style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
          />
          {probe && (
            <div
              style={{
                position: 'absolute',
                bottom: 2,
                left: 2,
                background: 'rgba(0,0,0,0.8)',
                padding: '1px 3px',
                borderRadius: 2,
                fontSize: 6.5,
                color: '#38bdf8',
                fontFamily: 'monospace',
              }}
            >
              Pixel: ({probe.x},{probe.y})
            </div>
          )}
        </div>
      )}

      {/* Non-Exporting Telemetry Tag */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 3,
          padding: '2px 4px',
          background: 'rgba(56, 189, 248, 0.08)',
          borderRadius: 2,
          fontSize: 7,
          color: '#38bdf8',
        }}
      >
        <Eye size={8} />
        <span>Inspection Only • Not Registered for Export</span>
      </div>

      <NodeDivider />

      {/* Output Socket */}
      <NodeSocket id="output" type="source" label="Composite View" color="#ffffff" shape="diamond" />
    </NodeCard>
  );
};
