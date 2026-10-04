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

export interface TextureBatchItem {
  id: string;
  originalName: string;
  originalPath: string;
  newName: string;
  cleanStem: string;
  mapType: string;
  suffix: string;
  orientation: 'gl' | 'dx' | null;
  variantNum: number | null;
  action: 'keep_rename' | 'flip_gl' | 'delete_gl' | 'delete_variant' | 'delete_type_dup' | 'delete_dupe';
  status: string;
  mtime: number;
  buffer?: unknown;
  dataUrl?: string;
}

export const PBR_ROLE_DEFINITIONS: Record<string, {
  label: string;
  color: string;
  colorSpace: 'sRGB' | 'Linear';
  autoInvert?: boolean;
  requiresGreenFlip?: boolean;
  aliases: string[];
}> = {
  base_color: {
    label: 'Base Color / Albedo',
    color: 'var(--pbr-albedo)',
    colorSpace: 'sRGB',
    aliases: [
      'basecolor', 'albedo', 'base', 'color', 'diffuse', 'bc', 'diff',
      '_col', '_color_', '_diffuse_', '_base_', '_albedo_', 'base_color', 'd', 'col'
    ],
  },
  normal: {
    label: 'Normal Map (Tangent)',
    color: 'var(--pbr-normal)',
    colorSpace: 'Linear',
    aliases: [
      'normal', 'nrm', 'norm', '_n', 'nor', 'normaldx', 'nor_dx',
      'nrm_dx', '_nor_dx_', '_nor_', '_nrm_', 'normals', '_normal_',
      'normalgl', 'nor_gl', 'nrm_gl', '_nor_gl_', 'normalmap', 'n'
    ],
  },
  normal_directx: {
    label: 'Normal (DirectX -Y)',
    color: 'var(--pbr-normal)',
    colorSpace: 'Linear',
    requiresGreenFlip: true,
    aliases: ['normal_dx', 'normaldx', 'dx_normal', 'n_dx', 'nor_dx', 'nrm_dx', '_nor_dx_'],
  },
  normal_opengl: {
    label: 'Normal (OpenGL +Y)',
    color: 'var(--pbr-normal)',
    colorSpace: 'Linear',
    aliases: ['normal_gl', 'normalgl', 'gl_normal', 'n_gl', 'nor_gl', 'nrm_gl', 'normal_ogl', '_nor_gl_'],
  },
  roughness: {
    label: 'Roughness',
    color: 'var(--pbr-rough)',
    colorSpace: 'Linear',
    aliases: ['roughness', 'rough', '_rough_', 'gls', 'gloss', 'glossiness', '_rgh_', 'rgh', 'microsurface', 'smoothness', 'r'],
  },
  glossiness: {
    label: 'Glossiness (Inverted)',
    color: 'var(--pbr-rough)',
    colorSpace: 'Linear',
    autoInvert: true,
    aliases: ['glossiness', 'gloss', 'smoothness', 'gls'],
  },
  metallic: {
    label: 'Metallic',
    color: 'var(--pbr-metal)',
    colorSpace: 'Linear',
    aliases: ['metallic', 'metal', '_mtl_', 'metalness', '_metal_', 'mtl', 'met', 'm'],
  },
  ambient_occlusion: {
    label: 'Ambient Occlusion',
    color: 'var(--pbr-ao)',
    colorSpace: 'Linear',
    aliases: ['ao', 'occlusion', 'ambientocclusion', 'ambient_occlusion', '_ao_', 'occ', '_occlusion_', 'ambient', 'mixed_ao'],
  },
  height: {
    label: 'Height / Displacement',
    color: 'var(--pbr-height)',
    colorSpace: 'Linear',
    aliases: ['height', 'displacement', 'disp', 'parallax', '_h_', '_height_', '_disp_', 'bump', '_bump_', 'heightmap', 'depth', 'h'],
  },
  emissive: {
    label: 'Emissive',
    color: '#f43f5e',
    colorSpace: 'sRGB',
    aliases: ['emissive', 'emissivecolor', 'emi', 'emission', 'emit', 'glow', 'illum', 'e'],
  },
  specular: {
    label: 'Specular',
    color: '#e2e8f0',
    colorSpace: 'Linear',
    aliases: ['specular', 'spec', 'spc'],
  },
  opacity: {
    label: 'Opacity / Alpha',
    color: '#cbd5e1',
    colorSpace: 'Linear',
    aliases: ['opacity', 'alpha', 'transparency', 'mask', 'cutout', 'translucency', 'trans'],
  },
  fuzz: {
    label: 'Fuzz',
    color: '#f59e0b',
    colorSpace: 'Linear',
    aliases: ['fuzz', 'fuzzy'],
  },
  preview: {
    label: 'Preview',
    color: '#64748b',
    colorSpace: 'sRGB',
    aliases: ['preview', 'thumb', 'thumbnail', 'icon', 'render'],
  },
};

