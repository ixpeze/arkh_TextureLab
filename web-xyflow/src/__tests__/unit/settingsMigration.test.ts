import { describe, it, expect } from 'vitest';
import { migrateSettingsFromLocalStorage } from '../../platform/settingsMigration';

describe('Settings Migration (P3-T11: TC-360)', () => {
  it('TC-360: Migrates export presets from localStorage into settings.json once and preserves presets', async () => {
    const memorySettings: Record<string, unknown> = {};
    const getUserData = async (key: string) => memorySettings[key];
    const setUserData = async (key: string, val: unknown) => {
      memorySettings[key] = val;
    };

    const mockPresets = [
      { id: 'ue5_orm', name: 'Unreal Engine 5 ORM', pattern: 'T_{asset}_ORM' },
      { id: 'unity_mask', name: 'Unity HDRP Mask', pattern: 'T_{asset}_Mask' },
    ];

    const mockStorage = {
      getItem: (k: string) => (k === 'texturelab_export_presets' ? JSON.stringify(mockPresets) : null),
    };

    // First run -> migrates 2 presets
    const res1 = await migrateSettingsFromLocalStorage(getUserData, setUserData, mockStorage);
    expect(res1.migrated).toBe(true);
    expect(res1.presetCount).toBe(2);
    expect(memorySettings['exportPresets']).toEqual(mockPresets);

    // Second run -> already migrated, no overwrite
    const res2 = await migrateSettingsFromLocalStorage(getUserData, setUserData, mockStorage);
    expect(res2.migrated).toBe(false);
    expect(res2.presetCount).toBe(2);
  });
});
