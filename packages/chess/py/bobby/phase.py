"""Game phase and endgame-type detection."""
from __future__ import annotations

import chess

OPENING_MAX_PLY = 20      # plies 1..20 can be opening
ENDGAME_MATERIAL = 26     # non-pawn material (both sides, N/B=3 R=5 Q=9) at or below -> endgame

_NP = {chess.KNIGHT: 3, chess.BISHOP: 3, chess.ROOK: 5, chess.QUEEN: 9}


def nonpawn_material(board: chess.Board) -> int:
    return sum(v * len(board.pieces(pt, c)) for pt, v in _NP.items() for c in chess.COLORS)


def phase(fen: str, ply: int | None = None) -> str:
    """'opening' | 'middle' | 'end'."""
    board = chess.Board(fen)
    if nonpawn_material(board) <= ENDGAME_MATERIAL:
        return "end"
    if ply is None:
        ply = (board.fullmove_number - 1) * 2 + (0 if board.turn == chess.WHITE else 1) + 1
    developed = _minors_developed(board)
    return "opening" if ply <= OPENING_MAX_PLY and developed < 6 else "middle"


def _minors_developed(board: chess.Board) -> int:
    home = {chess.WHITE: chess.BB_RANK_1, chess.BLACK: chess.BB_RANK_8}
    n = 0
    for c in chess.COLORS:
        for pt in (chess.KNIGHT, chess.BISHOP):
            n += sum(1 for sq in board.pieces(pt, c) if not chess.BB_SQUARES[sq] & home[c])
    return n


def endgame_type(fen: str) -> str | None:
    """Tag like endgame_k_p / endgame_rook / endgame_queen / endgame_minor, or None if not an endgame."""
    board = chess.Board(fen)
    if nonpawn_material(board) > ENDGAME_MATERIAL:
        return None
    has = {pt: bool(board.pieces(pt, chess.WHITE) or board.pieces(pt, chess.BLACK)) for pt in _NP}
    if not any(has.values()):
        return "endgame_k_p"
    if has[chess.QUEEN]:
        return "endgame_queen"
    if has[chess.ROOK]:
        return "endgame_rook" if not (has[chess.KNIGHT] or has[chess.BISHOP]) else "endgame_mixed"
    return "endgame_minor"
