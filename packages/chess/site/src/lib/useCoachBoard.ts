// Lets coach answers draw on the page's board: arrows, tinted squares, and "Show me" (play a line move by move).
// Drawings clear automatically when the real position changes.
import { useCallback, useEffect, useMemo, useState } from "react";
import { Chess } from "chess.js";
import type { Viz } from "../bridge/types";
import { tryMove } from "./chess";

const ARROW = { best: "rgba(38,150,105,.88)", threat: "rgba(214,58,58,.88)", played: "rgba(232,163,23,.85)" } as const;
const SQUARE = { danger: "rgba(220,60,60,.48)", warn: "rgba(232,163,23,.42)", good: "rgba(46,170,110,.42)" } as const;
const STEP_MS = 1000;

export interface LinePlay { fens: string[]; sans: string[]; ucis: string[]; i: number; auto: boolean }

export function useCoachBoard(fen: string) {
  const [viz, setViz] = useState<Viz | null>(null);
  const [play, setPlay] = useState<LinePlay | null>(null);
  useEffect(() => { setViz(null); setPlay(null); }, [fen]);
  useEffect(() => {
    if (!play?.auto || play.i >= play.fens.length - 1) return;
    const t = setTimeout(() => setPlay((p) => (p ? { ...p, i: p.i + 1, auto: p.i + 1 < p.fens.length - 1 } : p)), STEP_MS);
    return () => clearTimeout(t);
  }, [play]);

  const showLine = useCallback((line: { fen: string; moves: string[] } | null | undefined) => {
    if (!line?.moves.length) return;
    const c = new Chess(line.fen);
    const fens = [line.fen], sans: string[] = [], ucis: string[] = [];
    for (const u of line.moves) {
      const m = tryMove(c, u.slice(0, 2), u.slice(2, 4), u[4]);
      if (!m) break;
      fens.push(c.fen()); sans.push(m.san); ucis.push(u);
    }
    setPlay({ fens, sans, ucis, i: 0, auto: true });
  }, []);

  const step = useCallback((d: number) => setPlay((p) => (p ? { ...p, auto: false, i: Math.max(0, Math.min(p.fens.length - 1, p.i + d)) } : p)), []);
  const stop = useCallback(() => setPlay(null), []);

  const board = useMemo(() => {
    if (play) {
      const u = play.ucis[play.i - 1];
      return { fen: play.fens[play.i], arrows: [] as [string, string, string][], marks: {} as Record<string, string>, lastMove: u ? [u.slice(0, 2), u.slice(2, 4)] as [string, string] : null };
    }
    return {
      fen,
      arrows: (viz?.arrows ?? []).map(([a, b, k]) => [a, b, ARROW[k] ?? ARROW.best] as [string, string, string]),
      marks: Object.fromEntries(Object.entries(viz?.squares ?? {}).map(([sq, k]) => [sq, SQUARE[k] ?? SQUARE.warn])),
      lastMove: null,
    };
  }, [fen, viz, play]);

  return { board, viz, setViz, play, showLine, step, stop };
}
export type CoachBoard = ReturnType<typeof useCoachBoard>;
