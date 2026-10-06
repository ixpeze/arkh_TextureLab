import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { PixelEngine } from '../reference/cpuOracle';
import type { TextureBuffer } from '../types/buffer';
import { GraphEvaluator } from '../reference/graphEvaluator';
import { createDeterministicBuffer, toBase64, type GoldenFixture } from './generate_golden';

describe('PixelEngine CPU Golden Oracle Fixtures', () => {
  const goldenDir = path.resolve(import.meta.dirname, 'golden');
  const files = fs.readdirSync(goldenDir).filter((f) => f.endsWith('.json'));

  const b16_A = createDeterministicBuffer(16, 16, 101);
  const b16_B = createDeterministicBuffer(16, 16, 202);
  const b16_C = createDeterministicBuffer(16, 16, 303);
  const b16_D = createDeterministicBuffer(16, 16, 404);
  const b16_Mask = createDeterministicBuffer(16, 16, 505);

  const b64_A = createDeterministicBuffer(64, 48, 606);
  const b64_B = createDeterministicBuffer(64, 48, 707);

  it(`verifies >= 40 golden fixtures exist (found ${files.length})`, () => {
    expect(files.length).toBeGreaterThanOrEqual(40);
  });

  for (const file of files) {
    const fixture: GoldenFixture = JSON.parse(
      fs.readFileSync(path.join(goldenDir, file), 'utf-8')
    );

    it(`matches golden oracle: ${fixture.id} (${fixture.category} / ${fixture.op})`, () => {
      let output: TextureBuffer | null = null;

      switch (fixture.id) {
        // Combine
        case 'combine_4ch_16x16':
          output = PixelEngine.combineChannels(
            { buffer: b16_A, channel: 0 },
            { buffer: b16_B, channel: 1 },
            { buffer: b16_C, channel: 2 },
            { buffer: b16_D, channel: 3 }
          );
          break;
        case 'combine_fallbacks_64x48':
          output = PixelEngine.combineChannels(
            { buffer: b64_A, channel: 0 },
            { buffer: undefined, channel: 1 },
            { buffer: b64_B, channel: 2 },
            { buffer: undefined, channel: 3 },
            undefined,
            { r: 255, g: 128, b: 0, a: 255 }
          );
          break;
        case 'combine_single_16x16':
          output = PixelEngine.combineChannels({ buffer: b16_A, channel: 0 }, undefined, undefined, undefined);
          break;

        // Split
        case 'split_r_16x16':
          output = PixelEngine.splitChannels(b16_A).r;
          break;
        case 'split_g_16x16':
          output = PixelEngine.splitChannels(b16_A).g;
          break;
        case 'split_b_16x16':
          output = PixelEngine.splitChannels(b16_A).b;
          break;
        case 'split_a_16x16':
          output = PixelEngine.splitChannels(b16_A).a;
          break;
        case 'split_r_64x48':
          output = PixelEngine.splitChannels(b64_A).r;
          break;

        // Coerce UE5
        case 'coerce_scalar_r_to_rgba_16x16':
          output = GraphEvaluator.coerceUE5(b16_A, 'r', 'rgba');
          break;
        case 'coerce_scalar_g_to_rgba_16x16':
          output = GraphEvaluator.coerceUE5(b16_A, 'g', 'rgba');
          break;
        case 'coerce_rgb_to_rgba_16x16':
          output = GraphEvaluator.coerceUE5(b16_A, 'rgb', 'rgba');
          break;
        case 'coerce_rgba_to_scalar_r_16x16':
          output = GraphEvaluator.coerceUE5(b16_A, 'rgba', 'r');
          break;

        // Mix
        case 'mix_swizzle_16x16':
          output = PixelEngine.mixChannels(b16_A, undefined, undefined, 'g', 'r', 'a', 'b');
          break;
        case 'mix_routes_16x16':
          output = PixelEngine.mixChannels(b16_A, {
            r: { sources: ['r', 'g'], combineOp: 'add' },
            g: { sources: ['b'], modifier: 'oneMinus' },
            b: { sources: ['0'] },
            a: { sources: ['1'] },
          });
          break;
        case 'mix_scalars_64x48':
          output = PixelEngine.mixChannels(
            b64_A,
            {
              r: { sources: ['s1'] },
              g: { sources: ['s2'] },
              b: { sources: ['b'] },
              a: { sources: ['a'] },
            },
            { s1: 0.25, s2: 0.75 }
          );
          break;

        // Math
        case 'math_lerp_mask_16x16':
          output = PixelEngine.applyMath('lerp', b16_A, b16_B, b16_Mask);
          break;
        case 'math_add_64x48':
          output = PixelEngine.applyMath('add', b64_A, b64_B);
          break;
        case 'math_multiply_64x48':
          output = PixelEngine.applyMath('multiply', b64_A, b64_B);
          break;

        // Levels
        case 'levels_all_16x16':
          output = PixelEngine.applyLevels(b16_A, 25, 1.3, 230, 10, 245);
          break;
        case 'levels_ch_r_16x16':
          output = PixelEngine.applyLevelsChannel(b16_A, 'r', 40, 0.9, 210, 0, 255);
          break;
        case 'levels_ch_g_16x16':
          output = PixelEngine.applyLevelsChannel(b16_A, 'g', 15, 1.8, 240, 15, 240);
          break;
        case 'levels_ch_b_16x16':
          output = PixelEngine.applyLevelsChannel(b16_A, 'b', 0, 1.0, 190, 0, 255);
          break;
        case 'levels_ch_a_16x16':
          output = PixelEngine.applyLevelsChannel(b16_A, 'a', 50, 1.5, 200, 0, 255);
          break;
        case 'levels_ch_r_64x48':
          output = PixelEngine.applyLevelsChannel(b64_A, 'r', 35, 1.2, 220, 5, 250);
          break;

        // Invert
        case 'invert_16x16':
          output = PixelEngine.invertBuffer(b16_A);
          break;
        case 'invert_64x48':
          output = PixelEngine.invertBuffer(b64_A);
          break;

        // NormalFlip
        case 'normalFlip_16x16':
          output = PixelEngine.flipGreenChannel(b16_A);
          break;
        case 'normalFlip_64x48':
          output = PixelEngine.flipGreenChannel(b64_A);
          break;

        // NormalBlend RNM
        case 'rnm_16x16':
          output = PixelEngine.blendNormalRNM(b16_A, b16_B, 1.0);
          break;
        case 'rnm_64x48':
          output = PixelEngine.blendNormalRNM(b64_A, b64_B, 2.0);
          break;

        // Resize
        case 'resize_stretch_16to32':
          output = PixelEngine.resizeBuffer(b16_A, 32, 24, 'stretch');
          break;
        case 'resize_preserve_64to32':
          output = PixelEngine.resizeBuffer(b64_A, 32, 32, 'preserve');
          break;
        case 'resize_crop_64to32':
          output = PixelEngine.resizeBuffer(b64_A, 32, 32, 'crop');
          break;
        case 'resize_pad_16to24':
          output = PixelEngine.resizeBuffer(b16_A, 24, 24, 'pad');
          break;

        // Seam Check
        case 'seam_2rep_16x16':
          output = PixelEngine.createSeamCheckBuffer(b16_A, 2, true);
          break;
        case 'seam_3rep_16x16':
          output = PixelEngine.createSeamCheckBuffer(b16_A, 3, false);
          break;

        // Compare
        case 'compare_wipe_16x16':
          output = PixelEngine.createCompareBuffer(b16_A, b16_B, 'wipe', 0.5);
          break;
        case 'compare_sideBySide_16x16':
          output = PixelEngine.createCompareBuffer(b16_A, b16_B, 'sideBySide', 0.5);
          break;
        case 'compare_diff_16x16':
          output = PixelEngine.createCompareBuffer(b16_A, b16_B, 'difference', 0.5, 2.0);
          break;

        case 'blend_screen_64x48':
          output = PixelEngine.blendBuffers(b64_A, b64_B, undefined, 'screen', 0.9);
          break;

        default:
          if (fixture.id.startsWith('math_')) {
            const op = fixture.params?.op as any;
            const p1 = fixture.params?.p1;
            const p2 = fixture.params?.p2;
            output = PixelEngine.applyMath(op, b16_A, b16_B, undefined, undefined, undefined, p1, p2);
          } else if (fixture.id.startsWith('blend_')) {
            const mode = fixture.params?.mode as any;
            const opacity = fixture.params?.opacity ?? 1.0;
            output = PixelEngine.blendBuffers(b16_A, b16_B, b16_Mask, mode, opacity);
          }
          break;
      }

      expect(output, `Operation for fixture ${fixture.id} produced null`).not.toBeNull();
      expect(output!.width).toBe(fixture.width);
      expect(output!.height).toBe(fixture.height);
      expect(toBase64(output!.data)).toBe(fixture.expectedBase64);
    });
  }
});
