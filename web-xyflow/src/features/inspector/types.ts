import type { Node, Edge } from '@xyflow/react';
import type { TextureBuffer } from '../../engine/pixelEngine';

export type ChannelKey = 'RGBA' | 'R' | 'G' | 'B' | 'A';

export interface HoverPixelInfo {
  x: number;
  y: number;
  r: number;
  g: number;
  b: number;
  a: number;
}

export interface FloatingDetailsPanelProps {
  selectedNode: Node | null;
  nodes?: Node[];
  primaryAsset: string;
  onAssetChange: (asset: string) => void;
  activeBuffer?: TextureBuffer | null;
  edges?: Edge[];
  onUpdateNodeData?: (nodeId: string, patch: Record<string, unknown>) => void;
  onExportTarget?: (filename: string) => void;
}
