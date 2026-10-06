import React, { useMemo } from 'react';
import { Download, X } from 'lucide-react';
import type { ExportModalProps } from './types';
import { useExportState } from './useExportState';
import { PresetBar } from './PresetBar';
import { DestinationPicker } from './DestinationPicker';
import { TokenField } from './TokenField';
import { PreflightTable } from './PreflightTable';
import { ProgressFooter } from './ProgressFooter';

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
  const {
    presets,
    selectedPresetId,
    pattern,
    setPattern,
    showSavePresetDialog,
    setShowSavePresetDialog,
    savePresetMode,
    setSavePresetMode,
    savePresetName,
    setSavePresetName,
    presetToUpdateId,
    setPresetToUpdateId,
    showNewPresetInput,
    setShowNewPresetInput,
    newPresetName,
    setNewPresetName,
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
    handleSelectPreset,
    handleCreatePreset,
    handleConfirmSavePreset,
    handleDeletePreset,
    handleResetPresets,
    handleInsertToken,
    handlePickDirectory,
    handleResetToSourceLocation,
    handleToggleAll,
    handleExecuteExport,
  } = useExportState({
    isOpen,
    onClose,
    nodes,
    edges,
    evaluatedBuffers,
    primaryAsset,
    onUpdateNodeData,
    onExportComplete,
  });

  const outputNodes = useMemo(() => {
    return nodes.filter((n) => n.type === 'textureOutput');
  }, [nodes]);

  const readyCount = preflightItems.filter((i) => i.enabled && i.isConnected).length;
  const currentPreset = presets.find((p) => p.id === selectedPresetId);

  if (!isOpen) return null;

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
        if (e.target === e.currentTarget && !isExporting && !showSavePresetDialog) onClose();
      }}
    >
      <div
        style={{
          position: 'relative',
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
        {/* Header */}
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

        {/* Scrollable Body */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '18px 22px', display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Section 1: Presets & Global Pipeline Settings */}
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
            <PresetBar
              presets={presets}
              selectedPresetId={selectedPresetId}
              pattern={pattern}
              onSelectPreset={handleSelectPreset}
              onDeletePreset={handleDeletePreset}
              onResetPresets={handleResetPresets}
              showNewPresetInput={showNewPresetInput}
              setShowNewPresetInput={setShowNewPresetInput}
              newPresetName={newPresetName}
              setNewPresetName={setNewPresetName}
              onCreatePreset={handleCreatePreset}
              showSavePresetDialog={showSavePresetDialog}
              setShowSavePresetDialog={setShowSavePresetDialog}
              savePresetMode={savePresetMode}
              setSavePresetMode={setSavePresetMode}
              savePresetName={savePresetName}
              setSavePresetName={setSavePresetName}
              presetToUpdateId={presetToUpdateId}
              setPresetToUpdateId={setPresetToUpdateId}
              onConfirmSavePreset={handleConfirmSavePreset}
              feedback={feedback}
              onDismissFeedback={() => setFeedback(null)}
            />

            <DestinationPicker
              settings={settings}
              setSettings={setSettings}
              directoryHandle={directoryHandle}
              detectedSourceLocation={detectedSourceLocation}
              onPickDirectory={handlePickDirectory}
              onResetToSourceLocation={handleResetToSourceLocation}
              onAssetChange={onAssetChange}
            />
          </div>

          {/* Section 2: Output Name / Token Field */}
          <TokenField
            pattern={pattern}
            setPattern={setPattern}
            patternInputRef={patternInputRef}
            validation={validation}
            samplePreviewFilename={samplePreviewFilename}
            currentPreset={currentPreset}
            onInsertToken={handleInsertToken}
          />

          {/* Section 3: Graph Output Maps Pre-flight Table */}
          <PreflightTable
            outputNodes={outputNodes}
            preflightItems={preflightItems}
            defaultFormat={settings.defaultFormat}
            onToggleAll={handleToggleAll}
            onUpdateNodeData={onUpdateNodeData}
          />
        </div>

        {/* Footer */}
        <ProgressFooter
          isExporting={isExporting}
          exportProgress={exportProgress}
          directoryHandle={directoryHandle}
          detectedSourceLocation={detectedSourceLocation}
          readyCount={readyCount}
          totalCount={preflightItems.length}
          isValid={validation.isValid}
          onClose={onClose}
          onExecuteExport={handleExecuteExport}
        />
      </div>
    </div>
  );
};
