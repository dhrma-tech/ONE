"""Rule-based summaries built from engine facts (post-game review, progress). See bobby/explain.py for moves."""
from __future__ import annotations

from ..plan import tag_title
from ..winprob import winprob

CLASS_TEXT = {
    "best": "is the engine's top choice",
    "good": "is a solid move, close to the engine's best",
    "inaccuracy": "is an inaccuracy: it gives away a little of your advantage",
    "mistake": "is a mistake: it hands your opponent a real chance",
    "blunder": "is a blunder: it changes the result of the game",
}


def _eval_str(ev: dict | None) -> str | None:
    if not ev:
        return None
    if ev.get("mate") is not None:
        m = ev["mate"]
        return f"mate in {abs(m)} for {'White' if m > 0 else 'Black'}" if m else "checkmate"
    if ev.get("cp") is None:
        return None
    return f"{ev['cp'] / 100:+.1f}"


def _themes(facts: dict) -> str:
    tags = [t for t in facts.get("tags") or facts.get("weakness_tags") or [] if not str(t).startswith("phase_")]
    # Opening tags carry an ECO code (opening_A00); in plain words that is just "opening basics".
    names = []
    for t in tags[:3]:
        n = "opening basics" if str(t).startswith("opening_") else tag_title(t).lower()
        if n not in names:
            names.append(n)
    return ", ".join(names)


def _move(facts: dict) -> str:
    mv = facts.get("move") or "This move"
    best = facts.get("best_line") or []
    cls = facts.get("class")
    parts = [f"{mv} {CLASS_TEXT.get(cls, 'was played')}."]
    a, b = _eval_str(facts.get("eval_before")), _eval_str(facts.get("eval_after"))
    if a and b and a != b:
        parts.append(f"The evaluation went from {a} to {b}.")
    if best and cls not in ("best", None) and best[0] != mv:
        parts.append(f"The engine preferred {best[0]}" + (f", continuing {' '.join(best[1:5])}." if len(best) > 1 else "."))
    th = _themes(facts)
    if th:
        parts.append(f"Theme to watch: {th}.")
    cards = facts.get("cards") or facts.get("knowledge_cards") or []
    if cards and isinstance(cards[0], dict) and cards[0].get("text"):
        parts.append(cards[0]["text"])
    return " ".join(parts)


def _review(facts: dict) -> str:
    """Post-game summary in plain words: how it went, where points were lost, what to practise. One idea per line."""
    lines = []
    acc = facts.get("accuracy")
    res = {"win": "You won", "loss": "You lost", "draw": "It was a draw"}.get(facts.get("result") or "")
    if isinstance(acc, (int, float)):
        word = "great" if acc >= 85 else "solid" if acc >= 70 else "shaky" if acc >= 50 else "rough"
        lines.append(f"{res + '. ' if res else ''}Your accuracy was {acc:.0f}%, a {word} game.")
    elif res:
        lines.append(f"{res}.")
    one = {"blunders": "blunder", "mistakes": "mistake", "inaccuracies": "inaccuracy"}
    counts = [f"{facts[k]} {one[k] if facts[k] == 1 else k}" for k in one if facts.get(k)]
    weak = facts.get("weakest_phase")
    if counts:
        lines.append("Where you slipped: " + ", ".join(counts) + (f", mostly in the {weak}." if weak else "."))
    elif isinstance(acc, (int, float)):
        lines.append("No big slips. Nice and clean.")
    km = facts.get("key_moments") or []
    if km:
        k = km[0]
        if isinstance(k, dict) and k.get("move"):
            where = f"move {k['move_number']}, " if k.get("move_number") else ""
            line = f"Biggest turning point: {where}{k['move']}"
            lines.append(line + (f". {k['best']} was better." if k.get("best") else "."))
        else:
            lines.append(f"There were {len(km)} key moments worth replaying.")
    th = _themes(facts)
    if th:
        lines.append(f"Work on: {th}.")
    tip = {"opening": "Develop knights and bishops early, castle, and don't move the same piece twice.",
           "middlegame": "Before every move, check: what does my opponent threaten, and is any of my pieces undefended?",
           "endgame": "Bring your king into the game and push passed pawns."}.get(weak or "")
    cards = facts.get("cards") or facts.get("knowledge_cards") or []
    if cards and isinstance(cards[0], dict) and cards[0].get("text"):
        tip = cards[0]["text"]
    if tip:
        lines.append(f"Tip: {tip}")
    return "\n".join(lines) or "Game saved. Open the review to step through the key moments."


