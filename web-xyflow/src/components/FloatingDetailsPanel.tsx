import React, { useState, useEffect, useRef } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  Download,
  Settings,
  FolderOpen,
  Info,
  Sparkles,
} from 'lucide-react';
import { PixelEngine, type TextureBuffer } from '../engine/pixelEngine';
import { TokenEngine, type CasingType } from '../engine/tokenizer';

export interface FloatingDetailsPanelProps {
  selectedNode: any | null;
  primaryAsset: string;
  onAssetChange: (asset: string) => void;
  activeBuffer?: TextureBuffer | null;
  onUpdateNodeData?: (nodeId: string, patch: any) => void;
  onExportTarget?: (filename: string) => void;
  onLoadBenchmark?: () => void;
  onAutoWireORMH?: () => void;
  nodeCount: number;
  edgeCount: number;
}

export const FloatingDetailsPanel: React.FC<FloatingDetailsPanelProps> = ({
  selectedNode,
  primaryAsset,
  onAssetChange,
  activeBuffer,
  onUpdateNodeData,
  onExportTarget,
  onLoadBenchmark,
  onAutoWireORMH,
  nodeCount,
  edgeCount,
}) => {
  const [isOpen, setIsOpen] = useState(true);
  const [isolatedChannel, setIsolatedChannel] = useState<'RGBA' | 'R' | 'G' | 'B' | 'A'>('RGBA');
  const [pattern, setPattern] = useState(TokenEngine.DEFAULT_PATTERN);
  const [casing, setCasing] = useState<CasingType>('UPPER_SNAKE');
  const [hoverPixel, setHoverPixel] = useState<{ x: number; y: number; r: number; g: number; b: number; a: number } | null>(null);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);

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

  // Render buffer to canvas
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

            {/* 2D Mini Viewport */}
            <div
              style={{
                width: '100%',
                height: 190,
                backgroundColor: '#12151c',
                borderRadius: 6,
                border: '1px solid rgba(255, 255, 255, 0.08)',
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
                <div style={{ color: '#64748b', fontSize: 10 }}>No Buffer Data</div>
              )}

              {/* Pixel Probe Tooltip */}
              {hoverPixel && (
                <div
                  style={{
                    position: 'absolute',
                    top: 6,
                    right: 6,
                    background: 'rgba(15, 23, 42, 0.88)',
                    border: '1px solid rgba(255, 255, 255, 0.12)',
                    padding: '3px 6px',
                    borderRadius: 3,
                    fontSize: 8,
                    fontFamily: 'monospace',
                    color: '#f8fafc',
                    pointerEvents: 'none',
                    display: 'flex',
                    gap: 5,
                  }}
                >
                  <span style={{ color: 'var(--pbr-ao)' }}>R:{hoverPixel.r}</span>
                  <span style={{ color: 'var(--pbr-rough)' }}>G:{hoverPixel.g}</span>
                  <span style={{ color: 'var(--pbr-metal)' }}>B:{hoverPixel.b}</span>
                  <span style={{ color: 'var(--pbr-height)' }}>A:{hoverPixel.a}</span>
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
                backgroundColor: 'rgba(32, 36, 46, 0.5)',
                border: '1px solid rgba(255, 255, 255, 0.06)',
                borderRadius: 6,
                padding: '10px',
              }}
            >
              <span style={{ fontSize: 9, fontWeight: 700, color: '#94a3b8', letterSpacing: 0.6 }}>
                NODE PARAMETERS
              </span>

              {/* 1. Levels Node Controls */}
              {nodeType === 'levels' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 10 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', color: '#cbd5e1' }}>
                    <span>Black Point</span>
                    <span style={{ fontFamily: 'monospace' }}>{nodeData.blackPoint ?? 0}</span>
                  </div>
                  <input
                    type="range"
                    min={0}
                    max={254}
                    value={nodeData.blackPoint ?? 0}
                    onChange={(e) => onUpdateNodeData?.(selectedNode.id, { blackPoint: Number(e.target.value) })}
                    style={{ accentColor: '#38bdf8', width: '100%', height: 4 }}
                  />

                  <div style={{ display: 'flex', justifyContent: 'space-between', color: '#cbd5e1', marginTop: 4 }}>
                    <span>Midtone Gamma</span>
                    <span style={{ fontFamily: 'monospace' }}>{(nodeData.gamma ?? 1.0).toFixed(2)}</span>
                  </div>
                  <input
                    type="range"
                    min={0.1}
                    max={3.0}
                    step={0.05}
                    value={nodeData.gamma ?? 1.0}
                    onChange={(e) => onUpdateNodeData?.(selectedNode.id, { gamma: Number(e.target.value) })}
                    style={{ accentColor: 'var(--pbr-rough)', width: '100%', height: 4 }}
                  />

                  <div style={{ display: 'flex', justifyContent: 'space-between', color: '#cbd5e1', marginTop: 4 }}>
                    <span>White Point</span>
                    <span style={{ fontFamily: 'monospace' }}>{nodeData.whitePoint ?? 255}</span>
                  </div>
                  <input
                    type="range"
                    min={1}
                    max={255}
                    value={nodeData.whitePoint ?? 255}
                    onChange={(e) => onUpdateNodeData?.(selectedNode.id, { whitePoint: Number(e.target.value) })}
                    style={{ accentColor: '#fbbf24', width: '100%', height: 4 }}
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
                    <span style={{ color: '#f8fafc', fontWeight: 500 }}>Linear / Raw</span>
                  </div>
                </div>
              )}

              {/* 3. Channel Combiner (Pack) Controls */}
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

              {/* 4. Channel Splitter (Unpack) Controls */}
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
          /* NO NODE SELECTED: GLOBAL PROJECT PROPERTIES                  */
          /* ============================================================ */
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <Info size={13} color="#94a3b8" />
              <span style={{ fontSize: 11, fontWeight: 700, color: '#f8fafc' }}>
                PROJECT OVERVIEW
              </span>
            </div>

            <div
              style={{
                backgroundColor: 'rgba(32, 36, 46, 0.5)',
                border: '1px solid rgba(255, 255, 255, 0.06)',
                borderRadius: 6,
                padding: '12px',
                display: 'flex',
                flexDirection: 'column',
                gap: 10,
              }}
            >
              {/* Asset Name Token */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <span style={{ fontSize: 9, color: '#94a3b8', fontWeight: 600 }}>Primary Asset Name</span>
                <input
                  type="text"
                  value={primaryAsset}
                  onChange={(e) => onAssetChange(e.target.value)}
                  style={{
                    height: 26,
                    backgroundColor: '#14171d',
                    border: '1px solid rgba(56, 189, 248, 0.3)',
                    borderRadius: 4,
                    padding: '0 8px',
                    color: '#38bdf8',
                    fontSize: 10,
                    fontWeight: 600,
                  }}
                />
              </div>

              {/* Graph Census */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, fontSize: 10 }}>
                <div style={{ background: '#14171d', padding: '6px', borderRadius: 4, border: '1px solid rgba(255, 255, 255, 0.04)' }}>
                  <span style={{ color: '#64748b', fontSize: 8, display: 'block' }}>TOTAL NODES</span>
                  <span style={{ fontSize: 14, fontWeight: 700, color: '#f8fafc' }}>{nodeCount}</span>
                </div>
                <div style={{ background: '#14171d', padding: '6px', borderRadius: 4, border: '1px solid rgba(255, 255, 255, 0.04)' }}>
                  <span style={{ color: '#64748b', fontSize: 8, display: 'block' }}>CONNECTIONS</span>
                  <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--pbr-packed)' }}>{edgeCount}</span>
                </div>
              </div>
            </div>

            {/* Quick Actions */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <span style={{ fontSize: 9, fontWeight: 700, color: '#64748b', letterSpacing: 0.5 }}>
                QUICK ACTIONS
              </span>

              <button
                onClick={onLoadBenchmark}
                style={{
                  height: 30,
                  backgroundColor: 'rgba(56, 189, 248, 0.12)',
                  border: '1px solid rgba(56, 189, 248, 0.35)',
                  borderRadius: 4,
                  color: '#7dd3fc',
                  fontWeight: 600,
                  fontSize: 10,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 6,
                  cursor: 'pointer',
                }}
              >
                <FolderOpen size={12} />
                Load Anthracite Concrete (4K)
              </button>

              <button
                onClick={onAutoWireORMH}
                style={{
                  height: 30,
                  backgroundColor: 'rgba(167, 139, 250, 0.12)',
                  border: '1px solid rgba(167, 139, 250, 0.35)',
                  borderRadius: 4,
                  color: '#c4b5fd',
                  fontWeight: 600,
                  fontSize: 10,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 6,
                  cursor: 'pointer',
                }}
              >
                <Sparkles size={12} />
                Auto-Wire ORMH Pack
              </button>
            </div>

            <div style={{ marginTop: 'auto', fontSize: 9, color: '#475569', textAlign: 'center' }}>
              Select any node on the canvas to configure its parameters.
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
