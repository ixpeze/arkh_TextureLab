import { useState, useRef } from 'react';
import { ExportEngine, DEFAULT_PRESETS } from '../../engine/exportEngine';
import type { ExportPreset } from '../../types/export';

export function usePresetState(
  pattern: string,
  setPattern: (p: string) => void,
  showFeedback: (msg: string, type?: 'success' | 'info' | 'error') => void
) {
  const [presets, setPresets] = useState<ExportPreset[]>(() => ExportEngine.loadPresets());
  const [selectedPresetId, setSelectedPresetId] = useState<string>('ue5');

  // Save Preset Dialog State
  const [showSavePresetDialog, setShowSavePresetDialog] = useState(false);
  const [savePresetMode, setSavePresetMode] = useState<'new' | 'update'>('new');
  const [savePresetName, setSavePresetName] = useState('');
  const [presetToUpdateId, setPresetToUpdateId] = useState('ue5');

  // Quick Inline Preset
  const [showNewPresetInput, setShowNewPresetInput] = useState(false);
  const [newPresetName, setNewPresetName] = useState('');
  const nextPresetCounter = useRef(1);

  const handleSelectPreset = (presetId: string) => {
    setSelectedPresetId(presetId);
    const preset = presets.find((p) => p.id === presetId);
    if (preset) {
      setPattern(preset.pattern);
    }
  };

  const handleCreatePreset = () => {
    const trimmed = newPresetName.trim();
    if (!trimmed) return;
    const newId = `custom_${Date.now()}_${nextPresetCounter.current++}`;
    const newPreset: ExportPreset = {
      id: newId,
      name: trimmed,
      pattern,
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

  const handleConfirmSavePreset = () => {
    if (savePresetMode === 'new') {
      const trimmed = savePresetName.trim();
      if (!trimmed) return;
      const newId = `custom_${Date.now()}_${nextPresetCounter.current++}`;
      const newPreset: ExportPreset = {
        id: newId,
        name: trimmed,
        pattern,
        isBuiltIn: false,
      };
      const updated = [...presets, newPreset];
      setPresets(updated);
      ExportEngine.savePresets(updated);
      setSelectedPresetId(newId);
      setShowSavePresetDialog(false);
      showFeedback(`Saved new preset "${trimmed}"!`, 'success');
    } else {
      const target = presets.find((p) => p.id === presetToUpdateId);
      if (!target) return;

      let updated: ExportPreset[];
      if (target.isBuiltIn) {
        const updatedPreset: ExportPreset = {
          ...target,
          pattern,
          isBuiltIn: false,
        };
        updated = presets.map((p) => (p.id === target.id ? updatedPreset : p));
      } else {
        updated = presets.map((p) => (p.id === target.id ? { ...p, pattern } : p));
      }

      setPresets(updated);
      ExportEngine.savePresets(updated);
      setSelectedPresetId(target.id);
      setShowSavePresetDialog(false);
      showFeedback(`Updated preset "${target.name}"!`, 'success');
    }
  };

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

  const handleResetPresets = () => {
    const defaults = [...DEFAULT_PRESETS];
    setPresets(defaults);
    ExportEngine.savePresets(defaults);
    setSelectedPresetId('ue5');
    setPattern(defaults[0].pattern);
    showFeedback('Restored default presets', 'info');
  };

  return {
    presets,
    selectedPresetId,
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
    handleSelectPreset,
    handleCreatePreset,
    handleConfirmSavePreset,
    handleDeletePreset,
    handleResetPresets,
  };
}
