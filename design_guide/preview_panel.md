# 2D Texture Viewport Design Guide

Minimal, professional dark-theme texture preview panel. Follow the established Nodes Design Guide and Sidebar Design Guide.

Prioritize maximum texture preview space, compact controls, subtle borders, accurate channel visualization, and consistent styling.

---

## 1. Viewport Container & Background

- **Panel Background**: `#16161C`
- **Panel Border**: `#3A3A4C` (1px)
- **Preview Background**: `#101013`
- **Corner Radius**: `6px`
- **Preview Padding**: `8px`
- **Internal Dividers**: `#3A3A4C` at 50% opacity

### Transparency Checkerboard

- **Tile Dark**: `#181820`
- **Tile Light**: `#22222C`
- **Tile Size**: `16px`
- Only display when transparency visualization is enabled.

### Rules

- Maximize available texture preview space.
- Preserve texture aspect ratio.
- No decorative overlays or heavy borders.
- Maintain accurate texture colors and pixel values.
- Preserve existing zoom, pan, and fit behavior.

---

## 2. Dock Tab Header

- **Active Tab Background**: `#262632`
- **Active Tab Text**: `#FFB02E`
- **Inactive Tab Background**: `#16161C`
- **Inactive Tab Text**: `#8C887E`
- **Active Accent Line**: `#FFB02E` (2px bottom)
- **Tab Height**: `32px`
- **Corner Radius**: `5px` (top corners)
- **Close Icon**: `#94A3B8`

### Rules

- Tab title: `2D Viewport`
- Maintain compact professional appearance.
- Preserve existing docking, resizing, and tab functionality.
- Do not introduce additional tabs.

---

## 3. Top Toolbar

- **Toolbar Background**: `#16161C`
- **Toolbar Height**: `36–40px`
- **Bottom Divider**: `#3A3A4C`
- **Horizontal Padding**: `10px`
- **Control Spacing**: `6–8px`

### Texture Output Label

- **Text**: `Texture Output`
- **Font Size**: `12–13px`
- **Weight**: Medium
- **Color**: `#F1F5F9`

### Zoom / Fit Controls

- **Button Background**: `#20202A`
- **Hover Background**: `#282836`
- **Border**: `#3A3A4C`
- **Text Color**: `#CBD5E1`
- **Active Accent**: `#FFB02E`
- **Corner Radius**: `4px`
- **Button Height**: `28px`

Existing controls:

- `1:1` — Actual pixel size
- Fit to viewport
- `100%` — Zoom percentage

### Rules

- Align zoom controls on the right.
- Maintain consistent button dimensions.
- No heavy glow or excessive icon decoration.
- Preserve existing toolbar functionality.

---

## 4. Bottom Channel Toolbar

- **Toolbar Background**: `#16161C`
- **Height**: `38–42px`
- **Top Divider**: `#3A3A4C`
- **Horizontal Padding**: `10px`
- **Control Gap**: `6px`

### Channel Buttons

| Channel | Accent Color | Background Tint |
| --- | --- | --- |
| R | `#EF4444` | `#351D24` |
| G | `#22C55E` | `#193525` |
| B | `#3B82F6` | `#1C2D48` |
| A | `#94A3B8` | `#34343C` |
| RGBA | `#FFB02E` | `#FFB02E` |

### Button Styling

- **Height**: `28px`
- **Min Width**: `32px`
- **Corner Radius**: `5px`
- **Border**: Semantic channel color at 35% opacity
- **Font Size**: `12px`
- **Font Weight**: Medium

### Active / Inactive States

- **RGBA Active**: Solid amber background, dark text.
- **Individual Channel Active**: Stronger channel-colored tint and border.
- **Inactive Channel**: Subtle tinted background.
- **Hover**: Slight brightness increase.
- **Disabled**: Reduced opacity.

### Rules

- R, G, B, A always retain their semantic colors.
- Keep individual channel buttons equal in size.
- Maintain precise horizontal alignment.
- Use color-coded tinted backgrounds, not fully saturated fills.
- Do not modify texture data when switching channels.
- Preserve existing isolation behavior.

