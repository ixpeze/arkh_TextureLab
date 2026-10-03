import React, { useState } from 'react';
import { type NodeProps, useNodeConnections } from '@xyflow/react';
import { Download, FileImage, AlertCircle } from 'lucide-react';
import { NodeCard } from '../node-system/NodeCard';
import { NodeSocket } from '../node-system/NodeSocket';
import { NodeBadge, NodeDivider } from '../node-system/NodeControls';
import { useNodeBuffers } from '../../context/NodeBufferContext';

export interface TextureOutputData {
  title: string;
  outputFilename: string;
  format: string;
  bitDepth: string;
  res: string;
  onExport?: () => void;
  onChangeFormat?: (fmt: string) => void;
}

export const TextureOutputNode: React.FC<NodeProps<any>> = ({ id, data, selected }) => {
  const d = data as TextureOutputData;
  const [format, setFormat] = useState(d.format || 'PNG');
  const { evaluatedBuffers } = useNodeBuffers();

  const myBuffer = evaluatedBuffers[id];
  const previewUrl = myBuffer?.dataUrl;

  const conns = useNodeConnections({ handleType: 'target', handleId: 'rgba' });
  const isConnected = conns.length > 0;

  const toggleFormat = (e: React.MouseEvent) => {
    e.stopPropagation();
    const formats = ['PNG', 'TGA', 'JPG'];
    const nextFmt = formats[(formats.indexOf(format) + 1) % formats.length];
    setFormat(nextFmt);
    d.onChangeFormat?.(nextFmt);
  };

  const headerBadges = (
    <div style={{ display: 'flex', gap: 3, alignItems: 'center' }}>
      <button
        type="button"
        className="nodrag nopan"
        onPointerDown={(e) => e.stopPropagation()}
        onMouseDown={(e) => e.stopPropagation()}
        onClick={toggleFormat}
        title="Click to switch export format (PNG / TGA / JPG)"
        style={{
          background: 'rgba(74, 222, 128, 0.15)',
          border: '1px solid #4ade80',
          borderRadius: 3,
          color: '#4ade80',
          fontSize: 7.5,
          fontWeight: 700,
          fontFamily: 'monospace',
          padding: '1px 4px',
          cursor: 'pointer',
        }}
      >
        {format}
      </button>
      <NodeBadge color="#94a3b8">{d.bitDepth || '8b'}</NodeBadge>
    </div>
  );

  return (
    <NodeCard
      selected={selected}
      title="Texture Output"
      icon={<Download size={11} />}
      accentColor="#4ade80"
      headerAction={headerBadges}
      width={176}
    >
      {/* Target Input Socket with Dedicated Horizontal Section on RGBA */}
      <NodeSocket
        isSection
        id="rgba"
        type="target"
        label={isConnected ? 'Packed RGBA Target (Active)' : 'Packed RGBA [Disconnected]'}
        color="var(--pbr-packed)"
        shape="diamond"
        sectionTag="PACKED"
      />

      <NodeDivider />

      {/* Live Output Preview Thumbnail / Connection Status */}
      {isConnected && previewUrl ? (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            padding: '4px 6px',
            backgroundColor: 'rgba(74, 222, 128, 0.06)',
            borderRadius: 4,
            border: '1px solid rgba(74, 222, 128, 0.25)',
          }}
        >
          <div
            style={{
              width: 32,
              height: 32,
              borderRadius: 3,
              border: '1px solid rgba(74, 222, 128, 0.4)',
              overflow: 'hidden',
              backgroundColor: '#0a0c12',
              flexShrink: 0,
            }}
          >
            <img
              src={previewUrl}
              alt="Target Output Preview"
              style={{ width: '100%', height: '100%', objectFit: 'cover' }}
            />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 1, minWidth: 0, flex: 1 }}>
            <span style={{ fontSize: 8, color: '#4ade80', fontWeight: 700, letterSpacing: '0.04em' }}>
              READY TO EXPORT
            </span>
            <span
              style={{
                fontSize: 8.5,
                fontFamily: "'Geist Mono', monospace",
                color: '#f8fafc',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {d.outputFilename || 'T_Asset_ORMH.png'}
            </span>
          </div>
        </div>
      ) : (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            padding: '6px',
            backgroundColor: 'rgba(239, 68, 68, 0.05)',
            border: '1px dashed rgba(239, 68, 68, 0.3)',
            borderRadius: 4,
          }}
        >
          <AlertCircle size={13} color="#f87171" style={{ flexShrink: 0 }} />
          <span style={{ fontSize: 7.5, color: '#f87171', lineHeight: 1.2 }}>
            Wire disconnected. Connect an RGBA source to export.
          </span>
        </div>
      )}

      {/* Card Direct Export Button */}
      <button
        type="button"
        className="nodrag nopan"
        disabled={!isConnected}
        onPointerDown={(e) => e.stopPropagation()}
        onMouseDown={(e) => e.stopPropagation()}
        onClick={(e) => {
          e.stopPropagation();
          d.onExport?.();
        }}
        style={{
          marginTop: 2,
          height: 24,
          backgroundColor: isConnected ? '#4ade80' : 'rgba(255, 255, 255, 0.05)',
          color: isConnected ? '#090a0f' : '#64748b',
          border: isConnected ? 'none' : '1px solid rgba(255, 255, 255, 0.08)',
          borderRadius: 4,
          fontWeight: 700,
          fontSize: 9.5,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 5,
          cursor: isConnected ? 'pointer' : 'not-allowed',
          transition: 'all 120ms ease',
          boxShadow: isConnected ? '0 2px 8px rgba(74, 222, 128, 0.25)' : 'none',
        }}
        onMouseEnter={(e) => {
          if (isConnected) {
            e.currentTarget.style.backgroundColor = '#86efac';
            e.currentTarget.style.transform = 'translateY(-1px)';
          }
        }}
        onMouseLeave={(e) => {
          if (isConnected) {
            e.currentTarget.style.backgroundColor = '#4ade80';
            e.currentTarget.style.transform = 'translateY(0)';
          }
        }}
      >
        <FileImage size={11} strokeWidth={2.5} />
        <span>{isConnected ? 'Export Buffer' : 'Awaiting Input'}</span>
      </button>
    </NodeCard>
  );
};
