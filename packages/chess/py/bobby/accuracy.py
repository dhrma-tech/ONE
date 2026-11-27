"""Lichess-style accuracy and ACPL."""
from __future__ import annotations

import math
import statistics


def move_accuracy(wp_before: float, wp_after: float) -> float:
    """Per-move accuracy (0..100) from mover-perspective win probs (0..1)."""
    loss = max(0.0, (wp_before - wp_after) * 100.0)
    raw = 103.1668 * math.exp(-0.04354 * loss) - 3.1669 + 1.0  # +1 uncertainty bonus
    return max(0.0, min(100.0, raw))


def _harmonic(xs: list[float]) -> float:
    xs = [max(x, 0.5) for x in xs]
    return len(xs) / sum(1.0 / x for x in xs)


def game_accuracy(wps_white: list[float], movers: list[str]) -> dict:
    """wps_white: white win% series of len n+1 (start + after each ply); movers: 'w'|'b' per ply.
    Returns {w, b} accuracy: mean of volatility-weighted mean and harmonic mean (Lichess method)."""
    n = len(movers)
    out = {"w": 0.0, "b": 0.0}
    if n == 0:
        return out
    pct = [w * 100.0 for w in wps_white]
    ws = int(max(2, min(8, n // 10)))
    head = [pct[: ws]] * max(0, min(ws, len(pct)) - 2)
    slide = [pct[i : i + ws] for i in range(0, max(1, len(pct) - ws + 1))]
    windows = (head + slide)[:n]
    while len(windows) < n:
        windows.append(windows[-1])
    weights = [max(0.5, min(12.0, statistics.pstdev(w) if len(w) > 1 else 0.5)) for w in windows]
    per: dict[str, list[tuple[float, float]]] = {"w": [], "b": []}
    for i, c in enumerate(movers):
        before, after = wps_white[i], wps_white[i + 1]
        if c == "b":
            before, after = 1 - before, 1 - after
        per[c].append((move_accuracy(before, after), weights[i]))
    for c, items in per.items():
        if not items:
            continue
        accs = [a for a, _ in items]
        wsum = sum(w for _, w in items)
        weighted = sum(a * w for a, w in items) / wsum
        out[c] = round((weighted + _harmonic(accs)) / 2.0, 1)
    return out


def acpl(losses: dict[str, list[float]]) -> dict:
    return {c: round(sum(v) / len(v), 1) if v else 0.0 for c, v in (("w", losses.get("w", [])), ("b", losses.get("b", [])))}
