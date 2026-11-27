# 16: Quality, Costs and Definition of Done

## Quality bar
- **TypeScript strict**, no `any` without a comment explaining why.
- **ESLint + Prettier** clean.
- **Unit tests** (Vitest) for logic: XP, streaks, grade calculation, SGPA/CGPA, progression hints, done-for-the-day rules, spaced repetition scheduling, thumbnail frame selection, the importers.
- **Component tests** for key UI (review form, quick logs, contribution grid).
- **E2E** (Playwright) for: login, log a workout, submit the nightly review, add + watch a video, check off a task, install manifests present per route.
- **CI:** a GitHub Actions workflow running typecheck, lint, tests and build on every push.
- **Performance:** first load on a mid-range laptop < 2.5 s (warm cache < 1 s); route switch < 200 ms; Lighthouse PWA/Performance/Accessibility ≥ 90 on Home and each section. The chess module (Stockfish/Pyodide) is lazy-loaded and must not affect other routes.
- **Accessibility:** WCAG AA contrast in both themes, keyboard navigation, focus visible, aria labels, reduced motion respected.
- **Offline:** the app shell opens offline; logs queue and sync later.
- **Security:** RLS on every table; no secrets in the client; public endpoint exposes only flagged stats; private buckets for photos/recordings; CSP headers (compatible with the embeds).
- **Privacy:** personal data (contacts, recordings, photos, body data, journal) never leaves Supabase except via JSON export / Obsidian mirror initiated by Dharma.

## Costs (must stay at $0)
| Service | Plan | Limits to respect |
|---|---|---|
| Supabase | Free | Pauses after about 1 week of low activity; 2 active free projects per org; 500 MB DB per project; 1 GB storage (keep recordings compressed: Opus/WebM, about 32 kbps) |
| Vercel | Hobby | Personal use; check function and cron limits |
| GitHub API | Free | Rate limits |
| YouTube Data API | Free | Daily quota (cache metadata; fetch once per video) |
| Chess.com PubAPI | Free, no key | Polite User-Agent, caching |
| LeetCode GraphQL | Free, unofficial | May break |
| Google Calendar API | Free | Testing-mode OAuth |
| Buffer | Free | 3 channels, 10 queued posts/channel, 1 API key |
| Apple Music embed | Free | Full tracks need Dharma's subscription |
| Tauri | Free | No code-signing |

**If any step requires payment, stop and log it in NEEDS-FROM-DHARMA.md.**

## Definition of done
- [ ] All pages and features in 06-10 work on Windows (Chrome + Edge) and iPhone 13 (Safari, standalone).
- [ ] All 5 PWAs install and open to the right section; data is shared.
- [ ] No AI features anywhere. No infinite scroll. No notifications except the Calendar review reminder.
- [ ] Design matches the heyalok.com style (dark default, pure black), full-width desktop with no dead gutters, original animated banners, smooth motion, reduced-motion support.
- [ ] Supabase schema documented in `docs/SCHEMA.md`; `daily_summary`, `weekly_summary` and `public_stats` views exist and are readable.
- [ ] Integrations work or fail gracefully: Google Calendar, GitHub, LeetCode, Chess.com, YouTube, Apple Music, Buffer.
- [ ] Nightly review auto-fills, saves, awards XP, and mirrors to Obsidian (Chrome/Edge + desktop).
- [ ] Weekly grade computed correctly; Sunday review screen works.
- [ ] Notion import scripts run (dry-run + real) on Dharma's export.
- [ ] Portfolio widget live in the DHARMA repo, showing only public stats.
- [ ] Tauri desktop app builds and runs on Windows.
- [ ] JSON export/import works.
- [ ] CI green. README explains setup, env vars, dev, build, deploy, and installing the 5 PWAs + the desktop app.
- [ ] PROGRESS.md has a final summary; NEEDS-FROM-DHARMA.md lists only what truly needs him.
