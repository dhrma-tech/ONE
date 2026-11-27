"""Puzzles from the player's own mistakes, and puzzle selection."""
from __future__ import annotations

import chess

from .analysis import annotate
from .common import short_hash

DEFAULT_RATING = 1200
TARGET_ABOVE = 50  # select puzzles slightly above the player's rating


def _solution(row: dict) -> list[str]:
    best = row["best_uci"]
    pv = row.get("best_pv") or []
    if pv and pv[0] == best:
        sol = pv[: len(pv) if len(pv) % 2 else len(pv) - 1]  # end on the solver's move
    else:
        sol = [best]
    board = chess.Board(row["fen_before"])
    out = []
    for u in sol:
        mv = chess.Move.from_uci(u)
        if mv not in board.legal_moves:
            break
        board.push(mv)
        out.append(u)
    if len(out) % 2 == 0:
        out = out[:-1]
    return out


def puzzles_from_mistakes(analyzed_game: dict) -> list[dict]:
    base = int(analyzed_game.get("player_rating") or DEFAULT_RATING)
    out = []
    for row in annotate(analyzed_game):
        if not (row["is_player"] and row["class"] in ("mistake", "blunder")):
            continue
        best = row.get("best_uci")
        if not best or best == row.get("uci") or not row.get("fen_before"):
            continue
        try:
            sol = _solution(row)
        except ValueError:
            continue
        if not sol:
            continue
        themes = sorted(set(row["tags"]) | {"mistake"})
        rating = base + (100 if row["class"] == "mistake" else 0)
        out.append({"id": "m-" + short_hash(row["fen_before"], sol[0]), "fen": row["fen_before"], "solution": sol,
                    "themes": themes, "source": "mistake", "rating": rating,
                    "ply": row["ply"], "game_id": analyzed_game.get("id")})
    return out


def select_puzzles(puzzles: list[dict], profile: dict, theme: str | None = None, n: int = 10) -> list[dict]:
    target = float(profile.get("rating", DEFAULT_RATING)) + TARGET_ABOVE
    pool = [p for p in puzzles if theme is None or theme in (p.get("themes") or [])]
    pool.sort(key=lambda p: (abs(p.get("rating", DEFAULT_RATING) - target), -p.get("popularity", 0), str(p.get("id"))))
    return pool[: max(0, int(n))]
