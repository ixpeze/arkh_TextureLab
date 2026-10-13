# Sidebar Design Guide (Library & Inspector)

Minimal, professional dark-theme sidebar design consistent with the Nodes Design Guide. Prioritize compact layouts, subtle category-tinted headers, precise alignment, restrained colors, and clear visual hierarchy.

Both the **Node Library** and **Inspector** must follow the same visual system.

---

## 1. Panel Background & Frame

- **Panel Background**: `#16161C`
- **Panel Border**: `#3A3A4C` (1px solid)
- **Internal Dividers**: `#3A3A4C` at 40–60% opacity
- **Corner Radius**: `6px`
- **Panel Shadow**: Very subtle dark shadow

### Tab Header Bar (Dock Tabs)

- **Active Tab Background**: `#262632`
- **Active Tab Text**: `#F8F6F0`
- **Inactive Tab Background**: `#16161C`
- **Inactive Tab Text**: `#8C887E`
- **Active Accent Line**: `#FFB02E` (2px)
- **Tab Height**: `32px`
- **Close Icon**: Muted gray, brighter on hover

### Styling Rules

- Maintain a flat, dark appearance.
- Avoid heavy gradients, bright glows, and decorative outlines.
- Use subtle borders to separate docked panels.
- Keep panel padding and spacing consistent.
- Do not modify existing docking, resizing, or tab functionality.

---

## 2. Node Library

### Search Input Box

- **Background**: `#121218`
- **Border (Idle)**: `#3A3A4C`
- **Border (Focused)**: `#FFB02E` (1px solid)
- **Text Color**: `#F8F6F0`
- **Placeholder Color**: `#8C887E`
- **Search Icon**: `#94A3B8`
- **Corner Radius**: `5px`
- **Input Height**: `32px`
- **Horizontal Padding**: `10px`

### Category Accordion Headers

Each category header uses a subtle background tint derived from its category color.

- **Header Height**: `30–32px`
- **Header Background**: Category color at 10–15% opacity over `#16161C`
- **Header Hover**: Category color at 18–22% opacity
- **Text Color**: Category accent color
- **Chevron Color**: `#CBD5E1`
- **Font Size**: `12–13px`
- **Font Weight**: Medium / Semibold
- **Horizontal Padding**: `12px`
- **Corner Radius**: `0px` for full-width category bars

### Category Colors

| Category | Accent Color | Suggested Tinted Background |
| --- | --- | --- |
| I/O | `#5CC8E8` | `#1D3038` |
| Constants | `#ECE8E1` | `#29292D` |
| Channel Operations | `#B79CF5` | `#292237` |
| Color Adjust | `#5CC8E8` | `#1D3038` |
| Normal Operations | `#4CC9C0` | `#1B3432` |
| Blend Operations | `#F5C84C` | `#342D1C` |
| Math | `#6FD08C` | `#1D3327` |
| Transform | `#F59E0B` | `#35271B` |

The background colors are subtle tonal targets. Adjust opacity if needed to maintain consistency with the dark panel.

### Category Header Rules

- Use a full-width, flat, category-tinted background.
- No category indicator dots or pip circles.
- Category name and item count aligned left.
- Chevron aligned right.
- Keep expanded and collapsed states visually consistent.
- Use a small chevron rotation to indicate expansion.
- Do not add unnecessary icons, badges, or decorative elements.
- Maintain clear separation between category groups.

### Node Item Pills (Draggable / Clickable Items)

- **Background (Idle)**: `#20202A`
- **Background (Hover)**: `#282836`
- **Background (Selected)**: `#303040`
- **Border (Idle)**: `#3A3A4C` (1px solid)
- **Border (Hover)**: `#4A4A60`
- **Corner Radius**: `5px`
- **Item Height**: `28–30px`
- **Horizontal Padding**: `10px`
- **Font Size**: `12px`
- **Text Color**: `#F1F5F9`
- **Category Accent Bar**: `3px` solid category color, aligned on the left edge

### Node Item Rules

- No circular dots inside list items.
- Use only the narrow vertical category accent bar.
- Maintain consistent item width and height.
- Keep list items slightly indented beneath their category header.
- Use `4–6px` vertical spacing between items.
- Long node names should truncate gracefully with ellipsis.
- Preserve existing click-to-add and drag-to-create behaviors.

### Keyboard Shortcut Badges

- **Background**: `#30303E`
- **Text**: `#CBD5E1`
- **Border**: `#444455`
- **Corner Radius**: `4px`
- **Font Size**: `10px`
- **Alignment**: Right edge of item
- Display only when a shortcut exists.
- Do not invent or change existing shortcut mappings.

---

## 3. Inspector Panel

The Inspector follows the same visual language as the Node Library but prioritizes clear property organization, readable controls, and compact spacing.

### Node Title & Header Banner

- **Header Background**: `#20202A` with a subtle category-color tint
- **Header Border Bottom**: `#3A3A4C`
- **Header Height**: `40px`
- **Node Title Color**: `#F1F5F9`
- **Node Title Font Size**: `14px`
- **Node Title Weight**: Semibold
- **Category Accent Line**: `3px` solid category color along the top
- **Corner Treatment**: Flat continuous accent line, no bright endpoint or bending effects

### Category Badge Style

- **Background**: Category color at 15–20% opacity
- **Text Color**: Category accent color
- **Border**: None
- **Corner Radius**: `4px`
- **Font Size**: `10–11px`
- **Padding**: `4px 7px`

Use a category badge only when category identification is useful. Avoid repeating information already shown in the header.

### Property Sections (Collapsible Groups)

