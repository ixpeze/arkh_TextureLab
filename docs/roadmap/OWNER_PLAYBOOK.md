# OWNER PLAYBOOK — how to drive the agents (for the Product Owner)

You do not need to understand the code. Your job: **start one agent per phase, give it the prompt, check the result, say "go" to the next phase.**

---

## 0. Ground rules (read once)

1. **One phase = one new chat/session.** Never mix phases. Long chats make agents forget.
2. **Always start the agent with the prompt template below** (it forces them to read the docs first).
3. **Do not skip phases.** Order is deliberate: Phase 2 gives you a real `.exe` early; later phases are tested inside it.
4. **Use `/goal`** at the start of the prompt for big phases (1, 4, 5): the agent keeps going until the exit criteria are met.
5. **Never paste passwords/tokens in chat.** Git pushes use your saved Windows/GitHub login.
6. **After each phase, run the "Owner check" (1-3 minutes).** If it fails, send the failure back to the same agent; do not start the next phase.
7. **Commit safety:** every phase ends with commits on `main` (small, labeled). If anything looks wrong you can always go back to tag `pre-roadmap-baseline`.
8. Logo: **later**. Placeholder icon is generated in Phase 2. When ready, drop `build/icon-source.png` (square, **1024x1024**, transparent PNG) in the repo and use the Logo prompt in §4.

## 1. Master prompt template (copy, replace `N`)

```
/goal
Read, in order: docs/roadmap/00_README_START_HERE.md, 01_AUDIT_REPORT.md,
02_TARGET_ARCHITECTURE.md, then docs/roadmap/PHASE_N_*.md (the one for Phase N).
Execute ONLY Phase N. Follow every rule in 00_README_START_HERE.md section 6.
Prove each task with the commands in its Acceptance column and paste results into
the phase file's "Evidence log". Do not start the next phase. At the end:
tick the Exit criteria, update the Status tracker and Handoff notes in
00_README_START_HERE.md, commit with Conventional Commit messages, and give me a
5-line plain-language summary plus anything you need me to decide or test.
Ask me before any product/UX decision. Windows + PowerShell.
```

## 2. One-time preparation (before Phase 0) — 10 minutes

| Do | Why | How to check |
|---|---|---|
| Install **Git for Windows**, **Node.js 20+ LTS** (22+ best), **Python 3.10+** (for `git-filter-repo`), **Git LFS** | Phase 0 needs them | PowerShell: `git --version; node -v; python --version; git lfs version` |
| Be logged in to GitHub on this PC (Git Credential Manager) | Phase 0 force-push | `git ls-remote https://github.com/ixpeze/arkh_TextureLab.git` works without asking a password |
| Close other editors/terminals using the repo | Phase 0 moves folders | — |
| Free disk space >= 5 GB | backup mirror + builds | — |
| Know your PC: GPU model, RAM | Phase 4/6 perf tests | Task Manager > Performance |

## 3. Phase-by-phase: say this, provide this, expect this

### Phase 0 — Baseline & Hygiene (about 1 day)
- **You provide:** nothing except the preparation above. Confirm "yes, run the history purge" when the agent asks right before P0-T12.
- **Say:** master prompt with `N=0`.
- **Expect to see:** build folder shrinks from 208 MB to under 5 MB; app opens **empty** (no 4K auto-load); new files `docs/roadmap/BASELINE_METRICS.md`, `perf-baseline.json`; a safety backup folder `arkh_TextureLab_backup.git` next to your project; GitHub repo history purged (clone size ~tens of MB, not 363 MB).
- **Owner check:** (1) run `run_web.bat` — app opens fast and empty; click the Benchmark button — textures load. (2) Check the backup folder exists. (3) Ask: "Show me the Phase 0 exit criteria with evidence."
- **Heads-up:** after the purge the agent re-clones the repo into the same path. Don't be alarmed; your old folder is kept aside until you delete it.

### Phase 1 — Correctness & Refactor (about 4-8 days)
- **You provide:** nothing. Answer UX questions (rare).
- **Say:** master prompt `N=1` (use `/goal`).
- **Expect:** app **looks the same** but is more reliable: stale-preview bug fixed, Ctrl+S/other shortcuts no longer spawn nodes, duplicate/delete behave correctly, export no longer squashes non-square textures, the fake 16-bit option is hidden, README is truthful. Behind the scenes: one-file-per-node structure, no giant files.
- **Owner check:** open the app; try Math node values, Resize size, duplicate two connected nodes (wires come along), export a non-square texture. Ask: "Show test counts before/after."
- **Not expected:** speed gains yet (that is Phase 4).

### Phase 2 — Electron Shell: your first `.exe` (about 2-4 days)
- **You provide:** nothing (placeholder icon is generated; your logo comes later).
- **Say:** master prompt `N=2`.
- **Expect:** `release/TextureLab-Setup-0.2.0.exe` (installer) and a portable `.exe`. Native window with File/Edit/View/Help menu, native open/save dialogs, window remembers size/position. Same CPU engine, so still not fast.
- **Owner check (important):** (1) double-click the installer, install, launch from Start menu. (2) Drag a texture in from Explorer. (3) Export textures to a folder. (4) Windows may show "Windows protected your PC" — click **More info -> Run anyway** (expected, unsigned by choice).
- **Optional:** ask the agent to test in **Windows Sandbox** (clean PC simulation).

