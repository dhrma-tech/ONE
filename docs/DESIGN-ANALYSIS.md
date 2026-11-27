# Design Analysis: heyalok.com → ONE

Captured 2026-11-27 with headless Chrome (Playwright, 1440 / 820 / 390 px, dark + light). Raw extraction: `docs/design-ref/analysis.json`. Screenshots in `docs/design-ref/` are reference only and are **not shipped** (the folder is excluded from the app build).

Nothing below is copied code or art. These are observations of the design language; ONE re-implements it with its own CSS, SVG and copy.

---

## 1. Stack observations
- Next.js + Tailwind v4 (oklab/lab colour fallbacks, `@supports (color: lab())` blocks), shadcn-style semantic tokens, Sonner toasts.
- Theme is a class on `<html>` (`light` / `dark`) plus inline `color-scheme`. Pressing `d` toggles it (verified: class flipped `light` → `dark`, background `#f8f0fa` → `#000`). A hand-drawn arrow annotation points at the toggle: "Click here to switch the theme or press d".
- Headless first paint was **light**, so the site defaults to light (or system). ONE defaults to **dark** per the brief.

## 2. Colour tokens (verified, match the brief)

### Dark (`.dark`)
| Token | Value |
|---|---|
| background | `#000` |
| foreground | `#fafafa` |
| card / popover / sidebar | `#171717` |
| muted / accent / secondary | `#262626` |
| muted-foreground | `#a1a1a1` (8.1:1 on #000, 6.9:1 on #171717) |
| primary / primary-fg | `#e5e5e5` / `#171717` |
| border / input / ring | `#ffffff1a` / `#ffffff26` / `#737373` |
| destructive | `#ff6568` |
| footer / footer-fg | `#0e0c0f` / `#e7e3e8` |
| chart-1..5 | `#d4d4d4 #737373 #525252 #404040 #262626` |
| contrib-0..4 | `#1f1f1f #123f23 #166634 #2a984b #4ecf6b` |
| banner particles p1..p4 | `#fff #e0f2fe #dbeafe #bae6fd` |

### Light (`:root`)
| Token | Value |
|---|---|
| background | `#f8f0fa` |
| foreground | `#171318` |
| card / sidebar | `#faf3fc` |
| muted | `#efe9f0` |
| muted-foreground | `#6c676d` (4.96:1 on bg, AA) |
| accent / secondary | `#ede6ee` / `#f2ecf4` |
| primary / primary-fg | `#221b24` / `#fbf9fb` |
| border / input / ring | `#e3dde5` / `#eae4eb` / `#b0a7b2` |
| destructive | `#ee3533` |
| footer / footer-fg | `#efe8f0` / `#373038` |
| chart-1..5 | `#d4c5d7 #9b919d #6e666f #49434a #2c272d` |
| contrib-0..4 | `#e9e4ea #ace4bc #6ed08c #3aab60 #218041` |

### Extra token family seen: "neo" (neumorphic toggle knobs)
`--neo-base`, `--neo-rim`, `--neo-shade`, `--neo-knob-*`, `--neo-track-shadow*`, `--neo-accent` (`#61da92` dark / `#007e46` light). Used for the soft inset switches. ONE uses the same idea for its `Switch` component (inset track + raised knob), with its own values.

### Radius
`--radius: .625rem` (10px) for large surfaces, but the **dominant computed radius is 2px** (370 elements: chips, index rows, kbd, tiles). Pills use `9999px`. Others: 6px, 8px. ONE: `--r-xs 2px`, `--r-sm 6px`, `--r-md 10px`, `--r-pill 9999px`.

## 3. Typography
| Role | Family | Observed |
|---|---|---|
| Body (default) | **geistPixelSquare** (Geist Pixel, Square variant), weight 500 | 16px/24px, 1,353 elements |
| Secondary UI / dates / numbers | **Geist Mono** | 618 elements; dates like `July 2025 - Present` |
| Display / name | **Pixelify Sans** 400-700 | the hero name and section titles like "Projects" |
| Long text | Inter (variable) | rare (15 elements) |

Scale observed (size/line/weight/tracking/case):
- `16/24/500` body; `14/20/500` secondary; `12/16` meta
- Micro labels: `10/15/500/1px/UPPERCASE`, `9/13.5/500/1.44px/UPPERCASE`, `11/16.5/500/1.76px/UPPERCASE`, `8/12/500/1.12px/UPPERCASE`. Tracking is about **0.1-0.16em** on uppercase micro labels.
- Hero numerals `88/88`, section titles `22-24px`, card titles `18/28/600/-0.45px`.
- Weight is almost always **500**; emphasis comes from font family (pixel vs mono) and size, not bold.

**Licences (checked):** Geist / Geist Mono / Geist Pixel: SIL OFL 1.1 (vercel/geist-font, vercel/geist-pixel-font). Pixelify Sans: SIL OFL 1.1 (Google Fonts). Inter: SIL OFL 1.1. All self-hosted via `@fontsource` packages (`@fontsource/geist-pixel`, `@fontsource/pixelify-sans`, `@fontsource-variable/geist-mono`, `@fontsource-variable/inter`).

**ONE readability rule:** pixel body font for UI chrome and short labels; **Inter** for paragraphs, journal, notes, markdown and any text over two lines. Big stats in **Pixelify Sans** (hero numbers) or **Geist Mono** (tabular numbers).

## 4. Borders and frames
- `1px dashed var(--border)` frames around every section (14+ elements), often at reduced opacity (`/0.6`, `/0.7`, `/0.8`).
- **Corner marks:** small `+` glyphs sit on each corner of a dashed section frame (visible at every section corner in the screenshots). ONE's `SectionFrame` draws them with four absolutely positioned 9px pseudo-crosses.
- Section dividers: a horizontal hairline with a centred pill button ("SHOW ALL EXPERIENCE →").
- Dotted leader lines inside index rows between label and arrow.

## 5. Motion catalogue (all observed `@keyframes`)
| Name | What it animates | Duration / easing / iteration | Trigger |
|---|---|---|---|
| `banner-fall` | particles along a motion path (`offset-distance` 0→100%), opacity fades in to `--banner-opacity`, scale .7→1 | 14-23 s, linear, infinite, **negative random delays** so the scene starts mid-flight | load |
| `banner-sway` | `translateX(±var(--banner-drift))` | 3.1-5.8 s, ease-in-out, infinite, alternate | load |
| `iso-scene-in` | opacity 0→1, `translateY(6px→0)` | 480 ms, `cubic-bezier(.22,1,.36,1)` | in-view |
| `works-ripple` | ring scale .55→2.8, opacity .65→0 | 2.4 s ease-out infinite, second ring delayed 1.2 s | load (active timeline dot) |
| `contribution-cell-settle` | opacity 0→1, `translateY(5px) scale(.55)` → none | 220 ms, `cubic-bezier(.22,1,.36,1)`, delay **+2 ms per cell** (0.02 s → ~0.75 s) | in-view |
| `route-index-march` / `toolbox-route-march` | dashed background `background-position-x` → 13px (marching ants) | linear infinite | hover / active row |
| `route-index-pulse` | dot scale 1→2.4, opacity .55→0 | infinite | active index row |
| `scene-write`, `scene-ink`, `scene-type` | pen wiggle; SVG `stroke-dashoffset` 70/80→0 (drawing/typing) | loops | load |
| `scene-blink` | step opacity 1/0 at 48-49% (cursor) | loop | load |
| `scene-steam-rise` | opacity .12→1→.12, `translateY(4→-10px)` | loop | load |
| `scene-ribbon-sway`, `scene-heart-float` | small rotate/translate floats | alternate loops | load |
| `project-art-*` | key pulse (`fill-opacity`), clock tick (rotate 360), blink, nudge (±1.5px shake), arrow-nudge (2px), packet-run / chunk-run (translateX 160/96px with fade ends), pulse (scale 1.05) | loops | in-view / hover |
| `project-banner-ping` | ping scale .25→3.4 | loop | load |
| `blog-quote-word-in` | per-word opacity + blur(6px)→0 | 280 ms, `cubic-bezier(.22,1,.36,1)`, +60 ms per word | in-view |
| `blog-loading-in`, `blog-skeleton-sweep` | skeleton entrance / shimmer | | loading |
| `spin`, `ping`, `pulse`, `enter`/`exit` | Tailwind/animate utilities for dialogs | 150 ms default transitions (`cubic-bezier(.4,0,.2,1)`) | open/close |
| `sonner-fade-in/out`, `swipe-out-*` | toast scale .8↔1 + opacity; swipe dismiss | | toast |

Signature easing: **`cubic-bezier(.22, 1, .36, 1)`** (soft overshoot-free "out-quint"). Default transition 150 ms.

## 6. Hover / focus / press
- Nav links: icon + label, colour shift muted → foreground, no underline.
- Pill buttons: dashed hairlines either side, uppercase 10px tracked label, arrow `→` that nudges right on hover (`project-art-arrow-nudge`).
- Index rows: number `01` + uppercase category + title + circular arrow button; on hover the row gets the marching dashed underline and the arrow circle fills; active row has a pulse dot.
- Cards: border brightens (`--border` → `--ring`), subtle lift; press = translateY(1px).
- Focus: `--ring` outline.

## 7. Component inventory
Top bar (floating at the top of the column, with a **notched/angled tab shape** cut into the banner), banner illustration with avatar overlapping its bottom-left, name in Pixelify + handle in mono, social icon row, view counter (`3,431 👁`), Experience list with date chips, GitHub contribution grid with month labels + Mon/Wed/Fri labels + "Less ■■■■ More" legend + "478 contributions in 2026", "Show all" pill dividers, Extras list item with icon tile + date + arrow, **Route index** (numbered rows `01 ARCADE Play rocket game →` inside a dashed table with header `ROUTE INDEX · 07 entries · IDLE`) next to a **preview panel** that shows the hovered route, big **quote block** (centred, 28px, attribution in uppercase micro text between hairlines), **footer** with a curved notch on its top edge, column headers in uppercase micro text, icon links. ⌘K palette: blurred full-page backdrop, a single rounded (`10px`) search card with search icon and `ESC` kbd. Hand-drawn SVG arrows with handwritten notes ("Watch this").

Decorations in the gutters (palm leaves, a red tree, a cat) are his art: **not reused**. ONE puts content in that space instead.

## 8. Layout and responsiveness (the weakness)
- At 1440px the content column is **~660px wide** (x ≈ 384 → 1047). About 54% of the viewport is gutter, filled with decoration.
- At 820px the column fills ~90%; at 390px it is full width with 16px padding.
- **ONE fix:** left icon rail (72px) + content up to **1440px** using a 12-column bento grid with 16px gaps. No decorative gutters. Tablet: collapsible rail + 2-column bento. Phone: bottom dock + single column + safe-area insets.

## 9. Section accents (proposal + pick)
Requirements: AA on `#000` and `#f8f0fa`, distinct from each other and from the contribution greens, soft and slightly playful.

| Set | CAREER | MIND | BODY | PERSONA | Notes |
|---|---|---|---|---|---|
| **A (picked)** | Amber `#ffb224` / light `#9a5a00` | Lavender `#b69cff` / `#6a3fd1` | Coral `#ff7a6b` / `#b8322a` | Sky `#4cc3ff` / `#0b6aa8` | Warm-cool balance, no green |
| B | `#f5a524` / `#94560a` | Orchid `#c084fc` / `#7e3fb8` | Rose `#fb7185` / `#b4234a` | `#38bdf8` / `#0369a1` | Rose and orchid too close in hue |
| C | `#fbbf24` / `#8a5a00` | Periwinkle `#a5b4fc` / `#4f46c8` | Red `#f87171` / `#b91c1c` | Teal `#2dd4bf` / `#0f766e` | Teal collides with contribution greens |

Contrast (Set A): dark accents on `#000` 8.3-11.7:1, on `#171717` 7.0-9.9:1; light accents on `#f8f0fa` 4.9-5.8:1. All pass AA for normal text.

Swatches (rendered in the `/ui` style guide): CAREER ■ `#ffb224`, MIND ■ `#b69cff`, BODY ■ `#ff7a6b`, PERSONA ■ `#4cc3ff`. Dharma can override each accent in Settings › Appearance.

## 10. What ONE takes, what it changes
| Take (style) | Change |
|---|---|
| Pure black dark theme, lavender light theme, exact semantic tokens | Dark is default; theme stored in settings |
| Pixel body + Pixelify display + Geist Mono numbers | Inter for long text |
| Dashed frames with `+` corners, pill dividers, index rows, terminal strips, quote block, notched footer, ⌘K | Full-width bento layout, rail/dock navigation |
| Motion vocabulary: settle, march, pulse, sway, steam, blink, type, ink | Loops pause off-screen and on hidden tabs; reduced-motion and a Settings toggle |
| Sonner-style toasts | Copy is ONE's dry TARS/Rocky tone |
| Hand-drawn annotation arrows | Only as first-run hints |
| — | No arcade game, no view counter, no gutter decorations, none of his art or text |
