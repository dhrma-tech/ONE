// Fast client-side chess helpers (chess.js, BSD-2) for instant board interaction.
// Python (python-chess) stays the authority for analysis, classification and PGN processing.
import { Chess, type Move, type Square } from "chess.js";
import type { Result } from "../bridge/types";

export const START_FEN = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";
export const uciOf = (m: Pick<Move, "from" | "to" | "promotion">) => m.from + m.to + (m.promotion ?? "");

/** Replay a game from a start FEN and a list of UCI moves. */
export function replay(startFen: string, ucis: string[]): Chess {
  const c = new Chess(startFen);
  for (const u of ucis) c.move({ from: u.slice(0, 2), to: u.slice(2, 4), promotion: u[4] });
  return c;
}

export function tryMove(c: Chess, from: string, to: string, promotion?: string): Move | null {
  try { return c.move({ from, to, promotion: promotion ?? "q" }); } catch { return null; }
}

export function needsPromotion(c: Chess, from: string, to: string) {
  return c.moves({ square: from as Square, verbose: true }).some((m) => m.to === to && m.promotion);
}

export function outcome(c: Chess): { result: Result; reason: string } | null {
  if (c.isCheckmate()) return { result: c.turn() === "w" ? "0-1" : "1-0", reason: "checkmate" };
  if (c.isStalemate()) return { result: "1/2-1/2", reason: "stalemate" };
  if (c.isInsufficientMaterial()) return { result: "1/2-1/2", reason: "insufficient material" };
  if (c.isThreefoldRepetition()) return { result: "1/2-1/2", reason: "threefold repetition" };
  if (c.isDraw()) return { result: "1/2-1/2", reason: "fifty-move rule" };
  return null;
}

export function kingSquare(c: Chess, color: "w" | "b"): string | null {
  for (const row of c.board()) for (const p of row) if (p && p.type === "k" && p.color === color) return p.square;
  return null;
}

export const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
export const today = () => new Date().toISOString().slice(0, 10);
