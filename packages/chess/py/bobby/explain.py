"""Rule-based coach: plain-language explanations built from engine facts and tactic detectors. No AI.

Every answer is {text, viz, tags}:
  text  one idea per line, short and simple
  viz   {arrows:[[from, to, kind]], squares:{sq: kind}, line:{fen, moves:[uci]} | None}
        kinds: "best" (green), "threat" (red), "played" (amber), "danger" (red tint), "good" (green tint)
  tags  weakness/motif tags the answer is about (the app links them to lessons and puzzles)
"""
from __future__ import annotations

import chess

from .common import value
from .phase import phase
from .tactics import hanging_pieces, is_back_rank_mate, is_fork, line_motifs, is_discovered, mate_in_one
from .winprob import winprob

NAME = {chess.PAWN: "pawn", chess.KNIGHT: "knight", chess.BISHOP: "bishop", chess.ROOK: "rook",
        chess.QUEEN: "queen", chess.KING: "king"}
SIDE = {chess.WHITE: "White", chess.BLACK: "Black"}
QUESTIONS = ("threats", "danger", "best", "better", "plan")
MOTIF_TEXT = {
    "fork": "it attacks two pieces at once (a fork)",
    "pin": "it pins a piece so it cannot move without losing something behind it",
    "skewer": "it hits a big piece that has to move, winning the one behind it (a skewer)",
    "discovered": "moving it uncovers an attack from another piece (a discovered attack)",
    "back_rank": "the king is trapped on its back row (back-rank mate)",
}


# ---------- small helpers ----------
def _sq(s: int) -> str:
    return chess.square_name(s)


def _move(board: chess.Board, uci: str | None) -> chess.Move | None:
    if not uci:
        return None
    try:
        m = chess.Move.from_uci(uci)
    except ValueError:
        return None
    return m if m in board.legal_moves else None


def _chance(ev: dict | None, color: chess.Color) -> float | None:
    """Winning chance 0..1 for `color` from a white-view eval."""
    if not ev or (ev.get("cp") is None and ev.get("mate") is None):
        return None
    w = winprob(ev.get("cp"), ev.get("mate"))
    return w if color == chess.WHITE else 1 - w


def _pct(x: float) -> str:
    return f"{round(x * 100)}%"


def describe(board: chess.Board, m: chess.Move) -> str:
    """'your knight takes the bishop on f6 with check' style phrase, from the mover's view."""
    piece = board.piece_at(m.from_square)
    if board.is_castling(m):
        s = "castle " + ("kingside" if chess.square_file(m.to_square) > 4 else "queenside")
    else:
        what = NAME[piece.piece_type] if piece else "piece"
        if board.is_capture(m):
            cap = board.piece_at(m.to_square)
            victim = NAME[cap.piece_type] if cap else "pawn"  # en passant
            s = f"{what} takes the {victim} on {_sq(m.to_square)}"
        else:
            s = f"{what} to {_sq(m.to_square)}"
        if m.promotion:
            s += f" and becomes a {NAME[m.promotion]}"
    b = board.copy(stack=False)
    b.push(m)
    if b.is_checkmate():
        s += ", checkmate"
    elif b.is_check():
        s += " with check"
    return s


def motifs(board: chess.Board, m: chess.Move) -> list[str]:
    out = []
    if is_fork(board, m):
        out.append("fork")
    out += sorted(line_motifs(board, m))
    if is_discovered(board, m):
        out.append("discovered")
    if is_back_rank_mate(board, m):
        out.append("back_rank")
    return out


def _attacked_by_cheaper_or_free(board: chess.Board, color: chess.Color) -> list[int]:
    """`color`'s pieces the opponent could win right now (works whoever is to move)."""
    b = board.copy(stack=False)
    if b.turn == color:
        if b.is_check():
            return []
        b.push(chess.Move.null())
    return hanging_pieces(b, color)


def _san(board: chess.Board, m: chess.Move) -> str:
    return board.san(m)


