# Progress

## Current state
- **Phase:** 2 (Design system + shell) starting
- **Last finished:** Phase 1 (repo setup)
- **Next:** tokens.css, fonts, AppShell, components, /ui style guide
- **Blockers:** none (all secrets mocked via local mode; see NEEDS-FROM-DHARMA.md)

## How to resume
Read CLAUDE.md → this file → docs/PLAN.md (§9 phases, ticked tasks). Run `pnpm install && pnpm check`.

## Phase log
### Phase 0: research (2026-11-27)
Read the brief, cloned Cubicle/BOBBY/DHARMA into `_ref/` (gitignored), analysed heyalok.com with Playwright (`docs/DESIGN-ANALYSIS.md`), verified integration docs (PLAN §2.3), wrote PLAN/DECISIONS/NEEDS.

### Phase 1: repo setup (2026-11-27)
pnpm workspace, `apps/web` (Vite 6 + React 18 + TS strict, 5 HTML entries), ESLint 9 + Prettier, Vitest + RTL + fake-indexeddb, single API function + router + Vite dev middleware, `vercel.json` (rewrites, cron, CSP), CI workflow, GPL-3.0 licence + notices, `.env.example`.
Checks: typecheck, lint, test, build all green.
