import React, { useEffect, useRef, useState } from 'react';
import { Maximize, Minimize } from 'lucide-react';
import type { TextureBuffer } from '../../types/buffer';
import type { ChannelKey, HoverPixelInfo } from './types';

export interface ViewportTabProps {
  activeBuffer?: TextureBuffer | null;
  isolatedChannel: ChannelKey;
  setIsolatedChannel: (channel: ChannelKey) => void;
  isPixelExact: boolean;
  setIsPixelExact: React.Dispatch<React.SetStateAction<boolean>>;
}

export const ViewportTab: React.FC<ViewportTabProps> = ({
  activeBuffer,
  isolatedChannel,
  setIsolatedChannel,
  isPixelExact,
  setIsPixelExact,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [hoverPixel, setHoverPixel] = useState<HoverPixelInfo | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !activeBuffer) return;

    const sourceBuf = activeBuffer;

    let displayBuf = sourceBuf;
    if (isolatedChannel === 'R' || isolatedChannel === 'G' || isolatedChannel === 'B' || isolatedChannel === 'A') {
      const chIdx = isolatedChannel === 'R' ? 0 : isolatedChannel === 'G' ? 1 : isolatedChannel === 'B' ? 2 : 3;
      const out = new Uint8ClampedArray(sourceBuf.width * sourceBuf.height * 4);
      const src = sourceBuf.data;
      for (let i = 0; i < sourceBuf.width * sourceBuf.height; i++) {
        const v = src[i * 4 + chIdx];
        out[i * 4 + 0] = v;
        out[i * 4 + 1] = v;
        out[i * 4 + 2] = v;
        out[i * 4 + 3] = 255;
      }
      displayBuf = { width: sourceBuf.width, height: sourceBuf.height, data: out };
    }

    if (canvas.width !== displayBuf.width || canvas.height !== displayBuf.height) {
      canvas.width = displayBuf.width;
      canvas.height = displayBuf.height;
    }
    const ctx = canvas.getContext('2d');
    if (ctx) {
      const imgData = ctx.createImageData(displayBuf.width, displayBuf.height);
      imgData.data.set(displayBuf.data);
      ctx.putImageData(imgData, 0, 0);
    }
  }, [activeBuffer, isolatedChannel, isPixelExact]);

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas || !activeBuffer || !activeBuffer.data || activeBuffer.data.length === 0) return;
    const rect = canvas.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return;

    const rawX = Math.floor(((e.clientX - rect.left) / rect.width) * activeBuffer.width);
    const rawY = Math.floor(((e.clientY - rect.top) / rect.height) * activeBuffer.height);

    const x = Math.min(activeBuffer.width - 1, Math.max(0, rawX));
    const y = Math.min(activeBuffer.height - 1, Math.max(0, rawY));

    const idx = (y * activeBuffer.width + x) * 4;
    setHoverPixel({
      x,
      y,
      r: activeBuffer.data[idx + 0] ?? 0,
      g: activeBuffer.data[idx + 1] ?? 0,
      b: activeBuffer.data[idx + 2] ?? 0,
      a: activeBuffer.data[idx + 3] ?? 255,
    });
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div
        style={{
          position: 'relative',
          width: '100%',
          height: 220,
          backgroundColor: '#0c0e14',
          borderRadius: 6,
          border: '1px solid rgba(255, 255, 255, 0.08)',
          overflow: 'hidden',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <canvas
          ref={canvasRef}
          onMouseMove={handleMouseMove}
          onMouseLeave={() => setHoverPixel(null)}
          style={{
            maxWidth: '100%',
            maxHeight: '100%',
            objectFit: isPixelExact ? 'none' : 'contain',
            imageRendering: 'pixelated',
            cursor: 'crosshair',
          }}
        />

        {/* 1:1 Pixel Exact Toggle Button */}
        <button
          type="button"
          onClick={() => setIsPixelExact((prev) => !prev)}
          title={isPixelExact ? 'Pixel Exact (1:1 Native Resolution) — Click to Fit View' : 'Fitted to View — Click for 1:1 Native Resolution'}
          style={{
            position: 'absolute',
            bottom: 6,
            right: 6,
            height: 20,
            padding: '0 6px',
            backgroundColor: isPixelExact ? 'rgba(56, 189, 248, 0.25)' : 'rgba(10, 13, 20, 0.8)',
            border: `1px solid ${isPixelExact ? '#38bdf8' : 'rgba(255, 255, 255, 0.15)'}`,
            borderRadius: 3,
            color: isPixelExact ? '#38bdf8' : '#94a3b8',
            fontSize: 7.5,
            fontWeight: 700,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: 3,
          }}
        >
          {isPixelExact ? <Minimize size={10} /> : <Maximize size={10} />}
          <span>{isPixelExact ? '1:1 PIXEL' : 'FIT'}</span>
        </button>

        {/* Hover Pixel Probe HUD */}
        {hoverPixel && (
          <div
            style={{
              position: 'absolute',
              top: 6,
              right: 6,
              background: 'rgba(10, 13, 20, 0.95)',
              border: '1px solid rgba(56, 189, 248, 0.3)',
              padding: '4px 6px',
              borderRadius: 4,
              fontSize: 8,
              fontFamily: "'Geist Mono', monospace",
              color: '#f8fafc',
              pointerEvents: 'none',
              display: 'flex',
              flexDirection: 'column',
              gap: 2,
              boxShadow: '0 4px 12px rgba(0, 0, 0, 0.6)',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', color: '#64748b', fontSize: 7 }}>
              <span>X: {hoverPixel.x}</span>
              <span>Y: {hoverPixel.y}</span>
            </div>
            <div style={{ display: 'flex', gap: 5 }}>
              <span style={{ color: 'var(--pbr-ao)' }}>R:{hoverPixel.r} ({(hoverPixel.r / 255).toFixed(2)})</span>
              <span style={{ color: 'var(--pbr-rough)' }}>G:{hoverPixel.g} ({(hoverPixel.g / 255).toFixed(2)})</span>
            </div>
            <div style={{ display: 'flex', gap: 5 }}>
              <span style={{ color: 'var(--pbr-metal)' }}>B:{hoverPixel.b} ({(hoverPixel.b / 255).toFixed(2)})</span>
              <span style={{ color: 'var(--pbr-height)' }}>A:{hoverPixel.a} ({(hoverPixel.a / 255).toFixed(2)})</span>
            </div>
          </div>
        )}
      </div>

      {/* Channel Isolation Bar */}
      <div style={{ display: 'flex', gap: 3 }}>
        {[
          { key: 'RGBA' as const, label: 'RGBA', color: '#cbd5e1' },
          { key: 'R' as const, label: 'R', color: 'var(--pbr-ao)' },
          { key: 'G' as const, label: 'G', color: 'var(--pbr-rough)' },
          { key: 'B' as const, label: 'B', color: 'var(--pbr-metal)' },
          { key: 'A' as const, label: 'A', color: 'var(--pbr-height)' },
        ].map((btn) => (
          <button
            key={btn.key}
            onClick={() => setIsolatedChannel(btn.key)}
            style={{
              flex: 1,
              height: 22,
              backgroundColor: isolatedChannel === btn.key ? 'rgba(56, 189, 248, 0.2)' : 'rgba(32, 36, 46, 0.6)',
              border: isolatedChannel === btn.key ? `1px solid ${btn.color}` : '1px solid rgba(255, 255, 255, 0.08)',
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
    </div>
  );
};