def _opp_threats(board: chess.Board, me: chess.Color) -> tuple[list[chess.Move], list[int]]:
    """(mate-in-one moves, winnable squares) the opponent would have if it were their turn."""
    b = board.copy(stack=False)
    if b.turn == me:
        if b.is_check():
            return [], []
        b.push(chess.Move.null())
    return mate_in_one(b), hanging_pieces(b, me)


def why(board: chess.Board, m: chess.Move) -> tuple[str, list[str]]:
    """Plain reason a (good) move is good, most important first. Returns (sentence, tags)."""
    me = board.turn
    after = board.copy(stack=False)
    after.push(m)
    if after.is_checkmate():
        return "it is checkmate", ["missed_mate"]
    mates0, hang0 = _opp_threats(board, me)
    mates1, hang1 = _opp_threats(after, me)
    if mates0 and not mates1:
        return f"it stops their checkmate threat ({_null_san(board, mates0[0])})", ["mate_threat"]
    if board.is_capture(m) and m.to_square in _attacked_by_cheaper_or_free(board, not me):
        return "it wins a piece that is not protected", ["missed_capture"]
    # a piece that was under attack and is safe afterwards (moved away, or now defended)
    saved = [s for s in hang0 if (m.to_square not in hang1 if s == m.from_square else s not in hang1)]
    if saved:
        p = board.piece_at(saved[0])
        return f"it saves your {NAME[p.piece_type]} on {_sq(saved[0])}, which was under attack", ["hanging_piece"]
    mm = motifs(board, m)
    if mm:
        return MOTIF_TEXT[mm[0]], mm
    if mate_in_one(after.copy(stack=False)) == [] and not after.is_check():
        nb = after.copy(stack=False)
        nb.push(chess.Move.null())
        if mate_in_one(nb):
            return "it threatens checkmate next move", []
        hit = hanging_pieces(nb, not me)
        if hit:
            p = after.piece_at(hit[0])
            return f"it attacks their {NAME[p.piece_type]} on {_sq(hit[0])}", []
    if board.is_castling(m):
        return "your king gets safe and a rook joins the game", []
    piece = board.piece_at(m.from_square)
    if phase(board.fen()) == "opening" and piece and piece.piece_type in (chess.KNIGHT, chess.BISHOP):
        return "it develops a piece toward the centre", []
    return "it keeps your pieces active and safe; the engine rates it highest", []


def _null_san(board: chess.Board, m: chess.Move) -> str:
    b = board.copy(stack=False)
    b.push(chess.Move.null())
    return b.san(m)


def _viz(arrows=None, squares=None, line=None) -> dict:
    return {"arrows": arrows or [], "squares": squares or {}, "line": line}


