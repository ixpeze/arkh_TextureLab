/**
 * PBR Texture Lexical Normalizer & Dictionary Engine
 * Detects roles, channel configurations, resolutions, and asset stems from filenames.
 */

export interface PBRChannelMapping {
  r: string;
  g: string;
  b: string;
  a: string;
}

export interface NormalizedTextureMeta {
  originalName: string;
  assetName: string;
  detectedRole: string;
  roleLabel: string;
  roleColor: string;
  colorSpace: 'sRGB' | 'Linear';
  autoInvert: boolean;
  requiresGreenFlip: boolean;
  resolution?: string;
  isPacked: boolean;
  channels: PBRChannelMapping;
}

export const PBR_ROLE_DEFINITIONS: Record<string, {
  label: string;
  color: string;
  colorSpace: 'sRGB' | 'Linear';
  autoInvert?: boolean;
  requiresGreenFlip?: boolean;
  aliases: string[];
}> = {
  ambient_occlusion: {
    label: 'Ambient Occlusion',
    color: 'var(--pbr-ao)',
    colorSpace: 'Linear',
    aliases: ['ambientocclusion', 'ambient_occlusion', 'ao', 'occlusion', 'occ', 'mixed_ao', 'ambient'],
  },
  roughness: {
    label: 'Roughness',
    color: 'var(--pbr-rough)',
    colorSpace: 'Linear',
    aliases: ['roughness', 'rough', 'rgh', 'microsurface', 'r'],
  },
  glossiness: {
    label: 'Glossiness (Inverted)',
    color: 'var(--pbr-rough)',
    colorSpace: 'Linear',
    autoInvert: true,
    aliases: ['glossiness', 'gloss', 'smoothness', 'smooth'],
  },
  metallic: {
    label: 'Metallic',
    color: 'var(--pbr-metal)',
    colorSpace: 'Linear',
    aliases: ['metallic', 'metalness', 'metal', 'met', 'm'],
  },
  height: {
    label: 'Height / Displacement',
    color: 'var(--pbr-height)',
    colorSpace: 'Linear',
    aliases: ['height', 'displacement', 'disp', 'depth', 'bump', 'h'],
  },
  base_color: {
    label: 'Base Color / Albedo',
    color: 'var(--pbr-albedo)',
    colorSpace: 'sRGB',
    aliases: ['basecolor', 'base_color', 'albedo', 'diffuse', 'col', 'color', 'bc', 'd', 'diff'],
  },
  normal: {
    label: 'Normal Map (Tangent)',
    color: 'var(--pbr-normal)',
    colorSpace: 'Linear',
    aliases: ['normal', 'norm', 'nrm', 'nor', 'n', 'normalmap'],
  },
  normal_directx: {
    label: 'Normal (DirectX -Y)',
    color: 'var(--pbr-normal)',
    colorSpace: 'Linear',
    requiresGreenFlip: true,
    aliases: ['normal_dx', 'normaldx', 'dx_normal', 'n_dx'],
  },
  normal_opengl: {
    label: 'Normal (OpenGL +Y)',
    color: 'var(--pbr-normal)',
    colorSpace: 'Linear',
    aliases: ['normal_gl', 'normalgl', 'gl_normal', 'n_gl', 'normal_ogl'],
  },
  emissive: {
    label: 'Emissive',
    color: '#f43f5e',
    colorSpace: 'sRGB',
    aliases: ['emissive', 'emission', 'emit', 'glow', 'illum'],
  },
  opacity: {
    label: 'Opacity / Alpha',
    color: '#cbd5e1',
    colorSpace: 'Linear',
    aliases: ['opacity', 'alpha', 'transparency', 'mask', 'cutout'],
  },
};

export const PACKED_MAP_DEFINITIONS: Record<string, {
  label: string;
  aliases: string[];
  slots: PBRChannelMapping;
}> = {
  orm: {
    label: 'ORM (AO, Rough, Metal)',
    aliases: ['orm', 'ao_rough_metal', 'aorm'],
    slots: { r: 'AO', g: 'Roughness', b: 'Metallic', a: '1.0' },
  },
  ormh: {
    label: 'ORMH (AO, Rough, Metal, Height)',
    aliases: ['ormh', 'aormh'],
    slots: { r: 'AO', g: 'Roughness', b: 'Metallic', a: 'Height' },
  },
  rma: {
    label: 'RMA (Rough, Metal, AO)',
    aliases: ['rma', 'arm'],
    slots: { r: 'Roughness', g: 'Metallic', b: 'AO', a: '1.0' },
  },
  msra: {
    label: 'MSRA (Metal, Smooth, Reflectance, AO)',
    aliases: ['msra', 'masr'],
    slots: { r: 'Metallic', g: 'Smoothness', b: 'Reflectance', a: 'AO' },
  },
};

