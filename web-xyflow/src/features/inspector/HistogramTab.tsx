import React, { useEffect, useRef, useMemo } from 'react';
import { PixelEngine, type TextureBuffer, type HistogramData } from '../../engine/pixelEngine';
import type { ChannelKey } from './types';

export interface HistogramTabProps {
  activeBuffer?: TextureBuffer | null;
  isolatedChannel: ChannelKey;
}

export const HistogramTab: React.FC<HistogramTabProps> = ({
  activeBuffer,
  isolatedChannel,
}) => {
  const histCanvasRef = useRef<HTMLCanvasElement | null>(null);

  const histogramData: HistogramData | null = useMemo(() => {
    if (!activeBuffer) return null;
    return PixelEngine.computeHistogram(activeBuffer);
  }, [activeBuffer]);

  useEffect(() => {
    const canvas = histCanvasRef.current;
    if (!canvas || !histogramData) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const w = canvas.width;
    const h = canvas.height;
    ctx.clearRect(0, 0, w, h);

    // Dark grid background
    ctx.fillStyle = '#0c0e14';
    ctx.fillRect(0, 0, w, h);

    // Subtle grid lines at 25%, 50%, 75%
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.06)';
    ctx.lineWidth = 1;
    [0.25, 0.5, 0.75].forEach((pct) => {
      const x = Math.round(w * pct);
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, h);
      ctx.stroke();
    });

    const max = histogramData.maxCount || 1;

    const drawCurve = (bins: number[], color: string, alpha = 0.8) => {
      ctx.strokeStyle = color;
      ctx.fillStyle = color.replace(')', ', 0.12)').replace('rgb', 'rgba');
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      ctx.moveTo(0, h);

      for (let i = 0; i < 256; i++) {
        const x = (i / 255) * w;
        const norm = bins[i] / max;
        const scaled = Math.min(1, Math.sqrt(norm) * 1.15);
        const y = h - scaled * (h - 4);
        ctx.lineTo(x, y);
      }

      ctx.lineTo(w, h);
      ctx.closePath();
      ctx.globalAlpha = alpha;
      ctx.stroke();
      ctx.globalAlpha = 1.0;
    };

    if (isolatedChannel === 'RGBA') {
      drawCurve(histogramData.lum, '#f8fafc', 0.9);
      drawCurve(histogramData.r, '#fb7185', 0.65);
      drawCurve(histogramData.g, '#22c55e', 0.65);
      drawCurve(histogramData.b, '#38bdf8', 0.65);
    } else if (isolatedChannel === 'R') {
      drawCurve(histogramData.r, '#fb7185', 0.9);
    } else if (isolatedChannel === 'G') {
      drawCurve(histogramData.g, '#22c55e', 0.9);
    } else if (isolatedChannel === 'B') {
      drawCurve(histogramData.b, '#38bdf8', 0.9);
    } else if (isolatedChannel === 'A') {
      drawCurve(histogramData.lum, '#facc15', 0.9);
    }
  }, [histogramData, isolatedChannel]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div
        style={{
          width: '100%',
          height: 180,
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
          ref={histCanvasRef}
          width={280}
          height={180}
          style={{ width: '100%', height: '100%' }}
        />
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 8, color: '#64748b' }}>
        <span>0 (Black)</span>
        <span>64</span>
        <span>128 (Mid)</span>
        <span>192</span>
        <span>255 (White)</span>
      </div>
    </div>
  );
};
