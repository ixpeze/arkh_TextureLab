import React, { Suspense, lazy } from 'react';
import type { Node, Edge } from '@xyflow/react';
import type { TextureBuffer } from '../types/buffer';
import type { AssetRecord } from '../types/project';
import { DevHud } from '../features/perf/DevHud';

// Code-split heavy modals (P6-T5)
const PackWizardModal = lazy(() =>
  import('../features/wizard/PackWizardModal').then((m) => ({ default: m.PackWizardModal }))
);
const SettingsModal = lazy(() =>
  import('../features/project/SettingsModal').then((m) => ({ default: m.SettingsModal }))
);
const ShortcutsModal = lazy(() =>
  import('../components/ShortcutsModal').then((m) => ({ default: m.ShortcutsModal }))
);
const ExportModal = lazy(() =>
  import('../components/ExportModal').then((m) => ({ default: m.ExportModal }))
);
const RelinkModal = lazy(() =>
  import('../features/project/RelinkModal').then((m) => ({ default: m.RelinkModal }))
);

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
      {isPackWizardOpen && (
        <Suspense fallback={null}>
          <PackWizardModal
            isOpen={isPackWizardOpen}
            onClose={() => setIsPackWizardOpen(false)}
            onOpenExportHub={() => setIsExportModalOpen(true)}
          />
        </Suspense>
      )}

      {isSettingsOpen && (
        <Suspense fallback={null}>
          <SettingsModal
            isOpen={isSettingsOpen}
            onClose={() => setIsSettingsOpen(false)}
          />
        </Suspense>
      )}

      {isShortcutsOpen && (
        <Suspense fallback={null}>
          <ShortcutsModal
            isOpen={isShortcutsOpen}
            onClose={() => setIsShortcutsOpen(false)}
          />
        </Suspense>
      )}

      {isExportModalOpen && (
        <Suspense fallback={null}>
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
        </Suspense>
      )}

      {isRelinkModalOpen && (
        <Suspense fallback={null}>
          <RelinkModal
            isOpen={isRelinkModalOpen}
            onClose={() => setIsRelinkModalOpen(false)}
            missingAssets={missingAssets}
          />
        </Suspense>
      )}

      <DevHud />
    </>
  );
};
