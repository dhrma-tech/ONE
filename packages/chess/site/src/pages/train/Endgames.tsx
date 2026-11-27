// Endgame trainer: tablebase-verified positions (endgames.json) played against full-strength Stockfish.
import { useEffect, useMemo, useRef, useState } from "react";
import { Chess } from "chess.js";
import { Board } from "../../components/Board";
import { MoveList } from "../../components/MoveList";
import { playEngine } from "../../bridge/engine";
import { db } from "../../bridge/storage";
import { data, type Endgame } from "../../lib/data";
import { outcome, replay, tryMove, uciOf } from "../../lib/chess";
import { markActivity } from "../../lib/progress";
import { useSettings } from "../../lib/useSettings";
import { play as sound } from "../../lib/sounds";

const HOLD_PLIES = 100; // draw goal: survive 50 moves (or reach a drawn result)

export function Endgames() {
  const [list, setList] = useState<Endgame[] | null>(null);
  const [done, setDone] = useState<Set<string>>(new Set());
  const [cur, setCur] = useState<Endgame | null>(null);
  const [err, setErr] = useState("");
  const refresh = async () => setDone(new Set((await db.lessonProgress.toArray()).filter((r) => String(r.id).startsWith("eg:") && r.done).map((r) => String(r.id).slice(3))));
  useEffect(() => { data.endgames().then(setList).catch((e) => setErr((e as Error).message)); void refresh(); }, []);
  const groups = useMemo(() => {
    const m = new Map<string, Endgame[]>();
    for (const e of list ?? []) m.set(e.name, [...(m.get(e.name) ?? []), e]);
    return [...m.entries()];
  }, [list]);
  if (err) return <p className="err">Could not load endgames: {err}</p>;
  if (!list) return <p className="muted">Loading endgames…</p>;
  if (cur) return <EndgameTrainer eg={cur} key={cur.id} onBack={() => { setCur(null); void refresh(); }} onNext={() => { const i = list.indexOf(cur); setCur(list[(i + 1) % list.length]); void refresh(); }} />;
  return (
    <div className="tab-body">
      <p className="muted">Positions with a known result from tablebases. Bobby defends at full strength. {done.size}/{list.length} done.</p>
      {groups.map(([name, items]) => (
        <section key={name} className="eg-group">
          <h3>{name} <small className={"goal g-" + items[0].goal}>{items[0].goal === "win" ? "Win it" : "Hold the draw"}</small></h3>
          <div className="btnrow">{items.map((e, i) => <button key={e.id} className={"chip" + (done.has(e.id) ? " on" : "")} onClick={() => setCur(e)} data-endgame={e.id}>#{i + 1}{done.has(e.id) ? " ✓" : ""}</button>)}</div>
        </section>
      ))}
    </div>
  );
}

function EndgameTrainer({ eg, onBack, onNext }: { eg: Endgame; onBack: () => void; onNext: () => void }) {
  const s = useSettings();
  const solver = (eg.fen.split(" ")[1] === "b" ? "b" : "w") as "w" | "b";
  const [moves, setMoves] = useState<string[]>([]);
  const [result, setResult] = useState<{ ok: boolean; text: string } | null>(null);
  const [thinking, setThinking] = useState(false);
  const [hint, setHint] = useState(false);
  const c = useMemo(() => replay(eg.fen, moves), [eg.fen, moves]);
  const fen = c.fen();
  const live = useRef(true);
  useEffect(() => () => { live.current = false; playEngine().stop(); }, []);

  const judge = (cc: Chess, plies: number) => {
    const o = outcome(cc);
    if (o) {
      const solverWon = o.result === (solver === "w" ? "1-0" : "0-1");
      const ok = eg.goal === "win" ? solverWon : o.result === "1/2-1/2" || solverWon;
      return { ok, text: `${ok ? "Goal reached" : "Goal missed"}: ${o.reason}.` };
    }
    if (eg.goal === "draw" && plies >= HOLD_PLIES) return { ok: true, text: "Held for 50 moves. Draw secured." };
    return null;
  };
  const finish = async (r: { ok: boolean; text: string }) => {
    setResult(r);
    if (s.sounds) sound("end");
    const prev = await db.lessonProgress.get("eg:" + eg.id);
    await db.lessonProgress.put({ ...(prev ?? {}), id: "eg:" + eg.id, kind: "endgame", attempts: ((prev?.attempts as number) ?? 0) + 1, done: !!prev?.done || r.ok });
    await markActivity(r.ok && !prev?.done ? "endgames_done" : undefined);
  };

  const onMove = (from: string, to: string, promo?: string) => {
    if (result || thinking || c.turn() !== solver) return false;
    const cc = new Chess(fen);
    const m = tryMove(cc, from, to, promo);
    if (!m) return false;
    const next = [...moves, uciOf(m)];
    setMoves(next); setHint(false);
    if (s.sounds) sound(m.captured ? "capture" : "move");
    const r = judge(cc, next.length);
    if (r) { void finish(r); return true; }
    setThinking(true);
    playEngine().bestMove(cc.fen(), { targetElo: 3190, movetimeMs: 350 }).then(({ uci }) => {
      if (!live.current || !uci || uci === "(none)") return;
      const c2 = new Chess(cc.fen());
      const r2 = tryMove(c2, uci.slice(0, 2), uci.slice(2, 4), uci[4]);
      if (!r2) return;
      const n2 = [...next, uciOf(r2)];
      setMoves(n2);
      if (s.sounds) sound(r2.captured ? "capture" : c2.inCheck() ? "check" : "move");
      const j = judge(c2, n2.length);
      if (j) void finish(j);
    }).finally(() => live.current && setThinking(false));
    return true;
  };

  return (
    <div className="play endgame" data-endgame-id={eg.id}>
      <div className="play-board">
        <div className="board-row">
          <Board fen={fen} orientation={solver === "w" ? "white" : "black"} movable={result ? "none" : solver} onMove={onMove}
            lastMove={moves.length ? [moves[moves.length - 1].slice(0, 2), moves[moves.length - 1].slice(2, 4)] : null}
            theme={s.boardTheme} pieceSet={s.pieceSet} coordinates={s.coordinates} legalHighlights={s.legalHighlights} label={`Endgame: ${eg.name}`} />
        </div>
      </div>
      <aside className="panel">
        <button className="textlink" onClick={onBack}>← Endgames</button>
        <h1 className="panel-h">{eg.name}</h1>
        <p><span className={"goal g-" + eg.goal}>{eg.goal === "win" ? "Goal: win" : "Goal: draw"}</span> <small className="muted">You play {solver === "w" ? "White" : "Black"}{eg.dtz ? ` · tablebase: ${eg.dtz} plies to convert` : ""}{eg.goal === "draw" ? " · hold 50 moves" : ""}</small></p>
        <p className="status" role="status">{result ? <strong className={result.ok ? "ok" : "err"}>{result.text}</strong> : thinking ? "Bobby is defending…" : "Your move."}</p>
        {hint || result ? <p className="hint">{eg.hint}</p> : null}
        <MoveList sans={replay(eg.fen, moves).history()} current={moves.length} />
        <div className="btnrow">
          {!result && s.hints ? <button className="btn" onClick={() => setHint(true)} disabled={hint}>Hint</button> : null}
          <button className="btn" onClick={() => { setMoves([]); setResult(null); }}>Restart</button>
          {result ? <button className="btn btn-primary" onClick={onNext}>Next position</button> : null}
        </div>
      </aside>
    </div>
  );
}
