"""Rules wrapper over python-chess: game state, moves, PGN."""
from __future__ import annotations

import io

import chess
import chess.pgn


def _board(fen: str | None) -> chess.Board:
    try:
        return chess.Board(fen) if fen else chess.Board()
    except ValueError as e:
        raise ValueError(f"bad FEN: {e}") from e


def _reason(outcome: chess.Outcome | None) -> str | None:
    return outcome.termination.name.lower() if outcome else None


def state(board: chess.Board, san: str | None = None) -> dict:
    outcome = board.outcome(claim_draw=False)
    return {
        "fen": board.fen(),
        "turn": "w" if board.turn == chess.WHITE else "b",
        "legal_moves": [m.uci() for m in board.legal_moves],
        "san": san,
        "check": board.is_check(),
        "over": outcome is not None,
        "result": outcome.result() if outcome else "*",
        "reason": _reason(outcome),
    }


def new_game(fen: str | None = None) -> dict:
    return state(_board(fen))


def parse_move(board: chess.Board, uci: str) -> chess.Move:
    try:
        move = chess.Move.from_uci(str(uci))
    except ValueError as e:
        raise ValueError(f"bad move: {uci!r}") from e
    if move not in board.legal_moves:
        raise ValueError(f"illegal move: {uci}")
    return move


def apply_move(fen: str, uci: str) -> dict:
    board = _board(fen)
    move = parse_move(board, uci)
    san = board.san(move)
    board.push(move)
    return state(board, san)


def legal_moves(fen: str) -> list[str]:
    return [m.uci() for m in _board(fen).legal_moves]


def parse_pgn(pgn: str) -> dict:
    game = chess.pgn.read_game(io.StringIO(pgn or ""))
    if game is None:
        raise ValueError("empty PGN")
    if game.errors:
        raise ValueError(f"PGN error: {game.errors[0]}")
    board = game.board()
    moves = []
    for move in game.mainline_moves():
        before = board.fen()
        san = board.san(move)
        board.push(move)
        moves.append({"uci": move.uci(), "san": san, "fen_before": before, "fen_after": board.fen()})
    headers = dict(game.headers)
    result = headers.get("Result", "*")
    if result == "*":
        o = board.outcome(claim_draw=False)
        result = o.result() if o else "*"
    return {"headers": headers, "moves": moves, "result": result}


def to_pgn(headers: dict | None, moves: list) -> str:
    headers = dict(headers or {})
    game = chess.pgn.Game()
    fen = headers.get("FEN")
    if fen:
        game.setup(_board(fen))
    for k, v in headers.items():
        game.headers[str(k)] = str(v)
    node = game
    board = game.board()
    for m in moves:
        uci = m["uci"] if isinstance(m, dict) else m
        move = parse_move(board, uci)
        board.push(move)
        node = node.add_variation(move)
    if "Result" not in headers:
        o = board.outcome(claim_draw=False)
        game.headers["Result"] = o.result() if o else "*"
    return game.accept(chess.pgn.StringExporter(headers=True, variations=False, comments=False))