export const PACKED_MAP_DEFINITIONS: Record<string, {
  label: string;
  aliases: string[];
  slots: PBRChannelMapping;
}> = {
  orm: {
    label: 'ORM (AO, Rough, Metal)',
    aliases: ['orm', 'occlusionroughnessmetallic', 'occlusion+roughness+metallic', 'ao_rough_metal', 'aorm'],
    slots: { r: 'AO', g: 'Roughness', b: 'Metallic', a: '1.0' },
  },
  ormh: {
    label: 'ORMH (AO, Rough, Metal, Height)',
    aliases: ['ormh', 'aormh'],
    slots: { r: 'AO', g: 'Roughness', b: 'Metallic', a: 'Height' },
  },
  rma: {
    label: 'RMA (Rough, Metal, AO)',
    aliases: ['rma', 'arm', 'roughnessmetallicocclusion', 'roughness+metallic+occlusion'],
    slots: { r: 'Roughness', g: 'Metallic', b: 'AO', a: '1.0' },
  },
  msra: {
    label: 'MSRA (Metal, Smooth, Reflectance, AO)',
    aliases: ['msra', 'masr'],
    slots: { r: 'Metallic', g: 'Smoothness', b: 'Reflectance', a: 'AO' },
  },
};

export const RESOLUTION_PATTERNS = ['16k', '8k', '4k', '2k', '1k', '512', '1024', '2048', '4096', '8192', '16384'];
export const PREFIX_PATTERNS = [
  'texturescom_', 'cgtextures_', 'ambientcg_', 'cc0textures_', 'poliigon_', 'megascans_', 'quixel_', 'substance_', 'freepbr_', 'polyhaven_', 'texturecan_',
  'tx_', 't_', 'tex_', 'texture_', 'map_', 'mat_', 'm_', 'img_', 'chr_', 'sm_', 't_sm_'
];

export const CANONICAL_SUFFIX_MAP: Record<string, string> = {
  base_color: 'Albedo',
  normal: 'N',
  normal_directx: 'N',
  normal_opengl: 'N',
  roughness: 'R',
  glossiness: 'Gloss',
  ambient_occlusion: 'AO',
  metallic: 'M',
  height: 'H',
  orm: 'ORM',
  ormh: 'ORMH',
  rma: 'RMA',
  msra: 'MSRA',
  alpha: 'Alpha',
  opacity: 'Opacity',
  emissive: 'E',
  subsurface: 'SSS',
  specular: 'Spec',
  glass: 'Glass',
  fuzz: 'Fuzz',
  translucency: 'Trans',
  preview: 'Preview',
};

export const ORM_VARIANT_MAP: Record<string, string> = {
  ormh: 'ORMH',
  ormd: 'ORMD',
  ormdp: 'ORMDp',
  ormfuzz: 'ORMFuzz',
  ormalpha: 'ORMAlpha',
  ormtranslucency: 'ORMTranslucency',
  orm: 'ORM',
};

