"""Player profile: seeding, Glicko-2 updates, bot target, benchmarks."""
from __future__ import annotations

from . import glicko
from .common import clamp, days_between

LEVEL_SEEDS = {"never": 400, "moves": 600, "basic": 800, "casual": 1000, "club": 1400}
SEED_RD = 350.0           # high uncertainty -> fast calibration
KNOWN_RD = 150.0
SEED_VOL = 0.06
IDLE_PERIOD_DAYS = 7      # one Glicko period of RD inflation per idle week
RATING_FLOOR = 100
BOT_MIN, BOT_MAX = 400, 2600
BANDS = ["600-800", "800-1000", "1000-1200", "1200-1400", "1400-1600", "1600-1800", "1800-2000", "2000+"]


def new_profile(level: str = "moves", known_rating: int | None = None, today: str | None = None) -> dict:
    if level not in LEVEL_SEEDS:
        raise ValueError(f"unknown level: {level!r}")
    rating = float(known_rating) if known_rating is not None else float(LEVEL_SEEDS[level])
    rd = KNOWN_RD if known_rating is not None else SEED_RD
    return {
        "version": 1, "level": level, "rating": rating, "rd": rd, "vol": SEED_VOL,
        "games": 0, "wins": 0, "draws": 0, "losses": 0,
        "created": today, "last_game": None,
        "history": [{"date": today, "rating": round(rating), "rd": round(rd)}],
        "goals": [],
    }


def update_rating(profile: dict, game_result: dict) -> dict:
    p = {**profile, "history": list(profile.get("history") or [])}
    score = float(game_result["score"])
    if score not in (0.0, 0.5, 1.0):
        raise ValueError("score must be 1, 0.5 or 0")
    date = game_result.get("date")
    rd = float(p["rd"])
    if date and p.get("last_game"):
        rd = glicko.inflate_rd(rd, p["vol"], days_between(p["last_game"], date) // IDLE_PERIOD_DAYS)
    r, rd, vol = glicko.update(float(p["rating"]), rd, float(p["vol"]),
                               [(float(game_result["opp_rating"]), float(game_result.get("opp_rd", 50)), score)])
    p.update(rating=max(RATING_FLOOR, round(r, 1)), rd=round(clamp(rd, glicko.RD_MIN, glicko.RD_MAX), 1), vol=vol)
    p["games"] = p.get("games", 0) + 1
    key = {1.0: "wins", 0.5: "draws", 0.0: "losses"}[score]
    p[key] = p.get(key, 0) + 1
    p["last_game"] = date or p.get("last_game")
    p["history"].append({"date": date, "rating": round(p["rating"]), "rd": round(p["rd"])})
    return p


def bot_target_rating(profile: dict, offset: int = 0) -> int:
    return int(clamp(round(float(profile["rating"]) + int(offset)), BOT_MIN, BOT_MAX))


def band(rating: float) -> str:
    if rating >= 2000:
        return "2000+"
    lo = max(600, int(rating // 200) * 200)
    return f"{lo}-{lo + 200}"


_METRICS = [("acpl.opening", "Avg centipawn loss (opening)"), ("acpl.middle", "Avg centipawn loss (middlegame)"),
            ("acpl.end", "Avg centipawn loss (endgame)"), ("blunder_rate", "Blunder rate"),
            ("mistake_rate", "Mistake rate"), ("inaccuracy_rate", "Inaccuracy rate")]


def _get(d: dict, path: str):
    for k in path.split("."):
        if not isinstance(d, dict) or k not in d:
            return None
        d = d[k]
    return d


def benchmarks_compare(profile: dict, game_stats: dict, benchmarks: dict) -> list[dict]:
    """Lower is better for every metric. Ratio within +-10% counts as typical."""
    bm = benchmarks.get(band(float(profile["rating"]))) or {}
    out = []
    for path, name in _METRICS:
        you, typ = _get(game_stats, path), _get(bm, path)
        if you is None or typ is None:
            continue
        ratio = you / typ if typ else (1.0 if you == 0 else 2.0)
        note = "about typical for your level" if 0.9 <= ratio <= 1.1 else (
            "better than typical for your level" if ratio < 0.9 else "worse than typical for your level")
        out.append({"metric": path, "label": name, "you": round(you, 3), "typical": round(typ, 3), "note": note})
    missed = set(game_stats.get("themes_missed") or []) & set(bm.get("common_themes_missed") or [])
    for t in sorted(missed):
        out.append({"metric": f"theme.{t}", "label": f"Missed {t}", "you": 1, "typical": 1,
                    "note": "a common miss at your level too"})
    return out
