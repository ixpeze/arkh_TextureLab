# Specification: 2D Viewport Declutter & Top/Bottom Split Design

**Date**: 2026-10-11  
**Status**: Validated & Approved  
**Author**: ARKH Architecture & Design Team  
**Governing Rules**: `RULE[user_global]`, `GEMINI.md`, `skills/brainstorming/SKILL.md`

---

## 1. Executive Summary

This specification defines the complete visual decluttering and layout restructuring of the ARKH TextureLab **2D Viewport**. 

The current viewport interface crowds all controls—bracketed text buttons (`[Pin]`, `[Pop-out]`), channel modes, UV tiling, zoom controls (`1:1`, `Fit`, `100%`), and redundant breadcrumb text (`Final Albedo Output (Final Output)`)—into a single horizontal row above the image quad. This creates visual clutter, reduces available width, and compromises professional DCC aesthetics.

The approved redesign resolves this by:
1. **Splitting controls into Top and Bottom bars** based on cognitive responsibility (Top: *Identity & Navigation*; Bottom: *Inspection & Telemetry*).
2. **Replacing text buttons with precision CAD/DCC vector iconography** (custom pushpin for Pin, window pop-out glyph, corner framing brackets for Fit, 2×2 micro-checkerboard for alpha), completely eliminating bracketed text and adhering to the workspace **Strict Zero-Emoji** requirement.
3. **Streamlining breadcrumb title text** to remove duplicate labels.
4. **Introducing a minimalist live color swatch chip** in the bottom telemetry bar showing live hovered pixel color, hex code, and coordinates.
5. **Adopting `texturelab_layout.json` as the default application layout**.

---

## 2. Layout Architecture & Boundaries

```
+-----------------------------------------------------------------------------------------+
| [📌 Pin] [⧉ Undock] | Node Label • [Socket Tabs]           [1:1] [⛶ Fit] [100% Zoom]     | <-- Top Bar (26px)
+-----------------------------------------------------------------------------------------+
|                                                                                         |
|                                                                                         |
|                                Central 2D Texture Canvas                                |
|                                (Interactive Pan, Zoom, Tiling)                          |
|                                                                                         |
|                                                                                         |
+-----------------------------------------------------------------------------------------+
| [RGB] [▨] [R] [G] [B] [A]  |  [1x] [2x] [4x]               [■ Swatch] #FF8000 (512,512) | <-- Bottom Bar (24px)
+-----------------------------------------------------------------------------------------+
```

### 2.1 Top Bar: Node Identity & Navigation (26px)
* **Left Group**:
  * **Pin Button**: 18×18 tactile icon button. Displays custom vector pushpin. Inactive: `TEXT_MUTED` outline; Active: `ACCENT_AMBER` fill with subtle amber glow. Click toggles pin state.
  * **Undock / Pop-out Button**: 18×18 tactile icon button. Displays window popout glyph (`⧉`). Click toggles detached multi-monitor floating viewport.
  * **Vertical Hairline**: 1px vertical separator in `BORDER_DARK`.
  * **Node Title**: Clean node label (e.g. `Final Albedo Output`). Does not append redundant `(Final Output)` text.
  * **Socket Selector (Conditional)**: If the node contains multiple outputs (e.g. `ChannelSplit`, `TextureInput`), displays compact segmented socket pills: `[RGBA]`, `[R]`, `[G]`, `[B]`, etc.
* **Right Group**:
  * **1:1 Scale Button**: 22×18 compact badge with `1:1`. Tooltip: "Reset to 1:1 pixel scale".
  * **Fit Button**: 18×18 vector frame bracket icon (`⛶`). Tooltip: "Fit texture proportionally in viewport".
  * **Zoom Percentage**: Monospace label in `TEXT_MUTED` (e.g. `100%`).

### 2.2 Bottom Bar: Inspection & Telemetry (24px)
* **Left Group**:
  * **Channel Isolation Group**:
    * Segmented pills: `RGB` (Color), `▨` (2×2 micro-checkerboard alpha), `R`, `G`, `B`, `A`.
    * Active pill highlighted with `ACCENT_AMBER` and dark charcoal background.
  * **Vertical Hairline**: 1px separator in `BORDER_DARK`.
  * **UV Tiling Group**:
    * Segmented pills: `1x`, `2x`, `4x`.
* **Right Group**:
  * **Minimalist Swatch & Telemetry Readout**:
    * **Active Hover**: 12×12px rounded color chip filled with the exact sampled RGBA color + `#HEX` (bold monospace) + coordinates `(X, Y)`.
    * **Idle / Cursor Outside Quad**: Displays dimensions `1024 × 1024 px` in `TEXT_SECONDARY`.

---

## 3. Vector Iconography Details (Strict Zero-Emoji Compliance)

All icons are drawn via direct `egui::Painter` vector geometry to guarantee high resolution and crisp alignment across all DPI scaling factors:
1. **Pushpin Icon (`draw_pin_icon`)**:
   * Angled pushpin head with cylindrical barrel, shoulder, and angled needle point.
   * Highlighted with `ACCENT_AMBER` stroke & fill when pinned.
2. **Pop-out Window Icon (`draw_popout_icon`)**:
   * Rectangular window frame with top-right opening and a 45-degree arrow pointing out.
3. **Fit View Icon (`draw_fit_icon`)**:
   * Four corner L-brackets framing the outer perimeter.
4. **Checkerboard Icon (`draw_checker_icon`)**:
   * 10×10px square divided into 4 alternating dark/light 5×5px blocks representing transparency.

---

## 4. Default Layout Specification (`texturelab_layout.json`)

To set `texturelab_layout.json` as the default layout:
1. `crate::ui::default_dock_layout()` will first attempt to load `texturelab_layout.json` from the current working directory.
2. If not found or if deserialization fails, it falls back to the embedded `include_str!("../../texturelab_layout.json")`.
3. If JSON parsing fails completely, it falls back to programmatic split generation.
4. "Reset to Default Layout" in the application menu will restore this layout.

---

## 5. Decision Log

* **Decision 1: Top vs Bottom Functional Separation**
  * *Alternatives*: Single toolbar; floating glass HUD pills over image; side vertical toolstrip.
  * *Rationale*: Top bar dedicated to Node Identity & Viewport Navigation, bottom bar dedicated to Channel Inspection & Telemetry. Prevents visual clutter and eliminates image occlusion.
* **Decision 2: Precision Vector Icons over Text & Emojis**
  * *Alternatives*: Text pills (`[Pin]`, `[Pop-out]`); Unicode emojis (`📌`, `⧉`).
  * *Rationale*: Complies with strict workspace zero-emoji rules while delivering AAA CAD/DCC aesthetic.
* **Decision 3: Minimalist Color Swatch Chip Telemetry**
  * *Alternatives*: Verbose multi-line telemetry with 8-bit & float decimals; simple text-only hex code.
  * *Rationale*: Visual color swatch chip provides instant intuitive feedback with minimal character footprint.

---

## 6. Implementation Plan & Quality Gates

1. **Phase 1**: Add vector icon helpers in `src/ui/viewport.rs` (`draw_pin_icon`, `draw_popout_icon`, `draw_fit_icon`, `draw_checker_icon`, `draw_color_swatch`).
2. **Phase 2**: Restructure `ViewportState::show` to render the clean Top Bar and Bottom Bar.
3. **Phase 3**: Update `crate::ui::default_dock_layout` to load `texturelab_layout.json` as default.
4. **Phase 4**: Verification:
   - Run `cargo test` (asserting all unit and integration tests pass).
   - Build standalone release binary (`cargo build --release`).
   - Verify zero warnings and clean exit code `0`.
