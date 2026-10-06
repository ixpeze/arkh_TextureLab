import { describe, it, expect } from 'vitest';
import { nodeRegistry, defineNode, type NodeCategory } from '../../nodes/registry';

describe('Node Registry (TC-140..142)', () => {
  it('TC-140: every registered type has defaults, ports, label, category, and cpuRef or gpu spec', () => {
    const allDefs = nodeRegistry.getAll();
    expect(allDefs.length).toBeGreaterThanOrEqual(1);

    const validCategories: NodeCategory[] = [
      'Input',
      'Channel',
      'Math',
      'Adjust',
      'Blend',
      'Output',
      'Utility',
      'Labs',
    ];

    for (const def of allDefs) {
      expect(typeof def.type).toBe('string');
      expect(def.type.length).toBeGreaterThan(0);
      expect(typeof def.label).toBe('string');
      expect(validCategories).toContain(def.category);
      expect(Array.isArray(def.inputs)).toBe(true);
      expect(Array.isArray(def.outputs)).toBe(true);
      expect(typeof def.defaults).toBe('object');
      expect(def.defaults).not.toBeNull();
      const hasExecutableSpec = typeof def.cpuRef === 'function' || !!def.gpu;
      expect(hasExecutableSpec).toBe(true);
    }
  });

  it('TC-141: legacy aliases resolve to canonical definitions', () => {
    // We check aliases for any registered definitions that have legacyAliases
    const allDefs = nodeRegistry.getAll();
    for (const def of allDefs) {
      if (def.legacyAliases) {
        for (const alias of def.legacyAliases) {
          const resolved = nodeRegistry.get(alias);
          expect(resolved).toBeDefined();
          expect(resolved?.type).toBe(def.type);
          expect(nodeRegistry.resolveCanonicalType(alias)).toBe(def.type);
        }
      }
    }
  });

  it('TC-142: no duplicate hotkeys exist across all registered nodes', () => {
    const hotkeysSeen = new Map<string, string>();
    const allDefs = nodeRegistry.getAll();
    for (const def of allDefs) {
      if (def.hotkey) {
        const hk = def.hotkey.toLowerCase();
        expect(hotkeysSeen.has(hk)).toBe(false);
        hotkeysSeen.set(hk, def.type);
      }
    }
  });

  it('dynamic node definition registration and teardown', () => {
    const dummy = defineNode({
      type: '_temp_dummy',
      label: 'Temp Dummy',
      category: 'Labs',
      inputs: [],
      outputs: [],
      params: {},
      defaults: {},
      cpuRef: () => null,
    });

    nodeRegistry.register(dummy);
    expect(nodeRegistry.get('_temp_dummy')).toBeDefined();
    expect(nodeRegistry.has('_temp_dummy')).toBe(true);

    nodeRegistry.unregister('_temp_dummy');
    expect(nodeRegistry.get('_temp_dummy')).toBeUndefined();
    expect(nodeRegistry.has('_temp_dummy')).toBe(false);
  });
});
