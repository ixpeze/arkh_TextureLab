# Nodes Design Guide

Minimal, professional dark-theme node graph design inspired by Unreal Engine and modern shader editors. Prioritize compact layouts, clean alignment, subtle color accents, and high readability.

---

## 1. Canvas Background

- **Canvas Base Color**: `#101013`
- **Grid Dots / Lines**:
  - Minor dots: `#2E2E3C`
  - Major dots: `#4C4C64`
- **Grid Style**: Subtle dotted grid, not continuous lines
- **Grid Opacity**: Low contrast, approximately 40–60%
- **Canvas Appearance**: Flat dark background with minimal visual noise

---

## 2. Node Cards (Body & Borders)

- **Card Background (Idle)**: `#20202A`
- **Card Background (Selected)**: `#282836`
- **Card Border (Idle)**: `#3A3A4C` (1px solid)
- **Card Border (Selected)**: `#FFB02E` (1.5px solid with subtle amber glow)
- **Corner Radius**: `6px`
- **Card Shadow**: Very subtle, soft dark shadow
- **Body Fill**: Dark charcoal with very subtle tonal variation
- **Minimum Node Width**: `260px`
- **Node Width**: Auto-adjust to content

### Styling Rules

- No heavy outlines or excessive glow.
- Keep corners smooth and consistent.
- Use thin horizontal separators between rows.
- No unnecessary decorative elements.
- Node sockets should overlap the right border naturally.
- Avoid double border lines behind sockets.

---

## 3. Node Category Headers (Colors / Accents)

### Category Colors

- **I/O Nodes** (Input/Output): `#5CC8E8` (Cyan)
- **Constants** (Color, Value): `#ECE8E1` (Off-white)
- **Channel Operations** (Pack/Split/Swizzle): `#B79CF5` (Soft Violet)
- **Color Adjust** (Brightness, Levels, Invert): `#5CC8E8` (Sky)
- **Normal Operations** (Normal Map, Height-to-Normal): `#4CC9C0` (Teal)
- **Blend Operations** (Multiply, Overlay, Lerp): `#F5C84C` (Amber-Yellow)
- **Math Nodes** (Add, Clamp, Multiply): `#6FD08C` (Mint)
- **Transform Nodes** (Rotate, Scale, Tile): `#F59E0B` (Orange)

### Header Design

- **Header Height**: `36–40px`
- **Header Background**: Dark charcoal with a subtle tint of category color
- **Top Accent Bar**: `3px` solid category color
- **Accent Bar Appearance**: Flat, continuous, straight horizontal line
- **Category Indicator**: Small circular dot to the left of node title
- **Header Text**: Off-white, semibold

### Styling Rules

- No bending or curling at the ends of the top accent bar.
- No bright endpoint highlights.
- No decorative corner effects.
- No extra category badges such as `IO` inside the header.
- Keep header backgrounds subtle, not heavily saturated.

---

## 4. Sockets & Pins

- **Pin Shape**: Circle
- **Pin Diameter**: `12–14px`
- **Pin Border**: Subtle dark outline
- **Socket Position**: Centered vertically within each corresponding row
- **Socket Alignment**: All output sockets share one vertical axis along the right edge of the node

### Wire / Socket Semantic Colors

- **Red (R)**: `#EF4444`
- **Green (G)**: `#22C55E`
- **Blue (B)**: `#3B82F6`
- **Alpha / Mask / Scalar**: `#94A3B8`
- **RGBA / Full Texture**: `#F8FAFC`
- **Packed (ORM / MRA)**: `#B79CF5`
- **Normal Map**: `#4CC9C0`

### Channel Layout

For Texture Input nodes, maintain the following order:

| Detected Map | Channel | Socket |
| --- | --- | --- |
| Output | output | White |
| Full Texture | RGBA | White |
| Ambient Occlusion | R | Red |
| Roughness | G | Green |
| Metallic | B | Blue |
| Height | A | Grey |

### Alignment Rules

