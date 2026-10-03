import React, { useState, useEffect, useRef } from 'react';
import { Download } from 'lucide-react';
import { PixelEngine, type TextureBuffer } from '../engine/pixelEngine';
import { TokenEngine, type CasingType } from '../engine/tokenizer';

export interface InspectorProps {
  activeNode: any;
  primaryAsset: string;
  activeBuffer?: TextureBuffer | null;
  onPatternChange?: (p: string) => void;
  onExportTarget?: (filename: string) => void;
}

export const InspectorPanel: React.FC<InspectorProps> = ({
  activeNode,
  primaryAsset,
  activeBuffer,
  onExportTarget,
}) => {
  const [isolatedChannel, setIsolatedChannel] = useState<'RGBA' | 'R' | 'G' | 'B' | 'A'>('RGBA');
  const [pattern, setPattern] = useState(TokenEngine.DEFAULT_PATTERN);
  const [casing, setCasing] = useState<CasingType>('UPPER_SNAKE');
  const [hoverPixel, setHoverPixel] = useState<{ x: number; y: number; r: number; g: number; b: number; a: number } | null>(null);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const nodeTitle = activeNode?.data?.title || 'Anthracite Cast Concrete (ORMH)';

  // Evaluate live token
  const evaluateFilename = () => {
    let slot = 'ORMH';
    if (activeNode?.data?.detectedRole) {
      slot = activeNode.data.detectedRole.toUpperCase();
    } else if (activeNode?.data?.role) {
      slot = activeNode.data.role.replace(/\s+/g, '_').toUpperCase();
    }

    return TokenEngine.evaluate(
      pattern,
      {
        prefix: 'T',
        asset: primaryAsset || 'AnthraciteConcrete',
        slot,
        res: activeBuffer ? `${Math.round(activeBuffer.width / 1024)}K` : '4K',
        ext: 'png',
      },
      casing
    );
  };

  const insertToken = (tok: string) => {
    setPattern((prev) => prev + tok);
  };

  // Render buffer to canvas with channel isolation
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !activeBuffer) return;

    let displayBuf = activeBuffer;
    if (isolatedChannel === 'R') {
      displayBuf = PixelEngine.getIsolatedChannel(activeBuffer, 0);
    } else if (isolatedChannel === 'G') {
      displayBuf = PixelEngine.getIsolatedChannel(activeBuffer, 1);
    } else if (isolatedChannel === 'B') {
      displayBuf = PixelEngine.getIsolatedChannel(activeBuffer, 2);
    } else if (isolatedChannel === 'A') {
      displayBuf = PixelEngine.getIsolatedChannel(activeBuffer, 3);
    }

    canvas.width = displayBuf.width;
    canvas.height = displayBuf.height;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      const imgData = ctx.createImageData(displayBuf.width, displayBuf.height);
      imgData.data.set(displayBuf.data);
      ctx.putImageData(imgData, 0, 0);
    }
  }, [activeBuffer, isolatedChannel]);

  // Handle canvas mouse probe
  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas || !activeBuffer) return;
    const rect = canvas.getBoundingClientRect();
    const x = Math.floor(((e.clientX - rect.left) / rect.width) * activeBuffer.width);
    const y = Math.floor(((e.clientY - rect.top) / rect.height) * activeBuffer.height);

    if (x >= 0 && x < activeBuffer.width && y >= 0 && y < activeBuffer.height) {
      const idx = (y * activeBuffer.width + x) * 4;
      setHoverPixel({
        x,
        y,
        r: activeBuffer.data[idx + 0],
        g: activeBuffer.data[idx + 1],
        b: activeBuffer.data[idx + 2],
        a: activeBuffer.data[idx + 3],
      });
    }
  };

  const handleDownload = () => {
    const filename = evaluateFilename();
    if (activeBuffer) {
      PixelEngine.downloadBuffer(activeBuffer, filename);
    }
    onExportTarget?.(filename);
  };

  return (
    <div
      style={{
        width: 360,
        height: '100%',
        backgroundColor: 'var(--bg-canvas)',
        borderLeft: '1px solid var(--border-subtle)',
        display: 'flex',
        flexDirection: 'column',
        padding: '12px',
        gap: 12,
        overflowY: 'auto',
      }}
    >
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', letterSpacing: 1 }}>
          INSPECTOR & VIEWPORT
        </span>
        <span
          style={{
            fontSize: 9,
            fontWeight: 700,
            background: 'rgba(56, 189, 248, 0.15)',
            border: '1px solid rgba(56, 189, 248, 0.3)',
            color: '#38bdf8',
            padding: '2px 6px',
            borderRadius: 3,
            textTransform: 'uppercase',
          }}
        >
          {activeNode ? activeNode.type : 'LIVE BUFFER'}
        </span>
      </div>

      {/* 2D Preview Viewport Canvas */}
      <div
        style={{
          width: '100%',
          height: 230,
          backgroundColor: '#12151c',
          borderRadius: 6,
          border: '1px solid var(--border-subtle)',
          position: 'relative',
          overflow: 'hidden',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: 'crosshair',
        }}
      >
        {activeBuffer ? (
          <canvas
            ref={canvasRef}
            onMouseMove={handleMouseMove}
            onMouseLeave={() => setHoverPixel(null)}
            style={{
              width: '100%',
              height: '100%',
              objectFit: 'contain',
              imageRendering: 'pixelated',
            }}
          />
        ) : (
          <div style={{ color: 'var(--text-muted)', fontSize: 11, textAlign: 'center' }}>
            No Buffer Loaded
          </div>
        )}

        {/* Pixel Probe Tooltip */}
        {hoverPixel && (
          <div
            style={{
              position: 'absolute',
              top: 6,
              right: 6,
              background: 'rgba(15, 23, 42, 0.85)',
              border: '1px solid rgba(255, 255, 255, 0.15)',
              padding: '3px 8px',
              borderRadius: 4,
              fontSize: 9,
              fontFamily: 'monospace',
              color: '#f8fafc',
              backdropFilter: 'blur(6px)',
              pointerEvents: 'none',
              display: 'flex',
              gap: 6,
            }}
          >
            <span>[{hoverPixel.x}, {hoverPixel.y}]</span>
            <span style={{ color: 'var(--pbr-ao)' }}>R: {hoverPixel.r}</span>
            <span style={{ color: 'var(--pbr-rough)' }}>G: {hoverPixel.g}</span>
            <span style={{ color: 'var(--pbr-metal)' }}>B: {hoverPixel.b}</span>
            <span style={{ color: 'var(--pbr-height)' }}>A: {hoverPixel.a}</span>
          </div>
        )}

        {/* Node Title Badge */}
        <div
          style={{
            position: 'absolute',
            bottom: 6,
            left: 6,
            background: 'rgba(0, 0, 0, 0.75)',
            border: '1px solid rgba(255, 255, 255, 0.1)',
            padding: '2px 6px',
            borderRadius: 3,
            fontSize: 9,
            color: '#f8fafc',
            backdropFilter: 'blur(4px)',
          }}
        >
          {nodeTitle}
        </div>
      </div>

      {/* Channel Isolation Bar */}
      <div style={{ display: 'flex', gap: 4 }}>
        {[
          { key: 'RGBA', label: 'RGBA', color: '#cbd5e1' },
          { key: 'R', label: 'R (AO)', color: 'var(--pbr-ao)' },
          { key: 'G', label: 'G (ROUGH)', color: 'var(--pbr-rough)' },
          { key: 'B', label: 'B (MET)', color: 'var(--pbr-metal)' },
          { key: 'A', label: 'A (HGT)', color: 'var(--pbr-height)' },
        ].map((btn) => (
          <button
            key={btn.key}
            onClick={() => setIsolatedChannel(btn.key as any)}
            style={{
              flex: 1,
              height: 24,
              backgroundColor: isolatedChannel === btn.key ? 'rgba(56, 189, 248, 0.2)' : 'var(--bg-card)',
              border: isolatedChannel === btn.key ? `1px solid ${btn.color}` : '1px solid var(--border-subtle)',
              borderRadius: 3,
              color: isolatedChannel === btn.key ? '#fff' : btn.color,
              fontSize: 9,
              fontWeight: 700,
              cursor: 'pointer',
            }}
          >
            {btn.label}
          </button>
        ))}
      </div>

      {/* Technical Metadata Table */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <span style={{ fontSize: 9, fontWeight: 700, color: 'var(--text-muted)', letterSpacing: 1 }}>
          IMAGE METADATA
        </span>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: '4px 8px',
            fontSize: 10,
            background: 'var(--bg-card)',
            padding: 8,
            borderRadius: 4,
            border: '1px solid var(--border-subtle)',
          }}
        >
          <span style={{ color: 'var(--text-muted)' }}>Resolution</span>
          <span style={{ textAlign: 'right', fontWeight: 600 }}>
            {activeBuffer ? `${activeBuffer.width} x ${activeBuffer.height} px` : '4096 x 4096 px'}
          </span>

          <span style={{ color: 'var(--text-muted)' }}>Aspect Ratio</span>
          <span style={{ textAlign: 'right', fontWeight: 600 }}>1:1 Square</span>

          <span style={{ color: 'var(--text-muted)' }}>Format / Depth</span>
          <span style={{ textAlign: 'right', fontWeight: 600 }}>PNG 8-bit RGBA</span>

          <span style={{ color: 'var(--text-muted)' }}>Color Space</span>
          <span style={{ textAlign: 'right', fontWeight: 600 }}>Linear / Raw</span>
        </div>
      </div>

      {/* Token-Based Export Naming */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 4 }}>
        <span style={{ fontSize: 9, fontWeight: 700, color: '#38bdf8', letterSpacing: 1 }}>
          TOKEN-BASED EXPORT NAMING
        </span>

        {/* Token Chips */}
        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
          {['{prefix}', '{asset}', '{slot}', '{res}', '{ext}'].map((tok) => (
            <button
              key={tok}
              onClick={() => insertToken(tok)}
              style={{
                background: 'rgba(56, 189, 248, 0.1)',
                border: '1px dashed rgba(56, 189, 248, 0.4)',
                borderRadius: 3,
                color: '#38bdf8',
                fontSize: 9,
                fontWeight: 600,
                padding: '2px 6px',
                cursor: 'pointer',
              }}
            >
              {tok}
            </button>
          ))}
        </div>

        {/* Pattern Input */}
        <input
          type="text"
          value={pattern}
          onChange={(e) => setPattern(e.target.value)}
          style={{
            height: 28,
            backgroundColor: 'var(--bg-card)',
            border: '1px solid var(--border-subtle)',
            borderRadius: 4,
            padding: '0 8px',
            color: 'var(--text-main)',
            fontSize: 10,
            fontFamily: 'monospace',
          }}
        />

        {/* Casing Dropdown */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 10 }}>
          <span style={{ color: 'var(--text-muted)' }}>Casing Transformation</span>
          <select
            value={casing}
            onChange={(e) => setCasing(e.target.value as CasingType)}
            style={{
              backgroundColor: 'var(--bg-card)',
              border: '1px solid var(--border-subtle)',
              color: 'var(--text-main)',
              borderRadius: 3,
              padding: '2px 6px',
              fontSize: 10,
            }}
          >
            <option value="original">Original</option>
            <option value="UPPER_SNAKE">UPPER_SNAKE</option>
            <option value="snake_case">snake_case</option>
            <option value="PascalCase">PascalCase</option>
            <option value="camelCase">camelCase</option>
          </select>
        </div>

        {/* Live Evaluated Filename */}
        <div
          style={{
            background: 'rgba(74, 222, 128, 0.08)',
            border: '1px solid rgba(74, 222, 128, 0.25)',
            borderRadius: 4,
            padding: '6px 8px',
            fontSize: 10,
            fontFamily: 'monospace',
            color: '#4ade80',
            wordBreak: 'break-all',
          }}
        >
          {evaluateFilename()}
        </div>
      </div>

      {/* Export Button */}
      <button
        onClick={handleDownload}
        style={{
          marginTop: 'auto',
          height: 34,
          backgroundColor: '#38bdf8',
          border: 'none',
          borderRadius: 4,
          color: '#0f172a',
          fontWeight: 700,
          fontSize: 11,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 6,
          cursor: 'pointer',
          letterSpacing: 0.5,
        }}
      >
        <Download size={14} />
        EXPORT TARGET TEXTURES
      </button>
    </div>
  );
};
