import type {
  ExportPreset,
  GlobalExportSettings,
  NamingTokenId,
  TokenItem,
} from '../types/export';

export type ExportTargetResolution =
  | { mode: 'inherit' }
  | { mode: 'longEdge'; px: number }
  | { mode: 'stretch'; w: number; h: number };

export function calculateTargetDimensions(
  srcWidth: number,
  srcHeight: number,
  target?: ExportTargetResolution | number
): { width: number; height: number } {
  if (!target) {
    return { width: srcWidth, height: srcHeight };
  }

  if (typeof target === 'number') {
    return calculateTargetDimensions(srcWidth, srcHeight, { mode: 'longEdge', px: target });
  }

  if (target.mode === 'inherit') {
    return { width: srcWidth, height: srcHeight };
  }

  if (target.mode === 'stretch') {
    return { width: Math.max(1, Math.round(target.w)), height: Math.max(1, Math.round(target.h)) };
  }

  if (target.mode === 'longEdge') {
    const px = target.px;
    if (px <= 0) return { width: srcWidth, height: srcHeight };

    if (srcWidth >= srcHeight) {
      const outWidth = px;
      const outHeight = Math.max(1, Math.round((srcHeight * px) / srcWidth));
      return { width: outWidth, height: outHeight };
    } else {
      const outHeight = px;
      const outWidth = Math.max(1, Math.round((srcWidth * px) / srcHeight));
      return { width: outWidth, height: outHeight };
    }
  }

  return { width: srcWidth, height: srcHeight };
}

/* ========================================================================= */
/* 1. INDUSTRY STANDARD PRESETS & TOKENS                                     */
/* ========================================================================= */

export const AVAILABLE_TOKENS: { id: NamingTokenId; label: string; example: string }[] = [
  { id: '$project', label: 'Project', example: 'TextureLab' },
  { id: '$asset', label: 'Asset', example: 'AnthraciteConcrete' },
  { id: '$slot', label: 'Map Slot', example: 'ORM' },
  { id: '$res', label: 'Resolution', example: '4K' },
  { id: '$colorspace', label: 'Color Space', example: 'Linear' },
  { id: '$format', label: 'Format', example: 'png' },
  { id: '$udim', label: 'UDIM Tile', example: '1001' },
];

export const DEFAULT_PRESETS: ExportPreset[] = [
  {
    id: 'ue5',
    name: 'Unreal Engine 5 (T_{asset}_{slot})',
    pattern: 'T_{asset}_{slot}',
    description: 'Epic Games PBR standard: T_ prefix, asset name, and packed slot.',
    isBuiltIn: true,
  },
  {
    id: 'unity',
    name: 'Unity URP / HDRP ({asset}_{slot})',
    pattern: '{asset}_{slot}',
    description: 'Unity Standard & MaskMap standard: Asset name followed by map type.',
    isBuiltIn: true,
  },
  {
    id: 'substance',
    name: 'Substance Painter ({asset}_{slot}_{res})',
    pattern: '{asset}_{slot}_{res}',
    description: 'Substance 3D Painter classic export: Asset, Slot name, and Resolution.',
    isBuiltIn: true,
  },
  {
    id: 'blender',
    name: 'Blender Principled ({asset}_{slot})',
    pattern: '{asset}_{slot}',
    description: 'Clean Blender & glTF 2.0 PBR naming.',
    isBuiltIn: true,
  },
  {
    id: 'cryengine',
    name: 'CryEngine (T_{asset}_{slot})',
    pattern: 'T_{asset}_{slot}',
    description: 'CryEngine PBR texture standard.',
    isBuiltIn: true,
  },
];

export const EXPORT_PRESETS = DEFAULT_PRESETS;

export const DEFAULT_GLOBAL_SETTINGS: GlobalExportSettings = {
  projectName: 'TextureLab',
  assetName: 'AnthraciteConcrete',
  presetId: 'ue5',
  pattern: 'T_{asset}_{slot}',
  masterResolution: 'inherit',
  defaultFormat: 'PNG',
  defaultBitDepth: '8b',
};

