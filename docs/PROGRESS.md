# Progress

## Current state
- **Phase:** 4 (Home) starting
- **Last finished:** Phase 3 (data layer)
- **Next:** domain logic (done rules, XP, streaks, grade) + Home page
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
