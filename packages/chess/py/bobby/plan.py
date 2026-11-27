"""Daily plan from due cards, weaknesses and level."""
from __future__ import annotations

from .srs import due_cards
from .weakness import top_tags

TITLES = {
    "fork": "Forks", "pin": "Pins", "skewer": "Skewers", "discovered": "Discovered attacks",
    "back_rank": "Back-rank threats", "hanging_piece": "Hanging pieces", "mate_threat": "Mate threats",
    "missed_mate": "Finding mates", "missed_capture": "Free material", "time_trouble": "Clock management",
    "endgame_k_p": "King and pawn endgames", "endgame_rook": "Rook endgames", "endgame_queen": "Queen endgames",
    "endgame_minor": "Minor-piece endgames", "endgame_mixed": "Mixed endgames",
}
BEGINNER_LESSONS = {"never": "board-setup", "moves": "check"}
TAG_LESSON = {"fork": "fork", "pin": "pin", "skewer": "skewer", "discovered": "discovered-attack",
              "back_rank": "back-rank-mate", "hanging_piece": "hanging-pieces",
              "endgame_k_p": "endgame-king-and-pawn", "endgame_rook": "endgame-rook-bridge",
              "missed_mate": "mate-in-one-drill", "mate_threat": "scholars-mate-defend",
              "removing_defender": "removing-defender", "missed_capture": "counting-exchanges",
              "passed_pawn": "pawn-structure", "king_activity": "king-activity", "opposition": "opposition"}


def tag_title(tag: str) -> str:
    if tag.startswith("opening_"):
        return f"Opening {tag.split('_', 1)[1]}"
    return TITLES.get(tag, tag.replace("_", " ").capitalize())


def daily_plan(profile: dict, weakness: dict | None, cards: list[dict], today: str) -> dict:
    items = []
    due = due_cards(cards or [], today)
    if due:
        items.append({"kind": "review", "ref": "srs", "title": f"Review {len(due)} puzzle(s) from your games",
                      "minutes": min(15, max(3, len(due)))})
    level = profile.get("level", "moves")
    if level in BEGINNER_LESSONS and profile.get("games", 0) < 10:
        items.append({"kind": "lesson", "ref": BEGINNER_LESSONS[level], "title": "Next lesson", "minutes": 10})
    tags = top_tags(weakness, 2)
    for i, t in enumerate(tags):
        if t.startswith("endgame_"):
            items.append({"kind": "endgame", "ref": t, "title": f"Practise: {tag_title(t)}", "minutes": 8})
        elif t.startswith("opening_"):
            items.append({"kind": "opening", "ref": t, "title": f"Drill: {tag_title(t)}", "minutes": 6})
        else:
            items.append({"kind": "puzzles" if i == 0 or t not in TAG_LESSON else "lesson",
                          "ref": t if i == 0 or t not in TAG_LESSON else TAG_LESSON[t],
                          "title": f"{'Puzzles' if i == 0 else 'Lesson'}: {tag_title(t)}", "minutes": 10})
    if not tags:
        items.append({"kind": "puzzles", "ref": "mixed", "title": "Mixed tactics puzzles", "minutes": 10})
    items.append({"kind": "play", "ref": "bot", "title": "Play one game vs Bobby", "minutes": 15})
    return {"date": today, "items": items, "minutes": sum(i["minutes"] for i in items)}