# ---------- explain a played move ----------
def explain_move(move: dict, reply_pv: list[str] | None = None) -> dict:
    """move: {fen_before, uci, san, class, eval_before, eval_after, best_uci, best_pv?}
    reply_pv: the engine's best line for the opponent after the move (from the next position's analysis)."""
    board = chess.Board(move["fen_before"])
    me = board.turn
    played = _move(board, move.get("uci"))
    if played is None:
        return {"text": "This move could not be read.", "viz": _viz(), "tags": []}
    cls = move.get("class")
    after = board.copy(stack=False)
    after.push(played)
    best = _move(board, move.get("best_uci"))
    lines, tags, arrows, squares = [], [], [[_sq(played.from_square), _sq(played.to_square), "played"]], {}

    head = {"best": "Great move!", "good": "Good move.", "inaccuracy": "Not the best move.",
            "mistake": "This is a mistake.", "blunder": "This is a blunder."}.get(cls, "")
    lines.append(f"{head} You played {move.get('san') or _san(board, played)}: {describe(board, played)}.".strip())

    if after.is_checkmate():
        return {"text": "Checkmate! You won the game with this move.", "viz": _viz(arrows), "tags": []}

    good = cls in ("best", "good", None)
    if good:
        mm = motifs(board, played)
        if mm:
            lines.append("Why it works: " + MOTIF_TEXT[mm[0]] + ".")
            tags += mm
        elif board.is_capture(played) and played.to_square in _attacked_by_cheaper_or_free(board, not me):
            lines.append("It wins material: that piece was not protected.")
        elif board.is_castling(played):
            lines.append("Castling tucks your king away and brings a rook into play.")
    else:
        reply = _move(after, (reply_pv or [None])[0])
        if reply is not None:
            r_san = _san(after, reply)
            arrows.append([_sq(reply.from_square), _sq(reply.to_square), "threat"])
            b2 = after.copy(stack=False)
            b2.push(reply)
            if b2.is_checkmate():
                lines.append(f"Problem: it lets your opponent checkmate you with {r_san}.")
                tags.append("mate_threat")
            elif after.is_capture(reply):
                cap = after.piece_at(reply.to_square)
                lost = NAME[cap.piece_type] if cap else "pawn"
                free = reply.to_square in hanging_pieces(after, me)
                lines.append(f"Problem: they can take your {lost} on {_sq(reply.to_square)} with {r_san}"
                             + (", because it was left unprotected." if free else "."))
                squares[_sq(reply.to_square)] = "danger"
                tags.append("hanging_piece")
            else:
                rm = motifs(after, reply)
                if rm:
                    lines.append(f"Problem: they answer {r_san} and {MOTIF_TEXT[rm[0]]}.")
                    tags += rm
                else:
                    lines.append(f"Problem: it gives your opponent a strong reply, {r_san}.")
        c0, c1 = _chance(move.get("eval_before"), me), _chance(move.get("eval_after"), me)
        if c0 is not None and c1 is not None and c0 - c1 >= 0.08:
            lines.append(f"Your winning chances dropped from {_pct(c0)} to {_pct(c1)}.")

    if best is not None and best != played and not good:
        b_san = _san(board, best)
        arrows.append([_sq(best.from_square), _sq(best.to_square), "best"])
        reason, t = why(board, best)
        tags += t
        lines.append(f"Better was {b_san}: {describe(board, best)}. Why: {reason}.")
    line = None
    pv = move.get("best_pv") or ([move["best_uci"]] if move.get("best_uci") else [])
    if pv and not good:
        line = {"fen": move["fen_before"], "moves": pv[:8]}
    return {"text": "\n".join(lines), "viz": _viz(arrows, squares, line), "tags": sorted(set(tags))}


# ---------- answer a question about a position ----------
def _material(board: chess.Board, color: chess.Color) -> int:
    return sum(value(p) for p in board.piece_map().values() if p.color == color and p.piece_type != chess.KING)


def _developed(board: chess.Board, color: chess.Color) -> int:
    home = chess.BB_RANK_1 if color == chess.WHITE else chess.BB_RANK_8
    minors = board.pieces(chess.KNIGHT, color) | board.pieces(chess.BISHOP, color)
    return len([s for s in minors if not (chess.BB_SQUARES[s] & home)])


def _castled(board: chess.Board, color: chess.Color) -> bool:
    k = board.king(color)
    return k is not None and chess.square_file(k) in (1, 2, 6) and chess.square_rank(k) == (0 if color == chess.WHITE else 7)


def _passed_pawns(board: chess.Board, color: chess.Color) -> list[int]:
    out = []
    for s in board.pieces(chess.PAWN, color):
        f, r = chess.square_file(s), chess.square_rank(s)
        ahead = range(r + 1, 8) if color == chess.WHITE else range(0, r)
        blocked = any(
            (p := board.piece_at(chess.square(ff, rr))) and p.piece_type == chess.PAWN and p.color != color
            for ff in (f - 1, f, f + 1) if 0 <= ff < 8 for rr in ahead)
        if not blocked:
            out.append(s)
    return out


