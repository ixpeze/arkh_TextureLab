# ARKH TextureLab — Product Roadmap (START HERE)

> **Audience:** future AI agents (and the product owner).  
> **Owner profile:** Product Owner, non-architect. Wants a **polished, fast, single Windows `.exe`**.  
> **Written:** 2026-10-04 after a full code audit. All numbers below were measured on the real repo unless marked *(estimate)*.

---

## 1. Mission

Turn the current Vite/React web prototype into a **finished Windows desktop product**:

| Goal | Concrete target |
|---|---|
| Delivery | One `TextureLab-Setup-x.y.z.exe` (installer) + one portable `.exe`. No Node.js, no terminal. |
| Speed | 4K textures edited with **no UI lag** on RTX 3050-class GPU / 8 GB RAM. |
| Features | Keep every main feature (pack/unpack, nodes, inspector, export hub, naming tokens). |
| Polish | Cohesive design system, readable type (>= 11 px), docked layout, project save/load. |
| Reliability | Crash recovery, autosave, no silent data corruption, honest UI (no fake options). |

## 2. Plain-language architecture (for the owner)

| Term | Analogy |
|---|---|
| **Electron** | A private browser wearing an `.exe` costume. Your app runs inside it; users never see a browser. |
| **GPU engine (WebGL2)** | Today a single worker paints a 4K image pixel by pixel (16 million). A GPU paints thousands of pixels at the same instant. |
| **Node registry** | One "catalog card" per node (name, sockets, settings, how it computes). Today that knowledge is scattered across ~10 files. |
| **Project file `.tlab`** | A save game. Today closing the window loses everything. |
| **Proxy / working resolution** | While you drag a slider the app computes a 1K preview (instant), then sharpens to 4K when you let go. |

## 3. Locked decisions (owner-confirmed 2026-10-04)

| ID | Decision | Source |
|---|---|---|
| D-01 | Package with **Electron** (NSIS installer + portable exe). | Owner Q1 |
| D-02 | **GPU-first** pixel engine (WebGL2). Min GPU floor = **RTX 3050-class**. Integrated GPUs: best-effort via auto-downshift. | Owner Q2 |
| D-03 | Target **4K textures**, **8 GB RAM**. 8K loads with a warning + low-res preview; export of 8K is allowed only if GPU limits permit. | Owner Q3 |
| D-04 | **Keep:** Upscale node; all 13 Math nodes as separate user-facing nodes (one shared implementation internally). | Owner Q4 |
| D-05 | **Demote/merge** (not selected by owner): Batch pipeline nodes (LoadFolder/ForEach/BatchExport) -> hidden "Labs" category (the Export Hub already does batch export). Compare -> viewer A/B tool. Seam Check -> viewer tiling toggle. Comment boxes -> kept, zero new investment. | Owner Q4 + audit |
| D-06 | Windows only for now (10 22H2+ / 11, x64). Code must not block a later macOS/Linux build. | Owner brief |
| D-07 | **Git history WILL be purged of the big sample PNGs and force-pushed** (see Phase 0 task P0-T12 for the mandatory safe procedure). | Owner, 2026-10-04 (was OD-1) |
| D-08 | Auto-update is **deferred to v1.1** (not in v1.0). | Owner, 2026-10-04 (was OD-3) |
| D-09 | EXR / TIFF import-export is **deferred to v1.1** (v1.0 shows a clear "not supported yet" message). | Owner, 2026-10-04 (was OD-4) |
| D-10 | **No code signing. Ship free/unsigned.** README must explain the Windows SmartScreen "More info -> Run anyway" step. Do not add signing config, secrets, or certificate steps. | Owner, 2026-10-04 (was OD-2) |

> **NOTE FOR FUTURE AGENTS — history rewrite is APPROVED but DESTRUCTIVE.** Do it exactly once, early (Phase 0), following P0-T12: mirror backup first, `git filter-repo`, verify, then `git push --force-with-lease`. Afterwards every other clone/branch must be re-cloned. Never repeat it without a fresh owner approval.

### Open owner decisions (agents must ASK before acting)

| ID | Question | Default if owner is silent |
|---|---|---|
| OD-5 | Final logo/icon art. **Owner will supply later** as `build/icon-source.png` (1024x1024 transparent PNG). Until then use a clean placeholder; product name stays "TextureLab". Replacement procedure: see `OWNER_PLAYBOOK.md` §4. | Placeholder icon. |

## 4. Phase map

Phases are ordered so that **a runnable `.exe` exists after Phase 2** and every later phase is tested inside the real app.

| Phase | Document | Outcome | Est. effort* |
|---|---|---|---|
| 0 | [PHASE_0_BASELINE_AND_HYGIENE.md](PHASE_0_BASELINE_AND_HYGIENE.md) | Repo diet (208 MB -> ~1 MB build), baseline metrics, golden test oracle | S |
| 1 | [PHASE_1_CORRECTNESS_AND_REFACTOR.md](PHASE_1_CORRECTNESS_AND_REFACTOR.md) | Real bugs fixed, node registry, no God-files, no `any` in core | L |
| 2 | [PHASE_2_ELECTRON_SHELL.md](PHASE_2_ELECTRON_SHELL.md) | First installable `.exe` (walking skeleton), native dialogs/menus | M |
| 3 | [PHASE_3_PROJECT_FILES_AND_STATE.md](PHASE_3_PROJECT_FILES_AND_STATE.md) | Save/Open/Autosave, state store, patch-based undo, copy/paste | M |
| 4 | [PHASE_4_GPU_ENGINE.md](PHASE_4_GPU_ENGINE.md) | WebGL2 engine, caching scheduler, exact I/O, async export | XL |
| 5 | [PHASE_5_UI_UX_REDESIGN.md](PHASE_5_UI_UX_REDESIGN.md) | Design system "Graphite Blueprint", docked layout, Pack Wizard | L |
| 6 | [PHASE_6_HARDENING_AND_RELEASE.md](PHASE_6_HARDENING_AND_RELEASE.md) | Perf budgets enforced, soak tests, installer QA, docs, v1.0.0 | M |

