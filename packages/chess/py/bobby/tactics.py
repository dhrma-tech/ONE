"""Heuristic tactic-motif detection with python-chess."""
from __future__ import annotations

import chess

from .common import value

_DIRS = {
    chess.ROOK: [(1, 0), (-1, 0), (0, 1), (0, -1)],
    chess.BISHOP: [(1, 1), (1, -1), (-1, 1), (-1, -1)],
}
_DIRS[chess.QUEEN] = _DIRS[chess.ROOK] + _DIRS[chess.BISHOP]


def hanging_pieces(board: chess.Board, color: chess.Color) -> list[int]:
    """Squares of `color` pieces (non-king) the side to move can win: legal capture by a cheaper
    attacker, or capture of an undefended piece. Assumes the opponent of `color` is to move."""
    out = []
    for sq, piece in board.piece_map().items():
        if piece.color != color or piece.piece_type == chess.KING:
            continue
        caps = [m for m in board.legal_moves if m.to_square == sq]
        if not caps:
            continue
        cheapest = min(value(board.piece_at(m.from_square)) for m in caps)
        if not board.attackers(color, sq) or cheapest < value(piece):
            out.append(sq)
    return out


def _is_safe(board: chess.Board, sq: int) -> bool:
    """Piece on sq (just moved) is not simply lost: undefended-and-attacked or attacked by cheaper."""
    piece = board.piece_at(sq)
    attackers = board.attackers(not piece.color, sq)
    if not attackers:
        return True
    cheapest = min(value(board.piece_at(a)) for a in attackers)
    return bool(board.attackers(piece.color, sq)) and cheapest >= value(piece)


def is_fork(board: chess.Board, move: chess.Move) -> bool:
    """After `move`, the moved piece attacks >=2 enemy targets (king, more valuable, or undefended)."""
    b = board.copy(stack=False)
    b.push(move)
    sq = move.to_square
    me = b.piece_at(sq)
    if me is None:
        return False
    targets = 0
    for t in b.attacks(sq):
        p = b.piece_at(t)
        if p is None or p.color == me.color:
            continue
        if p.piece_type == chess.KING or value(p) > value(me) or not b.attackers(p.color, t):
            targets += 1
    return targets >= 2 and (b.is_check() or _is_safe(b, sq))


def _line_pairs(b: chess.Board, sq: int):
    """For slider on sq: yield (front_sq, rear_sq) of enemy pieces aligned on one ray."""
    me = b.piece_at(sq)
    for df, dr in _DIRS.get(me.piece_type, []):
        f, r = chess.square_file(sq), chess.square_rank(sq)
        found = []
        while len(found) < 2:
            f, r = f + df, r + dr
            if not (0 <= f < 8 and 0 <= r < 8):
                break
            s = chess.square(f, r)
            p = b.piece_at(s)
            if p is None:
                continue
            if p.color == me.color:
                break
            found.append(s)
        if len(found) == 2:
            yield found[0], found[1]


def line_motifs(board: chess.Board, move: chess.Move) -> set[str]:
    """Pins and skewers created by the moved slider."""
    b = board.copy(stack=False)
    b.push(move)
    sq = move.to_square
    out: set[str] = set()
    if b.piece_at(sq) is None or b.piece_at(sq).piece_type not in _DIRS:
        return out
    for front, rear in _line_pairs(b, sq):
        fp, rp = b.piece_at(front), b.piece_at(rear)
        if fp.piece_type == chess.KING or value(fp) > value(rp):
            out.add("skewer")
        elif rp.piece_type == chess.KING or value(rp) > value(fp):
            out.add("pin")
    return out


def is_discovered(board: chess.Board, move: chess.Move) -> bool:
    """Discovered check, or a discovered attack on an enemy queen/rook by a piece other than the mover."""
    b = board.copy(stack=False)
    b.push(move)
    if any(s != move.to_square for s in b.checkers()):
        return True
    me = board.turn
    for sq, p in board.piece_map().items():
        if p.color != me or sq == move.from_square or p.piece_type not in _DIRS:
            continue
        new = b.attacks(sq) & ~board.attacks(sq)
        for t in new:
            tp = b.piece_at(t)
            if tp and tp.color != me and tp.piece_type in (chess.QUEEN, chess.ROOK) and value(tp) > value(p):
                return True
    return False


def is_back_rank_mate(board: chess.Board, move: chess.Move) -> bool:
    b = board.copy(stack=False)
    b.push(move)
    if not b.is_checkmate():
        return False
    k = b.king(b.turn)
    home = 0 if b.turn == chess.WHITE else 7
    if k is None or chess.square_rank(k) != home:
        return False
    return any(b.piece_at(s).piece_type in (chess.ROOK, chess.QUEEN) and chess.square_rank(s) == home for s in b.checkers())


def mate_in_one(board: chess.Board) -> list[chess.Move]:
    out = []
    for m in board.legal_moves:
        board.push(m)
        if board.is_checkmate():
            out.append(m)
        board.pop()
    return out


def move_motifs(board: chess.Board, move: chess.Move) -> set[str]:
    """Motifs a move creates for the side making it."""
    tags: set[str] = set()
    if is_fork(board, move):
        tags.add("fork")
    tags |= line_motifs(board, move)
    if is_discovered(board, move):
        tags.add("discovered")
    if is_back_rank_mate(board, move):
        tags.add("back_rank")
    if board.is_capture(move):
        cap = board.piece_at(move.to_square)
        if cap and move.to_square in hanging_pieces(board, not board.turn):
            tags.add("missed_capture")
    return tags


def allowed_motifs(board_after: chess.Board) -> set[str]:
    """Motifs the opponent (side to move in board_after) gets: hanging piece, forks, mate threats."""
    tags: set[str] = set()
    victim = not board_after.turn
    if hanging_pieces(board_after, victim):
        tags.add("hanging_piece")
    mates = mate_in_one(board_after)
    if mates:
        tags.add("mate_threat")
        if any(is_back_rank_mate(board_after, m) for m in mates):
            tags.add("back_rank")
    elif any(is_fork(board_after, m) for m in board_after.legal_moves):
        tags.add("fork")
    return tags
