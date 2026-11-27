"""Weakness model: decayed counts of tags from player errors.

weakness = {version:1, games:int, tags:{tag:{count:int, score:float, last_seen:str|None}}}
"""
from __future__ import annotations

from .analysis import annotate

DECAY = 0.9               # per analyzed game
BLUNDER_WEIGHT = 1.5
CONTEXT_PREFIXES = ("phase_",)  # descriptive tags, not trainable weaknesses


def empty() -> dict:
    return {"version": 1, "games": 0, "tags": {}}


def update_weakness(weakness: dict | None, analyzed_game: dict) -> dict:
    w = weakness or empty()
    tags = {t: {**v, "score": round(v.get("score", 0.0) * DECAY, 4)} for t, v in (w.get("tags") or {}).items()}
    date = analyzed_game.get("date")
    for row in annotate(analyzed_game):
        weight = BLUNDER_WEIGHT if row["class"] == "blunder" else 1.0
        for t in row["tags"]:
            e = tags.setdefault(t, {"count": 0, "score": 0.0, "last_seen": None})
            e["count"] += 1
            e["score"] = round(e["score"] + weight, 4)
            e["last_seen"] = date or e["last_seen"]
    return {"version": 1, "games": w.get("games", 0) + 1, "tags": tags}


def top_tags(weakness: dict | None, n: int = 3, trainable: bool = True) -> list[str]:
    items = (weakness or {}).get("tags", {}).items()
    if trainable:
        items = [(t, v) for t, v in items if not t.startswith(CONTEXT_PREFIXES)]
    return [t for t, _ in sorted(items, key=lambda kv: (-kv[1].get("score", 0), -kv[1].get("count", 0), kv[0]))[:n]]
