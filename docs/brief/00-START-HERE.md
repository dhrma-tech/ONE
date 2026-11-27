# 00: START HERE

## What this folder is
A complete brief for building **ONE**, written from scratch so you need no other context. Read every file in this order before planning:

| # | File | What it covers |
|---|---|---|
| 01 | `01-VISION-AND-RULES.md` | Why ONE exists, who it's for, the hard rules |
| 02 | `02-SOURCE-REPOS.md` | Cubicle, BOBBY, DHARMA: what to reuse and how |
| 03 | `03-DESIGN-SYSTEM.md` | Visual design, the heyalok.com analysis, tokens, motion, layout |
| 04 | `04-ARCHITECTURE-AND-STACK.md` | Stack, Supabase, server functions, data model, security |
| 05 | `05-SHARED-MODULES.md` | Library, Analytics, Path, XP, Obsidian mirror, command palette |
| 06 | `06-HOME.md` | Home page |
| 07 | `07-CAREER.md` | CAREER section, including College |
| 08 | `08-MIND.md` | MIND section |
| 09 | `09-BODY.md` | BODY section |
| 10 | `10-PERSONA.md` | PERSONA section |
| 11 | `11-SETTINGS-AND-INTEGRATIONS.md` | Settings + every third-party integration |
| 12 | `12-PWA-AND-DESKTOP.md` | 5 installable PWAs + Tauri desktop app |
| 13 | `13-PORTFOLIO-WIDGET.md` | Live stats on Dharma's portfolio |
| 14 | `14-DATA-MIGRATION.md` | Moving data in from Notion |
| 15 | `15-PLANNING-INSTRUCTIONS.md` | Exactly what your `docs/PLAN.md` must contain |
| 16 | `16-QUALITY-COSTS-AND-DONE.md` | Testing, performance, accessibility, costs, definition of done |
| 17 | `17-SEED-CONTENT.md` | Dharma's real plans, targets and templates to pre-load |

## Your job, in order
1. Read `CLAUDE.md` and all of `docs/brief/`.
2. Study the 3 source repos and **https://heyalok.com/** in depth (see 02 and 03).
3. Write `docs/PLAN.md`: a development-perspective plan, long, detailed, precise, split into phases (see 15).
4. Create `docs/PROGRESS.md`, `docs/DECISIONS.md` and `docs/NEEDS-FROM-DHARMA.md`.
5. **Build every phase, in order, to completion. Do not stop between phases.** Commit and push at the end of each phase and update PROGRESS.md.
6. When everything in `16-QUALITY-COSTS-AND-DONE.md` is satisfied, write a final summary in PROGRESS.md: what shipped, how to run and deploy, and what Dharma must do (keys, accounts).

## When to stop
Only when:
- a step needs something only Dharma can give (account, secret, money, personal choice) **and** there's nothing else left to build, or
- the brief is contradictory in a way that changes the architecture.

Otherwise log the blocker in `NEEDS-FROM-DHARMA.md`, mock it behind a flag, and continue.

## If your session/context runs out
The next session starts by reading `CLAUDE.md` → `docs/PROGRESS.md` → `docs/PLAN.md`, then continues from the next unfinished task. Keep PROGRESS.md accurate enough for that.
