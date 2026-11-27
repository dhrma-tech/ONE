// Game-in-progress model: serialisable so it can be autosaved and resumed.
import type { Chess } from "chess.js";
import type { Color, Result } from "../bridge/types";
import { replay, START_FEN, uid } from "./chess";

export interface TimeControl { id: string; label: string; baseMs: number; incMs: number }
export const TIME_CONTROLS: TimeControl[] = [
  { id: "none", label: "Untimed", baseMs: 0, incMs: 0 },
  { id: "5+0", label: "5+0", baseMs: 5 * 60e3, incMs: 0 },
  { id: "10+0", label: "10+0", baseMs: 10 * 60e3, incMs: 0 },
  { id: "15+10", label: "15+10", baseMs: 15 * 60e3, incMs: 10e3 },
];

export interface LiveGame {
  id: string; startFen: string; moves: string[]; mode: "bot" | "local"; playerColor: Color;
  botElo: number | null; adaptive: boolean; tc: TimeControl; clock: { w: number; b: number };
  result: Result; reason: string | null; createdAt: string; hintsUsed: number; takebacksUsed: number;
}

export function newLiveGame(o: Partial<LiveGame> & Pick<LiveGame, "mode">): LiveGame {
  const tc = o.tc ?? TIME_CONTROLS[0];
  return {
    id: uid(), startFen: o.startFen ?? START_FEN, moves: o.moves ?? [], mode: o.mode, playerColor: o.playerColor ?? "w",
    botElo: o.botElo ?? null, adaptive: o.adaptive ?? true, tc, clock: { w: tc.baseMs, b: tc.baseMs },
    result: "*", reason: null, createdAt: new Date().toISOString(), hintsUsed: 0, takebacksUsed: 0,
  };
}

export function pgnOf(g: LiveGame, c?: Chess): string {
  const ch = c ?? replay(g.startFen, g.moves);
  const white = g.mode === "bot" ? (g.playerColor === "w" ? "You" : `Bobby (${g.botElo ?? "?"})`) : "White";
  const black = g.mode === "bot" ? (g.playerColor === "b" ? "You" : `Bobby (${g.botElo ?? "?"})`) : "Black";
  ch.setHeader("Event", g.mode === "bot" ? "Bobby game" : "Local game");
  ch.setHeader("Site", "Bobby");
  ch.setHeader("Date", g.createdAt.slice(0, 10).replace(/-/g, "."));
  ch.setHeader("White", white);
  ch.setHeader("Black", black);
  ch.setHeader("Result", g.result);
  if (g.tc.baseMs) ch.setHeader("TimeControl", `${g.tc.baseMs / 1000}+${g.tc.incMs / 1000}`);
  if (g.reason) ch.setHeader("Termination", g.reason);
  return ch.pgn();
}

export const fmtClock = (ms: number) => {
  const s = Math.max(0, Math.ceil(ms / 1000));
  return ms < 10e3 ? (Math.max(0, ms) / 1000).toFixed(1) : `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
};
