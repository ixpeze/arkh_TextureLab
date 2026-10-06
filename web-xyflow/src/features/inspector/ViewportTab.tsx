// src/features/inspector/ViewportTab.tsx
import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Maximize, Minimize, Pin, Sliders, Grid } from 'lucide-react';
import type { TextureBuffer } from '../../types/buffer';
import type { ChannelKey, HoverPixelInfo } from './types';
import { Segmented } from '../../ui/Segmented';
import { Slider } from '../../ui/Slider';
import { Button } from '../../ui/Button';

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

  // A/B Compare state (replaces Compare node per D-05, TC-517)
  const [pinnedBufferA, setPinnedBufferA] = useState<TextureBuffer | null>(null);
  const [wipeProgress, setWipeProgress] = useState(0.5);

  // Tiling repeat state (replaces Seam node per D-05, TC-518)
  const [tilingRepeat, setTilingRepeat] = useState<1 | 2 | 3 | 4>(1);

  const handlePinA = useCallback(() => {
    if (activeBuffer) {
      // Clone buffer to pin A
      const copy: TextureBuffer = {
        width: activeBuffer.width,
        height: activeBuffer.height,
        data: new Uint8ClampedArray(activeBuffer.data),
      };
      setPinnedBufferA(copy);
    }
  }, [activeBuffer]);

  const handleClearPinA = useCallback(() => {
    setPinnedBufferA(null);
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !activeBuffer) return;

    const sourceBuf = activeBuffer;
    const baseW = sourceBuf.width;
    const baseH = sourceBuf.height;
    const targetW = baseW * tilingRepeat;
    const targetH = baseH * tilingRepeat;

    if (canvas.width !== targetW || canvas.height !== targetH) {
      canvas.width = targetW;
      canvas.height = targetH;
    }

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const imgData = ctx.createImageData(targetW, targetH);
    const dst = imgData.data;
    const srcB = sourceBuf.data;
    const srcA = pinnedBufferA?.data;
    const hasPinA = Boolean(srcA && pinnedBufferA && pinnedBufferA.width === baseW && pinnedBufferA.height === baseH);

    const wipeX = Math.round(targetW * wipeProgress);

    for (let ty = 0; ty < targetH; ty++) {
      const srcY = ty % baseH;
      for (let tx = 0; tx < targetW; tx++) {
        const srcX = tx % baseW;
        const srcIdx = (srcY * baseW + srcX) * 4;
        const dstIdx = (ty * targetW + tx) * 4;

        // Choose between Buffer A and Buffer B based on wipe progress
        const useA = hasPinA && tx < wipeX;
        const src = useA && srcA ? srcA : srcB;

        let r = src[srcIdx + 0];
        let g = src[srcIdx + 1];
        let b = src[srcIdx + 2];
        let a = src[srcIdx + 3];

        // Channel isolation (TC-515)
        if (isolatedChannel === 'R') {
          g = r;
          b = r;
          a = 255;
        } else if (isolatedChannel === 'G') {
          r = g;
          b = g;
          a = 255;
        } else if (isolatedChannel === 'B') {
          r = b;
          g = b;
          a = 255;
        } else if (isolatedChannel === 'A') {
          r = a;
          g = a;
          b = a;
          a = 255;
        }

        // Draw 1px amber wipe separator line
        if (hasPinA && Math.abs(tx - wipeX) <= 1) {
          dst[dstIdx + 0] = 255;
          dst[dstIdx + 1] = 176;
          dst[dstIdx + 2] = 46;
          dst[dstIdx + 3] = 255;
        } else {
          dst[dstIdx + 0] = r;
          dst[dstIdx + 1] = g;
          dst[dstIdx + 2] = b;
          dst[dstIdx + 3] = a;
        }
      }
    }

    ctx.putImageData(imgData, 0, 0);
  }, [activeBuffer, isolatedChannel, isPixelExact, pinnedBufferA, wipeProgress, tilingRepeat]);

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas || !activeBuffer || !activeBuffer.data || activeBuffer.data.length === 0) return;
    const rect = canvas.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return;

    const baseW = activeBuffer.width;
    const baseH = activeBuffer.height;
    const targetW = baseW * tilingRepeat;
    const targetH = baseH * tilingRepeat;

    const canvasX = Math.floor(((e.clientX - rect.left) / rect.width) * targetW);
    const canvasY = Math.floor(((e.clientY - rect.top) / rect.height) * targetH);

    const x = Math.min(baseW - 1, Math.max(0, canvasX % baseW));
    const y = Math.min(baseH - 1, Math.max(0, canvasY % baseH));

    const idx = (y * baseW + x) * 4;
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
    <div className="tl-viewport-tab">
      {/* Canvas Viewport Frame */}
      <div className="tl-viewport-frame">
        <canvas
          ref={canvasRef}
          onMouseMove={handleMouseMove}
          onMouseLeave={() => setHoverPixel(null)}
          className={`tl-viewport-canvas ${isPixelExact ? 'tl-viewport-canvas--1to1' : ''}`}
        />

        {/* 1:1 Pixel Exact Toggle Button */}
        <button
          type="button"
          onClick={() => setIsPixelExact((prev) => !prev)}
          title={isPixelExact ? 'Pixel Exact (1:1 Native Resolution) — Click to Fit View' : 'Fitted to View — Click for 1:1 Native Resolution'}
          className="tl-viewport-btn-float tl-viewport-btn-float--bottom-right"
        >
          {isPixelExact ? <Minimize size={11} /> : <Maximize size={11} />}
          <span>{isPixelExact ? '1:1 PIXEL' : 'FIT'}</span>
        </button>

        {/* Hover Pixel Probe HUD in Geist Mono */}
        {hoverPixel && (
          <div className="tl-probe-hud" role="status" aria-label="Pixel Probe Telemetry">
            <div className="tl-probe-hud__coords">
              <span>X: {hoverPixel.x}</span>
              <span>Y: {hoverPixel.y}</span>
            </div>
            <div className="tl-probe-hud__row">
              <span className="tl-probe-hud__r">R:{hoverPixel.r} ({(hoverPixel.r / 255).toFixed(2)})</span>
              <span className="tl-probe-hud__g">G:{hoverPixel.g} ({(hoverPixel.g / 255).toFixed(2)})</span>
            </div>
            <div className="tl-probe-hud__row">
              <span className="tl-probe-hud__b">B:{hoverPixel.b} ({(hoverPixel.b / 255).toFixed(2)})</span>
              <span className="tl-probe-hud__a">A:{hoverPixel.a} ({(hoverPixel.a / 255).toFixed(2)})</span>
            </div>
          </div>
        )}
      </div>

      {/* Channel Isolation Bar: RGBA | R | G | B | A */}
      <div className="tl-viewport-controls-row">
        <Segmented<ChannelKey>
          items={[
            { value: 'RGBA', label: 'RGBA', title: 'Full RGBA color' },
            { value: 'R', label: 'R', title: 'Isolate Red channel' },
            { value: 'G', label: 'G', title: 'Isolate Green channel' },
            { value: 'B', label: 'B', title: 'Isolate Blue channel' },
            { value: 'A', label: 'A', title: 'Isolate Alpha channel' },
          ]}
          value={isolatedChannel}
          onChange={setIsolatedChannel}
        />

        {/* Tiling repeat control (1x, 2x, 3x, 4x) */}
        <div className="tl-viewport-tiling" title="Tiling repeat (seam check)">
          <Grid size={11} color="var(--text-muted)" />
          <Segmented<string>
            items={[
              { value: '1', label: '1x' },
              { value: '2', label: '2x' },
              { value: '3', label: '3x' },
              { value: '4', label: '4x' },
            ]}
            value={tilingRepeat.toString()}
            onChange={(val) => setTilingRepeat(Number(val) as 1 | 2 | 3 | 4)}
          />
        </div>
      </div>

      {/* A/B Compare Tools (Replaces Compare Node per D-05) */}
      <div className="tl-viewport-compare">
        <div className="tl-viewport-compare__header">
          <div className="tl-viewport-compare__title">
            <Sliders size={12} color="var(--accent)" />
            <span>A/B Compare Tool</span>
          </div>

          {pinnedBufferA ? (
            <Button size="sm" variant="ghost" onClick={handleClearPinA}>
              Clear Pin A
            </Button>
          ) : (
            <Button
              size="sm"
              variant="secondary"
              icon={<Pin size={11} />}
              onClick={handlePinA}
              disabled={!activeBuffer}
            >
              Pin A Reference
            </Button>
          )}
        </div>

        {pinnedBufferA && (
          <div className="tl-viewport-compare__slider">
            <Slider
              label="Wipe A / B"
              value={Number(wipeProgress.toFixed(2))}
              min={0}
              max={1}
              step={0.01}
              onChange={setWipeProgress}
            />
          </div>
        )}
      </div>
    </div>
  );
};
