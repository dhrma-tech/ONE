# CLAUDE.md (standing rules for every Claude Code session in this repo)

You are building **ONE**: Dharma's distraction-free, all-in-one lock-in app. Read this file at the start of every session, then read `docs/PROGRESS.md` (if it exists) to see where the build stands.

## Who you work for
- **Dharmaraj Aparadh ("Dharma")**: 2nd-year Mechatronics student (LSP Government College of Engineering, Ratnagiri) and solo builder. GitHub: `dhrma-tech`.
- He builds mainly through AI-assisted coding and is learning Python himself.
- Communication style he wants: **short, precise, direct, honest. No sugarcoating, no filler.** English only (never Hinglish). No emojis. No long dashes.
- UI copy persona: dry, light humour, like TARS (Interstellar) or Rocky (Project Hail Mary). Never cringe, never long.

## The brief
Everything is in `docs/brief/`. **Start at `docs/brief/00-START-HERE.md`.** The numbered files are the source of truth. If two files conflict, the higher-numbered, more specific file wins for its own topic, and you note the conflict in `docs/DECISIONS.md`.

## Non-negotiable product rules
1. **No AI features inside the app.** No LLM calls, no chatbot, no AI tutor, no AI tagging/OCR. (Stockfish chess analysis is a chess engine, not AI in this sense, and is allowed.)
2. **No infinite scroll.** Every list ends.
3. **No push notifications, no badges.** The only nudge is a Google Calendar reminder for the 11:30 PM review.
4. **No distraction surfaces.** No recommendations, no related videos, no feeds. The News room is hard-capped.
5. **Dark mode by default** (pure black). Light lavender theme as a toggle.
6. **Must stay free.** If anything needs money, stop and ask.
7. **Original art only.** The design *style* follows heyalok.com; never copy that site's assets or code.

## Working rules
- **Plan first:** write `docs/PLAN.md` (see `docs/brief/15-PLANNING-INSTRUCTIONS.md`).
- **Then build every phase to completion without stopping for approval.** Dharma wants the whole thing finished. Only stop when you are genuinely blocked (a secret, account or choice only Dharma can give). Even then, log it in `docs/NEEDS-FROM-DHARMA.md`, use a placeholder/mock behind an env flag, and **keep building everything else**.
- **Log progress** in `docs/PROGRESS.md` after every meaningful step: phase, what's done, what's next, known issues. A fresh session must be able to resume from this file alone.
- **Record decisions** in `docs/DECISIONS.md` (date, decision, why).
- **Commit often** with clear messages (`feat(career): unit tracker`, `fix(pwa): manifest scope`). Push to `origin main` at the end of each phase.
- **Never commit secrets.** Use `.env.local` (gitignored) and `.env.example` with every variable documented.
- **Verify, don't assume.** Third-party APIs change. Before integrating one, check its current docs. If something in the brief turns out to be wrong, say so, fix the approach, and log it in DECISIONS.md.
- **Test as you go:** typecheck, lint and unit tests must pass before each commit. Do a manual run-through of each page you finish.
- **Windows dev machine.** Scripts must work in PowerShell and Git Bash (use cross-platform npm scripts; no bash-only syntax in package.json).
