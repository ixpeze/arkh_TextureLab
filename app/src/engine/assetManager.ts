import type { AssetRecord } from '../types/project';

/**
 * Computes a fast deterministic hash of the first 64 KB of a buffer + total size.
 * Uses a 32-bit FNV-1a hash variant converted to hex for speed and zero dependencies.
 */
export function computeFastHash(buffer: Uint8Array, totalSize: number): string {
  const sampleLen = Math.min(buffer.length, 65536);
  let h1 = 0x811c9dc5;
  for (let i = 0; i < sampleLen; i++) {
    h1 ^= buffer[i];
    h1 = Math.imul(h1, 0x01000193);
  }
  const sizeHash = (totalSize >>> 0).toString(16);
  const sampleHash = (h1 >>> 0).toString(16);
  return `${sizeHash}_${sampleHash}`;
}

export interface FileInput {
  name: string;
  size: number;
  path?: string;
  data?: Uint8Array;
  mtimeMs?: number;
}

export function normalizePath(p: string): string {
  return p.replace(/\\/g, '/');
}

export function getRelativePath(fromDir: string, toFile: string): string {
  const normalizedFrom = normalizePath(fromDir).replace(/\/+$/, '');
  const normalizedTo = normalizePath(toFile);

  if (normalizedTo.startsWith(normalizedFrom + '/')) {
    return normalizedTo.slice(normalizedFrom.length + 1);
  }
  return normalizedTo;
}

export function findExistingAsset(
  assets: AssetRecord[],
  file: FileInput,
  fingerprint?: string
): AssetRecord | undefined {
  const normPath = file.path ? normalizePath(file.path) : undefined;

  for (const asset of assets) {
    // 1. Exact absolute path match
    if (normPath && normalizePath(asset.abs) === normPath) {
      return asset;
    }
    // 2. Hash match
    if (fingerprint && asset.sha1 && asset.sha1 === fingerprint) {
      return asset;
    }
    // 3. Name and size match
    if (asset.name === file.name && asset.bytes === file.size && file.size > 0) {
      return asset;
    }
  }
  return undefined;
}

export function registerOrGetAsset(
  assets: AssetRecord[],
  file: FileInput,
  projectDir?: string
): { asset: AssetRecord; isNew: boolean; updatedAssets: AssetRecord[] } {
  let fingerprint: string | undefined;
  if (file.data) {
    fingerprint = computeFastHash(file.data, file.size);
  }

  const existing = findExistingAsset(assets, file, fingerprint);
  if (existing) {
    return { asset: existing, isNew: false, updatedAssets: assets };
  }

  const id = `asset_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const absPath = file.path ? normalizePath(file.path) : file.name;
  const relPath = projectDir ? getRelativePath(projectDir, absPath) : file.name;

  const newAsset: AssetRecord = {
    id,
    name: file.name,
    rel: relPath,
    abs: absPath,
    bytes: file.size,
    mtimeMs: file.mtimeMs || Date.now(),
    sha1: fingerprint,
  };

  return {
    asset: newAsset,
    isNew: true,
    updatedAssets: [...assets, newAsset],
  };
}

export function relinkAsset(
  assets: AssetRecord[],
  assetId: string,
  newPath: string,
  projectDir?: string,
  newSize?: number
): AssetRecord[] {
  const normNewPath = normalizePath(newPath);
  const parts = normNewPath.split('/');
  const name = parts[parts.length - 1] || normNewPath;
  const rel = projectDir ? getRelativePath(projectDir, normNewPath) : name;

  return assets.map((a) => {
    if (a.id === assetId) {
      return {
        ...a,
        name,
        abs: normNewPath,
        rel,
        bytes: newSize !== undefined ? newSize : a.bytes,
        mtimeMs: Date.now(),
      };
    }
    return a;
  });
}
