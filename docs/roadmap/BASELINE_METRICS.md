# ARKH TextureLab — Baseline Metrics (Phase 0)

Measured on Windows 10/11 x64 under Node v24.20.0, Vitest 5.0.3, Oxlint 1.81.0, Playwright 1.63.0.

---

## 1. Quality & Test Gates

| Metric | Pre-Roadmap Value | Phase 0 Baseline | Command |
|---|---|---|---|
| Unit test suites | 1 file (`pipeline.test.ts`) | 2 files (`pipeline.test.ts`, `golden.test.ts`) | `npm test` |
| Total tests passing | 17 passed | **76 passed** (17 pipeline + 59 golden) | `npm test` |
| Golden CPU fixtures | 0 | **58 fixtures** (covering all 13 math ops, blend, levels, etc.) | `npm test` |
| Lint issues | 0 warnings, 0 errors | **151 warnings, 0 errors** (tightened rules active) | `npm run lint` |
| `no-explicit-any` warnings | Unchecked | 139 warnings (target: 0 by Phase 1 end) | `oxlint` |
| `max-lines (>400)` warnings | Unchecked | 12 files (target: 0 by Phase 1 end) | `oxlint` |
| F-01 Canvas2D test | Not tested | **Proven & xfailed** (3,059/4,096 corrupted pixels) | `npm run test:e2e` |

---

## 2. Bundle & Disk Footprint

| Metric | Pre-Diet Value | Post-Diet Value | Improvement | Command |
|---|---|---|---|---|
| `dist/` total size | **208.59 MB** | **1.55 MB** | **-99.26% (-207.04 MB)** | `(Get-ChildItem dist -Recurse -File \| Measure -Sum).Sum/1MB` |
| JS bundle (main chunk) | 674.55 kB (192.77 kB gz) | 674.86 kB (192.80 kB gz) | ~same | Vite build log |
| CSS bundle | 22.01 kB (4.24 kB gz) | 22.01 kB (4.24 kB gz) | ~same | Vite build log |
| Worker bundle | 8.15 kB | 8.15 kB | ~same | Vite build log |
| Git tracked files total | **364.99 MB** | **1.53 MB** | **-363.46 MB (-99.58%)** | `git ls-files` size sum |
| Shipping sample textures | None (only 4K in repo) | `samples/1k/` (5.03 MB, 7 maps) | Shipped <= 6 MB | `Get-ChildItem samples/1k` |
| Dev-only 4K textures | In `public/` (copied to dist) | `samples/4k/` (git-ignored, dev-only) | Excluded from prod | `git check-ignore` |

---

## 3. Runtime Performance & Memory (Playwright Chromium Harness)

Measured via `npm run perf` (`web-xyflow/scripts/perf/measure.mjs` against `vite preview`):

| Metric | Measured Baseline | Target Budget (Architecture §9) |
|---|---|---|
| Time to First Paint (FP) | **56 ms** | <= 100 ms |
| Time to First Contentful Paint (FCP) | **228 ms** | <= 500 ms |
| Total Startup Navigation | **779 ms** | <= 3000 ms (app cold start) |
| Idle JS Heap Size | **8.58 MB** | <= 50 MB (renderer heap) |
| Post-Benchmark JS Heap Size | **42.01 MB** | <= 200 MB (1K shipping maps) |
| Benchmark Buffer Heap Delta | **+33.42 MB** | Expected for 4 maps in memory |
| Long Tasks (>50 ms) during 50 slider steps | **0** | 0 over 50 ms |
| Total Long Task Duration during slider scrub | **0.0 ms** | 0.0 ms |

---

## 4. F-01 Empirical Proof (Canvas2D Premultiplied Alpha Corruption)

Measured via `npm run test:e2e` (`src/__tests__/e2e/alpha-roundtrip.spec.ts`):

- **Input:** 64x64 RGBA buffer (4,096 pixels) with uniform Alpha ramp from 0 to 255 and distinct pseudo-random R, G, B channels.
- **Round-Trip Path 1 (`putImageData` -> `getImageData`):**
  - Corrupted pixels: **3,059 / 4,096 (74.7%)**
  - Maximum channel delta: **247** (out of 255)
  - Zero-alpha total RGB erasure: **16 pixels** (values completely replaced with 0)
- **Round-Trip Path 2 (`toBlob('image/png')` -> `Image` decode -> `getImageData`):**
  - Corrupted pixels: **3,059 / 4,096 (74.7%)**
  - Maximum channel delta: **247**
- **Conclusion:** Audit finding **F-01 is empirically proven**. Browser Canvas2D cannot be used for byte-exact packed texture I/O (ORM / ORMH maps). A pure-JS PNG codec and WebGL2 non-premultiplied pipeline (scheduled for Phase 4) is required.
