import React from 'react';
import { Folder, FolderCheck, RotateCcw } from 'lucide-react';
import type {
  GlobalExportSettings,
  TextureExportFormat,
  ExportResolutionSetting,
} from '../../types/export';

export interface DestinationPickerProps {
  settings: GlobalExportSettings;
  setSettings: React.Dispatch<React.SetStateAction<GlobalExportSettings>>;
  directoryHandle: FileSystemDirectoryHandle | null;
  detectedSourceLocation: string;
  onPickDirectory: () => void;
  onResetToSourceLocation: () => void;
  onAssetChange?: (asset: string) => void;
}

export const DestinationPicker: React.FC<DestinationPickerProps> = ({
  settings,
  setSettings,
  directoryHandle,
  detectedSourceLocation,
  onPickDirectory,
  onResetToSourceLocation,
  onAssetChange,
}) => {
  const activeDestinationLabel = directoryHandle
    ? directoryHandle.name
    : `${detectedSourceLocation} (Source)`;

  return (
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

      {/* Resolution Selection */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
        <span style={{ fontSize: 8.5, color: '#94a3b8', fontWeight: 600 }}>Resolution</span>
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
          <option value="8192">8192 × 8192 (8K Cinematic)</option>
        </select>
      </div>

      {/* Default Global Format */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
        <span style={{ fontSize: 8.5, color: '#94a3b8', fontWeight: 600 }}>Global Format</span>
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

      {/* Output Destination (Default to Source Location with Override) */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: 8.5, color: '#94a3b8', fontWeight: 600 }}>Output Destination</span>
          {directoryHandle && (
            <button
              type="button"
              onClick={onResetToSourceLocation}
              style={{
                background: 'transparent',
                border: 'none',
                color: '#94a3b8',
                fontSize: 7.5,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 2,
              }}
              title="Reset output destination back to default source location"
            >
              <RotateCcw size={8} />
              <span>Reset to Source</span>
            </button>
          )}
        </div>
        <button
          type="button"
          onClick={onPickDirectory}
          title="Default: Source Texture Location. Click to pick or override with a disk folder."
          style={{
            height: 28,
            padding: '0 10px',
            backgroundColor: directoryHandle ? 'rgba(34, 197, 94, 0.15)' : 'rgba(56, 189, 248, 0.1)',
            border: `1px solid ${directoryHandle ? '#22c55e' : 'rgba(56, 189, 248, 0.3)'}`,
            borderRadius: 4,
            color: directoryHandle ? '#22c55e' : '#38bdf8',
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
              {activeDestinationLabel}
            </span>
          </div>
          {directoryHandle ? (
            <span style={{ fontSize: 7.5, color: '#4ade80', fontWeight: 700 }}>DISK (OVERRIDE)</span>
          ) : (
            <span style={{ fontSize: 7.5, color: '#38bdf8', fontWeight: 700 }}>DEFAULT (SOURCE)</span>
          )}
        </button>
      </div>
    </div>
  );
};
