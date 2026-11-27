"""Position difficulty heuristic from engine multi-PV lines (side-to-move view)."""
from __future__ import annotations

import chess

from .common import clamp
from .winprob import winprob

GOOD_MARGIN = 0.05


def position_difficulty(fen: str, lines: list[dict], rating: float) -> dict:
    """score 0..1 (higher = harder); hard_for_level when score beats a rating-scaled bar."""
    if not lines:
        return {"score": 0.0, "good_moves": 0, "label": "unknown", "hard_for_level": False}
    wps = [winprob(l.get("cp"), l.get("mate")) for l in lines]
    best = wps[0]
    good = sum(1 for w in wps if best - w <= GOOD_MARGIN)
    gap = best - (wps[1] if len(wps) > 1 else best - 0.3)
    score = clamp(gap * 2.0, 0, 1) * (1.0 if good == 1 else 0.5)
    pv = lines[0].get("pv") or []
    if pv:
        b = chess.Board(fen)
        mv = chess.Move.from_uci(pv[0])
        if mv in b.legal_moves and not (b.is_capture(mv) or b.gives_check(mv)):
            score = clamp(score + 0.15, 0, 1)  # quiet best moves are harder to see
    bar = clamp(0.3 + (float(rating) - 800) / 4000, 0.2, 0.8)
    lbl = "hard" if score >= 0.6 else "medium" if score >= 0.3 else "easy"
    return {"score": round(score, 3), "good_moves": good, "label": lbl, "hard_for_level": score >= bar}
