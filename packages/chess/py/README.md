# bobby (Python core)

Pure-Python core of Bobby. JSON in/out, no I/O, no clock, runs under Pyodide. Only dependency: `python-chess`.
Public API: `bobby/api.py` (see `docs/CONTRACT.md`).

```
pip install --break-system-packages python-chess pytest
cd py && python -m pytest -q
```

Modules: `rules` (moves, PGN), `winprob`/`classify`/`accuracy` (move classes, Lichess-style accuracy, ACPL, key moments),
`tactics`/`phase`/`analysis` (motif + phase tagging), `glicko`/`profile` (Glicko-2, seeds, bot target, benchmarks),
`weakness`, `puzzles`, `srs`, `plan`, `challenges` (also achievements), `lessons`, `stats`, `export`, `difficulty`,
`coach/{personas,prompts,templates}`.

Shapes not fixed by the contract:
- `analyzed_game = {id?, date?, player_color, moves:[classify input (+best_pv, clock)], classification?, opening?:{eco,name}, headers?, player_rating?}`
- `weakness = {version, games, tags:{tag:{count, score (decayed 0.9/game), last_seen}}}`
- `card = {id, item_id, due, interval, ease, reps, lapses, last}`; grade 0 again, 1 hard, 2 good, 3 easy.
- `lesson_check.next_index`: next step if correct, same step if wrong, `None` when finished.
- `stats_summary` games: `{id, date, result, player_color, rating_after?, rd_after?, opening?|headers.ECO}`; analyses: `{game_id, moves, classification?}`.
- `check_achievements` stats keys: games, wins, clean_games, best_accuracy, puzzles_solved, streak, lessons_done, challenges_done.
- Extra: `position_difficulty(fen, lines, rating)`.
