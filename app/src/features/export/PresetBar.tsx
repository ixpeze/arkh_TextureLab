import React from 'react';
import { Plus, Trash2, Save, RotateCcw, X, Check } from 'lucide-react';
import type { ExportPreset } from '../../types/export';
import type { FeedbackState } from './types';
import { SavePresetModal } from './SavePresetModal';

export interface PresetBarProps {
  presets: ExportPreset[];
  selectedPresetId: string;
  pattern: string;
  onSelectPreset: (presetId: string) => void;
  onDeletePreset: () => void;
  onResetPresets: () => void;
  // Inline quick create
  showNewPresetInput: boolean;
  setShowNewPresetInput: React.Dispatch<React.SetStateAction<boolean>>;
  newPresetName: string;
  setNewPresetName: React.Dispatch<React.SetStateAction<string>>;
  onCreatePreset: () => void;
  // Save Dialog
  showSavePresetDialog: boolean;
  setShowSavePresetDialog: React.Dispatch<React.SetStateAction<boolean>>;
  savePresetMode: 'new' | 'update';
  setSavePresetMode: (mode: 'new' | 'update') => void;
  savePresetName: string;
  setSavePresetName: (name: string) => void;
  presetToUpdateId: string;
  setPresetToUpdateId: (id: string) => void;
  onConfirmSavePreset: () => void;
  // Feedback
  feedback: FeedbackState | null;
  onDismissFeedback: () => void;
}

export const PresetBar: React.FC<PresetBarProps> = ({
  presets,
  selectedPresetId,
  pattern,
  onSelectPreset,
  onDeletePreset,
  onResetPresets,
  showNewPresetInput,
  setShowNewPresetInput,
  newPresetName,
  setNewPresetName,
  onCreatePreset,
  showSavePresetDialog,
  setShowSavePresetDialog,
  savePresetMode,
  setSavePresetMode,
  savePresetName,
  setSavePresetName,
  presetToUpdateId,
  setPresetToUpdateId,
  onConfirmSavePreset,
  feedback,
  onDismissFeedback,
}) => {
  const currentPreset = presets.find((p) => p.id === selectedPresetId);
  const isCustomPreset = currentPreset && !currentPreset.isBuiltIn;

  return (
    <>
      {feedback && (
        <div
          style={{
            padding: '6px 22px',
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
            onClick={onDismissFeedback}
            style={{ background: 'transparent', border: 'none', color: 'inherit', cursor: 'pointer', padding: 0 }}
          >
            <X size={11} />
          </button>
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: 9.5, fontWeight: 700, color: '#94a3b8', letterSpacing: 0.5 }}>
            Presets
          </span>
          <span style={{ fontSize: 8.5, color: '#64748b' }}>
            Select standard convention or load custom preset
          </span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <select
            value={selectedPresetId}
            onChange={(e) => onSelectPreset(e.target.value)}
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

          <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
            <button
              type="button"
              onClick={() => {
                setNewPresetName('');
                setShowNewPresetInput((prev) => !prev);
              }}
              title="Quick create preset from the current pattern"
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

            {isCustomPreset && (
              <button
                type="button"
                onClick={onDeletePreset}
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
              onClick={() => {
                setSavePresetName(currentPreset && !currentPreset.isBuiltIn ? currentPreset.name : 'Custom Pipeline');
                setSavePresetMode('new');
                setShowSavePresetDialog(true);
              }}
              title="Save current naming pattern to a new or existing preset"
              style={{
                height: 28,
                padding: '0 9px',
                backgroundColor: 'rgba(74, 222, 128, 0.1)',
                border: '1px solid rgba(74, 222, 128, 0.25)',
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
              <span>Save As...</span>
            </button>

            <button
              type="button"
              onClick={onResetPresets}
              title="Reset all presets to industry defaults"
              style={{
                height: 28,
                padding: '0 8px',
                backgroundColor: 'rgba(255, 255, 255, 0.03)',
                border: '1px solid rgba(255, 255, 255, 0.08)',
                borderRadius: 4,
                color: '#64748b',
                fontSize: 8.5,
                display: 'flex',
                alignItems: 'center',
                gap: 3,
                cursor: 'pointer',
              }}
            >
              <RotateCcw size={11} />
              <span>Reset</span>
            </button>
          </div>
        </div>

        {showNewPresetInput && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              backgroundColor: '#0a0d14',
              border: '1px solid #38bdf8',
              borderRadius: 4,
              padding: '4px 8px',
              marginTop: 4,
            }}
          >
            <input
              type="text"
              value={newPresetName}
              onChange={(e) => setNewPresetName(e.target.value)}
              placeholder="Enter new preset name..."
              autoFocus
              onKeyDown={(e) => {
                if (e.key === 'Enter') onCreatePreset();
                if (e.key === 'Escape') setShowNewPresetInput(false);
              }}
              style={{
                flex: 1,
                backgroundColor: 'transparent',
                border: 'none',
                color: '#f8fafc',
                fontSize: 9.5,
                outline: 'none',
              }}
            />
            <button
              type="button"
              onClick={onCreatePreset}
              disabled={!newPresetName.trim()}
              style={{
                backgroundColor: '#38bdf8',
                border: 'none',
                borderRadius: 3,
                color: '#080d14',
                padding: '3px 8px',
                fontSize: 8.5,
                fontWeight: 700,
                cursor: newPresetName.trim() ? 'pointer' : 'not-allowed',
                display: 'flex',
                alignItems: 'center',
                gap: 3,
              }}
            >
              <Check size={10} />
              <span>Save</span>
            </button>
            <button
              type="button"
              onClick={() => setShowNewPresetInput(false)}
              style={{
                backgroundColor: 'transparent',
                border: 'none',
                color: '#94a3b8',
                cursor: 'pointer',
                padding: 2,
              }}
            >
              <X size={12} />
            </button>
          </div>
        )}
      </div>

      <SavePresetModal
        show={showSavePresetDialog}
        onClose={() => setShowSavePresetDialog(false)}
        pattern={pattern}
        presets={presets}
        savePresetMode={savePresetMode}
        setSavePresetMode={setSavePresetMode}
        savePresetName={savePresetName}
        setSavePresetName={setSavePresetName}
        presetToUpdateId={presetToUpdateId}
        setPresetToUpdateId={setPresetToUpdateId}
        onConfirmSavePreset={onConfirmSavePreset}
      />
    </>
  );
};
