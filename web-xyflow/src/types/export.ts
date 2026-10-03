/**
 * Canonical Types for TextureLab Export Pipeline
 * Supports Substance Painter-style token naming, customizable presets, and dual-tier settings.
 */

export type NamingTokenId =
  | '$project'
  | '$asset'
  | '$slot'
  | '$res'
  | '$format'
  | '$colorspace'
  | '$udim';

export interface TokenItem {
  id: string;
  type: 'token' | 'delimiter' | 'literal';
  value: string;
  label?: string;
}

export interface ExportPreset {
  id: string;
  name: string;
  pattern: string; // e.g. "T_{asset}_{slot}"
  description?: string;
  isBuiltIn?: boolean;
}

export type TextureExportFormat = 'PNG' | 'TGA' | 'JPG' | 'WEBP' | 'EXR';
export type ExportFormat = TextureExportFormat;
export type TextureBitDepth = '8b' | '16b';
export type BitDepth = TextureBitDepth;
export type TextureColorSpace = 'linear' | 'sRGB';
export type ExportResolutionSetting = 'inherit' | '512' | '1024' | '2048' | '4096' | '8192';
export type CollisionPolicy = 'skip' | 'overwrite' | 'rename';

export interface GlobalExportSettings {
  projectName: string;
  assetName: string;
  presetId: string;
  pattern: string; // Dynamic output template
  masterResolution: ExportResolutionSetting;
  defaultFormat: TextureExportFormat;
  defaultBitDepth: TextureBitDepth;
  directoryName?: string;
  collisionPolicy?: CollisionPolicy;
}

export interface LocalOutputData {
  title?: string;
  slot?: string; // Effective slot
  isSlotOverridden?: boolean; // True if manually edited
  autoDetectedSlot?: string; // Detected from upstream graph
  outputFilename?: string; // Resolved live filename
  formatOverride?: 'inherit' | TextureExportFormat;
  bitDepthOverride?: 'inherit' | TextureBitDepth;
  colorSpace?: TextureColorSpace;
  isColorSpaceOverridden?: boolean;
  autoDetectedColorSpace?: TextureColorSpace;
  resolutionOverride?: 'inherit' | ExportResolutionSetting;
  enabled?: boolean; // Batch export inclusion
  res?: string;
  onExport?: () => void;
  onChangeFormat?: (fmt: string) => void;
}

export interface TextureItem {
  id: string;
  originalPath: string;
  filename: string;
  stem: string;
  ext: string;
  setName: string;
  mapType: string;
  canonicalSuffix: string;
  orientation?: 'gl' | 'dx' | null;
  variantNum?: number | null;
  mtime?: number;
  dataUrl?: string;
  buffer?: any;
  status?: string;
  action?: 'keep_rename' | 'flip_gl' | 'delete_gl' | 'delete_variant' | 'delete_type_dup' | 'delete_dupe';
  isExcluded?: boolean;
}

export interface TextureCollection {
  id: string;
  name: string;
  items: TextureItem[];
  folder?: string;
  createdAt: number;
}

export interface PreflightOutputItem {
  nodeId: string;
  title: string;
  slot: string;
  isSlotOverridden?: boolean;
  autoDetectedLabel?: string;
  isConnected: boolean;
  previewUrl?: string;
  format: TextureExportFormat;
  bitDepth: TextureBitDepth;
  colorSpace: TextureColorSpace;
  resolution: string;
  resolvedFilename: string;
  enabled: boolean;
  // Shared export registration metadata
  sourceOutput?: string; // e.g. `${sourceNodeId}:${sourceHandle}`
  sourceType?: 'explicit' | 'channelPack' | 'channelUnpack' | 'channelMixer' | 'batchExport';
  sourceHandle?: string;
  batchItemIdentity?: string;
  buffer?: any;
}

