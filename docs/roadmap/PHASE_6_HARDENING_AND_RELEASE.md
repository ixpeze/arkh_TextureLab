# PHASE 6 — Hardening, QA & Release (v1.0.0)

**Goal:** Prove the product is fast, stable, and installable on a clean Windows PC, then ship v1.0.0 with accurate docs.
**Prereqs:** Phases 0-5. **Effort:** M.
**Audit items closed:** F-18, F-33 and final verification of all budgets.

---

## Tasks

| ID | Task | Detail | Acceptance |
|---|---|---|---|
| P6-T1 | **Perf budget enforcement** | `npm run perf` runs the Electron harness on real hardware, compares to `02` §9, writes `docs/roadmap/perf-final.json`, exits non-zero on budget miss. Record machine specs (GPU, RAM, driver). | all budgets pass or owner-approved exceptions listed |
| P6-T2 | **Soak tests** | Script: 200 slider drags, 50 load/unload cycles of 4K textures, 20 save/open cycles, 10 export cycles. Track JS heap, GPU pool bytes, process RSS. | memory returns to within 10% of start; no growth trend over last 10 cycles |
| P6-T3 | **Fault injection** | Force context loss, kill encode worker, throw in decode, delete asset during session, fill disk (small VHD), revoke folder permission. | each yields friendly message + app remains usable (TC-6xx) |
| P6-T4 | **Error boundaries & diagnostics** | Top-level React ErrorBoundary with "Reload UI" + "Copy diagnostics" (versions, GPU renderer string, caps, last 200 log lines, redacted paths). | TC-601 |
| P6-T5 | **Bundle & startup** | Code-split Export Hub, Wizard, Settings (dynamic import); defer GPU shader compile of unused ops until first use; measure startup. Target renderer JS < 350 KB gzip initial. | start <= 3 s |
| P6-T6 | **Installer QA matrix** | Windows 10 22H2 and 11, standard (non-admin) user, username with spaces/unicode, install path with spaces, upgrade-in-place over previous version, uninstall, portable from USB/read-only. Use Windows Sandbox for clean-machine runs. | checklist in evidence log |
| P6-T7 | **Unsigned distribution (D-10: signing is OUT of scope)** | Do not add signing. Instead: (1) README + USER_GUIDE section "Windows says 'unknown publisher'" with the steps *More info -> Run anyway* and why it appears; (2) publish SHA-256 hashes next to the download so users can verify integrity; (3) keep installer metadata (publisher name, product name, version) filled in; (4) avoid AV false-positive triggers (no packers/obfuscators, standard electron-builder NSIS). If the owner ever reverses the decision, signing options/costs are in git history of this file (Azure Artifact Signing ~US$10/mo, USA/Canada individuals only; OV ~US$150-300/yr). | README section present; hashes file produced |
| P6-T8 | **Licenses** | Generate `THIRD_PARTY_LICENSES.txt` (license-checker or electron-builder), include Geist (OFL), Lucide (ISC), @xyflow/react (MIT), Electron (MIT), codec libs. About dialog lists version, commit, GPU. | file shipped inside installer |
| P6-T9 | **Docs** | Rewrite root `README.md` (install, features, troubleshooting, GPU requirements), `docs/USER_GUIDE.md` (Pack Wizard, nodes, export tokens, shortcuts), `docs/MAINTENANCE.md` (architecture pointer, how to add a node = one file, how to build/release, perf harness), `docs/ROADMAP.md` (v1.1: auto-update, EXR/TIFF, command palette, 3D preview). Remove obsolete `setup.bat` flows or mark dev-only. | links valid; steps verified on a clean clone |
| P6-T10 | **Release procedure** | Version bump `1.0.0`, `CHANGELOG.md`, tag `v1.0.0`, `npm run dist`, SHA-256 of both exes into `release/SHA256SUMS.txt`, smoke test installed build, create GitHub Release if remote exists. | artifacts + hashes recorded |
| P6-T11 | **Rename folder** (optional, low risk now): `web-xyflow/` -> `app/`, update scripts/docs/CI. | all commands in `00` §7 still work |
| P6-T12 | **Known-issues list** | `docs/KNOWN_ISSUES.md` with any accepted gaps. | exists |

## Test cases

| ID | Test | Expected |
|---|---|---|
| TC-601 | Throw inside a node body | ErrorBoundary shows; rest of app usable; diagnostics copy works |
| TC-602 | Kill GPU process (`taskkill` Chromium GPU) | recovery overlay -> re-render |
| TC-603 | Disk full during export | error naming the drive; no partial/corrupt file left |
| TC-604 | Export folder deleted mid-export | graceful abort |
| TC-605 | Corrupt `settings.json` | defaults restored, bad file renamed `.bad` |
| TC-606 | Corrupt `recent.json` | ignored |
| TC-610 | Install on clean Win10 | launches without prerequisites |
| TC-611 | Upgrade 0.9 -> 1.0 | settings + recents preserved |
| TC-612 | Portable on read-only | works |
| TC-613 | 3 consecutive launches | no leftover lock/zombie processes |
| TC-620 | 200-slider soak | no memory growth trend |
| TC-621 | 4K load/unload x50 | VRAM pool returns to baseline |
| TC-630 | All P0 test cases in `99_…` | pass |

## Edge cases

- Antivirus holding the exe during update/uninstall.
- System with only integrated GPU: banner + working res 512; correctness still passes; perf documented as best-effort.
- Windows "Reduce motion"/High Contrast/Night light.
- Locale with RTL system language: UI remains LTR (documented non-goal for RTL).
- Very old GPU driver lacking WebGL2 features: dialog with link to driver update guidance.
- First launch offline; firewall prompts must not appear (no network usage).

## Exit criteria (= v1.0.0 Definition of Done in `00` §9)

- [ ] Perf + soak results recorded; budgets satisfied.
- [ ] Installer QA matrix complete.
- [ ] All P0 tests green; lint 0; build green; `npm run dist` reproducible from clean clone.
- [ ] Docs accurate; licenses shipped.
- [ ] v1.0.0 tagged; hashes recorded.
- [ ] Tracker + Handoff notes updated; `KNOWN_ISSUES.md` written.

## Evidence log

```
date / agent / command / output summary
```
