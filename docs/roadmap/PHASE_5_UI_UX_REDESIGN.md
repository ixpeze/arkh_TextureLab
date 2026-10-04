# PHASE 5 — UI/UX Redesign ("Graphite Blueprint")

**Goal:** A cohesive, calm, professional workstation UI with a docked layout, readable type, an excellent first-run experience, and the **Pack Wizard** (the product's core value in one click). Keep every feature; remove clutter.
**Prereqs:** Phases 3-4 (store, GPU viewer, thumbnails). **Effort:** L.
**Audit items closed:** F-17, F-28, F-29, F-30 (+ D-05 viewer tools).

Uses the `design-evolution` method: 4-pillar hybrid, strict minimal hierarchy, WCAG AA.

---

## 1. Design recipe (propose -> owner may tweak palette before build)

**Why change:** the current look is blue-black "obsidian" (`#090a0f`, slate text, cyan/purple glows) — the generic dark zinc/slate monoculture, plus glow shadows. A texture artist must judge color, so surroundings should be **neutral and quiet**, with exactly one signal accent.

| Pillar | Choice |
|---|---|
| **Geometry** | 4 px radius (inputs/nodes), 2 px for chips, 8 px for dialogs. 1 px hairlines. No glows, no blur. Selection = 2 px amber outline. 8-pt spatial grid. |
| **Palette** | Warm graphite neutrals + one amber signal + functional PBR channel colors (kept, slightly softened). |
| **Typography** | **Geist** (UI, already bundled) + **Geist Mono** (numeric telemetry, filenames, hex). Scale 1.25: 11 / 12(base) / 14 / 16 / 20. **Minimum 11 px.** Tabular numerals for values. |
| **Layout rhythm** | Blueprint dot-grid canvas at 24 px (very low contrast), docked panels separated by hairlines, generous 16/24 px section padding, one focal point (the graph canvas; the viewer when the Preview tab is active). |

Movements blended: Cyber-Industrial (blueprint hairlines, mono telemetry) x Swiss/International (grid discipline, scale ratio, asymmetric 3-pane balance) x Warm Editorial (warm neutrals, off-white "paper" text).

### Tokens (`src/ui/tokens.css`) — contrast **measured** with WCAG formula

| Token | Hex | Notes |
|---|---|---|
| `--bg-canvas` | `#131211` | graph background |
| `--bg-surface` | `#1B1A18` | panels, nodes |
| `--bg-raised` | `#242220` | headers, inputs, menus |
| `--hairline` | `rgba(236,232,225,0.09)` | borders |
| `--text` | `#ECE8E1` | 14.2:1 on surface, 13.0:1 on raised |
| `--text-muted` | `#A39E94` | 6.5:1 surface, 6.0:1 raised |
| `--text-dim` | `#8A857B` | 5.1:1 canvas, 4.7:1 surface, **4.3:1 on raised = FAILS AA** -> use only on canvas/surface for non-essential hints; never on raised |
| `--accent` (amber) | `#FFB02E` | 9.5:1 on surface; text on amber = `#131211` (10.3:1) |
| `--info` | `#5CC8E8` | 9.0:1 |
| `--danger` | `#FF6B5E` | 6.2:1 |
| `--ok` | `#6FD08C` | 9.2:1 |
| PBR: AO `#F08A8A`, Rough `#6FD08C`, Metal `#5CB6F0`, Height `#F5C84C`, Normal `#4CC9C0`, Packed `#B79CF5` | | 7.2–11.0:1 on surface. Never color-only: sockets also carry a letter glyph (R/G/B/A) for color-blind users |

Add `scripts/contrast-check.mjs` that fails CI if any token pair in a declared list drops below 4.5:1 (3:1 for large/UI components).

## 2. Layout

```
┌───────────────────────────────────────────────────────────────────────────┐
│ Top bar: ▪ Project name* · Undo Redo · [Pack Wizard] · Export · ⚙ Settings │
├───────────┬───────────────────────────────────────────────┬───────────────┤
│ Library   │                                               │ Inspector     │
│ (search,  │              Graph canvas                     │ [Preview |    │
│  categor- │         (dot grid, LOD, minimal wires)        │  Histogram |  │
│  ies,     │                                               │  Properties]  │
│  collaps- │                                               │ viewer tools: │
│  ible)    │                                               │ channel, 1:1, │
│           │                                               │ A/B, tiling   │
├───────────┴───────────────────────────────────────────────┴───────────────┤
│ Status bar: message · working res · GPU name · VRAM pool · zoom           │
└───────────────────────────────────────────────────────────────────────────┘
```

Panels dock (no overlay), are resizable (min 240 px), collapsible with `Ctrl+B` (Library) and `Ctrl+Alt+B` (Inspector); chords live in the hotkey table (single source of truth) and never collide with the plain single-letter node hotkeys. Layout persists in `settings.json`.

## 3. Tasks

| ID | Task | Detail | Acceptance |
|---|---|---|---|
| P5-T1 | **Design system** `src/ui/`: tokens, `Button`, `IconButton` (>= 24x24 hit area), `Slider` (DCC scrub: drag, shift fine, wheel, dbl-click type, middle-click reset — preserve current shortcuts), `NumberField`, `Select`, `Checkbox`, `Segmented`, `Panel`, `Dialog` (focus trap, Esc), `Tooltip`, `Kbd`, `Icon` wrapper (Lucide). Replace inline-style files with CSS (modules or one stylesheet) — no new inline styles. | Storybook not required; add `/ui-kit` dev route showing all components | grep: inline `style={{` count in `src/ui`, `nodes/ui` = 0 except dynamic geometry |
| P5-T2 | **NodeShell** redesign (reads registry schema): 4 px radius, header with category color bar (2 px), title, bypass toggle; params laid out in 8-pt grid; thumbnails; ports 12 px dots with letter glyph; **LOD:** zoom < 0.6 -> title + colored bar only; zoom < 0.35 -> block. | | TC-501..504 |
| P5-T3 | **Wires:** static colored 1.5 px; hover/selected 2.5 px amber; animate (dash) only the selected wire or while that branch recomputes. Remove drop-shadow filter. | | perf harness: pan/zoom 60 nodes >= 55 fps |
| P5-T4 | **Docked layout** with resizable panels; replace `FloatingNodeLibrary` & `FloatingDetailsPanel`; persist layout. | | TC-510..514 |
| P5-T5 | **Inspector tabs** (Preview, Histogram, Properties): Preview shows GPU viewer + channel segmented control [RGBA R G B A], fit/1:1, probe readout in mono, A/B pin & wipe (replaces Compare node), tiling toggle 1/2/3/4 (replaces Seam node). | | TC-515..520 |
| P5-T6 | **Library:** search box, categories (Input, Channel, Math, Adjust, Blend, Output, Utility, Labs[hidden by default, toggle in Settings]), recently used, hotkey hints. Math category lists all 13 separately (D-04). | | TC-521..523 |
| P5-T7 | **Empty state & first run:** empty canvas with centered card "Drop textures here, or Open Sample / New from template". No auto-loaded graph. Templates: Pack ORM, Pack ORMH, Unreal/Unity/Godot presets, Unpack ORM. | | TC-524..526 |
| P5-T8 | **Pack Wizard** (primary action): (1) drop folder/files -> LexicalNormalizer classifies maps; (2) table shows detected map -> channel, editable per row, missing maps use fallback constants; (3) choose preset (ORM/ORMH/Unity mask/RMA/custom), asset name, output folder; (4) creates wired nodes + output + opens Export Hub. Also "Unpack" wizard: drop packed map -> splitter + per-channel outputs. | | TC-527..534 |
| P5-T9 | **Status bar & toasts:** replace bottom HUD pill; non-blocking toasts for save/export complete (with "Show in folder"), errors with plain-language action. No `alert()`. | | grep `alert(` = 0 |
| P5-T10 | **Settings dialog:** Preview quality (Auto/512/1K/2K/Full), VRAM budget, show Labs nodes, confirm-on-delete, reset layout, open logs folder, GPU info (copyable). | | |
| P5-T11 | **Shortcuts dialog** auto-generated from the hotkey table (never hand-maintained). | | test: every registry hotkey appears |
| P5-T12 | **Accessibility pass:** focus ring 2 px amber offset 2, logical tab order, ARIA roles for panels/tabs/dialog, `prefers-reduced-motion` disables dash animation & transitions, Windows High Contrast (`forced-colors`) fallback, hit targets >= 24x24, no color-only meaning, keyboard route for every action (menu). | | TC-540..548; axe-core run (dev dependency) with 0 serious violations |
| P5-T13 | **Responsive** (desktop app, but windows vary): 1100x680 min; < 1280 wide auto-collapses library; DPI 100/125/150/200% verified. | | TC-549..552 |
| P5-T14 | Stretch (owner priority): command palette Ctrl+K; auto-layout & align; snap-to-grid; node search highlight. | | |
| P5-T15 | Record the recipe: add to `skills/design-evolution/data/design-experiments.json` via `record_experiment.py --add` (path under the owner's `.agent` repo) after owner approves look. | | entry exists |

## 4. Interaction details (specification)

- **Sliders:** drag = scrub; Shift = 0.1x; Ctrl = snap to step; double-click = type; middle-click = reset; wheel over slider = scrub (not zoom canvas) — keep existing `nowheel` isolation.
- **Bypass:** `D` toggles; bypassed node shows hatch overlay at 6% only (current 8%/12% stripes too loud) + "MUTED" mono chip.
- **Socket tooltips:** show type, resolution, last value; never required to read at 7 px.
- **Connect feedback:** valid targets highlight; invalid show reason in status bar (existing `validateConnection` messages).
- **Confirmations:** destructive actions are undoable instead of confirmed (Delete). Only "close with unsaved changes" confirms.
- **Motion:** 150–200 ms ease-out for panel collapse/hover; none for canvas pan; all disabled under reduced motion.
- **Empty/error states** written in plain language with one clear action.

## 5. Test cases

| ID | Test | Expected |
|---|---|---|
| TC-501 | Zoom to 0.5 | cards switch to compact LOD; no layout shift of ports |
| TC-502 | Zoom to 0.3 | block mode; wires still attach |
| TC-510 | Drag panel divider | width persists after restart |
| TC-511 | Collapse both panels | canvas fills; hotkeys restore |
| TC-515 | Isolate R/G/B/A | grayscale identical to GPU channel values (probe check) |
| TC-516 | 1:1 mode at 200% DPI | one texel = one device px |
| TC-517 | A/B wipe | pinned vs live compare works across node changes |
| TC-518 | Tiling 3x | seams visible, no resampling blur at 1:1 |
| TC-524 | First launch | empty-state card visible, zero texture memory used |
| TC-527 | Wizard with all 4 maps | wired ORMH output ready to export in <= 3 clicks |
| TC-528 | Wizard missing Height | A uses fallback constant; user informed |
| TC-529 | Wizard with ambiguous names (`rough_metal.png`) | row flagged "check", user can reassign |
| TC-530 | Wizard with mixed resolutions | policy applied; warning chip |
| TC-531 | Wizard cancel | no nodes added |
| TC-540 | Tab through app | every control reachable; visible focus |
| TC-541 | Reduced motion | no animation |
| TC-542 | forced-colors mode | UI usable, selection visible |
| TC-545 | Contrast script | all declared pairs pass |
| TC-549 | 1100x680 window | no clipped controls |
| TC-550 | 200% DPI | no blurry text/icons |

## 6. Edge cases

- Very long filenames/asset names in nodes, wizard rows, status bar -> ellipsis + tooltip with full path.
- 200+ nodes with LOD: scroll/zoom stays >= 55 fps.
- Localized Windows with different decimal separator in number fields: parse both `,` and `.`.
- Pasting text with units/whitespace into number fields.
- Drag-drop of non-image files / folders with 500 files -> wizard caps list, filters by extension, shows count.
- Mixed color spaces in wizard (BaseColor sRGB vs data maps) — color space flags set per role automatically.
- Window moved between monitors with different DPI.
- Touch/pen input: not a target (document, don't break).

## 7. Exit criteria

- [ ] Docked layout, design system, LOD nodes, static wires shipped.
- [ ] Pack Wizard produces a correct ORM/ORMH from a folder in <= 3 clicks.
- [ ] Empty state + templates; no auto-loaded graph.
- [ ] Contrast script green; axe 0 serious; keyboard-only path verified.
- [ ] Pan/zoom 60 nodes >= 55 fps (real GPU).
- [ ] Owner has approved the look (ask once, with screenshots only if they request them).
- [ ] Tracker + Handoff notes updated.

## 8. Risks

| Risk | Mitigation |
|---|---|
| Restyling touches ~30 node files | Registry + NodeShell means one place to restyle (done in P1) |
| Owner dislikes warm-neutral look | tokens are CSS variables; swapping palette = one file; get approval of palette before P5-T2 |
| Wizard misclassifies maps | always editable table, never silent |

## Evidence log

```
date / agent / command / output summary
```