def _threats(board: chess.Board, me: chess.Color) -> tuple[list[str], list, dict]:
    """What the opponent would do if it were their move."""
    lines, arrows, squares = [], [], {}
    if board.turn == me and board.is_check():
        return ["You are in check: deal with that first (move the king, block, or take the checking piece)."], [], \
               {_sq(s): "danger" for s in board.checkers()}
    b = board.copy(stack=False)
    if b.turn == me:
        b.push(chess.Move.null())
    for m in mate_in_one(b)[:1]:
        lines.append(f"They threaten checkmate with {b.san(m)}.")
        arrows.append([_sq(m.from_square), _sq(m.to_square), "threat"])
    for s in hanging_pieces(b, me)[:3]:
        p = b.piece_at(s)
        att = min(b.attackers(not me, s), key=lambda a: value(b.piece_at(a)))
        lines.append(f"They can win your {NAME[p.piece_type]} on {_sq(s)}"
                     + (" (it has no defender)." if not b.attackers(me, s) else " (a cheaper piece attacks it)."))
        arrows.append([_sq(att), _sq(s), "threat"])
        squares[_sq(s)] = "danger"
    if not lines:
        forks = [m for m in b.legal_moves if is_fork(b, m)][:1]
        for m in forks:
            lines.append(f"Watch out: {b.san(m)} would fork two of your pieces.")
            arrows.append([_sq(m.from_square), _sq(m.to_square), "threat"])
    return lines, arrows, squares