/* ========================================================================= */
/* 2. TOKEN RESOLUTION                                                       */
/* ========================================================================= */

export interface TokenResolveContext {
  project?: string;
  asset?: string;
  slot?: string;
  res?: string;
  format: string;
  colorSpace?: string;
  udim?: string;
  set?: string;
  texture?: string;
  map?: string;
  index?: number | string;
}

export function loadPresets(): ExportPreset[] {
  try {
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem('texturelab_export_presets');
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed) && parsed.length > 0) {
          const custom = parsed.filter((p: ExportPreset) => !DEFAULT_PRESETS.some((dp) => dp.id === p.id));
          return [...DEFAULT_PRESETS, ...custom];
        }
      }
    }
  } catch (e) {
    console.warn('Failed to load presets from localStorage', e);
  }
  return [...DEFAULT_PRESETS];
}

export function savePresets(presets: ExportPreset[]): void {
  try {
    if (typeof window !== 'undefined') {
      localStorage.setItem('texturelab_export_presets', JSON.stringify(presets));
    }
  } catch (e) {
    console.warn('Failed to save presets to localStorage', e);
  }
}

export function validatePattern(pattern: string): { isValid: boolean; warning?: string; error?: string } {
  if (!pattern || pattern.trim().length === 0) {
    return { isValid: false, error: 'Output template cannot be empty' };
  }
  if (/[\\:*?"<>|]/.test(pattern)) {
    return { isValid: false, error: 'Illegal characters (\\ : * ? " < > |) detected. Use / for subfolders.' };
  }
  if (/\/{2,}/.test(pattern)) {
    return { isValid: false, error: 'Consecutive slashes (//) are not allowed in folder paths.' };
  }
  const hasSlot = /\{slot\}|\$slot|\{map\}|\$map/i.test(pattern);
  if (!hasSlot) {
    return { isValid: true, warning: 'Warning: Missing {slot} or {map} token. Output filenames may overwrite each other.' };
  }
  return { isValid: true };
}

export function resolveFilename(
  patternOrTokens: string | TokenItem[],
  ctx: TokenResolveContext
): string {
  let raw = '';
  if (typeof patternOrTokens === 'string') {
    raw = patternOrTokens;
    const replaceMap: Record<string, string> = {
      project: ctx.project || 'Project',
      asset: ctx.asset || 'Asset',
      slot: ctx.slot || ctx.map || 'ORM',
      res: ctx.res || '4K',
      format: ctx.format.toLowerCase() || 'png',
      colorspace: ctx.colorSpace || 'Linear',
      udim: ctx.udim || '1001',
      set: ctx.set || ctx.asset || 'Set',
      texture: ctx.texture || ctx.asset || 'Texture',
      map: ctx.map || ctx.slot || 'Map',
      index: ctx.index !== undefined ? String(ctx.index) : '1',
    };
    for (const [key, val] of Object.entries(replaceMap)) {
      raw = raw.replace(new RegExp(`\\{${key}\\}`, 'gi'), val);
      raw = raw.replace(new RegExp(`\\$${key}\\b`, 'gi'), val);
    }
  } else {
    raw = patternOrTokens.map((t) => {
      switch (t.value) {
        case '$project':
          return ctx.project || 'Project';
        case '$asset':
          return ctx.asset || 'Asset';
        case '$slot':
          return ctx.slot || 'ORM';
        case '$res':
          return ctx.res || '4K';
        case '$format':
          return ctx.format.toLowerCase() || 'png';
        case '$colorspace':
          return ctx.colorSpace || 'Linear';
        case '$udim':
          return ctx.udim || '1001';
        default:
          return t.value;
      }
    }).join('');
  }

  const ext = ctx.format.toLowerCase();
  if (!raw.toLowerCase().endsWith(`.${ext}`)) {
    raw = raw.replace(/[._-]+$/, '') + `.${ext}`;
  }

  const segments = raw
    .split('/')
    .map((seg) => seg.replace(/[\\:*?"<>|]/g, '_').trim())
    .filter(Boolean);

  return segments.join('/');
}
