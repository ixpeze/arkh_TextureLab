# PHASE 0 — Baseline & Hygiene

**Goal:** Make the repo small, measurable, and safe to refactor. Prove the audit's two biggest claims (build weight, premultiplied-alpha corruption) with commands, and freeze the CURRENT CPU behavior as a "golden oracle" for later GPU work.
**Prereqs:** none. **Effort:** S. **Touches:** repo layout, `public/`, `App.tsx` (startup only), tests, scripts.
**Audit items closed:** F-07, F-08, F-31 (partly), F-32, F-33; proves F-01.

---

## Scope

IN: asset diet, startup behavior, metrics harness, golden fixtures, lint tightening, optional CI.  
OUT: any engine rewrite, UI change, Electron.

## Tasks

| ID | Task | Files | Acceptance (run & record) |
|---|---|---|---|
| P0-T1 | Tag baseline: `git tag pre-roadmap-baseline`. Create `docs/roadmap/BASELINE_METRICS.md` with: test count, lint result, JS bundle size, `dist/` size (208.6 MB), startup RSS/heap (see T6). | docs | file exists, numbers pasted from real commands |
| P0-T2 | **Asset diet.** Move dev samples out of the Vite `public/` tree: `web-xyflow/public/sample_textures/` -> `samples/4k/` (repo root, dev-only). Update `BENCHMARK_MAPS` URLs to load via a dev-only path (Vite `server.fs.allow` + `/@fs/` or a `samples` alias) so **production builds contain no samples**. Generate `samples/1k/` (downscaled copies of the 7 maps, total <= 6 MB) for shipping. | `web-xyflow/public/`, `App.tsx:77-110`, `vite.config.ts`, `samples/` | `npm run build; (Get-ChildItem dist -Recurse -File \| Measure-Object Length -Sum).Sum/1MB` **< 5** |
| P0-T3 | Stop tracking big files going forward: `git rm --cached` the root `sample_textures/` big PNGs and `web-xyflow/public/sample_textures/`; add `samples/4k/` and `sample_textures/` to `.gitignore`; keep `samples/1k/` tracked (small). History purge is a separate, explicit step: **P0-T12**. | `.gitignore`, `.gitattributes` | `git ls-files \| % { (Get-Item $_).Length } \| Measure -Sum` drops by > 300 MB; `git status` clean |
| P0-T4 | **Remove auto-load of the 4K benchmark at startup.** Delete the mount `useEffect` that calls `loadBenchmarkTextures` (`App.tsx:427-438`). Keep the explicit top-bar "Load Anthracite Concrete (Benchmark)" button (uses `samples/4k` in dev, `samples/1k` in prod). | `App.tsx` | App opens with empty source slots; heap at idle drops (T6) |
| P0-T5 | Delete dead template assets after proving unused: `src/assets/hero.png`, `react.svg`, `vite.svg`, `public/icons.svg`; delete duplicate `assets/fonts/` (keep `web-xyflow/public/fonts`). | various | `grep_search` shows 0 references before deletion; build + tests green after |
| P0-T6 | **Metrics harness** `web-xyflow/scripts/perf/measure.mjs` (Playwright, Chromium): opens `vite preview`, records (a) time to first paint, (b) `performance.memory.usedJSHeapSize` idle, (c) after loading benchmark, (d) long-task count/duration while dragging a Levels slider programmatically 50 steps. Output JSON to `docs/roadmap/perf-baseline.json`. Add `npm run perf`. | `scripts/perf/`, `package.json` | `npm run perf` prints a JSON table; commit baseline JSON |
| P0-T7 | **Prove F-01** with a Chromium test (Playwright): create 64x64 RGBA with `A = 0..255` ramp and distinct `R,G,B`; `putImageData` -> `getImageData` (and `toBlob` -> decode). Assert how many pixels differ. Expect failures where `A < 255`. Record counts in BASELINE_METRICS. Mark test `test.fail`-style/xfail until Phase 4 replaces the path. | `src/__tests__/e2e/alpha-roundtrip.spec.ts` | Report shows N differing pixels (> 0) = bug proven |
| P0-T8 | **Golden oracle fixtures.** For every `PixelEngine` op (combine, split/coerce, mix, math x13 ops, levels, invert, normalFlip, normalize, blend x7 modes, normalBlend RNM, resize modes, seam, compare), generate deterministic 16x16 and 64x48 inputs in code (seeded PRNG), run the CURRENT CPU engine, and store outputs as `src/__tests__/golden/<op>.json` (base64 of RGBA bytes + params). Add a test that re-runs CPU and asserts equality. | `src/__tests__/golden/`, new `golden.test.ts` | `npm test` shows >= 40 golden cases passing |
| P0-T9 | Lint tightening: enable `no-explicit-any` as **warn**, record count in BASELINE_METRICS (target: 0 in `engine/`, `nodes/` by end of Phase 1). Add `max-lines` 400 as warn. | `.oxlintrc.json` | `npm run lint` prints counts |
| P0-T10 | (Optional, if repo has a GitHub remote — check `git remote -v`, never print tokens) `.github/workflows/ci.yml` on `windows-latest`: `npm ci; npm run lint; npm test; npm run build`. | `.github/workflows/ci.yml` | first run green |
| P0-T11 | Rename `package.json` `name` -> `arkh-texturelab`, `version` -> `0.1.0`; replace template `web-xyflow/README.md` with a 10-line pointer to the root README + docs/roadmap. | package.json, README | build green |
| P0-T12 | **Purge big sample PNGs from git history and force-push (OWNER-APPROVED, decision D-07; destructive; do ONCE, after T2-T5 are committed and green).** Procedure below. Remote: `https://github.com/ixpeze/arkh_TextureLab.git`, branch `main`. Baseline: `.git` ~363 MB on disk (`git count-objects -vH` reports 245 MiB loose). | git history | `.git` size < 30 MB; `git log` still shows all commits; app builds from a fresh clone; tag `pre-roadmap-baseline` preserved |

