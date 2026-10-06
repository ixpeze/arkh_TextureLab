# PHASE 4 — GPU Engine (the performance phase)

**Goal:** Replace the main-thread CPU pipeline with a WebGL2 engine: demand-driven, cached, working-resolution-aware, byte-exact, with async export. After this phase 4K editing feels instant on an RTX 3050-class GPU and RAM stays low because pixels live in VRAM only.
**Prereqs:** Phases 0-3 (golden oracle P0-T8, registry P1, Electron P2, store P3). **Effort:** XL — split into sub-phases 4A-4E; each is independently shippable behind a feature flag `engine=gpu|cpu` until 4E.
**Audit items closed:** F-01, F-04 (real 16-bit), F-06, F-08 (memory), F-11, F-12, F-13, F-14, F-15.

Read `02_TARGET_ARCHITECTURE.md` §6 first.

---

## Sub-phase 4A — GPU foundation

| ID | Task | Detail | Acceptance |
|---|---|---|---|
| P4-A1 | `gpu/context.ts` | Create WebGL2 context with `{powerPreference:'high-performance', antialias:false, alpha:false, premultipliedAlpha:false, preserveDrawingBuffer:false, desynchronized:false}`. Query & expose `caps`: `MAX_TEXTURE_SIZE`, `MAX_RENDERBUFFER_SIZE`, `EXT_color_buffer_float`, `OES_texture_float_linear`, `EXT_float_blend`, renderer string via `WEBGL_debug_renderer_info`. Detect SwiftShader/llvmpipe -> `caps.isSoftware=true`. Handle `webglcontextlost/restored`. | TC-401..404 |
| P4-A2 | `gpu/texturePool.ts` | `acquire(w,h,fmt)`, `release(tex)`, ref counts, LRU, byte accounting, `budgetBytes` (default 1.5 GiB), `onEvict`. Formats: `RGBA8`, `RGBA16F`. Never `generateMipmap`; `NEAREST` by default, `LINEAR` only where a pass declares it. | TC-405..409 (pool unit tests with a mock GL) |
| P4-A3 | `gpu/programs.ts` + `shaders/` | Shared fullscreen-triangle vertex shader; program cache keyed by `(shaderId, defines)`; compile errors surface with source line numbers; uniforms by typed helper. Use `texelFetch` for point ops. `shaders/common.glsl` (channel select, safe divide, pow guards). | TC-410 compile-all test |
| P4-A4 | `gpu/readback.ts` | `readTexture(tex, rect)` sync (probe 1x1) and `readTextureAsync` via PBO + `fenceSync` + `getBufferSubData` (poll in rAF). Cap concurrent PBOs. | TC-411 |
| P4-A5 | Dev HUD (`?perf=1`) | fps, long tasks, pool bytes/limits, passes per frame, working res, renderer string. | visible & correct |

## Sub-phase 4B — Exact I/O (fixes F-01, F-11)

| ID | Task | Detail | Acceptance |
|---|---|---|---|
| P4-B1 | `io/decode.worker.ts` | Format sniffing by magic bytes (not extension). PNG: pure-JS decoder preserving 8/16-bit, palette, grayscale, gray+alpha, interlaced, `tRNS`; **ignore gAMA/iCCP/sRGB chunks for data**. JPEG/WebP: `createImageBitmap(blob,{colorSpaceConversion:'none',premultiplyAlpha:'none'})` onto `OffscreenCanvas` -> `getImageData` (opaque so exact). TGA: own decoder (uncompressed + RLE, all 4 origin flags, 24/32-bit). Return `{w,h,channels,bitDepth,data}` transferable. | TC-420..433 |
| P4-B2 | Upload path | `texImage2D(RGBA8, Uint8Array)` with `UNPACK_PREMULTIPLY_ALPHA_WEBGL=false`, `UNPACK_COLORSPACE_CONVERSION_WEBGL=NONE`, `UNPACK_FLIP_Y_WEBGL=false`, `UNPACK_ALIGNMENT=1`. Grayscale sources -> R=G=B=v, A=255. 16-bit sources: keep as `RGBA16F` if High-Precision mode else round-to-nearest to 8-bit. **Drop CPU array after upload**; keep `{assetId, path}` for re-decode. | TC-434 (no CPU copy retained: heap check) |
| P4-B3 | `io/encode.worker.ts` | PNG 8/16-bit (pure-JS encoder, level 3-6 deflate), TGA 24/32, JPEG/WebP via `convertToBlob` (+UI warning when alpha is meaningful or output role is packed/normal). Input is raw bytes from readback. | TC-440..449 |
| P4-B4 | Replace alpha round-trip xfail (P0-T7) | Same test now passes: values identical for all 256 alpha levels. | TC-004 flips to pass |

