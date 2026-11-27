"""Lesson step checking (schema in docs/CONTRACT.md)."""
from __future__ import annotations

import chess

STEP_TYPES = ("info", "move", "square", "quiz")


def _norm_move(fen: str | None, answer: str) -> str:
    a = str(answer).strip()
    if not fen:
        return a.lower()
    board = chess.Board(fen)
    for parse in (chess.Move.from_uci, board.parse_san):
        try:
            mv = parse(a)
        except ValueError:
            continue
        if mv in board.legal_moves:
            return mv.uci()
    return a.lower()


def _correct(step: dict, answer) -> bool:
    kind = step.get("type")
    correct = [str(c).strip().lower() for c in step.get("correct") or []]
    if kind == "info":
        return True
    if answer is None:
        return False
    if kind == "move":
        return _norm_move(step.get("fen"), answer) in correct
    if kind == "square":
        return str(answer).strip().lower() in correct
    if kind == "quiz":
        opts = step.get("options") or []
        if isinstance(answer, int) and not isinstance(answer, bool) and 0 <= answer < len(opts):
            answer = opts[answer]
        return str(answer).strip().lower() in correct
    raise ValueError(f"unknown step type: {kind!r}")


def lesson_check(lesson: dict, step_index: int, answer) -> dict:
    """next_index: following step when correct, same step when wrong, None when the lesson is finished."""
    steps = lesson.get("steps") or []
    if not 0 <= step_index < len(steps):
        raise ValueError("step_index out of range")
    step = steps[step_index]
    ok = _correct(step, answer)
    if ok:
        nxt = step_index + 1 if step_index + 1 < len(steps) else None
        return {"correct": True, "feedback": step.get("explanation") or "Correct.", "next_index": nxt}
    hint = step.get("hint")
    return {"correct": False, "feedback": f"Not quite. {hint}" if hint else "Not quite, try again.", "next_index": step_index}
