// Interactive puzzle on the board. Solver plays solution[0], [2], ...; replies are auto-played.
import { useEffect, useMemo, useRef, useState } from "react";
import { Chess } from "chess.js";
import { Board } from "./Board";
import type { Puzzle } from "../bridge/types";
import { tryMove, uciOf } from "../lib/chess";
import { useSettings } from "../lib/useSettings";
import { play as sound } from "../lib/sounds";

export interface PuzzleResult { solved: boolean; mistakes: number; hinted: boolean; ms: number }

export function PuzzlePlayer({ puzzle, onDone, onNext, label }: { puzzle: Puzzle; onDone: (r: PuzzleResult) => void; onNext?: () => void; label?: string }) {
  const s = useSettings();
  const [ply, setPly] = useState(0);
  const [fen, setFen] = useState(puzzle.fen);
  const [last, setLast] = useState<[string, string] | null>(null);
  const [mistakes, setMistakes] = useState(0);
  const [hint, setHint] = useState(false);
  const [state, setState] = useState<"playing" | "solved" | "failed">("playing");
  const [msg, setMsg] = useState("");
  const t0 = useRef(Date.now());
  const done = useRef(false);
  const solver = useMemo(() => (puzzle.fen.split(" ")[1] === "b" ? "b" : "w") as "w" | "b", [puzzle.fen]);

  useEffect(() => { setPly(0); setFen(puzzle.fen); setLast(null); setMistakes(0); setHint(false); setState("playing"); setMsg(""); t0.current = Date.now(); done.current = false; }, [puzzle]);

  const finish = (solved: boolean, m = mistakes) => {
    if (done.current) return; done.current = true;
    setState(solved ? "solved" : "failed");
    onDone({ solved, mistakes: m, hinted: hint, ms: Date.now() - t0.current });
  };

  const onMove = (from: string, to: string, promo?: string) => {
    if (state !== "playing") return false;
    const c = new Chess(fen);
    const m = tryMove(c, from, to, promo);
    if (!m) return false;
    const uci = uciOf(m);
    const want = puzzle.solution[ply];
    const isLast = ply >= puzzle.solution.length - 1;
    if (uci !== want && !(isLast && c.isCheckmate())) {
      setMistakes((x) => x + 1); setMsg("Not the move. Try again."); if (s.sounds) sound("illegal");
      return false;
    }
    if (s.sounds) sound(m.captured ? "capture" : c.inCheck() ? "check" : "move");
    setFen(c.fen()); setLast([from, to]); setHint(false);
    if (isLast || ply + 1 >= puzzle.solution.length) { setMsg(mistakes ? "Solved." : "Solved first try."); finish(true); return true; }
    setMsg("Good. Keep going.");
    const reply = puzzle.solution[ply + 1];
    setTimeout(() => {
      const c2 = new Chess(c.fen());
      const r = tryMove(c2, reply.slice(0, 2), reply.slice(2, 4), reply[4]);
      if (r) { setFen(c2.fen()); setLast([reply.slice(0, 2), reply.slice(2, 4)]); if (s.sounds) sound("move"); }
      setPly(ply + 2);
      if (ply + 2 >= puzzle.solution.length) finish(true);
    }, 380);
    return true;
  };

  const reveal = () => {
    const c = new Chess(puzzle.fen);
    for (const u of puzzle.solution) tryMove(c, u.slice(0, 2), u.slice(2, 4), u[4]);
    setFen(c.fen()); const u = puzzle.solution[puzzle.solution.length - 1]; setLast([u.slice(0, 2), u.slice(2, 4)]);
    setMsg("Solution shown."); finish(false, mistakes + 1);
  };
  const want = puzzle.solution[ply];

  return (
    <div className="puzzle" data-puzzle-id={puzzle.id} data-state={state}>
      <div className="board-row">
        <Board fen={fen} orientation={solver === "w" ? "white" : "black"} movable={state === "playing" ? solver : "none"} onMove={onMove} lastMove={last}
          highlight={hint && state === "playing" && want ? want.slice(0, 2) : null} theme={s.boardTheme} pieceSet={s.pieceSet} coordinates={s.coordinates} legalHighlights={s.legalHighlights}
          label={label ?? `Puzzle, ${solver === "w" ? "white" : "black"} to move`} />
      </div>
      <div className="puzzle-f">
        <p className="status" role="status">{state === "playing" ? (msg || `${solver === "w" ? "White" : "Black"} to move. Find the best move.`) : <strong className={state === "solved" ? "ok" : "err"}>{msg}</strong>}</p>
        <div className="btnrow">
          {state === "playing" ? <>
            {s.hints ? <button className="btn" onClick={() => setHint(true)} disabled={hint}>Hint</button> : null}
            <button className="btn" onClick={reveal}>Show solution</button>
          </> : onNext ? <button className="btn btn-primary" onClick={onNext}>Next puzzle</button> : null}
          <small className="muted">Rating {puzzle.rating}{puzzle.themes?.length ? ` · ${puzzle.themes.filter((t) => !["short", "long", "veryLong", "oneMove", "middlegame", "endgame", "opening", "master", "masterVsMaster", "superGM"].includes(t)).slice(0, 3).join(", ")}` : ""}</small>
        </div>
      </div>
    </div>
  );
}