- Keep channel letters `R`, `G`, `B`, `A` right-aligned in one column.
- Keep auto-detected map labels immediately to the left of the channel letters.
- Align map labels by their right edges, regardless of label length.
- Keep all sockets equally spaced.
- Use only one vertical border line along the socket edge.

---

## 5. Wire Connections (Cables)

- **Wire Thickness**: `2px`
- **Wire Curve**: Smooth Bezier
- **Wire Color**: Match the source socket's semantic color
- **Idle Appearance**: Solid line, no glow
- **Hover Appearance**: Slightly brighter, subtle glow
- **Selected Appearance**: Stronger visibility without excessive thickness

### Styling Rules

- Avoid excessively curved wires.
- Maintain smooth, predictable cable routing.
- Connected sockets should remain clearly visible.
- No animated effects unless explicitly enabled.

---

## 6. Texture Input Node Layout

### Structure

**Header**

- Small category-colored dot
- Node title: `TextureInput`
- No extra category badges

**Texture Name**

- Place texture filename directly beneath the header.
- Example: `Anthracite_Concrete_ORMH.png`
- Single-line text with ellipsis when necessary.
- Use muted off-white typography.
- Separate filename row from outputs using a thin divider.

**Output Rows**

1. `output`
2. `RGBA`
3. `AO` — `R`
4. `Roughness` — `G`
5. `Metal` — `B`
6. `Height` — `A`

### Map Detection Labels

Automatically detected map meanings should appear as compact, subtle tinted labels.

| Map | Tint Color | Text |
| --- | --- | --- |
| AO | `#5B839E` | `#D5DFE8` |
| Roughness | `#6A9A78` | `#DAE8DF` |
| Metal | `#5B83B2` | `#D6E4F0` |
| Height | `#B48D6E` | `#E8DDD5` |

- **Tint Opacity**: Approximately 15–22%
- **Label Radius**: `4px`
- **Label Padding**: `4px 8px`
- **Label Text Size**: `11–12px`
- **Alignment**: Right-aligned label column
- **Label Border**: None
- **Label Glow**: None

### Layout Rules

- Detected map labels must not push the channel letters or sockets out of alignment.
- Use fixed spacing between map labels, channel letters, and sockets.
- Keep output row heights consistent.
- Use thin horizontal dividers (`#3A3A4C`, low opacity).
- No texture thumbnail or image preview.
- No extra controls inside the node unless explicitly requested.

---

## 7. Typography & Spacing

### Typography

- **Font Family**: Inter, Segoe UI, or similar clean sans-serif
- **Node Title**: `14px`, Semibold
- **Filename**: `12px`, Regular
- **Output Labels**: `12px`, Medium
- **Channel Letters**: `12px`, Medium
- **Detected Map Labels**: `11–12px`, Regular

### Text Colors

- **Primary Text**: `#F1F5F9`
- **Secondary Text**: `#CBD5E1`
- **Muted Text**: `#94A3B8`

### Spacing

- **Horizontal Content Padding**: `12px`
- **Output Row Height**: `32–36px`
- **Filename Row Height**: `30px`
- **Gap Between Label and Channel Letter**: `12px`
- **Gap Between Channel Letter and Socket**: `16px`

---

## 8. General Design Principles

- **Minimalism First**: No unnecessary UI elements.
- **Compact Nodes**: Maintain reasonable proportions and avoid oversized cards.
- **Consistent Alignment**: All labels, channels, sockets, and dividers must align precisely.
- **Semantic Colors**: Use color only where it communicates useful information.
- **Subtle Depth**: Soft shadows and restrained tonal variation.
- **Scalability**: Designs should remain readable when zooming the graph.
- **Visual Consistency**: All node categories follow the same design system.
- **No Unrequested Features**: Do not introduce preview thumbnails, additional inputs, buttons, controls, icons, badges, or information panels unless explicitly specified.

**Final Design Direction:** Clean, compact, professional, dark-themed node editor with subtle category accents, precision-aligned sockets, restrained color-coded labels, and minimal visual clutter.
