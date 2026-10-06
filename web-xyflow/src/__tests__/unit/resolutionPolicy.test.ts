import { describe, it, expect } from 'vitest';
import { PixelEngine } from '../../reference/cpuOracle';
import type { TextureBuffer } from '../../types/buffer';
import { GraphEvaluator } from '../../reference/graphEvaluator';
import type { Node, Edge } from '@xyflow/react';

describe('P1-A6: Resolution Policy (F-06, TC-130..134)', () => {
  it('TC-130: 4K texture input + constant scalar evaluates to 4K output', () => {
    const tex4K: TextureBuffer = {
      width: 4096,
      height: 4096,
      data: new Uint8ClampedArray(4096 * 4096 * 4),
    };

    const nodes: Node[] = [
      { id: 'tex', type: 'textureInput', position: { x: 0, y: 0 }, data: {} },
      { id: 'scalar', type: 'constantScalar', position: { x: 0, y: 100 }, data: { value: 0.5 } },
      { id: 'math', type: 'multiply', position: { x: 200, y: 0 }, data: {} },
      { id: 'out', type: 'textureOutput', position: { x: 400, y: 0 }, data: {} },
    ];

    const edges: Edge[] = [
      { id: 'e1', source: 'tex', sourceHandle: 'rgba', target: 'math', targetHandle: 'a' },
      { id: 'e2', source: 'scalar', sourceHandle: 'scalar', target: 'math', targetHandle: 'b' },
      { id: 'e3', source: 'math', sourceHandle: 'out', target: 'out', targetHandle: 'rgba' },
    ];

    const evaluated = GraphEvaluator.evaluate(nodes, edges, { tex: tex4K });
    const outBuf = evaluated['out'];

    expect(outBuf).toBeDefined();
    expect(outBuf.width).toBe(4096);
    expect(outBuf.height).toBe(4096);
  });

  it('TC-130b: constant scalar on A + 4K texture on B evaluates to 4K output without NaN', () => {
    const tex4K: TextureBuffer = {
      width: 4096,
      height: 4096,
      data: new Uint8ClampedArray(4096 * 4096 * 4),
    };
    tex4K.data.fill(200);

    const nodes: Node[] = [
      { id: 'scalar', type: 'constantScalar', position: { x: 0, y: 0 }, data: { value: 0.5 } },
      { id: 'tex', type: 'textureInput', position: { x: 0, y: 100 }, data: {} },
      { id: 'math', type: 'multiply', position: { x: 200, y: 0 }, data: {} },
      { id: 'out', type: 'textureOutput', position: { x: 400, y: 0 }, data: {} },
    ];

    // Connect scalar to A and 4K texture to B
    const edges: Edge[] = [
      { id: 'e1', source: 'scalar', sourceHandle: 'scalar', target: 'math', targetHandle: 'a' },
      { id: 'e2', source: 'tex', sourceHandle: 'rgba', target: 'math', targetHandle: 'b' },
      { id: 'e3', source: 'math', sourceHandle: 'out', target: 'out', targetHandle: 'rgba' },
    ];

    const evaluated = GraphEvaluator.evaluate(nodes, edges, { tex: tex4K });
    const outBuf = evaluated['out'];

    expect(outBuf).toBeDefined();
    expect(outBuf.width).toBe(4096);
    expect(outBuf.height).toBe(4096);

    // Pixel at index 512*512*4 + 10 (beyond 512x512) must not be corrupted/NaN/zero
    const sample = PixelEngine.samplePixel(outBuf, 1000, 1000);
    expect(sample.r).toBeGreaterThan(0);
    expect(Number.isNaN(sample.r)).toBe(false);
  });

  it('TC-131: 4K + 1K into combiner produces 4K output with bilinear resampling of smaller input', () => {
    const tex4K: TextureBuffer = {
      width: 4096,
      height: 4096,
      data: new Uint8ClampedArray(4096 * 4096 * 4),
    };
    // Initialize 1K gradient buffer to test bilinear interpolation
    const tex1K: TextureBuffer = {
      width: 1024,
      height: 1024,
      data: new Uint8ClampedArray(1024 * 1024 * 4),
    };
    for (let i = 0; i < 1024 * 1024; i++) {
      tex1K.data[i * 4 + 1] = Math.floor((i % 1024) / 4); // Green channel gradient
    }

    const combined = PixelEngine.combineChannels(
      { buffer: tex4K, channel: 0 },
      { buffer: tex1K, channel: 1 }
    );

    expect(combined.width).toBe(4096);
    expect(combined.height).toBe(4096);

    // Bilinear check: sample at non-integer pixel center in 1K grid
    // x = 2 in 4K maps to x = 0.5 in 1K, which should be interpolated
    const p1 = PixelEngine.samplePixel(combined, 1, 0);
    const p2 = PixelEngine.samplePixel(combined, 2, 0);
    const p3 = PixelEngine.samplePixel(combined, 3, 0);
    expect(p1.g).toBeLessThanOrEqual(p2.g);
    expect(p2.g).toBeLessThanOrEqual(p3.g);
  });

  it('TC-132: graph with only constants evaluates to 512x512', () => {
    const nodes: Node[] = [
      { id: 'scalar1', type: 'constantScalar', position: { x: 0, y: 0 }, data: { value: 0.25 } },
      { id: 'scalar2', type: 'constantScalar', position: { x: 0, y: 100 }, data: { value: 0.75 } },
      { id: 'math', type: 'add', position: { x: 200, y: 0 }, data: {} },
      { id: 'out', type: 'textureOutput', position: { x: 400, y: 0 }, data: {} },
    ];

    const edges: Edge[] = [
      { id: 'e1', source: 'scalar1', sourceHandle: 'scalar', target: 'math', targetHandle: 'a' },
      { id: 'e2', source: 'scalar2', sourceHandle: 'scalar', target: 'math', targetHandle: 'b' },
      { id: 'e3', source: 'math', sourceHandle: 'out', target: 'out', targetHandle: 'rgba' },
    ];

    const evaluated = GraphEvaluator.evaluate(nodes, edges, {});
    const outBuf = evaluated['out'];

    expect(outBuf).toBeDefined();
    expect(outBuf.width).toBe(512);
    expect(outBuf.height).toBe(512);
  });

  it('TC-133: non-square 2048x1024 + 1024x1024 into combiner adopts 2048x1024 dimensions', () => {
    const nonSquare: TextureBuffer = {
      width: 2048,
      height: 1024,
      data: new Uint8ClampedArray(2048 * 1024 * 4),
    };
    const square1K: TextureBuffer = {
      width: 1024,
      height: 1024,
      data: new Uint8ClampedArray(1024 * 1024 * 4),
    };

    const combined = PixelEngine.combineChannels(
      { buffer: nonSquare, channel: 0 },
      { buffer: square1K, channel: 1 }
    );

    expect(combined.width).toBe(2048);
    expect(combined.height).toBe(1024);
  });

  it('TC-134: 1x1 texture input broadcasts across 512x512 without crash', () => {
    const singlePix: TextureBuffer = {
      width: 1,
      height: 1,
      data: new Uint8ClampedArray([128, 64, 32, 255]),
    };
    const buf512: TextureBuffer = {
      width: 512,
      height: 512,
      data: new Uint8ClampedArray(512 * 512 * 4),
    };

    const combined = PixelEngine.combineChannels(
      { buffer: singlePix, channel: 0 },
      { buffer: buf512, channel: 1 }
    );

    expect(combined.width).toBe(512);
    expect(combined.height).toBe(512);

    // Verify broadcast value at corners and center
    expect(PixelEngine.samplePixel(combined, 0, 0).r).toBe(128);
    expect(PixelEngine.samplePixel(combined, 256, 256).r).toBe(128);
    expect(PixelEngine.samplePixel(combined, 511, 511).r).toBe(128);
  });
});
