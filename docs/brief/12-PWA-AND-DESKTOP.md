# 12: PWA (5 installable apps) and Desktop

## Goal
Dharma can install **5 separate apps** from one codebase:

| App | start_url | scope | What it opens |
|---|---|---|---|
| **ONE** (master) | `/` | `/` | Home + everything |
| **ONE Career** | `/career/` | `/career/` | CAREER only (focus mode) |
| **ONE Mind** | `/mind/` | `/mind/` | MIND only |
| **ONE Body** | `/body/` | `/body/` | BODY only |
| **ONE Persona** | `/persona/` | `/persona/` | PERSONA only |

Same origin → **one login, one database, shared progress**.

## How to build it (recommended approach; verify in browsers)
- Use **Vite multi-page entries**: `index.html`, `career/index.html`, `mind/index.html`, `body/index.html`, `persona/index.html`. Each HTML links **its own manifest** (`/manifest.webmanifest`, `/career/manifest.webmanifest`, …) and its own `apple-touch-icon`. All entries load the same app bundle; the entry sets a "scope mode" so section apps hide the rail/dock items of other sections.
  - Why not swap the manifest `<link>` dynamically in an SPA: browsers read the manifest at load/install time, so dynamic swapping is unreliable. Separate HTML entries are robust.
- Each manifest: a **unique `id`**, `name`, `short_name`, `start_url`, `scope`, `display: standalone`, `theme_color` (#000), `background_color` (#000), icons 192/512 + maskable, in the **section accent**.
- The master manifest also gets `shortcuts` to /career, /mind, /body, /persona (right-click the taskbar icon on Windows).
- **One service worker at the root scope** (`/sw.js`, scope `/`) controls all of them. Precache the app shell and fonts; runtime-cache API GETs with stale-while-revalidate; queue POSTs offline (Background Sync where supported; otherwise retry on next open).
- Section apps: links to other sections inside a section app open in the master app/browser (or are hidden). Within its scope, the app stays standalone.

## Test matrix (must pass)
- Windows 11: **Chrome** and **Edge**: install all 5; each opens to the right section; login is shared; offline open works; shortcuts work.
- iPhone 13 (iOS, Safari): **Add to Home Screen** for each of the 5 URLs. Check: correct icon/name, standalone mode, safe areas, whether each home-screen app needs its own login (iOS may isolate storage per web app; if so, document it and make magic-link login painless).
- Record results in `docs/TESTING.md`.

## Desktop app (after the PWA is complete)
- **Tauri** wrapper around the same web build (`apps/desktop`).
- Adds:
  1. **Seamless Obsidian mirror** (direct filesystem writes to the chosen vault folder; no permission prompts each session).
  2. **Optional distraction blocker** during focus sessions: Dharma maintains a blocklist (instagram.com, youtube.com, x.com…). Implementation options: edit the hosts file (needs admin; risky), or simpler: a full-screen focus overlay + "are you sure?" friction. Pick the safest approach that works without admin rights and log the decision. Never break system networking.
  3. Global shortcut to open ONE (e.g. Ctrl+Alt+O) and a tray icon.
- Windows code-signing is **not needed** (personal use; Dharma accepts the SmartScreen warning). Document how to build the `.msi`/`.exe` locally.
- Apple Music embed: test sign-in persistence inside the Tauri webview (WebView2). If it fails, use the "Open in Apple Music" fallback.
