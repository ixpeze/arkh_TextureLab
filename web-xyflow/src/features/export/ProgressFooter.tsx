import React from 'react';
import { Download, HardDrive, FileArchive } from 'lucide-react';
import type { ExportProgressState } from './types';

export interface ProgressFooterProps {
  isExporting: boolean;
  exportProgress: ExportProgressState | null;
  directoryHandle: { name: string } | null;
  detectedSourceLocation: string;
  readyCount: number;
  totalCount: number;
  isValid: boolean;
  onClose: () => void;
  onExecuteExport: () => void;
}

export const ProgressFooter: React.FC<ProgressFooterProps> = ({
  isExporting,
  exportProgress,
  directoryHandle,
  detectedSourceLocation,
  readyCount,
  totalCount,
  isValid,
  onClose,
  onExecuteExport,
}) => {
  return (
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
                {directoryHandle ? `Direct Disk (${directoryHandle.name})` : `Source Location (${detectedSourceLocation})`}
              </strong>
            </span>
          </div>
          <span style={{ color: 'rgba(255, 255, 255, 0.15)' }}>•</span>
          <span style={{ color: '#cbd5e1' }}>
            <strong>{readyCount}</strong> of {totalCount} maps armed
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
            onClick={onExecuteExport}
            disabled={isExporting || readyCount === 0 || !isValid}
            style={{
              height: 32,
              padding: '0 20px',
              backgroundColor: readyCount > 0 && isValid ? '#22c55e' : 'rgba(255, 255, 255, 0.05)',
              border: 'none',
              borderRadius: 5,
              color: readyCount > 0 && isValid ? '#0a0d14' : '#64748b',
              fontSize: 10.5,
              fontWeight: 800,
              letterSpacing: '0.03em',
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              cursor: readyCount > 0 && isValid && !isExporting ? 'pointer' : 'not-allowed',
              transition: 'all 140ms ease',
              boxShadow: readyCount > 0 && isValid ? '0 2px 14px rgba(34, 197, 94, 0.35)' : 'none',
            }}
            onMouseEnter={(e) => {
              if (readyCount > 0 && isValid && !isExporting) {
                e.currentTarget.style.backgroundColor = '#4ade80';
                e.currentTarget.style.transform = 'translateY(-1px)';
              }
            }}
            onMouseLeave={(e) => {
              if (readyCount > 0 && isValid && !isExporting) {
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
  );
};
