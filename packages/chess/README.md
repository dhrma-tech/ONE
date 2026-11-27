# Bobby

**A quiet chess coach that lives in your browser: it plays at your level, explains every move in plain words, and turns your own mistakes into training.**

Bobby is a free, open-source, login-free chess learning app. Play against Bobby at a strength that adapts to you, get every game reviewed move by move, and follow a daily plan built from the mistakes you actually make. Learn from 64 interactive lessons, train on 22,010 puzzles, and watch a curated library of the best chess videos on YouTube.

There are no accounts, no servers and no AI keys. The engine, the Python core and all your data run and stay in your own browser.

![Bobby: play with the coach](docs/shots/play.png)

---

## Features

- **Play:** against Bobby at adaptive strength, or two players on one screen. Time controls, takebacks, three-level hints, PGN and FEN import and export
- **Coach, no AI:** plain-language answers built from Stockfish and tactic detectors, drawn on the board with arrows. Five questions work on any position: threats, pieces in danger, best move and why, who is better and why, and the plan
- **Review:** every move explained automatically (what it did, what it allowed, what was better), accuracy, key moments, an evaluation graph, and "Show me" to play the better line
- **Safety net:** an optional check before you play a move that hangs a piece or allows mate in one
- **Learn:** 64 interactive lessons in 10 sections, from how the pieces move to the Philidor defence, each checked by python-chess
- **Train:** puzzles from your own mistakes with spaced repetition, 22,010 themed puzzles, an endgame trainer with tablebase-verified goals, and an opening explorer with 3,865 named openings
- **Daily progression:** Bobby steps up or eases off each day from your recent games, and challenge targets follow your form
- **Scroll:** a library of the best chess videos on YouTube, laid out as a 19-section syllabus, with thumbnails taken from inside each video instead of clickbait covers
- **Shortcuts:** `g` then `p` / `l` / `t` / `s` / `v` to move between pages, `/` search, `?` help, Ctrl or Cmd + K command palette
- **Themes:** light and dark, resizable side panels, responsive down to phones, installable as an app that works offline

| Game review | Learn |
| --- | --- |
| ![Review](docs/shots/review.png) | ![Learn](docs/shots/learn.png) |

| Scroll: chess videos | Watching in Scroll |
| --- | --- |
| ![Scroll](docs/shots/scroll.png) | ![Watch page](docs/shots/scroll-watch.png) |

| Daily level and challenges | A lesson |
| --- | --- |
| ![Challenges](docs/shots/challenges.png) | ![Lesson](docs/shots/lesson.png) |

| Light | Mobile |
| --- | --- |
| ![Light](docs/shots/play-light.png) | <img src="docs/shots/mobile.png" width="260" alt="Mobile"> |

---

## Coaching Tools

Everything below runs locally. Games, progress and settings live in your browser (IndexedDB and localStorage). Use Settings, Export to move them between devices.

| Feature | Where |
| --- | --- |
| Ask Bobby: five position questions with board arrows, "Show me" line player, practice links | Play and Review, right panel |
| Automatic move-by-move explanations and "Summarize my game" in plain words | Review, and Play after a game |
| Focus mode: eval and coach stay hidden until the game ends | Play |
| Side panels collapse during a game and reopen after it; drag their edges to resize | Play and Review |
| Daily level, personalised challenges and a "How am I improving?" report | `#/train?tab=challenges` |
| Puzzles from your own mistakes on spaced repetition | `#/train?tab=puzzles` |
| Adaptive next lesson, chosen from the weaknesses in your games | `#/learn` |
| Search with suggestions across lessons, openings, tricks and pages | Top bar, press `/` |
| Command palette | Ctrl or Cmd + K, everywhere |

### How the coach works

The coach does not use an AI model. Every answer is built from facts:

1. **Engine.** Stockfish (WebAssembly, in a worker) evaluates the position and finds the best line.
2. **Detectors.** The Python core (python-chess in Pyodide) checks for checkmates, mate threats, hanging pieces, forks, pins, skewers, discovered attacks and back-rank mates.
3. **Explain.** `py/bobby/explain.py` picks the most important reason (mate, stopping a mate threat, winning material, saving a piece, then tactics) and writes it in plain words, with arrows for the move played, the danger and the better move.

