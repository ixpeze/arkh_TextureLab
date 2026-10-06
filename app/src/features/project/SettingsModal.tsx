import React, { useState } from 'react';
import { Copy, Check, RotateCcw, FolderOpen } from 'lucide-react';
import { Dialog } from '../../ui/Dialog';
import { Button } from '../../ui/Button';
import { Segmented } from '../../ui/Segmented';
import { NumberField } from '../../ui/NumberField';
import { Checkbox } from '../../ui/Checkbox';
import { useAppStore } from '../../store/useAppStore';

export interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  gpuRenderer?: string;
  gpuVendor?: string;
  maxTextureSize?: number;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  gpuRenderer = 'WebGL2 Shader Engine',
  gpuVendor = 'Direct3D / Hardware Vendor',
  maxTextureSize = 4096,
}) => {
  const previewQuality = useAppStore((s) => s.previewQuality);
  const setPreviewQuality = useAppStore((s) => s.setPreviewQuality);
  const vramBudgetMb = useAppStore((s) => s.vramBudgetMb);
  const setVramBudgetMb = useAppStore((s) => s.setVramBudgetMb);
  const showLabsNodes = useAppStore((s) => s.showLabsNodes);
  const setShowLabsNodes = useAppStore((s) => s.setShowLabsNodes);
  const confirmOnDelete = useAppStore((s) => s.confirmOnDelete);
  const setConfirmOnDelete = useAppStore((s) => s.setConfirmOnDelete);
  const resetLayout = useAppStore((s) => s.resetLayout);
  const setStatusMessage = useAppStore((s) => s.setStatusMessage);

  const [copied, setCopied] = useState(false);

  const handleCopyGpuInfo = async () => {
    const info = JSON.stringify(
      {
        renderer: gpuRenderer,
        vendor: gpuVendor,
        maxTextureSize,
        userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : 'Unknown',
        timestamp: new Date().toISOString(),
      },
      null,
      2
    );
    try {
      await navigator.clipboard.writeText(info);
      setCopied(true);
      setStatusMessage('Copied GPU diagnostic specs to clipboard');
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setStatusMessage('Failed to copy GPU info');
    }
  };

  const handleResetLayout = () => {
    resetLayout();
    setStatusMessage('Restored default workstation layout (260px library / 320px inspector)');
  };

  const handleOpenLogs = () => {
    setStatusMessage('Logs directory: localStorage & console telemetry active');
  };

  return (
    <Dialog
      isOpen={isOpen}
      onClose={onClose}
      title="TextureLab Preferences & Settings"
      width={560}
      footer={
        <div className="tl-flex tl-justify-end tl-gap-md tl-w-full">
          <Button variant="primary" onClick={onClose}>
            Done
          </Button>
        </div>
      }
    >
      <div className="tl-settings">
        {/* Viewport & Performance */}
        <section className="tl-settings__section">
          <span className="tl-settings__title">Viewport & GPU Performance</span>

          <div className="tl-settings__row">
            <div className="tl-settings__label">
              <span className="tl-settings__label-name">Working Preview Quality</span>
              <span className="tl-settings__label-desc">
                Resolution scale for real-time node thumbnails and viewer evaluations
              </span>
            </div>
            <Segmented
              options={[
                { value: 'Auto', label: 'Auto' },
                { value: '512', label: '512' },
                { value: '1K', label: '1K' },
                { value: '2K', label: '2K' },
                { value: 'Full', label: 'Full' },
              ]}
              value={previewQuality}
              onChange={(val) => setPreviewQuality(val as 'Auto' | '512' | '1K' | '2K' | 'Full')}
              size="sm"
            />
          </div>

          <div className="tl-settings__row">
            <div className="tl-settings__label">
              <span className="tl-settings__label-name">VRAM Budget (MB)</span>
              <span className="tl-settings__label-desc">
                Target GPU texture pool cap before LRU texture eviction triggers
              </span>
            </div>
            <div className="tl-w-100">
              <NumberField
                value={vramBudgetMb}
                onChange={(val) => setVramBudgetMb(Math.max(256, Math.min(8192, Math.round(val))))}
                min={256}
                max={8192}
                step={128}
                size="sm"
              />
            </div>
          </div>
        </section>

        {/* Workflow & Nodes */}
        <section className="tl-settings__section">
          <span className="tl-settings__title">Workflow & Node Features</span>

          <div className="tl-settings__row">
            <div className="tl-settings__label">
              <span className="tl-settings__label-name">Show Experimental Labs Nodes</span>
              <span className="tl-settings__label-desc">
                Enable bleeding-edge neural shaders, blur kernels, and prototype operators
              </span>
            </div>
            <Checkbox
              checked={showLabsNodes}
              onCheckedChange={(checked) => setShowLabsNodes(checked)}
              label="Enable Labs"
            />
          </div>

          <div className="tl-settings__row">
            <div className="tl-settings__label">
              <span className="tl-settings__label-name">Confirm on Node Delete</span>
              <span className="tl-settings__label-desc">
                When unchecked, deletions are instant and recoverable via Undo (Ctrl+Z)
              </span>
            </div>
            <Checkbox
              checked={confirmOnDelete}
              onCheckedChange={(checked) => setConfirmOnDelete(checked)}
              label="Ask Confirm"
            />
          </div>

          <div className="tl-settings__row">
            <div className="tl-settings__label">
              <span className="tl-settings__label-name">Workstation Layout</span>
              <span className="tl-settings__label-desc">
                Restore default panel widths (260px library, 320px inspector)
              </span>
            </div>
            <Button
              variant="outline"
              size="sm"
              icon={<RotateCcw size={12} />}
              onClick={handleResetLayout}
            >
              Reset Layout
            </Button>
          </div>
        </section>

        {/* Hardware & Diagnostics */}
        <section className="tl-settings__section">
          <span className="tl-settings__title">Hardware Diagnostics</span>

          <div className="tl-settings__row">
            <div className="tl-settings__label">
              <span className="tl-settings__label-name">Detected GPU Hardware</span>
              <span className="tl-settings__label-desc">
                {gpuRenderer} ({gpuVendor}) · Max Tex: {maxTextureSize}px
              </span>
            </div>
            <div className="tl-flex tl-gap-xs">
              <Button
                variant="outline"
                size="sm"
                icon={copied ? <Check size={12} color="#22c55e" /> : <Copy size={12} />}
                onClick={handleCopyGpuInfo}
              >
                {copied ? 'Copied' : 'Copy Specs'}
              </Button>
              <Button
                variant="ghost"
                size="sm"
                icon={<FolderOpen size={12} />}
                onClick={handleOpenLogs}
              >
                Logs
              </Button>
            </div>
          </div>
        </section>
      </div>
    </Dialog>
  );
};
