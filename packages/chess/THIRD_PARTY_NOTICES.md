# Third-party notices

Bobby is licensed under GPL-3.0 (see `LICENSE`). It uses or is built with the following third-party work. Each remains under its own license.

## Data

| Source | License | Use |
|---|---|---|
| Lichess puzzle database (https://database.lichess.org/#puzzles) | CC0 1.0 | Filtered into `data/puzzles.json` |
| Lichess standard rated game dumps (https://database.lichess.org/) | CC0 1.0 | Aggregated into `data/opening_stats.json` and `data/benchmarks.json`; raw games are never shipped |
| lichess-org/chess-openings (https://github.com/lichess-org/chess-openings) | CC0 1.0 | `data/openings.json` (names, ECO, move lists; EPD computed by us) |
| Syzygy endgame tablebases (via https://tablebase.lichess.ovh/) | Free to use | Used offline to generate `data/endgames.json`; tables are not shipped |

CC0 data needs no attribution; it is credited here as a courtesy. "Lichess" is a trademark of its owners; this project is not affiliated with or endorsed by Lichess and uses none of its branding.

## Original content

`data/lessons/*.json` and `data/knowledge_cards.json` are original text written for this project and licensed under GPL-3.0 with the rest of the repository.

## Software (runtime and tooling)

| Component | License | Notes |
|---|---|---|
| Stockfish (https://stockfishchess.org/) | GPL-3.0 | Chess engine, WebAssembly build shipped with the app |
| Maia chess models (https://maiachess.com/) | See the Maia project's license for the weights you ship | Human-like play; check the license of the exact weights before redistribution |
| python-chess (https://github.com/niklasf/python-chess) | GPL-3.0-or-later | Rules, PGN, tablebase probing in the Python core and scripts |
| Pyodide (https://pyodide.org/) | MPL-2.0 | Runs the Python core in the browser |
| chess.js (https://github.com/jhlywa/chess.js) | BSD-2-Clause | Move generation compatible tools on the TypeScript side |
| react-chessboard | MIT | Board component |
| zstandard (python) | BSD-3-Clause | Streaming dump decompression in `scripts/` |
| React, Vite, Dexie, and other npm dependencies | MIT / Apache-2.0 / BSD | See `site/package.json` and the lockfile for the exact list |

If you redistribute a build, review the licenses in `site/package-lock.json` and the Maia weights license for the exact versions you include.

## Video metadata (Scroll)

Video metadata from YouTube; videos belong to their creators and play in the official embedded player. Scroll lists only metadata (video id, title, channel, duration, publish date), obtained through YouTube's public oEmbed endpoint, RSS feeds and, when a key is configured, the YouTube Data API. Videos play only in YouTube's embedded player (`youtube-nocookie.com`). Thumbnails are YouTube's automatically generated frames, loaded from YouTube's image servers. Bobby does not download or re-host any video or image.
