/**
 * Canonical Types for TextureLab Export Pipeline
 * Supports Substance Painter-style token naming, industry engine presets, and dual-tier settings.
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
  id: string; // Unique identifier for drag-and-drop
  type: 'token' | 'delimiter' | 'literal';
  value: string; // Token key (e.g. '$asset') or literal character (e.g. '_')
  label?: string; // Human readable badge label
}

export type ExportPresetId = 'ue5' | 'unity' | 'substance' | 'blender' | 'custom';

export interface ExportPreset {
  id: ExportPresetId;
  name: string;
  description: string;
  tokens: TokenItem[];
}

export type TextureExportFormat = 'PNG' | 'TGA' | 'JPG' | 'WEBP';
export type TextureBitDepth = '8b' | '16b';
export type TextureColorSpace = 'linear' | 'sRGB';
export type ExportResolutionSetting = 'inherit' | '512' | '1024' | '2048' | '4096' | '8192';

export interface GlobalExportSettings {
  projectName: string;
  assetName: string;
  presetId: ExportPresetId;
  tokens: TokenItem[];
  masterResolution: ExportResolutionSetting;
  defaultFormat: TextureExportFormat;
  defaultBitDepth: TextureBitDepth;
  directoryName?: string;
}

export interface LocalOutputData {
  title?: string;
  slot: string; // e.g. 'ORM', 'BaseColor', 'Normal', 'Roughness'
  outputFilename?: string; // Resolved live filename
  formatOverride?: 'inherit' | TextureExportFormat;
  bitDepthOverride?: 'inherit' | TextureBitDepth;
  colorSpace?: TextureColorSpace;
  resolutionOverride?: 'inherit' | ExportResolutionSetting;
  enabled?: boolean; // Batch export inclusion
  res?: string;
  onExport?: () => void;
  onChangeFormat?: (fmt: string) => void;
}

export interface PreflightOutputItem {
  nodeId: string;
  title: string;
  slot: string;
  isConnected: boolean;
  previewUrl?: string;
  format: TextureExportFormat;
  bitDepth: TextureBitDepth;
  colorSpace: TextureColorSpace;
  resolution: string;
  resolvedFilename: string;
  enabled: boolean;
}