HABITS = {
    "opening": "In the opening: knights and bishops out, castle, then attack.",
    "middlegame": "Every move, ask: what is my opponent threatening, and is any piece of mine undefended?",
    "endgame": "In endgames, march your king to the middle and push your passed pawns.",
}


def _progress(facts: dict) -> str:
    """Cross-game progress in plain words, one idea per line."""
    n = facts.get("recent_games") or 0
    if not n:
        return "Play a few games against Bobby and I will tell you how you are improving."
    lines = []
    acc, trend = facts.get("accuracy"), facts.get("accuracy_trend") or 0
    way = "going up" if trend >= 3 else "going down" if trend <= -3 else "steady"
    lines.append(f"Last {n} game{'' if n == 1 else 's'}: {acc:.0f}% accuracy on average, {way}." if isinstance(acc, (int, float))
                 else f"You played {n} game{'' if n == 1 else 's'} recently.")
    bpg, weak = facts.get("blunders_per_game"), facts.get("weakest_phase")
    if bpg:
        lines.append(f"Biggest leak: about {bpg:.1f} blunder{'' if round(bpg, 1) == 1 else 's'} per game"
                     + (f", most of them in the {weak}." if weak else "."))
    th = _themes(facts)
    if th:
        lines.append(f"Keep practising: {th}.")
    habit = HABITS.get(weak or "") or "Before every move, check checks, captures and threats."
    lines.append(f"Habit to build: {habit}")
    lvl = facts.get("todays_level") or {}
    if lvl.get("bobby_rating"):
        step = lvl.get("step") or 0
        move = " (up today)" if step > 0 else " (eased off today)" if step < 0 else ""
        goal = f" Goal: {lvl['accuracy_target']}% accuracy" if lvl.get("accuracy_target") else ""
        lines.append(f"Today Bobby plays at about {lvl['bobby_rating']}{move}.{goal}" + ("." if goal else ""))
    return "\n".join(lines)


def _hint(facts: dict) -> str:
    level = int(facts.get("hint_level", 1))
    best = facts.get("best_line") or []
    th = _themes(facts)
    if level <= 1 or not best:
        return f"Look for {th}." if th else "Look at checks, captures and threats first."
    san = best[0]
    piece = {"K": "king", "Q": "queen", "R": "rook", "B": "bishop", "N": "knight", "O": "king"}.get(san[0], "pawn")
    if level == 2:
        return f"Use your {piece}."
    return f"Play {san}."


def template_explanation(facts: dict, mode: str) -> str:
    if mode == "move_explain":
        return _move(facts)
    if mode == "review":
        return _review(facts)
    if mode == "hint":
        return _hint(facts)
    if mode == "progress":
        return _progress(facts)
    if mode == "chat":
        base = _move(facts) if facts.get("move") else ""
        ev = _eval_str(facts.get("eval") or facts.get("eval_after"))
        if ev and not base:
            wp = winprob((facts.get("eval") or facts.get("eval_after") or {}).get("cp"),
                         (facts.get("eval") or facts.get("eval_after") or {}).get("mate"))
            base = f"The engine rates this position {ev} (White's winning chances about {wp * 100:.0f}%)."
        return base.strip()
    raise ValueError(f"unknown mode: {mode!r}")
