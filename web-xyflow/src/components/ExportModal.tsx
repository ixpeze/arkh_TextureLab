import React, { useState, useMemo, useEffect, useRef } from 'react';
import type { Node, Edge } from '@xyflow/react';
import {
  X,
  Download,
  Check,
  Folder,
  FolderCheck,
  AlertCircle,
  Layers,
  Sparkles,
  HardDrive,
  FileArchive,
  Save,
  Plus,
  Trash2,
  RotateCcw,
} from 'lucide-react';
import type { TextureBuffer } from '../engine/pixelEngine';
import {
  ExportEngine,
  DEFAULT_PRESETS,
  DEFAULT_GLOBAL_SETTINGS,
} from '../engine/exportEngine';
import type {
  ExportPreset,
  GlobalExportSettings,
  PreflightOutputItem,
  TextureExportFormat,
  TextureBitDepth,
  TextureColorSpace,
  ExportResolutionSetting,
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
  // Presets state persisted in localStorage
  const [presets, setPresets] = useState<ExportPreset[]>(() => ExportEngine.loadPresets());
  const [selectedPresetId, setSelectedPresetId] = useState<string>('ue5');
  const [pattern, setPattern] = useState<string>('T_{asset}_{slot}');

  // Preset management dialog state
  const [showNewPresetInput, setShowNewPresetInput] = useState(false);
  const [newPresetName, setNewPresetName] = useState('');
  const [feedback, setFeedback] = useState<{ message: string; type: 'success' | 'info' | 'error' } | null>(null);

  // Global settings state
  const [settings, setSettings] = useState<GlobalExportSettings>(() => ({
    ...DEFAULT_GLOBAL_SETTINGS,
    assetName: primaryAsset || 'AnthraciteConcrete',
  }));

  // Direct disk handle
  const [directoryHandle, setDirectoryHandle] = useState<any | null>(null);
  const [isExporting, setIsExporting] = useState(false);
  const [exportProgress, setExportProgress] = useState<{ current: number; total: number; filename: string } | null>(null);

  const patternInputRef = useRef<HTMLInputElement | null>(null);
  const nextPresetCounter = useRef(1);

  // Show transient feedback notifications
  const showFeedback = (message: string, type: 'success' | 'info' | 'error' = 'success') => {
    setFeedback({ message, type });
    setTimeout(() => {
      setFeedback(null);
    }, 3200);
  };

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

  // Live pattern validation
  const validation = useMemo(() => {
    return ExportEngine.validatePattern(pattern);
  }, [pattern]);

  // Build preflight items from output nodes
  const preflightItems = useMemo<PreflightOutputItem[]>(() => {
    return outputNodes.map((n) => {
      const d = (n.data as any) || {};
      const slot = d.isSlotOverridden && d.slot ? d.slot : (d.autoDetectedSlot || d.slot || 'ORM');
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

      const colorSpace: TextureColorSpace =
        d.isColorSpaceOverridden && d.colorSpace
          ? d.colorSpace
          : (d.autoDetectedColorSpace || d.colorSpace || 'linear');

      let resLabel = '4K';
      if (d.resolutionOverride && d.resolutionOverride !== 'inherit') {
        resLabel = `${Math.round(parseInt(d.resolutionOverride) / 1024)}K`;
      } else if (settings.masterResolution !== 'inherit') {
        resLabel = `${Math.round(parseInt(settings.masterResolution) / 1024)}K`;
      } else if (buf) {
        resLabel = `${Math.round(buf.width / 1024)}K`;
      }

      const resolvedFilename = ExportEngine.resolveFilename(pattern, {
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
        isSlotOverridden: !!d.isSlotOverridden,
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
  }, [outputNodes, edges, evaluatedBuffers, settings, pattern]);

  // Live sample preview filename
  const samplePreviewFilename = useMemo(() => {
    return ExportEngine.resolveFilename(pattern, {
      project: settings.projectName,
      asset: settings.assetName,
      slot: 'ORM',
      res: settings.masterResolution !== 'inherit' ? `${Math.round(parseInt(settings.masterResolution) / 1024)}K` : '4K',
      format: settings.defaultFormat,
      colorSpace: 'Linear',
    });
  }, [pattern, settings]);

  // Handle Preset Selection from dropdown
  const handleSelectPreset = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const presetId = e.target.value;
    setSelectedPresetId(presetId);
    const preset = presets.find((p) => p.id === presetId);
    if (preset) {
      setPattern(preset.pattern);
    }
  };

  // Create new preset from current pattern
  const handleCreatePreset = () => {
    const trimmed = newPresetName.trim();
    if (!trimmed) return;
    const newId = `custom_${Date.now()}_${nextPresetCounter.current++}`;
    const newPreset: ExportPreset = {
      id: newId,
      name: trimmed,
      pattern: pattern,
      isBuiltIn: false,
    };
    const updated = [...presets, newPreset];
    setPresets(updated);
    ExportEngine.savePresets(updated);
    setSelectedPresetId(newId);
    setNewPresetName('');
    setShowNewPresetInput(false);
    showFeedback(`Created preset "${trimmed}"`, 'success');
  };

  // Save changes to currently selected preset
  const handleSaveCurrentPreset = () => {
    const current = presets.find((p) => p.id === selectedPresetId);
    if (!current) return;
    if (current.isBuiltIn) {
      // Prompt user to save as a custom copy
      setNewPresetName(`${current.name.split(' (')[0]} (Custom)`);
      setShowNewPresetInput(true);
      return;
    }
    const updated = presets.map((p) => (p.id === current.id ? { ...p, pattern } : p));
    setPresets(updated);
    ExportEngine.savePresets(updated);
    showFeedback(`Saved changes to "${current.name}"`, 'success');
  };

  // Delete currently selected custom preset
  const handleDeletePreset = () => {
    const current = presets.find((p) => p.id === selectedPresetId);
    if (!current || current.isBuiltIn) return;
    const updated = presets.filter((p) => p.id !== current.id);
    setPresets(updated);
    ExportEngine.savePresets(updated);
    setSelectedPresetId('ue5');
    const defaultPreset = updated.find((p) => p.id === 'ue5') || updated[0];
    if (defaultPreset) setPattern(defaultPreset.pattern);
    showFeedback(`Deleted preset "${current.name}"`, 'info');
  };

  // Reset presets to built-in defaults
  const handleResetPresets = () => {
    const defaults = [...DEFAULT_PRESETS];
    setPresets(defaults);
    ExportEngine.savePresets(defaults);
    setSelectedPresetId('ue5');
    setPattern(defaults[0].pattern);
    showFeedback('Restored default industry presets', 'info');
  };

  // Insert token at current text cursor position
  const handleInsertToken = (tokenString: string) => {
    const input = patternInputRef.current;
    if (input) {
      const start = input.selectionStart ?? pattern.length;
      const end = input.selectionEnd ?? pattern.length;
      const before = pattern.substring(0, start);
      const after = pattern.substring(end);
      const newPattern = `${before}${tokenString}${after}`;
      setPattern(newPattern);
      requestAnimationFrame(() => {
        input.focus();
        const nextPos = start + tokenString.length;
        input.setSelectionRange(nextPos, nextPos);
      });
    } else {
      setPattern((prev) => `${prev}${tokenString}`);
    }
  };

  // Directory picker handler
  const handlePickDirectory = async () => {
    const handle = await ExportEngine.pickDirectory();
    if (handle) {
      setDirectoryHandle(handle);
      setSettings((prev) => ({ ...prev, directoryName: handle.name }));
    }
  };

  // Select all / Deselect all
  const handleToggleAll = (enabled: boolean) => {
    preflightItems.forEach((item) => {
      onUpdateNodeData?.(item.nodeId, { enabled });
    });
  };

  // Execute Batch Export
  const handleExecuteExport = async () => {
    if (!validation.isValid) return;
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

        // Yield to browser main thread so progress bar and UI stay smooth
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
  const currentPreset = presets.find((p) => p.id === selectedPresetId);
  const isCustomPreset = currentPreset && !currentPreset.isBuiltIn;

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 100,
        backgroundColor: 'rgba(5, 7, 11, 0.82)',
        backdropFilter: 'blur(16px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 24,
        userSelect: 'none',
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget && !isExporting) onClose();
      }}
    >
      <div
        style={{
          width: '95%',
          maxWidth: 1040,
          maxHeight: '94vh',
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
        {/* MODAL HEADER: Minimalist single "Export" header             */}
        {/* ============================================================ */}
        <div
          style={{
            padding: '14px 22px',
            borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            backgroundColor: 'rgba(20, 24, 34, 0.65)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
            <Download size={16} color="#4ade80" />
            <span style={{ fontSize: 15, fontWeight: 800, color: '#f8fafc', letterSpacing: '0.02em' }}>
              Export
            </span>
          </div>

          <button
            onClick={onClose}
            disabled={isExporting}
            title="Close Export window (Esc)"
            style={{
              width: 26,
              height: 26,
              borderRadius: 4,
              backgroundColor: 'rgba(255, 255, 255, 0.05)',
              border: '1px solid rgba(255, 255, 255, 0.08)',
              color: '#94a3b8',
              cursor: isExporting ? 'not-allowed' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'all 120ms ease',
            }}
          >
            <X size={13} />
          </button>
        </div>

        {/* Transient Feedback Banner */}
        {feedback && (
          <div
            style={{
              padding: '6px 20px',
              backgroundColor:
                feedback.type === 'success'
                  ? 'rgba(34, 197, 94, 0.15)'
                  : feedback.type === 'error'
                  ? 'rgba(239, 68, 68, 0.15)'
                  : 'rgba(56, 189, 248, 0.15)',
              borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
              color:
                feedback.type === 'success'
                  ? '#4ade80'
                  : feedback.type === 'error'
                  ? '#f87171'
                  : '#38bdf8',
              fontSize: 9,
              fontWeight: 600,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <span>{feedback.message}</span>
            <button
              onClick={() => setFeedback(null)}
              style={{ background: 'transparent', border: 'none', color: 'inherit', cursor: 'pointer', padding: 0 }}
            >
              <X size={11} />
            </button>
          </div>
        )}

        {/* ============================================================ */}
        {/* MODAL BODY (SCROLLABLE)                                      */}
        {/* ============================================================ */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '18px 22px', display: 'flex', flexDirection: 'column', gap: 16 }}>
          
          {/* SECTION 1: PRESETS DROPDOWN & GLOBAL PIPELINE SETTINGS */}
          <div
            style={{
              backgroundColor: 'rgba(20, 24, 34, 0.45)',
              border: '1px solid rgba(255, 255, 255, 0.07)',
              borderRadius: 8,
              padding: '14px 16px',
              display: 'flex',
              flexDirection: 'column',
              gap: 12,
            }}
          >
            {/* Presets Row: Dropdown + Actions */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: 9.5, fontWeight: 700, color: '#94a3b8', letterSpacing: 0.5 }}>
                  Presets
                </span>
                <span style={{ fontSize: 8.5, color: '#64748b' }}>
                  Select, save, or customize export presets
                </span>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                {/* Presets Dropdown */}
                <select
                  value={selectedPresetId}
                  onChange={handleSelectPreset}
                  style={{
                    flex: '1 1 240px',
                    height: 28,
                    backgroundColor: '#0c0e14',
                    border: '1px solid rgba(255, 255, 255, 0.15)',
                    borderRadius: 4,
                    padding: '0 8px',
                    color: '#f8fafc',
                    fontSize: 9.5,
                    fontWeight: 600,
                    outline: 'none',
                    cursor: 'pointer',
                  }}
                >
                  <optgroup label="Industry Standard Presets">
                    {presets
                      .filter((p) => p.isBuiltIn)
                      .map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name}
                        </option>
                      ))}
                  </optgroup>
                  {presets.some((p) => !p.isBuiltIn) && (
                    <optgroup label="Custom User Presets">
                      {presets
                        .filter((p) => !p.isBuiltIn)
                        .map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.name} ({p.pattern})
                          </option>
                        ))}
                    </optgroup>
                  )}
                </select>

                {/* Preset Action Buttons */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                  <button
                    type="button"
                    onClick={() => {
                      setNewPresetName('');
                      setShowNewPresetInput((prev) => !prev);
                    }}
                    title="Create a new preset from the current pattern"
                    style={{
                      height: 28,
                      padding: '0 9px',
                      backgroundColor: showNewPresetInput ? 'rgba(56, 189, 248, 0.2)' : 'rgba(255, 255, 255, 0.05)',
                      border: `1px solid ${showNewPresetInput ? '#38bdf8' : 'rgba(255, 255, 255, 0.12)'}`,
                      borderRadius: 4,
                      color: showNewPresetInput ? '#38bdf8' : '#cbd5e1',
                      fontSize: 8.5,
                      fontWeight: 600,
                      display: 'flex',
                      alignItems: 'center',
                      gap: 4,
                      cursor: 'pointer',
                    }}
                  >
                    <Plus size={11} />
                    <span>New</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleSaveCurrentPreset}
                    title={isCustomPreset ? `Save changes to ${currentPreset?.name}` : 'Save current pattern as new custom preset'}
                    style={{
                      height: 28,
                      padding: '0 9px',
                      backgroundColor: 'rgba(74, 222, 128, 0.1)',
                      border: '1px solid rgba(74, 222, 128, 0.3)',
                      borderRadius: 4,
                      color: '#4ade80',
                      fontSize: 8.5,
                      fontWeight: 600,
                      display: 'flex',
                      alignItems: 'center',
                      gap: 4,
                      cursor: 'pointer',
                    }}
                  >
                    <Save size={11} />
                    <span>Save</span>
                  </button>

                  {isCustomPreset && (
                    <button
                      type="button"
                      onClick={handleDeletePreset}
                      title={`Delete custom preset "${currentPreset?.name}"`}
                      style={{
                        height: 28,
                        padding: '0 8px',
                        backgroundColor: 'rgba(239, 68, 68, 0.1)',
                        border: '1px solid rgba(239, 68, 68, 0.3)',
                        borderRadius: 4,
                        color: '#f87171',
                        fontSize: 8.5,
                        fontWeight: 600,
                        display: 'flex',
                        alignItems: 'center',
                        gap: 3,
                        cursor: 'pointer',
                      }}
                    >
                      <Trash2 size={11} />
                      <span>Delete</span>
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={handleResetPresets}
                    title="Restore default built-in presets"
                    style={{
                      height: 28,
                      padding: '0 8px',
                      backgroundColor: 'rgba(255, 255, 255, 0.04)',
                      border: '1px solid rgba(255, 255, 255, 0.08)',
                      borderRadius: 4,
                      color: '#94a3b8',
                      fontSize: 8.5,
                      display: 'flex',
                      alignItems: 'center',
                      gap: 3,
                      cursor: 'pointer',
                    }}
                  >
                    <RotateCcw size={10} />
                    <span>Reset Defaults</span>
                  </button>
                </div>
              </div>

              {/* Inline Create New Preset Input Bar */}
              {showNewPresetInput && (
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                    padding: '8px 10px',
                    backgroundColor: 'rgba(56, 189, 248, 0.08)',
                    border: '1px solid rgba(56, 189, 248, 0.25)',
                    borderRadius: 5,
                    marginTop: 4,
                  }}
                >
                  <span style={{ fontSize: 8.5, color: '#38bdf8', fontWeight: 600 }}>Preset Name:</span>
                  <input
                    type="text"
                    value={newPresetName}
                    onChange={(e) => setNewPresetName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleCreatePreset();
                      if (e.key === 'Escape') setShowNewPresetInput(false);
                    }}
                    placeholder="e.g. My Studio Pipeline"
                    autoFocus
                    style={{
                      flex: 1,
                      height: 24,
                      backgroundColor: '#0c0e14',
                      border: '1px solid rgba(255, 255, 255, 0.15)',
                      borderRadius: 3,
                      padding: '0 8px',
                      color: '#f8fafc',
                      fontSize: 9,
                      outline: 'none',
                    }}
                  />
                  <button
                    type="button"
                    onClick={handleCreatePreset}
                    disabled={!newPresetName.trim()}
                    style={{
                      height: 24,
                      padding: '0 10px',
                      backgroundColor: '#38bdf8',
                      border: 'none',
                      borderRadius: 3,
                      color: '#080d14',
                      fontSize: 8.5,
                      fontWeight: 700,
                      cursor: newPresetName.trim() ? 'pointer' : 'not-allowed',
                    }}
                  >
                    Create
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowNewPresetInput(false)}
                    style={{
                      height: 24,
                      padding: '0 6px',
                      backgroundColor: 'transparent',
                      border: 'none',
                      color: '#94a3b8',
                      cursor: 'pointer',
                    }}
                  >
                    Cancel
                  </button>
                </div>
              )}
            </div>

            {/* Global Properties: Asset Name, Master Resolution, Format, Folder Picker */}
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
                    height: 28,
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
                    height: 28,
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
                  <option value="512">512 × 512 (Proxy)</option>
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
                    height: 28,
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
                    height: 28,
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

          {/* SECTION 2: OUTPUT NAME (CUSTOM INPUT + CURSOR TOKEN INSERTION + VALIDATION) */}
          <div
            style={{
              backgroundColor: 'rgba(20, 24, 34, 0.45)',
              border: '1px solid rgba(255, 255, 255, 0.07)',
              borderRadius: 8,
              padding: '14px 16px',
              display: 'flex',
              flexDirection: 'column',
              gap: 10,
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <Sparkles size={11} color="#a855f7" />
                <span style={{ fontSize: 9.5, fontWeight: 700, color: '#94a3b8', letterSpacing: 0.5 }}>
                  Output Name
                </span>
                <span style={{ fontSize: 8, color: '#64748b' }}>
                  (Click any token pill to insert at text cursor position)
                </span>
              </div>
              <button
                type="button"
                onClick={() => {
                  const defaultPat = currentPreset?.pattern || 'T_{asset}_{slot}';
                  setPattern(defaultPat);
                }}
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
                <RotateCcw size={9} />
                <span>Reset to Preset</span>
              </button>
            </div>

            {/* Custom Pattern Input with Text Cursor Insertion */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <input
                ref={patternInputRef}
                type="text"
                value={pattern}
                onChange={(e) => setPattern(e.target.value)}
                placeholder="e.g. T_{asset}_{slot} or {project}_{asset}_{slot}_{res}"
                style={{
                  height: 32,
                  backgroundColor: '#0a0c12',
                  border: `1px solid ${
                    !validation.isValid
                      ? '#ef4444'
                      : validation.warning
                      ? '#f59e0b'
                      : 'rgba(56, 189, 248, 0.35)'
                  }`,
                  borderRadius: 5,
                  padding: '0 10px',
                  color: '#f8fafc',
                  fontFamily: "'Geist Mono', monospace",
                  fontSize: 11,
                  fontWeight: 600,
                  outline: 'none',
                  boxShadow: !validation.isValid
                    ? '0 0 8px rgba(239, 68, 68, 0.25)'
                    : '0 0 8px rgba(56, 189, 248, 0.15)',
                }}
              />
            </div>

            {/* Edge Case Validation Alert Box */}
            {!validation.isValid && validation.error && (
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  padding: '6px 10px',
                  backgroundColor: 'rgba(239, 68, 68, 0.12)',
                  border: '1px solid rgba(239, 68, 68, 0.35)',
                  borderRadius: 4,
                  color: '#f87171',
                  fontSize: 8.5,
                  fontWeight: 600,
                }}
              >
                <AlertCircle size={12} style={{ flexShrink: 0 }} />
                <span>{validation.error}</span>
              </div>
            )}

            {validation.isValid && validation.warning && (
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  padding: '6px 10px',
                  backgroundColor: 'rgba(245, 158, 11, 0.12)',
                  border: '1px solid rgba(245, 158, 11, 0.35)',
                  borderRadius: 4,
                  color: '#f59e0b',
                  fontSize: 8.5,
                  fontWeight: 600,
                }}
              >
                <AlertCircle size={12} style={{ flexShrink: 0 }} />
                <span>{validation.warning}</span>
              </div>
            )}

            {/* Dynamic Token Palette to Insert at Cursor */}
            <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 5, fontSize: 8.5 }}>
              <span style={{ color: '#64748b', fontWeight: 600 }}>Insert Token at Cursor:</span>
              {[
                { token: '{project}', label: '{project}' },
                { token: '{asset}', label: '{asset}' },
                { token: '{slot}', label: '{slot}' },
                { token: '{res}', label: '{res}' },
                { token: '{colorspace}', label: '{colorspace}' },
                { token: '{format}', label: '{format}' },
                { token: '{udim}', label: '{udim}' },
              ].map((t) => (
                <button
                  key={t.token}
                  type="button"
                  onClick={() => handleInsertToken(t.token)}
                  style={{
                    backgroundColor: 'rgba(56, 189, 248, 0.08)',
                    border: '1px solid rgba(56, 189, 248, 0.25)',
                    borderRadius: 4,
                    padding: '3px 7px',
                    color: '#38bdf8',
                    fontFamily: "'Geist Mono', monospace",
                    fontSize: 8.5,
                    fontWeight: 700,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 3,
                    transition: 'all 100ms ease',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = 'rgba(56, 189, 248, 0.2)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = 'rgba(56, 189, 248, 0.08)';
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
                  onClick={() => handleInsertToken(sep)}
                  style={{
                    backgroundColor: 'rgba(255, 255, 255, 0.05)',
                    border: '1px solid rgba(255, 255, 255, 0.1)',
                    borderRadius: 4,
                    padding: '3px 7px',
                    color: '#cbd5e1',
                    fontSize: 8.5,
                    fontFamily: "'Geist Mono', monospace",
                    fontWeight: 700,
                    cursor: 'pointer',
                  }}
                >
                  +{sep}
                </button>
              ))}
            </div>

            {/* Real-Time Sample Preview Filename Banner */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '7px 12px',
                backgroundColor: 'rgba(74, 222, 128, 0.06)',
                border: '1px solid rgba(74, 222, 128, 0.2)',
                borderRadius: 5,
                fontSize: 9,
              }}
            >
              <span style={{ color: '#94a3b8', fontWeight: 600 }}>Resolved Output Example:</span>
              <span style={{ color: '#4ade80', fontFamily: "'Geist Mono', monospace", fontWeight: 700 }}>
                {samplePreviewFilename}
              </span>
            </div>
          </div>

          {/* SECTION 3: GRAPH OUTPUT MAPS PRE-FLIGHT TABLE */}
          <div
            style={{
              backgroundColor: 'rgba(20, 24, 34, 0.45)',
              border: '1px solid rgba(255, 255, 255, 0.07)',
              borderRadius: 8,
              padding: '14px 16px',
              display: 'flex',
              flexDirection: 'column',
              gap: 10,
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <Layers size={11} color="#38bdf8" />
                <span style={{ fontSize: 9.5, fontWeight: 700, color: '#94a3b8', letterSpacing: 0.5 }}>
                  Graph Output Maps ({outputNodes.length} Detected)
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
              <div style={{ border: '1px solid rgba(255, 255, 255, 0.08)', borderRadius: 5, overflow: 'hidden' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: 9 }}>
                  <thead>
                    <tr style={{ backgroundColor: 'rgba(12, 14, 20, 0.95)', borderBottom: '1px solid rgba(255, 255, 255, 0.08)', color: '#94a3b8' }}>
                      <th style={{ padding: '7px 10px', width: 30, textAlign: 'center' }}>
                        <input
                          type="checkbox"
                          checked={readyCount === preflightItems.length && preflightItems.length > 0}
                          onChange={(e) => handleToggleAll(e.target.checked)}
                          style={{ cursor: 'pointer' }}
                        />
                      </th>
                      <th style={{ padding: '7px 10px' }}>Target Map Slot</th>
                      <th style={{ padding: '7px 10px' }}>Connection</th>
                      <th style={{ padding: '7px 10px' }}>Format</th>
                      <th style={{ padding: '7px 10px' }}>Color Space</th>
                      <th style={{ padding: '7px 10px' }}>Resolution</th>
                      <th style={{ padding: '7px 10px' }}>Resolved Filename</th>
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
                        <td style={{ padding: '7px 10px', textAlign: 'center' }}>
                          <input
                            type="checkbox"
                            checked={item.enabled}
                            onChange={(e) => onUpdateNodeData?.(item.nodeId, { enabled: e.target.checked })}
                            style={{ cursor: 'pointer' }}
                          />
                        </td>

                        {/* Slot Name & Quick Edit */}
                        <td style={{ padding: '7px 10px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            {item.previewUrl ? (
                              <img
                                src={item.previewUrl}
                                alt={item.slot}
                                style={{ width: 22, height: 22, borderRadius: 3, border: '1px solid rgba(255, 255, 255, 0.1)', objectFit: 'cover' }}
                              />
                            ) : (
                              <div style={{ width: 22, height: 22, borderRadius: 3, backgroundColor: '#0c0e14', border: '1px solid rgba(255, 255, 255, 0.1)' }} />
                            )}
                            <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                              <input
                                type="text"
                                value={item.slot}
                                onChange={(e) =>
                                  onUpdateNodeData?.(item.nodeId, {
                                    slot: e.target.value,
                                    isSlotOverridden: true,
                                  })
                                }
                                style={{
                                  width: 90,
                                  height: 22,
                                  backgroundColor: 'rgba(0, 0, 0, 0.3)',
                                  border: `1px solid ${item.isSlotOverridden ? '#f59e0b' : 'rgba(255, 255, 255, 0.1)'}`,
                                  borderRadius: 3,
                                  color: item.isSlotOverridden ? '#f59e0b' : '#f8fafc',
                                  fontWeight: 700,
                                  fontFamily: "'Geist Mono', monospace",
                                  fontSize: 9,
                                  padding: '0 6px',
                                }}
                              />
                              {item.isSlotOverridden ? (
                                <span
                                  style={{
                                    fontSize: 7.5,
                                    color: '#f59e0b',
                                    fontWeight: 700,
                                    fontFamily: "'Geist Mono', monospace",
                                  }}
                                  title="Overridden manually"
                                >
                                  OVR
                                </span>
                              ) : (
                                <span
                                  style={{
                                    fontSize: 7.5,
                                    color: '#4ade80',
                                    fontWeight: 700,
                                    fontFamily: "'Geist Mono', monospace",
                                  }}
                                  title="Auto-detected from input"
                                >
                                  AUTO
                                </span>
                              )}
                            </div>
                          </div>
                        </td>

                        {/* Wire Connection Status */}
                        <td style={{ padding: '7px 10px' }}>
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
                        <td style={{ padding: '7px 10px' }}>
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
                        <td style={{ padding: '7px 10px' }}>
                          <button
                            type="button"
                            onClick={() =>
                              onUpdateNodeData?.(item.nodeId, {
                                colorSpace: item.colorSpace === 'linear' ? 'sRGB' : 'linear',
                                isColorSpaceOverridden: true,
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
                        <td style={{ padding: '7px 10px', fontFamily: "'Geist Mono', monospace", color: '#94a3b8' }}>
                          {item.resolution}
                        </td>

                        {/* Filename Preview */}
                        <td style={{ padding: '7px 10px', fontFamily: "'Geist Mono', monospace", color: '#f8fafc', fontWeight: 600 }}>
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
                  padding: '28px 16px',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: 8,
                  color: '#64748b',
                  fontSize: 9.5,
                }}
              >
                <AlertCircle size={22} color="#f87171" />
                <span>No Texture Output nodes found in the current canvas graph.</span>
                <span style={{ fontSize: 8.5 }}>Add a "Texture Output" node to the canvas to connect and export maps.</span>
              </div>
            )}
          </div>
        </div>

        {/* ============================================================ */}
        {/* MODAL FOOTER & EXPORT EXECUTION                              */}
        {/* ============================================================ */}
        <div
          style={{
            padding: '14px 22px',
            borderTop: '1px solid rgba(255, 255, 255, 0.08)',
            backgroundColor: 'rgba(20, 24, 34, 0.7)',
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
                {directoryHandle ? <HardDrive size={13} color="#22c55e" /> : <FileArchive size={13} color="#38bdf8" />}
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
                  height: 32,
                  padding: '0 16px',
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
                disabled={isExporting || readyCount === 0 || !validation.isValid}
                style={{
                  height: 32,
                  padding: '0 20px',
                  backgroundColor: readyCount > 0 && validation.isValid ? '#22c55e' : 'rgba(255, 255, 255, 0.05)',
                  border: 'none',
                  borderRadius: 5,
                  color: readyCount > 0 && validation.isValid ? '#0a0d14' : '#64748b',
                  fontSize: 10.5,
                  fontWeight: 800,
                  letterSpacing: '0.03em',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  cursor: readyCount > 0 && validation.isValid && !isExporting ? 'pointer' : 'not-allowed',
                  transition: 'all 140ms ease',
                  boxShadow: readyCount > 0 && validation.isValid ? '0 2px 14px rgba(34, 197, 94, 0.35)' : 'none',
                }}
                onMouseEnter={(e) => {
                  if (readyCount > 0 && validation.isValid && !isExporting) {
                    e.currentTarget.style.backgroundColor = '#4ade80';
                    e.currentTarget.style.transform = 'translateY(-1px)';
                  }
                }}
                onMouseLeave={(e) => {
                  if (readyCount > 0 && validation.isValid && !isExporting) {
                    e.currentTarget.style.backgroundColor = '#22c55e';
                    e.currentTarget.style.transform = 'translateY(0)';
                  }
                }}
              >
                <Download size={14} strokeWidth={2.5} />
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