export const GL_TOKENS = new Set(['gl', 'opengl', 'ogl', 'normalgl', 'nor_gl', 'nrm_gl', '_nor_gl_']);
export const DX_TOKENS = new Set(['dx', 'directx', 'dx11', 'dx12', 'normaldx', 'nor_dx', 'nrm_dx', '_nor_dx_']);

export class LexicalNormalizer {
  public static stripVendorPrefix(stem: string): string {
    const lower = stem.toLowerCase();
    const sortedPrefixes = [...PREFIX_PATTERNS].sort((a, b) => b.length - a.length);
    for (const pfx of sortedPrefixes) {
      if (lower.startsWith(pfx)) {
        return stem.substring(pfx.length);
      }
    }
    return stem;
  }

  public static isResolutionToken(token: string): boolean {
    const t = token.toLowerCase();
    return RESOLUTION_PATTERNS.includes(t) || /^\d+x\d+$/i.test(t) || /^\d+k$/i.test(t);
  }

  public static stripResolution(stem: string): string {
    const parts = this.tokenize(stem);
    return parts.filter((tok) => !this.isResolutionToken(tok)).join('_');
  }

  public static tokenize(stem: string): string[] {
    return stem.split(/[_\-\s.]+/).filter(Boolean);
  }

  public static extractVariantNumber(stem: string): number | null {
    const match = stem.match(/[_-]?(\d+)$/);
    return match ? parseInt(match[1], 10) : null;
  }

  /**
   * Token normalization faithful to AutoAssignMaterial.py
   */
  public static normalizeTokens(text: string): {
    tokens: string[];
    lastToken: string;
    secondLastToken: string;
    fullLower: string;
  } {
    const rawTokens = text.toLowerCase().split(/[_\-\s.]+/).filter(Boolean);
    const nonResTokens = rawTokens.filter((t) => !this.isResolutionToken(t));
    const lastToken = nonResTokens.length > 0 ? nonResTokens[nonResTokens.length - 1] : '';
    const secondLastToken = nonResTokens.length > 1 ? nonResTokens[nonResTokens.length - 2] : '';
    const fullLower = text.toLowerCase();

    const tokenSet = new Set<string>(nonResTokens);
    // Add underscore and direct concatenated multi-tokens (e.g., base_color, basecolor, nor_dx)
    for (let i = 0; i < nonResTokens.length - 1; i++) {
      tokenSet.add(`${nonResTokens[i]}_${nonResTokens[i + 1]}`);
      tokenSet.add(`${nonResTokens[i]}${nonResTokens[i + 1]}`);
    }
    tokenSet.add(fullLower);

    return {
      tokens: Array.from(tokenSet),
      lastToken,
      secondLastToken,
      fullLower,
    };
  }