def explain_position(fen: str, question: str, lines: list[dict] | None = None) -> dict:
    """question in QUESTIONS. lines: engine lines [{pv:[uci], cp, mate}] with white-view evals, best first.
    'You' means the side to move."""
    if question not in QUESTIONS:
        raise ValueError(f"unknown question: {question!r}")
    board = chess.Board(fen)
    me, opp = board.turn, not board.turn
    top = (lines or [None])[0] or {}
    best = _move(board, (top.get("pv") or [None])[0])
    ev = {"cp": top.get("cp"), "mate": top.get("mate")} if top else None
    out, arrows, squares, tags, line = [], [], {}, [], None

    if board.is_game_over():
        res = "checkmate" if board.is_checkmate() else "a draw"
        return {"text": f"The game is over: {res}.", "viz": _viz(), "tags": []}

    if question == "threats":
        out, arrows, squares = _threats(board, me)
        if not out:
            out = ["No direct threats right now.", "Use the time to improve your worst piece or grab more space."]
        else:
            tags.append("hanging_piece" if squares else "mate_threat")

    elif question == "danger":
        risky = _attacked_by_cheaper_or_free(board, me)
        for s in risky[:4]:
            p = board.piece_at(s)
            defended = bool(board.attackers(me, s))
            out.append(f"Your {NAME[p.piece_type]} on {_sq(s)} is in danger"
                       + (": nothing protects it." if not defended else ": a cheaper piece attacks it."))
            squares[_sq(s)] = "danger"
        # Unprotected pieces that have left the back two ranks: not attacked yet, but easy targets.
        home = (0, 1) if me == chess.WHITE else (6, 7)
        loose = [s for s, p in board.piece_map().items() if p.color == me and p.piece_type not in (chess.KING, chess.PAWN)
                 and not board.attackers(me, s) and s not in risky and chess.square_rank(s) not in home]
        if loose:
            out.append("Not protected (yet safe): " + ", ".join(f"{NAME[board.piece_at(s).piece_type]} on {_sq(s)}" for s in loose[:3]) + ".")
            for s in loose[:3]:
                squares.setdefault(_sq(s), "warn")
        if not out:
            out = ["All your pieces are safe right now."]
        if risky:
            tags.append("hanging_piece")

    elif question == "best":
        if best is None:
            out = ["The engine has not finished thinking yet. Try again in a second."]
        else:
            out.append(f"Best move: {board.san(best)}, {describe(board, best)}.")
            arrows.append([_sq(best.from_square), _sq(best.to_square), "best"])
            reason, t = why(board, best)
            tags += t
            out.append(f"Why: {reason}.")
            c = _chance(ev, me)
            if c is not None:
                out.append(f"After it, your winning chances are about {_pct(c)}.")
            line = {"fen": fen, "moves": (top.get("pv") or [])[:8]}

    elif question == "better":
        cw = _chance(ev, chess.WHITE)
        if cw is None:
            out.append("The engine has not finished thinking yet.")
        else:
            lead = chess.WHITE if cw >= 0.5 else chess.BLACK
            c = cw if lead == chess.WHITE else 1 - cw
            how = "about equal" if c < 0.58 else "a little better" if c < 0.7 else "clearly better" if c < 0.88 else "winning"
            out.append("It is about equal." if how == "about equal" else f"{SIDE[lead]} is {how} ({_pct(c)} winning chances).")
        reasons = []
        d = _material(board, chess.WHITE) - _material(board, chess.BLACK)
        if abs(d) >= 1:
            reasons.append(f"{SIDE[chess.WHITE if d > 0 else chess.BLACK]} has more material (+{abs(d)} in pawns).")
        for col in (chess.WHITE, chess.BLACK):
            k = board.king(col)
            if phase(fen) == "middle" and k is not None and chess.square_file(k) in (3, 4) and not _castled(board, col):
                reasons.append(f"{SIDE[col]}'s king is still in the centre.")
        dw, db = _developed(board, chess.WHITE), _developed(board, chess.BLACK)
        if phase(fen) == "opening" and abs(dw - db) >= 2:
            reasons.append(f"{SIDE[chess.WHITE if dw > db else chess.BLACK]} has more pieces out.")
        for col in (chess.WHITE, chess.BLACK):
            pp = _passed_pawns(board, col)
            if pp and phase(fen) == "end":
                reasons.append(f"{SIDE[col]} has a passed pawn on {_sq(pp[0])}.")
        hw = _attacked_by_cheaper_or_free(board, me)
        if hw:
            reasons.append(f"Your {NAME[board.piece_at(hw[0]).piece_type]} on {_sq(hw[0])} is under attack.")
            squares[_sq(hw[0])] = "danger"
        out += reasons[:3] or ["Neither side has a clear edge in material or safety: it is about who uses their pieces better."]

    else:  # plan
        ph = phase(fen)
        if ph == "opening":
            undeveloped = 4 - _developed(board, me)
            if undeveloped > 0:
                out.append(f"Get your pieces out: {undeveloped} knight/bishop still at home.")
            if not _castled(board, me):
                out.append("Castle soon to keep your king safe.")
            out.append("Fight for the centre squares d4, e4, d5 and e5.")
        elif ph == "middle":
            hw = _attacked_by_cheaper_or_free(board, me)
            if hw:
                out.append(f"First, look after your {NAME[board.piece_at(hw[0]).piece_type]} on {_sq(hw[0])}: it is under attack.")
                squares[_sq(hw[0])] = "danger"
            mob = {s: len(board.attacks(s)) for s, p in board.piece_map().items()
                   if p.color == me and p.piece_type in (chess.KNIGHT, chess.BISHOP, chess.ROOK)}
            if mob:
                worst = min(mob, key=mob.get)
                out.append(f"Improve your least active piece: the {NAME[board.piece_at(worst).piece_type]} on {_sq(worst)}.")
                squares.setdefault(_sq(worst), "warn")
            ok = board.king(opp)
            if ok is not None and not _castled(board, opp):
                out.append("Their king is not castled: open lines toward it and attack.")
            else:
                out.append("Put rooks on open files and look for checks, captures and threats.")
        else:
            pp = _passed_pawns(board, me)
            if pp:
                out.append(f"Push your passed pawn on {_sq(pp[0])} toward promotion, with your king helping.")
                squares[_sq(pp[0])] = "good"
            out.append("Bring your king to the middle: in the endgame it is a strong piece.")
            if _passed_pawns(board, opp):
                s = _passed_pawns(board, opp)[0]
                out.append(f"Stop their passed pawn on {_sq(s)}.")
                squares[_sq(s)] = "danger"
        if best is not None:
            out.append(f"The engine's move here is {board.san(best)}.")
            arrows.append([_sq(best.from_square), _sq(best.to_square), "best"])
    return {"text": "\n".join(out), "viz": _viz(arrows, squares, line), "tags": sorted(set(tags))}
