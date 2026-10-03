import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  Download,
  Settings,
  BarChart2,
  Crosshair,
  Maximize,
  Minimize,
} from 'lucide-react';
import type { Edge } from '@xyflow/react';
import { PixelEngine, type TextureBuffer, type HistogramData } from '../engine/pixelEngine';
import { GraphEvaluator } from '../engine/graphEvaluator';

export interface FloatingDetailsPanelProps {
  selectedNode: any | null;
  primaryAsset: string;
  onAssetChange: (asset: string) => void;
  activeBuffer?: TextureBuffer | null;
  edges?: Edge[];
  onUpdateNodeData?: (nodeId: string, patch: any) => void;
  onExportTarget?: (filename: string) => void;
}

export const FloatingDetailsPanel: React.FC<FloatingDetailsPanelProps> = ({
  selectedNode,
  primaryAsset,
  onAssetChange,
  activeBuffer,
  edges,
  onUpdateNodeData: _onUpdateNodeData,
  onExportTarget,
}) => {
  const [isOpen, setIsOpen] = useState(true);
  const [isolatedChannel, setIsolatedChannel] = useState<'RGBA' | 'R' | 'G' | 'B' | 'A'>('RGBA');
  const [hoverPixel, setHoverPixel] = useState<{ x: number; y: number; r: number; g: number; b: number; a: number } | null>(null);
  const [isPixelExact, setIsPixelExact] = useState(false);
  const [activeTab, setActiveTab] = useState<'viewport' | 'histogram'>('viewport');

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const histCanvasRef = useRef<HTMLCanvasElement | null>(null);

  // Evaluate output filename for inspected buffer export
  const evaluateFilename = () => {
    let slot = 'ORMH';
    if (selectedNode?.data?.detectedRole) {
      slot = selectedNode.data.detectedRole.toUpperCase();
    } else if (selectedNode?.data?.role) {
      slot = selectedNode.data.role.replace(/\s+/g, '_').toUpperCase();
    } else if (selectedNode?.id) {
      slot = selectedNode.id.toUpperCase();
    }
    const asset = primaryAsset || 'AnthraciteConcrete';
    const res = activeBuffer ? `${Math.round(activeBuffer.width / 1024)}K` : '4K';
    return `T_${asset}_${slot}_${res}.png`;
  };

  // Render 2D Viewport buffer to canvas (fast 512px proxy for 60fps instant switching)
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !activeBuffer) return;

    // Use fast interactive proxy when in fitted viewport mode to guarantee zero lag when switching nodes
    const sourceBuf = isPixelExact ? activeBuffer : (activeBuffer.proxy || activeBuffer);

    let displayBuf = sourceBuf;
    if (isolatedChannel === 'R') {
      displayBuf = PixelEngine.getIsolatedChannel(sourceBuf, 0);
    } else if (isolatedChannel === 'G') {
      displayBuf = PixelEngine.getIsolatedChannel(sourceBuf, 1);
    } else if (isolatedChannel === 'B') {
      displayBuf = PixelEngine.getIsolatedChannel(sourceBuf, 2);
    } else if (isolatedChannel === 'A') {
      displayBuf = PixelEngine.getIsolatedChannel(sourceBuf, 3);
    }

    canvas.width = displayBuf.width;
    canvas.height = displayBuf.height;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      const imgData = ctx.createImageData(displayBuf.width, displayBuf.height);
      imgData.data.set(displayBuf.data);
      ctx.putImageData(imgData, 0, 0);
    }
  }, [activeBuffer, isolatedChannel, isPixelExact]);

  // Compute and render Histogram (only when activeTab is 'histogram' to avoid lag)
  const histogramData: HistogramData | null = useMemo(() => {
    if (!activeBuffer || activeTab !== 'histogram') return null;
    return PixelEngine.computeHistogram(activeBuffer);
  }, [activeBuffer, activeTab]);

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

    // Helper to draw a channel curve
    const drawCurve = (bins: number[], color: string, alpha = 0.8) => {
      ctx.strokeStyle = color;
      ctx.fillStyle = color.replace(')', ', 0.12)').replace('rgb', 'rgba');
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      ctx.moveTo(0, h);

      for (let i = 0; i < 256; i++) {
        const x = (i / 255) * w;
        const norm = bins[i] / max;
        // log-like scaling for visibility of low frequency data
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

  const handleDownload = () => {
    const filename = evaluateFilename();
    if (activeBuffer) {
      PixelEngine.downloadBuffer(activeBuffer, filename);
    }
    onExportTarget?.(filename);
  };

  const nodeType = selectedNode?.type || '';
  const nodeData = selectedNode?.data || {};

  const portTelemetry = useMemo(() => {
    if (!selectedNode || !edges) return [];
    return GraphEvaluator.getNodePortTelemetry(selectedNode, edges);
  }, [selectedNode, edges]);

  return (
    <div
      style={{
        position: 'absolute',
        top: 52,
        right: 16,
        bottom: 24,
        zIndex: 20,
        display: 'flex',
        alignItems: 'flex-start',
        pointerEvents: 'none',
      }}
    >
      {/* Collapse / Expand Tab Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        title={isOpen ? 'Collapse Details' : 'Expand Details'}
        style={{
          pointerEvents: 'auto',
          width: 20,
          height: 40,
          backgroundColor: 'var(--panel-bg)',
          backdropFilter: 'blur(16px)',
          border: '1px solid var(--border-subtle)',
          borderRight: isOpen ? 'none' : '1px solid var(--border-subtle)',
          borderRadius: isOpen ? '8px 0 0 8px' : '8px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: '#94a3b8',
          cursor: 'pointer',
          marginTop: 10,
          boxShadow: '0 8px 20px rgba(0, 0, 0, 0.4)',
          transition: 'color 120ms ease, background-color 120ms ease',
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.color = '#f8fafc';
          e.currentTarget.style.backgroundColor = 'rgba(28, 33, 48, 0.95)';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.color = '#94a3b8';
          e.currentTarget.style.backgroundColor = 'var(--panel-bg)';
        }}
      >
        {isOpen ? <ChevronRight size={12} /> : <ChevronLeft size={12} />}
      </button>

      {/* Main Details Panel */}
      <div
        style={{
          width: isOpen ? 340 : 0,
          height: '100%',
          backgroundColor: 'var(--panel-bg)',
          backdropFilter: 'blur(20px)',
          border: isOpen ? '1px solid var(--border-subtle)' : 'none',
          borderRadius: 10,
          boxShadow: isOpen ? '0 16px 40px rgba(0, 0, 0, 0.65)' : 'none',
          display: 'flex',
          flexDirection: 'column',
          overflowY: 'auto',
          transition: 'width 200ms cubic-bezier(0.16, 1, 0.3, 1), opacity 200ms ease',
          opacity: isOpen ? 1 : 0,
          pointerEvents: isOpen ? 'auto' : 'none',
          padding: isOpen ? '14px' : '0',
          gap: 12,
        }}
      >
        {selectedNode ? (
          /* ============================================================ */
          /* SELECTED NODE DETAILS VIEW                                   */
          /* ============================================================ */
          <>
            {/* Header: Node Title & Type Pill */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <Settings size={13} color="#38bdf8" />
                <span style={{ fontSize: 11, fontWeight: 700, color: '#f8fafc' }}>
                  {nodeData.title || selectedNode.id}
                </span>
              </div>
              <span
                style={{
                  fontSize: 8,
                  fontWeight: 700,
                  background: 'rgba(56, 189, 248, 0.15)',
                  border: '1px solid rgba(56, 189, 248, 0.3)',
                  color: '#38bdf8',
                  padding: '2px 5px',
                  borderRadius: 3,
                  textTransform: 'uppercase',
                }}
              >
                {nodeType}
              </span>
            </div>

            {/* Viewport Sub-Header: Mode Switch (2D Viewport vs Histogram) */}
            <div style={{ display: 'flex', gap: 4, backgroundColor: 'rgba(10, 12, 18, 0.6)', padding: 2, borderRadius: 5 }}>
              <button
                onClick={() => setActiveTab('viewport')}
                style={{
                  flex: 1,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 4,
                  height: 22,
                  fontSize: 9,
                  fontWeight: 700,
                  borderRadius: 3,
                  border: 'none',
                  backgroundColor: activeTab === 'viewport' ? 'rgba(56, 189, 248, 0.2)' : 'transparent',
                  color: activeTab === 'viewport' ? '#38bdf8' : '#64748b',
                  cursor: 'pointer',
                }}
              >
                <Crosshair size={10} />
                <span>2D VIEWPORT</span>
              </button>
              <button
                onClick={() => setActiveTab('histogram')}
                style={{
                  flex: 1,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 4,
                  height: 22,
                  fontSize: 9,
                  fontWeight: 700,
                  borderRadius: 3,
                  border: 'none',
                  backgroundColor: activeTab === 'histogram' ? 'rgba(56, 189, 248, 0.2)' : 'transparent',
                  color: activeTab === 'histogram' ? '#38bdf8' : '#64748b',
                  cursor: 'pointer',
                }}
              >
                <BarChart2 size={10} />
                <span>HISTOGRAM</span>
              </button>
            </div>

            {/* 2D Mini Viewport OR Histogram Waveform */}
            <div
              style={{
                width: '100%',
                height: 190,
                backgroundColor: '#0c0e14',
                backgroundImage: 'radial-gradient(rgba(255, 255, 255, 0.05) 1px, transparent 0)',
                backgroundSize: '12px 12px',
                borderRadius: 6,
                border: '1px solid rgba(255, 255, 255, 0.08)',
                position: 'relative',
                overflow: 'hidden',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: activeTab === 'viewport' ? 'crosshair' : 'default',
              }}
            >
              {activeTab === 'viewport' ? (
                activeBuffer ? (
                  <>
                    <canvas
                      ref={canvasRef}
                      onMouseMove={handleMouseMove}
                      onMouseLeave={() => setHoverPixel(null)}
                      style={{
                        width: isPixelExact ? activeBuffer.width : '100%',
                        height: isPixelExact ? activeBuffer.height : '100%',
                        objectFit: isPixelExact ? 'none' : 'contain',
                        imageRendering: 'pixelated',
                      }}
                    />
                    <button
                      onClick={() => setIsPixelExact(!isPixelExact)}
                      title={isPixelExact ? 'Fit Viewport' : '1:1 Pixel Space'}
                      style={{
                        position: 'absolute',
                        bottom: 6,
                        right: 6,
                        background: 'rgba(15, 23, 42, 0.85)',
                        border: '1px solid rgba(255, 255, 255, 0.15)',
                        borderRadius: 3,
                        color: '#94a3b8',
                        padding: '2px 4px',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                      }}
                    >
                      {isPixelExact ? <Minimize size={11} /> : <Maximize size={11} />}
                    </button>
                  </>
                ) : (
                  <div style={{ color: '#64748b', fontSize: 10 }}>No Buffer Data</div>
                )
              ) : (
                /* Histogram Full Viewport */
                <canvas
                  ref={histCanvasRef}
                  width={310}
                  height={190}
                  style={{ width: '100%', height: '100%' }}
                />
              )}

              {/* Enhanced Precision Pixel Probe Tooltip */}
              {hoverPixel && activeTab === 'viewport' && (
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
                { key: 'RGBA', label: 'RGBA', color: '#cbd5e1' },
                { key: 'R', label: 'R', color: 'var(--pbr-ao)' },
                { key: 'G', label: 'G', color: 'var(--pbr-rough)' },
                { key: 'B', label: 'B', color: 'var(--pbr-metal)' },
                { key: 'A', label: 'A', color: 'var(--pbr-height)' },
              ].map((btn) => (
                <button
                  key={btn.key}
                  onClick={() => setIsolatedChannel(btn.key as any)}
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

            {/* Read-Only Node & Buffer Telemetry (Parameters are edited directly on node card) */}
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: 8,
                backgroundColor: 'rgba(20, 24, 34, 0.6)',
                border: '1px solid rgba(255, 255, 255, 0.06)',
                borderRadius: 6,
                padding: '10px',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: 9, fontWeight: 700, color: '#94a3b8', letterSpacing: 0.6 }}>
                  BUFFER & NODE TELEMETRY
                </span>
                {nodeData.isBypassed ? (
                  <span style={{ fontSize: 8, color: '#ef4444', fontWeight: 700 }}>MUTED / BYPASSED</span>
                ) : (
                  <span style={{ fontSize: 8, color: '#38bdf8', fontWeight: 700 }}>ACTIVE</span>
                )}
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 5, fontSize: 10 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: '#94a3b8' }}>Node ID</span>
                  <span style={{ color: '#f8fafc', fontFamily: "'Geist Mono', monospace", fontWeight: 600 }}>
                    {selectedNode.id}
                  </span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: '#94a3b8' }}>Type</span>
                  <span style={{ color: '#cbd5e1', fontWeight: 500, textTransform: 'capitalize' }}>
                    {nodeType}
                  </span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: '#94a3b8' }}>Buffer Resolution</span>
                  <span style={{ color: activeBuffer ? '#38bdf8' : '#64748b', fontWeight: 600, fontFamily: "'Geist Mono', monospace" }}>
                    {activeBuffer ? `${activeBuffer.width} × ${activeBuffer.height} px (${Math.round(activeBuffer.width / 1024)}K)` : 'No Buffer Available'}
                  </span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: '#94a3b8' }}>Color Depth</span>
                  <span style={{ color: '#cbd5e1', fontWeight: 500 }}>
                    {activeBuffer ? 'RGBA 32-bit (8bpc)' : '—'}
                  </span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: '#94a3b8' }}>Uncompressed Size</span>
                  <span style={{ color: '#94a3b8', fontFamily: "'Geist Mono', monospace" }}>
                    {activeBuffer ? `${((activeBuffer.width * activeBuffer.height * 4) / (1024 * 1024)).toFixed(1)} MB` : '0 MB'}
                  </span>
                </div>
              </div>

              {/* Dynamic Port & Socket Connection Telemetry */}
              {portTelemetry.length > 0 && (
                <div
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 5,
                    backgroundColor: 'rgba(10, 13, 20, 0.65)',
                    padding: '8px',
                    borderRadius: 4,
                    border: '1px solid rgba(255, 255, 255, 0.05)',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: 8.5, fontWeight: 700, color: '#94a3b8', letterSpacing: '0.04em' }}>
                      SOCKET CONNECTION TELEMETRY
                    </span>
                    <span style={{ fontSize: 7.5, color: '#64748b', fontFamily: "'Geist Mono', monospace" }}>
                      {portTelemetry.filter((p) => p.isConnected).length}/{portTelemetry.length} Active
                    </span>
                  </div>

                  {portTelemetry.map((port) => (
                    <div
                      key={port.handleId}
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        fontSize: 9,
                        fontFamily: "'Geist Mono', monospace",
                        padding: '4px 6px',
                        borderRadius: 3,
                        backgroundColor: port.isConnected ? 'rgba(34, 197, 94, 0.08)' : 'rgba(239, 68, 68, 0.08)',
                        border: `1px solid ${port.isConnected ? 'rgba(34, 197, 94, 0.22)' : 'rgba(239, 68, 68, 0.22)'}`,
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                        <span
                          style={{
                            width: 5,
                            height: 5,
                            borderRadius: '50%',
                            backgroundColor: port.isConnected ? '#22c55e' : '#ef4444',
                            boxShadow: `0 0 4px ${port.isConnected ? '#22c55e' : '#ef4444'}`,
                          }}
                        />
                        <span style={{ color: '#f8fafc', fontWeight: 600 }}>{port.sourceLabel || port.handleId}</span>
                      </div>
                      <span style={{ color: port.isConnected ? '#4ade80' : '#f87171', fontSize: 8.5 }}>
                        {port.isConnected ? `Connected (${port.sourceNodeId})` : `Disconnected [Fallback: ${port.fallbackValue ?? 'None'}]`}
                      </span>
                    </div>
                  ))}
                </div>
              )}

              {activeBuffer && (
                <button
                  onClick={handleDownload}
                  title="Download raw PNG of the currently inspected buffer"
                  style={{
                    height: 26,
                    backgroundColor: 'rgba(56, 189, 248, 0.12)',
                    border: '1px solid rgba(56, 189, 248, 0.3)',
                    borderRadius: 4,
                    color: '#38bdf8',
                    fontWeight: 600,
                    fontSize: 9.5,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 5,
                    cursor: 'pointer',
                    marginTop: 4,
                    transition: 'all 120ms ease',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = 'rgba(56, 189, 248, 0.22)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = 'rgba(56, 189, 248, 0.12)';
                  }}
                >
                  <Download size={11} />
                  <span>Download Inspected Buffer</span>
                </button>
              )}

              {/* Informative Guidance */}
              <div
                style={{
                  marginTop: 2,
                  padding: '6px 8px',
                  backgroundColor: 'rgba(255, 255, 255, 0.02)',
                  border: '1px solid rgba(255, 255, 255, 0.06)',
                  borderRadius: 4,
                  fontSize: 8.5,
                  color: '#64748b',
                  lineHeight: 1.4,
                }}
              >
                <span style={{ color: '#94a3b8', fontWeight: 600 }}>Node Editor:</span> Sliders and parameters are configured directly on the canvas node card.
              </div>
            </div>
          </>
        ) : (
          /* ============================================================ */
          /* NO NODE SELECTED: MINIMAL SLEEK EMPTY STATE                  */
          /* ============================================================ */
          <div
            style={{
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 12,
              padding: '32px 16px',
              textAlign: 'center',
            }}
          >
            <div
              style={{
                width: 40,
                height: 40,
                borderRadius: '50%',
                backgroundColor: 'rgba(56, 189, 248, 0.08)',
                border: '1px solid rgba(56, 189, 248, 0.2)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#38bdf8',
              }}
            >
              <Crosshair size={18} />
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <span style={{ fontSize: 11, fontWeight: 700, color: '#f8fafc', letterSpacing: 0.3 }}>
                No Node Selected
              </span>
              <span style={{ fontSize: 9.5, color: '#64748b', lineHeight: 1.5, maxWidth: 220 }}>
                Select any node on the canvas to inspect its 2D buffer, view the waveform histogram, or tune parameters.
              </span>
            </div>

            {/* Compact Asset Identifier */}
            <div
              style={{
                width: '100%',
                marginTop: 16,
                padding: '10px',
                backgroundColor: 'rgba(20, 24, 34, 0.5)',
                border: '1px solid rgba(255, 255, 255, 0.05)',
                borderRadius: 6,
                display: 'flex',
                flexDirection: 'column',
                gap: 4,
                textAlign: 'left',
              }}
            >
              <span style={{ fontSize: 8.5, color: '#94a3b8', fontWeight: 600 }}>Primary Asset Name</span>
              <input
                type="text"
                value={primaryAsset}
                onChange={(e) => onAssetChange(e.target.value)}
                placeholder="Asset_Name"
                style={{
                  height: 24,
                  backgroundColor: '#0c0e14',
                  border: '1px solid rgba(255, 255, 255, 0.1)',
                  borderRadius: 4,
                  padding: '0 8px',
                  color: '#38bdf8',
                  fontSize: 10,
                  fontWeight: 600,
                  outline: 'none',
                }}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
