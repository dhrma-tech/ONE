# 15: Planning Instructions (what `docs/PLAN.md` must contain)

Write the plan **from a development perspective**: long, detailed, precise, accurate. It's your build contract. Then **execute it fully, phase after phase, without stopping** (see 00 and CLAUDE.md).

## Before writing the plan
1. Read every file in `docs/brief/`.
2. Clone and read **Cubicle**, **BOBBY** and **DHARMA**. List concretely which files/modules you'll reuse, move, refactor or delete.
3. Analyse **heyalok.com** and write `docs/DESIGN-ANALYSIS.md` (03, step 1).
4. Check the current docs of every integration in 11 (Supabase free limits, Vercel Hobby limits incl. cron, Google OAuth testing-mode token behaviour, Buffer API, YouTube Data API quota, Chess.com PubAPI, LeetCode GraphQL shape, GitHub GraphQL, Apple Music embed behaviour). Note anything that differs from the brief.

## PLAN.md structure (required sections)
1. **Summary:** what ONE is, in 5 lines.
2. **Findings:** what you learned from the repos, the design analysis and the API checks. Every deviation from the brief, with the reason.
3. **Architecture:** a diagram (Mermaid) of client ↔ IndexedDB ↔ Supabase ↔ server functions ↔ third parties; folder structure (full tree); routing; state management; offline/sync strategy; how the 5 PWAs are wired.
4. **Data model:** final tables, columns, types, indexes, RLS policies, views (`daily_summary`, `weekly_summary`, `public_stats`). This becomes `docs/SCHEMA.md`.
5. **Design system plan:** tokens, fonts (with licences), section accents (final picks), the component list, the motion catalogue (each animation: name, trigger, duration, easing), banner scenes (a description per scene), and the responsive breakpoints.
6. **Feature breakdown:** every page and sub-page from 06-10, each with its components, data reads/writes, edge cases and the "done-for-the-day" rule.
7. **Integrations:** each one's auth flow, endpoints, caching, failure handling, and secrets.
8. **XP/levels/streaks/achievements:** the exact rules and tables.
9. **Phases:** an ordered list. For each phase: goal, task checklist (granular, about 1-3 hours each), files touched, tests, **exit criteria**, and the commit/push point. Suggested order (adjust if you have a better reason, and say why):
   1. Repo setup (workspace, lint, typecheck, test, CI via GitHub Actions, env handling, licence decision)
   2. Design system + component library + `/ui` style guide + theme + motion system + layout shell (rail/dock, full-width desktop)
   3. Supabase schema, RLS, auth (single user), seed, local cache + sync layer
   4. Home (without integrations; mocked data hooks)
   5. Shared modules: Library (incl. player, frame thumbnails, notes), Analytics (grid, stats, trend), Path engine, XP/streaks/achievements, focus timer, command palette
   6. CAREER (all sub-pages incl. College)
   7. MIND (incl. BOBBY integration + COOP/COEP solution, Chess.com)
   8. BODY
   9. PERSONA (incl. recorder, Buffer)
   10. Integrations: Google Calendar, GitHub, LeetCode, YouTube API, Apple Music, Buffer (real, behind settings)
   11. Nightly review + weekly review + Obsidian mirror
   12. PWA ×5 + offline + service worker + install testing
   13. Notion import scripts
   14. Portfolio widget (ONE endpoint + DHARMA repo change)
   15. Original banner art + motion polish pass + accessibility pass + performance pass
   16. Tauri desktop app (Obsidian direct write, focus blocker, tray, shortcut)
   17. Deployment (Vercel + Supabase prod config), final QA against 16, docs (README, SCHEMA, TESTING, user guide)
10. **Risks & mitigations:** COOP/COEP vs embeds, unofficial LeetCode API, Google testing-mode token expiry, iOS PWA storage isolation, Apple Music sign-in in wrappers, Supabase free-tier pause, Pyodide weight, Buffer API changes.
11. **What Dharma must provide:** mirror of NEEDS-FROM-DHARMA.md.
12. **Definition of done:** copy from 16 with checkboxes.

## While executing
- Tick tasks in PLAN.md as you go, and update PROGRESS.md (current phase, last finished task, next task, blockers).
- At each phase end: run all checks, commit, push, and write a 5-line phase summary in PROGRESS.md.
- **Don't stop between phases.** Don't ask "shall I continue?". Continue.
- If a phase reveals a problem with an earlier decision, fix it, log it in DECISIONS.md, and continue.
