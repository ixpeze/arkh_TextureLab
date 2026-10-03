import React, { useRef, useState } from 'react';
import type { NodeProps } from '@xyflow/react';
import { Layers, UploadCloud } from 'lucide-react';
import { NodeCard } from '../node-system/NodeCard';
import { NodeSocket, NodeSocketGroup } from '../node-system/NodeSocket';
import { NodeBadge, NodeDivider } from '../node-system/NodeControls';
import { PixelEngine } from '../../engine/pixelEngine';

export interface TextureInputData {
  title: string;
  role: string;
  roleColor: string;
  res: string;
  previewUrl: string;
  colorSpace?: 'sRGB' | 'Linear';
  isPinned?: boolean;
  onPinToggle?: () => void;
  onLoadBuffer?: (buffer: any) => void;
  onChangeColorSpace?: (cs: 'sRGB' | 'Linear') => void;
  channels: {
    r: string;
    g: string;
    b: string;
    a: string;
  };
}

export const TextureInputNode: React.FC<NodeProps<any>> = ({ data, selected }) => {
  const d = data as TextureInputData;
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [colorSpace, setColorSpace] = useState<'sRGB' | 'Linear'>(d.colorSpace || 'Linear');
  const [preview, setPreview] = useState(d.previewUrl);

  const toggleColorSpace = (e: React.MouseEvent) => {
    e.stopPropagation();
    const nextCs = colorSpace === 'Linear' ? 'sRGB' : 'Linear';
    setColorSpace(nextCs);
    d.onChangeColorSpace?.(nextCs);
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const buffer = await PixelEngine.loadFromFile(file);
      setPreview(buffer.dataUrl || '');
      d.onLoadBuffer?.(buffer);
    } catch (err) {
      console.error('Failed to load local file into TextureInputNode:', err);
    }
  };

  const headerAction = (
    <div style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
      <button
        type="button"
        className="nodrag nopan"
        onPointerDown={(e) => e.stopPropagation()}
        onMouseDown={(e) => e.stopPropagation()}
        onClick={toggleColorSpace}
        title={`Color Space: ${colorSpace} (Click to toggle sRGB / Linear)`}
        style={{
          background: colorSpace === 'sRGB' ? 'rgba(245, 158, 11, 0.15)' : 'rgba(56, 189, 248, 0.15)',
          border: `1px solid ${colorSpace === 'sRGB' ? '#f59e0b' : '#38bdf8'}`,
          borderRadius: 3,
          color: colorSpace === 'sRGB' ? '#f59e0b' : '#38bdf8',
          fontSize: 7.5,
          fontWeight: 700,
          fontFamily: 'monospace',
          padding: '1px 3px',
          cursor: 'pointer',
        }}
      >
        {colorSpace}
      </button>
      <NodeBadge color={d.roleColor || '#38bdf8'}>
        {d.res || '4K'}
      </NodeBadge>
    </div>
  );

  return (
    <NodeCard
      selected={selected}
      title={d.title || 'Texture Input'}
      icon={<Layers size={11} />}
      accentColor={d.roleColor || '#38bdf8'}
      headerAction={headerAction}
      width={176}
    >
      {/* Hidden Native File Input */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        style={{ display: 'none' }}
        onChange={handleFileChange}
      />

      {/* Interactive Thumbnail & Meta Section with File Browse Click */}
      <div
        className="nodrag nopan"
        onPointerDown={(e) => e.stopPropagation()}
        onMouseDown={(e) => e.stopPropagation()}
        onClick={() => fileInputRef.current?.click()}
        title="Click to browse & load local texture from disk"
        style={{
          display: 'flex',
          gap: 6,
          alignItems: 'center',
          cursor: 'pointer',
          padding: 2,
          borderRadius: 4,
          transition: 'background-color 120ms ease',
        }}
      >
        <div
          style={{
            width: 32,
            height: 32,
            borderRadius: 4,
            border: '1px solid var(--border-subtle)',
            backgroundColor: '#0a0c12',
            overflow: 'hidden',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
            boxShadow: 'inset 0 0 6px rgba(0, 0, 0, 0.6)',
            position: 'relative',
          }}
        >
          {preview ? (
            <img
              src={preview}
              alt={d.title}
              style={{ width: '100%', height: '100%', objectFit: 'cover' }}
            />
          ) : (
            <UploadCloud size={14} color="#64748b" />
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
          <span style={{ fontSize: 7.5, color: '#64748b', fontFamily: 'monospace' }}>
            Browse local map ↗
          </span>
        </div>
      </div>

      <NodeDivider />

      {/* Output Sockets with Dedicated Horizontal Section on RGBA */}
      <NodeSocket
        isSection
        id="rgba"
        type="source"
        label="RGBA Stream"
        color="var(--pbr-packed)"
        shape="diamond"
        sectionTag="STREAM"
      />

      <NodeDivider />

      <NodeSocketGroup>
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
