"""Whole-app data export/import with schema validation."""
from __future__ import annotations

VERSION = 1
SCHEMA = {
    "profile": (dict, type(None)), "games": list, "analysis": list, "weakness": (dict, type(None)),
    "puzzleProgress": list, "lessonProgress": (list, dict), "challenges": list, "achievements": list,
    "settings": dict, "personas": list, "cubicle": list,
}


def _validate(data) -> dict:
    if not isinstance(data, dict):
        raise ValueError("data must be an object")
    for k, v in data.items():
        if k not in SCHEMA:
            raise ValueError(f"unknown store: {k}")
        if not isinstance(v, SCHEMA[k]):
            raise ValueError(f"bad type for {k}")
    return data


def export_all(data: dict) -> dict:
    return {"app": "bobby", "version": VERSION, "data": _validate(data)}


def import_all(blob: dict) -> dict:
    if not isinstance(blob, dict) or "data" not in blob:
        raise ValueError("not a Bobby export")
    v = blob.get("version")
    if not isinstance(v, int) or isinstance(v, bool) or not 1 <= v <= VERSION:
        raise ValueError(f"unsupported version: {v!r}")
    if blob.get("app", "bobby") != "bobby":
        raise ValueError("not a Bobby export")
    return _validate(blob["data"])