---

## 5. Transparency & Tiling Controls

### Checkerboard Toggle

- **Background**: `#20202A`
- **Active Background**: `#30303E`
- **Border**: `#3A3A4C`
- **Icon Color**: `#CBD5E1`
- **Size**: `28px`
- **Corner Radius**: `4px`

### Texture Repeat / Tiling

- Existing options: `1x`, `2x`, `4x`
- **Idle Background**: Transparent
- **Idle Text**: `#94A3B8`
- **Active Background**: `#FFB02E`
- **Active Text**: `#101013`
- **Corner Radius**: `4px`
- **Height**: `28px`

### Rules

- Keep transparency and tiling controls on the bottom toolbar.
- Separate control groups with subtle vertical dividers.
- Do not introduce new controls.
- Preserve existing texture repeat functionality.

---

## 6. Resolution Information

Example: `4096 × 4096 px`

- **Background**: Transparent
- **Text Color**: `#B6B2AA`
- **Font Size**: `11–12px`
- **Font Weight**: Medium
- **Alignment**: Bottom-right
- **Optional Divider**: `#3A3A4C`

### Rules

- Use plain text rather than oversized badges.
- Keep resolution metadata visually secondary.
- Do not overlap channel or tiling controls.
- Show actual loaded texture resolution.

---

## 7. Bottom Action Bar (Exporting)

Only apply if export controls already exist in the panel.

### Quick Export Button

- **Background**: `#FFB02E`
- **Hover**: `#FFC15C`
- **Pressed**: `#E99A16`
- **Text**: `#101013`
- **Radius**: `5px`
- **Height**: `30px`

### Export Format Selector

- **Background**: `#20202A`
- **Border**: `#3A3A4C`
- **Hover**: `#282836`
- **Text**: `#F1F5F9`
- **Radius**: `4px`

### Rules

- Preserve existing export workflows.
- Do not add redundant export buttons.
- Keep export controls separate from channel isolation controls when appropriate.

---

## 8. Typography & Spacing

### Typography

- **Font Family**: Inter / Segoe UI
- **Tab Title**: `13px`, Semibold
- **Toolbar Labels**: `12px`, Medium
- **Channel Buttons**: `12px`, Medium
- **Zoom Values**: `12px`, Medium
- **Resolution Text**: `11–12px`, Regular

### Colors

- **Primary**: `#F1F5F9`
- **Secondary**: `#CBD5E1`
- **Muted**: `#94A3B8`
- **Disabled**: `#64748B`
- **Active Accent**: `#FFB02E`

### Spacing

- **Panel Padding**: `8px`
- **Top Toolbar Height**: `36–40px`
- **Bottom Toolbar Height**: `38–42px`
- **Button Height**: `28px`
- **Control Gap**: `6px`
- **Divider Thickness**: `1px`

---

## 9. General Design Principles

- **2D Texture Preview Only**: The panel is exclusively for viewing and inspecting 2D textures.
- **Preview First**: Maximize space for texture display.
- **Minimal UI**: Avoid unnecessary controls and visual clutter.
- **Consistent Dark Theme**: Match the Node Graph and Sidebar.
- **Semantic Channel Colors**: Use matching R/G/B/A tinted backgrounds.
- **Amber Accent**: Use `#FFB02E` for selected general controls.
- **Precise Alignment**: Consistent button sizing and spacing.
- **Subtle Dividers**: Thin, low-contrast separators.
- **Pixel Accuracy**: UI styling must never alter texture data.
- **Preserve Functionality**: Existing zoom, pan, fit, channel isolation, transparency, tiling, docking, and export functionality must remain unchanged.
- **No Unrequested Features**: Do not add additional preview modes, tabs, widgets, toolbars, or controls.

**Final Design Direction:** A compact, professional dark-themed 2D Texture Viewport with maximum preview space, minimal amber-accented controls, subtle R/G/B/A channel tints, unobtrusive resolution metadata, and precise visual consistency with the rest of the application.
