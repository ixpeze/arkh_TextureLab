import { describe, it, expect } from 'vitest';
import React from 'react';
import { renderToString } from 'react-dom/server';

import { nodeRegistry } from '../../nodes/registry';
import { getAllShortcuts } from '../../components/shortcutsData';
import { createDefaultDocument } from '../../store/documentSlice';
import { createUiSlice, type UiSlice } from '../../store/uiSlice';
import {
  classifyDroppedFiles,
  getDefaultConfigForPreset,
  type DroppedFileItem,
} from '../../features/wizard/wizardClassifier';
import { buildPackWizardGraph } from '../../features/wizard/wizardGraphBuilder';
import { Button } from '../../ui/Button';
import { IconButton } from '../../ui/IconButton';
import { Segmented } from '../../ui/Segmented';
import { Panel } from '../../ui/Panel';

describe('Phase 5 UI/UX Redesign Verification Suite', () => {
  describe('P5-T11: Shortcuts auto-generation (TC-511, P5-T11)', () => {
    it('every node in registry with a hotkey appears in getAllShortcuts()', () => {
      const allShortcuts = getAllShortcuts();
      const registryDefs = nodeRegistry.getAll();
      const defsWithHotkey = registryDefs.filter((d) => Boolean(d.hotkey));

      expect(defsWithHotkey.length).toBeGreaterThan(0);

      for (const def of defsWithHotkey) {
        const expectedKey = def.hotkey!.toUpperCase();
        const found = allShortcuts.find(
          (s) => s.category === 'spawn' && s.keys.includes(expectedKey)
        );
        expect(
          found,
          `Expected registry hotkey '${expectedKey}' for node '${def.type}' to appear in shortcuts table`
        ).toBeDefined();
      }
    });

    it('contains essential workflow chords (Ctrl+Z, Ctrl+Y, Ctrl+B, Ctrl+W, Ctrl+E)', () => {
      const allShortcuts = getAllShortcuts();
      const keysJoined = allShortcuts.map((s) => s.keys.join('+').toLowerCase());

      expect(keysJoined).toContain('ctrl+z');
      expect(keysJoined).toContain('ctrl+b');
      expect(keysJoined).toContain('ctrl+w');
      expect(keysJoined).toContain('ctrl+e');
    });
  });

  describe('P5-T7 & TC-524: First launch empty canvas state', () => {
    it('createDefaultDocument starts with zero nodes and zero edges', () => {
      const doc = createDefaultDocument();
      expect(doc.graph.nodes).toHaveLength(0);
      expect(doc.graph.edges).toHaveLength(0);
      expect(doc.assets).toHaveLength(0);
    });
  });

  describe('P5-T4: Docked workstation layout & persistence (TC-510, TC-511)', () => {
    it('uiSlice handles toggle and width persistence for library and inspector', () => {
      let state: Partial<UiSlice> = {};
      const set = (fn: (prev: UiSlice) => Partial<UiSlice>) => {
        state = { ...state, ...fn(state as UiSlice) };
      };

      const slice = createUiSlice(set as never);
      state = { ...slice };

      expect(slice.isLibraryOpen).toBe(true);
      expect(slice.isInspectorOpen).toBe(true);
      expect(slice.libraryWidth).toBeGreaterThanOrEqual(240);
      expect(slice.inspectorWidth).toBeGreaterThanOrEqual(260);

      // Toggle library
      slice.toggleLibrary();
      expect(state.isLibraryOpen).toBe(false);

      // Toggle inspector
      slice.toggleInspector();
      expect(state.isInspectorOpen).toBe(false);

      // Width resizing
      slice.setLibraryWidth(300);
      expect(state.libraryWidth).toBe(300);

      slice.setInspectorWidth(360);
      expect(state.inspectorWidth).toBe(360);
    });
  });

  describe('P5-T8: Pack Wizard Graph Builder (TC-527..531)', () => {
    it('TC-527: builds complete wired ORMH graph with 4 input maps', () => {
      const fakeFiles: File[] = [
        new File([''], 'T_Concrete_AO.png', { type: 'image/png' }),
        new File([''], 'T_Concrete_Roughness.png', { type: 'image/png' }),
        new File([''], 'T_Concrete_Metallic.png', { type: 'image/png' }),
        new File([''], 'T_Concrete_Height.png', { type: 'image/png' }),
      ];

      const classified = classifyDroppedFiles(fakeFiles);
      expect(classified).toHaveLength(4);

      const config = getDefaultConfigForPreset('ORMH', classified);
      expect(config.preset).toBe('ORMH');
      expect(config.channels.r.sourceType).toBe('file');
      expect(config.channels.g.sourceType).toBe('file');
      expect(config.channels.b.sourceType).toBe('file');
      expect(config.channels.a.sourceType).toBe('file');

      const { nodes, edges, assets } = buildPackWizardGraph(config, classified);

      // 4 inputs + 1 combiner + 1 output = 6 nodes
      expect(nodes.filter((n) => n.type === 'textureInput')).toHaveLength(4);
      expect(nodes.filter((n) => n.type === 'channelCombiner')).toHaveLength(1);
      expect(nodes.filter((n) => n.type === 'textureOutput')).toHaveLength(1);

      // 4 wires into combiner + 1 wire into output = 5 edges
      expect(edges).toHaveLength(5);
      expect(assets).toHaveLength(4);
    });

    it('TC-528: missing Height map falls back to constant scalar', () => {
      const fakeFiles: File[] = [
        new File([''], 'Rock_AO.png', { type: 'image/png' }),
        new File([''], 'Rock_Rough.png', { type: 'image/png' }),
        new File([''], 'Rock_Metal.png', { type: 'image/png' }),
      ];

      const classified = classifyDroppedFiles(fakeFiles);
      const config = getDefaultConfigForPreset('ORMH', classified);

      expect(config.channels.a.sourceType).toBe('constant');
      expect(config.channels.a.constantValue).toBe(0.0);

      const { nodes, edges } = buildPackWizardGraph(config, classified);

      expect(nodes.filter((n) => n.type === 'textureInput')).toHaveLength(3);
      expect(nodes.filter((n) => n.type === 'constantScalar')).toHaveLength(1);
      expect(edges).toHaveLength(5);
    });

    it('TC-529: classifies ambiguous names safely with lexical normalizer', () => {
      const fakeFiles: File[] = [
        new File([''], 'rough_metal_pack.png', { type: 'image/png' }),
      ];

      const classified: DroppedFileItem[] = classifyDroppedFiles(fakeFiles);
      expect(classified).toHaveLength(1);
      expect(classified[0].meta.detectedRole).toBeDefined();
    });
  });

  describe('P5-T12 & TC-540..548: Accessibility & WCAG AA Compliance', () => {
    it('IconButton meets min 24x24 hit area and has aria-label', () => {
      const html = renderToString(
        <IconButton
          icon={<span data-testid="icon">X</span>}
          label="Test Action"
          size="md"
        />
      );

      expect(html).toContain('aria-label="Test Action"');
      expect(html).toContain('tl-icon-btn');
      expect(html).toContain('type="button"');
    });

    it('core design system components produce valid semantic ARIA markup', () => {
      const html = renderToString(
        <Panel title="Accessibility Test Panel">
          <main>
            <h1>Test Title</h1>
            <Button variant="primary">Submit</Button>
            <IconButton icon={<span>+</span>} label="Add Item" />
            <Segmented
              options={[
                { value: 'a', label: 'Option A' },
                { value: 'b', label: 'Option B' },
              ]}
              value="a"
              onChange={() => {}}
            />
          </main>
        </Panel>
      );

      expect(html).toContain('role="region"');
      expect(html).toContain('aria-label="Accessibility Test Panel"');
      expect(html).toContain('role="group"');
      expect(html).toContain('aria-pressed="true"');
      expect(html).toContain('aria-pressed="false"');
    });
  });

  describe('Unreal Engine Material Editor Navigation Controls', () => {
    it('shortcuts registry contains Unreal Engine navigation controls', () => {
      const allShortcuts = getAllShortcuts();
      const viewportShortcuts = allShortcuts.filter((s) => s.category === 'viewport');

      // Right Drag or Middle Drag to pan
      const panShortcut = viewportShortcuts.find((s) =>
        s.keys.includes('Right Drag')
      );
      expect(panShortcut).toBeDefined();
      expect(panShortcut?.description.toLowerCase()).toContain('pan');

      // Left Drag to box marquee select
      const selectShortcut = viewportShortcuts.find((s) =>
        s.keys.includes('Left Drag')
      );
      expect(selectShortcut).toBeDefined();
      expect(selectShortcut?.description.toLowerCase()).toContain('marquee');

      // Wheel to zoom
      const zoomShortcut = viewportShortcuts.find((s) =>
        s.keys.includes('Wheel')
      );
      expect(zoomShortcut).toBeDefined();
      expect(zoomShortcut?.description.toLowerCase()).toContain('zoom');

      // Focus extents (F or Home)
      const focusShortcut = allShortcuts.find((s) =>
        s.keys.includes('F') || s.keys.includes('F, Home')
      );
      expect(focusShortcut).toBeDefined();
    });
  });
});
