"""Public JSON API (see docs/CONTRACT.md). Every function: JSON-serialisable in and out."""
from __future__ import annotations

from .challenges import check_achievements, generate_challenges, update_challenges
from .classify import classify_moves
from .coach.templates import template_explanation
from .difficulty import position_difficulty
from .explain import explain_move, explain_position
from .export import export_all, import_all
from .lessons import lesson_check
from .plan import daily_plan
from .progression import daily_progression, progress_report
from .profile import benchmarks_compare, bot_target_rating, new_profile, update_rating
from .puzzles import puzzles_from_mistakes, select_puzzles
from .rules import apply_move, legal_moves, new_game, parse_pgn, to_pgn
from .srs import due_cards, srs_new_card, srs_review
from .stats import stats_summary
from .weakness import update_weakness
from .winprob import winprob

__all__ = [
    "new_game", "apply_move", "legal_moves", "parse_pgn", "to_pgn",
    "classify_moves", "winprob",
    "new_profile", "update_rating", "bot_target_rating", "update_weakness", "benchmarks_compare",
    "puzzles_from_mistakes", "select_puzzles", "srs_new_card", "srs_review", "due_cards", "daily_plan",
    "generate_challenges", "update_challenges", "check_achievements", "lesson_check",
    "stats_summary", "export_all", "import_all",
    "explain_move", "explain_position", "template_explanation",
    "position_difficulty",  # extra, not in contract
    "daily_progression", "progress_report",
]
