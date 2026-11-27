"""Logistic win probability from engine evals (white perspective)."""
from __future__ import annotations

import math

import chess

WINPROB_K = 0.00368208  # Lichess-calibrated logistic slope
CP_CAP = 1000            # cp clamp before conversion / for ACPL


def winprob(cp: int | float | None, mate: int | None = None) -> float:
    """0..1 win probability for White. mate>0: White mates. mate==0 or no eval -> 0.5."""
    if mate is not None:
        if mate > 0:
            return 1.0
        if mate < 0:
            return 0.0
        return 0.5
    if cp is None:
        return 0.5
    c = max(-CP_CAP, min(CP_CAP, float(cp)))
    return 1.0 / (1.0 + math.exp(-WINPROB_K * c))


def eval_cp(ev: dict | None) -> float:
    """Eval to capped cp (mate -> +-CP_CAP)."""
    if not ev:
        return 0.0
    m = ev.get("mate")
    if m is not None and m != 0:
        return float(CP_CAP if m > 0 else -CP_CAP)
    cp = ev.get("cp")
    return float(max(-CP_CAP, min(CP_CAP, cp))) if cp is not None else 0.0


def eval_wp(ev: dict | None, fen: str | None = None) -> float:
    """Eval dict to white win prob; resolves terminal positions from the FEN."""
    if fen:
        try:
            b = chess.Board(fen)
            if b.is_checkmate():
                return 0.0 if b.turn == chess.WHITE else 1.0
            if b.is_stalemate() or b.is_insufficient_material():
                return 0.5
        except ValueError:
            pass
    if not ev:
        return 0.5
    return winprob(ev.get("cp"), ev.get("mate"))


def for_color(wp_white: float, color: str) -> float:
    return wp_white if color == "w" else 1.0 - wp_white
