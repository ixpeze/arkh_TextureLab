/**
 * PBR Texture Lexical Normalizer & Dictionary Engine
 * Detects roles, channel configurations, resolutions, and asset stems from filenames.
 */

import {
  PBR_ROLE_DEFINITIONS,
  PACKED_MAP_DEFINITIONS,
  RESOLUTION_PATTERNS,
  PREFIX_PATTERNS,
  CANONICAL_SUFFIX_MAP,
  ORM_VARIANT_MAP,
  GL_TOKENS,
  DX_TOKENS,
  type PBRChannelMapping,
  type NormalizedTextureMeta,
  type TextureBatchItem,
} from './normalizerDicts';
import { processTextureBatch, groupEntriesIntoSets } from './normalizerBatch';

// Re-export dicts and types for backwards compatibility
export {
  PBR_ROLE_DEFINITIONS,
  PACKED_MAP_DEFINITIONS,
  RESOLUTION_PATTERNS,
  PREFIX_PATTERNS,
  CANONICAL_SUFFIX_MAP,
  ORM_VARIANT_MAP,
  GL_TOKENS,
  DX_TOKENS,
  type PBRChannelMapping,
  type NormalizedTextureMeta,
  type TextureBatchItem,
} from './normalizerDicts';

export { processTextureBatch, groupEntriesIntoSets } from './normalizerBatch';

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

  public static processTextureBatch(
    files: { name: string; path?: string; mtime?: number; buffer?: unknown; dataUrl?: string }[],
    options: { cleanup?: boolean; flipGreenOnGL?: boolean } = { cleanup: true, flipGreenOnGL: true }
  ): {
    items: TextureBatchItem[];
    sets: Record<string, TextureBatchItem[]>;
  } {
    return processTextureBatch(files, options);
  }

  public static groupEntriesIntoSets(entries: TextureBatchItem[]): Record<string, TextureBatchItem[]> {
    return groupEntriesIntoSets(entries);
  }
}
