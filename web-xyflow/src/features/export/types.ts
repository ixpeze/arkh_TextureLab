import type { Node, Edge } from '@xyflow/react';
import type { TextureBuffer } from '../../types/buffer';

export interface ExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  nodes: Node[];
  edges: Edge[];
  evaluatedBuffers: Record<string, TextureBuffer>;
  primaryAsset: string;
  onAssetChange?: (asset: string) => void;
  onUpdateNodeData?: (nodeId: string, patch: Record<string, unknown>) => void;
  onExportComplete?: (message: string) => void;
}

export interface FeedbackState {
  message: string;
  type: 'success' | 'info' | 'error';
}

export interface ExportProgressState {
  current: number;
  total: number;
  filename: string;
}

export interface SavePresetModalState {
  show: boolean;
  mode: 'new' | 'update';
  name: string;
  targetId: string;
}
