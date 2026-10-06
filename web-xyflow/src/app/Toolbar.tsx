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
  Settings,
  Wand2,
  PanelLeft,
  PanelRight,
} from 'lucide-react';
import { IconButton } from '../ui/IconButton';
import { Button } from '../ui/Button';
import { Tooltip } from '../ui/Tooltip';

export interface ToolbarProps {
  projectName?: string;
  isDirty?: boolean;
  onNewProject?: () => void;
  onOpenProject?: () => void;
  onSaveProject?: () => void;
  onLoadBatchPipeline: () => void;
  onLoadBenchmark: () => void;
  onUndo: () => void;
  canUndo: boolean;
  onRedo: () => void;
  canRedo: boolean;
  onOpenPackWizard: () => void;
  onOpenExportModal: () => void;
  onOpenSettings: () => void;
  onOpenShortcuts: () => void;
  onSpawnCommentBox: () => void;
  onFitView: () => void;
  onClearGraph: () => void;
  isLibraryOpen?: boolean;
  onToggleLibrary?: () => void;
  isInspectorOpen?: boolean;
  onToggleInspector?: () => void;
}

export const Toolbar: React.FC<ToolbarProps> = ({
  projectName,
  isDirty,
  onNewProject,
  onOpenProject,
  onSaveProject,
  onLoadBatchPipeline,
  onLoadBenchmark,
  onUndo,
  canUndo,
  onRedo,
  canRedo,
  onOpenPackWizard,
  onOpenExportModal,
  onOpenSettings,
  onOpenShortcuts,
  onSpawnCommentBox,
  onFitView,
  onClearGraph,
  isLibraryOpen = true,
  onToggleLibrary,
  isInspectorOpen = true,
  onToggleInspector,
}) => {
  return (
    <header className="tl-workstation__header" role="banner">
      {/* Left Branding & Project Info */}
      <div className="tl-flex tl-items-center tl-gap-sm">
        {onToggleLibrary && (
          <Tooltip content="Toggle Node Library Dock (Ctrl+B)">
            <IconButton
              icon={<PanelLeft size={14} />}
              label="Toggle Library"
              size="sm"
              variant={isLibraryOpen ? 'secondary' : 'ghost'}
              onClick={onToggleLibrary}
            />
          </Tooltip>
        )}

        <span className="tl-font-bold tl-text-accent">
          TEXTURELAB
        </span>

        {/* Project Name + Dirty Indicator */}
        <div className="tl-badge tl-flex tl-items-center tl-gap-xs">
          <span>{projectName || 'Untitled'}</span>
          {isDirty && (
            <span
              className="tl-statusbar__dot tl-statusbar__dot--busy"
              title="Unsaved changes"
              aria-label="Unsaved changes"
            />
          )}
        </div>

        {/* File actions */}
        <div className="tl-flex tl-items-center tl-gap-xs">
          {onNewProject && (
            <Tooltip content="New Project (Ctrl+N)">
              <IconButton
                icon={<FilePlus size={13} />}
                label="New Project"
                size="sm"
                variant="ghost"
                onClick={onNewProject}
              />
            </Tooltip>
          )}
          {onOpenProject && (
            <Tooltip content="Open Project (Ctrl+O)">
              <IconButton
                icon={<FolderOpen size={13} />}
                label="Open Project"
                size="sm"
                variant="ghost"
                onClick={onOpenProject}
              />
            </Tooltip>
          )}
          {onSaveProject && (
            <Tooltip content="Save Project (Ctrl+S)">
              <IconButton
                icon={<Save size={13} />}
                label="Save Project"
                size="sm"
                variant={isDirty ? 'primary' : 'ghost'}
                onClick={onSaveProject}
              />
            </Tooltip>
          )}
        </div>

        <div className="tl-statusbar__divider" aria-hidden="true" />

        {/* Quick Samples */}
        <Tooltip content="Open Anthracite Concrete PBR benchmark graph">
          <Button
            variant="ghost"
            size="sm"
            icon={<Sparkles size={12} />}
            onClick={onLoadBenchmark}
          >
            Sample
          </Button>
        </Tooltip>

        <Tooltip content="Load Batch Pipeline Template">
          <Button
            variant="ghost"
            size="sm"
            icon={<FolderOpen size={12} />}
            onClick={onLoadBatchPipeline}
          >
            Batch
          </Button>
        </Tooltip>
      </div>

      {/* Center Primary Action: Pack Wizard */}
      <div className="tl-flex tl-items-center tl-gap-sm">
        <Tooltip content="Open Texture Pack & Unpack Wizard (Ctrl+W)">
          <Button
            variant="primary"
            size="sm"
            icon={<Wand2 size={13} />}
            onClick={onOpenPackWizard}
          >
            Pack Wizard
          </Button>
        </Tooltip>

        <Tooltip content="Batch Export Hub (Ctrl+E)">
          <Button
            variant="outline"
            size="sm"
            icon={<Download size={13} />}
            onClick={onOpenExportModal}
          >
            Export Hub
          </Button>
        </Tooltip>
      </div>

      {/* Right Controls */}
      <div className="tl-flex tl-items-center tl-gap-xs">
        <Tooltip content="Undo (Ctrl+Z)">
          <IconButton
            icon={<Undo2 size={13} />}
            label="Undo"
            size="sm"
            variant="ghost"
            disabled={!canUndo}
            onClick={onUndo}
          />
        </Tooltip>

        <Tooltip content="Redo (Ctrl+Y)">
          <IconButton
            icon={<Redo2 size={13} />}
            label="Redo"
            size="sm"
            variant="ghost"
            disabled={!canRedo}
            onClick={onRedo}
          />
        </Tooltip>

        <div className="tl-statusbar__divider" aria-hidden="true" />

        <Tooltip content="Add Comment Box (C)">
          <IconButton
            icon={<MessageSquare size={13} />}
            label="Comment Box"
            size="sm"
            variant="ghost"
            onClick={onSpawnCommentBox}
          />
        </Tooltip>

        <Tooltip content="Focus View / Fit Extents (F)">
          <IconButton
            icon={<Maximize2 size={13} />}
            label="Fit Extents"
            size="sm"
            variant="ghost"
            onClick={onFitView}
          />
        </Tooltip>

        <Tooltip content="Clear Canvas (Delete all nodes)">
          <IconButton
            icon={<Trash2 size={13} />}
            label="Clear Canvas"
            size="sm"
            variant="danger"
            onClick={onClearGraph}
          />
        </Tooltip>

        <div className="tl-statusbar__divider" aria-hidden="true" />

        <Tooltip content="Preferences & Settings">
          <IconButton
            icon={<Settings size={13} />}
            label="Settings"
            size="sm"
            variant="ghost"
            onClick={onOpenSettings}
          />
        </Tooltip>

        <Tooltip content="Keyboard Shortcuts (?)">
          <IconButton
            icon={<Keyboard size={13} />}
            label="Shortcuts"
            size="sm"
            variant="ghost"
            onClick={onOpenShortcuts}
          />
        </Tooltip>

        {onToggleInspector && (
          <Tooltip content="Toggle Inspector Dock (Ctrl+Alt+B)">
            <IconButton
              icon={<PanelRight size={14} />}
              label="Toggle Inspector"
              size="sm"
              variant={isInspectorOpen ? 'secondary' : 'ghost'}
              onClick={onToggleInspector}
            />
          </Tooltip>
        )}
      </div>
    </header>
  );
};
