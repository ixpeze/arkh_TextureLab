import type { Node, Edge } from '@xyflow/react';

export interface AssetRecord {
  id: string;
  name: string;
  rel: string;
  abs: string;
  bytes: number;
  mtimeMs?: number;
  sha1?: string;
}

export interface ProjectMeta {
  id: string;
  name: string;
  createdAt: string;
  modifiedAt: string;
}

export interface ProjectExportSettings {
  primaryAsset: string;
  exportPattern: string;
  exportDirRel?: string;
  exportDirAbs?: string;
  selectedPresetId?: string;
}

export interface ProjectView {
  zoom: number;
  pan: [number, number];
}

export interface CommentBoxRecord {
  id: string;
  title: string;
  rect: [number, number, number, number];
  color?: string;
}

export interface TlabDocument {
  format: 'arkh-texturelab';
  schemaVersion: number;
  appVersion: string;
  meta: ProjectMeta;
  assets: AssetRecord[];
  graph: {
    nodes: Node[];
    edges: Edge[];
    comments?: CommentBoxRecord[];
  };
  export: {
    settings: ProjectExportSettings;
    presets?: unknown[];
  };
  view: ProjectView;
}
