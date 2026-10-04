# 02 — Target Architecture

Read after `01_AUDIT_REPORT.md`. This is the **design every phase builds toward**. If reality forces a change, record it in §12 Decision Log.

---

## 1. Layers (top = what the user sees)

```
┌──────────────────────────────────────────────────────────────────────┐
│  Electron main process (Node)      desktop/                          │
│  windows, menus, native dialogs, file I/O, autosave, single-instance │
├───────────────▲──────────────────────────────────────────────────────┤
│  preload.ts   │  contextBridge: window.lab  (typed, minimal, no Node)│
├───────────────┴──────────────────────────────────────────────────────┤
│  Renderer (React 19 + @xyflow/react)           web-xyflow/src/       │
│  ┌──────────── UI ────────────┐  ┌──────────── Domain ─────────────┐ │
│  │ ui/ design system          │  │ store/  document + history      │ │
│  │ features/ inspector, lib,  │◄─┤ nodes/  registry (NodeDef)      │ │
│  │   export, project, wizard  │  │ graph/  compile, hash, validate │ │
│  └────────────────────────────┘  └───────────────┬─────────────────┘ │
│                                                  │                   │
│  ┌──────────────── Engine ───────────────────────▼─────────────────┐ │
│  │ gpu/  WebGL2: context, texture pool, programs, scheduler, display│ │
│  │ io/   decode/encode in Workers (PNG exact, TGA, JPEG/WebP, ZIP)  │ │
│  │ platform/ PlatformService (Electron impl, Web dev impl)          │ │
│  └──────────────────────────────────────────────────────────────────┘ │
│  reference/  CPU oracle (tests only, never in prod bundle)            │
└──────────────────────────────────────────────────────────────────────┘
```

**Golden rule:** the *document* (what the user authored: nodes, edges, parameters, asset references) is plain serializable JSON. The *runtime* (textures, GPU objects, caches) is derived and disposable. Pixels never live in the document, never in undo history, never in React state.

## 2. Target folder layout (`web-xyflow/` keeps its name until Phase 6 to avoid script churn)

```
arkh_TextureLab/
  desktop/                    Phase 2
    main.ts  preload.ts  ipc.ts  menu.ts  protocol.ts  windowState.ts  logger.ts
  web-xyflow/
    src/
      app/          App shell, layout, providers, ErrorBoundary
      store/        documentSlice, selectionSlice, uiSlice, history (patches), selectors
      nodes/
        registry.ts           NodeDef lookup + categories
        defs/<type>.ts        ONE file per node: schema, ports, defaults, cpuRef, gpuPass
        ui/NodeShell.tsx      generic renderer from schema
        ui/bodies/            only bespoke bodies (LevelsCurve, ChannelMixer)
      graph/        compile.ts  hash.ts  validate.ts  introspect.ts  serialize.ts  migrate.ts
      gpu/
        context.ts  texturePool.ts  programs.ts  renderer.ts  scheduler.ts
        display.ts  readback.ts  shaders/*.glsl
      io/           decode.worker.ts  encode.worker.ts  png.ts  tga.ts  zip.ts  tokens.ts  naming.ts
      platform/     PlatformService.ts  electronPlatform.ts  webPlatform.ts
      ui/           tokens.css  Button  Slider  Select  Panel  Dialog  Tooltip  Icon
      features/     inspector/  library/  export/  project/  wizard/  hotkeys/
      reference/    CPU oracle (moved from engine/pixelEngine.ts) — tests only
      __tests__/    unit/  golden/  gpu/  e2e/
    scripts/        perf/  contrast-check.mjs
  samples/          1k/ (<= 6 MB, shipped)   4k/ (dev-only, git-ignored or LFS)
  docs/roadmap/     this folder
  release/          build output (git-ignored)
```

Rule: **no source file > 400 lines** (enforced by lint `max-lines` from Phase 1).

## 3. Node registry (replaces F-20)