  /**
   * Score keyword coverage for a candidate role faithful to AutoAssignMaterial.py
   */
  public static scoreKeywords(
    keywords: string[],
    norm: { tokens: string[]; lastToken: string; secondLastToken: string; fullLower: string }
  ): number {
    let maxScore = 0;
    const { tokens, lastToken, secondLastToken, fullLower } = norm;

    for (const rawKw of keywords) {
      const kw = rawKw.toLowerCase();
      let kwScore = 0;

      // 1. Multi-token combination: e.g. "occlusion+roughness+metallic"
      if (kw.includes('+')) {
        const required = kw.split('+').filter(Boolean);
        const allPresent = required.every((req) => tokens.includes(req) || tokens.some((t) => t.length >= req.length && t.includes(req)));
        if (allPresent) {
          kwScore = 18.0;
        }
        continue;
      }
      // 2. Underscore boundary keywords: e.g. "_nor_", "_col", "_rgh_"
      else if (kw.startsWith('_') || kw.endsWith('_')) {
        const cleanKw = kw.replace(/^_+|_+$/g, '');
        if (fullLower.includes(kw)) {
          kwScore = 8.0;
          if (lastToken === cleanKw || secondLastToken === cleanKw) {
            kwScore += 6.0;
          }
        }
      }
      // 3. Short 1 or 2 letter token (e.g. "n", "r", "g", "b", "m", "h", "bc", "ao", "d")
      else if (kw.length <= 2) {
        // MUST match as an exact isolated token (never as substring in a word like "concrete")
        if (lastToken === kw) {
          kwScore = 12.0; // Suffix match at very end
        } else if (secondLastToken === kw) {
          kwScore = 8.0;
        } else if (tokens.includes(kw)) {
          kwScore = 4.0;
        }
      }
      // 4. Standard multi-letter keywords (e.g. "basecolor", "normal", "roughness", "albedo", "metallic")
      else {
        if (tokens.includes(kw)) {
          kwScore = 6.0 + kw.length * 0.2;
          if (lastToken === kw) {
            kwScore += 8.0; // High bonus for suffix token!
          } else if (secondLastToken === kw) {
            kwScore += 4.0;
          }
        } else if (lastToken.includes(kw)) {
          kwScore = 5.0 + kw.length * 0.15;
        } else if (secondLastToken.includes(kw)) {
          kwScore = 4.0 + kw.length * 0.1;
        } else {
          for (const t of tokens) {
            if (t.includes(kw)) {
              kwScore = 2.0 + kw.length * 0.05;
              break;
            }
          }
        }
      }

      if (kwScore > maxScore) {
        maxScore = kwScore;
      }
    }

    return maxScore;
  }

  public static detectNormalOrientation(stem: string): 'gl' | 'dx' | null {
    const s = stem.toLowerCase();
    for (const tok of GL_TOKENS) {
      if (
        new RegExp(`[._\\-\\s]${tok}(?=[._\\-\\s]|$)`, 'i').test(s) ||
        s.endsWith(`_${tok}`) ||
        s.endsWith(`-${tok}`) ||
        s.includes('normalgl') ||
        s.includes('nor_gl')
      ) {
        return 'gl';
      }
    }
    for (const tok of DX_TOKENS) {
      if (
        new RegExp(`[._\\-\\s]${tok}(?=[._\\-\\s]|$)`, 'i').test(s) ||
        s.endsWith(`_${tok}`) ||
        s.endsWith(`-${tok}`) ||
        s.includes('normaldx') ||
        s.includes('nor_dx')
      ) {
        return 'dx';
      }
    }
    return null;
  }

  public static detectMapType(stem: string): { mapType: string; suffix: string } {
    const norm = this.normalizeTokens(stem);
    const { tokens, lastToken, secondLastToken } = norm;

    // Check OpenGL vs DirectX normal tokens
    const isGL =
      GL_TOKENS.has(lastToken) ||
      GL_TOKENS.has(secondLastToken) ||
      tokens.some((t) => GL_TOKENS.has(t) || t.includes('normalgl') || t.includes('nor_gl'));
    const isDX =
      DX_TOKENS.has(lastToken) ||
      DX_TOKENS.has(secondLastToken) ||
      tokens.some((t) => DX_TOKENS.has(t) || t.includes('normaldx') || t.includes('nor_dx'));

    let bestRole = 'unknown';
    let bestScore = 0;

    // 1. Score Packed Map Definitions (ORM, ORMH, RMA, MSRA)
    for (const [pKey, pDef] of Object.entries(PACKED_MAP_DEFINITIONS)) {
      const score = this.scoreKeywords(pDef.aliases, norm);
      if (score > bestScore) {
        bestScore = score;
        bestRole = pKey;
      }
    }

    // 2. Score Single PBR Roles (BaseColor, Normal, Roughness, Metallic, AO, etc.)
    for (const [rKey, rDef] of Object.entries(PBR_ROLE_DEFINITIONS)) {
      const score = this.scoreKeywords(rDef.aliases, norm);
      if (score > bestScore) {
        bestScore = score;
        bestRole = rKey;
      }
    }

    if (bestScore <= 0 || bestRole === 'unknown') {
      return { mapType: 'unknown', suffix: '' };
    }

    // Normal map orientation specialization
    if (bestRole === 'normal' || bestRole === 'normal_opengl' || bestRole === 'normal_directx') {
      if (isGL) {
        return { mapType: 'normal_opengl', suffix: 'N' };
      }
      if (isDX) {
        return { mapType: 'normal_directx', suffix: 'N' };
      }
      return { mapType: 'normal', suffix: 'N' };
    }

    if (PACKED_MAP_DEFINITIONS[bestRole]) {
      const variantSuffix = ORM_VARIANT_MAP[bestRole.toLowerCase()] || bestRole.toUpperCase();
      return { mapType: bestRole, suffix: variantSuffix };
    }

    const suffix = CANONICAL_SUFFIX_MAP[bestRole] || bestRole.toUpperCase();
    return { mapType: bestRole, suffix };
  }

