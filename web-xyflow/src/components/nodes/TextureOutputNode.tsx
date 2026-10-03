import React, { useState } from 'react';
import type { NodeProps } from '@xyflow/react';
import { Download, FileImage } from 'lucide-react';
import { NodeCard } from '../node-system/NodeCard';
import { NodeSocket } from '../node-system/NodeSocket';
import { NodeBadge, NodeDivider } from '../node-system/NodeControls';

export interface TextureOutputData {
  title: string;
  outputFilename: string;
  format: string;
  bitDepth: string;
  res: string;
  onExport?: () => void;
  onChangeFormat?: (fmt: string) => void;
}

export const TextureOutputNode: React.FC<NodeProps<any>> = ({ data, selected }) => {
  const d = data as TextureOutputData;
  const [format, setFormat] = useState(d.format || 'PNG');

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
      {/* Target Input Socket with Full-Width Horizontal Section */}
      <NodeSocket
        id="rgba"
        type="target"
        label="RGBA (Packed)"
        color="var(--pbr-packed)"
        shape="diamond"
      />

      <NodeDivider />

      {/* Target Filename Pill with Estimated Uncompressed Memory */}
      <div
        style={{
          background: 'rgba(74, 222, 128, 0.08)',
          border: '1px solid rgba(74, 222, 128, 0.25)',
          borderRadius: 4,
          padding: '4px 6px',
          display: 'flex',
          flexDirection: 'column',
          gap: 2,
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: 7.5, color: '#4ade80', fontWeight: 700, letterSpacing: 0.5 }}>
            TARGET FILE
          </span>
          <span style={{ fontSize: 7, color: '#64748b', fontFamily: 'monospace' }}>
            ~16 MB (4K RGBA)
          </span>
        </div>
        <span
          style={{
            fontSize: 9,
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

      {/* Card Direct Export Button */}
      <button
        type="button"
        className="nodrag nopan"
        onPointerDown={(e) => e.stopPropagation()}
        onMouseDown={(e) => e.stopPropagation()}
        onClick={(e) => {
          e.stopPropagation();
          d.onExport?.();
        }}
        style={{
          marginTop: 2,
          height: 24,
          backgroundColor: '#4ade80',
          color: '#090a0f',
          border: 'none',
          borderRadius: 4,
          fontWeight: 700,
          fontSize: 9.5,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 5,
          cursor: 'pointer',
          transition: 'all 120ms ease',
          boxShadow: '0 2px 8px rgba(74, 222, 128, 0.25)',
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.backgroundColor = '#86efac';
          e.currentTarget.style.transform = 'translateY(-1px)';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.backgroundColor = '#4ade80';
          e.currentTarget.style.transform = 'translateY(0)';
        }}
      >
        <FileImage size={11} strokeWidth={2.5} />
        <span>Export Buffer</span>
      </button>
    </NodeCard>
  );
};