```ts
// nodes/registry.ts
export interface NodeDef<P = Record<string, unknown>> {
  type: string;                       // 'levels'
  label: string;                      // 'Levels'
  category: 'Input'|'Channel'|'Math'|'Adjust'|'Blend'|'Output'|'Utility'|'Labs';
  hotkey?: string;                    // single letter, never with modifiers
  inputs:  PortDef[];                 // {id:'a', kind:'color'|'scalar'|'any', label, required?}
  outputs: PortDef[];
  params:  ParamSchema;               // typed fields: number{min,max,step,fine}, enum, color, bool, channel
  defaults: P;
  legacyAliases?: string[];           // 'channelPack' -> 'channelCombiner' when loading old data
  gpu: GpuPassSpec;                   // shader id + uniform mapper (Phase 4)
  cpuRef?: (ctx, inputs, params) => TextureBuffer;  // oracle (tests only)
  body?: React.ComponentType<NodeBodyProps<P>>;     // only if schema UI is not enough
}
```

Single registry drives: node palette, spawn palette (Tab), hotkeys, default data, port telemetry, evaluator/compiler dispatch, inspector properties, serialization/migration, and `NodeShell` rendering. **Adding a node = adding one file in `nodes/defs/`.**

The 13 Math nodes stay separate in the UI (D-04) but are generated from one `mathDef(op)` factory sharing one shader (`op` is a compile-time define / uniform).

## 4. Document & store

- State library: **zustand** (tiny, no provider boilerplate, selector-based re-render control). Verify latest version at install time.
- Slices: `document` (nodes, edges, comments, assets), `selection`, `ui` (panels, viewer settings), `session` (dirty, file path).
- React Flow is *controlled* by the store; position/selection/measure changes are **not** document history (only committed drags are).
- **History:** patch-based (immer `produceWithPatches` or zundo with `partialize` to `document`). Slider drags coalesce into one step, committed on pointer-up. Max 100 steps. History holds JSON patches, never pixel data.
- Document key for evaluation = per-node **content hash** (see §6), never a hand-built string.

## 5. `.tlab` project format (v1)

```jsonc
{
  "format": "arkh-texturelab",
  "schemaVersion": 1,
  "appVersion": "1.0.0",
  "meta": { "id": "uuid", "name": "Concrete_A", "createdAt": "ISO", "modifiedAt": "ISO" },
  "assets": [
    { "id": "a1", "rel": "maps/ao.png", "abs": "G:\\tex\\maps\\ao.png",
      "bytes": 157114, "mtimeMs": 1730000000000, "sha1": "..." }
  ],
  "graph": {
    "nodes": [ { "id": "n1", "type": "textureInput", "pos": [0,0],
                 "params": { "assetId": "a1", "colorSpace": "linear", "role": "ao" } } ],
    "edges": [ { "id": "e1", "from": ["n1","r"], "to": ["n2","r"] } ],
    "comments": [ { "id": "c1", "title": "AO", "rect": [0,0,300,200], "color": "#..." } ]
  },
  "export": { "settings": { }, "presets": [ ] },
  "view": { "zoom": 1, "pan": [0,0] }
}
```

Rules: Zod-validated on load; `migrate.ts` upgrades older `schemaVersion`; **newer-than-app files open read-only with a warning**; save is **atomic** (write `*.tmp`, fsync, rename); paths resolve relative-first, then absolute, else "Relink" dialog; no pixel data, no data-URLs.

## 6. GPU engine (Phase 4 core)

### 6.1 Principles
1. **Exactness:** data textures are RGBA8 (default), no sRGB conversion, no premultiplication, no filtering for point ops (`texelFetch`). Bit-exact vs CPU oracle within ±1 LSB for float ops (pow/gamma).
2. **Demand-driven:** only render nodes needed by (a) the viewed node, (b) visible node thumbnails, (c) an export request.
3. **Cached by content hash:** `hash(node) = H(type, canonical(params), hash(input_i)..., workingRes)`. If hash unchanged, reuse the texture.
4. **Interactive working resolution:** default 1024 cap during edits; refine to native after 120 ms idle; export is always native.
5. **No CPU pixel copies:** after upload the CPU array is dropped. Sources are re-decoded from disk after context loss.

### 6.2 Frame loop
```
UI edit -> store patch -> graph/compile (dirty set) -> scheduler.request(generation++)
  -> render dirty nodes (fullscreen triangle per node) into pooled FBO textures
  -> thumbnails (128 px) -> single batched readPixels -> per-card <canvas>
  -> viewer: display shader (channel isolate, alpha checker, 1:1/fit, pan/zoom)
  -> idle 120 ms -> refine pass at native res (cancel if generation changed)
```