  public static cleanStem(stem: string): string {
    let s = this.stripVendorPrefix(stem);
    s = this.stripResolution(s);

    const parts = this.tokenize(s);
    const clean: string[] = [];

    // Collect all aliases to strip from stem
    const allAliases = new Set<string>();
    for (const def of Object.values(PBR_ROLE_DEFINITIONS)) {
      for (const a of def.aliases) allAliases.add(a.toLowerCase());
    }
    for (const def of Object.values(PACKED_MAP_DEFINITIONS)) {
      for (const a of def.aliases) allAliases.add(a.toLowerCase());
    }

    for (const tok of parts) {
      const tl = tok.toLowerCase();
      if (
        allAliases.has(tl) ||
        ORM_VARIANT_MAP[tl] ||
        GL_TOKENS.has(tl) ||
        DX_TOKENS.has(tl) ||
        /^\d+$/.test(tok) ||
        this.isResolutionToken(tl)
      ) {
        continue;
      }
      const stripped = tok.replace(/\d+$/, '');
      if (stripped && (GL_TOKENS.has(stripped.toLowerCase()) || DX_TOKENS.has(stripped.toLowerCase()))) {
        continue;
      }
      clean.push(tok.charAt(0).toUpperCase() + tok.slice(1));
    }

    return clean.length > 0 ? clean.join('') : (stem.charAt(0).toUpperCase() + stem.slice(1));
  }

