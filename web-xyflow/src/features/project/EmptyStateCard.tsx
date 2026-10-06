// src/features/project/EmptyStateCard.tsx
import React from 'react';
import { Wand2, Layers, FolderDown, FileArchive } from 'lucide-react';
import { Button } from '../../ui/Button';

export interface EmptyStateCardProps {
  onOpenWizard: () => void;
  onOpenUnpackWizard: () => void;
  onLoadSample: () => void;
  onLoadTemplate: (preset: 'orm' | 'ormh' | 'ue5' | 'unity' | 'unpack') => void;
}

export const EmptyStateCard: React.FC<EmptyStateCardProps> = ({
  onOpenWizard,
  onOpenUnpackWizard,
  onLoadSample,
  onLoadTemplate,
}) => {
  return (
    <div className="tl-empty-state" role="region" aria-label="Welcome and Templates">
      <div className="tl-empty-state__card">
        <div className="tl-empty-state__header">
          <div className="tl-empty-state__badge">
            <span>GRAPHITE BLUEPRINT</span>
          </div>
          <h1 className="tl-empty-state__title">TextureLab Workstation</h1>
          <p className="tl-empty-state__desc">
            Drag & drop image files anywhere onto the canvas to begin, or choose a workflow below:
          </p>
        </div>

        {/* Primary Action Buttons */}
        <div className="tl-empty-state__actions">
          <Button
            variant="primary"
            icon={<Wand2 size={13} />}
            onClick={onOpenWizard}
          >
            Launch Pack Wizard
          </Button>

          <Button
            variant="secondary"
            icon={<FileArchive size={13} />}
            onClick={onOpenUnpackWizard}
          >
            Unpack Wizard
          </Button>

          <Button
            variant="ghost"
            icon={<FolderDown size={13} />}
            onClick={onLoadSample}
          >
            Open Benchmark Sample
          </Button>
        </div>

        <div className="tl-empty-state__divider">
          <span>OR START FROM A PRESET TEMPLATE</span>
        </div>

        {/* Template Grid */}
        <div className="tl-empty-state__templates">
          <button
            type="button"
            className="tl-empty-state__tmpl-btn"
            onClick={() => onLoadTemplate('orm')}
          >
            <div className="tl-empty-state__tmpl-icon" style={{ color: 'var(--pbr-packed)' }}>
              <Layers size={14} />
            </div>
            <div className="tl-empty-state__tmpl-info">
              <span className="tl-empty-state__tmpl-name">Pack ORM</span>
              <span className="tl-empty-state__tmpl-sub">AO (R) · Roughness (G) · Metallic (B)</span>
            </div>
          </button>

          <button
            type="button"
            className="tl-empty-state__tmpl-btn"
            onClick={() => onLoadTemplate('ormh')}
          >
            <div className="tl-empty-state__tmpl-icon" style={{ color: 'var(--pbr-height)' }}>
              <Layers size={14} />
            </div>
            <div className="tl-empty-state__tmpl-info">
              <span className="tl-empty-state__tmpl-name">Pack ORMH</span>
              <span className="tl-empty-state__tmpl-sub">AO (R) · Rough (G) · Metal (B) · Height (A)</span>
            </div>
          </button>

          <button
            type="button"
            className="tl-empty-state__tmpl-btn"
            onClick={() => onLoadTemplate('ue5')}
          >
            <div className="tl-empty-state__tmpl-icon" style={{ color: 'var(--info)' }}>
              <Layers size={14} />
            </div>
            <div className="tl-empty-state__tmpl-info">
              <span className="tl-empty-state__tmpl-name">Unreal Engine 5 Preset</span>
              <span className="tl-empty-state__tmpl-sub">BaseColor · ORM Packed · Normal DirectX</span>
            </div>
          </button>

          <button
            type="button"
            className="tl-empty-state__tmpl-btn"
            onClick={() => onLoadTemplate('unity')}
          >
            <div className="tl-empty-state__tmpl-icon" style={{ color: 'var(--ok)' }}>
              <Layers size={14} />
            </div>
            <div className="tl-empty-state__tmpl-info">
              <span className="tl-empty-state__tmpl-name">Unity Mask Map Preset</span>
              <span className="tl-empty-state__tmpl-sub">Metallic (R) · AO (G) · Detail (B) · Smooth (A)</span>
            </div>
          </button>
        </div>
      </div>
    </div>
  );
};