### 6.3 Texture pool
Keyed by `(w, h, format)`, ref-counted, LRU eviction, byte accounting. Default VRAM budget **1.5 GiB** (~24 x 4K RGBA8) configurable; evicted textures are *re-rendered on demand* (never stored on CPU). Liveness analysis frees intermediates immediately after their last consumer.

### 6.4 I/O
- **Decode (Worker):** PNG via pure-JS decoder (`fast-png` or `upng-js`; verify 16-bit + palette + interlace) -> exact bytes. JPEG/WebP via `createImageBitmap(blob, {colorSpaceConversion:'none', premultiplyAlpha:'none'})` (opaque so safe). TGA: own decoder (RLE + uncompressed, origin flags). Upload with `UNPACK_PREMULTIPLY_ALPHA_WEBGL=false`, `UNPACK_COLORSPACE_CONVERSION_WEBGL=NONE`.
- **Encode (Worker):** render full-res -> PBO async `readPixels` -> transfer to worker -> PNG 8/16-bit (pure-JS encoder), TGA, JPEG/WebP via `OffscreenCanvas.convertToBlob` (UI warns that lossy/premultiplied formats are unsuitable for packed maps with meaningful alpha).
- **16-bit:** "High Precision" render mode re-renders the graph in `RGBA16F` when any output requests 16b (needs `EXT_color_buffer_float`); 8-bit sources are widened exactly (`v/255`).

### 6.5 Health checks
`getContext('webgl2', {powerPreference:'high-performance', antialias:false, alpha:false, premultipliedAlpha:false, preserveDrawingBuffer:false})`. Check `MAX_TEXTURE_SIZE`, `EXT_color_buffer_float`. Read `WEBGL_debug_renderer_info`; if renderer contains "SwiftShader" or "llvmpipe" show a persistent banner "GPU acceleration unavailable — expect slow performance" and auto-select 512 px working res. Handle `webglcontextlost` (preventDefault, show overlay) and `webglcontextrestored` (re-decode sources, re-render).

### 6.6 Adaptive working resolution
Track a rolling median of (submit -> next-frame) latency. If > 24 ms for 10 consecutive interactions, step working res down (2048 -> 1024 -> 512); if < 8 ms for 30, step up. Never below 512. Owner-visible "Preview quality: Auto / 512 / 1K / 2K / Full" setting.

### 6.7 Resolution policy (resolves F-06)
- Constants (scalar/color) are **uniforms** (resolution-less, zero memory).
- Multi-input ops use the **largest** connected input resolution as output res; smaller inputs are resampled bilinear (or bicubic for the Resize node). Documented in the node's tooltip and tested (TC-130..).
- Output node can set explicit resolution + `longest-edge` mode (aspect always preserved unless the user picks "Stretch" explicitly).

## 7. Electron shell (Phase 2)

| Concern | Design |
|---|---|
| Security | `contextIsolation:true`, `nodeIntegration:false`, `sandbox:true`, `webSecurity:true`; strict CSP (`default-src 'self'; img-src 'self' blob: data:; worker-src 'self' blob:; script-src 'self'; style-src 'self' 'unsafe-inline'`); deny `window.open`, block navigation, deny all permission requests. |
| Loading | Production loads via custom `app://` protocol (`protocol.handle`) so module Workers and `fetch` behave (module workers from `file://` are blocked by Chromium CORS). Dev loads `http://localhost:5173`. |
| IPC | One typed contract `src/shared/ipc.ts`; every handler validates its input (paths, sizes); no generic "run command" or arbitrary fs. File access only to paths the user picked via dialog, the project dir, userData. |
| Drag & drop | `File.path` was removed from newer Electron; use `webUtils.getPathForFile(file)` in preload (verify against current docs). |
| Persistence | `userData/`: `settings.json`, `recent.json`, `window.json`, `autosave/`, `logs/`. |
| GPU | `app.commandLine.appendSwitch('force_high_performance_gpu')` (hybrid laptops), `ignore-gpu-blocklist` only if a test proves it helps. |
| Crashes | Handle `render-process-gone`, `child-process-gone` (GPU), `uncaughtException`; offer Reload; write log. |
| Packaging | `electron-builder`: NSIS (per-user, no admin, shortcuts, uninstall keeps user data) + `portable`. `asar` on. Samples: ship `samples/1k` only. Icon `.ico` (16-256). |

## 8. Design system summary (details in Phase 5)

