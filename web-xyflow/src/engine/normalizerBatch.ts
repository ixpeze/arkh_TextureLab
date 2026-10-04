import type { TextureBatchItem } from './normalizerDicts';
import { LexicalNormalizer } from './normalizer';

export function groupEntriesIntoSets(entries: TextureBatchItem[]): Record<string, TextureBatchItem[]> {
  const sets: Record<string, TextureBatchItem[]> = {};
  for (const e of entries) {
    const setName = e.cleanStem || 'DefaultSet';
    sets[setName] = sets[setName] || [];
    sets[setName].push(e);
  }
  return sets;
}

/**
 * Group scanned files into cohesive Texture Sets and apply TextureLAB cleanup rules.
 */
export function processTextureBatch(
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
    const { mapType, suffix } = LexicalNormalizer.detectMapType(stem);
    const orientation = mapType.includes('normal') ? LexicalNormalizer.detectNormalOrientation(stem) : null;
    const cleanStem = LexicalNormalizer.cleanStem(stem);
    const variantNum = LexicalNormalizer.extractVariantNumber(stem);
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
      sets: groupEntriesIntoSets(rawEntries),
    };
  }

  // Rule 1: Normal GL/DX rules
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
    sets: groupEntriesIntoSets(rawEntries.filter((i) => !i.action.startsWith('delete_'))),
  };
}
