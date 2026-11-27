// Types mirroring docs/CONTRACT.md. Python is the source of truth; keep these in sync.
export type Color = "w" | "b";
export type Result = "1-0" | "0-1" | "1/2-1/2" | "*";
export type Level = "never" | "moves" | "basic" | "casual" | "club";
export type MoveClass = "best" | "good" | "inaccuracy" | "mistake" | "blunder";

/** White-perspective evaluation, as passed to Python. */
export interface Eval { cp: number | null; mate: number | null }

export interface GameState {
  fen: string; turn: Color; legal_moves: string[]; san: string | null; check: boolean; over: boolean; result: Result; reason: string | null;
}
export interface PgnMove { uci: string; san: string; fen_before: string; fen_after: string }
export interface ParsedPgn { headers: Record<string, string>; moves: PgnMove[]; result: Result }

export interface ClassifyInputMove {
  ply: number; uci: string; san: string; fen_before: string;
  eval_before: Eval; eval_after: Eval; best_uci: string | null; best_eval: Eval;
}
export interface ClassifiedMove { ply: number; class: MoveClass; winprob_loss: number; is_player: boolean; [k: string]: unknown }
export interface Classification {
  moves: ClassifiedMove[]; accuracy: { w: number; b: number }; acpl: { w: number; b: number }; key_moments: number[];
}

export interface Profile { rating: number; rd: number; level: Level; [k: string]: unknown }
export interface GameResultInput { score: 1 | 0.5 | 0; opp_rating: number; opp_rd: number; date: string }
/** Weakness state is opaque to TS: whatever Python returns is stored and handed back unchanged. */
export type WeaknessState = unknown;

export interface Puzzle { id: string; fen: string; solution: string[]; themes: string[]; source?: string; rating: number; [k: string]: unknown }
export interface Card { id?: string; item_id?: string; due: string; interval: number; ease: number; [k: string]: unknown }
export interface PlanItem { kind: string; ref: string; title: string; minutes: number }
export interface Challenge { id: string; title: string; description: string; kind: string; target: number; progress: number; reward: unknown; [k: string]: unknown }
export interface Achievement { id: string; [k: string]: unknown }
export interface LessonCheck { correct: boolean; feedback: string; next_index: number | null }
export interface BenchmarkRow { metric: string; label?: string; you: number; typical: number; note: string }
export interface StatsSummary {
  rating_curve: { date: string; rating: number; rd: number | null; game_id: string }[];
  accuracy_trend: { game_id: string; date: string; accuracy: number; acpl: number }[];
  blunders_per_game: { game_id: string; date: string; blunders: number; mistakes: number; inaccuracies: number }[];
  phase_breakdown: Record<"opening" | "middle" | "end", { moves: number; errors: number; acpl: number; error_rate: number }>;
  opening_results: { eco: string; name: string | null; n: number; w: number; d: number; l: number; score: number }[];
  weakness_heatmap: Record<string, { opening: number; middle: number; end: number; total: number }>;
}
export type CoachMode = "review" | "progress";

/** Board drawing that comes with a coach answer (py/bobby/explain.py). */
export interface Viz {
  arrows: [string, string, "best" | "threat" | "played"][];
  squares: Record<string, "danger" | "warn" | "good">;
  line: { fen: string; moves: string[] } | null;
}

/** Today's level (py/bobby/progression.py): a daily stretch on top of the rating, plus challenge targets. */
export interface Progression {
  version: number; date: string; offset: number; step: number; tier: number; accuracy_target: number; blunder_cap: number;
  base_rating: number; reasons: string[]; form: Record<string, unknown>;
}

/** The game record TS builds after engine analysis and hands to Python functions taking `analyzed_game`. */
/** Matches the Python `analyzed_game` doc in py/bobby/analysis.py: {player_color, moves, classification?, headers?, date?, result?, player_rating?}. */
export interface AnalyzedGame {
  id: string; game_id: string; pgn: string; result: Result; player_color: Color; date: string; bot_rating: number | null; mode: "bot" | "local";
  player_rating: number | null; headers: Record<string, string>; opening?: { eco: string; name: string } | null;
  moves: (ClassifyInputMove & { best_pv?: string[]; class?: MoveClass; winprob_loss?: number; is_player?: boolean })[];
  classification: Classification;
  accuracy: { w: number; b: number }; acpl: { w: number; b: number }; key_moments: number[];
}
