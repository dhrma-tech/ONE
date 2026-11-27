# 03: Design System

Design is Dharma's top priority. He wants ONE to be **artistic, beautifully designed, full of animation and well-architected**, in the style of **https://heyalok.com/**.

## Step 1: Analyse the reference in depth
Open https://heyalok.com/ (and its /blog and /works pages) in a real browser. Use devtools or a headless browser (e.g. Playwright) to extract and document in `docs/DESIGN-ANALYSIS.md`:
- every CSS custom property (light and dark)
- font families, sizes, weights, letter-spacing, line-heights, uppercase usage
- spacing scale, radii, border styles (including dashed borders and corner marks)
- every `@keyframes` animation: what it animates, duration, easing, delay, iteration, and when it triggers (load, hover, scroll, in-view)
- hover, focus and active states of buttons, cards, links and tiles
- component inventory: nav bar, banner, avatar block, section headers, cards, pill buttons, numbered index rows, terminal strips, quote block, footer, ⌘K palette, toasts (it uses Sonner)
- scroll and page-transition behaviour
- how the theme toggle works (`d` key)
- responsive behaviour at mobile, tablet and desktop widths
- screenshots of each component state into `docs/design-ref/` (for your own reference; **don't ship them**)

Then rebuild that **design language** for ONE: same feel, same motion vocabulary, same component quality.

### Do not copy
- His images, avatar, banner illustrations, icons that are his own, or any of his text.
- His source code. Write our own components that produce the same style.
- His arcade/rocket game. Games don't belong in a lock-in app.

## Step 2: Tokens (observed on heyalok.com, 2026-11-27; verify)

### Dark theme: DEFAULT
| Token | Value |
|---|---|
| background | `#000` |
| card / popover / sidebar | `#171717` |
| muted / accent / secondary | `#262626` |
| foreground | `#fafafa` |
| muted-foreground | `#a1a1a1` |
| primary | `#e5e5e5` (primary-foreground `#171717`) |
| border | `#ffffff1a` |
| input | `#ffffff26` |
| ring | `#737373` |
| destructive | `#ff6568` |
| footer | `#0e0c0f` |
| chart-1..5 | `#d4d4d4`, `#737373`, `#525252`, `#404040`, `#262626` |

### Light theme (toggle)
| Token | Value |
|---|---|
| background | `#f8f0fa` |
| card / sidebar | `#faf3fc` |
| foreground | `#171318` |
| muted | `#efe9f0` |
| muted-foreground | `#6c676d` |
| accent | `#ede6ee` |
| secondary | `#f2ecf4` |
| primary | `#221b24` (primary-foreground `#fbf9fb`) |
| border | `#e3dde5` |
| input | `#eae4eb` |
| ring | `#b0a7b2` |
| destructive | `#ee3533` |
| footer | `#efe8f0` (footer-foreground `#373038`) |
| chart-1..5 | `#d4c5d7`, `#9b919d`, `#6e666f`, `#49434a`, `#2c272d` |

### Radius
`--radius: .625rem`

### Contribution grid (green boxes): reserved for grids only
- Dark: `#1f1f1f` (0), `#123f23`, `#166634`, `#2a984b`, `#4ecf6b` (4)
- Light: `#e9e4ea` (0), `#ace4bc`, `#6ed08c`, `#3aab60`, `#218041` (4)

### Section accents
Propose 4 accents (CAREER, MIND, BODY, PERSONA) that:
- read clearly on `#000` and on `#f8f0fa`, with WCAG AA contrast for text use
- are clearly distinct from each other and from the contribution greens
- fit the soft, slightly playful palette

Put the proposal with swatches in DESIGN-ANALYSIS.md and pick one. Dharma can change it later in Settings.

### Fonts (observed)
- Body: **Geist Pixel Square** (`geistPixelSquare`), a pixel-style monospace
- Display/headings: **Pixelify Sans**
- Also used: **Geist Mono** and **Inter**

Check each font's licence (Geist is from Vercel; Pixelify Sans is on Google Fonts). Self-host via `@fontsource` or files. If a licence doesn't allow it, use the closest open alternative and log it. Big numbers (stats) should use Geist Mono or Pixelify Sans for character. Long text (notes, journal) must stay readable: use Inter or Geist for paragraphs if the pixel font hurts readability.

## Step 3: Motion
Observed keyframes on heyalok.com: `banner-fall`, `banner-sway`, `iso-scene-in`, `works-ripple`, `contribution-cell-settle`, `toolbox-route-march`, `route-index-march`, `route-index-pulse`, `scene-write`, `scene-ribbon-sway`, `scene-heart-float`, `scene-ink`, `scene-type`, `scene-blink`, `scene-steam-rise`, `project-art-key-pulse`, `project-art-clock-pulse`, `project-art-clock-tick`, `project-art-blink`, `project-art-nudge`, `project-art-arrow-nudge`, `project-art-packet-run`, `project-art-chunk-run`, `project-art-pulse`, `project-banner-ping`, plus `spin`, `ping`, `pulse`, `enter`/`exit`, swipe-outs and Sonner toast fades.

Build an equivalent **motion system** for ONE:
- **Banner scenes:** gentle sway, fall, steam, blink and typing loops (section 3.5 below).
- **Contribution grid:** cells "settle" in on first view (staggered), with a subtle pulse on today's cell.
- **Index rows / section tiles:** "march" (an arrow nudges on hover), and a pulse on the active one.
- **Cards:** lift and border-brighten on hover, crisp press state.
- **Numbers:** count-up when stats come into view.
- **Page transitions:** short fade/slide (≤200ms).
- **Toasts:** Sonner-style, for "Logged." confirmations.
- **Reduced motion:** honour `prefers-reduced-motion` (turn loops off and keep only opacity fades) plus a Settings toggle.
- **Performance:** animate only `transform` and `opacity`; pause loops when off-screen (IntersectionObserver) or when the tab is hidden. Target 60fps on a mid-range laptop and an iPhone 13.

## Step 4: Layout
**Fix the reference's main weakness:** heyalok.com is a narrow centred column with large empty gutters on desktop. ONE must not have that.
- **Desktop (≥1024px):** a left icon rail (Home, CAREER, MIND, BODY, PERSONA, Settings) + content up to about **1440px**, filling the width. Home and Analytics use a **bento grid** (12 columns; cards span 3/4/6/8/12).
- **Tablet (768-1023px):** collapsible rail, 2-column bento.
- **Phone (<768px):** **bottom dock** with the same items, single column, thumb-reachable primary actions, safe-area insets for the iPhone notch and home bar.
- Keep heyalok's signature details: dashed blueprint borders with `+` corner marks around sections, pill buttons (`SHOW ALL →`), numbered index rows (`01`, `02`…) with small uppercase labels, terminal strips, the big quote block, the footer with a curved notch, the `⌘K` hint, hand-drawn arrow annotations (use sparingly, e.g. first-run hints).

## Step 5: Original banner art (you draw it)
Each page gets an **original, animated, pixel-style scene** in SVG/CSS (no raster AI images, no stock):
- **Home:** a small room at night: a desk with a glowing monitor, a chessboard, dumbbells, a mic. All 4 sections in one scene.
- **CAREER:** a desk at night, code scrolling on a monitor, steam rising from a cup, a blinking cursor.
- **MIND:** a chessboard with a piece gliding, a seated meditating figure with a slow breathing glow.
- **BODY:** a barbell and plates, a sunrise through a window, a clock reading 6:30.
- **PERSONA:** a stage mic, speech bubbles popping, dotted connection lines between nodes.
- **Settings:** gears with a slow tick.

Keep scenes calm, roughly 200-280px tall on desktop and smaller on phone, layered for parallax-free depth, and theme-aware (they recolour for light/dark and use the section accent).

## Step 6: Component library
Build `packages/ui` (or `src/ui`) with documented components: `Rail`, `Dock`, `Banner`, `SectionHeader` (dashed frame + corner marks), `Card`, `StatCard` (count-up), `IndexRow`, `PillButton`, `TerminalStrip` (Run/Stop), `ContributionGrid`, `TrendChart` (simple line/bar, no heavy chart library unless justified), `ProgressRing`, `Checklist`, `QuickLog` (one-tap logging), `Toast`, `CommandPalette`, `Modal`/`Sheet`, `Tabs`, `Empty` (with dry humour), `QuoteBlock`, `Footer`, `VideoCard`, `VideoPlayer`. Add a hidden `/ui` route that shows every component in every state (a living style guide).

## Accessibility
- WCAG AA contrast in both themes.
- Full keyboard navigation; visible focus rings.
- Proper labels on icon-only buttons.
- No information carried by colour alone (grids get tooltips/aria labels with counts).