\*S <= 1 day, M = 2-4 days, L = 4-8 days, XL = 8-15 days of focused agent work.

Owner guide (non-technical): [OWNER_PLAYBOOK.md](OWNER_PLAYBOOK.md) — copy-paste prompts per phase, what to expect, how to check.

Supporting documents:
- [01_AUDIT_REPORT.md](01_AUDIT_REPORT.md) — every finding with evidence (IDs `F-xx`).
- [02_TARGET_ARCHITECTURE.md](02_TARGET_ARCHITECTURE.md) — folder layout, data flow, GPU design, `.tlab` spec, budgets.
- [99_TEST_MATRIX_AND_EDGE_CASES.md](99_TEST_MATRIX_AND_EDGE_CASES.md) — consolidated test + edge-case catalogue (IDs `TC-xxx`).
- Older spec for reference: [../specs/2026-10-03-global-export-and-output-node-design.md](../specs/2026-10-03-global-export-and-output-node-design.md)

## 5. Status tracker (agents: update at the end of every phase)

| Phase | Status | Date | Agent / Notes |
|---|---|---|---|
| 0 | NOT STARTED | | |
| 1 | NOT STARTED | | |
| 2 | NOT STARTED | | |
| 3 | NOT STARTED | | |
| 4 | NOT STARTED | | |
| 5 | NOT STARTED | | |
| 6 | NOT STARTED | | |

## 6. Rules every agent must follow

1. **Read in order:** this file -> `01_AUDIT_REPORT.md` -> `02_TARGET_ARCHITECTURE.md` -> the current phase doc. Do not skip.
2. **One phase at a time.** Do not start Phase N+1 until Phase N exit criteria are all ticked.
3. **Prove, don't claim.** A task is done only when its acceptance command was *run* and its output recorded in the phase doc's "Evidence log". No "probably works".
4. **Tests first for bug fixes.** Write the failing test, then fix (see Phase 1).
5. **Never regress the baseline:** `npm test`, `npm run lint`, `npm run build` must stay green at every commit (`cd web-xyflow`).
6. **Small commits** with Conventional Commit messages: `fix(eval): ...`, `feat(gpu): ...`, `chore(repo): ...`.
7. **No emoji in product UI.** Use Lucide SVG icons. (Docs may use none either.)
8. **Don't take product decisions.** UX forks and scope changes go to the owner as Option A / Option B.
9. **Windows shell = PowerShell.** Chain with `;`, not `&&`.
10. **Never commit secrets, certificates, or tokens.** Signing keys go in CI secrets only.
11. **Keep docs truthful.** If you change behavior, update README/USER_GUIDE in the same commit. (The current README contains claims that are false — see audit F-03.)
12. **Handoff protocol:** at phase end, fill in "Evidence log", tick exit criteria, update the tracker above, add a dated line to "Handoff notes".

## 7. Standard verification commands

```powershell
cd g:\AI\_ARKH_LAB\arkh_TextureLab\web-xyflow
npm test                 # vitest unit + golden tests
npm run lint             # oxlint (must be 0 warnings, 0 errors)
npm run build            # tsc -b && vite build
# Added in later phases:
npm run test:gpu         # Phase 4: GPU-vs-CPU oracle in headless Chromium
npm run test:e2e         # Phase 2+: Playwright-Electron smoke tests
npm run perf             # Phase 0/6: perf & memory harness
npm run dist             # Phase 2+: builds installer + portable exe into /release
```

## 8. Global non-goals (do NOT build)

macOS/Linux installers, cloud sync, accounts, telemetry/analytics, AI upscaling, multi-user, plugin SDK, light theme, localization, mobile layout. (Revisit only via owner.)

## 9. Definition of Done — v1.0.0

- [ ] `release/TextureLab-Setup-1.0.0.exe` installs without admin rights on a clean Windows 10 and 11 (Windows Sandbox verified).
- [ ] App starts in <= 3 s, empty project, < 350 MB RAM idle.
- [ ] All budgets in `02_TARGET_ARCHITECTURE.md` §9 pass on an RTX 3050-class machine.
- [ ] Every `TC-xxx` marked "P0" in the test matrix passes.
- [ ] Save / Open / Autosave / Crash-recovery work; no data loss when killing the process mid-save.
- [ ] Exported ORM/ORMH textures are **byte-exact** (channel values survive alpha) — see audit F-01.
- [ ] README/USER_GUIDE/MAINTENANCE are accurate and the build runs from a clean clone.

## 10. Handoff notes (append newest last)

- 2026-10-04 — Roadmap authored. No code changed by the audit. Baseline: 17/17 tests pass, lint clean, build OK, `dist/` = 208.6 MB (JS only 0.67 MB).
- 2026-10-04 (later) - Owner answers recorded: Electron + GPU-first confirmed; git history purge + force-push APPROVED (D-07, Phase 0 P0-T12); auto-update and EXR/TIFF deferred to v1.1 (D-08, D-09); code signing (OD-2) still open - cost facts in Phase 6 P6-T7.
- 2026-10-04 (final) - Owner decided: NO code signing, ship free/unsigned (D-10). All open owner decisions are resolved except OD-5 (final icon/name; default = placeholder). Phase 0 is ready to start.
