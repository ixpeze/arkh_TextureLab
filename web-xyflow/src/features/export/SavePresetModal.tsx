import React from 'react';
import { X } from 'lucide-react';
import type { ExportPreset } from '../../types/export';

export interface SavePresetModalProps {
  show: boolean;
  onClose: () => void;
  pattern: string;
  presets: ExportPreset[];
  savePresetMode: 'new' | 'update';
  setSavePresetMode: (mode: 'new' | 'update') => void;
  savePresetName: string;
  setSavePresetName: (name: string) => void;
  presetToUpdateId: string;
  setPresetToUpdateId: (id: string) => void;
  onConfirmSavePreset: () => void;
}

export const SavePresetModal: React.FC<SavePresetModalProps> = ({
  show,
  onClose,
  pattern,
  presets,
  savePresetMode,
  setSavePresetMode,
  savePresetName,
  setSavePresetName,
  presetToUpdateId,
  setPresetToUpdateId,
  onConfirmSavePreset,
}) => {
  if (!show) return null;

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 150,
        backgroundColor: 'rgba(0, 0, 0, 0.75)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 16,
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: 420,
          backgroundColor: '#0f131d',
          border: '1px solid rgba(255, 255, 255, 0.15)',
          borderRadius: 8,
          padding: 18,
          display: 'flex',
          flexDirection: 'column',
          gap: 12,
          boxShadow: '0 20px 40px rgba(0,0,0,0.8)',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: 11, fontWeight: 700, color: '#f8fafc' }}>
            Save Naming Preset
          </span>
          <button
            type="button"
            onClick={onClose}
            style={{ background: 'transparent', border: 'none', color: '#94a3b8', cursor: 'pointer' }}
          >
            <X size={14} />
          </button>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <span style={{ fontSize: 8.5, color: '#94a3b8' }}>Pattern to Save</span>
          <div
            style={{
              backgroundColor: '#080a0f',
              padding: '6px 8px',
              borderRadius: 4,
              border: '1px solid rgba(255, 255, 255, 0.08)',
              fontFamily: "'Geist Mono', monospace",
              color: '#4ade80',
              fontWeight: 700,
              fontSize: 10,
            }}
          >
            {pattern}
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
          <button
            type="button"
            onClick={() => setSavePresetMode('new')}
            style={{
              padding: '6px 8px',
              borderRadius: 4,
              fontSize: 9,
              fontWeight: 700,
              backgroundColor: savePresetMode === 'new' ? 'rgba(56, 189, 248, 0.2)' : 'rgba(255, 255, 255, 0.04)',
              border: `1px solid ${savePresetMode === 'new' ? '#38bdf8' : 'rgba(255, 255, 255, 0.08)'}`,
              color: savePresetMode === 'new' ? '#38bdf8' : '#94a3b8',
              cursor: 'pointer',
            }}
          >
            Create New Preset
          </button>
          <button
            type="button"
            onClick={() => setSavePresetMode('update')}
            style={{
              padding: '6px 8px',
              borderRadius: 4,
              fontSize: 9,
              fontWeight: 700,
              backgroundColor: savePresetMode === 'update' ? 'rgba(56, 189, 248, 0.2)' : 'rgba(255, 255, 255, 0.04)',
              border: `1px solid ${savePresetMode === 'update' ? '#38bdf8' : 'rgba(255, 255, 255, 0.08)'}`,
              color: savePresetMode === 'update' ? '#38bdf8' : '#94a3b8',
              cursor: 'pointer',
            }}
          >
            Update Existing
          </button>
        </div>

        {savePresetMode === 'new' ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <span style={{ fontSize: 8.5, color: '#94a3b8' }}>Preset Name</span>
            <input
              type="text"
              value={savePresetName}
              onChange={(e) => setSavePresetName(e.target.value)}
              placeholder="e.g. Unreal Folder Pipeline"
              autoFocus
              onKeyDown={(e) => {
                if (e.key === 'Enter') onConfirmSavePreset();
              }}
              style={{
                height: 30,
                backgroundColor: '#0c0e14',
                border: '1px solid rgba(255, 255, 255, 0.15)',
                borderRadius: 4,
                padding: '0 8px',
                color: '#f8fafc',
                fontSize: 9.5,
                outline: 'none',
              }}
            />
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <span style={{ fontSize: 8.5, color: '#94a3b8' }}>Select Preset to Update</span>
            <select
              value={presetToUpdateId}
              onChange={(e) => setPresetToUpdateId(e.target.value)}
              style={{
                height: 30,
                backgroundColor: '#0c0e14',
                border: '1px solid rgba(255, 255, 255, 0.15)',
                borderRadius: 4,
                padding: '0 8px',
                color: '#f8fafc',
                fontSize: 9.5,
                outline: 'none',
                cursor: 'pointer',
              }}
            >
              {presets.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} {p.isBuiltIn ? '(Built-in)' : '(Custom)'}
                </option>
              ))}
            </select>
          </div>
        )}

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 4 }}>
          <button
            type="button"
            onClick={onClose}
            style={{
              height: 28,
              padding: '0 12px',
              backgroundColor: 'rgba(255, 255, 255, 0.05)',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              borderRadius: 4,
              color: '#94a3b8',
              fontSize: 9,
              cursor: 'pointer',
            }}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirmSavePreset}
            disabled={savePresetMode === 'new' && !savePresetName.trim()}
            style={{
              height: 28,
              padding: '0 16px',
              backgroundColor: '#4ade80',
              border: 'none',
              borderRadius: 4,
              color: '#080d14',
              fontSize: 9.5,
              fontWeight: 700,
              cursor: (savePresetMode === 'new' && !savePresetName.trim()) ? 'not-allowed' : 'pointer',
            }}
          >
            Save Preset
          </button>
        </div>
      </div>
    </div>
  );
};