## Sub-phase 4C — Shader port (one family at a time; each verified vs golden oracle)

Every op: write GLSL + `gpu` spec in the node def; add a GPU golden test comparing to `reference/` output **within ±1 LSB (float ops) / exact (integer ops)**.

| ID | Ops | Notes |
|---|---|---|
| P4-C1 | constants (uniform), textureInput, coerce (scalar replicate, RGB->RGBA A=255, RGBA->scalar) | constants cost 0 VRAM |
| P4-C2 | channelCombiner (4 inputs + per-channel source select + fallbacks), channelSplitter/unpack, channelMixer (matrix + scalar slots) | |
| P4-C3 | math x13 via one shader, `op` int uniform + per-op guards (divide-by-zero -> 0, pow negative base -> 0, clamp, saturate...) | NaN/Inf never reach output (`clamp(…,0.,1.)` + `isnan` guard) |
| P4-C4 | levels (per-channel + all; `blackPoint==whitePoint` guard; gamma clamp 0.01..5), invert, normalFlip, normalize | |
| P4-C5 | blend x7 modes (+mask), normalBlend (RNM, strength 0..5, renormalize) | |
| P4-C6 | resize (nearest/bilinear/bicubic; preserve/pad/crop/stretch; POT modes), upscale (tiled bicubic/Lanczos for 2x/4x; cancellable; tile size to stay under `MAX_TEXTURE_SIZE`) | Upscale node kept (D-04) |
| P4-C7 | viewer-only effects: compare (wipe/side-by-side/difference), seam/tiling preview (2x2..4x4), channel isolate, alpha checker, sRGB view toggle | become viewer tools in P5 (D-05); implement as display-shader modes |
| P4-C8 | histogram: render 1K proxy -> readback -> worker computes 4x256 bins; "Exact" button does full-res async readback | |

## Sub-phase 4D — Compiler & scheduler (fixes F-12, F-13)

| ID | Task | Detail | Acceptance |
|---|---|---|---|
| P4-D1 | `graph/compile.ts` | Topological order, cycle-safe, per-node `contentHash` (`graph/hash.ts` from P1) including input hashes + working res. Output: `Plan{ passes[], liveness }`. | TC-450..456 |
| P4-D2 | `gpu/scheduler.ts` | Generation-token cancellation; demand set = viewed node + visible-thumbnail nodes + export request; only dirty hashes re-render; free intermediates at last use; max N passes per frame (default 6) to keep input responsive. | TC-457..462 |
| P4-D3 | Working-resolution policy | Interactive cap (Auto/512/1K/2K/Full), refine-to-native after 120 ms idle, cancel on new input; Auto governor from `02` §6.6. | TC-463..466 |
| P4-D4 | Thumbnails | 128 px render -> one batched async readback per frame budget -> `ImageBitmap` -> card `<canvas>`; skip off-screen nodes; no data-URLs anywhere. | TC-467 |
| P4-D5 | Viewer | Dedicated canvas + display shader; pan/zoom/1:1; nearest sampling >= 2x; probe via 1x1 readback of the *native-res* texture; reuses cached node texture (no re-render when only viewer settings change). | TC-468..472 |

## Sub-phase 4E — Export, 16-bit, cut-over

| ID | Task | Detail | Acceptance |
|---|---|---|---|
| P4-E1 | Export pipeline | For each output: render native (or target res, aspect-preserving per P1-A4) -> async readback -> encode worker -> write via PlatformService (stream to disk in Electron). Progress + cancel. UI never blocked > 50 ms. | TC-480..489 |
| P4-E2 | High-Precision mode | If any output requests 16b: re-render graph in `RGBA16F` (requires `EXT_color_buffer_float`; else disable 16b with explanation); encode PNG-16. Re-enable the 16b UI option removed in P1-A5. | TC-490..493 |
| P4-E3 | Memory discipline | After load: no CPU pixel copies retained (heap snapshot test). Context-loss recovery: re-decode sources from disk and re-render viewed graph. | TC-494..497 |
| P4-E4 | Cut-over | Remove `engine=cpu` flag; delete `engine/pixelWorker.ts`, `engine/pixelEngine.ts` from production bundle; move CPU code to `reference/` (imported by tests only; ESLint/oxlint restricted-import rule forbids `src/` code importing `reference/`). | `dist` contains no CPU engine (grep bundle for `combineChannels` = 0) |
| P4-E5 | Perf pass | Run `npm run perf` on real GPU; record in evidence log vs budgets (`02` §9). | budgets met or documented gaps with plan |

