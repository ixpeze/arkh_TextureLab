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
import { PixelEngine, type TextureBuffer, type HistogramData } from '../engine/pixelEngine';
import { TokenEngine, type CasingType } from '../engine/tokenizer';
import { NodeSlider } from './node-system/NodeControls';

export interface FloatingDetailsPanelProps {
  selectedNode: any | null;
  primaryAsset: string;
  onAssetChange: (asset: string) => void;
  activeBuffer?: TextureBuffer | null;
  onUpdateNodeData?: (nodeId: string, patch: any) => void;
  onExportTarget?: (filename: string) => void;
}

export const FloatingDetailsPanel: React.FC<FloatingDetailsPanelProps> = ({
  selectedNode,
  primaryAsset,
  onAssetChange,
  activeBuffer,
  onUpdateNodeData,
  onExportTarget,
}) => {
  const [isOpen, setIsOpen] = useState(true);
  const [isolatedChannel, setIsolatedChannel] = useState<'RGBA' | 'R' | 'G' | 'B' | 'A'>('RGBA');
  const [pattern, setPattern] = useState(TokenEngine.DEFAULT_PATTERN);
  const [casing, setCasing] = useState<CasingType>('UPPER_SNAKE');
  const [hoverPixel, setHoverPixel] = useState<{ x: number; y: number; r: number; g: number; b: number; a: number } | null>(null);
  const [isPixelExact, setIsPixelExact] = useState(false);
  const [activeTab, setActiveTab] = useState<'viewport' | 'histogram'>('viewport');

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const histCanvasRef = useRef<HTMLCanvasElement | null>(null);

  // Evaluate output filename
  const evaluateFilename = () => {
    let slot = 'ORMH';
    if (selectedNode?.data?.detectedRole) {
      slot = selectedNode.data.detectedRole.toUpperCase();
    } else if (selectedNode?.data?.role) {
      slot = selectedNode.data.role.replace(/\s+/g, '_').toUpperCase();
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

  // Render 2D Viewport buffer to canvas
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

  // Compute and render Histogram
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

  const nodeType = selectedNode?.type || '';
  const nodeData = selectedNode?.data || {};

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

            {/* Node-Specific Configurable Properties */}
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
                  NODE PARAMETERS
                </span>
                {nodeData.isBypassed && (
                  <span style={{ fontSize: 8, color: '#ef4444', fontWeight: 700 }}>MUTED / BYPASS ACTIVE</span>
                )}
              </div>

              {/* 1. Levels Node Controls */}
              {nodeType === 'levels' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 10 }}>
                  <NodeSlider
                    label="In Black"
                    min={0}
                    max={254}
                    step={1}
                    value={nodeData.blackPoint ?? 0}
                    accentColor="#38bdf8"
                    onChange={(val) => onUpdateNodeData?.(selectedNode.id, { blackPoint: val })}
                  />
                  <NodeSlider
                    label="Gamma"
                    min={0.1}
                    max={3.0}
                    step={0.05}
                    value={nodeData.gamma ?? 1.0}
                    accentColor="var(--pbr-rough)"
                    onChange={(val) => onUpdateNodeData?.(selectedNode.id, { gamma: val })}
                  />
                  <NodeSlider
                    label="In White"
                    min={1}
                    max={255}
                    step={1}
                    value={nodeData.whitePoint ?? 255}
                    accentColor="#fbbf24"
                    onChange={(val) => onUpdateNodeData?.(selectedNode.id, { whitePoint: val })}
                  />
                  <NodeSlider
                    label="Out Black (Min)"
                    min={0}
                    max={255}
                    step={1}
                    value={nodeData.outBlack ?? 0}
                    accentColor="#94a3b8"
                    onChange={(val) => onUpdateNodeData?.(selectedNode.id, { outBlack: val })}
                  />
                  <NodeSlider
                    label="Out White (Max)"
                    min={0}
                    max={255}
                    step={1}
                    value={nodeData.outWhite ?? 255}
                    accentColor="#e2e8f0"
                    onChange={(val) => onUpdateNodeData?.(selectedNode.id, { outWhite: val })}
                  />
                </div>
              )}

              {/* 2. Texture Input Node Controls */}
              {nodeType === 'textureInput' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 10 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: '#94a3b8' }}>Detected Role</span>
                    <span style={{ color: nodeData.roleColor || '#38bdf8', fontWeight: 600 }}>{nodeData.role || 'PBR Map'}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: '#94a3b8' }}>Resolution</span>
                    <span style={{ color: '#f8fafc', fontWeight: 500 }}>{nodeData.res || '4K (4096x4096)'}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: '#94a3b8' }}>Color Space</span>
                    <span style={{ color: '#f8fafc', fontWeight: 500 }}>{nodeData.colorSpace || 'Linear / Raw'}</span>
                  </div>
                </div>
              )}

              {/* 3. Texture Blend Controls */}
              {nodeType === 'blend' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 10 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: '#94a3b8' }}>Mode</span>
                    <select
                      value={nodeData.mode || 'lerp'}
                      onChange={(e) => onUpdateNodeData?.(selectedNode.id, { mode: e.target.value })}
                      style={{
                        background: '#14171d',
                        border: '1px solid rgba(255,255,255,0.1)',
                        color: '#f8fafc',
                        borderRadius: 3,
                        fontSize: 9,
                        padding: '1px 4px',
                      }}
                    >
                      <option value="lerp">Normal (Lerp)</option>
                      <option value="multiply">Multiply</option>
                      <option value="screen">Screen</option>
                      <option value="overlay">Overlay</option>
                      <option value="add">Add</option>
                      <option value="min">Darken (Min)</option>
                      <option value="max">Lighten (Max)</option>
                    </select>
                  </div>
                  <NodeSlider
                    label="Opacity"
                    min={0.0}
                    max={1.0}
                    step={0.01}
                    value={nodeData.opacity ?? 1.0}
                    accentColor="#f59e0b"
                    onChange={(val) => onUpdateNodeData?.(selectedNode.id, { opacity: val })}
                  />
                </div>
              )}

              {/* 4. Normal Green Flip Controls */}
              {nodeType === 'normalFlip' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 10 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: '#94a3b8' }}>Orientation</span>
                    <span style={{ color: 'var(--pbr-normal)', fontWeight: 600 }}>
                      {nodeData.mode === 'gl_to_dx' ? 'OpenGL → DirectX' : 'DirectX → OpenGL'}
                    </span>
                  </div>
                  <NodeSlider
                    label="Strength"
                    min={0.0}
                    max={2.0}
                    step={0.05}
                    value={nodeData.strength ?? 1.0}
                    accentColor="var(--pbr-normal)"
                    onChange={(val) => onUpdateNodeData?.(selectedNode.id, { strength: val })}
                  />
                </div>
              )}

              {/* 5. Normal Blend (RNM) Controls */}
              {nodeType === 'normalBlend' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 10 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: '#94a3b8' }}>Algorithm</span>
                    <span style={{ color: 'var(--pbr-normal)', fontWeight: 600 }}>UE5 Reoriented (RNM)</span>
                  </div>
                  <NodeSlider
                    label="Detail Intensity"
                    min={0.0}
                    max={2.0}
                    step={0.05}
                    value={nodeData.detailStrength ?? 1.0}
                    accentColor="var(--pbr-normal)"
                    onChange={(val) => onUpdateNodeData?.(selectedNode.id, { detailStrength: val })}
                  />
                </div>
              )}

              {/* 6. Channel Swizzle Controls */}
              {nodeType === 'channelSwizzle' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 10 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: '#94a3b8' }}>Routing Profile</span>
                    <span style={{ color: '#818cf8', fontWeight: 600 }}>
                      {`${nodeData.rSrc || 'r'}, ${nodeData.gSrc || 'g'}, ${nodeData.bSrc || 'b'}, ${nodeData.aSrc || 'a'}`.toUpperCase()}
                    </span>
                  </div>
                  <div style={{ fontSize: 9, color: '#64748b' }}>
                    Configure channel matrix mapping on the node card or use presets.
                  </div>
                </div>
              )}

              {/* 7. Channel Combiner (Pack) Controls */}
              {nodeType === 'channelCombiner' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 10 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: '#94a3b8' }}>Packing Profile</span>
                    <span style={{ color: 'var(--pbr-packed)', fontWeight: 600 }}>ORMH (Unreal / Unity)</span>
                  </div>
                  <div style={{ fontSize: 9, color: '#64748b' }}>
                    R: Ambient Occlusion | G: Roughness | B: Metallic | A: Height
                  </div>
                </div>
              )}

              {/* 8. Channel Splitter (Unpack) Controls */}
              {nodeType === 'channelSplitter' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 10 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: '#94a3b8' }}>Mode</span>
                    <span style={{ color: 'var(--pbr-packed)', fontWeight: 600 }}>Multiplex Breakout</span>
                  </div>
                  <div style={{ fontSize: 9, color: '#64748b' }}>
                    Splits RGBA buffer into 4 discrete channels for mix-and-match editing.
                  </div>
                </div>
              )}

              {/* 5. Texture Output Target Controls */}
              {nodeType === 'textureOutput' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <span style={{ fontSize: 9, fontWeight: 700, color: '#38bdf8' }}>
                    TOKEN-BASED EXPORT
                  </span>

                  {/* Token Chips */}
                  <div style={{ display: 'flex', gap: 3, flexWrap: 'wrap' }}>
                    {['{prefix}', '{asset}', '{slot}', '{res}', '{ext}'].map((tok) => (
                      <button
                        key={tok}
                        onClick={() => setPattern((p) => p + tok)}
                        style={{
                          background: 'rgba(56, 189, 248, 0.1)',
                          border: '1px dashed rgba(56, 189, 248, 0.4)',
                          borderRadius: 3,
                          color: '#38bdf8',
                          fontSize: 9,
                          fontWeight: 600,
                          padding: '1px 5px',
                          cursor: 'pointer',
                        }}
                      >
                        {tok}
                      </button>
                    ))}
                  </div>

                  <input
                    type="text"
                    value={pattern}
                    onChange={(e) => setPattern(e.target.value)}
                    style={{
                      height: 26,
                      backgroundColor: '#14171d',
                      border: '1px solid rgba(255, 255, 255, 0.1)',
                      borderRadius: 3,
                      padding: '0 6px',
                      color: '#f8fafc',
                      fontSize: 10,
                      fontFamily: 'monospace',
                    }}
                  />

                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 10 }}>
                    <span style={{ color: '#94a3b8' }}>Casing</span>
                    <select
                      value={casing}
                      onChange={(e) => setCasing(e.target.value as CasingType)}
                      style={{
                        backgroundColor: '#14171d',
                        border: '1px solid rgba(255, 255, 255, 0.1)',
                        color: '#f8fafc',
                        borderRadius: 3,
                        padding: '2px 4px',
                        fontSize: 10,
                      }}
                    >
                      <option value="original">Original</option>
                      <option value="UPPER_SNAKE">UPPER_SNAKE</option>
                      <option value="snake_case">snake_case</option>
                      <option value="PascalCase">PascalCase</option>
                    </select>
                  </div>

                  <div
                    style={{
                      background: 'rgba(74, 222, 128, 0.08)',
                      border: '1px solid rgba(74, 222, 128, 0.25)',
                      borderRadius: 3,
                      padding: '4px 6px',
                      fontSize: 9,
                      fontFamily: 'monospace',
                      color: '#4ade80',
                      wordBreak: 'break-all',
                    }}
                  >
                    {evaluateFilename()}
                  </div>

                  <button
                    onClick={handleDownload}
                    style={{
                      height: 32,
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
                      marginTop: 4,
                    }}
                  >
                    <Download size={13} />
                    EXPORT TEXTURE
                  </button>
                </div>
              )}
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
