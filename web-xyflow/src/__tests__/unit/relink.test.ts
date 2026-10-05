import { describe, it, expect } from 'vitest';
import { resolveAsset, auditProjectAssets, autoRelinkFromFolder } from '../../engine/assetRelink';
import type { AssetRecord } from '../../types/project';

describe('Asset Relinking & Resolution (P3-T9: TC-345..348)', () => {
  it('TC-345: Moving project folder to another path/drive resolves assets via relative path first', () => {
    const asset: AssetRecord = {
      id: 'a1',
      name: 'concrete_ao.png',
      rel: 'maps/concrete_ao.png',
      abs: 'D:/OldDrive/OldProject/maps/concrete_ao.png', // Old drive path no longer exists
      bytes: 1024,
    };

    // Simulate moved project folder on G:/NewDrive/
    const newProjectDir = 'G:/NewDrive/MyProject';

    // File system mock where only the new relative path exists
    const mockFiles = new Set(['G:/NewDrive/MyProject/maps/concrete_ao.png']);
    const fileExists = (p: string) => mockFiles.has(p);

    const res = resolveAsset(asset, newProjectDir, fileExists);

    expect(res.isMissing).toBe(false);
    expect(res.resolvedVia).toBe('relative');
    expect(res.resolvedPath).toBe('G:/NewDrive/MyProject/maps/concrete_ao.png');
  });

  it('TC-346: When an asset file is deleted, it is flagged as missing and audit lists it', () => {
    const assets: AssetRecord[] = [
      { id: 'a1', name: 'valid.png', rel: 'valid.png', abs: 'C:/tex/valid.png', bytes: 100 },
      { id: 'a2', name: 'deleted.png', rel: 'deleted.png', abs: 'C:/tex/deleted.png', bytes: 200 },
    ];

    const mockFiles = new Set(['C:/tex/valid.png']);
    const fileExists = (p: string) => mockFiles.has(p);

    const audit = auditProjectAssets(assets, 'C:/tex', fileExists);

    expect(audit.allResolved).toBe(false);
    expect(audit.missing.length).toBe(1);
    expect(audit.missing[0].id).toBe('a2');
    expect(audit.resolutions[0].isMissing).toBe(false);
    expect(audit.resolutions[1].isMissing).toBe(true);
  });

  it('autoRelinkFromFolder matches missing files by name in a selected search folder', () => {
    const missing: AssetRecord[] = [
      { id: 'a1', name: 'cobble_rough.png', rel: 'maps/cobble_rough.png', abs: 'E:/old/cobble_rough.png', bytes: 500 },
      { id: 'a2', name: 'not_found.png', rel: 'not_found.png', abs: 'E:/old/not_found.png', bytes: 100 },
    ];

    const candidateFiles = [
      'C:/NewDownloads/Cobblestone/cobble_rough.png',
      'C:/NewDownloads/Cobblestone/cobble_normal.png',
    ];

    const { relinked, stillMissing } = autoRelinkFromFolder(missing, candidateFiles, 'C:/NewDownloads');

    expect(relinked.length).toBe(1);
    expect(relinked[0].id).toBe('a1');
    expect(relinked[0].abs).toBe('C:/NewDownloads/Cobblestone/cobble_rough.png');
    expect(stillMissing.length).toBe(1);
    expect(stillMissing[0].id).toBe('a2');
  });
});
