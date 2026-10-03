import React, { useState, useMemo, useEffect, useRef } from 'react';
import type { Node, Edge } from '@xyflow/react';
import {
  X,
  Download,
  Check,
  Folder,
  FolderCheck,
  RefreshCw,
  AlertCircle,
  Layers,
  Sparkles,
  Plus,
  HardDrive,
  FileArchive,
} from 'lucide-react';
import type { TextureBuffer } from '../engine/pixelEngine';
import {
  ExportEngine,
  EXPORT_PRESETS,
  AVAILABLE_TOKENS,
  DEFAULT_GLOBAL_SETTINGS,
} from '../engine/exportEngine';
import type {
  ExportPresetId,
  GlobalExportSettings,
  PreflightOutputItem,
  TextureExportFormat,
  TextureBitDepth,
  TextureColorSpace,
  ExportResolutionSetting,
  TokenItem,
} from '../types/export';

export interface ExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  nodes: Node[];
  edges: Edge[];
  evaluatedBuffers: Record<string, TextureBuffer>;
  primaryAsset: string;
  onAssetChange?: (asset: string) => void;
  onUpdateNodeData?: (nodeId: string, patch: any) => void;
  onExportComplete?: (message: string) => void;
}

export const ExportModal: React.FC<ExportModalProps> = ({
  isOpen,
  onClose,
  nodes,
  edges,
  evaluatedBuffers,
  primaryAsset,
  onAssetChange,
  onUpdateNodeData,
  onExportComplete,
}) => {
  // Global settings state
  const [settings, setSettings] = useState<GlobalExportSettings>(() => ({
    ...DEFAULT_GLOBAL_SETTINGS,
    assetName: primaryAsset || 'AnthraciteConcrete',
  }));

  // Direct disk handle
  const [directoryHandle, setDirectoryHandle] = useState<any | null>(null);
  const [isExporting, setIsExporting] = useState(false);
  const [exportProgress, setExportProgress] = useState<{ current: number; total: number; filename: string } | null>(null);
  const [draggedTokenIdx, setDraggedTokenIdx] = useState<number | null>(null);

  const tokenIdRef = useRef(1);

  // Handle ESC key to close
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen && !isExporting) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, isExporting, onClose]);

  // Detect all textureOutput nodes in graph
  const outputNodes = useMemo(() => {
    return nodes.filter((n) => n.type === 'textureOutput');
  }, [nodes]);

  // Build preflight items from output nodes
  const preflightItems = useMemo<PreflightOutputItem[]>(() => {
    return outputNodes.map((n) => {
      const d = (n.data as any) || {};
      const slot = d.slot || 'ORM';
      const isConnected = edges.some((e) => e.target === n.id);
      const buf = evaluatedBuffers[n.id];
      const previewUrl = buf?.dataUrl;

      const format: TextureExportFormat =
        d.formatOverride && d.formatOverride !== 'inherit'
          ? d.formatOverride
          : settings.defaultFormat;

      const bitDepth: TextureBitDepth =
        d.bitDepthOverride && d.bitDepthOverride !== 'inherit'
          ? d.bitDepthOverride
          : settings.defaultBitDepth;

      const colorSpace: TextureColorSpace = d.colorSpace || 'linear';

      let resLabel = '4K';
      if (d.resolutionOverride && d.resolutionOverride !== 'inherit') {
        resLabel = `${Math.round(parseInt(d.resolutionOverride) / 1024)}K`;
      } else if (settings.masterResolution !== 'inherit') {
        resLabel = `${Math.round(parseInt(settings.masterResolution) / 1024)}K`;
      } else if (buf) {
        resLabel = `${Math.round(buf.width / 1024)}K`;
      }

      const resolvedFilename = ExportEngine.resolveFilename(settings.tokens, {
        project: settings.projectName,
        asset: settings.assetName,
        slot,
        res: resLabel,
        format,
        colorSpace: colorSpace === 'sRGB' ? 'sRGB' : 'Linear',
      });

      return {
        nodeId: n.id,
        title: d.title || 'Texture Output',
        slot,
        isConnected,
        previewUrl,
        format,
        bitDepth,
        colorSpace,
        resolution: resLabel,
        resolvedFilename,
        enabled: d.enabled !== false,
      };
    });
  }, [outputNodes, edges, evaluatedBuffers, settings]);

  // Live sample preview filename
  const samplePreviewFilename = useMemo(() => {
    return ExportEngine.resolveFilename(settings.tokens, {
      project: settings.projectName,
      asset: settings.assetName,
      slot: 'ORM',
      res: settings.masterResolution !== 'inherit' ? `${Math.round(parseInt(settings.masterResolution) / 1024)}K` : '4K',
      format: settings.defaultFormat,
      colorSpace: 'Linear',
    });
  }, [settings]);

  // Apply Preset
  const handleSelectPreset = (presetId: ExportPresetId) => {
    const preset = EXPORT_PRESETS.find((p) => p.id === presetId);
    if (!preset) return;
    setSettings((prev) => ({
      ...prev,
      presetId,
      tokens: [...preset.tokens],
    }));
  };

  // Reset tokens to current preset default
  const handleResetTokens = () => {
    const preset = EXPORT_PRESETS.find((p) => p.id === settings.presetId) || EXPORT_PRESETS[0];
    setSettings((prev) => ({
      ...prev,
      tokens: [...preset.tokens],
    }));
  };

  // Directory picker handler
  const handlePickDirectory = async () => {
    const handle = await ExportEngine.pickDirectory();
    if (handle) {
      setDirectoryHandle(handle);
      setSettings((prev) => ({ ...prev, directoryName: handle.name }));
    }
  };

  // Add token chip
  const handleAddToken = (tokenValue: string, label?: string) => {
    const isDelimiter = ['_', '-', '.'].includes(tokenValue);
    const newToken: TokenItem = {
      id: `tok_${tokenIdRef.current++}_${tokenValue}`,
      type: isDelimiter ? 'delimiter' : 'token',
      value: tokenValue,
      label: label || tokenValue,
    };
    setSettings((prev) => ({
      ...prev,
      tokens: [...prev.tokens, newToken],
      presetId: 'custom',
    }));
  };

  // Remove token chip
  const handleRemoveToken = (idx: number) => {
    setSettings((prev) => {
      const next = [...prev.tokens];
      next.splice(idx, 1);
      return { ...prev, tokens: next, presetId: 'custom' };
    });
  };

  // Drag-and-drop reorder
  const handleDragStart = (idx: number) => {
    setDraggedTokenIdx(idx);
  };

  const handleDragOver = (e: React.DragEvent, targetIdx: number) => {
    e.preventDefault();
    if (draggedTokenIdx === null || draggedTokenIdx === targetIdx) return;
    setSettings((prev) => {
      const next = [...prev.tokens];
      const [item] = next.splice(draggedTokenIdx, 1);
      next.splice(targetIdx, 0, item);
      return { ...prev, tokens: next, presetId: 'custom' };
    });
    setDraggedTokenIdx(targetIdx);
  };

  // Select all / Deselect all
  const handleToggleAll = (enabled: boolean) => {
    preflightItems.forEach((item) => {
      onUpdateNodeData?.(item.nodeId, { enabled });
    });
  };

  // Execute Batch Export
  const handleExecuteExport = async () => {
    const activeItems = preflightItems.filter((item) => item.enabled && item.isConnected);
    if (activeItems.length === 0) return;

    setIsExporting(true);
    const generatedFiles: { filename: string; blob: Blob }[] = [];

    try {
      for (let i = 0; i < activeItems.length; i++) {
        const item = activeItems[i];
        const buf = evaluatedBuffers[item.nodeId];
        if (!buf) continue;

        setExportProgress({
          current: i + 1,
          total: activeItems.length,
          filename: item.resolvedFilename,
        });

        // Determine resolution
        let targetRes: number | undefined;
        const node = outputNodes.find((n) => n.id === item.nodeId);
        const nodeResOverride = (node?.data as any)?.resolutionOverride;
        if (nodeResOverride && nodeResOverride !== 'inherit') {
          targetRes = parseInt(nodeResOverride);
        } else if (settings.masterResolution !== 'inherit') {
          targetRes = parseInt(settings.masterResolution);
        }

        const blob = await ExportEngine.encodeImageBlob(buf, item.format, targetRes);
        generatedFiles.push({
          filename: item.resolvedFilename,
          blob,
        });

        // Yield to browser main thread so progress bar and UI stay completely smooth
        await new Promise((resolve) => setTimeout(resolve, 30));
      }

      // Output Destination: Direct Disk folder vs Packaged ZIP
      if (directoryHandle) {
        await ExportEngine.exportToDirectory(generatedFiles, directoryHandle);
        onExportComplete?.(`Exported ${generatedFiles.length} textures directly to folder "${directoryHandle.name}"`);
      } else {
        // Fallback: Generate clean single .zip archive
        const zipName = `Textures_${settings.assetName || 'Asset'}_${Date.now()}.zip`;
        const zipBlob = await ExportEngine.createZip(generatedFiles);
        ExportEngine.triggerDownload(zipBlob, zipName);
        onExportComplete?.(`Packaged and downloaded ${generatedFiles.length} textures as ${zipName}`);
      }

      onClose();
    } catch (err: any) {
      console.error('Batch export failed:', err);
      alert(`Export error: ${err.message || 'Failed to encode files'}`);
    } finally {
      setIsExporting(false);
      setExportProgress(null);
    }
  };

  if (!isOpen) return null;

  const readyCount = preflightItems.filter((i) => i.enabled && i.isConnected).length;

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 100,
        backgroundColor: 'rgba(5, 7, 11, 0.78)',
        backdropFilter: 'blur(16px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 20,
        userSelect: 'none',
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget && !isExporting) onClose();
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: 860,
          maxHeight: '92vh',
          backgroundColor: '#0c0e15',
          border: '1px solid rgba(255, 255, 255, 0.1)',
          borderRadius: 10,
          boxShadow: '0 24px 60px rgba(0, 0, 0, 0.8), 0 0 1px rgba(255, 255, 255, 0.2)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}
      >
        {/* ============================================================ */}
        {/* MODAL HEADER                                                 */}
        {/* ============================================================ */}
        <div
          style={{
            padding: '14px 18px',
            borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            backgroundColor: 'rgba(20, 24, 34, 0.5)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div
              style={{
                width: 28,
                height: 28,
                borderRadius: 6,
                backgroundColor: 'rgba(74, 222, 128, 0.12)',
                border: '1px solid rgba(74, 222, 128, 0.3)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#4ade80',
              }}
            >
              <Download size={15} />
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 13, fontWeight: 700, color: '#f8fafc', letterSpacing: '0.02em' }}>
                  Export Textures Hub
                </span>
                <span
                  style={{
                    fontSize: 8,
                    fontFamily: "'Geist Mono', monospace",
                    fontWeight: 700,
                    color: '#4ade80',
                    backgroundColor: 'rgba(74, 222, 128, 0.12)',
                    padding: '1px 5px',
                    borderRadius: 3,
                    border: '1px solid rgba(74, 222, 128, 0.25)',
                  }}
                >
                  SUBSTANCE DCC PIPELINE
                </span>
              </div>
              <span style={{ fontSize: 9.5, color: '#94a3b8' }}>
                Batch configure tokens, formats, bit depth, and disk destination for all graph outputs.
              </span>
            </div>
          </div>

          <button
            onClick={onClose}
            disabled={isExporting}
            style={{
              width: 24,
              height: 24,
              borderRadius: 4,
              backgroundColor: 'rgba(255, 255, 255, 0.05)',
              border: '1px solid rgba(255, 255, 255, 0.08)',
              color: '#94a3b8',
              cursor: isExporting ? 'not-allowed' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <X size={13} />
          </button>
        </div>

        {/* ============================================================ */}
        {/* MODAL BODY (SCROLLABLE)                                      */}
        {/* ============================================================ */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* SECTION 1: PRESET SELECTION & GLOBAL SETTINGS */}
          <div
            style={{
              backgroundColor: 'rgba(20, 24, 34, 0.4)',
              border: '1px solid rgba(255, 255, 255, 0.06)',
              borderRadius: 8,
              padding: '12px 14px',
              display: 'flex',
              flexDirection: 'column',
              gap: 12,
            }}
          >
            {/* Engine Presets Row */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: 9, fontWeight: 700, color: '#94a3b8', letterSpacing: 0.5 }}>
                  INDUSTRY EXPORT PRESETS
                </span>
                <span style={{ fontSize: 8.5, color: '#64748b' }}>Select standard convention or customize</span>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 6 }}>
                {EXPORT_PRESETS.map((preset) => {
                  const isSelected = settings.presetId === preset.id;
                  return (
                    <button
                      key={preset.id}
                      type="button"
                      onClick={() => handleSelectPreset(preset.id)}
                      style={{
                        padding: '6px 8px',
                        borderRadius: 5,
                        backgroundColor: isSelected ? 'rgba(56, 189, 248, 0.15)' : 'rgba(255, 255, 255, 0.03)',
                        border: `1px solid ${isSelected ? '#38bdf8' : 'rgba(255, 255, 255, 0.07)'}`,
                        color: isSelected ? '#38bdf8' : '#cbd5e1',
                        fontSize: 9,
                        fontWeight: isSelected ? 700 : 500,
                        cursor: 'pointer',
                        textAlign: 'left',
                        transition: 'all 120ms ease',
                        boxShadow: isSelected ? '0 0 10px rgba(56, 189, 248, 0.2)' : 'none',
                      }}
                    >
                      <div style={{ fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {preset.name.split(' (')[0]}
                      </div>
                      <div style={{ fontSize: 7.5, color: '#94a3b8', marginTop: 2, fontFamily: "'Geist Mono', monospace" }}>
                        {preset.id === 'ue5' ? 'T_{asset}_{slot}' : preset.id === 'substance' ? '{asset}_{slot}_{res}' : '{asset}_{slot}'}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Global Properties: Asset Name, Master Resolution, Folder Picker */}
            <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr 1fr 1.4fr', gap: 10, paddingTop: 4 }}>
              {/* Asset Name */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                <span style={{ fontSize: 8.5, color: '#94a3b8', fontWeight: 600 }}>Primary Asset Name</span>
                <input
                  type="text"
                  value={settings.assetName}
                  onChange={(e) => {
                    const val = e.target.value;
                    setSettings((prev) => ({ ...prev, assetName: val }));
                    onAssetChange?.(val);
                  }}
                  placeholder="Asset_Identifier"
                  style={{
                    height: 26,
                    backgroundColor: '#0c0e14',
                    border: '1px solid rgba(255, 255, 255, 0.12)',
                    borderRadius: 4,
                    padding: '0 8px',
                    color: '#38bdf8',
                    fontFamily: "'Geist Mono', monospace",
                    fontSize: 9.5,
                    fontWeight: 600,
                    outline: 'none',
                  }}
                />
              </div>

              {/* Master Resolution */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                <span style={{ fontSize: 8.5, color: '#94a3b8', fontWeight: 600 }}>Master Resolution</span>
                <select
                  value={settings.masterResolution}
                  onChange={(e) => setSettings((prev) => ({ ...prev, masterResolution: e.target.value as ExportResolutionSetting }))}
                  style={{
                    height: 26,
                    backgroundColor: '#0c0e14',
                    border: '1px solid rgba(255, 255, 255, 0.12)',
                    borderRadius: 4,
                    padding: '0 6px',
                    color: '#f8fafc',
                    fontSize: 9.5,
                    outline: 'none',
                    cursor: 'pointer',
                  }}
                >
                  <option value="inherit">Inherit Graph (Original)</option>
                  <option value="1024">1024 × 1024 (1K)</option>
                  <option value="2048">2048 × 2048 (2K)</option>
                  <option value="4096">4096 × 4096 (4K)</option>
                  <option value="8192">8192 × 8192 (8K)</option>
                </select>
              </div>

              {/* Default Global Format */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                <span style={{ fontSize: 8.5, color: '#94a3b8', fontWeight: 600 }}>Global Default Format</span>
                <select
                  value={settings.defaultFormat}
                  onChange={(e) => setSettings((prev) => ({ ...prev, defaultFormat: e.target.value as TextureExportFormat }))}
                  style={{
                    height: 26,
                    backgroundColor: '#0c0e14',
                    border: '1px solid rgba(255, 255, 255, 0.12)',
                    borderRadius: 4,
                    padding: '0 6px',
                    color: '#4ade80',
                    fontSize: 9.5,
                    fontWeight: 600,
                    outline: 'none',
                    cursor: 'pointer',
                  }}
                >
                  <option value="PNG">PNG (Lossless)</option>
                  <option value="TGA">TGA (Uncompressed 32b)</option>
                  <option value="JPG">JPG (Compact)</option>
                  <option value="WEBP">WebP (Modern)</option>
                </select>
              </div>

              {/* Destination Folder Picker */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                <span style={{ fontSize: 8.5, color: '#94a3b8', fontWeight: 600 }}>Output Destination</span>
                <button
                  type="button"
                  onClick={handlePickDirectory}
                  title="Pick a directory on disk to write exported textures directly without browser popups"
                  style={{
                    height: 26,
                    padding: '0 10px',
                    backgroundColor: directoryHandle ? 'rgba(34, 197, 94, 0.15)' : 'rgba(255, 255, 255, 0.05)',
                    border: `1px solid ${directoryHandle ? '#22c55e' : 'rgba(255, 255, 255, 0.12)'}`,
                    borderRadius: 4,
                    color: directoryHandle ? '#22c55e' : '#cbd5e1',
                    fontSize: 9,
                    fontWeight: 600,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: 6,
                    cursor: 'pointer',
                    transition: 'all 120ms ease',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 5, overflow: 'hidden' }}>
                    {directoryHandle ? <FolderCheck size={12} /> : <Folder size={12} />}
                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {directoryHandle ? directoryHandle.name : 'Choose Folder on Disk...'}
                    </span>
                  </div>
                  {directoryHandle ? (
                    <span style={{ fontSize: 7.5, color: '#4ade80', fontWeight: 700 }}>DISK</span>
                  ) : (
                    <span style={{ fontSize: 7.5, color: '#94a3b8' }}>ZIP FALLBACK</span>
                  )}
                </button>
              </div>
            </div>
          </div>

          {/* SECTION 2: INTERACTIVE TOKEN NAMING BUILDER */}
          <div
            style={{
              backgroundColor: 'rgba(20, 24, 34, 0.4)',
              border: '1px solid rgba(255, 255, 255, 0.06)',
              borderRadius: 8,
              padding: '12px 14px',
              display: 'flex',
              flexDirection: 'column',
              gap: 10,
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <Sparkles size={11} color="#a855f7" />
                <span style={{ fontSize: 9, fontWeight: 700, color: '#94a3b8', letterSpacing: 0.5 }}>
                  DYNAMIC TOKEN NAMING BUILDER
                </span>
                <span style={{ fontSize: 7.5, color: '#64748b' }}>(Drag chips to rearrange order)</span>
              </div>
              <button
                type="button"
                onClick={handleResetTokens}
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: '#94a3b8',
                  fontSize: 8.5,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 4,
                  cursor: 'pointer',
                }}
              >
                <RefreshCw size={9} />
                <span>Reset to Default</span>
              </button>
            </div>

            {/* Draggable Active Token Sequence */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                flexWrap: 'wrap',
                gap: 5,
                padding: '8px 10px',
                backgroundColor: '#0a0c12',
                border: '1px solid rgba(255, 255, 255, 0.09)',
                borderRadius: 5,
                minHeight: 38,
              }}
            >
              {settings.tokens.map((token, idx) => {
                const isDelim = token.type === 'delimiter' || token.type === 'literal';
                return (
                  <div
                    key={token.id}
                    draggable
                    onDragStart={() => handleDragStart(idx)}
                    onDragOver={(e) => handleDragOver(e, idx)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 4,
                      padding: isDelim ? '2px 5px' : '3px 7px',
                      borderRadius: 4,
                      backgroundColor: isDelim ? 'rgba(255, 255, 255, 0.06)' : 'rgba(56, 189, 248, 0.16)',
                      border: `1px solid ${isDelim ? 'rgba(255, 255, 255, 0.15)' : '#38bdf8'}`,
                      color: isDelim ? '#cbd5e1' : '#38bdf8',
                      fontSize: 9,
                      fontWeight: 700,
                      fontFamily: "'Geist Mono', monospace",
                      cursor: 'grab',
                      userSelect: 'none',
                      boxShadow: isDelim ? 'none' : '0 1px 4px rgba(56, 189, 248, 0.15)',
                    }}
                  >
                    <span>{token.label || token.value}</span>
                    <button
                      type="button"
                      onClick={() => handleRemoveToken(idx)}
                      title="Remove token"
                      style={{
                        background: 'transparent',
                        border: 'none',
                        color: 'inherit',
                        cursor: 'pointer',
                        padding: 0,
                        display: 'flex',
                        alignItems: 'center',
                        opacity: 0.6,
                      }}
                      onMouseEnter={(e) => (e.currentTarget.style.opacity = '1')}
                      onMouseLeave={(e) => (e.currentTarget.style.opacity = '0.6')}
                    >
                      <X size={9} />
                    </button>
                  </div>
                );
              })}
            </div>

            {/* Available Tokens Palette to Insert */}
            <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 5, fontSize: 8.5 }}>
              <span style={{ color: '#64748b', fontWeight: 600 }}>Insert Token:</span>
              {AVAILABLE_TOKENS.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => handleAddToken(t.id, t.label)}
                  style={{
                    backgroundColor: 'rgba(255, 255, 255, 0.04)',
                    border: '1px solid rgba(255, 255, 255, 0.08)',
                    borderRadius: 3,
                    padding: '2px 6px',
                    color: '#94a3b8',
                    fontSize: 8,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 3,
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = 'rgba(56, 189, 248, 0.1)';
                    e.currentTarget.style.color = '#38bdf8';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.04)';
                    e.currentTarget.style.color = '#94a3b8';
                  }}
                >
                  <Plus size={8} />
                  <span>{t.label}</span>
                </button>
              ))}

              <span style={{ color: 'rgba(255, 255, 255, 0.2)', margin: '0 2px' }}>|</span>

              {/* Separators */}
              {['_', '-', '.'].map((sep) => (
                <button
                  key={sep}
                  type="button"
                  onClick={() => handleAddToken(sep, sep)}
                  style={{
                    backgroundColor: 'rgba(255, 255, 255, 0.04)',
                    border: '1px solid rgba(255, 255, 255, 0.08)',
                    borderRadius: 3,
                    padding: '2px 5px',
                    color: '#94a3b8',
                    fontSize: 8,
                    fontFamily: "'Geist Mono', monospace",
                    cursor: 'pointer',
                  }}
                >
                  +{sep}
                </button>
              ))}
            </div>

            {/* Real-Time Sample Preview Filename */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '6px 10px',
                backgroundColor: 'rgba(74, 222, 128, 0.06)',
                border: '1px solid rgba(74, 222, 128, 0.2)',
                borderRadius: 4,
                fontSize: 9,
              }}
            >
              <span style={{ color: '#94a3b8', fontWeight: 600 }}>Resolved Output Example:</span>
              <span style={{ color: '#4ade80', fontFamily: "'Geist Mono', monospace", fontWeight: 700 }}>
                {samplePreviewFilename}
              </span>
            </div>
          </div>

          {/* SECTION 3: LIVE PRE-FLIGHT OUTPUT NODES TABLE */}
          <div
            style={{
              backgroundColor: 'rgba(20, 24, 34, 0.4)',
              border: '1px solid rgba(255, 255, 255, 0.06)',
              borderRadius: 8,
              padding: '12px 14px',
              display: 'flex',
              flexDirection: 'column',
              gap: 10,
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <Layers size={11} color="#38bdf8" />
                <span style={{ fontSize: 9, fontWeight: 700, color: '#94a3b8', letterSpacing: 0.5 }}>
                  GRAPH OUTPUT MAPS ({outputNodes.length} DETECTED)
                </span>
              </div>
              <div style={{ display: 'flex', gap: 8, fontSize: 8.5 }}>
                <button
                  type="button"
                  onClick={() => handleToggleAll(true)}
                  style={{ background: 'transparent', border: 'none', color: '#38bdf8', cursor: 'pointer' }}
                >
                  Select All
                </button>
                <span style={{ color: 'rgba(255, 255, 255, 0.2)' }}>•</span>
                <button
                  type="button"
                  onClick={() => handleToggleAll(false)}
                  style={{ background: 'transparent', border: 'none', color: '#94a3b8', cursor: 'pointer' }}
                >
                  Deselect All
                </button>
              </div>
            </div>

            {/* Preflight Table */}
            {preflightItems.length > 0 ? (
              <div style={{ border: '1px solid rgba(255, 255, 255, 0.07)', borderRadius: 5, overflow: 'hidden' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: 9 }}>
                  <thead>
                    <tr style={{ backgroundColor: 'rgba(12, 14, 20, 0.9)', borderBottom: '1px solid rgba(255, 255, 255, 0.08)', color: '#94a3b8' }}>
                      <th style={{ padding: '6px 8px', width: 28, textAlign: 'center' }}>
                        <input
                          type="checkbox"
                          checked={readyCount === preflightItems.length && preflightItems.length > 0}
                          onChange={(e) => handleToggleAll(e.target.checked)}
                          style={{ cursor: 'pointer' }}
                        />
                      </th>
                      <th style={{ padding: '6px 8px' }}>Target Map</th>
                      <th style={{ padding: '6px 8px' }}>Status</th>
                      <th style={{ padding: '6px 8px' }}>Format</th>
                      <th style={{ padding: '6px 8px' }}>Color Space</th>
                      <th style={{ padding: '6px 8px' }}>Resolution</th>
                      <th style={{ padding: '6px 8px' }}>Resolved Filename</th>
                    </tr>
                  </thead>
                  <tbody>
                    {preflightItems.map((item) => (
                      <tr
                        key={item.nodeId}
                        style={{
                          borderBottom: '1px solid rgba(255, 255, 255, 0.04)',
                          backgroundColor: item.enabled ? 'transparent' : 'rgba(255, 255, 255, 0.01)',
                          opacity: item.enabled ? 1 : 0.45,
                        }}
                      >
                        {/* Checkbox */}
                        <td style={{ padding: '6px 8px', textAlign: 'center' }}>
                          <input
                            type="checkbox"
                            checked={item.enabled}
                            onChange={(e) => onUpdateNodeData?.(item.nodeId, { enabled: e.target.checked })}
                            style={{ cursor: 'pointer' }}
                          />
                        </td>

                        {/* Slot Name & Quick Edit */}
                        <td style={{ padding: '6px 8px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            {item.previewUrl ? (
                              <img
                                src={item.previewUrl}
                                alt={item.slot}
                                style={{ width: 20, height: 20, borderRadius: 2, border: '1px solid rgba(255, 255, 255, 0.1)', objectFit: 'cover' }}
                              />
                            ) : (
                              <div style={{ width: 20, height: 20, borderRadius: 2, backgroundColor: '#0c0e14', border: '1px solid rgba(255, 255, 255, 0.1)' }} />
                            )}
                            <input
                              type="text"
                              value={item.slot}
                              onChange={(e) => onUpdateNodeData?.(item.nodeId, { slot: e.target.value })}
                              style={{
                                width: 90,
                                height: 20,
                                backgroundColor: 'transparent',
                                border: '1px solid transparent',
                                borderRadius: 3,
                                color: '#f8fafc',
                                fontWeight: 700,
                                fontFamily: "'Geist Mono', monospace",
                                fontSize: 9,
                                padding: '0 4px',
                              }}
                              onFocus={(e) => (e.target.style.border = '1px solid #38bdf8')}
                              onBlur={(e) => (e.target.style.border = '1px solid transparent')}
                            />
                          </div>
                        </td>

                        {/* Wire Connection Status */}
                        <td style={{ padding: '6px 8px' }}>
                          {item.isConnected ? (
                            <span style={{ color: '#4ade80', fontSize: 8, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 4 }}>
                              <Check size={10} strokeWidth={3} />
                              <span>READY</span>
                            </span>
                          ) : (
                            <span style={{ color: '#f87171', fontSize: 8, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 4 }}>
                              <AlertCircle size={10} />
                              <span>UNWIRED</span>
                            </span>
                          )}
                        </td>

                        {/* Format Override Dropdown */}
                        <td style={{ padding: '6px 8px' }}>
                          <select
                            value={(outputNodes.find((n) => n.id === item.nodeId)?.data as any)?.formatOverride || 'inherit'}
                            onChange={(e) => onUpdateNodeData?.(item.nodeId, { formatOverride: e.target.value })}
                            style={{
                              backgroundColor: '#0c0e14',
                              border: '1px solid rgba(255, 255, 255, 0.1)',
                              borderRadius: 3,
                              color: '#cbd5e1',
                              fontSize: 8.5,
                              padding: '2px 4px',
                              outline: 'none',
                              cursor: 'pointer',
                            }}
                          >
                            <option value="inherit">Inherit ({settings.defaultFormat})</option>
                            <option value="PNG">PNG</option>
                            <option value="TGA">TGA</option>
                            <option value="JPG">JPG</option>
                            <option value="WEBP">WEBP</option>
                          </select>
                        </td>

                        {/* Color Space Pill */}
                        <td style={{ padding: '6px 8px' }}>
                          <button
                            type="button"
                            onClick={() =>
                              onUpdateNodeData?.(item.nodeId, {
                                colorSpace: item.colorSpace === 'linear' ? 'sRGB' : 'linear',
                              })
                            }
                            style={{
                              padding: '2px 6px',
                              borderRadius: 3,
                              fontSize: 8,
                              fontWeight: 700,
                              fontFamily: "'Geist Mono', monospace",
                              backgroundColor: item.colorSpace === 'sRGB' ? 'rgba(250, 204, 21, 0.15)' : 'rgba(56, 189, 248, 0.15)',
                              border: `1px solid ${item.colorSpace === 'sRGB' ? '#facc15' : '#38bdf8'}`,
                              color: item.colorSpace === 'sRGB' ? '#facc15' : '#38bdf8',
                              cursor: 'pointer',
                            }}
                          >
                            {item.colorSpace.toUpperCase()}
                          </button>
                        </td>

                        {/* Resolution */}
                        <td style={{ padding: '6px 8px', fontFamily: "'Geist Mono', monospace", color: '#94a3b8' }}>
                          {item.resolution}
                        </td>

                        {/* Filename Preview */}
                        <td style={{ padding: '6px 8px', fontFamily: "'Geist Mono', monospace", color: '#f8fafc', fontWeight: 600 }}>
                          {item.resolvedFilename}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div
                style={{
                  padding: '24px 16px',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: 8,
                  color: '#64748b',
                  fontSize: 9.5,
                }}
              >
                <AlertCircle size={20} color="#f87171" />
                <span>No Texture Output nodes found in the current canvas graph.</span>
                <span style={{ fontSize: 8.5 }}>Spawn a "Texture Output Target" node to connect and export maps.</span>
              </div>
            )}
          </div>
        </div>

        {/* ============================================================ */}
        {/* MODAL FOOTER & EXPORT EXECUTION                              */}
        {/* ============================================================ */}
        <div
          style={{
            padding: '12px 18px',
            borderTop: '1px solid rgba(255, 255, 255, 0.08)',
            backgroundColor: 'rgba(20, 24, 34, 0.65)',
            display: 'flex',
            flexDirection: 'column',
            gap: 10,
          }}
        >
          {/* Progress Bar during export */}
          {isExporting && exportProgress && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 8.5, color: '#94a3b8' }}>
                <span style={{ color: '#4ade80', fontWeight: 600 }}>
                  Exporting {exportProgress.current} of {exportProgress.total}: {exportProgress.filename}
                </span>
                <span>{Math.round((exportProgress.current / exportProgress.total) * 100)}%</span>
              </div>
              <div style={{ width: '100%', height: 4, backgroundColor: 'rgba(255, 255, 255, 0.1)', borderRadius: 2, overflow: 'hidden' }}>
                <div
                  style={{
                    width: `${(exportProgress.current / exportProgress.total) * 100}%`,
                    height: '100%',
                    backgroundColor: '#4ade80',
                    transition: 'width 100ms ease',
                    boxShadow: '0 0 8px #4ade80',
                  }}
                />
              </div>
            </div>
          )}

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 9 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 4, color: '#94a3b8' }}>
                {directoryHandle ? <HardDrive size={12} color="#22c55e" /> : <FileArchive size={12} color="#38bdf8" />}
                <span>
                  Target:{' '}
                  <strong style={{ color: directoryHandle ? '#22c55e' : '#38bdf8' }}>
                    {directoryHandle ? `Direct Disk (${directoryHandle.name})` : 'ZIP Package Download'}
                  </strong>
                </span>
              </div>
              <span style={{ color: 'rgba(255, 255, 255, 0.15)' }}>•</span>
              <span style={{ color: '#cbd5e1' }}>
                <strong>{readyCount}</strong> of {preflightItems.length} maps armed
              </span>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <button
                type="button"
                onClick={onClose}
                disabled={isExporting}
                style={{
                  height: 30,
                  padding: '0 14px',
                  backgroundColor: 'rgba(255, 255, 255, 0.05)',
                  border: '1px solid rgba(255, 255, 255, 0.1)',
                  borderRadius: 5,
                  color: '#94a3b8',
                  fontSize: 9.5,
                  fontWeight: 600,
                  cursor: isExporting ? 'not-allowed' : 'pointer',
                }}
              >
                Cancel
              </button>

              <button
                type="button"
                onClick={handleExecuteExport}
                disabled={isExporting || readyCount === 0}
                style={{
                  height: 30,
                  padding: '0 18px',
                  backgroundColor: readyCount > 0 ? '#22c55e' : 'rgba(255, 255, 255, 0.05)',
                  border: 'none',
                  borderRadius: 5,
                  color: readyCount > 0 ? '#0a0d14' : '#64748b',
                  fontSize: 10,
                  fontWeight: 800,
                  letterSpacing: '0.03em',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  cursor: readyCount > 0 && !isExporting ? 'pointer' : 'not-allowed',
                  transition: 'all 140ms ease',
                  boxShadow: readyCount > 0 ? '0 2px 14px rgba(34, 197, 94, 0.35)' : 'none',
                }}
                onMouseEnter={(e) => {
                  if (readyCount > 0 && !isExporting) {
                    e.currentTarget.style.backgroundColor = '#4ade80';
                    e.currentTarget.style.transform = 'translateY(-1px)';
                  }
                }}
                onMouseLeave={(e) => {
                  if (readyCount > 0 && !isExporting) {
                    e.currentTarget.style.backgroundColor = '#22c55e';
                    e.currentTarget.style.transform = 'translateY(0)';
                  }
                }}
              >
                <Download size={13} strokeWidth={2.5} />
                <span>
                  {isExporting ? 'Exporting Maps...' : `Export ${readyCount} Texture${readyCount === 1 ? '' : 's'}`}
                </span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
