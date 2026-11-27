# 08: MIND

Brain rewiring: attention span, memory, efficiency. **Dharma is starting with chess and meditation.** Cube, mental math and memory palace come later (locked modules). Accent: MIND colour. Banner: chessboard + meditating figure.

## Sub-pages
`Chess · Meditate · Library · Focus · Memory · Reading · Analytics` (+ locked modules)

### 8.1 Chess
- **BOBBY integrated** as a lazy-loaded module: play vs Bobby, puzzles (spaced repetition), lessons, opening explorer, endgame trainer, game review. See 02 for the COOP/COEP risk.
- **Chess.com stats:** Dharma plays on the **Chess.com app** (not Lichess).
  - Use the **Chess.com Published-Data API** (read-only, public, **no API key**):
    - `GET https://api.chess.com/pub/player/{username}/stats`: ratings (rapid, blitz, bullet, daily), tactics/puzzles, Puzzle Rush.
    - `GET https://api.chess.com/pub/player/{username}/games/archives` → monthly archives → recent games (PGN).
  - Call it **server-side** with a descriptive `User-Agent` that includes contact info (Chess.com asks for this; browsers can't set User-Agent). Cache responses (data is prepared/refreshed periodically, not live). Respect ETag/Last-Modified.
  - Daily snapshot → `chess_snapshots`; a rating graph in Analytics.
  - "Import recent Chess.com games into BOBBY review" (PGN) is a nice bridge: Dharma plays on Chess.com and reviews with Bobby's engine.
- Username is set in Settings (ask Dharma via NEEDS-FROM-DHARMA.md).

### 8.2 Meditate
- Timer with presets **5 / 10 / 20 min** + custom.
- Minimal screen: breathing circle animation (calm, slow), an optional soft bell at start/end (an original sound or a CC0 file), and a no-UI mode.
- Logs minutes + streak. Counts towards the weekly grade (check 9).

### 8.3 Library
Shared Library module. Topics: Chess (seed from BOBBY's Scroll into the Inbox), Meditation, Philosophy, Mindset/Discipline, Focus & Memory science.

### 8.4 Focus training
- **Longest phone-free focus block** this week (from focus sessions marked phone-free).
- **Stuck-minutes ladder:** the minutes he stays with a hard problem before quitting or asking for help. Targets: Week 1: 15 → Week 2: 20 → Week 3: 25 → Week 4: 30 → then 45. A log per day (from the review / problem log).
- **Stuck Protocol card** (static, always visible): restate the problem in one line; write what you know and what you tried; take the smallest next step; try 3 approaches before asking; at least 25 minutes before any AI help, then ask "why is this wrong", not "fix it"; log the stuck minutes.

### 8.5 Memory (flashcards)
- Built-in spaced-repetition flashcards (replaces Anki). Use **FSRS** (or SM-2 if simpler; document the choice).
- Decks: Python syntax/built-ins, LLM concepts, English phrases, number facts, chess patterns.
- Rule: **max 5 new cards/day**, about 10 minutes of review a day.
- Quick card creation from Notes/Library video notes.

### 8.6 Reading shelf
- Books (title, author, status reading/finished/queued).
- Per session: pages or minutes + **one-line lesson**. Mirrored to Obsidian.
- Planned habit: 15 minutes of reading at night instead of the phone.

### 8.7 Locked modules (hidden until switched on in Settings)
- **Cube:** timer with scramble, solve times, best/avg-of-5. First target: under 2 minutes.
- **Mental math:** 5-minute drills (tables to 20, squares to 30, 2-digit × 1-digit, then 2-digit × 2-digit), with timing.
- **Memory palace:** a simple loci list builder for memorising lists (e.g. Python built-ins, RAG steps).

### 8.8 Analytics
- Contribution grid (MIND done-days).
- Stat cards: Chess.com rapid rating (+ delta), puzzles solved, meditation minutes this week, longest focus block, flashcard streak.
- Trend: chess rating over time.
- Lagging in: e.g. "Meditation: 2 of 7. Breathe, astronaut."
