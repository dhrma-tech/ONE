import { useCallback, useEffect, useMemo, useState } from "react";
import { Chess } from "chess.js";
import { Board } from "../components/Board";
import { EvalBar, fmtEval } from "../components/EvalBar";
import { EvalGraph } from "../components/EvalGraph";
import { MoveList } from "../components/MoveList";
import { analysisEngine, toWhite } from "../bridge/engine";
import { store, type AnalysisRow, type GameRow } from "../bridge/storage";
import type { Eval, MoveClass } from "../bridge/types";
import { replay, tryMove, uciOf } from "../lib/chess";
import { runPipeline, type PipelineProgress } from "../lib/pipeline";
import { commands } from "../lib/commands";
import { go } from "../lib/router";
import { useSettings } from "../lib/useSettings";
import { CoachDrawer } from "../components/CoachDrawer";
import { useOpeningName } from "../components/OpeningName";
import { useSideWidths } from "../lib/useSideWidths";
import { explainMove, practiceLinks, type CoachAnswer } from "../lib/coach";
import { useCoachBoard } from "../lib/useCoachBoard";

interface Line { e: Eval; san: string[]; first: string }

const sanLine = (fen: string, pv: string[], n = 8) => {
  const c = new Chess(fen); const out: string[] = [];
  for (const u of pv.slice(0, n)) { const m = tryMove(c, u.slice(0, 2), u.slice(2, 4), u[4]); if (!m) break; out.push(m.san); }
  return out;
};