  public static normalizeFilename(filename: string): NormalizedTextureMeta {
    const cleanFilename = filename.split('/').pop()?.split('\\').pop() || filename;
    const dotIdx = cleanFilename.lastIndexOf('.');
    const baseName = dotIdx !== -1 ? cleanFilename.substring(0, dotIdx) : cleanFilename;

    let cleanName = baseName;

    // 1. Detect resolution (including space, underscore, dash, dot delimiters, and NxN)
    let detectedRes: string | undefined;
    const nxnMatch = cleanName.match(/[._\-\s]?(\d+x\d+)(?=[._\-\s]|$)/i);
    if (nxnMatch) {
      detectedRes = nxnMatch[1].toUpperCase();
      cleanName = cleanName.replace(nxnMatch[0], '');
    } else {
      for (const res of RESOLUTION_PATTERNS) {
        const reg = new RegExp(`[._\\-\\s](${res})(?=[._\\-\\s]|$)`, 'i');
        const match = cleanName.match(reg);
        if (match) {
          detectedRes = res.toUpperCase();
          cleanName = cleanName.replace(match[0], '');
          break;
        }
      }
    }

    // 2. Detect map type & suffix
    const { mapType, suffix } = this.detectMapType(cleanName);
    const orientation = mapType.includes('normal') ? this.detectNormalOrientation(cleanName) : null;
    const requiresGreenFlip = orientation === 'gl';

    let roleLabel = 'Unknown Texture';
    let roleColor = 'var(--pbr-scalar)';
    let colorSpace: 'sRGB' | 'Linear' = 'Linear';
    let autoInvert = false;
    let isPacked = false;
    let channels: PBRChannelMapping = { r: 'Red', g: 'Green', b: 'Blue', a: 'Alpha' };

    if (PACKED_MAP_DEFINITIONS[mapType]) {
      const pDef = PACKED_MAP_DEFINITIONS[mapType];
      roleLabel = pDef.label;
      roleColor = 'var(--pbr-packed)';
      isPacked = true;
      channels = pDef.slots;
      colorSpace = 'Linear';
    } else if (PBR_ROLE_DEFINITIONS[mapType]) {
      const rDef = PBR_ROLE_DEFINITIONS[mapType];
      roleLabel = rDef.label;
      roleColor = rDef.color;
      colorSpace = rDef.colorSpace;
      autoInvert = !!rDef.autoInvert;
      if (mapType === 'base_color' || mapType === 'emissive' || mapType === 'preview') {
        channels = { r: 'Red', g: 'Green', b: 'Blue', a: 'Alpha / Opacity' };
      } else if (mapType.startsWith('normal')) {
        channels = { r: 'X (Tangent)', g: 'Y (Binormal)', b: 'Z (Normal)', a: '1.0' };
      } else {
        channels = { r: roleLabel, g: roleLabel, b: roleLabel, a: '1.0' };
      }
    }

    const assetName = this.cleanStem(cleanName);

    return {
      originalName: cleanFilename,
      assetName,
      detectedRole: mapType,
      roleLabel: suffix ? (roleLabel.endsWith(`(${suffix})`) ? roleLabel : `${roleLabel} (${suffix})`) : roleLabel,
      roleColor,
      colorSpace,
      autoInvert,
      requiresGreenFlip,
      resolution: detectedRes,
      isPacked,
      channels,
    };
  }

