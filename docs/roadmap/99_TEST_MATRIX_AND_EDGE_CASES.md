# 99 — Consolidated Test Matrix & Edge-Case Catalogue

Priority: **P0** = release blocker, **P1** = should pass for v1.0, **P2** = nice to have.  
Automation: **U** = unit (vitest), **G** = GPU/golden (headless Chromium), **E** = e2e (Playwright-Electron), **M** = manual checklist.  
Phase-specific tests with fuller steps are in each phase doc; this file is the single checklist for release sign-off.

## A. Files & decoding (Phase 4B)

| ID | Pri | Auto | Scenario | Expected |
|---|---|---|---|---|
| TC-004 | P0 | E | RGBA bytes survive load->GPU->readback->encode->decode for all 256 alpha levels | identical bytes |
| TC-420 | P0 | G | PNG 8-bit RGBA | exact |
| TC-421 | P0 | G | PNG 16-bit | loads; 8-bit mode rounds; HP mode exact |
| TC-422 | P0 | U | PNG palette/gray/gray+alpha/interlaced/tRNS | correct RGBA |
| TC-423 | P0 | G | PNG with gAMA/iCCP/sRGB chunks | no change to values |
| TC-424 | P1 | U | CMYK JPEG | friendly message or converted with notice |
| TC-425 | P1 | U | JPEG EXIF orientation 1-8 | consistent, documented |
| TC-426 | P0 | U | TGA RLE/uncompressed, 4 origins, 24/32-bit | correct |
| TC-427 | P0 | U | 0-byte, truncated, wrong extension, renamed text file | friendly error, no crash |
| TC-428 | P1 | G | 16384² | rejected with message |
| TC-429 | P0 | G | 8192² | loads with warning, preview at working res |
| TC-430 | P0 | G | 1x1, 2x3, 4097x1, 1920x1080, 4096x2048 | works |
| TC-431 | P1 | U | Filename with spaces, unicode, emoji, `#`, `%` | loads |
| TC-432 | P1 | M | File on network share/OneDrive placeholder | timeout + message |
| TC-433 | P1 | U | `.exr`/`.tif` dropped (unsupported in v1) | message "not supported in v1.0" |
| TC-434 | P0 | E | After loading 7 x 4K, JS heap growth < 150 MB | pass |

## B. Graph & nodes (Phases 1, 4C, 4D)

| ID | Pri | Auto | Scenario | Expected |
|---|---|---|---|---|
| TC-101..108 | P0 | U | param-change vs hash matrix | per phase 1 |
| TC-120..123 | P0 | U | duplicate/delete correctness, unique ids | per phase 1 |
| TC-130..134 | P0 | U/G | resolution policy | per phase 1 |
| TC-140..142 | P0 | U | registry integrity | per phase 1 |
| TC-150 | P0 | U | Self-connection | rejected with reason |
| TC-151 | P0 | U | Cycle A->B->C->A | rejected |
| TC-152 | P0 | U | Duplicate wire | rejected |
| TC-153 | P0 | U | Connect second wire into occupied input | replaces old |
| TC-154 | P1 | U | Fan-out one output to 10 inputs | all update |
| TC-155 | P0 | U | Output node with no input | disabled in export preflight |
| TC-156 | P1 | U | Orphan nodes | not evaluated (0 passes) |
| TC-157 | P1 | U | 500-node graph compile | < 10 ms |
| TC-158 | P0 | U | Bypass every node type | pass-through of first input; no crash |
| TC-159 | P1 | U | Unknown node type from file | "Missing node" placeholder |
| TC-160 | P0 | G | Levels black=white | defined output, no NaN |
| TC-161 | P0 | G | Levels gamma 0, negative, 99 | clamped |
| TC-162 | P0 | G | Divide by 0 | 0 (documented), no NaN |
| TC-163 | P0 | G | Power negative base, huge exponent | 0 or clamped |
| TC-164 | P0 | U | Text field with `NaN`, `Infinity`, empty, `1e999`, `--5`, `1,5` | clamped/parsed; no crash |
| TC-165 | P1 | G | NormalFlip on non-normal map | flips G only; no error |
| TC-166 | P0 | G | Combiner with unconnected inputs | fallbacks used |
| TC-167 | P0 | G | Mixed bit depth/res inputs | policy applied |
| TC-168 | P1 | G | Upscale 4x on 4K (16K output) | tiles/limits -> message or capped; no GPU crash |
| TC-169 | P1 | G | Resize all modes preserve/pad/crop/stretch, POT up/down/nearest | exact dims |

## C. GPU & performance (Phase 4, 6)

| ID | Pri | Auto | Scenario | Expected |
|---|---|---|---|---|
| TC-401 | P0 | E | WebGL2 missing | blocking dialog |
| TC-402 | P0 | E | Context lost/restored | recovers |
| TC-403 | P1 | E | SwiftShader detected | banner + 512 res |
| TC-405 | P0 | U | Pool over budget | LRU eviction, viewed node safe |
| TC-450..462 | P0 | G | caching/dirty/cancel behavior | per phase 4 |
| TC-463 | P0 | E | refine <= 200 ms | pass |
| TC-470 | P0 | M | Slider drag at 4K, 20 nodes | >= 55 fps, no long task > 50 ms |
| TC-471 | P0 | M | Pan/zoom 60 nodes | >= 55 fps |
| TC-472 | P1 | M | Integrated GPU laptop | works; auto-downshift; no freeze |
| TC-620/621 | P0 | E | soak | no leak |
| TC-690 | P1 | M | Remote Desktop / no GPU | software banner, usable at 512 |

