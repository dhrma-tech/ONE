"""Spaced repetition: ladder 1/3/7/30 days, ease-adjusted. grade 0=again 1=hard 2=good 3=easy."""
from __future__ import annotations

from .common import add_days, to_date

LADDER = [1, 3, 7, 30]
EASE_START, EASE_MIN, EASE_MAX = 2.5, 1.3, 3.0
EASE_DELTA = {0: -0.2, 1: -0.15, 2: 0.0, 3: 0.15}
GRADE_FACTOR = {1: 0.6, 2: 1.0, 3: 1.3}
MAX_INTERVAL = 365


def srs_new_card(item_id: str, today: str) -> dict:
    to_date(today)
    return {"id": item_id, "item_id": item_id, "due": today, "interval": 0, "ease": EASE_START,
            "reps": 0, "lapses": 0, "last": None}


def srs_review(card: dict, grade: int, today: str) -> dict:
    if grade not in (0, 1, 2, 3):
        raise ValueError("grade must be 0..3")
    c = dict(card)
    c["ease"] = round(min(EASE_MAX, max(EASE_MIN, c.get("ease", EASE_START) + EASE_DELTA[grade])), 2)
    if grade == 0:
        c["reps"], c["lapses"], interval = 0, c.get("lapses", 0) + 1, 1
    else:
        c["reps"] = c.get("reps", 0) + 1
        if c["reps"] <= len(LADDER):
            base = LADDER[c["reps"] - 1] * c["ease"] / EASE_START
        else:
            base = max(1, c.get("interval", 30)) * c["ease"]
        interval = max(1, min(MAX_INTERVAL, round(base * GRADE_FACTOR[grade])))
    c.update(interval=interval, due=add_days(today, interval), last=today)
    return c


def due_cards(cards: list[dict], today: str) -> list[dict]:
    t = to_date(today)
    return sorted((c for c in cards if to_date(c["due"]) <= t), key=lambda c: (c["due"], str(c["id"])))
