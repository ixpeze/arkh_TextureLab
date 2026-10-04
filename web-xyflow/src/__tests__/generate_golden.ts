import fs from 'node:fs';
import path from 'node:path';
import { PixelEngine, type TextureBuffer } from '../engine/pixelEngine';
import { GraphEvaluator } from '../engine/graphEvaluator';

function makeLcg(seed: number) {
  let s = seed % 2147483647;
  if (s <= 0) s += 2147483646;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

export function createDeterministicBuffer(width: number, height: number, seed: number): TextureBuffer {
  const rand = makeLcg(seed);
  const data = new Uint8ClampedArray(width * height * 4);
  for (let i = 0; i < data.length; i += 4) {
    data[i + 0] = Math.floor(rand() * 256);
    data[i + 1] = Math.floor(rand() * 256);
    data[i + 2] = Math.floor(rand() * 256);
    data[i + 3] = Math.floor(rand() * 256);
  }
  return { width, height, data };
}

export function toBase64(data: Uint8ClampedArray): string {
  return Buffer.from(data.buffer, data.byteOffset, data.byteLength).toString('base64');
}

export interface GoldenFixture {
  id: string;
  category: string;
  op: string;
  width: number;
  height: number;
  expectedBase64: string;
  params?: Record<string, any>;
}

export function generateAllFixtures(): GoldenFixture[] {
  const b16_A = createDeterministicBuffer(16, 16, 101);
  const b16_B = createDeterministicBuffer(16, 16, 202);
  const b16_C = createDeterministicBuffer(16, 16, 303);
  const b16_D = createDeterministicBuffer(16, 16, 404);
  const b16_Mask = createDeterministicBuffer(16, 16, 505);

  const b64_A = createDeterministicBuffer(64, 48, 606);
  const b64_B = createDeterministicBuffer(64, 48, 707);
  const b64_Mask = createDeterministicBuffer(64, 48, 808);

  const fixtures: GoldenFixture[] = [];

  const addFixture = (id: string, category: string, op: string, buf: TextureBuffer, params?: Record<string, any>) => {
    fixtures.push({
      id,
      category,
      op,
      width: buf.width,
      height: buf.height,
      expectedBase64: toBase64(buf.data),
      params,
    });
  };

  // 1. Combine Channels
  const comb1 = PixelEngine.combineChannels(
    { buffer: b16_A, channel: 0 },
    { buffer: b16_B, channel: 1 },
    { buffer: b16_C, channel: 2 },
    { buffer: b16_D, channel: 3 }
  );
  addFixture('combine_4ch_16x16', 'combine', 'combineChannels', comb1);

  const comb2 = PixelEngine.combineChannels(
    { buffer: b64_A, channel: 0 },
    { buffer: undefined, channel: 1 },
    { buffer: b64_B, channel: 2 },
    { buffer: undefined, channel: 3 },
    undefined,
    { r: 255, g: 128, b: 0, a: 255 }
  );
  addFixture('combine_fallbacks_64x48', 'combine', 'combineChannels', comb2);

  const comb3 = PixelEngine.combineChannels(
    { buffer: b16_A, channel: 0 },
    undefined,
    undefined,
    undefined
  );
  addFixture('combine_single_16x16', 'combine', 'combineChannels', comb3);

  // 2. Split Channels
  const split16 = PixelEngine.splitChannels(b16_A);
  addFixture('split_r_16x16', 'split', 'splitChannels', split16.r, { channel: 'r' });
  addFixture('split_g_16x16', 'split', 'splitChannels', split16.g, { channel: 'g' });
  addFixture('split_b_16x16', 'split', 'splitChannels', split16.b, { channel: 'b' });
  addFixture('split_a_16x16', 'split', 'splitChannels', split16.a, { channel: 'a' });

  const split64 = PixelEngine.splitChannels(b64_A);
  addFixture('split_r_64x48', 'split', 'splitChannels', split64.r, { channel: 'r' });

  // 3. UE5 Coerce
  const coerce1 = GraphEvaluator.coerceUE5(b16_A, 'r', 'rgba');
  addFixture('coerce_scalar_r_to_rgba_16x16', 'coerce', 'coerceUE5', coerce1, { src: 'r', exp: 'rgba' });

  const coerce2 = GraphEvaluator.coerceUE5(b16_A, 'g', 'rgba');
  addFixture('coerce_scalar_g_to_rgba_16x16', 'coerce', 'coerceUE5', coerce2, { src: 'g', exp: 'rgba' });

  const coerce3 = GraphEvaluator.coerceUE5(b16_A, 'rgb', 'rgba');
  addFixture('coerce_rgb_to_rgba_16x16', 'coerce', 'coerceUE5', coerce3, { src: 'rgb', exp: 'rgba' });

  const coerce4 = GraphEvaluator.coerceUE5(b16_A, 'rgba', 'r');
  addFixture('coerce_rgba_to_scalar_r_16x16', 'coerce', 'coerceUE5', coerce4, { src: 'rgba', exp: 'r' });

  // 4. Mix / Swizzle Channels
  const mix1 = PixelEngine.mixChannels(b16_A, undefined, undefined, 'g', 'r', 'a', 'b');
  addFixture('mix_swizzle_16x16', 'mix', 'mixChannels', mix1, { r: 'g', g: 'r', b: 'a', a: 'b' });

  const mix2 = PixelEngine.mixChannels(
    b16_A,
    {
      r: { sources: ['r', 'g'], combineOp: 'add' },
      g: { sources: ['b'], modifier: 'oneMinus' },
      b: { sources: ['0'] },
      a: { sources: ['1'] },
    }
  );
  addFixture('mix_routes_16x16', 'mix', 'mixChannels', mix2);

  const mix3 = PixelEngine.mixChannels(
    b64_A,
    {
      r: { sources: ['s1'] },
      g: { sources: ['s2'] },
      b: { sources: ['b'] },
      a: { sources: ['a'] },
    },
    { s1: 0.25, s2: 0.75 }
  );
  addFixture('mix_scalars_64x48', 'mix', 'mixChannels', mix3);

  // 5. Math Ops (12 ops + variations)
  const mathOps: ('lerp' | 'multiply' | 'add' | 'subtract' | 'divide' | 'clamp' | 'saturate' | 'power' | 'oneMinus' | 'min' | 'max' | 'abs')[] = [
    'multiply', 'add', 'subtract', 'divide', 'clamp', 'saturate', 'power', 'oneMinus', 'min', 'max', 'abs'
  ];

  for (const op of mathOps) {
    const res16 = PixelEngine.applyMath(op, b16_A, b16_B, undefined, undefined, undefined, op === 'clamp' ? 30 : op === 'power' ? 2.0 : undefined, op === 'clamp' ? 220 : undefined);
    addFixture(`math_${op}_16x16`, 'math', op, res16, { op, p1: op === 'clamp' ? 30 : op === 'power' ? 2.0 : undefined, p2: op === 'clamp' ? 220 : undefined });
  }

  // math lerp with mask
  const lerp16 = PixelEngine.applyMath('lerp', b16_A, b16_B, b16_Mask);
  addFixture('math_lerp_mask_16x16', 'math', 'lerp', lerp16, { op: 'lerp' });

  // math on 64x48
  const add64 = PixelEngine.applyMath('add', b64_A, b64_B);
  addFixture('math_add_64x48', 'math', 'add', add64, { op: 'add' });

  const mul64 = PixelEngine.applyMath('multiply', b64_A, b64_B);
  addFixture('math_multiply_64x48', 'math', 'multiply', mul64, { op: 'multiply' });

  // 6. Levels
  const levAll = PixelEngine.applyLevels(b16_A, 25, 1.3, 230, 10, 245);
  addFixture('levels_all_16x16', 'levels', 'applyLevels', levAll, { bp: 25, gm: 1.3, wp: 230, ob: 10, ow: 245 });

  const levR = PixelEngine.applyLevelsChannel(b16_A, 'r', 40, 0.9, 210, 0, 255);
  addFixture('levels_ch_r_16x16', 'levels', 'applyLevelsChannel', levR, { ch: 'r', bp: 40, gm: 0.9, wp: 210 });

  const levG = PixelEngine.applyLevelsChannel(b16_A, 'g', 15, 1.8, 240, 15, 240);
  addFixture('levels_ch_g_16x16', 'levels', 'applyLevelsChannel', levG, { ch: 'g', bp: 15, gm: 1.8, wp: 240 });

  const levB = PixelEngine.applyLevelsChannel(b16_A, 'b', 0, 1.0, 190, 0, 255);
  addFixture('levels_ch_b_16x16', 'levels', 'applyLevelsChannel', levB, { ch: 'b', bp: 0, gm: 1.0, wp: 190 });

  const levA = PixelEngine.applyLevelsChannel(b16_A, 'a', 50, 1.5, 200, 0, 255);
  addFixture('levels_ch_a_16x16', 'levels', 'applyLevelsChannel', levA, { ch: 'a', bp: 50, gm: 1.5, wp: 200 });

  const lev64 = PixelEngine.applyLevelsChannel(b64_A, 'r', 35, 1.2, 220, 5, 250);
  addFixture('levels_ch_r_64x48', 'levels', 'applyLevelsChannel', lev64, { ch: 'r', bp: 35, gm: 1.2, wp: 220 });

  // 7. Invert
  const inv16 = PixelEngine.invertBuffer(b16_A);
  addFixture('invert_16x16', 'invert', 'invertBuffer', inv16);

  const inv64 = PixelEngine.invertBuffer(b64_A);
  addFixture('invert_64x48', 'invert', 'invertBuffer', inv64);

  // 8. NormalFlip
  const nflip16 = PixelEngine.flipGreenChannel(b16_A);
  addFixture('normalFlip_16x16', 'normalFlip', 'flipGreenChannel', nflip16);

  const nflip64 = PixelEngine.flipGreenChannel(b64_A);
  addFixture('normalFlip_64x48', 'normalFlip', 'flipGreenChannel', nflip64);

  // 9. Blend modes
  const blendModes: ('lerp' | 'multiply' | 'screen' | 'overlay' | 'add' | 'min' | 'max')[] = [
    'lerp', 'multiply', 'screen', 'overlay', 'add', 'min', 'max'
  ];

  for (const m of blendModes) {
    const blendRes = PixelEngine.blendBuffers(b16_A, b16_B, b16_Mask, m, 0.85);
    addFixture(`blend_${m}_16x16`, 'blend', m, blendRes, { mode: m, opacity: 0.85 });
  }

  const blend64 = PixelEngine.blendBuffers(b64_A, b64_B, undefined, 'screen', 0.9);
  addFixture('blend_screen_64x48', 'blend', 'screen', blend64, { mode: 'screen', opacity: 0.9 });

  // 10. NormalBlend RNM
  const rnm16 = PixelEngine.blendNormalRNM(b16_A, b16_B, 1.0);
  addFixture('rnm_16x16', 'normalBlend', 'blendNormalRNM', rnm16, { strength: 1.0 });

  const rnm64 = PixelEngine.blendNormalRNM(b64_A, b64_B, 2.0);
  addFixture('rnm_64x48', 'normalBlend', 'blendNormalRNM', rnm64, { strength: 2.0 });

  // 11. Resize modes
  const resStretch = PixelEngine.resizeBuffer(b16_A, 32, 24, 'stretch');
  addFixture('resize_stretch_16to32', 'resize', 'stretch', resStretch, { tw: 32, th: 24, mode: 'stretch' });

  const resPreserve = PixelEngine.resizeBuffer(b64_A, 32, 32, 'preserve');
  addFixture('resize_preserve_64to32', 'resize', 'preserve', resPreserve, { tw: 32, th: 32, mode: 'preserve' });

  const resCrop = PixelEngine.resizeBuffer(b64_A, 32, 32, 'crop');
  addFixture('resize_crop_64to32', 'resize', 'crop', resCrop, { tw: 32, th: 32, mode: 'crop' });

  const resPad = PixelEngine.resizeBuffer(b16_A, 24, 24, 'pad');
  addFixture('resize_pad_16to24', 'resize', 'pad', resPad, { tw: 24, th: 24, mode: 'pad' });

  // 12. Seam Check
  const seam2 = PixelEngine.createSeamCheckBuffer(b16_A, 2, true);
  addFixture('seam_2rep_16x16', 'seam', 'createSeamCheckBuffer', seam2, { repeats: 2, borders: true });

  const seam3 = PixelEngine.createSeamCheckBuffer(b16_A, 3, false);
  addFixture('seam_3rep_16x16', 'seam', 'createSeamCheckBuffer', seam3, { repeats: 3, borders: false });

  // 13. Compare
  const compWipe = PixelEngine.createCompareBuffer(b16_A, b16_B, 'wipe', 0.5);
  addFixture('compare_wipe_16x16', 'compare', 'wipe', compWipe, { mode: 'wipe', wipeProgress: 0.5 });

  const compSide = PixelEngine.createCompareBuffer(b16_A, b16_B, 'sideBySide', 0.5);
  addFixture('compare_sideBySide_16x16', 'compare', 'sideBySide', compSide, { mode: 'sideBySide', wipeProgress: 0.5 });

  const compDiff = PixelEngine.createCompareBuffer(b16_A, b16_B, 'difference', 0.5, 2.0);
  addFixture('compare_diff_16x16', 'compare', 'difference', compDiff, { mode: 'difference', wipeProgress: 0.5, diffGain: 2.0 });

  return fixtures;
}

if (process.argv.some((arg) => arg.includes('generate_golden'))) {
  const fixtures = generateAllFixtures();
  const goldenDir = path.resolve(import.meta.dirname, 'golden');
  fs.mkdirSync(goldenDir, { recursive: true });

  for (const f of fixtures) {
    const filePath = path.join(goldenDir, `${f.id}.json`);
    fs.writeFileSync(filePath, JSON.stringify(f, null, 2), 'utf-8');
  }

  console.log(`Generated ${fixtures.length} golden fixtures in ${goldenDir}`);
}