export const RESOLUTION_PATTERNS = ['8k', '4k', '2k', '1k', '512', '1024', '2048', '4096', '8192'];
export const PREFIX_PATTERNS = ['t_', 'tex_', 'm_', 'mat_'];

export class LexicalNormalizer {
  public static normalizeFilename(filename: string): NormalizedTextureMeta {
    const cleanFilename = filename.split('/').pop()?.split('\\').pop() || filename;
    const dotIdx = cleanFilename.lastIndexOf('.');
    const baseName = dotIdx !== -1 ? cleanFilename.substring(0, dotIdx) : cleanFilename;

    let cleanName = baseName;

    // 1. Detect resolution
    let detectedRes: string | undefined;
    for (const res of RESOLUTION_PATTERNS) {
      const reg = new RegExp(`[._-]${res}(?=[._-]|$)`, 'i');
      if (reg.test(cleanName)) {
        detectedRes = res.toUpperCase();
        cleanName = cleanName.replace(reg, '');
        break;
      }
    }

    const tokens = cleanName.toLowerCase().split(/[._-]/).filter(Boolean);

    // 2. Check Packed maps first
    let detectedRole: string | undefined;
    let roleLabel = 'Unknown Texture';
    let roleColor = 'var(--pbr-scalar)';
    let colorSpace: 'sRGB' | 'Linear' = 'Linear';
    let autoInvert = false;
    let requiresGreenFlip = false;
    let isPacked = false;
    let channels: PBRChannelMapping = { r: 'Red', g: 'Green', b: 'Blue', a: 'Alpha' };

    for (let i = tokens.length - 1; i >= 0; i--) {
      const tok = tokens[i];
      for (const [pKey, pDef] of Object.entries(PACKED_MAP_DEFINITIONS)) {
        if (pDef.aliases.includes(tok)) {
          detectedRole = pKey;
          roleLabel = pDef.label;
          roleColor = 'var(--pbr-packed)';
          isPacked = true;
          channels = pDef.slots;
          break;
        }
      }
      if (isPacked) break;
    }

    // 3. Check Single Roles
    if (!isPacked) {
      for (let i = tokens.length - 1; i >= 0; i--) {
        const tok = tokens[i];
        for (const [rKey, rDef] of Object.entries(PBR_ROLE_DEFINITIONS)) {
          if (rDef.aliases.includes(tok)) {
            detectedRole = rKey;
            roleLabel = rDef.label;
            roleColor = rDef.color;
            colorSpace = rDef.colorSpace;
            autoInvert = !!rDef.autoInvert;
            requiresGreenFlip = !!rDef.requiresGreenFlip;
            break;
          }
        }
        if (detectedRole) break;
      }

      if (detectedRole) {
        if (detectedRole === 'base_color' || detectedRole === 'emissive') {
          channels = { r: 'Red', g: 'Green', b: 'Blue', a: 'Alpha / Opacity' };
        } else if (detectedRole.startsWith('normal')) {
          channels = { r: 'X (Tangent)', g: 'Y (Binormal)', b: 'Z (Normal)', a: '1.0' };
        } else {
          channels = { r: roleLabel, g: roleLabel, b: roleLabel, a: '1.0' };
        }
      }
    }

    // 4. Extract Asset Stem Name
    const assetTokens = cleanName.split(/[._-]/).filter(Boolean);
    if (assetTokens.length > 1 && PREFIX_PATTERNS.includes(assetTokens[0].toLowerCase() + '_')) {
      assetTokens.shift();
    }
    if (detectedRole && assetTokens.length > 1) {
      const lastTok = assetTokens[assetTokens.length - 1].toLowerCase();
      let allAliases: string[] = [];
      if (isPacked && PACKED_MAP_DEFINITIONS[detectedRole]) {
        allAliases = PACKED_MAP_DEFINITIONS[detectedRole].aliases;
      } else if (PBR_ROLE_DEFINITIONS[detectedRole]) {
        allAliases = PBR_ROLE_DEFINITIONS[detectedRole].aliases;
      }
      if (allAliases.includes(lastTok)) {
        assetTokens.pop();
      }
    }

    const assetName = assetTokens.length > 0 ? assetTokens.join('_') : 'Asset';

    return {
      originalName: cleanFilename,
      assetName,
      detectedRole: detectedRole || 'unknown',
      roleLabel,
      roleColor,
      colorSpace,
      autoInvert,
      requiresGreenFlip,
      resolution: detectedRes,
      isPacked,
      channels,
    };
  }
}