### Phase 3 — Project Files & State (about 2-4 days)
- **You provide:** nothing.
- **Say:** master prompt `N=3`.
- **Expect:** **Save / Save As / Open / Recent**, `.tlab` project files (double-click opens the app), title shows `*` when unsaved, "Save changes?" prompt on close, **autosave + crash recovery**, Copy/Paste nodes, undo that treats a whole drag/slider scrub as one step.
- **Owner check:** build a graph, save, close, reopen. Edit, kill the app from Task Manager, relaunch: it offers recovery. Move the project folder: textures still found (or "Relink" dialog appears).

### Phase 4 — GPU Engine (about 8-15 days; the big one)
- **You provide:** run the perf test **on your own PC** (the agent will tell you the command; it needs your real GPU). Tell the agent your GPU model and RAM.
- **Say:** master prompt `N=4` (use `/goal`). It may split into sub-phases 4A-4E across several sessions — that is fine; say "continue with 4B" etc., always telling it to re-read the Phase 4 doc and Evidence log.
- **Expect:** the **lag disappears**: sliders feel instant on 4K (a 1K preview while dragging, sharp 4K after you release), RAM stays low, export runs in the background with progress/cancel, **16-bit export works**, packed textures are byte-exact (no alpha corruption), an on-screen performance HUD (`?perf=1`) for the agent/you.
- **Owner check:** load several 4K maps, drag Levels/Blend sliders rapidly (should be smooth), pan/zoom with 40+ nodes, export an ORMH and open it in your usual tool to confirm channels look right. Check Task Manager memory.
- **If a problem appears:** copy the in-app "Copy diagnostics" or the log file path and send it to the agent.

### Phase 5 — UI/UX Redesign (about 4-8 days)
- **You provide:** **approve the look first.** The agent will show the palette/layout plan (warm graphite + amber accent). Say "approved" or tell it what to change. Screenshots only if you ask for them.
- **Say:** master prompt `N=5` (use `/goal`).
- **Expect:** docked layout (Library left, Inspector right, status bar), readable text (>= 11 px), cleaner nodes and wires, **empty-state welcome**, **Pack Wizard** (drop a folder -> auto-detects AO/Roughness/Metallic/Height -> builds ORM/ORMH), Compare and Seam Check become viewer tools, Settings dialog (preview quality, etc.), keyboard accessibility.
- **Owner check:** launch fresh: welcome screen, drop your real texture folder on the Pack Wizard, export. Try the window at small size and your display scaling.

### Phase 6 — Hardening & Release (about 2-4 days)
- **You provide:** **a test PC if possible** (any second Windows PC/laptop, ideally Windows 10) and your final logo if ready (see §4). Run the final perf check on your RTX-class machine.
- **Say:** master prompt `N=6`.
- **Expect:** performance budgets verified and recorded, stress/soak tests, crash-safe error screens, license file, final README + User Guide, `CHANGELOG.md`, version **1.0.0**, tag `v1.0.0`, SHA-256 hash file, `release/TextureLab-Setup-1.0.0.exe` + portable.
- **Owner check:** install on the second PC; use the app for real work for a day; report anything odd to the agent (it logs it into `docs/KNOWN_ISSUES.md` or fixes it).
- **Publish (optional):** the agent can create a GitHub Release with the two exes and the hash file.

## 4. Logo (whenever ready)

Put a square **1024x1024 transparent PNG** at `build/icon-source.png`, then tell any agent:

```
Read docs/roadmap/PHASE_2_ELECTRON_SHELL.md task P2-T10 and 00_README_START_HERE.md decision OD-5.
Replace the placeholder icon with build/icon-source.png: generate build/icon.ico
(16,24,32,48,64,128,256 px layers), update favicon, window icon, installer icon and
the About dialog. Verify with `npm run dist` and confirm the installed exe shows the
new icon. Commit with "chore(brand): add app icon".
```

## 5. If something goes wrong

| Situation | Say to the agent |
|---|---|
| Agent stopped halfway | "Continue Phase N. Re-read the phase doc and its Evidence log, then resume at the first unticked task." |
| Something broke after a phase | "Run npm test, npm run lint, npm run build, show me the failures, fix the root cause, add a test, then re-verify." |
| You dislike a UX result | "Give me Option A / Option B for this screen with pros/cons. Do not implement until I choose." |
| You want to check progress | "Show the Status tracker and the unticked Exit criteria for the current phase." |
| Scared of data loss | "Show `git log --oneline -n 15` and confirm tag pre-roadmap-baseline and the backup mirror exist." |
| New idea mid-way | "Add this to docs/roadmap/IDEAS.md under 'Could-have v2'. Do not build it now." |

## 6. Total timeline (focused agent work, rough)

| Milestone | Cumulative |
|---|---|
| Phase 0-1 done (clean, correct code) | ~1-2 weeks |
| Phase 2 done (**first installable exe**) | ~2-3 weeks |
| Phase 3 done (save/open) | ~3-4 weeks |
| Phase 4 done (**fast**) | ~5-7 weeks |
| Phase 5-6 done (**polished v1.0.0**) | ~7-10 weeks |

Estimates assume the agent isn't blocked waiting for you; slow answers add calendar time, not work time.