### P0-T12 mandatory safe procedure

1. **Confirm no one else has unpushed work:** `git fetch; git status -sb; git log origin/main..main` (must be empty or pushed first).
2. **Backup mirror (keep until Phase 6 ends):** `git clone --mirror https://github.com/ixpeze/arkh_TextureLab.git ..\arkh_TextureLab_backup.git` — outside the workspace; do NOT delete.
3. **Install tool:** `pip install git-filter-repo` (verify with `git filter-repo --version`). Work in a **fresh clone** (`git clone <url> ..\arkh_TextureLab_purge`) because filter-repo refuses non-fresh clones.
4. **List what to remove** (confirm with `git rev-list --objects --all | git cat-file --batch-check='%(objecttype) %(objectname) %(objectsize) %(rest)' | sort -k3 -n -r | head -30`; use PowerShell equivalent). Expected paths: `sample_textures/**`, `web-xyflow/public/sample_textures/**` (all big PNGs incl. the LFS-tracked Gloss file and `Linear/`, `T_Anthracite_Concrete_*`). Keep `samples/1k/` (added in P0-T2) — it is a *new* path, unaffected.
5. **Run:** `git filter-repo --invert-paths --path sample_textures --path web-xyflow/public/sample_textures --force` (add other paths found in step 4). If LFS pointers existed, also drop the LFS tracking line for Gloss in `.gitattributes` in a normal commit afterwards.
6. **Verify in the purge clone:** `.git` size, `git log --oneline | measure` equals the original commit count, `cd web-xyflow; npm ci; npm test; npm run build` all green, `git tag` shows `pre-roadmap-baseline` (filter-repo rewrites tag to new hash — re-create it if missing).
7. **Re-add remote and push** (filter-repo removes `origin` as a safety): `git remote add origin https://github.com/ixpeze/arkh_TextureLab.git; git push --force-with-lease origin main; git push --force origin --tags`. **Never put a token in the URL**; rely on the credential manager. Verify with `git remote -v`.
8. **Replace the working clone:** move the old `arkh_TextureLab` folder aside (do not delete yet), clone fresh to the original path, re-copy any untracked local-only dev samples (`samples/4k/`) back in.
9. **GitHub-side cleanup:** old objects stay reachable on GitHub via cached views/forks until garbage-collected; if the owner wants them gone entirely, open a GitHub Support request to run GC (note this in the evidence log; not required for functionality).
10. Record in Evidence log: before/after sizes, commit counts, backup path, push output (redacted).

> Abort conditions: commit count differs, build fails in the purge clone, or the backup mirror is missing. Do not push in those cases; report to the owner.

## Test cases

| ID | Test | Expected |
|---|---|---|
| TC-001 | Production build size | `dist/` < 5 MB (excluding nothing; fonts included < 1 MB) |
| TC-002 | Fresh start, no texture loaded | App renders, no network requests for `/sample_textures/*` (check dev-tools network or Playwright `page.on('request')`) |
| TC-003 | Click "Load Benchmark" | 4 inputs populate; graph evaluates; no console errors |
| TC-004 | Alpha round-trip (xfail) | Proves differing pixels > 0 |
| TC-005 | Golden suite | all CPU golden cases equal stored fixtures |
| TC-006 | `npm test`, `lint`, `build` | green |

## Edge cases to handle

- `Get-ChildItem` on paths with spaces (sample names contain spaces).
- LFS pointer files: the Gloss PNG is an LFS object; verify `git lfs ls-files` before moving; moving must preserve LFS tracking (`.gitattributes` path pattern update).
- Windows long paths / file locks while deleting `node_modules`-adjacent folders.
- Golden fixtures must be deterministic (no `Math.random`, no Date).

## Exit criteria

- [ ] `dist/` < 5 MB, recorded in BASELINE_METRICS.
- [ ] App launches without loading any 4K data.
- [ ] `perf-baseline.json` committed.
- [ ] TC-004 proves F-01 (or documents that it could not be reproduced, with data).
- [ ] >= 40 golden CPU cases committed.
- [ ] `npm test`, `npm run lint`, `npm run build` green.
- [ ] Status tracker + Handoff notes updated in `00_README_START_HERE.md`.

## Risks

| Risk | Mitigation |
|---|---|
| Moving samples breaks the benchmark button | Task T4 + TC-003 |
| History purge breaks clones / loses work | Approved (D-07); mirror backup first; fresh-clone filter-repo; abort conditions in P0-T12 |

## Evidence log (agents fill in)

```
date / agent / command / output summary
```
