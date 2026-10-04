# PHASE 2 — Electron Shell (first installable .exe)

**Goal:** Wrap the existing app in Electron and produce a working Windows installer + portable exe **early**, so every later phase is verified in the real product. No engine change here (still CPU).
**Prereqs:** Phase 1 exit criteria (registry + hotkeys exist; reserved chords are safe). **Effort:** M.
**Audit items closed:** F-26. Prepares F-25 (native save), F-18.

---

## Scope

IN: Electron main/preload, secure window, `app://` protocol, PlatformService abstraction, native dialogs & menus, window state, single instance, packaging (NSIS + portable), crash handling, e2e smoke test.  
OUT: project files (P3), GPU (P4), code signing (never, D-10), auto-update (deferred to v1.1, D-08).

## Tasks

| ID | Task | Detail | Acceptance |
|---|---|---|---|
| P2-T1 | **Tooling spike (30-60 min, record result in Decision Log).** Try `electron-vite`; if incompatible with the repo's Vite major, use `vite` for renderer + `esbuild`/`tsup` for `desktop/`. | `npm view electron version`, `npm view electron-vite peerDependencies` | Decision logged in `02_TARGET_ARCHITECTURE.md` §12 with the exact versions installed |
| P2-T2 | Create `desktop/main.ts`, `preload.ts`, `ipc.ts`, shared types `src/shared/ipc.ts`. TypeScript project refs: `tsconfig.desktop.json`. | `npm run dev:desktop` opens a window with HMR renderer | window shows the app; devtools available only in dev |
| P2-T3 | **Secure window** per `02` §7: contextIsolation, sandbox, no nodeIntegration, CSP header via `session.webRequest.onHeadersReceived`, deny `setWindowOpenHandler`, block `will-navigate`, deny permission requests. | | e2e TC-210: `window.require` is `undefined`; navigating to https://example.com is blocked |
| P2-T4 | **`app://` protocol** serving `dist/` with correct MIME (js, mjs, css, wasm, ttf, png, svg), path-traversal safe (`path.normalize` + root check), 404 fallback. Register as `standard, secure, supportFetchAPI`. | `desktop/protocol.ts` | Packaged exe: module Worker loads (TC-211), fonts load, no CORS errors |
| P2-T5 | **`PlatformService`** interface in `src/platform/`: `pickImages()`, `pickDirectory()`, `readFile(path)`, `writeFile(path, bytes)`, `showSaveDialog()`, `showOpenDialog()`, `getPathForFile(file)`, `openExternal()`, `userData` get/set JSON, `onMenuCommand(cb)`, `setDirty(bool)`. Two impls: `electronPlatform` (IPC) and `webPlatform` (dev-browser fallback using existing browser APIs). Replace `showDirectoryPicker` usage in `ExportEngine` (`ExportModal.tsx:327-334`) with it. | | grep finds no direct `showDirectoryPicker` outside `webPlatform` |
| P2-T6 | **Drag & drop from Explorer** keeps absolute paths: preload exposes `webUtils.getPathForFile`; renderer stores path with the loaded asset (used later by P3). Verify against current Electron docs (older `File.path` removed). | | TC-213: dropping a file logs its absolute path |
| P2-T7 | **Native menu** File (New/Open/Save/Save As/Recent/Export…/Quit), Edit (Undo/Redo/Cut/Copy/Paste/Duplicate/Select All/Delete), View (Fit/Zoom/Toggle Inspector/Reload dev only), Help (Shortcuts/About/Open Logs Folder). Menu actions -> IPC -> renderer command bus. Accelerators match hotkey table; remove duplicates from `keydown` handler so a chord never fires twice. | | TC-214: Ctrl+S triggers exactly one command |
| P2-T8 | Window management: remember size/position/maximized (`window.json`), min size 1100x680, restore on a monitor that no longer exists (clamp to visible display), single-instance lock, `second-instance` brings window to front and forwards a file-open arg, app id + icon, title `TextureLab — <project>*`. | | TC-215..217 |
| P2-T9 | **GPU & crash handling:** `force_high_performance_gpu` switch, `render-process-gone`/`child-process-gone`/`uncaughtException` handlers -> dialog (Reload / Quit / Open logs), log file `userData/logs/main.log` (rotate 5 x 1 MB). Redact user name in diagnostics. | `desktop/logger.ts` | TC-218: `process.crash()` in renderer shows dialog, Reload recovers |
| P2-T10 | **Packaging.** `electron-builder.yml`: `appId: com.arkh.texturelab`, `productName: TextureLab`, targets `nsis` (oneClick false, perMachine false, allowToChangeInstallationDirectory true, createDesktopShortcut true, deleteAppDataOnUninstall false) + `portable`; `asar: true`; `files` excludes `samples/4k`, `*.map`; `extraResources` includes `samples/1k`; icon `build/icon.ico` (256 px multi-res; generate a clean placeholder, OD-5). Scripts: `npm run dist` -> `release/`. | | `release/TextureLab-Setup-0.2.0.exe` and `TextureLab-0.2.0-portable.exe` exist; sizes <= 120 / 130 MB |
| P2-T11 | **E2E smoke** with `@playwright/test` `_electron.launch`: app starts, window title, canvas present, "Load Benchmark" works (uses 1k samples), Export to a temp dir via native-dialog stub produces files. Add `npm run test:e2e`. | `src/__tests__/e2e/` | all pass locally on Windows |
| P2-T12 | **Clean-machine test:** install on Windows Sandbox (enable "Windows Sandbox" feature) — verify launch without Node/VC++ prerequisites; verify uninstall. Record screenshots only if the owner asks. | | Evidence log: steps + result |
| P2-T13 | Update `setup.bat`/`run_web.bat`: keep as dev helpers; add `run_desktop_dev.bat`. README: "Download installer" section. | | scripts run |

