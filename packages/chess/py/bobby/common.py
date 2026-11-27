"""Shared helpers: colours, dates, piece values."""
from __future__ import annotations

import datetime as _dt
import hashlib

import chess

PIECE_VALUE = {chess.PAWN: 1, chess.KNIGHT: 3, chess.BISHOP: 3, chess.ROOK: 5, chess.QUEEN: 9, chess.KING: 100}


def clamp(x: float, lo: float, hi: float) -> float:
    return max(lo, min(hi, x))


def norm_color(c: str) -> str:
    """'w'/'white'/'b'/'black' -> 'w'|'b'."""
    s = str(c).strip().lower()
    if s in ("w", "white"):
        return "w"
    if s in ("b", "black"):
        return "b"
    raise ValueError(f"bad colour: {c!r}")


def to_date(s: str) -> _dt.date:
    if not isinstance(s, str) or len(s) < 10:
        raise ValueError(f"bad ISO date: {s!r}")
    return _dt.date.fromisoformat(s[:10])


def add_days(s: str, n: int) -> str:
    return (to_date(s) + _dt.timedelta(days=n)).isoformat()


def days_between(a: str, b: str) -> int:
    """b - a in days."""
    return (to_date(b) - to_date(a)).days


def short_hash(*parts: str) -> str:
    return hashlib.sha1("|".join(parts).encode()).hexdigest()[:12]


def value(piece: chess.Piece | None) -> int:
    return PIECE_VALUE[piece.piece_type] if piece else 0