  /**
   * Group scanned files into cohesive Texture Sets and apply TextureLAB cleanup rules.
   */
  public static processTextureBatch(
    files: { name: string; path?: string; mtime?: number; buffer?: unknown; dataUrl?: string }[],
    options: { cleanup?: boolean; flipGreenOnGL?: boolean } = { cleanup: true, flipGreenOnGL: true }
  ): {
    items: TextureBatchItem[];
    sets: Record<string, TextureBatchItem[]>;
  } {
    const rawEntries = files.map((f, idx) => {
      const dot = f.name.lastIndexOf('.');
      const stem = dot !== -1 ? f.name.substring(0, dot) : f.name;
      const ext = dot !== -1 ? f.name.substring(dot) : '';
      const { mapType, suffix } = this.detectMapType(stem);
      const orientation = mapType.includes('normal') ? this.detectNormalOrientation(stem) : null;
      const cleanStem = this.cleanStem(stem);
      const variantNum = this.extractVariantNumber(stem);
      const newName = suffix ? `TX_${cleanStem}_${suffix}${ext}` : f.name;

      return {
        id: `tex_${idx}_${Date.now()}`,
        originalName: f.name,
        originalPath: f.path || f.name,
        newName,
        cleanStem,
        mapType,
        suffix,
        ext,
        orientation,
        variantNum,
        action: 'keep_rename' as 'keep_rename' | 'flip_gl' | 'delete_gl' | 'delete_variant' | 'delete_type_dup' | 'delete_dupe',
        status: 'READY',
        mtime: f.mtime || Date.now(),
        buffer: f.buffer,
        dataUrl: f.dataUrl,
      };
    });

    if (!options.cleanup) {
      return {
        items: rawEntries,
        sets: this.groupEntriesIntoSets(rawEntries),
      };
    }

    // Rule 1: Normal GL/DX rules
    // Group normals by cleanStem
    const normalGroups: Record<string, typeof rawEntries> = {};
    const otherEntries: typeof rawEntries = [];

    for (const e of rawEntries) {
      if (e.mapType.includes('normal')) {
        normalGroups[e.cleanStem] = normalGroups[e.cleanStem] || [];
        normalGroups[e.cleanStem].push(e);
      } else {
        otherEntries.push(e);
      }
    }

    const processedNormals: typeof rawEntries = [];
    for (const group of Object.values(normalGroups)) {
      const gl = group.filter((e) => e.orientation === 'gl');
      const dx = group.filter((e) => e.orientation === 'dx');
      const unknown = group.filter((e) => !e.orientation);

      if (gl.length > 0 && dx.length > 0) {
        // Both GL and DX exist: keep DX, mark GL as duplicate
        for (const g of gl) {
          g.action = 'delete_gl';
          g.status = 'SKIPPED (GL duplicate of DX)';
        }
        for (const d of dx) {
          d.action = 'keep_rename';
        }
        processedNormals.push(...gl, ...dx, ...unknown);
      } else if (gl.length > 0 && dx.length === 0) {
        // GL only: convert GL -> DX by flipping green channel
        for (const g of gl) {
          g.action = options.flipGreenOnGL ? 'flip_gl' : 'keep_rename';
          g.status = options.flipGreenOnGL ? 'CONVERT GL->DX' : 'KEEP';
        }
        processedNormals.push(...gl, ...unknown);
      } else {
        processedNormals.push(...group);
      }
    }

    const combined = [...otherEntries, ...processedNormals];

    // Rule 2: Numbered variant dedup (keep lowest variant)
    const variantGroups: Record<string, typeof rawEntries> = {};
    const unversioned: typeof rawEntries = [];

    for (const e of combined) {
      if (e.action === 'delete_gl') continue;
      if (e.variantNum !== null) {
        const key = `${e.cleanStem}_${e.mapType}`;
        variantGroups[key] = variantGroups[key] || [];
        variantGroups[key].push(e);
      } else {
        unversioned.push(e);
      }
    }

    for (const group of Object.values(variantGroups)) {
      if (group.length <= 1) {
        unversioned.push(...group);
        continue;
      }
      group.sort((a, b) => (a.variantNum || 0) - (b.variantNum || 0));
      unversioned.push(group[0]); // lowest variant kept
      for (let i = 1; i < group.length; i++) {
        group[i].action = 'delete_variant';
        group[i].status = `SKIPPED (Variant #${group[i].variantNum})`;
        unversioned.push(group[i]);
      }
    }

    // Rule 3: Single type per set (keep newest by mtime)
    const setGroups: Record<string, typeof rawEntries> = {};
    for (const e of unversioned) {
      if (e.action.startsWith('delete_')) continue;
      if (e.mapType === 'unknown') continue;
      const key = `${e.cleanStem}_${e.mapType}`;
      setGroups[key] = setGroups[key] || [];
      setGroups[key].push(e);
    }

    for (const group of Object.values(setGroups)) {
      if (group.length > 1) {
        group.sort((a, b) => b.mtime - a.mtime);
        for (let i = 1; i < group.length; i++) {
          group[i].action = 'delete_type_dup';
          group[i].status = 'SKIPPED (Duplicate map type)';
        }
      }
    }

    return {
      items: rawEntries,
      sets: this.groupEntriesIntoSets(rawEntries.filter((i) => !i.action.startsWith('delete_'))),
    };
  }

  private static groupEntriesIntoSets(entries: TextureBatchItem[]): Record<string, TextureBatchItem[]> {
    const sets: Record<string, TextureBatchItem[]> = {};
    for (const e of entries) {
      const setName = e.cleanStem || 'DefaultSet';
      sets[setName] = sets[setName] || [];
      sets[setName].push(e);
    }
    return sets;
  }
}

