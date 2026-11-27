# 02: Source Repos

Clone and read all three before planning. They're Dharma's own, so reuse freely (check each LICENSE and keep notices where required: Cubicle is MIT, BOBBY is GPL-3.0; see the licence note below).

## 1. Cubicle: https://github.com/dhrma-tech/Cubicle
**What it is:** a free, login-free study catalogue of YouTube videos for AI/ML, organised as a syllabus.
- Stack: Vite, React 18, TypeScript (strict), plain CSS, hash routing.
- State: browser localStorage, no accounts.
- API: three Vercel serverless functions (`chat`, `news`, `video`).
- Pipeline: Python scripts `pipeline/01..07` + `run_all.py` (DuckDB over Hugging Face Hacker News data, YouTube oEmbed, YouTube Data API v3) → `data/taxonomy.json`.
- Features: about 12 sections and 100 topics, recommendation counts, freshness score + "outdated" tag, Liked / Watch later / Done, Explore page (HN, lab blogs, papers, GitHub news), timestamped notes, spaced review (3/7/30/90 days), daily plan, focus mode with Pomodoro, skill map, keyboard shortcuts, command palette, light/dark, installable PWA.
- Embeds via `youtube-nocookie.com`.

**Reuse in ONE:**
- The **app shell base** (Vite/React/TS setup, routing, command palette, keyboard shortcuts, focus mode/Pomodoro, notes, spaced review).
- The **Library** pattern for all 4 sections (05-SHARED-MODULES).
- The **Explore/news** function for CAREER › News room (with a hard cap).
- The pipeline as an optional **candidate finder**. Nothing goes live without Dharma's approval.
- **Remove:** the AI study guide UI, the `chat` function, and all AI provider keys/code.
- **Move state** from localStorage to Supabase (keep a local cache for offline use).

## 2. BOBBY: https://github.com/dhrma-tech/BOBBY
**What it is:** a chess learning app that runs fully in the browser.
- Stack: Vite, React 18, TypeScript, plain CSS, hash routing. Stockfish 18 (WASM), python-chess in Pyodide, chess.js, react-chessboard. Storage: IndexedDB via Dexie + localStorage.
- Features: play vs Bobby (adaptive) or 2-player, takebacks, hints, PGN/FEN import/export; rule-based coach (Stockfish + tactic detectors, **not an LLM**) with arrows; game review with accuracy, key moments, eval graph; 64 lessons; 22,010 puzzles with spaced repetition; endgame trainer; opening explorer (3,865 openings); "Scroll" curated chess video library (185 videos); daily progression; installable offline.
- Folders: `site/` (app, workers, tests), `py/` (Python core + pytest), `scripts/` (data builders), `data/` (puzzles, openings, lessons, videos JSON), `docs/`.

**Reuse in ONE:**
- Becomes **MIND › Chess**. Integrate, don't rewrite.
- BOBBY's "Scroll" videos seed **MIND › Library** (chess topic), subject to Dharma's approval.
- **Important technical risk:** multi-threaded Stockfish WASM usually needs cross-origin isolation (COOP/COEP headers, for SharedArrayBuffer). `COEP: require-corp` can **break third-party iframes** like the YouTube and Apple Music embeds used elsewhere in ONE. Check how BOBBY handles this. Options: scope the isolation headers to the chess route only, use `COEP: credentialless`, or fall back to single-threaded Stockfish. Decide, test, and record the choice in DECISIONS.md.
- Pyodide is heavy. Lazy-load the chess module so it never slows down the rest of ONE.

## 3. DHARMA: https://github.com/dhrma-tech/DHARMA
**What it is:** Dharma's portfolio, live at https://dharma-phi.vercel.app. The code is in the `portfolio/` folder. There's no README.
- Recent redesign direction (from Dharma): minimal leerob.com-style site, giant-name hero, palette "Paper + orange" (`#FAFAF9` / `#0A0A0A` / `#FF4F00`), fonts Inter Tight + Inter + Geist Mono, light/dark toggle. **Verify against the actual code.**

**Reuse:** add the **"Live from ONE"** widget (see 13-PORTFOLIO-WIDGET). Inspect the code first and match its style. Make changes in that repo as a separate, small PR-style commit set.

## Licence note
BOBBY is GPL-3.0. Including its code makes the combined ONE codebase GPL-3.0 when distributed. Dharma owns BOBBY, so he can relicense his own code. Flag this in DECISIONS.md and ask Dharma (via NEEDS-FROM-DHARMA.md) whether ONE should be GPL-3.0, or whether he relicenses. Default: make ONE GPL-3.0 and keep building.

## Repo layout for ONE
You decide between a pnpm workspace monorepo (e.g. `apps/web`, `packages/chess`, `packages/ui`) and a single app with folders. Recommendation: **pnpm workspace** with `apps/web` (the ONE PWA), `apps/desktop` (Tauri, later), `packages/chess` (from BOBBY), `packages/ui` (design system), `supabase/` (migrations, seed), `api/` or `apps/web/api` (Vercel functions), `scripts/` (migration, pipelines). Record the final choice in DECISIONS.md.
