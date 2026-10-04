import type { Node, Edge } from '@xyflow/react';

const UI_ONLY_KEYS = new Set([
  'previewUrl',
  'preview',
  'title',
  'isPinned',
  'roleColor',
  'res',
  'onLoadBuffer',
]);

/**
 * Recursively canonicalizes an object/value for stable hashing.
 * - Sorts object keys alphabetically.
 * - Omits UI-only keys and functions.
 * - Canonicalizes numbers (NaN -> "NaN", -0 -> 0).
 * - Omit large strings (>2048 chars or data/blob URLs).
 */
function canonicalizeValue(val: unknown): unknown {
  if (val === null || val === undefined) {
    return val;
  }

  if (typeof val === 'function') {
    return undefined;
  }

  if (typeof val === 'number') {
    if (Number.isNaN(val)) return 'NaN';
    if (Object.is(val, -0)) return 0;
    if (val === Infinity) return 'Infinity';
    if (val === -Infinity) return '-Infinity';
    return val;
  }

  if (typeof val === 'string') {
    if (val.length > 2048 || val.startsWith('data:image/') || val.startsWith('blob:')) {
      return undefined;
    }
    return val;
  }

  if (Array.isArray(val)) {
    return val.map((item) => canonicalizeValue(item));
  }

  if (typeof val === 'object') {
    const obj = val as Record<string, unknown>;
    const sortedKeys = Object.keys(obj)
      .filter((k) => !UI_ONLY_KEYS.has(k))
      .sort();

    const result: Record<string, unknown> = {};
    for (const key of sortedKeys) {
      const canonicalChild = canonicalizeValue(obj[key]);
      if (canonicalChild !== undefined) {
        result[key] = canonicalChild;
      }
    }
    return result;
  }

  return val;
}

/**
 * Computes a stable content hash/signature for a single node based on its
 * ID, Type, and functional Data parameters (excluding UI-only attributes).
 */
export function nodeContentHash(node: { id: string; type?: string; data?: Record<string, unknown> }): string {
  const canonicalData = canonicalizeValue(node.data || {});
  return `${node.id}:${node.type || ''}:${JSON.stringify(canonicalData)}`;
}

/**
 * Computes a stable content signature for the entire graph.
 * Changes to UI state (selection, pan, zoom, positions, preview URLs) do not affect this hash.
 */
export function graphContentHash(nodes: Node[], edges: Edge[]): string {
  const sortedNodeSigs = [...nodes]
    .sort((a, b) => a.id.localeCompare(b.id))
    .map((n) => nodeContentHash(n))
    .join('|');

  const sortedEdgeSigs = [...edges]
    .map((e) => `${e.source}:${e.sourceHandle ?? ''}->${e.target}:${e.targetHandle ?? ''}`)
    .sort()
    .join('|');

  return `${sortedNodeSigs}#${sortedEdgeSigs}`;
}
