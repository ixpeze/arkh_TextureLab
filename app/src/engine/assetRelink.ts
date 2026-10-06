import type { AssetRecord } from '../types/project';
import { normalizePath, getRelativePath } from './assetManager';

export interface AssetResolutionResult {
  asset: AssetRecord;
  resolvedPath: string | null;
  isMissing: boolean;
  resolvedVia: 'relative' | 'absolute' | 'none';
}

export function resolveAsset(
  asset: AssetRecord,
  projectDir: string | undefined,
  fileExists: (path: string) => boolean
): AssetResolutionResult {
  // 1. Try resolving relative to project folder
  if (projectDir && asset.rel) {
    const relCombined = normalizePath(`${projectDir}/${asset.rel}`);
    if (fileExists(relCombined)) {
      return {
        asset,
        resolvedPath: relCombined,
        isMissing: false,
        resolvedVia: 'relative',
      };
    }
  }

  // 2. Try resolving absolute path
  if (asset.abs) {
    const normAbs = normalizePath(asset.abs);
    if (fileExists(normAbs)) {
      return {
        asset,
        resolvedPath: normAbs,
        isMissing: false,
        resolvedVia: 'absolute',
      };
    }
  }

  // 3. Asset missing
  return {
    asset,
    resolvedPath: null,
    isMissing: true,
    resolvedVia: 'none',
  };
}

export function auditProjectAssets(
  assets: AssetRecord[],
  projectDir: string | undefined,
  fileExists: (path: string) => boolean
): {
  resolutions: AssetResolutionResult[];
  missing: AssetRecord[];
  allResolved: boolean;
} {
  const resolutions: AssetResolutionResult[] = [];
  const missing: AssetRecord[] = [];

  for (const asset of assets) {
    const res = resolveAsset(asset, projectDir, fileExists);
    resolutions.push(res);
    if (res.isMissing) {
      missing.push(asset);
    }
  }

  return {
    resolutions,
    missing,
    allResolved: missing.length === 0,
  };
}

export function autoRelinkFromFolder(
  missingAssets: AssetRecord[],
  folderFiles: string[],
  projectDir?: string
): { relinked: AssetRecord[]; stillMissing: AssetRecord[] } {
  const fileMap = new Map<string, string>();
  for (const filePath of folderFiles) {
    const norm = normalizePath(filePath);
    const parts = norm.split('/');
    const name = parts[parts.length - 1]?.toLowerCase();
    if (name) {
      fileMap.set(name, norm);
    }
  }

  const relinked: AssetRecord[] = [];
  const stillMissing: AssetRecord[] = [];

  for (const asset of missingAssets) {
    const assetName = asset.name.toLowerCase();
    const candidatePath = fileMap.get(assetName);
    if (candidatePath) {
      const rel = projectDir ? getRelativePath(projectDir, candidatePath) : asset.name;
      relinked.push({
        ...asset,
        abs: candidatePath,
        rel,
        mtimeMs: Date.now(),
      });
    } else {
      stillMissing.push(asset);
    }
  }

  return { relinked, stillMissing };
}
