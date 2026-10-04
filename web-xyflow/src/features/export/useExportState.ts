import { useState, useMemo, useEffect, useRef } from 'react';
import type { Node, Edge } from '@xyflow/react';
import type { TextureBuffer } from '../../engine/pixelEngine';
import {
  ExportEngine,
  DEFAULT_GLOBAL_SETTINGS,
  type ExportTargetResolution,
} from '../../engine/exportEngine';
import type {
  GlobalExportSettings,
  PreflightOutputItem,
  TextureExportFormat,
  TextureBitDepth,
  TextureColorSpace,
} from '../../types/export';
import type { FeedbackState, ExportProgressState } from './types';
import { usePresetState } from './usePresetState';

export interface UseExportStateProps {
  isOpen: boolean;
  onClose: () => void;
  nodes: Node[];
  edges: Edge[];
  evaluatedBuffers: Record<string, TextureBuffer>;
  primaryAsset: string;
  onUpdateNodeData?: (nodeId: string, patch: Record<string, unknown>) => void;
  onExportComplete?: (message: string) => void;
}

export function useExportState({
  isOpen,
  onClose,
  nodes,
  edges,
  evaluatedBuffers,
  primaryAsset,
  onUpdateNodeData,
  onExportComplete,
}: UseExportStateProps) {
  const [pattern, setPattern] = useState<string>('T_{asset}_{slot}');
  const [feedback, setFeedback] = useState<FeedbackState | null>(null);

  const showFeedback = (message: string, type: 'success' | 'info' | 'error' = 'success') => {
    setFeedback({ message, type });
    setTimeout(() => {
      setFeedback(null);
    }, 3200);
  };

  const presetState = usePresetState(pattern, setPattern, showFeedback);

  // Auto-detect source texture location from input nodes
  const detectedSourceLocation = useMemo(() => {
    const inputNodes = nodes.filter((n) => n.type === 'textureInput');
    for (const inNode of inputNodes) {
      const d = (inNode.data as Record<string, unknown>) || {};
      if (d.sourceDirectory && typeof d.sourceDirectory === 'string') return d.sourceDirectory;
      if (d.previewUrl && typeof d.previewUrl === 'string' && d.previewUrl.startsWith('/')) {
        const parts = d.previewUrl.split('/').filter(Boolean);
        if (parts.length > 1) {
          return parts.slice(0, parts.length - 1).join('/');
        }
      }
    }
    return 'sample_textures';
  }, [nodes]);

  // Global settings state
  const [settings, setSettings] = useState<GlobalExportSettings>(() => ({
    ...DEFAULT_GLOBAL_SETTINGS,
    assetName: primaryAsset || 'AnthraciteConcrete',
    directoryName: 'sample_textures',
  }));

  const [directoryHandle, setDirectoryHandle] = useState<FileSystemDirectoryHandle | null>(null);
  const [isExporting, setIsExporting] = useState(false);
  const [exportProgress, setExportProgress] = useState<ExportProgressState | null>(null);

  const patternInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen && !isExporting) {
        if (presetState.showSavePresetDialog) {
          presetState.setShowSavePresetDialog(false);
        } else {
          onClose();
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, isExporting, presetState, onClose]);

  const outputNodes = useMemo(() => {
    return nodes.filter((n) => n.type === 'textureOutput');
  }, [nodes]);

  const validation = useMemo(() => {
    return ExportEngine.validatePattern(pattern);
  }, [pattern]);

  const preflightItems = useMemo<PreflightOutputItem[]>(() => {
    return outputNodes.map((n) => {
      const d = (n.data as Record<string, unknown>) || {};
      const slot = typeof d.isSlotOverridden === 'boolean' && d.isSlotOverridden && typeof d.slot === 'string'
        ? d.slot
        : (typeof d.autoDetectedSlot === 'string' ? d.autoDetectedSlot : (typeof d.slot === 'string' ? d.slot : 'ORM'));
      const isConnected = edges.some((e) => e.target === n.id);
      const buf = evaluatedBuffers[n.id];
      const previewUrl = buf?.dataUrl;

      const format: TextureExportFormat =
        typeof d.formatOverride === 'string' && d.formatOverride !== 'inherit'
          ? (d.formatOverride as TextureExportFormat)
          : settings.defaultFormat;

      // Honest 16-bit (F-04, P1-A5): Force '8b'
      const bitDepth: TextureBitDepth = '8b';

      const colorSpace: TextureColorSpace =
        typeof d.isColorSpaceOverridden === 'boolean' && d.isColorSpaceOverridden && typeof d.colorSpace === 'string'
          ? (d.colorSpace as TextureColorSpace)
          : (typeof d.autoDetectedColorSpace === 'string'
              ? (d.autoDetectedColorSpace as TextureColorSpace)
              : ((typeof d.colorSpace === 'string' ? d.colorSpace : 'linear') as TextureColorSpace));

      let resLabel = '4K';
      if (typeof d.resolutionOverride === 'string' && d.resolutionOverride !== 'inherit') {
        resLabel = `${Math.round(parseInt(d.resolutionOverride, 10) / 1024)}K`;
      } else if (settings.masterResolution !== 'inherit') {
        resLabel = `${Math.round(parseInt(settings.masterResolution, 10) / 1024)}K`;
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
        title: typeof d.title === 'string' ? d.title : 'Texture Output',
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

  const samplePreviewFilename = useMemo(() => {
    return ExportEngine.resolveFilename(pattern, {
      project: settings.projectName,
      asset: settings.assetName,
      slot: 'ORM',
      res: settings.masterResolution !== 'inherit' ? `${Math.round(parseInt(settings.masterResolution, 10) / 1024)}K` : '4K',
      format: settings.defaultFormat,
      colorSpace: 'Linear',
    });
  }, [pattern, settings]);

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

  const handlePickDirectory = async () => {
    const handle = await ExportEngine.pickDirectory();
    if (handle) {
      setDirectoryHandle(handle);
      setSettings((prev) => ({ ...prev, directoryName: handle.name }));
      showFeedback(`Output folder set to disk: "${handle.name}"`, 'success');
    }
  };

  const handleResetToSourceLocation = () => {
    setDirectoryHandle(null);
    setSettings((prev) => ({ ...prev, directoryName: detectedSourceLocation }));
    showFeedback(`Restored default source location: "${detectedSourceLocation}"`, 'info');
  };

  const handleToggleAll = (enabled: boolean) => {
    preflightItems.forEach((item) => {
      onUpdateNodeData?.(item.nodeId, { enabled });
    });
  };

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

        let target: ExportTargetResolution = { mode: 'inherit' };
        const node = outputNodes.find((n) => n.id === item.nodeId);
        const nodeData = (node?.data as Record<string, unknown>) || {};
        const nodeResOverride = typeof nodeData.resolutionOverride === 'string' ? nodeData.resolutionOverride : undefined;
        const resSetting = (nodeResOverride && nodeResOverride !== 'inherit') ? nodeResOverride : settings.masterResolution;
        if (resSetting && resSetting !== 'inherit') {
          const px = parseInt(resSetting, 10);
          if (!Number.isNaN(px)) {
            target = { mode: 'longEdge', px };
          }
        }

        const blob = await ExportEngine.encodeImageBlob(buf, item.format, target);
        generatedFiles.push({
          filename: item.resolvedFilename,
          blob,
        });

        await new Promise((resolve) => setTimeout(resolve, 30));
      }

      if (directoryHandle) {
        await ExportEngine.exportToDirectory(generatedFiles, directoryHandle);
        onExportComplete?.(`Exported ${generatedFiles.length} textures directly to disk folder "${directoryHandle.name}"`);
      } else {
        const zipPrefix = settings.directoryName || detectedSourceLocation || 'Textures';
        const zipName = `${zipPrefix}_${settings.assetName || 'Asset'}.zip`;
        const zipBlob = await ExportEngine.createZip(generatedFiles);
        ExportEngine.triggerDownload(zipBlob, zipName);
        onExportComplete?.(`Packaged and downloaded ${generatedFiles.length} textures as ${zipName}`);
      }

      onClose();
    } catch (err: unknown) {
      console.error('Batch export failed:', err);
      const msg = err instanceof Error ? err.message : 'Failed to encode files';
      alert(`Export error: ${msg}`);
    } finally {
      setIsExporting(false);
      setExportProgress(null);
    }
  };

  return {
    ...presetState,
    pattern,
    setPattern,
    feedback,
    setFeedback,
    settings,
    setSettings,
    detectedSourceLocation,
    directoryHandle,
    isExporting,
    exportProgress,
    patternInputRef,
    validation,
    preflightItems,
    samplePreviewFilename,
    handleInsertToken,
    handlePickDirectory,
    handleResetToSourceLocation,
    handleToggleAll,
    handleExecuteExport,
  };
}
