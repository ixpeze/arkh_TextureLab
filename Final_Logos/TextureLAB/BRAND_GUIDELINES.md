# TextureLAB — Brand Identity Guidelines

> **Product Scope:** Visual Node Graph Texture Manipulator · Texture Packing · PBR Processing · Asset Preparation  
> **Brand Lineage:** Product of ARKH (`TextureLAB by ARKH`)

---

## 1. The Mark: The Monolithic T-Vault

- **Concept:** Evolved directly from ARKH's master **Isometric Vault**, the mark unifies the architectural canopy and a solid central processing stem into a monumental 3D **'T'** node engine.
- **Symbolism:**
  - **Overhead Canopy (30°/150° Isometric Crossbar):** Inherits the master roof lintel of ARKH, establishing the crossbar of 'T' for TextureLAB.
  - **Central Processing Stem:** A solid, monolithic 3D column dropping through the vault center, symbolizing active multi-channel texture processing (channel packing, format conversion, normalization).
  - **Twin Flanking Piers:** Structural channel conduits representing input/output data registers (Albedo, Normal, Roughness, Metallic passes).
  - **Coordinate Floor Pedestal:** The ARKH spatial threshold datum, marking the unified, packed asset output.
- **Vector Craft:** 100% path-based geometry on a `256×256` coordinate canvas. Exactly 24 precision integer anchors, zero live text, zero filters, zero unbaked strokes.

---

## 2. Core Color Palette

| Role | Color Name | HEX | RGB | CMYK | Purpose |
|---|---|---|---|---|---|
| **Primary Base** | Obsidian Core | `#0A0B0E` | `10, 11, 14` | `75, 68, 65, 90` | Primary mark, dark UI surfaces, terminal, packaging |
| **Product Accent** | TextureLAB Blue | `#00B4D8` | `0, 180, 216` | `78, 12, 0, 0` | TextureLAB wordmark accent, active node pins, primary CTA |
| **Studio Glow** | Cyber Cyan | `#00F0FF` | `0, 240, 255` | `62, 0, 0, 0` | Highlights, status badges, ARKH parent brand glow |
| **Neutral Surface** | Spatial Slate | `#1E222B` | `30, 34, 43` | `70, 60, 50, 70` | Node graph canvas background, docking panels, cards |
| **Subtle Datum** | Horizon Line | `#D0D3D9` | `208, 211, 217` | `15, 10, 10, 5` | Lockup vertical dividing rules, grid markers |
| **Light Canvas** | Titanium White | `#FFFFFF` | `255, 255, 255` | `0, 0, 0, 0` | Reversed marks, light mode canvas, primary typography |

---

## 3. Clear Space & Minimum Sizes

### Clear Space Rule
Maintain an exclusion zone of **1 × $X$** around all sides of the mark, where **$X$** is defined as the height of the central floor pedestal (28 px on the 256 canvas). No typography, UI buttons, or graphics may enter this perimeter.

### Minimum Sizes
| Configuration | Digital Screen | Print | File Recommendation |
|---|---|---|---|
| **Master Symbol** | `16 px` (Height) | `5 mm` | Use `texturelab-symbol-small.svg` or `dist/favicon-16.png` |
| **Horizontal Lockup** | `24 px` (Height) | `10 mm` | `texturelab-lockup-horizontal.svg` |
| **Stacked Lockup** | `48 px` (Height) | `18 mm` | `texturelab-lockup-stacked.svg` |

---

## 4. Brand Relationship: TextureLAB by ARKH

```
ARKH (Master Studio Brand)
└── TextureLAB (Flagship Product: Visual Node Graph Texture Manipulator)
```

1. **Master Lockup:** Symbol + `TextureLAB` (with `LAB` accented in `#00B4D8`) + `BY ARKH` endorsement line.
2. **In-App Integration:**
   - In DCC toolbars (Blender, Unreal Engine, 3ds Max, Maya), use the standalone symbol `texturelab-symbol-final.svg` or `texturelab-symbol-small.svg`.
   - On splash screens and websites, use `texturelab-lockup-horizontal.svg` or `texturelab-lockup-stacked.svg`.

---

## 5. Approved Configurations & Deliverables

### Vector Masters
- **Master Symbol:** [`texturelab-symbol-final.svg`](file:///e:/_AI/LG/TextureLAB/texturelab-symbol-final.svg)
- **Small-Size Cut:** [`texturelab-symbol-small.svg`](file:///e:/_AI/LG/TextureLAB/texturelab-symbol-small.svg)
- **Reversed White:** [`texturelab-symbol-reversed.svg`](file:///e:/_AI/LG/TextureLAB/texturelab-symbol-reversed.svg)
- **Horizontal Lockup:** [`texturelab-lockup-horizontal.svg`](file:///e:/_AI/LG/TextureLAB/texturelab-lockup-horizontal.svg)
- **Dark Mode Lockup:** [`texturelab-lockup-dark.svg`](file:///e:/_AI/LG/TextureLAB/texturelab-lockup-dark.svg)
- **Stacked Lockup:** [`texturelab-lockup-stacked.svg`](file:///e:/_AI/LG/TextureLAB/texturelab-lockup-stacked.svg)

### Delivery Variants (`/dist`)
- **One-Color Black:** `dist/texturelab-symbol-final-black.svg`, `dist/texturelab-lockup-horizontal-black.svg`
- **Reversed White:** `dist/texturelab-symbol-final-white.svg`, `dist/texturelab-lockup-horizontal-white.svg`
- **TextureLAB Blue Mono:** `dist/texturelab-symbol-final-mono-00b4d8.svg`, `dist/texturelab-lockup-horizontal-mono-00b4d8.svg`
- **Social Avatar / Square:** `dist/texturelab-symbol-final-square.svg`
- **App Icon (Tile):** `dist/texturelab-symbol-final-app-icon.svg`
- **High-Res PNGs:** Available at `32`, `64`, `128`, `256`, `512`, `1024`, and `1200 px` in `dist/`.

### Web & App Package (`/dist`)
- `favicon.ico` (Multi-size: 16, 32, 48 px)
- `apple-touch-icon.png` (180×180 px)
- `icon-192.png` & `icon-512.png` (PWA standard)
- `maskable-512.png` (Android adaptive icon)
- `site.webmanifest` & `head-snippet.html`

---

## 6. Prohibited Misuse

- **Do NOT** rotate the symbol or alter the 30° isometric planes.
- **Do NOT** hollow out the center stem or re-introduce circular holes into the canopy.
- **Do NOT** stretch, distort, or skew horizontal/vertical proportions.
- **Do NOT** add drop shadows, outer glows, bevels, or faux-3D gradients to the master vector paths.
- **Do NOT** change the relative spacing between the symbol and the wordmark.
