"""Aggregate stats across games and analyses.

games: [{id, date, result:'1-0'|'0-1'|'1/2-1/2', player_color, rating_after?, rd_after?, opening?:{eco,name}, headers?}]
analyses: [{game_id, moves:[...], classification?}]  (analyzed_game shape; player_color/opening fall back to the game)
"""
from __future__ import annotations

from .analysis import opening_eco, summary
from .common import norm_color

PHASES = ("opening", "middle", "end")


def _score(result: str, color: str) -> float | None:
    return {"1-0": 1.0, "0-1": 0.0, "1/2-1/2": 0.5}.get(result) if color == "w" else \
        {"1-0": 0.0, "0-1": 1.0, "1/2-1/2": 0.5}.get(result)


def stats_summary(games: list[dict], analyses: list[dict]) -> dict:
    by_id = {g.get("id"): g for g in games or []}
    ordered = sorted(games or [], key=lambda g: (str(g.get("date") or ""), str(g.get("id"))))
    curve = [{"date": g.get("date"), "rating": g["rating_after"], "rd": g.get("rd_after"), "game_id": g.get("id")}
             for g in ordered if g.get("rating_after") is not None]

    openings: dict[str, dict] = {}
    for g in ordered:
        eco = opening_eco(g)
        s = _score(g.get("result", "*"), norm_color(g.get("player_color", "w")))
        if not eco or s is None:
            continue
        o = openings.setdefault(eco, {"eco": eco, "name": (g.get("opening") or {}).get("name"), "n": 0, "w": 0, "d": 0, "l": 0})
        o["n"] += 1
        o[{1.0: "w", 0.5: "d", 0.0: "l"}[s]] += 1
    for o in openings.values():
        o["score"] = round((o["w"] + 0.5 * o["d"]) / o["n"], 3)

    acc_trend, blunders, heat = [], [], {}
    phase = {p: {"moves": 0, "cp_loss": 0.0, "errors": 0} for p in PHASES}
    for a in analyses or []:
        g = by_id.get(a.get("game_id"), {})
        game = {"player_color": g.get("player_color", "w"), "opening": g.get("opening"), "headers": g.get("headers"), **a}
        s = summary(game)
        date = g.get("date") or a.get("date")
        acc_trend.append({"game_id": a.get("game_id"), "date": date, "accuracy": s["accuracy"], "acpl": s["acpl"]})
        blunders.append({"game_id": a.get("game_id"), "date": date, "blunders": s["blunders"],
                         "mistakes": s["mistakes"], "inaccuracies": s["inaccuracies"]})
        for r in s["rows"]:
            if not r["is_player"] or r["phase"] not in phase:
                continue
            ph = phase[r["phase"]]
            ph["moves"] += 1
            ph["cp_loss"] += r["cp_loss"] or 0.0
            ph["errors"] += r["class"] in ("mistake", "blunder")
            for t in r["tags"]:
                if t.startswith("phase_"):
                    continue
                h = heat.setdefault(t, {"opening": 0, "middle": 0, "end": 0, "total": 0})
                h[r["phase"]] += 1
                h["total"] += 1
    acc_trend.sort(key=lambda x: str(x["date"] or ""))
    blunders.sort(key=lambda x: str(x["date"] or ""))
    breakdown = {p: {"moves": v["moves"], "errors": v["errors"],
                     "acpl": round(v["cp_loss"] / v["moves"], 2) if v["moves"] else 0.0,
                     "error_rate": round(v["errors"] / v["moves"], 3) if v["moves"] else 0.0} for p, v in phase.items()}
    return {"rating_curve": curve, "accuracy_trend": acc_trend, "blunders_per_game": blunders,
            "phase_breakdown": breakdown, "opening_results": sorted(openings.values(), key=lambda o: (-o["n"], o["eco"])),
            "weakness_heatmap": heat}
