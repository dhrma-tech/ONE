// Coach layer: rule-based, no AI. Engine facts (Stockfish) + tactic detectors (Python bobby/explain.py) produce
// short plain-language answers plus board drawings (arrows, highlighted squares, a line to play through).
import { Chess } from "chess.js";
import { analysisEngine, toWhite } from "../bridge/engine";
import { py } from "../bridge/py";
import { store } from "../bridge/storage";
import type { AnalyzedGame, MoveClass, Viz } from "../bridge/types";
import { data, lessonForTag, TAG_THEME } from "./data";
import { tryMove } from "./chess";
import { speak } from "./tts";

export interface CoachAnswer { text: string; viz?: Viz | null; tags?: string[]; error?: string }

/** The five questions the coach answers about any position (see QUESTIONS in py/bobby/explain.py). */
export const QUESTIONS = [
  { id: "threats", label: "What are they threatening?" },
  { id: "danger", label: "Which of my pieces are in danger?" },
  { id: "best", label: "What's the best move and why?" },
  { id: "better", label: "Who's better and why?" },
  { id: "plan", label: "What should my plan be?" },
] as const;
export type QuestionId = (typeof QUESTIONS)[number]["id"];

// ---------- helpers ----------
const sanLine = (fen: string, pv: string[], n = 6) => {
  const c = new Chess(fen); const out: string[] = [];
  for (const u of pv.slice(0, n)) { const m = tryMove(c, u.slice(0, 2), u.slice(2, 4), u[4]); if (!m) break; out.push(m.san); }
  return out;
};

async function topTags(n = 3): Promise<string[]> {
  const w = (await store.getWeakness()) as { tags?: Record<string, { score?: number }> } | null;
  return Object.entries(w?.tags ?? {}).filter(([t]) => !t.startsWith("phase_")).sort((a, b) => (b[1].score ?? 0) - (a[1].score ?? 0)).slice(0, n).map(([t]) => t);
}

async function cardsFor(tags: string[], n = 2) {
  if (!tags.length) return [];
  const cards = await data.cards().catch(() => []);
  return cards.filter((c) => c.tags.some((t) => tags.includes(t))).slice(0, n).map((c) => ({ title: c.title, text: c.text }));
}

/** "Practise this" links for the tags an answer is about: a lesson and/or themed puzzles. */
export function practiceLinks(tags: string[] = []): { label: string; href: string }[] {
  const out: { label: string; href: string }[] = [];
  for (const t of tags) {
    const lesson = lessonForTag(t);
    if (lesson && !out.some((o) => o.href.includes(lesson))) out.push({ label: "Lesson", href: `/learn?l=${lesson}` });
    const theme = TAG_THEME[t];
    if (theme && !out.some((o) => o.href.includes(theme))) out.push({ label: "Practise puzzles", href: `/train?tab=puzzles&set=themed&theme=${theme}` });
    if (out.length >= 2) break;
  }
  return out;
}

const say = (a: CoachAnswer) => { if (a.text) speak(a.text); return a; };

// ---------- answers ----------
/** Answer one of the five questions about a position. "You" is the side to move. */
export async function askPosition(fen: string, question: QuestionId): Promise<CoachAnswer> {
  const needsEngine = question === "best" || question === "better" || question === "plan";
  let lines: { pv: string[]; cp: number | null; mate: number | null }[] = [];
  if (needsEngine) {
    const r = await analysisEngine().analyse(fen, { depth: 14, multipv: 1, movetimeMs: 1500, channel: "coach" });
    lines = r.lines.map((l) => ({ pv: l.pv, ...toWhite(l, fen) }));
  }
  return say(await py.explain_position(fen, question, lines));
}

/** Explain move `ply` (1-based) of an analysed game, using the engine's reply from the next position. */
export async function explainMove(game: AnalyzedGame, ply: number, cls: MoveClass | undefined): Promise<CoachAnswer> {
  const m = game.moves[ply - 1];
  if (!m) throw new Error("No move to explain.");
  const reply = game.moves[ply]?.best_pv ?? (game.moves[ply]?.best_uci ? [game.moves[ply].best_uci as string] : []);
  return say(await py.explain_move({ ...m, class: cls ?? m.class ?? null }, reply));
}

