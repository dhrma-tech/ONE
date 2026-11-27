"""Daily challenges from weakness tags; progress from analyzed games; achievements."""
from __future__ import annotations

from .analysis import summary
from .plan import tag_title
from .weakness import top_tags

MOTIFS = ("fork", "pin", "skewer", "discovered", "back_rank")
CLEAN_ACCURACY = 80


def _ch(today: str, kind: str, tag: str | None, title: str, desc: str, target: int, reward: int) -> dict:
    return {"id": f"{today}:{kind}:{tag or '-'}", "title": title, "description": desc, "kind": kind, "tag": tag,
            "target": target, "progress": 0, "reward": reward, "date": today, "done": False}


def generate_challenges(weakness: dict | None, profile: dict, today: str, progression: dict | None = None) -> list[dict]:
    """Today's challenges. With a `progression` (see progression.daily_progression) the targets follow recent form:
    accuracy a little above your average, a blunder cap a little below it, and a win at today's level."""
    out = []
    prog = progression or {}
    for t in top_tags(weakness, 2):
        if t in MOTIFS:
            out.append(_ch(today, "use_motif", t, f"Land a {tag_title(t).lower().rstrip('s')}",
                           f"Play a good move that creates a {t.replace('_', ' ')} in a game.", 1, 30))
        out.append(_ch(today, "avoid_tag", t, f"Clean on: {tag_title(t)}",
                       f"Finish a game without a mistake tagged {t.replace('_', ' ')}.", 1, 20))
    cap = prog.get("blunder_cap")
    if cap:
        out.append(_ch(today, "max_blunders", None, f"At most {cap} blunder{'' if cap == 1 else 's'}",
                       f"Finish a game with {cap} blunder{'' if cap == 1 else 's'} or fewer. Check every capture and threat first.",
                       cap, 25))
    else:
        out.append(_ch(today, "no_blunders", None, "No blunders", "Finish a game with zero blunders.", 1, 25))
    target_acc = prog.get("accuracy_target") or (CLEAN_ACCURACY if profile.get("rating", 0) >= 1200 else 70)
    out.append(_ch(today, "accuracy", None, f"Accuracy {target_acc}%", f"Score {target_acc}% accuracy or more in a game.",
                   target_acc, 25))
    if prog.get("step", 0) > 0:
        lvl = prog.get("base_rating", 0) + prog.get("offset", 0)
        out.append(_ch(today, "win_game", None, f"Beat Bobby at ~{lvl}", "Bobby levelled up today. Win one game against him.", 1, 40))
    out.append(_ch(today, "play_games", None, "Play 3 games", "Play three games today.", 3, 15))
    seen, uniq = set(), []
    for c in out:
        if c["id"] not in seen:
            seen.add(c["id"])
            uniq.append(c)
    return uniq[:6]


def _progress(c: dict, s: dict, game: dict | None = None) -> int:
    rows = [r for r in s["rows"] if r["is_player"]]
    k = c["kind"]
    if k == "play_games":
        return c["progress"] + 1
    if k == "max_blunders":
        # progress shows how far under the cap the best game came; done once a game stays within the cap
        return c["target"] if s["blunders"] <= c["target"] else c["progress"]
    if k == "win_game":
        res, pc = (game or {}).get("result"), (game or {}).get("player_color", "w")
        won = res in ("1-0", "0-1") and (res == "1-0") == (pc == "w")
        return max(c["progress"], int(won))
    if k == "no_blunders":
        return max(c["progress"], int(s["blunders"] == 0))
    if k == "accuracy":
        return max(c["progress"], int(round(s["accuracy"])))
    if k == "avoid_tag":
        return max(c["progress"], int(not any(c["tag"] in r["tags"] for r in rows)))
    if k == "use_motif":
        return c["progress"] + sum(1 for r in rows if c["tag"] in r["played_motifs"])
    return c["progress"]


def update_challenges(challenges: list[dict], analyzed_game: dict) -> list[dict]:
    s = summary(analyzed_game)
    out = []
    for c in challenges:
        c = dict(c)
        if not c.get("done"):
            c["progress"] = min(c["target"], _progress(c, s, analyzed_game))
            c["done"] = c["progress"] >= c["target"]
        out.append(c)
    return out


ACHIEVEMENTS = [
    ("first_game", "First game", "Finish your first game.", lambda p, s: s.get("games", p.get("games", 0)) >= 1),
    ("first_win", "First win", "Win a game.", lambda p, s: s.get("wins", p.get("wins", 0)) >= 1),
    ("games_10", "Ten games", "Finish 10 games.", lambda p, s: s.get("games", p.get("games", 0)) >= 10),
    ("games_50", "Fifty games", "Finish 50 games.", lambda p, s: s.get("games", p.get("games", 0)) >= 50),
    ("clean_game", "Clean sheet", "Finish a game with no blunders.", lambda p, s: s.get("clean_games", 0) >= 1),
    ("sharp_90", "Sharp", "Reach 90% accuracy in a game.", lambda p, s: s.get("best_accuracy", 0) >= 90),
    ("puzzles_10", "Puzzle starter", "Solve 10 puzzles.", lambda p, s: s.get("puzzles_solved", 0) >= 10),
    ("puzzles_100", "Puzzle grinder", "Solve 100 puzzles.", lambda p, s: s.get("puzzles_solved", 0) >= 100),
    ("streak_3", "On a roll", "Train 3 days in a row.", lambda p, s: s.get("streak", 0) >= 3),
    ("streak_7", "Week streak", "Train 7 days in a row.", lambda p, s: s.get("streak", 0) >= 7),
    ("streak_30", "Month streak", "Train 30 days in a row.", lambda p, s: s.get("streak", 0) >= 30),
    ("lessons_5", "Student", "Complete 5 lessons.", lambda p, s: s.get("lessons_done", 0) >= 5),
    ("challenges_10", "Challenger", "Complete 10 challenges.", lambda p, s: s.get("challenges_done", 0) >= 10),
] + [(f"rating_{r}", f"Rated {r}", f"Reach a rating of {r}.", (lambda r: lambda p, s: p.get("rating", 0) >= r)(r))
     for r in (800, 1000, 1200, 1500, 1800, 2000)]


def check_achievements(profile: dict, stats: dict, achievements: list) -> list[dict]:
    have = {a["id"] if isinstance(a, dict) else a for a in achievements or []}
    return [{"id": i, "title": t, "description": d} for i, t, d, ok in ACHIEVEMENTS if i not in have and ok(profile, stats or {})]
