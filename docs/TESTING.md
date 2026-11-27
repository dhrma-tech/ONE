# Testing

## Automated
| Command | What |
|---|---|
| `pnpm test` | Vitest: domain logic (done rules, XP, levels, streaks, weekly grade, achievements, task generation, SGPA/CGPA, milestone planner, SM-2, cube/math, body progression/PRs/rate hints, persona helpers, notes review, news cap, markdown, mirror files), data layer (repo, sync engine with a fake Supabase: push, incremental pull, LWW, bootstrap), seed, UI components (grid, stat, checklist, pager, nightly review form), server (routing, parsers, crypto, OAuth state, Google mapping, CORS, protected routes). |
| `pnpm db:check` | Runs every migration on real Postgres (PGlite) with stubbed Supabase schemas; checks RLS isolation, server-only tables, last-write-wins trigger, views, and that public stats return only flagged fields. |
| `pnpm build && pnpm e2e` | Playwright against the production build (service worker on), desktop 1440 and Pixel 7 profiles: 5 manifests (name, scope, standalone, maskable icon), section-app scoping via `?app=`, offline shell, check off a task, log a workout, submit the nightly review, add + open a video. The login test runs only when the build has Supabase env. Uses system Chrome; set `PW_CHANNEL=""` to use bundled Chromium. |
| CI (`.github/workflows/ci.yml`) | typecheck, lint, unit tests, build on every push. |

## Install matrix (manual)
Result log. Fill in when tested on the real devices.

| Platform | Master | Career | Mind | Body | Persona | Shared login | Offline open | Shortcuts |
|---|---|---|---|---|---|---|---|---|
| Windows 11 · Chrome | | | | | | | | |
| Windows 11 · Edge | | | | | | | | |
| iPhone 13 · Safari (Add to Home Screen) | | | | | | n/a (see below) | | n/a |

### Windows (Chrome / Edge)
1. Open the deployed URL (or `pnpm build && pnpm preview` → http://localhost:4173).
2. Master: address bar install icon → Install "ONE". Right-click the taskbar icon: Career / Mind / Body / Persona shortcuts.
3. Each section: open `/career/`, `/mind/`, `/body/`, `/persona/` → Install. Each opens to its section, shows only its section + Settings in the rail; links to other sections open the master app.
4. Same origin, so login, IndexedDB and Supabase session are shared across all five.
5. Offline: install, open once, turn Wi-Fi off, reopen. The shell loads; logs queue in the outbox and sync when back online.

### iPhone 13 (Safari)
1. Open each URL in Safari: `/`, `/career/`, `/mind/`, `/body/`, `/persona/`.
2. Share → Add to Home Screen. Check the icon and name (ONE, ONE Career, …).
3. Launch from the home screen: standalone (no Safari bars), safe areas respected (notch + home bar), dock at the bottom.
4. **Storage isolation:** iOS gives each home-screen web app its own storage. Expect to sign in once per home-screen app (magic link: open the email on the phone, the link lands in Safari; then reopen the home-screen app and sign in there too if needed). Data is shared through Supabase after login; each app keeps its own offline cache.
5. Microphone (PERSONA › Speak): Safari asks for permission on first record; recordings use MP4/AAC on iOS.
6. File System Access is not available on iOS: the Obsidian mirror is hidden there (by design).

## Not automatable here (needs Dharma's accounts/devices)
- Google OAuth consent + calendar push (needs the Google Cloud client).
- Buffer queueing (needs the personal API key and connected channels).
- Apple Music sign-in persistence inside installed PWAs and the desktop app: if the widget can't stay signed in, use the "Open in Apple Music" button in the music corner.
- iPhone install steps above.
