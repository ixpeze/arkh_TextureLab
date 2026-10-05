import { describe, it, expect } from 'vitest';
import { nodeRegistry } from '../../nodes/registry';
import { CATEGORIES } from '../../components/nodeLibraryData';
import { createSpawnedNode } from '../../app/spawn';
import { GraphEvaluator } from '../../engine/graphEvaluator';
import { type TextureBuffer } from '../../engine/pixelEngine';
import { getNodePortTelemetry } from '../../graph/introspect';
import type { Node, Edge } from '@xyflow/react';

const EXPECTED_MATH_TYPES = [
  'math',
  'lerp',
  'multiply',
  'add',
  'subtract',
  'divide',
  'clamp',
  'saturate',
  'power',
  'oneMinus',
  'min',
  'max',
  'abs',
];

const LEGACY_MATH_ALIASES = [
  'mathAdd',
  'mathSubtract',
  'mathMultiply',
  'mathDivide',
  'mathPower',
  'mathMin',
  'mathMax',
  'mathClamp',
  'mathSaturate',
  'mathAbs',
  'mathOneMinus',
  'mathLerp',
  'mathDot',
  'mathCross',
  'mathOp',
];

function createTestBuffer(width: number, height: number, color: [number, number, number, number] = [128, 128, 128, 255]): TextureBuffer {
  const data = new Uint8ClampedArray(width * height * 4);
  for (let i = 0; i < data.length; i += 4) {
    data[i] = color[0];
    data[i + 1] = color[1];
    data[i + 2] = color[2];
    data[i + 3] = color[3];
  }
  return { width, height, data };
}

describe('Math Operation Nodes (All 13 Operations & Legacy Aliases)', () => {
  it('all 13 math nodes exist in the registry with Category "Math" and a custom body component', () => {
    const nodeTypes = nodeRegistry.getNodeTypes();

    for (const type of EXPECTED_MATH_TYPES) {
      expect(nodeRegistry.has(type), `Node registry must contain '${type}'`).toBe(true);
      const def = nodeRegistry.get(type);
      expect(def).toBeDefined();
      expect(def?.category).toBe('Math');
      expect(def?.body, `Def '${type}' must have a custom body component`).toBeDefined();
      expect(nodeTypes[type], `nodeTypes['${type}'] must be registered in React Flow nodeTypes`).toBeDefined();
    }
  });

  it('nodeLibraryData Math category contains all 13 math operations with valid registered keys', () => {
    const mathCategory = CATEGORIES.find((c) => c.name.startsWith('Math'));
    expect(mathCategory).toBeDefined();
    expect(mathCategory!.items.length).toBe(13);

    const nodeTypes = nodeRegistry.getNodeTypes();

    for (const item of mathCategory!.items) {
      expect(nodeRegistry.has(item.key), `Library key '${item.key}' must be registered`).toBe(true);
      const canonical = nodeRegistry.resolveCanonicalType(item.key);
      expect(EXPECTED_MATH_TYPES).toContain(canonical);

      // Verify that spawning this library item produces a node that maps to an actual component
      const spawned = createSpawnedNode({
        typeKey: item.key,
        position: { x: 100, y: 100 },
      });

      expect(spawned.type).toBeDefined();
      expect(
        nodeTypes[spawned.type!],
        `Spawned node type '${spawned.type}' for key '${item.key}' must have a registered component in nodeTypes (never blank DefaultNode)`
      ).toBeDefined();
    }
  });

  it('legacy math aliases resolve canonically and map to registered components', () => {
    const nodeTypes = nodeRegistry.getNodeTypes();

    for (const alias of LEGACY_MATH_ALIASES) {
      expect(nodeRegistry.has(alias), `Alias '${alias}' must be recognized by registry`).toBe(true);
      const def = nodeRegistry.get(alias);
      expect(def, `Alias '${alias}' must resolve to a valid definition`).toBeDefined();
      expect(EXPECTED_MATH_TYPES).toContain(def!.type);

      // Verify nodeTypes has an entry for the alias so existing graphs do not fall back to DefaultNode
      expect(
        nodeTypes[alias],
        `nodeTypes must have component for alias '${alias}' so existing graphs render properly`
      ).toBeDefined();

      // Verify createSpawnedNode resolves alias to canonical type
      const spawned = createSpawnedNode({
        typeKey: alias,
        position: { x: 50, y: 50 },
      });
      expect(nodeTypes[spawned.type!]).toBeDefined();
    }
  });

  it('evaluates all 13 math operations on valid input buffers', () => {
    const bufA = createTestBuffer(64, 64, [200, 150, 100, 255]);
    const bufB = createTestBuffer(64, 64, [50, 50, 50, 255]);

    for (const opType of EXPECTED_MATH_TYPES) {
      const nodes: Node[] = [
        { id: 'inA', type: 'textureInput', position: { x: 0, y: 0 }, data: {} },
        { id: 'inB', type: 'textureInput', position: { x: 0, y: 100 }, data: {} },
        { id: 'mathNode', type: opType, position: { x: 200, y: 50 }, data: { valA: 0.5, valB: 0.5 } },
      ];

      const edges: Edge[] = [
        { id: 'e1', source: 'inA', target: 'mathNode', targetHandle: 'a' },
        { id: 'e2', source: 'inB', target: 'mathNode', targetHandle: 'b' },
      ];

      const sourceBuffers = { inA: bufA, inB: bufB };
      const evaluated = GraphEvaluator.evaluate(nodes, edges, sourceBuffers);

      expect(evaluated.mathNode, `Evaluated buffer for op '${opType}' must exist`).toBeDefined();
      expect(evaluated.mathNode.width).toBe(64);
      expect(evaluated.mathNode.height).toBe(64);
      expect(evaluated.mathNode.data.length).toBe(64 * 64 * 4);
    }
  });

  it('evaluates legacy aliases through GraphEvaluator without error', () => {
    const bufA = createTestBuffer(32, 32, [180, 120, 60, 255]);
    const bufB = createTestBuffer(32, 32, [40, 40, 40, 255]);

    for (const alias of LEGACY_MATH_ALIASES) {
      const nodes: Node[] = [
        { id: 'inA', type: 'textureInput', position: { x: 0, y: 0 }, data: {} },
        { id: 'inB', type: 'textureInput', position: { x: 0, y: 100 }, data: {} },
        { id: 'mathNode', type: alias, position: { x: 200, y: 50 }, data: {} },
      ];

      const edges: Edge[] = [
        { id: 'e1', source: 'inA', target: 'mathNode', targetHandle: 'a' },
        { id: 'e2', source: 'inB', target: 'mathNode', targetHandle: 'b' },
      ];

      const evaluated = GraphEvaluator.evaluate(nodes, edges, { inA: bufA, inB: bufB });
      expect(evaluated.mathNode, `Evaluated buffer for alias '${alias}' must exist`).toBeDefined();
      expect(evaluated.mathNode.width).toBe(32);
      expect(evaluated.mathNode.height).toBe(32);
    }
  });

  it('getNodePortTelemetry returns ports for all 13 math nodes and aliases', () => {
    for (const type of [...EXPECTED_MATH_TYPES, ...LEGACY_MATH_ALIASES]) {
      const testNode: Node = { id: 'm1', type, position: { x: 0, y: 0 }, data: {} };
      const edges: Edge[] = [];
      const ports = getNodePortTelemetry(testNode, edges);
      expect(ports.length).toBeGreaterThanOrEqual(1);
    }
  });
});
