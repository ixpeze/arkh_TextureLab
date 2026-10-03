/**
 * Token Template Engine for PBR Texture Naming & Export
 */

export type CasingType = 'original' | 'UPPER_SNAKE' | 'snake_case' | 'camelCase' | 'PascalCase';

export interface TokenContext {
  prefix?: string;
  asset?: string;
  slot?: string;
  res?: string;
  ext?: string;
  [key: string]: string | undefined;
}

export class TokenEngine {
  public static readonly DEFAULT_PATTERN = '{prefix}_{asset}_{slot}_{res}.{ext}';

  public static evaluate(
    pattern: string,
    context: TokenContext,
    casing: CasingType = 'original'
  ): string {
    let result = pattern;

    for (const [key, val] of Object.entries(context)) {
      const token = `{${key}}`;
      result = result.split(token).join(val || '');
    }

    // Clean multiple underscores, dashes or adjacent separators
    result = result.replace(/_+/g, '_').replace(/-+/g, '-');
    result = result.replace(/_\./g, '.').replace(/-\./g, '.');

    // Apply casing
    switch (casing) {
      case 'UPPER_SNAKE': {
        // Split camel/pascal transitions while keeping resolution intact (e.g. 4K, 2K)
        const s = result
          .replace(/(.)([A-Z][a-z]+)/g, '$1_$2')
          .replace(/([a-z])([A-Z])/g, '$1_$2')
          .replace(/_+/g, '_');
        return s.toUpperCase();
      }
      case 'snake_case': {
        const s = result
          .replace(/(.)([A-Z][a-z]+)/g, '$1_$2')
          .replace(/([a-z])([A-Z])/g, '$1_$2')
          .replace(/_+/g, '_');
        return s.toLowerCase().replace(/-/g, '_');
      }
      case 'PascalCase': {
        const parts = result.split(/([_.-])/);
        return parts
          .map((p) => (['_', '.', '-'].includes(p) ? p : p.charAt(0).toUpperCase() + p.slice(1).toLowerCase()))
          .join('');
      }
      case 'camelCase': {
        const parts = result.split(/([_.-])/).filter(Boolean);
        if (parts.length === 0) return result;
        const first = parts[0].toLowerCase();
        const rest = parts
          .slice(1)
          .map((p) => (['_', '.', '-'].includes(p) ? p : p.charAt(0).toUpperCase() + p.slice(1).toLowerCase()))
          .join('');
        return first + rest;
      }
      default:
        return result;
    }
  }
}
