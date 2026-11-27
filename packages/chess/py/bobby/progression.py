"""Day-to-day progression: recent form from analysed games -> today's level (bot stretch) and challenge targets.

progression = {version:1, date, offset:int, tier:int, accuracy_target:int, blunder_cap:int,
               step:int (-50/0/+50), reasons:[str], form:{...}}
"""
from __future__ import annotations

from .analysis import annotate, summary
from .common import clamp
from .weakness import top_tags

RECENT = 8                    # games considered "recent form"
MIN_MOVES = 3                 # player moves needed for a game to count
STEP = 50                     # daily level step (Elo points)
OFFSET_MIN, OFFSET_MAX = -200, 400
DEFAULT_ACCURACY_TARGET = 70
PHASE_NAMES = {"opening": "opening", "middle": "middlegame", "end": "endgame"}


def _score(g: dict) -> float | None:
    res, pc = g.get("result"), g.get("player_color", "w")
    if res == "1/2-1/2":
        return 0.5
    if res in ("1-0", "0-1"):
        return 1.0 if (res == "1-0") == (pc == "w") else 0.0
    return None


def recent_form(games: list[dict]) -> dict:
    """Stats over the most recent analysed games (oldest first in the input, as stored)."""
    # Games where the player made only a move or two (early resignations) say nothing about their level.
    games = [g for g in games or [] if g.get("moves") and summary(g)["moves"] >= MIN_MOVES][-RECENT:]
    if not games:
        return {"games": 0}
    rows, accs, blunders, mistakes, scores = [], [], [], [], []
    errors_by_phase = {"opening": 0, "middle": 0, "end": 0}
    for g in games:
        s = summary(g)
        accs.append(float(s["accuracy"]))
        blunders.append(s["blunders"])
        mistakes.append(s["mistakes"])
        sc = _score(g)
        if sc is not None:
            scores.append(sc)
        for r in annotate(g):
            if r["is_player"] and r["class"] in ("mistake", "blunder") and r.get("phase") in errors_by_phase:
                errors_by_phase[r["phase"]] += 1
        rows.append(s)
    n = len(games)
    half = max(1, n // 2)
    early, late = accs[:half], accs[-half:]
    trend = round(sum(late) / len(late) - sum(early) / len(early), 1) if n >= 4 else 0.0
    weakest = max(errors_by_phase, key=lambda k: errors_by_phase[k])
    return {
        "games": n,
        "accuracy": round(sum(accs) / n, 1),
        "accuracy_last": round(accs[-1], 1),
        "accuracy_trend": trend,
        "blunders_per_game": round(sum(blunders) / n, 2),
        "mistakes_per_game": round(sum(mistakes) / n, 2),
        "score_rate": round(sum(scores) / len(scores), 2) if scores else None,
        "wins": scores.count(1.0), "draws": scores.count(0.5), "losses": scores.count(0.0),
        "errors_by_phase": {PHASE_NAMES[k]: v for k, v in errors_by_phase.items()},
        "weakest_phase": PHASE_NAMES[weakest] if errors_by_phase[weakest] else None,
    }


def _round5(x: float) -> int:
    return int(5 * round(x / 5))


def daily_progression(profile: dict, games: list[dict], prev: dict | None, yesterday: list[dict] | None,
                      today: str) -> dict:
    """Today's level. Computed once per day: an unchanged `prev` is returned if it is already for `today`.

    Step up when the player met most of yesterday's challenges or is scoring well with decent accuracy;
    step down after a clear losing run or very low accuracy. The offset is added to the rating-based bot target.
    """
    if prev and prev.get("date") == today:
        return prev
    form = recent_form(games)
    offset = int((prev or {}).get("offset", 0))
    tier = int((prev or {}).get("tier", 1))
    done = [c for c in yesterday or [] if c.get("done")]
    completion = len(done) / len(yesterday) if yesterday else None
    reasons, step = [], 0
    if form["games"]:
        acc, sr = form["accuracy"], form.get("score_rate")
        if (completion is not None and completion >= 0.6) or (sr is not None and sr >= 0.6 and acc >= 65):
            step = STEP
            reasons.append("You met most of yesterday's goals." if completion is not None and completion >= 0.6
                           else "You have been winning with good accuracy.")
        elif (sr is not None and sr <= 0.25 and form["losses"] >= 3) or acc < 45:
            step = -STEP
            reasons.append("A few tough games in a row, so Bobby eases off a little.")
        else:
            reasons.append("Same level as yesterday: keep building consistency.")
        if form["accuracy_trend"] >= 3:
            reasons.append(f"Your accuracy is trending up (+{form['accuracy_trend']:.0f}).")
        elif form["accuracy_trend"] <= -3:
            reasons.append(f"Your accuracy dipped recently ({form['accuracy_trend']:.0f}).")
    else:
        reasons.append("Play a game so Bobby can learn your level.")
    new_offset = int(clamp(offset + step, OFFSET_MIN, OFFSET_MAX))
    step = new_offset - offset
    acc_target = DEFAULT_ACCURACY_TARGET if not form["games"] else int(clamp(_round5(form["accuracy"] + 4), 55, 95))
    bpg = form.get("blunders_per_game", 2)
    blunder_cap = max(0, int(bpg) - (0 if bpg < 1 else 1)) if form["games"] else 2
    return {
        "version": 1, "date": today, "offset": new_offset, "step": step,
        "tier": max(1, tier + (1 if step > 0 else 0)),
        "accuracy_target": acc_target, "blunder_cap": blunder_cap,
        "base_rating": round(float(profile.get("rating", 0))), "reasons": reasons, "form": form,
    }


def progress_report(games: list[dict], weakness: dict | None, progression: dict | None = None) -> dict:
    """Facts for the coach's "how am I improving?" answer (mode "progress")."""
    form = recent_form(games)
    p = progression or {}
    return {
        "recent_games": form.get("games", 0), "form": form,
        "accuracy": form.get("accuracy"), "accuracy_trend": form.get("accuracy_trend"),
        "blunders_per_game": form.get("blunders_per_game"), "weakest_phase": form.get("weakest_phase"),
        "weakness_tags": top_tags(weakness, 3),
        "todays_level": ({"bobby_rating": p.get("base_rating", 0) + p.get("offset", 0), "step": p.get("step", 0),
                          "accuracy_target": p.get("accuracy_target"), "blunder_cap": p.get("blunder_cap")}
                         if p else None),
    }
