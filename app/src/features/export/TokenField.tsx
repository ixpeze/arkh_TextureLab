import React from 'react';
import { Sparkles, RotateCcw, AlertCircle, Folder, Plus } from 'lucide-react';
import type { ExportPreset } from '../../types/export';

export interface TokenFieldProps {
  pattern: string;
  setPattern: React.Dispatch<React.SetStateAction<string>>;
  patternInputRef: React.RefObject<HTMLInputElement | null>;
  validation: { isValid: boolean; error?: string; warning?: string };
  samplePreviewFilename: string;
  currentPreset?: ExportPreset;
  onInsertToken: (token: string) => void;
}

export const TokenField: React.FC<TokenFieldProps> = ({
  pattern,
  setPattern,
  patternInputRef,
  validation,
  samplePreviewFilename,
  currentPreset,
  onInsertToken,
}) => {
  return (
    <div
      style={{
        backgroundColor: 'rgba(20, 24, 34, 0.45)',
        border: '1px solid rgba(255, 255, 255, 0.07)',
        borderRadius: 8,
        padding: '14px 16px',
        display: 'flex',
        flexDirection: 'column',
        gap: 10,
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <Sparkles size={11} color="#a855f7" />
          <span style={{ fontSize: 9.5, fontWeight: 700, color: '#94a3b8', letterSpacing: 0.5 }}>
            Output Name
          </span>
          <span style={{ fontSize: 8, color: '#64748b' }}>
            (Use &quot;/&quot; to automatically organize exported maps into subfolders)
          </span>
        </div>
        <button
          type="button"
          onClick={() => {
            const defaultPat = currentPreset?.pattern || 'T_{asset}_{slot}';
            setPattern(defaultPat);
          }}
          style={{
            background: 'transparent',
            border: 'none',
            color: '#94a3b8',
            fontSize: 8.5,
            display: 'flex',
            alignItems: 'center',
            gap: 4,
            cursor: 'pointer',
          }}
        >
          <RotateCcw size={9} />
          <span>Reset to Preset</span>
        </button>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <input
          ref={patternInputRef}
          type="text"
          value={pattern}
          onChange={(e) => setPattern(e.target.value)}
          placeholder="e.g. T_{asset}_{slot} or {asset}/{slot} (subfolder per asset)"
          style={{
            flex: 1,
            height: 32,
            backgroundColor: '#0a0c12',
            border: `1px solid ${
              !validation.isValid
                ? '#ef4444'
                : validation.warning
                ? '#f59e0b'
                : 'rgba(56, 189, 248, 0.35)'
            }`,
            borderRadius: 5,
            padding: '0 10px',
            color: '#f8fafc',
            fontFamily: "'Geist Mono', monospace",
            fontSize: 11,
            fontWeight: 600,
            outline: 'none',
            boxShadow: !validation.isValid
              ? '0 0 8px rgba(239, 68, 68, 0.25)'
              : '0 0 8px rgba(56, 189, 248, 0.15)',
          }}
        />
      </div>

      {!validation.isValid && validation.error && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            padding: '6px 10px',
            backgroundColor: 'rgba(239, 68, 68, 0.12)',
            border: '1px solid rgba(239, 68, 68, 0.35)',
            borderRadius: 4,
            color: '#f87171',
            fontSize: 8.5,
            fontWeight: 600,
          }}
        >
          <AlertCircle size={12} style={{ flexShrink: 0 }} />
          <span>{validation.error}</span>
        </div>
      )}

      {validation.isValid && validation.warning && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            padding: '6px 10px',
            backgroundColor: 'rgba(245, 158, 11, 0.12)',
            border: '1px solid rgba(245, 158, 11, 0.35)',
            borderRadius: 4,
            color: '#f59e0b',
            fontSize: 8.5,
            fontWeight: 600,
          }}
        >
          <AlertCircle size={12} style={{ flexShrink: 0 }} />
          <span>{validation.warning}</span>
        </div>
      )}

      <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 5, fontSize: 8.5 }}>
        <span style={{ color: '#64748b', fontWeight: 600 }}>Insert Token at Cursor:</span>
        {[
          { token: '{project}', label: '{project}' },
          { token: '{asset}', label: '{asset}' },
          { token: '{slot}', label: '{slot}' },
          { token: '{res}', label: '{res}' },
          { token: '{colorspace}', label: '{colorspace}' },
          { token: '{format}', label: '{format}' },
          { token: '{udim}', label: '{udim}' },
        ].map((t) => (
          <button
            key={t.token}
            type="button"
            onClick={() => onInsertToken(t.token)}
            style={{
              backgroundColor: 'rgba(56, 189, 248, 0.08)',
              border: '1px solid rgba(56, 189, 248, 0.25)',
              borderRadius: 4,
              padding: '3px 7px',
              color: '#38bdf8',
              fontFamily: "'Geist Mono', monospace",
              fontSize: 8.5,
              fontWeight: 700,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 3,
              transition: 'all 100ms ease',
            }}
          >
            <Plus size={8} />
            <span>{t.label}</span>
          </button>
        ))}

        <span style={{ color: 'rgba(255, 255, 255, 0.2)', margin: '0 2px' }}>|</span>

        <button
          type="button"
          onClick={() => onInsertToken('/')}
          title="Create a subfolder structure (e.g. {asset}/{slot})"
          style={{
            backgroundColor: 'rgba(168, 85, 247, 0.14)',
            border: '1px solid rgba(168, 85, 247, 0.35)',
            borderRadius: 4,
            padding: '3px 8px',
            color: '#c084fc',
            fontSize: 8.5,
            fontFamily: "'Geist Mono', monospace",
            fontWeight: 700,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: 4,
            transition: 'all 100ms ease',
          }}
        >
          <Folder size={9} />
          <span>+ / (Subfolder)</span>
        </button>

        {['_', '-', '.'].map((sep) => (
          <button
            key={sep}
            type="button"
            onClick={() => onInsertToken(sep)}
            style={{
              backgroundColor: 'rgba(255, 255, 255, 0.05)',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              borderRadius: 4,
              padding: '3px 7px',
              color: '#cbd5e1',
              fontSize: 8.5,
              fontFamily: "'Geist Mono', monospace",
              fontWeight: 700,
              cursor: 'pointer',
            }}
          >
            +{sep}
          </button>
        ))}
      </div>

      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '7px 12px',
          backgroundColor: 'rgba(74, 222, 128, 0.06)',
          border: '1px solid rgba(74, 222, 128, 0.2)',
          borderRadius: 5,
          fontSize: 9,
        }}
      >
        <span style={{ color: '#94a3b8', fontWeight: 600 }}>Resolved Output Example:</span>
        <span style={{ color: '#4ade80', fontFamily: "'Geist Mono', monospace", fontWeight: 700 }}>
          {samplePreviewFilename}
        </span>
      </div>
    </div>
  );
};
