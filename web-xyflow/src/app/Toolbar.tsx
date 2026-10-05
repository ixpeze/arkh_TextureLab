import React from 'react';
import {
  Maximize2,
  Trash2,
  Keyboard,
  Undo2,
  Redo2,
  MessageSquare,
  Download,
  FolderOpen,
  Sparkles,
  FilePlus,
  Save,
} from 'lucide-react';

export interface ToolbarProps {
  onLoadBatchPipeline: () => void;
  onLoadBenchmark: () => void;
  onUndo: () => void;
  canUndo: boolean;
  onRedo: () => void;
  canRedo: boolean;
  onSpawnCommentBox: () => void;
  onOpenExportModal: () => void;
  onOpenShortcuts: () => void;
  onFitView: () => void;
  onClearGraph: () => void;
  onNewProject?: () => void;
  onOpenProject?: () => void;
  onSaveProject?: () => void;
  projectName?: string;
  isDirty?: boolean;
}

export const Toolbar: React.FC<ToolbarProps> = ({
  onLoadBatchPipeline,
  onLoadBenchmark,
  onUndo,
  canUndo,
  onRedo,
  canRedo,
  onSpawnCommentBox,
  onOpenExportModal,
  onOpenShortcuts,
  onFitView,
  onClearGraph,
  onNewProject,
  onOpenProject,
  onSaveProject,
  projectName,
  isDirty,
}) => {
  return (
    <header
      style={{
        height: 38,
        backgroundColor: 'var(--bg-inset)',
        borderBottom: '1px solid var(--border-subtle)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 14px',
        zIndex: 30,
        userSelect: 'none',
      }}
    >
      {/* Left Branding: Minimalist Name & Project Controls */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span
          style={{
            fontFamily: "'Geist', sans-serif",
            fontWeight: 800,
            fontSize: 13,
            letterSpacing: '0.08em',
            background: 'linear-gradient(135deg, #38bdf8 0%, #a855f7 100%)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            marginRight: 4,
          }}
        >
          TextureLAB
        </span>

        {/* Project Name + Dirty Indicator */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 5,
            padding: '2px 7px',
            backgroundColor: 'rgba(255, 255, 255, 0.04)',
            border: '1px solid rgba(255, 255, 255, 0.08)',
            borderRadius: 3,
            fontSize: 9.5,
            color: '#e4e4e7',
          }}
        >
          <span style={{ fontWeight: 600 }}>{projectName || 'Untitled'}</span>
          {isDirty && (
            <span
              style={{
                width: 6,
                height: 6,
                borderRadius: '50%',
                backgroundColor: '#f59e0b',
                display: 'inline-block',
              }}
              title="Unsaved changes"
            />
          )}
        </div>

        {/* File actions */}
        {onNewProject && (
          <button
            type="button"
            onClick={onNewProject}
            title="New Project (Ctrl+N)"
            className="tactical-tool-btn"
            style={{ width: 22, height: 22 }}
          >
            <FilePlus size={11} color="#a1a1aa" />
          </button>
        )}
        {onOpenProject && (
          <button
            type="button"
            onClick={onOpenProject}
            title="Open Project (Ctrl+O)"
            className="tactical-tool-btn"
            style={{ width: 22, height: 22 }}
          >
            <FolderOpen size={11} color="#a1a1aa" />
          </button>
        )}
        {onSaveProject && (
          <button
            type="button"
            onClick={onSaveProject}
            title="Save Project (Ctrl+S)"
            className="tactical-tool-btn"
            style={{
              width: 22,
              height: 22,
              color: isDirty ? '#f59e0b' : '#a1a1aa',
              borderColor: isDirty ? 'rgba(245, 158, 11, 0.4)' : undefined,
            }}
          >
            <Save size={11} />
          </button>
        )}

        <div style={{ width: 1, height: 16, backgroundColor: 'rgba(255, 255, 255, 0.08)', margin: '0 2px' }} />

        <button
          type="button"
          onClick={onLoadBatchPipeline}
          title="Load Example Pipeline: Load Folder → For Each → Normalize/Resize → Batch Export"
          style={{
            background: 'rgba(56, 189, 248, 0.1)',
            border: '1px solid rgba(56, 189, 248, 0.3)',
            color: '#38bdf8',
            borderRadius: 3,
            padding: '2px 8px',
            fontSize: 8.5,
            fontWeight: 700,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: 4,
            transition: 'all 120ms ease',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = 'rgba(56, 189, 248, 0.2)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = 'rgba(56, 189, 248, 0.1)';
          }}
        >
          <FolderOpen size={10} />
          <span>Batch Pipeline Example</span>
        </button>

        <button
          type="button"
          onClick={onLoadBenchmark}
          title="Load Anthracite Concrete (Benchmark Maps)"
          style={{
            background: 'rgba(168, 85, 247, 0.1)',
            border: '1px solid rgba(168, 85, 247, 0.3)',
            color: '#c084fc',
            borderRadius: 3,
            padding: '2px 8px',
            fontSize: 8.5,
            fontWeight: 700,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: 4,
            transition: 'all 120ms ease',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = 'rgba(168, 85, 247, 0.2)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = 'rgba(168, 85, 247, 0.1)';
          }}
        >
          <Sparkles size={10} />
          <span>Load Benchmark</span>
        </button>
      </div>

      {/* Right Toolbar Controls: 1:1 Square Icon-Only Buttons with Rich Hover Tooltip */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        {/* Undo */}
        <div className="tactical-btn-wrapper">
          <button
            type="button"
            onClick={onUndo}
            disabled={!canUndo}
            className="tactical-tool-btn"
            title="Undo (Ctrl+Z)"
          >
            <Undo2 size={13} />
          </button>
          <div className="tactical-tooltip">
            <div className="tactical-tooltip-header">
              <span className="tactical-tooltip-title">Undo</span>
              <span className="tactical-tooltip-badge">Ctrl+Z</span>
            </div>
            <span className="tactical-tooltip-desc">Revert last graph change</span>
          </div>
        </div>

        {/* Redo */}
        <div className="tactical-btn-wrapper">
          <button
            type="button"
            onClick={onRedo}
            disabled={!canRedo}
            className="tactical-tool-btn"
            title="Redo (Ctrl+Y)"
          >
            <Redo2 size={13} />
          </button>
          <div className="tactical-tooltip">
            <div className="tactical-tooltip-header">
              <span className="tactical-tooltip-title">Redo</span>
              <span className="tactical-tooltip-badge">Ctrl+Y</span>
            </div>
            <span className="tactical-tooltip-desc">Reapply undone change</span>
          </div>
        </div>

        {/* Comment Box */}
        <div className="tactical-btn-wrapper">
          <button
            type="button"
            onClick={onSpawnCommentBox}
            className="tactical-tool-btn"
            title="Comment Box (C)"
          >
            <MessageSquare size={13} color="#38bdf8" />
          </button>
          <div className="tactical-tooltip">
            <div className="tactical-tooltip-header">
              <span className="tactical-tooltip-title">Comment Box</span>
              <span className="tactical-tooltip-badge">C</span>
            </div>
            <span className="tactical-tooltip-desc">Enclose selected nodes in comment frame</span>
          </div>
        </div>

        {/* Global Export Button */}
        <div className="tactical-btn-wrapper">
          <button
            type="button"
            onClick={onOpenExportModal}
            className="tactical-tool-btn"
            title="Export Textures Hub (Ctrl+E)"
            style={{
              backgroundColor: 'rgba(34, 197, 94, 0.15)',
              border: '1px solid rgba(34, 197, 94, 0.35)',
              color: '#4ade80',
              width: 'auto',
              padding: '0 8px',
              display: 'flex',
              alignItems: 'center',
              gap: 5,
              fontWeight: 700,
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = 'rgba(34, 197, 94, 0.28)';
              e.currentTarget.style.borderColor = '#4ade80';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = 'rgba(34, 197, 94, 0.15)';
              e.currentTarget.style.borderColor = 'rgba(34, 197, 94, 0.35)';
            }}
          >
            <Download size={12} strokeWidth={2.5} />
            <span style={{ fontSize: 9.5 }}>Export</span>
          </button>
          <div className="tactical-tooltip">
            <div className="tactical-tooltip-header">
              <span className="tactical-tooltip-title">Export Hub</span>
              <span className="tactical-tooltip-badge">Ctrl+E</span>
            </div>
            <span className="tactical-tooltip-desc">Batch export graph textures with token naming</span>
          </div>
        </div>

        <div style={{ width: 1, height: 16, backgroundColor: 'rgba(255, 255, 255, 0.08)' }} />

        {/* Shortcuts */}
        <div className="tactical-btn-wrapper">
          <button
            type="button"
            onClick={onOpenShortcuts}
            className="tactical-tool-btn"
            title="Shortcuts (?)"
          >
            <Keyboard size={13} color="#a855f7" />
          </button>
          <div className="tactical-tooltip">
            <div className="tactical-tooltip-header">
              <span className="tactical-tooltip-title">Keybindings</span>
              <span className="tactical-tooltip-badge">?</span>
            </div>
            <span className="tactical-tooltip-desc">View keyboard shortcut cheatsheet</span>
          </div>
        </div>

        {/* Focus */}
        <div className="tactical-btn-wrapper">
          <button
            type="button"
            onClick={onFitView}
            className="tactical-tool-btn"
            title="Focus Extents (F)"
          >
            <Maximize2 size={13} color="#38bdf8" />
          </button>
          <div className="tactical-tooltip">
            <div className="tactical-tooltip-header">
              <span className="tactical-tooltip-title">Focus View</span>
              <span className="tactical-tooltip-badge">F</span>
            </div>
            <span className="tactical-tooltip-desc">Fit all nodes to screen</span>
          </div>
        </div>

        {/* Clear */}
        <div className="tactical-btn-wrapper">
          <button
            type="button"
            onClick={onClearGraph}
            className="tactical-tool-btn danger"
            title="Clear Canvas (Del)"
          >
            <Trash2 size={13} color="#f87171" />
          </button>
          <div className="tactical-tooltip">
            <div className="tactical-tooltip-header">
              <span className="tactical-tooltip-title">Clear Graph</span>
              <span className="tactical-tooltip-badge">Delete</span>
            </div>
            <span className="tactical-tooltip-desc">Remove all nodes and connections</span>
          </div>
        </div>
      </div>
    </header>
  );
};
