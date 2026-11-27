"""Annotate an analyzed game: classification + phase + motif tags per move.

analyzed_game = {player_color, moves:[classify input move (+optional clock: seconds left)],
                 classification?: classify_moves output, opening?:{eco,name}, headers?, date?, result?,
                 player_rating?}
"""
from __future__ import annotations

import chess

from .classify import classify_moves, fen_after, mover
from .common import norm_color
from .phase import endgame_type, phase
from .tactics import allowed_motifs, move_motifs

ERROR_CLASSES = ("mistake", "blunder")
TIME_TROUBLE_SECONDS = 30


def opening_eco(game: dict) -> str | None:
    eco = (game.get("opening") or {}).get("eco") or (game.get("headers") or {}).get("ECO")
    return str(eco).upper() if eco and eco != "?" else None


def _missed_mate(m: dict, color: str) -> bool:
    best = m.get("best_eval") or {}
    after = m.get("eval_after") or {}
    sign = 1 if color == "w" else -1
    bm = best.get("mate")
    am = after.get("mate")
    return bm is not None and bm * sign > 0 and not (am is not None and am * sign > 0)


def error_tags(m: dict, color: str, eco: str | None) -> list[str]:
    """Tags explaining a player error at move m."""
    tags: set[str] = set()
    fen = m.get("fen_before")
    if fen:
        board = chess.Board(fen)
        ph = phase(fen, m.get("ply"))
        tags.add(f"phase_{ph}")
        best = m.get("best_uci")
        if best and best != m.get("uci"):
            try:
                bm = chess.Move.from_uci(best)
                if bm in board.legal_moves:
                    tags |= move_motifs(board, bm)
            except ValueError:
                pass
        fa = fen_after(m)
        if fa:
            tags |= allowed_motifs(chess.Board(fa))
        if ph == "end":
            et = endgame_type(fen)
            if et:
                tags.add(et)
        if ph == "opening" and eco:
            tags.add(f"opening_{eco}")
    if _missed_mate(m, color):
        tags.add("missed_mate")
    clock = m.get("clock")
    if isinstance(clock, (int, float)) and clock < TIME_TROUBLE_SECONDS:
        tags.add("time_trouble")
    return sorted(tags)


def annotate(game: dict) -> list[dict]:
    """Per-move dicts: input fields + class, winprob_loss, is_player, color, phase, tags, played_motifs."""
    pc = norm_color(game.get("player_color", "w"))
    moves = game.get("moves") or []
    cls = game.get("classification") or classify_moves(moves, pc)
    by_ply = {c["ply"]: c for c in cls["moves"]}
    eco = opening_eco(game)
    out = []
    for i, m in enumerate(moves):
        c = mover(m, i)
        ply = m.get("ply", i + 1)
        info = by_ply.get(ply, {})
        row = {**m, "ply": ply, "color": c, **{k: info.get(k) for k in ("class", "winprob_loss", "is_player", "cp_loss")}}
        row["phase"] = phase(m["fen_before"], ply) if m.get("fen_before") else None
        row["tags"] = error_tags(m, c, eco) if row["is_player"] and row["class"] in ERROR_CLASSES else []
        row["played_motifs"] = _played(m) if row["is_player"] and row["class"] in ("best", "good") else []
        out.append(row)
    return out


def _played(m: dict) -> list[str]:
    if not (m.get("fen_before") and m.get("uci")):
        return []
    board = chess.Board(m["fen_before"])
    try:
        mv = chess.Move.from_uci(m["uci"])
    except ValueError:
        return []
    return sorted(move_motifs(board, mv)) if mv in board.legal_moves else []


def summary(game: dict) -> dict:
    """Compact per-game stats for the player."""
    pc = norm_color(game.get("player_color", "w"))
    cls = game.get("classification") or classify_moves(game.get("moves") or [], pc)
    rows = annotate({**game, "classification": cls})
    mine = [r for r in rows if r["is_player"]]
    count = lambda k: sum(1 for r in mine if r["class"] == k)  # noqa: E731
    return {
        "player_color": pc,
        "accuracy": cls["accuracy"][pc],
        "acpl": cls["acpl"][pc],
        "moves": len(mine),
        "blunders": count("blunder"),
        "mistakes": count("mistake"),
        "inaccuracies": count("inaccuracy"),
        "rows": rows,
    }
