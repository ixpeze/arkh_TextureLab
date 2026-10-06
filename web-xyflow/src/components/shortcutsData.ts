import { nodeRegistry } from '../nodes/registry';

export interface ShortcutEntry {
  keys: string[];
  description: string;
  category: 'spawn' | 'graph' | 'slider' | 'viewport';
  tag?: string;
}

export const WORKSPACE_SHORTCUTS: ShortcutEntry[] = [
  // Graph Productivity
  { keys: ['Ctrl', 'Z'], description: 'Undo last graph action', category: 'graph' },
  { keys: ['Ctrl', 'Y'], description: 'Redo last graph action (or Ctrl+Shift+Z)', category: 'graph' },
  { keys: ['Ctrl', 'S'], description: 'Save current project', category: 'graph', tag: 'File' },
  { keys: ['Ctrl', 'O'], description: 'Open project file', category: 'graph', tag: 'File' },
  { keys: ['Ctrl', 'N'], description: 'Create new empty project', category: 'graph', tag: 'File' },
  { keys: ['Ctrl', 'B'], description: 'Toggle left Library dock', category: 'graph', tag: 'Dock' },
  { keys: ['Ctrl', 'Alt', 'B'], description: 'Toggle right Inspector dock', category: 'graph', tag: 'Dock' },
  { keys: ['Ctrl', 'W'], description: 'Open Pack & Unpack Wizard', category: 'graph', tag: 'Wizard' },
  { keys: ['Ctrl', 'E'], description: 'Open Texture Export Hub', category: 'graph', tag: 'Export' },
  { keys: ['D'], description: 'Bypass / Mute selected node', category: 'graph', tag: 'Mute' },
  { keys: ['C'], description: 'Group selected nodes into Comment Box', category: 'graph', tag: 'Group' },
  { keys: ['Del', 'Bksp'], description: 'Delete selected node(s) and connected wires', category: 'graph' },
  { keys: ['Ctrl', 'D'], description: 'Duplicate selected node(s)', category: 'graph' },
  { keys: ['Ctrl', 'A'], description: 'Select all nodes on canvas', category: 'graph' },
  { keys: ['W'], description: 'Auto-wire PBR maps into ORMH Combiner', category: 'graph', tag: 'Auto' },
  { keys: ['F'], description: 'Focus extents (Fit all nodes in view)', category: 'graph' },

  // DCC Sliders
  { keys: ['Middle Click'], description: 'Reset slider to default value', category: 'slider', tag: 'DCC' },
  { keys: ['Shift', 'Drag'], description: 'Fine-precision micro scrub (0.1x speed)', category: 'slider', tag: 'Precision' },
  { keys: ['Ctrl', 'Drag'], description: 'Snap to step interval increments', category: 'slider', tag: 'Snap' },
  { keys: ['Dbl-Click'], description: 'Direct numeric typing input', category: 'slider', tag: 'Direct' },
  { keys: ['Mouse Wheel'], description: 'Nudge value up or down over slider track', category: 'slider' },

  // Viewport Navigation
  { keys: ['Tab'], description: 'Toggle quick search & spawn palette at cursor', category: 'viewport' },
  { keys: ['Right Drag'], description: 'Pan canvas workspace', category: 'viewport' },
  { keys: ['Wheel'], description: 'Smooth zoom in / out', category: 'viewport' },
  { keys: ['Alt', 'Click'], description: 'Cut / disconnect wire connection (UE5 style)', category: 'viewport' },
  { keys: ['?'], description: 'Toggle keyboard shortcuts cheatsheet', category: 'viewport' },
];

/**
 * Returns complete list of shortcuts including dynamically extracted registry hotkeys.
 */
export function getAllShortcuts(): ShortcutEntry[] {
  const dynamicNodeSpawns: ShortcutEntry[] = nodeRegistry
    .getAll()
    .filter((def) => !!def.hotkey)
    .map((def) => ({
      keys: [def.hotkey!.toUpperCase()],
      description: `${def.label} Node`,
      category: 'spawn',
      tag: def.category,
    }));

  return [...dynamicNodeSpawns, ...WORKSPACE_SHORTCUTS];
}
