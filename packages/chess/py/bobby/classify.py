"""Move classification from win-probability loss; accuracy, ACPL, key moments."""
from __future__ import annotations

import chess

from . import accuracy as acc
from .common import norm_color
from .winprob import eval_cp, eval_wp, for_color

BEST_MAX = 0.02        # loss at or below -> "best" (or exact engine move)
INACCURACY = 0.05
MISTAKE = 0.10
BLUNDER = 0.20
KEY_MOMENT_MIN = 0.10  # minimum swing to count as key moment
KEY_MOMENTS_MAX = 5


def label(loss: float, played_best: bool = False, thresholds: dict | None = None) -> str:
    t = {"best": BEST_MAX, "inaccuracy": INACCURACY, "mistake": MISTAKE, "blunder": BLUNDER, **(thresholds or {})}
    if loss >= t["blunder"]:
        return "blunder"
    if loss >= t["mistake"]:
        return "mistake"
    if loss >= t["inaccuracy"]:
        return "inaccuracy"
    return "best" if played_best or loss <= t["best"] else "good"


def mover(m: dict, idx: int) -> str:
    fen = m.get("fen_before")
    if fen:
        return "w" if chess.Board(fen).turn == chess.WHITE else "b"
    ply = m.get("ply", idx + 1)
    return "w" if ply % 2 == 1 else "b"


def fen_after(m: dict) -> str | None:
    if m.get("fen_after"):
        return m["fen_after"]
    if m.get("fen_before") and m.get("uci"):
        b = chess.Board(m["fen_before"])
        b.push(chess.Move.from_uci(m["uci"]))
        return b.fen()
    return None


def classify_moves(moves: list[dict], player_color: str, thresholds: dict | None = None) -> dict:
    pc = norm_color(player_color)
    out, movers, losses_cp = [], [], {"w": [], "b": []}
    wps = []
    for i, m in enumerate(moves):
        c = mover(m, i)
        fa = fen_after(m)
        wp_before = eval_wp(m.get("eval_before"))
        wp_after = eval_wp(m.get("eval_after"), fa)
        ref = m.get("best_eval") or m.get("eval_before")
        wp_best = eval_wp(ref)
        if i == 0:
            wps.append(wp_before)
        wps.append(wp_after)
        movers.append(c)
        loss = max(0.0, for_color(wp_best, c) - for_color(wp_after, c))
        sign = 1 if c == "w" else -1
        cp_after = 1000.0 * sign if wp_after in (0.0, 1.0) and fa and chess.Board(fa).is_checkmate() else eval_cp(m.get("eval_after"))
        cp_loss = max(0.0, sign * (eval_cp(ref) - cp_after))
        losses_cp[c].append(cp_loss)
        played_best = bool(m.get("best_uci")) and m.get("uci") == m.get("best_uci")
        out.append({
            "ply": m.get("ply", i + 1),
            "class": label(loss, played_best, thresholds),
            "winprob_loss": round(loss, 4),
            "is_player": c == pc,
            "cp_loss": round(cp_loss, 1),
            "swing": round(abs(wp_after - wp_before), 4),
        })
    key = sorted((o for o in out if o["swing"] >= KEY_MOMENT_MIN), key=lambda o: -o["swing"])[:KEY_MOMENTS_MAX]
    return {
        "moves": [{k: v for k, v in o.items() if k != "swing"} for o in out],
        "accuracy": acc.game_accuracy(wps, movers),
        "acpl": acc.acpl(losses_cp),
        "key_moments": sorted(o["ply"] for o in key),
    }
