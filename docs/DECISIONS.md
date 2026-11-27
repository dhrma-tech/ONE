# Decisions

| Date | Decision | Why |
|---|---|---|
| 2026-11-27 | pnpm workspace: `apps/web`, `apps/desktop`, `packages/chess`, `supabase/`, `scripts/`. UI library inside `apps/web/src/ui`, not a separate package. | Only one consumer of the UI; a package adds build plumbing for nothing. |
| 2026-11-27 | ONE is **GPL-3.0-only**. Cubicle MIT notice kept in THIRD_PARTY_NOTICES.md. | BOBBY (GPL-3.0) is included. Dharma can relicense his own code later (asked in NEEDS). |
| 2026-11-27 | **No COOP/COEP headers.** | BOBBY already runs Stockfish 18 *lite single-thread* WASM, which needs no SharedArrayBuffer. Keeps YouTube/Apple Music iframes working everywhere. |
| 2026-11-27 | BOBBY runs as a separate Vite build at `/chess-app/`, loaded in a same-origin iframe on `/mind/chess` only, with a ONE theme override and a postMessage bridge. | "Integrate, don't rewrite": zero changes to its internals, total CSS/global isolation, and Pyodide never loads on other routes. |
| 2026-11-27 | Server functions on **Vercel**, as **one** function (`apps/web/api/index.ts`) with an internal router. | Vercel Hobby caps a deployment at 12 functions; Cubicle already used Vercel. |
| 2026-11-27 | Vercel Cron: one daily job (06:00 IST) for snapshots; on-demand refresh with TTL from the UI. | Hobby cron runs at most once per day (±59 min). |
| 2026-11-27 | Pinned proven toolchain: React 18.3, Vite 6, Vitest 3, TypeScript 5.9, ESLint 9, react-router-dom 6. | npm latest majors (React 19, Vite 8, TS 7, ESLint 10) are newer than both source repos; `react-chessboard@4` needs React 18. Upgrade later as a single task. |
| 2026-11-27 | **Local mode**: if `VITE_SUPABASE_URL` is unset, ONE runs fully on IndexedDB with no auth. | The env-flag mock that lets everything be built and used before the Supabase project exists. |
| 2026-11-27 | Local-first data: Dexie tables mirror Postgres 1:1, outbox push, `updated_at` pull, last-write-wins, soft deletes. | Instant UI, offline logging, simple and debuggable. |
| 2026-11-27 | Flashcards use **SM-2**, not FSRS. | Simpler, fully unit-testable; the brief allows it. Interface allows a later FSRS swap. |
| 2026-11-27 | Section accents Set A: CAREER amber `#ffb224`/`#9a5a00`, MIND lavender `#b69cff`/`#6a3fd1`, BODY coral `#ff7a6b`/`#b8322a`, PERSONA sky `#4cc3ff`/`#0b6aa8`. | AA on both backgrounds, distinct from each other and from contribution greens. See DESIGN-ANALYSIS §9. |
| 2026-11-27 | Fonts: Geist Pixel Square (UI), Pixelify Sans (display), Geist Mono (numbers), Inter (long text), self-hosted via Fontsource. | All SIL OFL 1.1. Inter keeps journal/notes readable. |
| 2026-11-27 | Thumbnails: `mq2.jpg` for cards, `hq2.jpg` for posters, fallback chain → generated accent card. | Verified frame images exist (1/2/3, mq, hq, sd, maxres) on sampled videos; missing ones 404. |
| 2026-11-27 | Google OAuth scopes: `calendar.app.created`, `calendar.events.readonly`, `calendar.calendarlist.readonly`. Recommend publishing the consent screen "In production" (unverified, single user). | Least privilege; Testing-mode refresh tokens expire after 7 days. |
| 2026-11-27 | Buffer via the new GraphQL API (`api.buffer.com`) with a personal API key. | The legacy REST API is closed to new apps. |
| 2026-11-27 | Charts are hand-written SVG; toasts use `sonner`. | Bundle size; heyalok uses Sonner and its feel matches. |
| 2026-11-27 | Late-night rule: between 00:00 and 04:00 the nightly review targets the previous date. | Dharma's review is 23:30-00:00 and lights out ~00:15. |
| 2026-11-27 | YouTube IFrame Player API is driven over postMessage (Cubicle's approach), not by loading `youtube.com/iframe_api`. | Same API, no third-party script, tighter CSP. Pause and end states are covered by ONE's own cards, so YouTube's pause/end suggestions never show. |
| 2026-11-27 | Library candidates ship as small static "packs" (top 6 per Cubicle topic, all 180 Bobby chess videos) imported into the Inbox on demand. | The full Cubicle catalogue (6,647 videos, 2 MB) is too big to ship; nothing is approved automatically. |