## Test cases

| ID | Test | Expected |
|---|---|---|
| TC-210 | Renderer isolation | no Node globals; `window.lab` exposes only whitelisted functions |
| TC-211 | Packaged app loads module Worker + font + sample | no console errors |
| TC-212 | Path traversal `app://../../Windows/win.ini` | 404 |
| TC-213 | Drop file with spaces + unicode in path | absolute path preserved |
| TC-214 | Menu accelerators | exactly one command per chord |
| TC-215 | Close on secondary monitor, unplug, relaunch | window appears on primary, fully visible |
| TC-216 | Launch second instance with file arg | first instance focuses, receives path |
| TC-217 | Window < min size | clamped |
| TC-218 | Renderer crash | dialog + recovery |
| TC-219 | Install per-user without admin | success, no UAC |
| TC-220 | Portable exe from read-only folder | runs; settings go to userData |
| TC-221 | Uninstall | removes app; keeps user data by default |

## Edge cases

- Username with non-ASCII chars / spaces in `%APPDATA%`.
- Install dir with spaces; path length near 260.
- Antivirus quarantining unsigned exe: document in README (D-10); no packers/obfuscators.
- High-DPI (125/150/200%): window and canvas sharp (`devicePixelRatio`).
- No internet: app has zero network needs (CSP `connect-src 'none'` in prod).
- Hybrid-GPU laptop: verify dedicated GPU used (record `UNMASKED_RENDERER_WEBGL` in log at startup).
- Windows Defender SmartScreen "unknown publisher" on first run (expected until signed).
- OneDrive-redirected Documents folder for default save location.

## Exit criteria

- [ ] `npm run dist` produces NSIS installer + portable exe from a clean clone.
- [ ] Installs/launches on Windows Sandbox with no prerequisites.
- [ ] e2e smoke suite green.
- [ ] No direct browser-only file APIs outside `webPlatform`.
- [ ] Menu + accelerators single-fire.
- [ ] Decision Log updated with tooling versions.
- [ ] Tracker + Handoff notes updated.

## Risks

| Risk | Mitigation |
|---|---|
| Vite 8 / electron-vite incompatibility | P2-T1 spike with fallback |
| Module workers fail from `file://` | `app://` protocol (P2-T4) |
| Installer size creep | exclude samples/maps, asar, check size every build |
| Unsigned exe warnings | documented in README; accepted by owner (D-10) |

## Evidence log

```
date / agent / command / output summary
```
