import React from 'react';
import type { Node, Edge } from '@xyflow/react';
import type { TextureBuffer } from '../types/buffer';
import type { AssetRecord } from '../types/project';
import { PackWizardModal } from '../features/wizard/PackWizardModal';
import { SettingsModal } from '../features/project/SettingsModal';
import { ShortcutsModal } from '../components/ShortcutsModal';
import { ExportModal } from '../components/ExportModal';
import { RelinkModal } from '../features/project/RelinkModal';
import { DevHud } from '../features/perf/DevHud';

export interface WorkbenchModalsProps {
  isPackWizardOpen: boolean;
  setIsPackWizardOpen: (open: boolean) => void;
  isSettingsOpen: boolean;
  setIsSettingsOpen: (open: boolean) => void;
  isShortcutsOpen: boolean;
  setIsShortcutsOpen: (open: boolean) => void;
  isExportModalOpen: boolean;
  setIsExportModalOpen: (open: boolean) => void;
  isRelinkModalOpen: boolean;
  setIsRelinkModalOpen: (open: boolean) => void;
  nodes: Node[];
  edges: Edge[];
  evaluatedBuffers: Record<string, TextureBuffer>;
  primaryAsset: string;
  onAssetChange: (asset: string) => void;
  onUpdateNodeData: (id: string, patch: Record<string, unknown>) => void;
  setStatusMessage: (msg: string) => void;
  missingAssets: AssetRecord[];
}

export const WorkbenchModals: React.FC<WorkbenchModalsProps> = ({
  isPackWizardOpen,
  setIsPackWizardOpen,
  isSettingsOpen,
  setIsSettingsOpen,
  isShortcutsOpen,
  setIsShortcutsOpen,
  isExportModalOpen,
  setIsExportModalOpen,
  isRelinkModalOpen,
  setIsRelinkModalOpen,
  nodes,
  edges,
  evaluatedBuffers,
  primaryAsset,
  onAssetChange,
  onUpdateNodeData,
  setStatusMessage,
  missingAssets,
}) => {
  return (
    <>
      <PackWizardModal
        isOpen={isPackWizardOpen}
        onClose={() => setIsPackWizardOpen(false)}
        onOpenExportHub={() => setIsExportModalOpen(true)}
      />

      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
      />

      <ShortcutsModal
        isOpen={isShortcutsOpen}
        onClose={() => setIsShortcutsOpen(false)}
      />

      <ExportModal
        isOpen={isExportModalOpen}
        onClose={() => setIsExportModalOpen(false)}
        nodes={nodes}
        edges={edges}
        evaluatedBuffers={evaluatedBuffers}
        primaryAsset={primaryAsset}
        onAssetChange={onAssetChange}
        onUpdateNodeData={onUpdateNodeData}
        onExportComplete={(msg) => setStatusMessage(msg)}
      />

      <RelinkModal
        isOpen={isRelinkModalOpen}
        onClose={() => setIsRelinkModalOpen(false)}
        missingAssets={missingAssets}
      />

      <DevHud />
    </>
  );
};