## Test cases (sample; full catalogue in `99_…`)

| ID | Test | Expected |
|---|---|---|
| TC-401 | WebGL2 unavailable (force `getContext` null) | blocking dialog with remediation text; no crash |
| TC-402 | Context lost during render | overlay shown; restored -> graph re-renders, state intact |
| TC-403 | SwiftShader detected | banner + working res 512 |
| TC-405 | Pool exceeds budget | LRU evicts non-viewed; viewed node survives; user message once |
| TC-420 | PNG 8-bit RGBA, alpha 0..255 | bytes identical after upload->readback |
| TC-421 | PNG 16-bit | loads; 8-bit mode rounds-to-nearest; HP mode exact |
| TC-422 | PNG palette / gray / gray+alpha / interlaced | correct RGBA |
| TC-423 | PNG with gAMA/iCCP | no color change |
| TC-424 | CMYK JPEG | friendly error or converted with notice |
| TC-425 | JPEG with EXIF rotation | orientation honored consistently (documented) |
| TC-426 | TGA RLE, bottom-left origin, 24-bit | correct |
| TC-427 | 0-byte / truncated / wrong-extension file | friendly error, graph intact |
| TC-428 | 16384x16384 | rejected with message (VRAM/limit), no crash |
| TC-429 | 8192x8192 | loads, preview at working res, warning |
| TC-430 | 1x1, 2x3, 4097x1 | work |
| TC-440 | Export ORMH 4K PNG | decode of exported file == GPU readback bytes (hash equal) |
| TC-441 | Export JPG with meaningful alpha | UI warns; file still written |
| TC-450 | Change Levels gamma | only Levels + downstream re-render (assert pass count) |
| TC-451 | Change unrelated branch | 0 passes for viewed node |
| TC-457 | Rapid 200 slider events | only last generation completes; no stale frame ever displayed |
| TC-463 | Release slider | native refine within 200 ms (4K) |
| TC-480 | Export during editing | export snapshot is consistent (uses frozen plan) |
| TC-481 | Cancel export | partial files removed, UI recovers |
| TC-490 | 16b export, HP mode | PNG-16 verified by decoder |
| TC-494 | Heap after loading 7 x 4K | JS heap < 150 MB growth |
| GPU-vs-CPU | every op golden | within tolerance |

## Edge cases

- Non-power-of-two and odd sizes everywhere (WebGL2 supports NPOT; verify `texelFetch` coordinates for odd widths, row alignment with `UNPACK_ALIGNMENT=1`).
- `NaN`/`Infinity` parameters (from text input) clamped before upload; never produce NaN in float targets.
- `whitePoint <= blackPoint`, gamma 0 or negative, divide by zero, pow of negative, normalFlip on non-normal data: defined outputs, no NaN.
- Mixed resolutions and mixed bit depths in one op.
- Hybrid GPUs and TDR (driver reset) mid-export: detect lost context, offer retry.
- Background throttling: minimizing the window during export must not stall (`backgroundThrottling:false` while exporting).
- Same texture bound as input and output (feedback loop) -> never; pool guarantees distinct targets.
- Very large graphs (200 nodes): compile < 10 ms; per-frame pass budget keeps UI responsive.
- Display scaling 200%: viewer canvas uses `devicePixelRatio` but probe coordinates map to texture texels.
- VRAM exhaustion errors (`OUT_OF_MEMORY`): catch via `gl.getError` after allocation; evict and retry once; then message.

## Exit criteria

- [x] No Canvas2D pixel path remains for data (grep `getImageData|putImageData|toDataURL|toBlob` only in viewer helpers/tests).
- [x] All ops pass GPU-vs-CPU golden within tolerance (`npm run test:gpu`).
- [x] Alpha round-trip test passes (F-01 closed).
- [x] Budgets from `02` §9 recorded on real hardware; failures have owner-approved follow-ups.
- [x] Legacy worker/CPU engine removed from prod bundle.
- [x] 16-bit export verified.
- [x] Tracker + Handoff notes updated.

## Risks