/** Plain-language summaries (Python templates): "review" = one game, "progress" = recent games. */
export async function summarize(facts: Record<string, unknown>, mode: "review" | "progress"): Promise<CoachAnswer> {
  const tags = (facts.weakness_tags as string[] | undefined) ?? [];
  return say({ text: await py.template_explanation(facts, mode), tags });
}

// ---------- facts for summaries ----------
/** Facts for "How am I improving?": recent form, weak spots and today's level (Python progress_report). */
export async function progressFacts(): Promise<Record<string, unknown>> {
  const { recentAnalysed, todaysProgression } = await import("./progress");
  const [games, w, prog] = await Promise.all([recentAnalysed(), store.getWeakness(), todaysProgression().catch(() => null)]);
  const facts = await py.progress_report(games, w, prog);
  const tags = (facts.weakness_tags as string[] | undefined) ?? [];
  return { ...facts, knowledge_cards: await cardsFor(tags, 1) };
}

/** Rough phase of a position: endgame once few pieces remain, opening for the first 10 moves. */
function phaseOf(fen: string, ply: number): "opening" | "middlegame" | "endgame" {
  const board = fen.split(" ")[0];
  const pieces = (board.match(/[nbrqNBRQ]/g) ?? []).length;
  if (pieces <= 6) return "endgame";
  return ply <= 20 ? "opening" : "middlegame";
}

/** Facts for the "Summarize my game" answer: the player's side only, from the saved engine analysis. */
export async function gameSummaryFacts(gameId: string): Promise<Record<string, unknown> | null> {
  const [row, an] = await Promise.all([store.getGame(gameId), store.getAnalysis(gameId)]);
  if (!row || !an) return null;
  const me = row.playerColor;
  const g = an.game;
  const mine = g.moves.filter((m) => m.fen_before.split(" ")[1] === me);
  const count = (c: MoveClass) => mine.filter((m) => m.class === c).length;
  const errs = { opening: 0, middlegame: 0, endgame: 0 };
  for (const m of mine) if (m.class === "mistake" || m.class === "blunder") errs[phaseOf(m.fen_before, m.ply)]++;
  const weakest = (Object.entries(errs) as [keyof typeof errs, number][]).sort((a, b) => b[1] - a[1])[0];
  const worst = [...mine].filter((m) => m.class === "blunder" || m.class === "mistake")
    .sort((a, b) => (b.winprob_loss ?? 0) - (a.winprob_loss ?? 0)).slice(0, 2)
    .map((m) => ({
      move: m.san, move_number: Math.ceil(m.ply / 2), class: m.class, phase: phaseOf(m.fen_before, m.ply),
      best: m.best_uci && m.best_uci !== m.uci ? sanLine(m.fen_before, [m.best_uci], 1)[0] ?? null : null,
    }));
  const result = row.result === "1/2-1/2" ? "draw" : row.result === "*" ? "unfinished" : (row.result === "1-0") === (me === "w") ? "win" : "loss";
  const tags = await topTags();
  return {
    summary_for: me === "w" ? "White (the student)" : "Black (the student)",
    opponent: row.mode === "bot" ? `Bobby (about ${row.botRating ?? "?"})` : "another player",
    result, ended_by: row.termination ?? null, opening: row.opening?.name ?? null, moves_played: mine.length,
    accuracy: Math.round(an.classification.accuracy[me] * 10) / 10,
    opponent_accuracy: Math.round(an.classification.accuracy[me === "w" ? "b" : "w"] * 10) / 10,
    best_moves: count("best"), blunders: count("blunder"), mistakes: count("mistake"), inaccuracies: count("inaccuracy"),
    errors_by_phase: errs, weakest_phase: weakest && weakest[1] > 0 ? weakest[0] : null,
    key_moments: worst, weakness_tags: tags, knowledge_cards: await cardsFor(tags, 1),
  };
}