- **Section Background**: `#1C1C25`
- **Section Title Color**: `#B6B2AA`
- **Section Hover Background**: `#252532`
- **Section Divider**: `#3A3A4C` (1px, low opacity)
- **Section Title Font Size**: `12px`
- **Section Title Weight**: Semibold
- **Section Height**: `30–32px`
- **Chevron Color**: `#94A3B8`
- **Horizontal Padding**: `10–12px`

### Property Section Rules

- Use compact accordion-style sections.
- Place section title on the left and chevron on the right.
- Avoid unnecessary icons.
- Use subtle separators instead of large gaps or heavy borders.
- Preserve all existing expand/collapse functionality.

---

## 4. Inspector Widgets & Controls

### Sliders

- **Track Background**: `#121218`
- **Track Fill (Default)**: `#FFB02E`
- **Track Fill (Category-Specific)**: Category accent color when contextually appropriate
- **Thumb Color**: `#E2E8F0`
- **Track Height**: `4px`
- **Thumb Diameter**: `10–12px`
- **Numeric Value Color**: `#F1F5F9`

Keep sliders compact. Prefer minimal visual treatment with clear values.

### Text / Number Inputs

- **Background**: `#121218`
- **Border (Idle)**: `#3A3A4C`
- **Border (Focused)**: `#FFB02E`
- **Text Color**: `#F1F5F9`
- **Placeholder**: `#8C887E`
- **Corner Radius**: `4px`
- **Height**: `28–30px`
- **Horizontal Padding**: `8px`

Number inputs should support existing precision, keyboard editing, and drag-to-adjust behavior where already implemented.

### Dropdowns / Comboboxes

- **Background**: `#20202A`
- **Border**: `#3A3A4C`
- **Hover Background**: `#282836`
- **Selected Item Background**: `#303040`
- **Text Color**: `#F1F5F9`
- **Chevron Color**: `#94A3B8`
- **Corner Radius**: `4px`
- **Height**: `30px`

Use a subtle focused border. Avoid excessive glow or animation.

### Checkboxes / Toggles

- **Unchecked Background**: `#121218`
- **Unchecked Border**: `#555568`
- **Checked Background**: `#FFB02E`
- **Checkmark Color**: `#101013`
- **Disabled Opacity**: `40%`
- **Checkbox Size**: `14–16px`
- **Corner Radius**: `3px`

For toggle switches, use the same color system and maintain a compact footprint.

### Color Picker Swatches

- **Swatch Size**: `28–32px` wide, `24–28px` high
- **Border**: `#3A3A4C`
- **Corner Radius**: `4px`
- **Checkerboard**: Visible only for transparency
- **Selected Border**: `#FFB02E`
- **Hexadecimal Input Background**: `#121218`

Color picker UI should remain lightweight and responsive.

---

## 5. Typography & Spacing

### Typography

- **Font Family**: Inter, Segoe UI, or equivalent clean sans-serif
- **Panel Titles**: `14px`, Semibold
- **Category Titles**: `12–13px`, Medium
- **Node Item Text**: `12px`, Regular
- **Inspector Section Titles**: `12px`, Semibold
- **Property Labels**: `12px`, Regular
- **Input Values**: `12px`, Medium
- **Shortcut Labels**: `10px`, Medium

### Text Colors

- **Primary**: `#F1F5F9`
- **Secondary**: `#CBD5E1`
- **Muted**: `#94A3B8`
- **Disabled**: `#64748B`
- **Active Accent**: `#FFB02E`

### Spacing

- **Panel Content Padding**: `10–12px`
- **Category Header Height**: `30–32px`
- **Node Item Height**: `28–30px`
- **Item Gap**: `4–6px`
- **Category Group Gap**: `10–12px`
- **Inspector Property Row Height**: `30–34px`
- **Property Label / Control Gap**: `8–12px`

---

## 6. Interaction States

### Hover

- Slight background brightness increase.
- Borders become subtly more visible.
- No strong glow.
- No layout movement.

### Active / Selected

- Use a category accent only where meaningful.
- Maintain high text readability.
- Avoid competing highlights.

### Disabled

- Reduced opacity.
- Muted text.
- No hover highlight.
- Clear disabled cursor behavior.

### Focus

- Thin `#FFB02E` border on editable controls.
- No oversized focus glow.
- Keyboard accessibility must remain intact.

### Dragging Nodes from Library

- Preserve the existing drag-and-drop behavior.
- Show a subtle dragged-item preview.
- Do not modify node placement logic.
- Avoid excessive scale or glow effects.

---

## 7. General Design Principles

- **Minimalism First**: Remove unnecessary decorative UI.
- **Consistent Color Coding**: Category colors must match node headers and socket design conventions.
- **Tinted Category Headers**: Use subtle category-specific background fills instead of dots.
- **Compact Layout**: Prioritize efficient vertical space usage.
- **Clear Hierarchy**: Panel → Category → Item → Property.
- **Subtle Separation**: Prefer low-contrast dividers and tinted surfaces.
- **Precise Alignment**: All texts, icons, shortcuts, and controls must align consistently.
- **Low Visual Noise**: Avoid bright gradients, excessive borders, and repetitive decorations.
- **Functional Consistency**: Preserve existing node names, counts, shortcuts, docking, scrolling, search, inspector editing, and drag-and-drop functionality.
- **No Unrequested Features**: Do not introduce additional controls, icons, animations, or UI elements unless explicitly requested.

**Final Design Direction:** A compact, professional dark-themed sidebar system featuring full-width category-tinted accordion headers, clean node item pills with thin category accent bars, minimal Inspector controls, restrained amber interaction highlights, and consistent typography. The Node Library and Inspector should feel like native parts of the same node editor rather than separate UI systems.