Recipe **"Graphite Blueprint"**: Cyber-Industrial structure (hairline blueprint grid, mono telemetry) x Swiss/International discipline (8-pt grid, single focal point, 1.25 type scale) x Warm-Editorial neutrals (warm graphite surfaces, off-white paper text) with **one** amber signal accent. PBR socket colors stay (functional).

## 9. Budgets (enforced in Phase 6; measured baseline in Phase 0)

| Metric | Budget | Measured how |
|---|---|---|
| Cold start to interactive (installed, empty project) | <= 3.0 s | `npm run perf` (Electron) |
| Idle RAM (whole process tree) | <= 350 MB | Task-manager style sum via `app.getAppMetrics()` |
| RAM with 7 x 4K sources loaded | <= 900 MB | same |
| Slider drag on Levels, 20-node graph, 4K sources | >= 55 fps, input-to-pixel <= 20 ms @ working res | perf harness + `PerformanceObserver` |
| Refine to native after release | <= 200 ms (4K, 1 branch) | harness |
| Main-thread long tasks during edit | 0 over 50 ms | `longtask` observer |
| Pan/zoom graph, 60 nodes | >= 55 fps | harness |
| Load one 4K PNG | <= 1.2 s, main thread blocked <= 50 ms | harness |
| Export 4 x 4K PNG (ORM set) | <= 8 s, UI responsive | harness |
| Installer / portable size | <= 120 MB / <= 130 MB | file size |
| Build output (renderer) | <= 5 MB excluding fonts | `dist/` size |

> Note: CI runners lack a real GPU (software GL). **Budgets are verified on real hardware (`npm run perf`)** and recorded in the Phase 6 evidence log; CI enforces correctness only.

## 10. Dependencies to add (verify versions via `npm view <pkg> version` at install)

Runtime: `zustand`, `zod`, `fast-png` (or `upng-js`), `immer`.  
Dev: `electron`, `electron-builder`, `electron-vite` *or* (`vite` + `vite-plugin-electron`) — **Phase 2 spike must confirm compatibility with the repo's Vite major**; fallback = separate esbuild step for `desktop/`. `@playwright/test`, `@vitest/browser` (optional), `rimraf`.  
Avoid: native Node modules (`sharp`, `canvas`) — they complicate packaging.

## 11. Cross-cutting rules

- Errors: user-facing errors are plain-language with an action ("File is not a valid PNG. Choose another file."). Technical detail goes to the log.
- Logging: `logger.ts` (main) + renderer `console` mirrored to log file; never log full file contents or user home paths in shared diagnostics (redact username).
- Accessibility: min 11 px text, 24x24 min targets, visible focus (2 px amber, offset 2), `prefers-reduced-motion` respected, full keyboard path for every command.
- Performance hygiene: `React.memo` node bodies, selector subscriptions, `onlyRenderVisibleElements`, LOD below zoom 0.6.

## 12. Decision Log (append)

| # | Decision | Alternatives | Rationale | Trade-off |
|---|---|---|---|---|
| 1 | Electron | Tauri, WebView2 wrapper | Works on every Win10/11 with zero prerequisites; same Chromium+WebGL2 as dev; maintainable by agents | ~90 MB installer, higher RAM than Tauri |
| 2 | WebGL2 GPU engine | CPU workers; WebGPU | Per-pixel ops map perfectly to fragment shaders; WebGL2 is stable in Electron; RTX 3050 floor makes it safe | Shader code + GPU-vs-CPU golden tests required |
| 3 | WebGL2 not WebGPU | WebGPU | Fewer driver/edge issues today; can migrate later behind `gpu/` boundary | Forgo compute shaders (histogram done via readback) |
| 4 | Pure-JS PNG codec | Canvas toBlob | Canvas premultiplies alpha -> corrupts packed maps (F-01) | +1 small dependency, encode in Worker |
| 5 | zustand + patch history | Redux Toolkit, keep React Flow hooks | Minimal boilerplate, selector perf, easy patches | New dependency |
| 6 | Registry-driven nodes | Keep per-node components | One file per node, typed, drives everything | One-time migration of ~30 nodes |
| 7 | Keep folder `web-xyflow/` | Rename to `app/` | Avoid breaking `setup.bat`/`run_web.bat` mid-roadmap | Cosmetic; revisit in Phase 6 |
| 8 | CPU engine -> test-only oracle | Delete | Golden reference for shader correctness | Must keep out of prod bundle |
