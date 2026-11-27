// After each game: Stockfish analysis -> Python classify_moves -> rating, weakness, challenges, puzzles -> save.
import { Chess } from "chess.js";
import { analysisEngine, toWhite } from "../bridge/engine";
import { py } from "../bridge/py";
import { db, store, type GameRow } from "../bridge/storage";
import type { AnalyzedGame, ClassifyInputMove, Eval } from "../bridge/types";
import { today } from "./chess";
import { openingOfPgn } from "./openings";
import { markActivity, refreshAchievements } from "./progress";

export interface PipelineProgress { stage: "analysing" | "classifying" | "updating" | "done"; done: number; total: number }

interface PosEval { ev: Eval; best: string | null; pv: string[] }
async function evalPosition(fen: string, depth: number): Promise<PosEval> {
  const c = new Chess(fen);
  // Terminal positions: mated side to move -> the other side "mates" (white-view sign), draws -> 0.
  if (c.isCheckmate()) return { ev: { cp: null, mate: c.turn() === "b" ? 1 : -1 }, best: null, pv: [] };
  if (c.isDraw() || c.isStalemate()) return { ev: { cp: 0, mate: null }, best: null, pv: [] };
  const r = await analysisEngine().analyse(fen, { depth, multipv: 1, movetimeMs: 1500 });
  const l = r.lines[0];
  if (!l) return { ev: { cp: 0, mate: null }, best: null, pv: [] };
  return { ev: toWhite(l, fen), best: l.pv[0] ?? null, pv: l.pv.slice(0, 8) };
}

/** Engine-evaluate every position of a game and build the classify_moves input. */
export async function engineMoves(g: Pick<GameRow, "pgn" | "startFen">, depth = 12, onProgress?: (d: number, t: number) => void): Promise<(ClassifyInputMove & { best_pv: string[] })[]> {
  const c = new Chess();
  c.loadPgn(g.pgn);
  const hist = c.history({ verbose: true });
  const fens = hist.length ? [hist[0].before, ...hist.map((m) => m.after)] : [g.startFen];
  const evals: PosEval[] = [];
  for (let i = 0; i < fens.length; i++) { evals.push(await evalPosition(fens[i], depth)); onProgress?.(i + 1, fens.length); }
  return hist.map((m, i) => ({
    ply: i + 1, uci: m.from + m.to + (m.promotion ?? ""), san: m.san, fen_before: m.before,
    eval_before: evals[i].ev, eval_after: evals[i + 1].ev, best_uci: evals[i].best, best_eval: evals[i].ev, best_pv: evals[i].pv,
  }));
}

const soft = async <T>(label: string, f: () => Promise<T>): Promise<T | undefined> => {
  try { return await f(); } catch (e) { console.warn(`[pipeline] ${label} skipped:`, (e as Error).message); return undefined; }
};

export async function runPipeline(game: GameRow, onProgress?: (p: PipelineProgress) => void): Promise<AnalyzedGame> {
  const input = await engineMoves(game, 12, (d, t) => onProgress?.({ stage: "analysing", done: d, total: t }));
  onProgress?.({ stage: "classifying", done: 0, total: 1 });
  const cls = await py.classify_moves(input, game.playerColor);
  const byPly = new Map(cls.moves.map((m) => [m.ply, m]));
  let profile = await store.getProfile();
  const pc = new Chess(); pc.loadPgn(game.pgn);
  const op = await soft("opening", () => openingOfPgn(game.pgn));
  const opening = op ? { eco: op.eco, name: op.name } : null;
  const analyzed: AnalyzedGame = {
    id: game.id, game_id: game.id, pgn: game.pgn, result: game.result, player_color: game.playerColor, date: game.date,
    bot_rating: game.botRating, mode: game.mode, player_rating: profile ? Math.round(profile.rating) : null,
    headers: { ...(pc.getHeaders() as Record<string, string>), ...(opening ? { ECO: opening.eco, Opening: opening.name } : {}) },
    opening,
    moves: input.map((m) => ({ ...m, class: byPly.get(m.ply)?.class, winprob_loss: byPly.get(m.ply)?.winprob_loss, is_player: byPly.get(m.ply)?.is_player })),
    classification: cls, accuracy: cls.accuracy, acpl: cls.acpl, key_moments: cls.key_moments,
  };
  await store.saveAnalysis({ gameId: game.id, game: analyzed, classification: cls });
  let row: GameRow = { ...game, analysed: true, opening };

  onProgress?.({ stage: "updating", done: 0, total: 1 });
  const d = today();
  // Rating, puzzles and challenges only learn from games against Bobby (two-player/imported games are review-only).
  if (game.mode === "bot" && game.result !== "*") {
    if (profile) {
      const s = game.result === "1/2-1/2" ? 0.5 : (game.result === "1-0") === (game.playerColor === "w") ? 1 : 0;
      const p2 = await soft("update_rating", () => py.update_rating(profile!, { score: s as 0 | 0.5 | 1, opp_rating: game.botRating ?? 1200, opp_rd: 60, date: d }));
      if (p2) { profile = p2; await store.setProfile(p2); row = { ...row, ratingAfter: p2.rating, rdAfter: p2.rd }; }
    }
    const w = await soft("update_weakness", async () => py.update_weakness(await store.getWeakness(), analyzed));
    if (w !== undefined) await store.setWeakness(w);
    const ch = await soft("update_challenges", async () => py.update_challenges((await db.challenges.toArray()).filter((c) => !c.done && String(c.date ?? c.id).startsWith(d)), analyzed));
    if (ch) await db.challenges.bulkPut(ch);
    const puzzles = await soft("puzzles_from_mistakes", () => py.puzzles_from_mistakes(analyzed));
    for (const pz of puzzles ?? []) {
      const card = await soft("srs_new_card", () => py.srs_new_card(pz.id, d));
      await db.puzzleProgress.put({ due: d, interval: 0, ease: 2.5, ...(card ?? {}), id: pz.id, puzzle: pz });
    }
  }
  await store.saveGame(row);
  if (game.mode === "bot" && game.result !== "*") await soft("activity", () => markActivity());
  else if (profile) await soft("achievements", () => refreshAchievements(profile));
  onProgress?.({ stage: "done", done: 1, total: 1 });
  return analyzed;
}

/** Game row in the shape py/bobby/stats.py reads. */
export const statsGame = (g: GameRow) => ({
  id: g.id, date: g.date, result: g.result, player_color: g.playerColor, mode: g.mode, bot_rating: g.botRating,
  rating_after: g.ratingAfter ?? null, rd_after: g.rdAfter ?? null, pgn: g.pgn, opening: g.opening ?? null,
});