## D. Export (Phases 1, 4E)

| ID | Pri | Auto | Scenario | Expected |
|---|---|---|---|---|
| TC-125..128 | P0 | U | aspect-preserving resize; no fake 16b | per phase 1 |
| TC-440 | P0 | E | ORMH 4K PNG exact | hash equal |
| TC-441 | P1 | E | JPG/WebP with alpha | warning shown |
| TC-442 | P0 | U | Illegal filename chars `<>:"/\|?*` | sanitized |
| TC-443 | P0 | U | Reserved names CON PRN AUX NUL COM1 LPT1 | renamed (`_CON`) |
| TC-444 | P0 | U | Trailing dot/space in names | trimmed |
| TC-445 | P0 | U | Two outputs resolve to same filename | collision policy (rename `_1`) applied & shown in preflight |
| TC-446 | P0 | U | Unknown token `{foo}` | validation error, export disabled |
| TC-447 | P1 | U | Empty pattern | default used / error |
| TC-448 | P0 | E | Path > 260 chars | error or long-path success; never silent fail |
| TC-449 | P0 | E | Read-only folder | clear error |
| TC-480..489 | P0 | E | export during editing, cancel, progress, UI not blocked | per phase 4 |
| TC-490..493 | P0 | E | 16-bit PNG | verified by decoder |
| TC-494 | P1 | U | TGA orientation & alpha | matches Unreal import expectations |
| TC-495 | P1 | U | Subfolder tokens `{asset}/{slot}` | folders created |
| TC-496 | P1 | E | Export to ZIP (web fallback) | valid zip opens in Explorer; CRC ok |

## E. Project, state, undo (Phase 3)

| ID | Pri | Auto | Scenario | Expected |
|---|---|---|---|---|
| TC-301..305 | P0 | U | undo/redo semantics | per phase 3 |
| TC-310 | P0 | U | same asset reuse | 1 asset |
| TC-320..327 | P0 | U | serialize/migrate/corrupt | per phase 3 |
| TC-330..337 | P0 | E | save/open/recent/close guard | per phase 3 |
| TC-340..343 | P0 | E | autosave recovery | per phase 3 |
| TC-345..348 | P0 | E | relink | per phase 3 |
| TC-350..356 | P0 | U/E | copy/paste/duplicate | per phase 3 |
| TC-360 | P1 | U | settings migration | presets retained |
| TC-370 | P1 | E | two instances open same file | lock warning |
| TC-371 | P1 | E | asset modified on disk | "modified — reload?" |

## F. UI/UX & accessibility (Phase 5)

| ID | Pri | Auto | Scenario | Expected |
|---|---|---|---|---|
| TC-110..115 | P0 | U | hotkey rules | per phase 1 |
| TC-501..504 | P1 | E | LOD | per phase 5 |
| TC-510..514 | P1 | E | docking persistence | per phase 5 |
| TC-515..520 | P0 | E | viewer tools correctness | per phase 5 |
| TC-524..534 | P0 | E | empty state + wizard | per phase 5 |
| TC-540..548 | P0 | U/M | keyboard, reduced motion, forced colors, contrast, axe | pass |
| TC-549..552 | P1 | M | min window, DPI 100–200% | no clipping/blur |
| TC-560 | P0 | M | Typing in any text field never triggers hotkeys | pass |
| TC-561 | P1 | M | IME composition (e.g. Japanese) in text fields | no stray hotkeys |
| TC-562 | P1 | U | `event.code` vs `event.key` on non-Latin layouts | hotkeys still work |

## G. Electron & installer (Phases 2, 6)

| ID | Pri | Auto | Scenario | Expected |
|---|---|---|---|---|
| TC-210..221 | P0 | E/M | security, protocol, drop paths, menus, windows, crash | per phase 2 |
| TC-601..606 | P0 | E/M | boundaries, fault injection | per phase 6 |
| TC-610..613 | P0 | M | clean install, upgrade, portable, no zombies | pass |
| TC-640 | P0 | M | No network access during run (firewall prompt must not appear) | pass |
| TC-641 | P1 | M | Windows Defender / SmartScreen behavior documented | README section |

## H. Cross-cutting edge-case checklist (use during review)

- **Numbers:** NaN, Infinity, -0, very large/small, locale decimal separators.
- **Strings:** empty, 1000 chars, RTL characters, emoji, Windows-reserved names, leading/trailing spaces.
- **Sizes:** 0 nodes, 1 node, 500 nodes; 1x1 px, odd dims, 4K, 8K, 16K.
- **Timing:** rapid repeated input, cancel mid-operation, close during save/export, minimize during export.
- **Resources:** low RAM (simulate by loading many assets), VRAM exhaustion, disk full, read-only paths, locked files (AV).
- **Environment:** Win10/11, per-user vs admin, DPI scales, multi-monitor, hybrid GPU, remote desktop, offline.
- **State:** undo across save, dirty flag accuracy, autosave vs manual save conflicts, project moved between drives.
- **Security:** path traversal in custom protocol, IPC input validation, no remote content, CSP violations logged.

## I. Release sign-off table (fill during Phase 6)

| Area | P0 count | Passed | Failed | Notes |
|---|---|---|---|---|
| Files & decoding | | | | |
| Graph & nodes | | | | |
| GPU & perf | | | | |
| Export | | | | |
| Project & state | | | | |
| UI/UX & a11y | | | | |
| Electron & installer | | | | |
