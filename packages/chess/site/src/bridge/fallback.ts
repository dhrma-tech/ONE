// DEV FALLBACK: minimal TS versions of a few contract functions, used only when the Python core
// (py/bobby/api.py) is not loadable yet or lacks a function. Python is the source of truth; these exist so the
// UI can be developed and smoke-tested in parallel. Every use logs a warning once.
import { Chess } from "chess.js";
import type { AnalyzedGame, Classification, ClassifyInputMove, Color, Eval, GameResultInput, Level, MoveClass, ParsedPgn, Profile, Puzzle, Result } from "./types";

const LEVEL_RATING: Record<Level, number> = { never: 400, moves: 700, basic: 1000, casual: 1100, club: 1400 };

export function winprob(cp: number | null, mate: number | null): number {
  if (mate !== null && mate !== undefined) return mate > 0 ? 1 : mate < 0 ? 0 : 0.5;
  const c = Math.max(-1500, Math.min(1500, cp ?? 0));
  return 1 / (1 + Math.exp(-0.00368208 * c));
}
const wp = (e: Eval) => winprob(e.cp, e.mate);
const cpOf = (e: Eval) => (e.mate !== null && e.mate !== undefined ? (e.mate > 0 ? 1000 : -1000) : Math.max(-1000, Math.min(1000, e.cp ?? 0)));

function classify_moves(moves: ClassifyInputMove[], player_color: Color | null): Classification {
  const accs: Record<Color, number[]> = { w: [], b: [] };
  const cpl: Record<Color, number[]> = { w: [], b: [] };
  const out = moves.map((m) => {
    const side: Color = m.fen_before.split(" ")[1] === "b" ? "b" : "w";
    const sign = side === "w" ? 1 : -1;
    const before = side === "w" ? wp(m.best_eval) : 1 - wp(m.best_eval);
    const after = side === "w" ? wp(m.eval_after) : 1 - wp(m.eval_after);
    const loss = Math.max(0, before - after);
    let cls: MoveClass = "blunder";
    if (m.uci === m.best_uci || loss < 0.02) cls = "best";
    else if (loss < 0.05) cls = "good";
    else if (loss < 0.1) cls = "inaccuracy";
    else if (loss < 0.2) cls = "mistake";
    accs[side].push(Math.max(0, Math.min(100, 103.1668 * Math.exp(-0.04354 * loss * 100) - 3.1669)));
    cpl[side].push(Math.max(0, sign * (cpOf(m.best_eval) - cpOf(m.eval_after))));
    return { ply: m.ply, class: cls, winprob_loss: +loss.toFixed(4), is_player: player_color ? side === player_color : true };
  });
  const avg = (a: number[]) => (a.length ? +(a.reduce((x, y) => x + y, 0) / a.length).toFixed(1) : 0);
  const key = out.filter((m) => m.class === "blunder" || m.class === "mistake").sort((a, b) => b.winprob_loss - a.winprob_loss).slice(0, 5).map((m) => m.ply).sort((a, b) => a - b);
  return { moves: out, accuracy: { w: avg(accs.w), b: avg(accs.b) }, acpl: { w: avg(cpl.w), b: avg(cpl.b) }, key_moments: key };
}

function new_profile(level: Level, known_rating: number | null, today: string): Profile {
  return { rating: known_rating ?? LEVEL_RATING[level] ?? 700, rd: 350, vol: 0.06, level, games: 0, created: today, history: [] };
}

function update_rating(profile: Profile, g: GameResultInput): Profile {
  // Simplified Elo with RD-scaled K; the Python core implements real Glicko-2.
  const k = 16 + (Math.min(350, profile.rd) / 350) * 64;
  const exp = 1 / (1 + 10 ** ((g.opp_rating - profile.rating) / 400));
  const rating = Math.round(profile.rating + k * (g.score - exp));
  const rd = Math.max(60, Math.round(profile.rd * 0.9));
  const history = [...((profile.history as unknown[]) ?? []), { date: g.date, rating }];
  return { ...profile, rating, rd, games: ((profile.games as number) ?? 0) + 1, history };
}

const bot_target_rating = (p: Profile, offset: number) => Math.round(Math.max(250, Math.min(3000, p.rating + offset)));

function parse_pgn(pgn: string): ParsedPgn {
  const c = new Chess();
  c.loadPgn(pgn);
  const headers = c.getHeaders() as Record<string, string>;
  const hist = c.history({ verbose: true });
  return {
    headers,
    moves: hist.map((m) => ({ uci: m.from + m.to + (m.promotion ?? ""), san: m.san, fen_before: m.before, fen_after: m.after })),
    result: ((headers.Result as Result) || "*"),
  };
}

function puzzles_from_mistakes(g: AnalyzedGame): Puzzle[] {
  return g.moves.filter((m) => m.is_player && (m.class === "blunder" || m.class === "mistake") && m.best_uci)
    .map((m) => ({ id: `${g.id}-${m.ply}`, fen: m.fen_before, solution: [m.best_uci as string], themes: [], source: "mistake", rating: 1000 }));
}


export const fallback: Record<string, (...a: never[]) => unknown> = {
  winprob,
  classify_moves,
  new_profile,
  update_rating,
  bot_target_rating,
  parse_pgn,
  puzzles_from_mistakes,
  update_weakness: (w: unknown) => w ?? {},
  generate_challenges: () => [],
  update_challenges: (c: unknown) => c ?? [],
  check_achievements: () => [],
  template_explanation: (facts: { class?: string; move?: string }) => `${facts.move ?? "This move"} was classified as ${facts.class ?? "unknown"}.`,
  export_all: (data: unknown) => ({ version: 1, data }),
  import_all: (blob: { version?: number; data?: unknown }) => {
    if (!blob || typeof blob !== "object" || blob.version !== 1 || typeof blob.data !== "object") throw new Error("ValueError: not a Bobby export");
    return blob.data;
  },
};
