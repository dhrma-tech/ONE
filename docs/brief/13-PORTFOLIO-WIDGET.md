# 13: Portfolio Widget ("Live from ONE")

## Goal
Dharma's portfolio (https://dharma-phi.vercel.app, repo https://github.com/dhrma-tech/DHARMA, code in `portfolio/`) shows live progress from ONE in real time.

## ONE side
- A **public, read-only endpoint**, e.g. `GET /api/public-stats` (Vercel function) → reads the `public_stats` view with the service role, returns **only stats whose public flag is on** in Settings. Default: all off.
- Candidate stats: lock-in day count, overall streak, current level, current focus (e.g. "Learning: Python data structures"), Python hours this week, GitHub pushes this week, Chess.com rapid rating, posts this month, books finished, workouts this month. **Never** weight, photos, diet, journal, contacts or recordings.
- Response is cached (e.g. `s-maxage=300, stale-while-revalidate`), CORS allowed for the portfolio origin only.
- JSON shape is versioned (`{ v: 1, updated_at, stats: {...} }`).

## Portfolio side (DHARMA repo)
1. **Inspect the code first** (framework, styling, components). It has no README.
2. Add a small **"Live from ONE"** section/widget **in the portfolio's own style** (not ONE's style): a few stat chips + "updated 3 min ago" + an optional mini contribution grid.
3. Fetch client-side (or at build time with ISR if it's Next.js; pick what fits).
4. **Fail silently:** if ONE is down or returns nothing, hide the widget.
5. Commit to the DHARMA repo on a branch, summarise the change in ONE's PROGRESS.md, and list any deploy step Dharma must do.

## LinkedIn and X
Their profiles **can't be auto-updated for free** through official APIs. Progress reaches them through **posts** (PERSONA › Compose via Buffer). Don't attempt scraping or unofficial automation.
