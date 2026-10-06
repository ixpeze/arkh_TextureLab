export interface ExportPresetMigrationResult {
  migrated: boolean;
  presetCount: number;
}

export async function migrateSettingsFromLocalStorage(
  getUserData: (key: string) => Promise<unknown>,
  setUserData: (key: string, value: unknown) => Promise<void>,
  storage: { getItem: (k: string) => string | null } = typeof localStorage !== 'undefined'
    ? localStorage
    : { getItem: () => null }
): Promise<ExportPresetMigrationResult> {
  // Check if settings already has exportPresets
  const existing = await getUserData('exportPresets');
  if (Array.isArray(existing) && existing.length > 0) {
    return { migrated: false, presetCount: existing.length };
  }

  // Check legacy localStorage
  const legacyData = storage.getItem('texturelab_export_presets');
  if (!legacyData) {
    return { migrated: false, presetCount: 0 };
  }

  try {
    const parsed = JSON.parse(legacyData);
    if (Array.isArray(parsed) && parsed.length > 0) {
      await setUserData('exportPresets', parsed);
      return { migrated: true, presetCount: parsed.length };
    }
  } catch (err) {
    console.warn('Could not parse legacy export presets from localStorage:', err);
  }

  return { migrated: false, presetCount: 0 };
}
