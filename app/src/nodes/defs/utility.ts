import { defineNode, type NodeDef } from '../registry';
import type { TextureBuffer } from '../../types/buffer';
import { CompareNode } from '../../components/nodes/CompareNode';
import { SeamCheckNode } from '../../components/nodes/SeamCheckNode';
import { LoadFolderNode } from '../../components/nodes/LoadFolderNode';
import { ForEachNode } from '../../components/nodes/ForEachNode';
import { BatchExportNode } from '../../components/nodes/BatchExportNode';
import { CommentBoxNode } from '../../components/nodes/CommentBoxNode';

export interface CompareParams {
  mode?: 'wipe' | 'sideBySide' | 'difference';
  wipeProgress?: number;
  diffGain?: number;
  [key: string]: unknown;
}

export interface SeamCheckParams {
  repeats?: 2 | 3 | 4;
  showBorders?: boolean;
  [key: string]: unknown;
}

export interface LoadFolderParams {
  folderName?: string;
  recursive?: boolean;
  activeBuffer?: TextureBuffer;
  [key: string]: unknown;
}

export interface ForEachParams {
  batchCount?: number;
  activeBuffer?: TextureBuffer;
  [key: string]: unknown;
}

export interface BatchExportParams {
  format?: string;
  bitDepth?: string;
  activeBuffer?: TextureBuffer;
  [key: string]: unknown;
}

export interface CommentBoxParams {
  title?: string;
  width?: number;
  height?: number;
  color?: string;
  [key: string]: unknown;
}

export const compareDef: NodeDef<CompareParams> = defineNode<CompareParams>({
  type: 'compare',
  label: 'Compare (A/B Wipe & Diff)',
  category: 'Utility',
  inputs: [
    { id: 'a', kind: 'any', label: 'Input A' },
    { id: 'b', kind: 'any', label: 'Input B' },
  ],
  outputs: [{ id: 'output', kind: 'any', label: 'Result' }],
  params: {
    mode: {
      type: 'enum',
      label: 'Compare Mode',
      options: [
        { value: 'wipe', label: 'Interactive Split Wipe' },
        { value: 'sideBySide', label: 'Side by Side' },
        { value: 'difference', label: 'Pixel Difference' },
      ],
      default: 'wipe',
    },
    wipeProgress: { type: 'number', min: 0, max: 1.0, step: 0.01, label: 'Wipe Split', default: 0.5 },
    diffGain: { type: 'number', min: 1, max: 10, step: 0.5, label: 'Diff Amplification', default: 1.0 },
  },
  defaults: {
    mode: 'wipe',
    wipeProgress: 0.5,
    diffGain: 1.0,
  },
  description: 'Interactive side-by-side, split-screen wipe, or amplified difference visualizer',
  color: '#38bdf8',
  gpu: {
    shaderId: 'compare',
  },
  body: CompareNode,
});

export const seamCheckDef: NodeDef<SeamCheckParams> = defineNode<SeamCheckParams>({
  type: 'seamCheck',
  label: 'Seam Check (Tiled)',
  category: 'Utility',
  inputs: [{ id: 'input', kind: 'any', label: 'Input' }],
  outputs: [{ id: 'output', kind: 'any', label: 'Tiled' }],
  params: {
    repeats: {
      type: 'enum',
      label: 'Tiling Grid',
      options: [
        { value: '2', label: '2x2 Grid' },
        { value: '3', label: '3x3 Grid' },
        { value: '4', label: '4x4 Grid' },
      ],
      default: '2',
    },
    showBorders: { type: 'bool', label: 'Show Seam Boundaries', default: true },
  },
  defaults: {
    repeats: 2,
    showBorders: true,
  },
  description: '2x2, 3x3, or 4x4 tiling with border guidelines for visual seam identification',
  color: '#f59e0b',
  gpu: {
    shaderId: 'seam_check',
  },
  body: SeamCheckNode,
});

export const loadFolderDef: NodeDef<LoadFolderParams> = defineNode<LoadFolderParams>({
  type: 'loadFolder',
  label: 'Load Folder',
  category: 'Labs',
  inputs: [{ id: 'input', kind: 'any', label: 'Pass-through' }],
  outputs: [{ id: 'output', kind: 'any', label: 'Texture Stream' }],
  params: {},
  defaults: {
    folderName: 'Textures',
    recursive: true,
  },
  description: 'Batch asset folder ingestion',
  color: '#38bdf8',
  gpu: {
    shaderId: 'passthrough',
  },
  body: LoadFolderNode,
});

export const forEachDef: NodeDef<ForEachParams> = defineNode<ForEachParams>({
  type: 'forEach',
  label: 'For Each Loop',
  category: 'Labs',
  inputs: [{ id: 'input', kind: 'any', label: 'Loop Item' }],
  outputs: [{ id: 'output', kind: 'any', label: 'Item Out' }],
  params: {},
  defaults: {
    batchCount: 0,
  },
  description: 'Iterative batch processing loop controller',
  color: '#8b5cf6',
  gpu: {
    shaderId: 'passthrough',
  },
  body: ForEachNode,
});

export const batchExportDef: NodeDef<BatchExportParams> = defineNode<BatchExportParams>({
  type: 'batchExport',
  label: 'Batch Export',
  category: 'Labs',
  inputs: [{ id: 'input', kind: 'any', label: 'Export Stream' }],
  outputs: [],
  params: {
    format: {
      type: 'enum',
      label: 'Format',
      options: [
        { value: 'png', label: 'PNG' },
        { value: 'tga', label: 'TGA' },
      ],
      default: 'png',
    },
  },
  defaults: {
    format: 'png',
    bitDepth: '8b',
  },
  description: 'Multi-asset batch queue terminal',
  color: '#22c55e',
  gpu: {
    shaderId: 'passthrough',
  },
  body: BatchExportNode,
});

export const commentBoxDef: NodeDef<CommentBoxParams> = defineNode<CommentBoxParams>({
  type: 'commentBox',
  label: 'Comment Box',
  category: 'Utility',
  hotkey: 'c',
  inputs: [],
  outputs: [],
  params: {},
  defaults: {
    title: 'Comment',
    width: 300,
    height: 200,
    color: '#3b82f6',
  },
  description: 'Resizable organizational backdrop note',
  color: '#38bdf8',
  gpu: {
    shaderId: 'comment',
  },
  body: CommentBoxNode,
});

export default compareDef;
