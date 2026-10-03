import React, { useState } from 'react';
import type { NodeProps } from '@xyflow/react';
import { Scaling } from 'lucide-react';
import { NodeCard } from '../node-system/NodeCard';
import { NodeSocket } from '../node-system/NodeSocket';
import { NodeBadge, NodeDivider } from '../node-system/NodeControls';
import { useNodeBuffers } from '../../context/NodeBufferContext';

export interface ResizeNodeData {
  title?: string;
  targetWidth?: number;
  targetHeight?: number;
  potMode?: 'none' | 'nearest' | 'up' | 'down';
  mode?: 'preserve' | 'pad' | 'crop' | 'stretch';
  isBypassed?: boolean;
}

export const ResizeNode: React.FC<NodeProps<any>> = ({ id, data, selected }) => {
  const d = (data as ResizeNodeData) || {};
  const isBypassed = !!d.isBypassed;
  const { onUpdateNodeData } = useNodeBuffers();

  const [width, setWidth] = useState<number>(d.targetWidth ?? 1024);
  const [height, setHeight] = useState<number>(d.targetHeight ?? 1024);
  const [potMode, setPotMode] = useState<'none' | 'nearest' | 'up' | 'down'>(d.potMode || 'none');
  const [mode, setMode] = useState<'preserve' | 'pad' | 'crop' | 'stretch'>(d.mode || 'preserve');

  const update = (patch: Partial<ResizeNodeData>) => {
    onUpdateNodeData(id, patch);
  };

  const applyPreset = (dim: number) => {
    setWidth(dim);
    setHeight(dim);
    update({ targetWidth: dim, targetHeight: dim });
  };

  return (
    <NodeCard
      selected={selected}
      title={d.title || 'Resize'}
      icon={<Scaling size={11} />}
      accentColor="#38bdf8"
      headerAction={<NodeBadge color="#38bdf8">RESIZE</NodeBadge>}
      isBypassed={isBypassed}
      width={176}
    >
      {/* Input Socket */}
      <NodeSocket
        id="input"
        type="target"
        label="Input"
        color="#ffffff"
        shape="diamond"
      />

      <NodeDivider />

      {/* Dimension Inputs */}
      <div
        className="nodrag nopan"
        onPointerDown={(e) => e.stopPropagation()}
        onMouseDown={(e) => e.stopPropagation()}
        style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 4, marginBottom: 4 }}
      >
        <div>
          <span style={{ fontSize: 7, color: '#94a3b8' }}>WIDTH (PX)</span>
          <input
            type="number"
            step="64"
            min="16"
            max="8192"
            value={width}
            onChange={(e) => {
              const val = parseInt(e.target.value, 10) || 512;
              setWidth(val);
              update({ targetWidth: val });
            }}
            style={{
              width: '100%',
              background: '#0c0e14',
              border: '1px solid rgba(255,255,255,0.08)',
              borderRadius: 2,
              color: '#fff',
              fontSize: 8.5,
              padding: '2px 4px',
            }}
          />
        </div>
        <div>
          <span style={{ fontSize: 7, color: '#94a3b8' }}>HEIGHT (PX)</span>
          <input
            type="number"
            step="64"
            min="16"
            max="8192"
            value={height}
            onChange={(e) => {
              const val = parseInt(e.target.value, 10) || 512;
              setHeight(val);
              update({ targetHeight: val });
            }}
            style={{
              width: '100%',
              background: '#0c0e14',
              border: '1px solid rgba(255,255,255,0.08)',
              borderRadius: 2,
              color: '#fff',
              fontSize: 8.5,
              padding: '2px 4px',
            }}
          />
        </div>
      </div>

      {/* Quick Presets */}
      <div
        className="nodrag nopan"
        onPointerDown={(e) => e.stopPropagation()}
        onMouseDown={(e) => e.stopPropagation()}
        style={{ display: 'flex', gap: 2, marginBottom: 4 }}
      >
        {[512, 1024, 2048, 4096].map((dim) => (
          <button
            key={dim}
            type="button"
            onClick={() => applyPreset(dim)}
            style={{
              flex: 1,
              background: width === dim && height === dim ? 'rgba(56, 189, 248, 0.2)' : 'rgba(255,255,255,0.03)',
              border: `1px solid ${width === dim && height === dim ? '#38bdf8' : 'rgba(255,255,255,0.08)'}`,
              color: width === dim && height === dim ? '#38bdf8' : '#94a3b8',
              borderRadius: 2,
              fontSize: 7,
              padding: '2px 0',
              cursor: 'pointer',
            }}
          >
            {dim === 512 ? '512' : `${dim / 1024}K`}
          </button>
        ))}
      </div>

      {/* Mode Selectors */}
      <div
        className="nodrag nopan"
        onPointerDown={(e) => e.stopPropagation()}
        onMouseDown={(e) => e.stopPropagation()}
        style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 4 }}
      >
        <div>
          <span style={{ fontSize: 7, color: '#94a3b8' }}>POWER OF 2</span>
          <select
            value={potMode}
            onChange={(e) => {
              const val = e.target.value as any;
              setPotMode(val);
              update({ potMode: val });
            }}
            style={{
              width: '100%',
              background: '#0c0e14',
              border: '1px solid rgba(255,255,255,0.08)',
              borderRadius: 2,
              color: '#fff',
              fontSize: 8,
              padding: '2px 1px',
            }}
          >
            <option value="none">None (Exact)</option>
            <option value="nearest">PoT Nearest</option>
            <option value="up">PoT Up (Ceil)</option>
            <option value="down">PoT Down (Floor)</option>
          </select>
        </div>

        <div>
          <span style={{ fontSize: 7, color: '#94a3b8' }}>ASPECT RATIO</span>
          <select
            value={mode}
            onChange={(e) => {
              const val = e.target.value as any;
              setMode(val);
              update({ mode: val });
            }}
            style={{
              width: '100%',
              background: '#0c0e14',
              border: '1px solid rgba(255,255,255,0.08)',
              borderRadius: 2,
              color: '#fff',
              fontSize: 8,
              padding: '2px 1px',
            }}
          >
            <option value="preserve">Preserve Fit</option>
            <option value="pad">Pad to Fit</option>
            <option value="crop">Center Crop</option>
            <option value="stretch">Stretch Fill</option>
          </select>
        </div>
      </div>

      <NodeDivider />

      {/* Output Socket */}
      <NodeSocket
        id="output"
        type="source"
        label="Resized"
        color="#ffffff"
        shape="diamond"
      />
    </NodeCard>
  );
};