export function Review({ id }: { id: string }) {
  const s = useSettings();
  const [game, setGame] = useState<GameRow | null | undefined>(undefined);
  const [an, setAn] = useState<AnalysisRow | null>(null);
  const [prog, setProg] = useState<PipelineProgress | null>(null);
  const [ply, setPly] = useState(0);
  const [branch, setBranch] = useState<string[]>([]);
  const [lines, setLines] = useState<{ fen: string; lines: Line[] } | null>(null);
  const [flipped, setFlipped] = useState(false);
  const [err, setErr] = useState("");
  const sides = useSideWidths();
  const [expl, setExpl] = useState<{ key: string; a: CoachAnswer | null } | null>(null);

  useEffect(() => {
    let live = true;
    (async () => {
      const g = await store.getGame(id);
      if (!live) return;
      setGame(g ?? null);
      if (!g) return;
      setFlipped(g.playerColor === "b");
      const a = await store.getAnalysis(id);
      if (a) { setAn(a); return; }
      try { await runPipeline(g, (p) => live && setProg(p)); if (live) setAn((await store.getAnalysis(id)) ?? null); }
      catch (e) { if (live) setErr((e as Error).message); }
    })();
    return () => { live = false; };
  }, [id]);

  const main = useMemo(() => {
    if (!game) return null;
    const c = new Chess(); c.loadPgn(game.pgn);
    const h = c.history({ verbose: true });
    return { start: h[0]?.before ?? game.startFen, ucis: h.map(uciOf), sans: h.map((m) => m.san) };
  }, [game]);

  const n = main?.ucis.length ?? 0;
  const baseFen = useMemo(() => (main ? replay(main.start, main.ucis.slice(0, ply)).fen() : ""), [main, ply]);
  const fen = useMemo(() => (branch.length ? replay(baseFen, branch).fen() : baseFen), [baseFen, branch]);
  const cb = useCoachBoard(fen);
  const jump = useCallback((p: number) => { setPly(Math.max(0, Math.min(n, p))); setBranch([]); }, [n]);

  // multi-PV for the shown position
  useEffect(() => {
    if (!fen) return;
    let live = true;
    analysisEngine().analyse(fen, { depth: 16, multipv: 3, channel: "review", movetimeMs: 2500 }).then((r) => {
      if (!live || !r.lines.length) return;
      setLines({ fen, lines: r.lines.map((l) => ({ e: toWhite(l, fen), san: sanLine(fen, l.pv), first: l.pv[0] })) });
    }).catch(() => {});
    return () => { live = false; };
  }, [fen]);

  useEffect(() => {
    commands.set([
      { id: "flip", label: "Flip board", hint: "Review", keys: "F", run: () => setFlipped((f) => !f) },
      { id: "start", label: "Go to start", hint: "Review", keys: "Home", run: () => jump(0) },
      { id: "end", label: "Go to end", hint: "Review", keys: "End", run: () => jump(n) },
      { id: "play", label: "Back to Play", hint: "Page", run: () => go("/") },
    ]);
    const k = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.tagName === "SELECT") || e.metaKey || e.ctrlKey || document.querySelector(".dialog-wrap")) return;
      if (e.key === "ArrowLeft") { e.preventDefault(); if (branch.length) setBranch((b) => b.slice(0, -1)); else jump(ply - 1); }
      else if (e.key === "ArrowRight") { e.preventDefault(); if (!branch.length) jump(ply + 1); }
      else if (e.key === "Home") jump(0);
      else if (e.key === "End") jump(n);
      else if (e.key === "f") setFlipped((f) => !f);
    };
    addEventListener("keydown", k);
    return () => { removeEventListener("keydown", k); commands.clear(); };
  }, [jump, ply, n, branch.length]);

  const opening = useOpeningName(main?.start ?? "", main ? main.ucis.slice(0, ply) : []);
  // Every move is explained automatically (rule-based, instant): what it did, what it allowed, what was better.
  const explKey = `${id}:${ply}`;
  useEffect(() => {
    if (!an || ply < 1 || branch.length) return;
    const key = `${id}:${ply}`;
    setExpl({ key, a: null });
    const cls = an.classification.moves.find((m) => m.ply === ply)?.class;
    explainMove(an.game, ply, cls)
      .then((a) => setExpl((e) => (e?.key === key ? { key, a } : e)))
      .catch((x) => setExpl((e) => (e?.key === key ? { key, a: { text: "", error: (x as Error).message } } : e)));
  }, [an, id, ply, branch.length]);
  // Draw the explanation's arrows once it arrives (the coach board clears them again when the position changes).
  useEffect(() => { if (expl?.key === explKey && expl.a?.viz) cb.setViz(expl.a.viz); }, [expl, explKey]); // eslint-disable-line react-hooks/exhaustive-deps

  if (game === undefined) return <div className="loading">Loading game…</div>;
  if (game === null) return <div className="page empty"><h2>Game not found</h2><p>It may have been deleted. <a href="#/">Back to Play</a></p></div>;

  const moves = an?.game.moves ?? [];
  const classes: (MoveClass | undefined)[] = main ? main.ucis.map((_, i) => an?.classification.moves.find((m) => m.ply === i + 1)?.class) : [];
  const evals: Eval[] = moves.length ? [moves[0].eval_before, ...moves.map((m) => m.eval_after)] : [];
  const cur = ply > 0 ? moves[ply - 1] : undefined;
  const curClass = classes[ply - 1];
  const missed = cur && (curClass === "mistake" || curClass === "blunder" || curClass === "inaccuracy") && cur.best_uci ? sanLine(cur.fen_before, [cur.best_uci], 1)[0] : null;
  const shownEval = lines?.fen === fen ? lines.lines[0]?.e : branch.length ? null : evals[ply] ?? null;
  const lastU = branch.length ? branch[branch.length - 1] : main?.ucis[ply - 1];
  const counts = (side: "w" | "b") => {
    const c: Record<string, number> = {};
    an?.classification.moves.forEach((m) => { const mv = moves.find((x) => x.ply === m.ply); if (mv && mv.fen_before.split(" ")[1] === side) c[m.class] = (c[m.class] ?? 0) + 1; });
    return c;
  };
  const youAre = game.mode === "bot" ? game.playerColor : null;

  return (
    <div className="play arena review with-coach" style={sides.style}>
      <div {...sides.handle("panel")} />
      <div {...sides.handle("coach")} />
      <div className="play-board">
        <div className="board-row">
          <EvalBar ev={shownEval} orientation={flipped ? "black" : "white"} />
          <Board fen={cb.board.fen} orientation={flipped ? "black" : "white"} movable={cb.play ? "none" : "both"} lastMove={cb.board.lastMove ?? (lastU ? [lastU.slice(0, 2), lastU.slice(2, 4)] : null)}
            onMove={(f, t, pr) => { const c = new Chess(fen); const m = tryMove(c, f, t, pr); if (!m) return false; setBranch((b) => [...b, uciOf(m)]); return true; }}
            arrows={cb.play ? [] : cb.board.arrows.length ? cb.board.arrows : lines?.fen === fen && lines.lines[0] ? [[lines.lines[0].first.slice(0, 2), lines.lines[0].first.slice(2, 4), "rgba(31,107,87,.7)"]] : []}
            marks={cb.board.marks}
            theme={s.boardTheme} pieceSet={s.pieceSet} coordinates={s.coordinates} legalHighlights={s.legalHighlights} label="Analysis board" />
        </div>
        <div className="navrow" role="group" aria-label="Move navigation">
          <button className="btn" onClick={() => jump(0)} aria-label="Start">«</button>
          <button className="btn" onClick={() => (branch.length ? setBranch((b) => b.slice(0, -1)) : jump(ply - 1))} aria-label="Previous">‹</button>
          <button className="btn" onClick={() => jump(ply + 1)} aria-label="Next" disabled={!!branch.length}>›</button>
          <button className="btn" onClick={() => jump(n)} aria-label="End">»</button>
          <button className="btn" onClick={() => setFlipped((f) => !f)}>Flip</button>
        </div>
      </div>

      <aside className="panel" aria-label="Review panel">
        <h1 className="panel-h">Game review</h1>
        {opening ? <p className="opening-name small" data-testid="opening-name"><strong>{opening.eco}</strong> {opening.name}</p> : null}
        <p className="muted small">{game.mode === "bot" ? `vs Bobby ~${game.botRating ?? "?"}` : "Two-player or imported game"} · {game.result} {game.termination ? `(${game.termination})` : ""}</p>

        {!an ? (
          <p className="status">{err ? <span className="err">Analysis failed: {err}</span> : prog?.stage === "analysing" ? `Analysing ${prog.done}/${prog.total} positions…` : "Preparing analysis…"}</p>
        ) : (
          <>
            <div className="acc">
              {(["w", "b"] as const).map((side) => (
                <div key={side} className={"acc-c" + (youAre === side ? " you" : "")}>
                  <small>{side === "w" ? "White" : "Black"}{youAre === side ? " (you)" : ""}</small>
                  <strong>{an.classification.accuracy[side].toFixed(1)}%</strong>
                  <small className="muted">ACPL {Math.round(an.classification.acpl[side])} · {counts(side).blunder ?? 0} blunders · {counts(side).mistake ?? 0} mistakes</small>
                </div>
              ))}
            </div>
            <EvalGraph evals={evals} classes={classes} current={ply} onJump={jump} />
            {an.classification.key_moments.length ? (
              <div className="keys"><small className="muted">Key moments</small>
                {an.classification.key_moments.map((k) => (
                  <button key={k} className={"chip" + (k === ply ? " on" : "")} onClick={() => jump(k)}>{Math.ceil(k / 2)}{k % 2 ? "." : "..."} {main?.sans[k - 1]}</button>
                ))}
              </div>
            ) : null}
          </>
        )}

        {cur && curClass ? (
          <p className={"verdict c-" + curClass}>
            <strong>{main?.sans[ply - 1]}</strong> is {curClass === "inaccuracy" ? "an inaccuracy" : `a ${curClass} move`}.
            {missed ? <> Better was <strong>{missed}</strong>.</> : null}
          </p>
        ) : null}
        {cur && !branch.length ? (
          <div className="explain">
            {expl?.key === explKey && expl.a ? <>
              {expl.a.text ? <p className="hint coach-say" data-testid="explain-text">{expl.a.text}</p> : null}
              {expl.a.error ? <p className="err small">{expl.a.error}</p> : null}
              <div className="msg-f">
                {expl.a.viz?.line ? <button className="textlink" onClick={() => cb.showLine(expl.a?.viz?.line)} data-testid="show-me">Show the better line ▶</button> : null}
                {practiceLinks(expl.a.tags).map((l) => <button key={l.href} className="textlink" onClick={() => go(l.href)}>{l.label}</button>)}
              </div>
            </> : <p className="muted small think">Bobby is looking at this move…</p>}
          </div>
        ) : null}

        <div className="lines" aria-label="Engine lines">
          {branch.length ? <p className="muted small">Exploring a side line. <button className="textlink" onClick={() => setBranch([])}>Back to game</button></p> : null}
          {lines?.fen === fen ? lines.lines.map((l, i) => (
            <button key={i} className="line" onClick={() => setBranch((b) => [...b, l.first])}><strong>{fmtEval(l.e)}</strong> <span>{l.san.join(" ")}</span></button>
          )) : <p className="muted small">Engine thinking…</p>}
        </div>

        <MoveList sans={main?.sans ?? []} current={ply} onJump={jump} classes={classes} />
        <a className="btn btn-soft btn-wide" href="#/">Back to Play</a>
      </aside>
      <CoachDrawer fen={fen} board={cb} summary={{ gameId: id, pending: !an }} />
    </div>
  );
}
