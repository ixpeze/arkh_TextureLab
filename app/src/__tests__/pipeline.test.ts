import { describe, it, expect } from 'vitest';
import { PixelEngine } from '../reference/cpuOracle';
import { GraphEvaluator } from '../reference/graphEvaluator';
import { ExportEngine } from '../engine/exportEngine';
import { BatchEngine } from '../engine/batchEngine';
import { LexicalNormalizer } from '../engine/normalizer';
import type { GlobalExportSettings, TextureCollection, TextureItem } from '../types/export';

describe('TextureLab Node Editor & Pipeline Engine', () => {
  /* ========================================================================= */
  /* 1. UE5 COMPATIBLE CHANNEL COERCION                                        */
  /* ========================================================================= */
  describe('UE5 Type Coercion', () => {
    it('coerces scalar to RGBA vector by replicating channel values', () => {
      // 2x2 solid buffer with R=100
      const scalarBuf = PixelEngine.createSolid(2, 2, 100, 100, 100, 255);
      const coerced = GraphEvaluator.coerceUE5(scalarBuf, 'r', 'rgba');

      expect(coerced.width).toBe(2);
      expect(coerced.height).toBe(2);
      expect(coerced.data[0]).toBe(100);
      expect(coerced.data[1]).toBe(100);
      expect(coerced.data[2]).toBe(100);
      expect(coerced.data[3]).toBe(100);
    });

    it('coerces RGB vector to RGBA vector by asserting Alpha = 255 (1.0)', () => {
      const rgbBuf = PixelEngine.createSolid(2, 2, 200, 150, 50, 0); // initial alpha is 0
      const coerced = GraphEvaluator.coerceUE5(rgbBuf, 'rgb', 'rgba');

      expect(coerced.data[0]).toBe(200);
      expect(coerced.data[1]).toBe(150);
      expect(coerced.data[2]).toBe(50);
      expect(coerced.data[3]).toBe(255); // UE5 coerces Vector3 -> Vector4 with A=1.0
    });

    it('coerces RGBA vector to Scalar by extracting Red channel', () => {
      const rgbaBuf = PixelEngine.createSolid(2, 2, 77, 188, 222, 255);
      const coerced = GraphEvaluator.coerceUE5(rgbaBuf, 'rgba', 'r');

      expect(coerced.data[0]).toBe(77);
      expect(coerced.data[1]).toBe(77);
      expect(coerced.data[2]).toBe(77);
      expect(coerced.data[3]).toBe(255);
    });
  });

  /* ========================================================================= */
  /* 2. CHANNEL MIXER & STRAIGHT-WIRE ROUTING                                  */
  /* ========================================================================= */
  describe('Channel Mixer & Straight-Wire Routing', () => {
    it('executes arbitrary channel routing and fan-out (R -> R & G)', () => {
      const src = PixelEngine.createSolid(2, 2, 255, 0, 0, 255); // Pure red
      const routes = {
        r: { sources: ['r'] },
        g: { sources: ['r'] }, // Fan-out: Red connects to both R and G
        b: { sources: ['0'] },
        a: { sources: ['1'] },
      };

      const mixed = PixelEngine.mixChannels(src, routes);
      expect(mixed.data[0]).toBe(255); // R = 255
      expect(mixed.data[1]).toBe(255); // G = 255
      expect(mixed.data[2]).toBe(0);   // B = 0
      expect(mixed.data[3]).toBe(255); // A = 255
    });

    it('combines multiple sources with explicit math operators and inline modifiers', () => {
      const src = PixelEngine.createSolid(2, 2, 100, 50, 0, 255);
      const routes = {
        r: { sources: ['r', 'g'], combineOp: 'add' as const }, // 100 + 50 = 150
        g: { sources: ['r'], modifier: 'oneMinus' as const },   // 255 - 100 = 155
        b: { sources: ['0'] },
        a: { sources: ['1'] },
      };

      const mixed = PixelEngine.mixChannels(src, routes);
      expect(mixed.data[0]).toBe(150); // combined add
      expect(mixed.data[1]).toBe(155); // inline OneMinus
    });
  });

  /* ========================================================================= */
  /* 3. EXPORT REGISTRATION, DEDUPLICATION & REPLACEMENT                       */
  /* ========================================================================= */
  describe('Export Registration & Deduplication', () => {
    const dummySettings: GlobalExportSettings = {
      projectName: 'TestProj',
      assetName: 'HeroAsset',
      presetId: 'ue5',
      pattern: 'T_{asset}_{slot}',
      masterResolution: 'inherit',
      defaultFormat: 'PNG',
      defaultBitDepth: '8b',
      collisionPolicy: 'rename',
    };

    it('auto-registers ChannelPack output and replaces it when consumed by TextureOutput', () => {
      const solidBuf = PixelEngine.createSolid(4, 4, 128, 128, 128, 255);
      const dummyBuffers = {
        pack_1: solidBuf,
        out_1: solidBuf,
      };

      // Case 1: Unconsumed ChannelPack node auto-registers 1 export item
      const nodesUnconsumed = [
        { id: 'pack_1', type: 'channelPack', data: { slot: 'ORM' } },
      ];
      const registry1 = ExportEngine.buildPreflightRegistry(nodesUnconsumed, [], dummyBuffers, dummySettings, dummySettings.pattern);
      expect(registry1.length).toBe(1);
      expect(registry1[0].sourceType).toBe('channelPack');
      expect(registry1[0].sourceOutput).toBe('pack_1:rgba');

      // Case 2: TextureOutput consumes pack_1:rgba -> explicit entry replaces automatic entry
      const nodesConsumed = [
        { id: 'pack_1', type: 'channelPack', data: { slot: 'ORM' } },
        { id: 'out_1', type: 'textureOutput', data: { slot: 'ORM_Custom', outputFilename: 'T_HeroAsset_ORM_Custom.png' } },
      ];
      const edges = [
        { id: 'e1', source: 'pack_1', sourceHandle: 'rgba', target: 'out_1', targetHandle: 'rgba' },
      ];

      const registry2 = ExportEngine.buildPreflightRegistry(nodesConsumed, edges, dummyBuffers, dummySettings, dummySettings.pattern);
      // Must be deduplicated to exactly 1 export item (explicit replaces auto)
      expect(registry2.length).toBe(1);
      expect(registry2[0].sourceType).toBe('explicit');
      expect(registry2[0].slot).toBe('ORM_Custom');
    });
  });

  /* ========================================================================= */
  /* 4. FILENAME RESOLUTION & COLLISION POLICIES                               */
  /* ========================================================================= */
  describe('Filename Collision Policies', () => {
    it('resolves filename collisions by appending numerical suffixes with rename policy', () => {
      const inputs = [
        'Textures/T_Stone_Albedo.png',
        'Textures/T_Stone_Albedo.png',
        'Textures/T_Stone_Albedo.png',
      ];

      const res = BatchEngine.resolveCollisions(inputs, 'rename');
      expect(res.resolved).toEqual([
        'Textures/T_Stone_Albedo.png',
        'Textures/T_Stone_Albedo_1.png',
        'Textures/T_Stone_Albedo_2.png',
      ]);
      expect(res.collisionsDetected).toBe(2);
    });

    it('respects overwrite policy by preserving target paths', () => {
      const inputs = ['T_Stone_Normal.png', 'T_Stone_Normal.png'];
      const res = BatchEngine.resolveCollisions(inputs, 'overwrite');
      expect(res.resolved).toEqual(['T_Stone_Normal.png', 'T_Stone_Normal.png']);
      expect(res.collisionsDetected).toBe(1);
    });
  });

  /* ========================================================================= */
  /* 5. BATCH ENGINE & FOR-EACH CANCELLATION                                   */
  /* ========================================================================= */
  describe('Batch Operations & For-Each Loop', () => {
    it('executes for-each processing loop with error isolation and cancellation support', async () => {
      const collection: TextureCollection = {
        id: 'test_col',
        name: 'Test Collection',
        items: [
          { id: '1', filename: 'A.png', originalPath: 'A.png', stem: 'A', ext: '.png', setName: 'A', canonicalSuffix: 'Albedo', mapType: 'baseColor', isExcluded: false },
          { id: '2', filename: 'B.png', originalPath: 'B.png', stem: 'B', ext: '.png', setName: 'B', canonicalSuffix: 'Normal', mapType: 'normal', isExcluded: false },
          { id: '3', filename: 'C.png', originalPath: 'C.png', stem: 'C', ext: '.png', setName: 'C', canonicalSuffix: 'Rough', mapType: 'roughness', isExcluded: false },
        ],
        createdAt: Date.now(),
      };

      // Test Error Isolation: Item B throws an error, but loop continues to Item C
      const runResult = await BatchEngine.executeForEach(
        'batch_test_1',
        collection,
        async (item: TextureItem) => {
          if (item.filename === 'B.png') {
            throw new Error('Corrupt texture header');
          }
          return PixelEngine.createSolid(2, 2, 255, 255, 255, 255);
        }
      );

      expect(runResult.isCancelled).toBe(false);
      expect(runResult.results.length).toBe(3);
      expect(runResult.errors.length).toBe(1);
      expect(runResult.errors[0].item).toBe('B.png');
      expect(runResult.results[2].outputBuffer).not.toBeNull(); // Item C processed successfully!
    });

    it('cancels batch execution immediately when cancellation token is flagged', async () => {
      const collection: TextureCollection = {
        id: 'cancel_col',
        name: 'Cancel Collection',
        items: [
          { id: '1', filename: '1.png', originalPath: '1.png', stem: '1', ext: '.png', setName: '1', canonicalSuffix: 'M', mapType: 'baseColor', isExcluded: false },
          { id: '2', filename: '2.png', originalPath: '2.png', stem: '2', ext: '.png', setName: '2', canonicalSuffix: 'M', mapType: 'baseColor', isExcluded: false },
          { id: '3', filename: '3.png', originalPath: '3.png', stem: '3', ext: '.png', setName: '3', canonicalSuffix: 'M', mapType: 'baseColor', isExcluded: false },
        ],
        createdAt: Date.now(),
      };

      const runPromise = BatchEngine.executeForEach(
        'cancel_batch_id',
        collection,
        async (item) => {
          if (item.filename === '1.png') {
            // Trigger cancellation during first item execution
            BatchEngine.cancelBatch('cancel_batch_id');
          }
          return null;
        }
      );

      const res = await runPromise;
      expect(res.isCancelled).toBe(true);
      expect(res.results.length).toBeLessThan(3);
    });
  });

  /* ========================================================================= */
  /* 6. INSPECTION: COMPARE & SEAM CHECK                                       */
  /* ========================================================================= */
  describe('Inspection Views', () => {
    it('generates comparison wipe buffer with dividing hairline', () => {
      const bufA = PixelEngine.createSolid(10, 10, 255, 0, 0, 255); // Red
      const bufB = PixelEngine.createSolid(10, 10, 0, 0, 255, 255); // Blue

      const wipeBuf = PixelEngine.createCompareBuffer(bufA, bufB, 'wipe', 0.5);
      expect(wipeBuf.width).toBe(10);
      expect(wipeBuf.height).toBe(10);

      // Pixel at x=2 (left of wipe) should be A (Red)
      const leftIdx = (2 * 10 + 2) * 4;
      expect(wipeBuf.data[leftIdx + 0]).toBe(255);
      expect(wipeBuf.data[leftIdx + 2]).toBe(0);

      // Pixel at x=8 (right of wipe) should be B (Blue)
      const rightIdx = (2 * 10 + 8) * 4;
      expect(wipeBuf.data[rightIdx + 0]).toBe(0);
      expect(wipeBuf.data[rightIdx + 2]).toBe(255);

      // Pixel at x=5 (wipe hairline) should be cyan highlight (56, 189, 248)
      const lineIdx = (2 * 10 + 5) * 4;
      expect(wipeBuf.data[lineIdx + 0]).toBe(56);
      expect(wipeBuf.data[lineIdx + 1]).toBe(189);
      expect(wipeBuf.data[lineIdx + 2]).toBe(248);
    });

    it('generates repeated tiled preview for seam check', () => {
      const src = PixelEngine.createSolid(16, 16, 128, 128, 128, 255);
      const seamBuf = PixelEngine.createSeamCheckBuffer(src, 2, true);

      expect(seamBuf.width).toBe(32);
      expect(seamBuf.height).toBe(32);
      expect(seamBuf.data.length).toBe(32 * 32 * 4);
    });
  });

  /* ========================================================================= */
  /* 7. TEXTURELAB NORMALIZER FIDELITY                                         */
  /* ========================================================================= */
  describe('TextureLAB Normalizer Rules', () => {
    it('cleans vendor prefixes, resolution suffixes, and normalizes canonical PascalCase', () => {
      const filename = 'TexturesCom_Cobblestone_Wall_4096x4096_roughness.png';
      const meta = LexicalNormalizer.normalizeFilename(filename);

      expect(meta.roleLabel).toBe('Roughness (R)');
      expect(meta.detectedRole).toBe('roughness');
      expect(meta.isPacked).toBe(false);

      const clean = LexicalNormalizer.cleanStem('TexturesCom_Cobblestone_Wall_4096x4096');
      expect(clean).toBe('CobblestoneWall');
    });

    it('detects OpenGL normal maps and indicates green flip requirement', () => {
      const glMeta = LexicalNormalizer.normalizeFilename('T_Rock_normal_gl.png');
      expect(glMeta.requiresGreenFlip).toBe(true);

      const dxMeta = LexicalNormalizer.normalizeFilename('T_Rock_normal_dx.png');
      expect(dxMeta.requiresGreenFlip).toBe(false);
    });

    it('flips green channel correctly for OpenGL <=> DirectX normal conversion', () => {
      const src = PixelEngine.createSolid(2, 2, 128, 55, 255, 255);
      const flipped = PixelEngine.flipGreenChannel(src);

      expect(flipped.data[0]).toBe(128);       // Red unaffected
      expect(flipped.data[1]).toBe(255 - 55);  // Green inverted: 200
      expect(flipped.data[2]).toBe(255);       // Blue unaffected
    });

    it('faithfully detects map types for sample textures matching AutoAssignMaterials keywords', () => {
      const baseMeta = LexicalNormalizer.normalizeFilename('anthracite smooth cast concrete basecolor 4k.png');
      expect(baseMeta.detectedRole).toBe('base_color');
      expect(baseMeta.colorSpace).toBe('sRGB');
      expect(baseMeta.resolution).toBe('4K');

      const roughMeta = LexicalNormalizer.normalizeFilename('anthracite smooth cast concrete roughness 4k.png');
      expect(roughMeta.detectedRole).toBe('roughness');
      expect(roughMeta.colorSpace).toBe('Linear');

      const normMeta = LexicalNormalizer.normalizeFilename('anthracite smooth cast concrete normal 4k.png');
      expect(normMeta.detectedRole).toBe('normal');
      expect(normMeta.colorSpace).toBe('Linear');

      const aoMeta = LexicalNormalizer.normalizeFilename('anthracite smooth cast concrete ambientocclusion 4k.png');
      expect(aoMeta.detectedRole).toBe('ambient_occlusion');
      expect(aoMeta.colorSpace).toBe('Linear');

      const metalMeta = LexicalNormalizer.normalizeFilename('anthracite smooth cast concrete metallic 4k.png');
      expect(metalMeta.detectedRole).toBe('metallic');
      expect(metalMeta.colorSpace).toBe('Linear');

      const heightMeta = LexicalNormalizer.normalizeFilename('anthracite smooth cast concrete height 4k.png');
      expect(heightMeta.detectedRole).toBe('height');
      expect(heightMeta.colorSpace).toBe('Linear');

      const prevMeta = LexicalNormalizer.normalizeFilename('anthracite smooth cast concrete 4k preview.png');
      expect(prevMeta.detectedRole).toBe('preview');
    });

    it('accurately identifies AutoAssignMaterials keyword abbreviations and aliases', () => {
      expect(LexicalNormalizer.normalizeFilename('T_Rock_BC.png').detectedRole).toBe('base_color');
      expect(LexicalNormalizer.normalizeFilename('T_Rock_Albedo.png').detectedRole).toBe('base_color');
      expect(LexicalNormalizer.normalizeFilename('T_Rock_Diffuse.png').detectedRole).toBe('base_color');

      expect(LexicalNormalizer.normalizeFilename('T_Rock_N.png').detectedRole).toBe('normal');
      expect(LexicalNormalizer.normalizeFilename('T_Rock_NRM.png').detectedRole).toBe('normal');
      expect(LexicalNormalizer.normalizeFilename('T_Rock_nor_dx.png').detectedRole).toBe('normal_directx');
      expect(LexicalNormalizer.normalizeFilename('T_Rock_nor_gl.png').detectedRole).toBe('normal_opengl');

      expect(LexicalNormalizer.normalizeFilename('T_Rock_R.png').detectedRole).toBe('roughness');
      expect(LexicalNormalizer.normalizeFilename('T_Rock_Rough.png').detectedRole).toBe('roughness');

      expect(LexicalNormalizer.normalizeFilename('T_Rock_M.png').detectedRole).toBe('metallic');
      expect(LexicalNormalizer.normalizeFilename('T_Rock_Metal.png').detectedRole).toBe('metallic');

      expect(LexicalNormalizer.normalizeFilename('T_Rock_AO.png').detectedRole).toBe('ambient_occlusion');
      expect(LexicalNormalizer.normalizeFilename('T_Rock_Occ.png').detectedRole).toBe('ambient_occlusion');

      expect(LexicalNormalizer.normalizeFilename('T_Rock_ORM.png').detectedRole).toBe('orm');
      expect(LexicalNormalizer.normalizeFilename('T_Rock_ORM.png').isPacked).toBe(true);
      expect(LexicalNormalizer.normalizeFilename('T_Rock_RMA.png').detectedRole).toBe('rma');

      expect(LexicalNormalizer.normalizeFilename('T_Rock_Disp.png').detectedRole).toBe('height');
      expect(LexicalNormalizer.normalizeFilename('T_Rock_H.png').detectedRole).toBe('height');

      expect(LexicalNormalizer.normalizeFilename('T_Rock_Alpha.png').detectedRole).toBe('opacity');
      expect(LexicalNormalizer.normalizeFilename('T_Rock_E.png').detectedRole).toBe('emissive');
    });
  });
});
