# Prompt 1: Kickoff (paste into Claude Code once)

```
You're building ONE, my all-in-one, distraction-free lock-in app. The repo you're in (E:\CODEBASE\ONE, remote github.com/dhrma-tech/ONE) contains the complete brief.

Do this, in order:

1. Read CLAUDE.md, then every file in docs/brief/ in numeric order (00 to 17). Treat them as the source of truth.
2. Clone and study my 3 source repos into a gitignored folder (e.g. ./_ref/):
   - https://github.com/dhrma-tech/Cubicle  (base app + video library)
   - https://github.com/dhrma-tech/BOBBY    (chess module)
   - https://github.com/dhrma-tech/DHARMA   (my portfolio; the "Live from ONE" widget goes here)
3. Analyse https://heyalok.com/ in depth, using a real browser or Playwright: every animation, style, colour token, font, card, border, hover state, layout pattern and micro-interaction. Write docs/DESIGN-ANALYSIS.md. Rebuild that design language for ONE with our own code and original art. Never copy his assets or code. Fix his one weakness: on desktop, ONE must use the full width (about 1440px bento layout), with no huge side gutters. Dark mode (pure black) is the default.
4. Check the current official docs of every integration listed in docs/brief/11 and note anything that changed.
5. Write docs/PLAN.md exactly as specified in docs/brief/15-PLANNING-INSTRUCTIONS.md: from a development perspective, long, detailed, precise and accurate, split into phases with granular tasks and exit criteria.
6. Create docs/PROGRESS.md, docs/DECISIONS.md, docs/NEEDS-FROM-DHARMA.md and docs/SCHEMA.md.
7. Then BUILD. Execute every phase in PLAN.md, in order, to completion. Do NOT stop between phases and do NOT ask me "shall I continue?". After each phase: run typecheck/lint/tests/build, commit, push to origin main, and update PROGRESS.md.
8. If you need something only I can provide (API keys, usernames, accounts, a personal choice), add it to docs/NEEDS-FROM-DHARMA.md, put a mock/placeholder behind an env flag, and keep building everything else. Only stop when nothing else can be built without me.
9. If anything in the brief is wrong, outdated, impossible or costs money, say so plainly, pick the best free alternative, log it in DECISIONS.md, and continue.

Hard rules: no AI features inside the app, no infinite scroll, no notifications except the Google Calendar review reminder, everything free, original art only, Windows-friendly scripts.

Keep your messages to me short, direct and honest. No filler. Start now with step 1.
```
