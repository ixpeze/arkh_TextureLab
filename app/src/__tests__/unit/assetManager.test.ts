import { describe, it, expect } from 'vitest';
import { registerOrGetAsset, computeFastHash } from '../../engine/assetManager';
import type { AssetRecord } from '../../types/project';

describe('Asset Registry & Deduplication (P3-T4: TC-310)', () => {
  it('TC-310: Importing the same file in 2 nodes creates 1 asset and reuses it', () => {
    let assets: AssetRecord[] = [];
    const sampleBuffer = new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8]);

    // Node 1 imports concrete.png
    const file1 = {
      name: 'concrete_albedo.png',
      size: 1024,
      path: 'C:/Textures/concrete_albedo.png',
      data: sampleBuffer,
    };
    const res1 = registerOrGetAsset(assets, file1);
    expect(res1.isNew).toBe(true);
    assets = res1.updatedAssets;
    expect(assets.length).toBe(1);

    // Node 2 imports identical concrete.png
    const file2 = {
      name: 'concrete_albedo.png',
      size: 1024,
      path: 'C:/Textures/concrete_albedo.png',
      data: sampleBuffer,
    };
    const res2 = registerOrGetAsset(assets, file2);
    expect(res2.isNew).toBe(false);
    expect(res2.asset.id).toBe(res1.asset.id);
    expect(res2.updatedAssets.length).toBe(1);

    // Node 3 imports different file
    const file3 = {
      name: 'concrete_rough.png',
      size: 2048,
      path: 'C:/Textures/concrete_rough.png',
    };
    const res3 = registerOrGetAsset(res2.updatedAssets, file3);
    expect(res3.isNew).toBe(true);
    expect(res3.updatedAssets.length).toBe(2);
    expect(res3.asset.id).not.toBe(res1.asset.id);
  });

  it('computes fast deterministic hash from buffer', () => {
    const buf = new Uint8Array([10, 20, 30, 40]);
    const hash1 = computeFastHash(buf, 100);
    const hash2 = computeFastHash(buf, 100);
    expect(hash1).toBe(hash2);
    expect(hash1).toMatch(/^[0-9a-f]+_[0-9a-f]+$/);
  });
});