Because nothing is generated, the coach is instant, works offline, costs nothing and never invents a move.

---

## Quick Start

You need Node.js 18 or newer. No keys are required.

```bash
git clone https://github.com/dhrma-tech/BOBBY.git
cd BOBBY/site
npm install
npm run dev
```

Open the address it prints (usually http://localhost:5173).

The first load downloads the Python runtime and the engine once, then Bobby works offline. `npm run dev` also prepares those assets: it copies Pyodide and Stockfish into `site/public` and fetches python-chess with `python3 -m pip download`. If `python3` is not on your path (common on Windows), it prints a warning and the app installs python-chess at runtime instead.

## Deploy

Bobby is a static site: no server code and no environment variables.

1. Build it: `cd site && npm run build`. The output is in `site/dist`.
2. Upload `site/dist` to any static host (GitHub Pages, Netlify, Cloudflare Pages, or Vercel with **Root Directory** set to `site`).

The build uses relative paths, so it also works from a subfolder.

---

## Scroll: Chess Videos

Scroll (`#/scroll`, shortcut `g v`) is a calm, login-free library of the best chess videos on YouTube, laid out as a syllabus that covers all of chess: Start here, Tactics, Calculation, Strategy, five opening sections, Gambits, Opening study, Middlegame, Endgames, Game analysis, Gameplay, Tournaments, Improve, Speed chess, and Legends. It adapts the idea, design and pipeline of [Cubicle](https://github.com/dhrma-tech/Cubicle).

- **No clickbait thumbnails:** every thumbnail is a frame from inside the video (YouTube's automatic frames at about 25, 50 or 75 percent of the timeline), never the uploader's designed cover. You can switch to the cover in the view options
- **Why it is here:** each video shows how many independent sources recommend it, with a freshness bar and a "May be outdated" tag
- **For you:** a Today card, time-budget queues (15, 30, 60 min), paths by rating band, and a "For your weaknesses" row driven by the mistakes in your games
- **Watching:** the official `youtube-nocookie.com` player, remembered speed and resume position, timestamped notes (`n`, Markdown export), Save, Done and Queue, and auto-next with a 5-second countdown you can cancel
- **Focus mode** (`f`): hides the side panel and fades the top bar. A 25/5 study timer counts only while the video plays
- **Practice this:** every topic links to the matching lesson, puzzle theme, endgame trainer or opening explorer in Bobby

### Rebuild The Video Data (optional)

The repo ships with a built catalogue. To refresh or grow it, use the Python pipeline in `scripts/cubicle/`. It works without any key, but a YouTube Data API key adds durations, publish dates and each channel's back catalogue, which makes the library much larger.

**Step 1: run without keys (smaller result)**
```bash
python scripts/cubicle/run_all.py
```

**Step 2: add a YouTube API key (recommended, free)**
1. Open [Google Cloud Console](https://console.cloud.google.com) and create a project.
2. Enable **YouTube Data API v3** under APIs and Services, then Library.
3. Create an **API key** under Credentials, and restrict it to that API.
4. Set it in your terminal and run:

```bash
# macOS / Linux
export YT_API_KEY="your-key"
# Windows PowerShell
$env:YT_API_KEY="your-key"

python scripts/cubicle/run_all.py --api
python scripts/cubicle/validate_cubicle.py
```

**Step 3 (optional): clean labels with an LLM.** The pipeline (not the app) can use Claude Haiku to check each video's topic, level and kind: set `ANTHROPIC_API_KEY` and add `--llm`.

**Step 4: rebuild the site** with `cd site && npm run build`.

The pipeline stays within the daily API quota (about 9,400 units) and resumes the next day. To refresh the "Latest" shelf every day, move `docs/cubicle-latest-workflow.yml` to `.github/workflows/` and add `YT_API_KEY` as a repository secret.

### How Scroll Picks Videos

1. **Collect.** Read public sources that recommend chess videos (the Lichess video library, Hacker News comments, Wikipedia, GitHub lists) and a tiered list of trusted chess channels.
2. **Check.** Verify every video with YouTube oEmbed, so deleted or blocked videos are dropped. Video ids are never typed by hand.
3. **Gate.** Keep a video only with 2 or more independent recommendations, or from a trusted channel with strong engagement. English, embeddable, 4 to 240 minutes, no Shorts and no re-uploads.
4. **Classify.** Rules (and optionally Claude Haiku) place each video in one syllabus topic, with a level (under 1000, 1000 to 1600, 1600 to 2000, 2000+) and a kind (lesson, course, gameplay, review, tips, recap, talk).
5. **Score.** Score = recommendation signal × (0.5 + 0.5 × freshness). Freshness = 0.5 ^ (age ÷ half-life), with a half-life of 10 years for evergreen topics, 4 for opening theory and strategy, and 1 for tournaments.
6. **Diversify.** At most 6 videos per channel per topic, 25 per topic, and 10 percent of the catalogue per channel.
7. **Export.** Compact JSON for the site (format in `docs/cubicle-data.md`) and a `REPORT.md` with counts per section, level, channel and year.

---

## Rebuild The Chess Data (optional)

Puzzles, openings, endgames and benchmarks are built offline from open data by the Python scripts in `scripts/` (see `scripts/README.md`). Lessons are written in `scripts/build_lessons.py`, which checks every exercise with python-chess while it builds.

```bash
pip install python-chess zstandard
python scripts/build_lessons.py     # regenerate the lessons (checks every answer)
python scripts/validate_data.py     # validate everything that ships
```

| File | Origin |
| --- | --- |
| `data/puzzles.json` | 22,010 puzzles filtered from the CC0 Lichess puzzle database and re-checked with Stockfish 16 at depth 12 |
| `data/openings.json` | 3,865 named openings from the CC0 lichess-org/chess-openings repository |
| `data/endgames.json` | 70 positions with outcomes from Syzygy 3-4-5 tablebases |
| `data/opening_stats.json`, `data/benchmarks.json` | Computed from the first 1.5 GB of the 2026-10 Lichess standard rated dump (2.5M games for opening stats, 363k games with evaluations for benchmarks) |
| `data/lessons/`, `data/knowledge_cards.json` | 64 lessons and 55 knowledge cards, original text written for Bobby |
| `data/cubicle/` | Scroll's video catalogue (metadata only, see above) |

---

## Architecture

```text
 Browser (installable PWA)
 +-------------------------------------------------------------------+
 | site/  Vite + React + TypeScript                                  |
 |   pages: Play | Review | Learn | Train | Stats | Scroll           |
 |        |                                                          |
 |   bridge/                                                         |
 |     +-- Pyodide worker --> py/bobby (python-chess + stdlib)       |
 |     |      rules, classification, Glicko-2, spaced repetition,    |
 |     |      lessons, rule-based coach, daily progression           |
 |     +-- Stockfish worker (WASM)     analysis and Bobby's strength |
 |     +-- Dexie (IndexedDB)           profile, games, progress      |
 |        |                                                          |
 |   static data: data/*.json  (puzzles, openings, lessons, videos)  |
 +-------------------------------------------------------------------+
        ^ built offline by scripts/ (Python: Lichess CC0 dumps,
          Syzygy tablebases, lesson checker, Scroll video pipeline)
```

The Python core and the TypeScript shell talk through the JSON-only interface in `docs/CONTRACT.md`. Engines are owned by TypeScript; Python never calls them.

## Tech Stack

- **Site:** Vite, React 18, TypeScript (strict), plain CSS, hash routing
- **Chess:** Stockfish 18 (WebAssembly), python-chess in Pyodide, chess.js, react-chessboard
- **State:** IndexedDB through Dexie, plus localStorage for settings. No accounts
- **Fonts:** Bricolage Grotesque and Instrument Sans, bundled locally
- **Data pipelines:** Python, Lichess open data, Syzygy tablebases, YouTube oEmbed, RSS and Data API v3
- **Videos:** embedded with `youtube-nocookie.com`

## Commands

| Command | What it does |
| --- | --- |
| `npm run dev` | Prepare assets and start the local site (from `site/`) |
| `npm run build` | Type-check and build the static site to `site/dist` |
| `npm run preview` | Serve the built site locally |
| `npm run lint` | Lint the TypeScript |
| `npm run smoke` | Headless browser test of the built site (set `CHROME` to your Chrome path) |
| `cd py && pytest` | Python core tests |
| `python scripts/validate_data.py` | Validate all shipped data |
| `python scripts/cubicle/run_all.py --api` | Rebuild Scroll's video catalogue with a YouTube key |

## Privacy

- No accounts, no analytics, no cookies set by Bobby
- Games, analysis, lessons, puzzles, notes and settings stay in your browser
- The engine and the coach run on your device; no position or game is ever sent anywhere
- Scroll loads video thumbnails from YouTube's image servers and plays videos through `youtube-nocookie.com`, so YouTube sees those requests. Nothing else leaves your browser
- Settings, Reset clears all local data; Export gives you a full backup file

## Known Limitations

- Scroll's shipped catalogue was built without a YouTube key: 185 videos from 27 channels, with many topics still empty. Run the pipeline with `YT_API_KEY` to reach the full syllabus
- Bobby's human-like play uses Stockfish with tuned weaknesses; the Maia model is evaluated in `docs/MAIA.md` but not integrated yet
- The coach explains with rules and detectors, so deep strategic ideas get a simpler answer than a strong human would give
- Benchmarks come from part of one month of Lichess games; rebuild from a full month for tighter numbers
- Single player on one device; there is no online play against other people
- Videos can be deleted or blocked on YouTube later, so refresh the video data from time to time

## Data Sources and Licenses

- Lichess open database and lichess-org/chess-openings: CC0
- Syzygy endgame tablebases by Ronald de Man
- Stockfish: GPL-3.0. python-chess: GPL-3.0-or-later. Pyodide: MPL-2.0. Full list in [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md)
- Video titles, thumbnails and channel names belong to their creators and are shown through YouTube
- This repository's code is GPL-3.0 licensed

## Folder Structure

```text
BOBBY/
├── site/                    Vite + React web app
│   ├── src/
│   │   ├── pages/                 Play, Review, Learn, Train, Stats
│   │   ├── cubicle/               Scroll: video library, cards, player, focus timer
│   │   ├── components/            board, coach panel, search, dropdowns
│   │   ├── bridge/                Pyodide and Stockfish workers, storage
│   │   └── lib/                   coach, safety net, progress, routing
│   ├── scripts/prepare-assets.mjs copies engine, Python runtime and data
│   └── tests/smoke.mjs            headless browser test
├── py/
│   ├── bobby/               Python core: rules, explain, progression, lessons...
│   └── tests/               pytest suite
├── scripts/
│   ├── build_*.py           puzzle, opening, endgame, benchmark and lesson builders
│   ├── validate_data.py     checks everything that ships
│   └── cubicle/             Scroll video pipeline (sources, oEmbed, gate, score, export)
├── data/                    shipped data (puzzles, openings, lessons, videos)
├── docs/
│   ├── CONTRACT.md          Python and TypeScript interface
│   ├── PLAN.md              build plan
│   ├── cubicle-data.md      Scroll data format
│   └── shots/               screenshots
├── LICENSE
├── THIRD_PARTY_NOTICES.md
└── README.md
```

## Contributing

Issues and pull requests are welcome, especially new lessons, better coach explanations, trusted chess channels and sources for Scroll. Keep changes small. Lessons are added in `scripts/build_lessons.py` so every exercise is checked before it ships.

## License

GPL-3.0. See [LICENSE](LICENSE).

## Credits

- The Lichess open database, for puzzles, games and the openings list
- Stockfish, the open-source engine
- python-chess, for rules, PGN and tablebase support
- Syzygy tablebases by Ronald de Man
- [Cubicle](https://github.com/dhrma-tech/Cubicle), whose design and pipeline Scroll adapts

This project is independent and is not affiliated with Lichess, YouTube or any other chess site.

## Author

Built by **Dharmaraj Aparadh** ([@dhrma-tech](https://github.com/dhrma-tech)).