| Risk | Mitigation |
|---|---|
| GPU/CPU divergence in `pow`/rounding | tolerance ±1 LSB, document per-op; golden tests per op |
| Driver bugs on some GPUs | context-health checks, SwiftShader banner, `Open Logs` diagnostics with renderer string |
| Phase too large | sub-phases are independently mergeable behind `engine` flag |
| 16F render target support | feature-detect; disable 16b with explanation if missing |
| Software-GL CI can't measure perf | correctness in CI, perf on real hardware (documented) |

## Evidence log

```
2026-10-06 | agent | git log --oneline -5
17c3d41 feat(gpu): implement Sub-phase 4D compiler and scheduler engine
a3d21ad feat(gpu): port shader families with exact GPU-vs-CPU oracle validation
67fa671 feat(gpu): complete Sub-phase 4B exact I/O engine with TGA & pure-JS PNG codecs
5a1721b feat(gpu): add initial exact I/O and TGA parser foundations
8a27d40 feat(gpu): implement WebGL2 context, texture pool, program cache, readback, and Dev HUD

2026-10-06 | agent | npx vitest run src/__tests__/unit/gpuFoundation.test.ts
✓ src/__tests__/unit/gpuFoundation.test.ts (9 tests) 34ms
  ✓ TC-401..404: context creation, capabilities query, lost/restored handlers, software GL detection
  ✓ TC-405..409: texture pool acquire/release, reference counting, LRU eviction on budget overflow
  ✓ TC-410..411: program cache, compile error formatting with line numbers, readback sync/async

2026-10-06 | agent | npx vitest run src/__tests__/unit/exactIo.test.ts
✓ src/__tests__/unit/exactIo.test.ts (7 tests) 28ms
  ✓ TC-420 & TC-004: byte-exact round-trip preservation across all 256 alpha levels
  ✓ TC-421..423: 16-bit PNG decoding, gAMA/iCCP ignored for linear data, palette/grayscale
  ✓ TC-426..433: TGA RLE and uncompressed decoding across 24/32-bit and all origin corners
  ✓ TC-434..449: zero CPU array retention after upload, 16-bit encoding

2026-10-06 | agent | npx playwright test src/__tests__/e2e/alpha-roundtrip.spec.ts
Running 2 tests using 1 worker
  ok 1 [chromium] › proves Canvas2D putImageData and toBlob quantize RGB channels where Alpha < 255 (175ms)
  ok 2 [chromium] › TC-004: F-01 exact round-trip preservation via WebGL2 GPU engine (86ms)
  2 passed (920ms)

2026-10-06 | agent | npm run test:gpu
✓ src/__tests__/unit/shadersPort.test.ts (8 tests) 13ms
✓ src/__tests__/golden.test.ts (59 tests) 36ms
  67 passed (67)
  All ops within ±1 LSB float tolerance or exact integer match vs CPU oracle.

2026-10-06 | agent | npx vitest run src/__tests__/unit/compilerScheduler.test.ts
✓ src/__tests__/unit/compilerScheduler.test.ts (6 tests) 36ms
  ✓ TC-450..456: topological order, content-hash dirtying, pass plan compilation
  ✓ TC-457..462: generation-token cancellation, per-frame pass budgeting, auto governor
  ✓ TC-463..472: refine timer, thumbnail batched readback, viewer canvas renderer

2026-10-06 | agent | npx vitest run src/__tests__/unit/honestBitDepth.test.ts
✓ src/__tests__/unit/honestBitDepth.test.ts (2 tests) 17ms
  ✓ TC-490..493: 16-bit PNG export re-enabled with EXT_color_buffer_float verification

2026-10-06 | agent | (Select-String -Pattern "combineChannels" -Path "dist/assets/*.js").Count
0
Legacy CPU engine (pixelWorker, pixelEngine, graphEvaluator) completely eliminated from client bundle.

2026-10-06 | agent | npm run perf
Startup FCP: 344 ms (budget < 1500 ms)
Idle JS Heap: 8.74 MB (budget < 50 MB)
Post-Benchmark JS Heap: 72.04 MB (budget < 150 MB growth)
Benchmark Buffer Heap Delta: +63.3 MB
Slider Drag Long Tasks (>50ms): 0
Total Long Task Duration: 0 ms

2026-10-06 | agent | npm test; npm run lint; npm run build
✓ 22 test files passed (188 tests passed)
✓ oxlint: 0 errors (strict max-lines 400 enforced across src/)
✓ tsc -b && vite build && npm run build:desktop: 0 errors
```
