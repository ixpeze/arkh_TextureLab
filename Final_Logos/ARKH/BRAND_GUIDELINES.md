# ARKH — Brand Identity Guidelines

> **Brand Scope:** 3D Art · Environment Art · Digital Worlds · CG · Unreal Engine · AI · Custom Tools  
> **Brand Architecture:** ARKH (Master) · TextureLAB (Product) · Environments · Experiments · Tools · Workflows

---

## 1. The Mark: The Isometric Vault

- **Concept:** An isometric cube sculpted into an architectural world-portal—the vessel ("Ark") of digital worlds.
- **Symbolism:**
  - **Overhead Canopy (30°/150° planes):** Architectural lintel and the crown apex of 'A', symbolizing canopy and shelter.
  - **Twin Vertical Piers:** Structural columns grounding the volume in 3D coordinate space.
  - **Center Floor Datum:** A 45° coordinate pedestal marking the threshold between physical reality and virtual space.
  - **Negative Space:** Creates a 3D isometric doorway entering into infinite space.
- **Form Factor:** 100% path-based vector geometry, integer-aligned on a `256×256` coordinate canvas. Zero live text, zero filters, zero unbaked strokes.

---

## 2. Core Brand Palette

| Role | Color Name | HEX | RGB | CMYK | Purpose |
|---|---|---|---|---|---|
| **Primary Base** | Obsidian Core | `#0A0B0E` | `10, 11, 14` | `75, 68, 65, 90` | Primary mark, dark UI surfaces, terminal, packaging |
| **Accent Glow** | Cyber Cyan | `#00F0FF` | `0, 240, 255` | `62, 0, 0, 0` | Digital highlights, tool interactive states, status badges |
| **Product Accent** | TextureLAB Blue | `#00B4D8` | `0, 180, 216` | `78, 12, 0, 0` | TextureLAB wordmark accent and DCC interface tabs |
| **Neutral Surface** | Spatial Slate | `#1E222B` | `30, 34, 43` | `70, 60, 50, 70` | Secondary backgrounds, cards, tiles, badges |
| **Subtle Datum** | Horizon Line | `#D0D3D9` | `208, 211, 217` | `15, 10, 10, 5` | Lockup vertical dividing rules, grid markers |
| **Light Canvas** | Titanium White | `#FFFFFF` | `255, 255, 255` | `0, 0, 0, 0` | Reversed marks, light mode canvas |

---

## 3. Clear Space & Minimum Sizes

### Clear Space Rule
Maintain an exclusion zone of **1 × $X$** around all sides of the mark, where **$X$** is defined as the height of the central floor pedestal (32 px on the 256 canvas). No typography, UI buttons, or graphics may enter this perimeter.

### Minimum Sizes
| Configuration | Screen / Digital | Print | File Recommendation |
|---|---|---|---|
| **Master Symbol** | `16 px` (Height) | `5 mm` | Use [`dist/web/favicon-16.png`](file:///e:/_AI/LG/ARKH/dist/web/favicon-16.png) or [`arkh-symbol-small.svg`](file:///e:/_AI/LG/ARKH/arkh-symbol-small.svg) |
| **Horizontal Lockup** | `24 px` (Height) | `10 mm` | [`arkh-lockup-horizontal.svg`](file:///e:/_AI/LG/ARKH/arkh-lockup-horizontal.svg) |
| **Stacked Lockup** | `48 px` (Height) | `18 mm` | [`arkh-lockup-stacked.svg`](file:///e:/_AI/LG/ARKH/arkh-lockup-stacked.svg) |

---

## 4. Brand Architecture System

```
ARKH (Master Brand)
├── Art / Environments    → [arkh-symbol] ARKH / Art & Environments
├── Experiments           → [arkh-symbol] ARKH / Experiments
├── TextureLAB            → [arkh-symbol] TextureLAB by ARKH
├── Other Tools           → [arkh-symbol] ARKH / Tools
└── Research / Workflows  → [arkh-symbol] ARKH / Research & Workflows
```

1. **Master Brand:** [`arkh-lockup-horizontal.svg`](file:///e:/_AI/LG/ARKH/arkh-lockup-horizontal.svg) or [`arkh-lockup-stacked.svg`](file:///e:/_AI/LG/ARKH/arkh-lockup-stacked.svg)
2. **Product Sub-Brands (e.g. TextureLAB):**
   - The ARKH Vault symbol anchors the left side.
   - A subtle `1 px` vertical datum separates the symbol from the product name.
   - The product name uses custom bold display geometry (`TextureLAB`).
   - The bottom endorsement states: `BY ARKH · 3D ART & ENVIRONMENT TOOL`.

---

## 5. Approved Configurations & Deliverables

### Vector Masters
- **Symbol:** [`arkh-symbol-final.svg`](file:///e:/_AI/LG/ARKH/arkh-symbol-final.svg)
- **Small-Size Cut:** [`arkh-symbol-small.svg`](file:///e:/_AI/LG/ARKH/arkh-symbol-small.svg)
- **Reversed White:** [`arkh-symbol-reversed.svg`](file:///e:/_AI/LG/ARKH/arkh-symbol-reversed.svg)
- **Horizontal Lockup:** [`arkh-lockup-horizontal.svg`](file:///e:/_AI/LG/ARKH/arkh-lockup-horizontal.svg)
- **Stacked Lockup:** [`arkh-lockup-stacked.svg`](file:///e:/_AI/LG/ARKH/arkh-lockup-stacked.svg)
- **TextureLAB Lockup:** [`subbrand-texturelab.svg`](file:///e:/_AI/LG/ARKH/subbrand-texturelab.svg)

### Delivery Variants (`/dist`)
- **One-Color Black:** `dist/arkh-symbol-black.svg`, `dist/arkh-lockup-horizontal-black.svg`
- **Reversed White:** `dist/arkh-symbol-white.svg`, `dist/arkh-lockup-horizontal-white.svg`
- **Cyber Cyan Mono:** `dist/arkh-symbol-mono-00f0ff.svg`, `dist/arkh-lockup-horizontal-mono-00f0ff.svg`
- **Social Avatar / Square:** `dist/arkh-symbol-square.svg`
- **App Icon (Tile):** `dist/arkh-symbol-app-icon.svg`
- **High-Res PNGs:** Available at `32`, `64`, `128`, `256`, `512`, `1024 px` in `dist/`.

### Web & App Package (`/dist/web`)
- `favicon.ico` (Multi-size: 16, 32, 48 px)
- `apple-touch-icon.png` (180×180 px)
- `icon-192.png` & `icon-512.png` (PWA standard)
- `maskable-512.png` (Android adaptive icon)
- `site.webmanifest` & `head-snippet.html`

---

## 6. Prohibited Misuse

- **Do NOT** rotate the symbol or alter the 30° isometric planes.
- **Do NOT** stretch, distort, or skew the horizontal or vertical proportions.
- **Do NOT** add drop shadows, outer glows, bevels, or faux-3D gradients to the master vector paths.
- **Do NOT** re-type the wordmark using default fonts; always use the approved outlined vector paths.
- **Do NOT** change the relative spacing between the symbol and the wordmark.
