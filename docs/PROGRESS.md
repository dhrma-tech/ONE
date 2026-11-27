# Progress

## Current state
- **Phase:** 6 (CAREER) starting
- **Last finished:** Phase 5 (shared modules)
- **Next:** CAREER tabs: Path, Library, Practice, Build, News, Reading, Notes, College, Analytics
- **Blockers:** none (all secrets mocked via local mode; see NEEDS-FROM-DHARMA.md)

## How to resume
Read CLAUDE.md → this file → docs/PLAN.md (§9 phases, ticked tasks). Run `pnpm install && pnpm check`.

## Phase log
### Phase 0: research (2026-11-27)
Read the brief, cloned Cubicle/BOBBY/DHARMA into `_ref/` (gitignored), analysed heyalok.com with Playwright (`docs/DESIGN-ANALYSIS.md`), verified integration docs (PLAN §2.3), wrote PLAN/DECISIONS/NEEDS.

### Phase 1: repo setup (2026-11-27)
pnpm workspace, `apps/web` (Vite 6 + React 18 + TS strict, 5 HTML entries), ESLint 9 + Prettier, Vitest + RTL + fake-indexeddb, single API function + router + Vite dev middleware, `vercel.json` (rewrites, cron, CSP), CI workflow, GPL-3.0 licence + notices, `.env.example`.
Checks: typecheck, lint, test, build all green.

### Phase 2: design system + shell (2026-11-27)
Tokens (exact heyalok semantic palette, dark default, lavender light), fonts (Geist Pixel Square vendored from `geist` npm with OFL, Pixelify Sans, Geist Mono, Inter via Fontsource), motion system (settle/march/ping/sway/steam/blink/type/tick/breathe/pop/glide/dash; loops gated by IntersectionObserver + visibility; reduced motion), layout (rail / collapsible rail / dock with safe areas, 12-col bento up to 1440px), ~35 components in `src/ui`, 6 original animated pixel scenes in `src/art/scenes.tsx`, `/ui` living style guide, global shortcuts (g x, d, ?, Ctrl+K hook).
Verified by screenshots at 1440 (dark) and 390 (light): no horizontal overflow. Tests: grid, stat, checklist, pager.

### Phase 3: data layer (2026-11-27)
69 tables defined once in `src/data/schema.ts` → generated SQL migration, TS row types and SCHEMA.md (`pnpm db:gen`). Hand-written views (`daily_summary`, `weekly_summary`, `public_stats`) and private storage buckets. `pnpm db:check` runs all migrations on real Postgres (PGlite) and verifies RLS isolation, LWW trigger, views, public-stats filtering.
Client: Dexie mirror + outbox, repo (insert/patch/softDelete/upsertBy), live hooks, sync engine (push outbox in FK order, incremental pull by server `synced_at`, LWW, conflict log, first-login bootstrap), Supabase magic-link auth + gate, local mode when env is empty, idempotent brief-17 seed with deterministic ids.
Tests: 20 passing.

### Phase 4: Home (2026-11-27)
Domain logic (pure + tested): per-day facts, done rules per section, section/master levels, streaks with never-miss-twice, weekly grade (9 checks + reward rule), XP table, 28 achievements, daily task generation (habits, path, note reviews, follow-ups, exam units, One Thing). Services: settings/targets, live facts, whole-history summary, XP awards (idempotent), achievements unlock, tasks.
Home: banner + profile (Day N, level/XP, streak, miss flag), Today (One Thing, grouped tasks, inline add, star to pin), calendar card (mock until Phase 10), section index tiles with rings/streaks/key stats, master grid, week strip with live grade, focus terminal (global focus mode + dimming + Block 1 XP), next-up video, nightly review (auto-fill, draft autosave, submit → toast/XP/grid), achievements shelf, exam banner, daily quote, footer.
Checked at 1440 and 390. Tests: 36 passing.

### Phase 5: shared modules (2026-11-27)
Library (next-up sort, queue/done/inbox with paging, add video via /api/video, bulk import, candidate packs from Cubicle (568) and BOBBY (180) built by `scripts/packs/build-packs.mjs`), distraction-free watch page (postMessage IFrame API on youtube-nocookie, ONE pause + end cards so no YouTube suggestions show, resume, done at 90%, N for timestamped notes, focus dim), frame thumbnails with fallback chain, analytics kit (grid, stats, trend, lagging-in, range), path editor (lanes, stages, gates, reorder), command palette with regex parser + help sheet, music corner (Apple Music embed converter, stays mounted), quick-log services, server auth helper.
Tests: 47 passing.
