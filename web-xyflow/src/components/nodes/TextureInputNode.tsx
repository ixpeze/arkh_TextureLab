import React, { useRef, useState } from 'react';
import type { NodeProps } from '@xyflow/react';
import { Layers, UploadCloud, Sliders } from 'lucide-react';
import { NodeCard } from '../node-system/NodeCard';
import { NodeSocket, NodeSocketGroup } from '../node-system/NodeSocket';
import { NodeBadge, NodeDivider } from '../node-system/NodeControls';
import { PixelEngine } from '../../engine/pixelEngine';
import { LexicalNormalizer } from '../../engine/normalizer';
import { useNodeBuffers } from '../../context/NodeBufferContext';

export interface TextureInputData {
  title: string;
  role: string;
  roleColor: string;
  res: string;
  previewUrl: string;
  colorSpace?: 'sRGB' | 'Linear';
  tileU?: number;
  tileV?: number;
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

export const TextureInputNode: React.FC<NodeProps> = ({ id, data, selected }) => {
  const d = data as unknown as TextureInputData;
  const { setSourceBuffer, onUpdateNodeData } = useNodeBuffers();
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const [showTiling, setShowTiling] = useState(false);

  const colorSpace = d.colorSpace || 'Linear';
  const preview = d.previewUrl;
  const tileU = d.tileU ?? 1.0;
  const tileV = d.tileV ?? 1.0;

  const toggleColorSpace = (e: React.MouseEvent) => {
    e.stopPropagation();
    const nextCs = colorSpace === 'Linear' ? 'sRGB' : 'Linear';
    d.onChangeColorSpace?.(nextCs);
    onUpdateNodeData(id, { colorSpace: nextCs });
  };

  const processLoadedFile = async (file: File) => {
    try {
      const buffer = await PixelEngine.loadFromFile(file);
      setSourceBuffer(id, buffer);

      // Infer texture role from filename
      const meta = LexicalNormalizer.normalizeFilename(file.name);
      const resLabel = buffer.width >= 3840 ? '4K' : buffer.width >= 1920 ? '2K' : '1K';
      const patch = {
        previewUrl: buffer.dataUrl || '',
        title: meta.assetName ? `${meta.assetName} (${meta.roleLabel})` : file.name,
        role: meta.roleLabel,
        detectedRole: meta.detectedRole,
        roleColor: meta.roleColor,
        colorSpace: meta.colorSpace,
        res: meta.resolution || resLabel,
        channels: meta.channels,
      };

      d.onLoadBuffer?.(buffer);
      onUpdateNodeData(id, patch);
    } catch (err) {
      console.error('Failed to load file into TextureInputNode:', err);
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) await processLoadedFile(file);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) await processLoadedFile(file);
  };

  const headerAction = (
    <div style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
      <button
        type="button"
        className="nodrag nopan"
        onPointerDown={(e) => e.stopPropagation()}
        onMouseDown={(e) => e.stopPropagation()}
        onClick={() => setShowTiling(!showTiling)}
        title="Toggle Tiling & UV Controls"
        style={{
          background: showTiling ? 'rgba(56, 189, 248, 0.25)' : 'rgba(255, 255, 255, 0.05)',
          border: `1px solid ${showTiling ? '#38bdf8' : 'rgba(255, 255, 255, 0.08)'}`,
          borderRadius: 3,
          color: showTiling ? '#38bdf8' : '#94a3b8',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: 15,
          height: 15,
          padding: 0,
        }}
      >
        <Sliders size={8} />
      </button>
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
      width={184}
    >
      {/* Hidden Native File Input */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*,.tga,.exr"
        style={{ display: 'none' }}
        onChange={handleFileChange}
      />

      {/* Interactive Drop Zone & Thumbnail Section */}
      <div
        className="nodrag nopan"
        onPointerDown={(e) => e.stopPropagation()}
        onMouseDown={(e) => e.stopPropagation()}
        onClick={() => fileInputRef.current?.click()}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        title="Click to browse or drag & drop texture file here"
        style={{
          display: 'flex',
          gap: 6,
          alignItems: 'center',
          cursor: 'pointer',
          padding: 3,
          borderRadius: 4,
          backgroundColor: isDragOver ? 'rgba(56, 189, 248, 0.15)' : 'transparent',
          border: isDragOver ? '1px dashed #38bdf8' : '1px solid transparent',
          transition: 'all 120ms ease',
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
            {d.role || 'Drop Image'}
          </span>
          <span style={{ fontSize: 7.5, color: '#64748b', fontFamily: 'monospace' }}>
            {isDragOver ? 'Drop file now' : 'Drop or browse ↗'}
          </span>
        </div>
      </div>

      {/* Optional Tiling Controls */}
      {showTiling && (
        <div
          className="nodrag nopan"
          onPointerDown={(e) => e.stopPropagation()}
          onMouseDown={(e) => e.stopPropagation()}
          style={{
            marginTop: 4,
            padding: '4px 6px',
            backgroundColor: 'rgba(10, 12, 18, 0.85)',
            border: '1px solid var(--border-subtle)',
            borderRadius: 4,
            display: 'flex',
            gap: 6,
            alignItems: 'center',
          }}
        >
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 3 }}>
            <span style={{ fontSize: 7.5, color: '#94a3b8', fontFamily: 'monospace' }}>U:</span>
            <input
              type="number"
              step="0.1"
              value={tileU}
              onChange={(e) => {
                const val = parseFloat(e.target.value) || 1.0;
                onUpdateNodeData(id, { tileU: val });
              }}
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
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 3 }}>
            <span style={{ fontSize: 7.5, color: '#94a3b8', fontFamily: 'monospace' }}>V:</span>
            <input
              type="number"
              step="0.1"
              value={tileV}
              onChange={(e) => {
                const val = parseFloat(e.target.value) || 1.0;
                onUpdateNodeData(id, { tileV: val });
              }}
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
        </div>
      )}

      <NodeDivider />

      {/* Output Sockets: RGBA (White), RGB (White), R (Red), G (Green), B (Blue), A (Gray) */}
      <NodeSocket
        isSection
        id="rgba"
        type="source"
        label="RGBA"
        color="#ffffff"
        shape="diamond"
        sectionTag="RGBA"
      />
      <NodeSocket
        isSection
        id="rgb"
        type="source"
        label="RGB"
        color="#ffffff"
        shape="diamond"
        sectionTag="RGB"
      />

      <NodeDivider />

      <NodeSocketGroup>
        <NodeSocket
          id="r"
          type="source"
          label={d.channels?.r ? `R: ${d.channels.r.slice(0, 6)}` : 'R'}
          color="#ef4444"
        />
        <NodeSocket
          id="g"
          type="source"
          label={d.channels?.g ? `G: ${d.channels.g.slice(0, 6)}` : 'G'}
          color="#22c55e"
        />
        <NodeSocket
          id="b"
          type="source"
          label={d.channels?.b ? `B: ${d.channels.b.slice(0, 6)}` : 'B'}
          color="#3b82f6"
        />
        <NodeSocket
          id="a"
          type="source"
          label={d.channels?.a ? `A: ${d.channels.a.slice(0, 6)}` : 'A'}
          color="#94a3b8"
        />
      </NodeSocketGroup>
    </NodeCard>
  );
};

