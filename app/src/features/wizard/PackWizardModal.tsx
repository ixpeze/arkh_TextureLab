// src/features/wizard/PackWizardModal.tsx
import React, { useState, useRef } from 'react';
import { Wand2, UploadCloud, CheckCircle2 } from 'lucide-react';
import { Dialog } from '../../ui/Dialog';
import { Button } from '../../ui/Button';
import { Segmented } from '../../ui/Segmented';
import { Checkbox } from '../../ui/Checkbox';
import { NumberField } from '../../ui/NumberField';
import {
  classifyDroppedFiles,
  getDefaultConfigForPreset,
  buildPackWizardGraph,
  buildUnpackWizardGraph,
  type DroppedFileItem,
  type WizardPreset,
  type PackWizardConfig,
} from './wizardGraphBuilder';
import { useAppStore } from '../../store/useAppStore';

export interface PackWizardModalProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenExportHub?: () => void;
  initialPreset?: WizardPreset;
}

export const PackWizardModal: React.FC<PackWizardModalProps> = ({
  isOpen,
  onClose,
  onOpenExportHub,
  initialPreset = 'ORM',
}) => {
  const [activeTab, setActiveTab] = useState<'pack' | 'unpack'>('pack');
  const [files, setFiles] = useState<DroppedFileItem[]>([]);
  const [preset, setPreset] = useState<WizardPreset>(initialPreset);
  const [config, setConfig] = useState<PackWizardConfig>(() =>
    getDefaultConfigForPreset(initialPreset, [])
  );
  const [isDragOver, setIsDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const setNodes = useAppStore((s) => s.setNodes);
  const setEdges = useAppStore((s) => s.setEdges);
  const registerAssetRecord = useAppStore((s) => s.registerAssetRecord);
  const setStatusMessage = useAppStore((s) => s.setStatusMessage);

  const handlePresetChange = (newPreset: WizardPreset) => {
    setPreset(newPreset);
    setConfig(getDefaultConfigForPreset(newPreset, files));
  };

  const handleFilesChosen = (rawFiles: FileList | File[] | null) => {
    if (!rawFiles || rawFiles.length === 0) return;
    const fileList = Array.from(rawFiles);
    const classified = classifyDroppedFiles(fileList);
    setFiles(classified);
    const updatedConfig = getDefaultConfigForPreset(preset, classified);
    setConfig(updatedConfig);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    if (e.dataTransfer.files) {
      handleFilesChosen(e.dataTransfer.files);
    }
  };

  const handleGenerate = (openExport = true) => {
    if (activeTab === 'unpack') {
      if (files.length === 0) return;
      const { nodes, edges, assets } = buildUnpackWizardGraph(files[0].file, config.assetName);
      setNodes(nodes);
      setEdges(edges);
      assets.forEach((a) => registerAssetRecord(a));
      setStatusMessage(`Unpack Wizard generated ${nodes.length} nodes for ${files[0].file.name}`);
      onClose();
      if (openExport && onOpenExportHub) onOpenExportHub();
      return;
    }

    const { nodes, edges, assets } = buildPackWizardGraph(config, files);
    setNodes(nodes);
    setEdges(edges);
    assets.forEach((a) => registerAssetRecord(a));
    setStatusMessage(`Pack Wizard generated ${config.preset} texture graph with ${nodes.length} nodes`);
    onClose();
    if (openExport && onOpenExportHub) {
      onOpenExportHub();
    }
  };

  const channelLabels: Record<'r' | 'g' | 'b' | 'a', { label: string; color: string }> = {
    r: { label: 'R (Red)', color: 'var(--pbr-ao)' },
    g: { label: 'G (Green)', color: 'var(--pbr-rough)' },
    b: { label: 'B (Blue)', color: 'var(--pbr-metal)' },
    a: { label: 'A (Alpha)', color: 'var(--pbr-height)' },
  };

  return (
    <Dialog
      isOpen={isOpen}
      onClose={onClose}
      title={activeTab === 'pack' ? 'Pack Wizard (Auto-Channel Packing)' : 'Unpack Wizard (Channel Extraction)'}
      width={680}
      footer={
        <div className="tl-wizard-footer">
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="secondary" onClick={() => handleGenerate(false)}>
            Generate Graph Only
          </Button>
          <Button
            variant="primary"
            icon={<Wand2 size={13} />}
            onClick={() => handleGenerate(true)}
          >
            Generate & Open Export Hub
          </Button>
        </div>
      }
    >
      <div className="tl-wizard">
        {/* Wizard Mode Switcher */}
        <div className="tl-wizard-modes">
          <Segmented<'pack' | 'unpack'>
            items={[
              { value: 'pack', label: 'Pack Channels (ORM/ORMH)', title: 'Combine discrete maps' },
              { value: 'unpack', label: 'Unpack Channels', title: 'Extract R, G, B, A from packed texture' },
            ]}
            value={activeTab}
            onChange={setActiveTab}
          />
        </div>

        {/* Drop Zone */}
        <div
          className={`tl-wizard-dropzone ${isDragOver ? 'tl-wizard-dropzone--active' : ''}`}
          onDragOver={(e) => {
            e.preventDefault();
            setIsDragOver(true);
          }}
          onDragLeave={() => setIsDragOver(false)}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
        >
          <input
            type="file"
            ref={fileInputRef}
            multiple={activeTab === 'pack'}
            className="tl-sr-only"
            onChange={(e) => handleFilesChosen(e.target.files)}
          />
          <UploadCloud size={24} color="var(--accent)" />
          <div className="tl-wizard-dropzone__text">
            <span>Drop image files or folder here, or click to browse</span>
            <span className="tl-wizard-dropzone__sub">Supports PNG, TGA, JPEG, WebP</span>
          </div>
          {files.length > 0 && (
            <span className="tl-wizard-dropzone__count">
              <CheckCircle2 size={12} color="var(--ok)" /> {files.length} file(s) ingested
            </span>
          )}
        </div>

        {activeTab === 'pack' ? (
          <>
            {/* Preset Selector */}
            <div className="tl-wizard-row">
              <span className="tl-wizard-label">Packing Preset:</span>
              <Segmented<WizardPreset>
                items={[
                  { value: 'ORM', label: 'ORM (UE5)' },
                  { value: 'ORMH', label: 'ORMH (UE5 + Height)' },
                  { value: 'UnityMask', label: 'Unity Mask Map' },
                  { value: 'RMA', label: 'RMA' },
                  { value: 'Custom', label: 'Custom' },
                ]}
                value={preset}
                onChange={handlePresetChange}
              />
            </div>

            {/* Asset Name Config */}
            <div className="tl-wizard-row">
              <span className="tl-wizard-label">Primary Asset Name:</span>
              <input
                type="text"
                className="tl-number-field__input"
                value={config.assetName}
                placeholder="Asset"
                onChange={(e) => setConfig({ ...config, assetName: e.target.value })}
              />
            </div>

            {/* Channel Mapping Table */}
            <div className="tl-wizard-table">
              <div className="tl-wizard-table__header">
                <span>Channel</span>
                <span>Source Texture Map</span>
                <span>Fallback</span>
                <span>Invert</span>
              </div>

              {(['r', 'g', 'b', 'a'] as const).map((ch) => {
                const chConfig = config.channels[ch];
                const info = channelLabels[ch];

                return (
                  <div key={ch} className="tl-wizard-table__row">
                    <div className="tl-wizard-table__ch" style={{ color: info.color }}>
                      <span className="tl-wizard-table__badge">{ch.toUpperCase()}</span>
                      <span>{chConfig.role || ch.toUpperCase()}</span>
                    </div>

                    <div className="tl-wizard-table__select">
                      <select
                        className="tl-select__input"
                        value={chConfig.sourceType === 'file' ? chConfig.fileIndex ?? 'none' : 'constant'}
                        onChange={(e) => {
                          const val = e.target.value;
                          if (val === 'constant') {
                            setConfig({
                              ...config,
                              channels: {
                                ...config.channels,
                                [ch]: { ...chConfig, sourceType: 'constant', fileIndex: undefined },
                              },
                            });
                          } else {
                            const idx = Number(val);
                            setConfig({
                              ...config,
                              channels: {
                                ...config.channels,
                                [ch]: { ...chConfig, sourceType: 'file', fileIndex: idx },
                              },
                            });
                          }
                        }}
                      >
                        <option value="constant">Fallback Constant Value</option>
                        {files.map((item, fIdx) => (
                          <option key={`${fIdx}-${item.file.name}`} value={fIdx}>
                            {item.file.name} ({item.meta.roleLabel})
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="tl-wizard-table__fallback">
                      {chConfig.sourceType === 'constant' ? (
                        <NumberField
                          value={chConfig.constantValue}
                          min={0}
                          max={1}
                          step={0.1}
                          onChange={(v) =>
                            setConfig({
                              ...config,
                              channels: {
                                ...config.channels,
                                [ch]: { ...chConfig, constantValue: v },
                              },
                            })
                          }
                        />
                      ) : (
                        <span className="tl-wizard-dim">Auto</span>
                      )}
                    </div>

                    <div className="tl-wizard-table__invert">
                      <Checkbox
                        checked={chConfig.invert}
                        onCheckedChange={(inv) =>
                          setConfig({
                            ...config,
                            channels: {
                              ...config.channels,
                              [ch]: { ...chConfig, invert: inv },
                            },
                          })
                        }
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        ) : (
          <div className="tl-wizard-unpack">
            <div className="tl-wizard-row">
              <span className="tl-wizard-label">Asset Name:</span>
              <input
                type="text"
                className="tl-number-field__input"
                value={config.assetName}
                placeholder="Asset"
                onChange={(e) => setConfig({ ...config, assetName: e.target.value })}
              />
            </div>
            <p className="tl-wizard-desc">
              Extracts the Red, Green, Blue, and Alpha channels into discrete Texture Output nodes.
            </p>
          </div>
        )}
      </div>
    </Dialog>
  );
};
