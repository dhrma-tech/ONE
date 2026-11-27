import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Chess } from "chess.js";
import { Board } from "../components/Board";
import { EvalBar, fmtEval } from "../components/EvalBar";
import { MoveList } from "../components/MoveList";
import { toast } from "../components/Toast";
import { Dialog } from "../dialogs/Dialog";
import { LevelCard, ensureProfile } from "../dialogs/LevelCard";
import { analysisEngine, describeStrength, playEngine, toWhite } from "../bridge/engine";
import { py } from "../bridge/py";
import { settings, store, type GameRow } from "../bridge/storage";
import type { Color, Eval } from "../bridge/types";
import { outcome, replay, START_FEN, tryMove, uciOf } from "../lib/chess";
import { fmtClock, newLiveGame, pgnOf, TIME_CONTROLS, type LiveGame } from "../lib/game";
import { runPipeline, type PipelineProgress } from "../lib/pipeline";
import { commands } from "../lib/commands";
import { go } from "../lib/router";
import { play as sound } from "../lib/sounds";
import { useSettings } from "../lib/useSettings";
import { CoachDrawer, CoachRail } from "../components/CoachDrawer";
import { useOpeningName } from "../components/OpeningName";
import { todaysProgression } from "../lib/progress";
import { useSideWidths } from "../lib/useSideWidths";
import { useCoachBoard } from "../lib/useCoachBoard";
import { safetyCheck, type SafetyWarning } from "../lib/safety";
import { Select } from "../components/Select";

const FIXED_STRENGTHS = [400, 700, 1000, 1300, 1600, 2000, 2400];

interface Hint { level: 1 | 2 | 3; text: string; from?: string; to?: string; fen: string }

export function Play() {
  const s = useSettings();
  const [g, setG] = useState<LiveGame | null>(null);
  const [view, setView] = useState<number | null>(null); // ply being viewed; null = live
  const [thinking, setThinking] = useState(false);
  const [ev, setEv] = useState<{ fen: string; e: Eval; pv: string } | null>(null);
  const [hint, setHint] = useState<Hint | null>(null);
  const [progress, setProgress] = useState<PipelineProgress | null>(null);
  const [showNew, setShowNew] = useState(false);
  const [showIO, setShowIO] = useState(false);
  const [levelCard, setLevelCard] = useState(!settings.get().levelCardDismissed);
  const [flipped, setFlipped] = useState(false);
  const [autoFlip, setAutoFlip] = useState(false);
  const [moveText, setMoveText] = useState("");
  const [announce, setAnnounce] = useState("");
  const [now, setNow] = useState(() => Date.now());
  const turnStart = useRef(Date.now());

  // ---------- load or create ----------
  useEffect(() => {
    let live = true;
    (async () => {
      const saved = await store.getCurrent<LiveGame>().catch(() => undefined);
      if (!live) return;
      if (saved && saved.result === "*") { setG(saved); turnStart.current = Date.now(); return; }
      setG(await freshBotGame("w", null, TIME_CONTROLS[0].id));
    })();
    return () => { live = false; };
  }, []);

  const chess = useMemo(() => (g ? replay(g.startFen, g.moves) : new Chess()), [g]);
  const sans = useMemo(() => chess.history(), [chess]);
  const fenAt = useCallback((ply: number) => (ply === 0 || !g ? (g?.startFen ?? START_FEN) : replay(g.startFen, g.moves.slice(0, ply)).fen()), [g]);
  const viewing = view !== null && g !== null && view < g.moves.length;
  const fen = viewing ? fenAt(view) : chess.fen();
  const cb = useCoachBoard(fen);
  const over = !!g && g.result !== "*";
  const turn = chess.turn();
  const botTurn = !!g && g.mode === "bot" && !over && turn !== g.playerColor;
  const lastMove = useMemo<[string, string] | null>(() => {
    const ply = viewing ? view! : g?.moves.length ?? 0;
    const u = g?.moves[ply - 1];
    return u ? [u.slice(0, 2), u.slice(2, 4)] : null;
  }, [g, view, viewing]);

  // autosave
  useEffect(() => { if (g && g.result === "*") void store.setCurrent(g); }, [g]);

  // ---------- finishing ----------
  const finish = useCallback(async (done: LiveGame) => {
    await store.clearCurrent();
    if (!done.moves.length) return;
    const row: GameRow = {
      id: done.id, pgn: pgnOf(done), result: done.result, mode: done.mode, playerColor: done.mode === "bot" ? done.playerColor : "w",
      botRating: done.mode === "bot" ? done.botElo : null, date: new Date().toISOString(), startFen: done.startFen,
      timeControl: done.tc.id, termination: done.reason, analysed: false,
    };
    await store.saveGame(row);
    try { await runPipeline(row, setProgress); } catch (e) { toast("Analysis failed: " + (e as Error).message); setProgress(null); }
  }, []);

  const end = useCallback((cur: LiveGame, result: LiveGame["result"], reason: string) => {
    const done = { ...cur, result, reason };
    setG(done);
    if (settings.get().sounds) sound("end");
    setAnnounce(`Game over: ${result}, ${reason}`);
    void finish(done);
  }, [finish]);

  // ---------- making moves ----------
  const commit = useCallback((cur: LiveGame, uci: string): LiveGame | null => {
    const c = replay(cur.startFen, cur.moves);
    const mover = c.turn();
    const m = tryMove(c, uci.slice(0, 2), uci.slice(2, 4), uci[4]);
    if (!m) return null;
    let clock = cur.clock;
    if (cur.tc.baseMs && cur.moves.length >= 1) {
      const used = Date.now() - turnStart.current;
      clock = { ...clock, [mover]: clock[mover] - used + cur.tc.incMs };
    }
    turnStart.current = Date.now();
    const next = { ...cur, moves: [...cur.moves, uciOf(m)], clock };
    if (settings.get().sounds) sound(c.inCheck() ? "check" : m.captured ? "capture" : "move");
    setAnnounce(`${mover === "w" ? "White" : "Black"} played ${m.san}`);
    setHint(null);
    const o = outcome(c);
    if (o) { end(next, o.result, o.reason); return next; }
    setG(next);
    if (cur.mode === "local" && autoFlip) setFlipped(c.turn() === "b");
    return next;
  }, [end, autoFlip]);

  // Safety net: a move that hangs a piece or allows mate in one waits for confirmation instead of being played.
  const [risky, setRisky] = useState<{ uci: string; warn: SafetyWarning } | null>(null);
  const onMove = useCallback((from: string, to: string, promotion?: string) => {
    if (!g || over || viewing || botTurn) return false;
    if (settings.get().safetyNet) {
      const warn = safetyCheck(chess.fen(), from, to, promotion);
      if (warn) { setRisky({ uci: from + to + (promotion ?? ""), warn }); return false; }
    }
    const ok = commit(g, from + to + (promotion ?? ""));
    if (!ok && settings.get().sounds) sound("illegal");
    return !!ok;
  }, [g, over, viewing, botTurn, commit, chess]);

  // Bobby's move
  const gRef = useRef(g);
  gRef.current = g;
  useEffect(() => {
    if (!g || !botTurn || thinking) return;
    setThinking(true);
    const id = g.id, ply = g.moves.length;
    const f = chess.fen();
    const delay = new Promise((r) => setTimeout(r, 250));
    playEngine().bestMove(f, { targetElo: g.botElo, movetimeMs: 500 })
      .then(async ({ uci }) => {
        await delay;
        const cur = gRef.current;
        if (cur && cur.id === id && cur.moves.length === ply && cur.result === "*" && uci && uci !== "(none)") commit(cur, uci);
      })
      .catch((e) => toast("Engine error: " + (e as Error).message))
      .finally(() => setThinking(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [g?.id, g?.moves.length, botTurn, thinking]);

  // live eval and coach: hidden in focus mode (default ON) until the game ends
  const focused = s.focusMode && !over && !!g;
  // While a game is in progress the side panels get out of the way: the left panel collapses to a slim rail of
  // controls and the coach card can be closed. Both come back on their own when the game ends.
  const inGame = !!g && !over && g.moves.length > 0;
  const [panelPref, setPanelPref] = useState<boolean | null>(null);
  const [coachPref, setCoachPref] = useState<boolean | null>(null);
  useEffect(() => { setPanelPref(null); setCoachPref(null); }, [inGame]);
  const panelOpen = panelPref ?? !inGame;
  const coachOpen = coachPref ?? true;
  const sides = useSideWidths();
  const showEval = s.showEval && !focused;
  const opening = useOpeningName(g?.startFen ?? START_FEN, viewing ? g!.moves.slice(0, view!) : g?.moves ?? []);
  useEffect(() => {
    if (!showEval) return;
    let live = true;
    analysisEngine().analyse(fen, { depth: 14, multipv: 1, channel: "live", movetimeMs: 1200 }).then((r) => {
      const l = r.lines[0];
      if (!live || !l) return;
      const c = new Chess(fen);
      const pv: string[] = [];
      for (const u of l.pv.slice(0, 6)) { const m = tryMove(c, u.slice(0, 2), u.slice(2, 4), u[4]); if (!m) break; pv.push(m.san); }
      setEv({ fen, e: toWhite(l, fen), pv: pv.join(" ") });
    }).catch(() => {});
    return () => { live = false; };
  }, [fen, showEval]);

  // clock tick
  useEffect(() => {
    if (!g || !g.tc.baseMs || over || g.moves.length < 1) return;
    const t = setInterval(() => {
      setNow(Date.now());
      const left = g.clock[turn] - (Date.now() - turnStart.current);
      if (left <= 0) end({ ...g, clock: { ...g.clock, [turn]: 0 } }, turn === "w" ? "0-1" : "1-0", "time");
    }, 200);
    return () => clearInterval(t);
  }, [g, over, turn, end]);

  // ---------- actions ----------
  const newGame = useCallback(async (o: { mode: "bot" | "local"; color: Color | "random"; strength: number | null; tc: string; startFen?: string; moves?: string[] }) => {
    setProgress(null); setHint(null); setView(null); setEv(null);
    playEngine().stop();
    const g2 = o.mode === "bot" ? await freshBotGame(o.color, o.strength, o.tc, o.startFen, o.moves)
      : newLiveGame({ mode: "local", tc: TIME_CONTROLS.find((t) => t.id === o.tc) ?? TIME_CONTROLS[0], startFen: o.startFen, moves: o.moves });
    turnStart.current = Date.now();
    setFlipped(g2.mode === "bot" && g2.playerColor === "b");
    setG(g2);
  }, []);

  const takeback = useCallback(() => {
    if (!g || over || !s.takebacks || thinking) return;
    const n = g.mode === "bot" ? (turn === g.playerColor ? 2 : 1) : 1;
    if (g.moves.length < n) return;
    playEngine().stop();
    setG({ ...g, moves: g.moves.slice(0, -n), takebacksUsed: g.takebacksUsed + 1 });
    setView(null); setHint(null);
  }, [g, over, s.takebacks, thinking, turn]);

  const resign = () => { if (g && !over && g.moves.length) end(g, (g.mode === "bot" ? g.playerColor : turn) === "w" ? "0-1" : "1-0", "resignation"); };
  const offerDraw = async () => {
    if (!g || over) return;
    if (g.mode === "local") { end(g, "1/2-1/2", "agreement"); return; }
    const r = await analysisEngine().analyse(chess.fen(), { depth: 12, multipv: 1 });
    const e = r.lines[0] ? toWhite(r.lines[0], chess.fen()) : { cp: 0, mate: null };
    const botView = (g.playerColor === "w" ? -1 : 1) * (e.mate !== null ? (e.mate > 0 ? 1000 : -1000) : e.cp ?? 0);
    if (g.moves.length >= 30 && botView < 40) end(g, "1/2-1/2", "agreement"); else toast("Bobby declines the draw.");
  };

  const askHint = useCallback(async () => {
    if (!g || over || botTurn || !s.hints) return;
    const f = chess.fen();
    const level = (hint && hint.fen === f ? Math.min(3, hint.level + 1) : 1) as 1 | 2 | 3;
    const r = await analysisEngine().analyse(f, { depth: 12, multipv: 1, channel: "hint", movetimeMs: 800 });
    const u = r.lines[0]?.pv[0];
    if (!u) return;
    const c = new Chess(f);
    const m = tryMove(c, u.slice(0, 2), u.slice(2, 4), u[4]);
    if (!m) return;
    const piece = { p: "pawn", n: "knight", b: "bishop", r: "rook", q: "queen", k: "king" }[m.piece];
    const nudge = c.isCheckmate() ? "There is a checkmate here." : c.inCheck() ? "Look for a forcing check." : m.captured ? "Something can be captured favourably." : "No forcing tactic: improve your worst piece or control the centre.";
    const text = level === 1 ? nudge : level === 2 ? `Move your ${piece}.` : `Best: ${m.san}.`;
    setHint({ level, text, from: level >= 2 ? m.from : undefined, to: level === 3 ? m.to : undefined, fen: f });
    setG({ ...g, hintsUsed: g.hintsUsed + 1 });
  }, [g, over, botTurn, s.hints, chess, hint]);

  const typedMove = (e: React.FormEvent) => {
    e.preventDefault();
    if (!g || over || botTurn || viewing) return;
    const t = moveText.trim();
    const c = new Chess(chess.fen());
    let m = null;
    try { m = c.move(t); } catch { m = /^[a-h][1-8][a-h][1-8][qrbn]?$/.test(t) ? tryMove(c, t.slice(0, 2), t.slice(2, 4), t[4]) : null; }
    if (!m) { toast(`"${t}" is not a legal move here.`); return; }
    commit(g, uciOf(m)); setMoveText("");
  };

  const copy = (txt: string, what: string) => { void navigator.clipboard?.writeText(txt).then(() => toast(`${what} copied`), () => toast("Clipboard unavailable")); };

  // keyboard + palette commands
  useEffect(() => {
    commands.set([
      { id: "new", label: "New game", hint: "Play", keys: "N", run: () => setShowNew(true) },
      { id: "flip", label: "Flip board", hint: "Play", keys: "F", run: () => setFlipped((f) => !f) },
      { id: "hint", label: "Hint", hint: "Play", keys: "H", run: () => void askHint() },
      { id: "takeback", label: "Take back", hint: "Play", keys: "U", run: takeback },
      { id: "io", label: "Import or export PGN / FEN", hint: "Play", run: () => setShowIO(true) },
      { id: "copyfen", label: "Copy FEN", hint: "Play", run: () => copy(fen, "FEN") },
      { id: "copypgn", label: "Copy PGN", hint: "Play", run: () => g && copy(pgnOf(g), "PGN") },
      { id: "focus", label: s.focusMode ? "Focus mode: off (show eval and coach)" : "Focus mode: on (hide eval and coach)", hint: "Play", run: () => settings.set({ focusMode: !s.focusMode }) },
      { id: "coach", label: "Ask Bobby about this position", hint: "Coach", run: () => { if (!(s.focusMode && g?.result === "*")) document.getElementById("coach-q")?.focus(); else toast("Focus mode is on: the coach returns when the game ends."); } },
    ]);
    const k = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.tagName === "SELECT") || e.metaKey || e.ctrlKey || e.altKey || document.querySelector(".dialog-wrap")) return;
      const len = g?.moves.length ?? 0;
      if (e.key === "ArrowLeft") { setView((v) => Math.max(0, (v ?? len) - 1)); e.preventDefault(); }
      else if (e.key === "ArrowRight") { setView((v) => (v === null || v + 1 >= len ? null : v + 1)); e.preventDefault(); }
      else if (e.key === "f") setFlipped((f) => !f);
      else if (e.key === "h") void askHint();
      else if (e.key === "u") takeback();
      else if (e.key === "n") setShowNew(true);
    };
    addEventListener("keydown", k);
    return () => { removeEventListener("keydown", k); commands.clear(); };
  }, [g, fen, s.focusMode, askHint, takeback]);

  if (!g) return <div className="loading">Setting up the board…</div>;

  const orientation: "white" | "black" = flipped ? "black" : "white";
  const live = g.tc.baseMs ? { w: g.clock.w - (turn === "w" && !over && g.moves.length ? now - turnStart.current : 0), b: g.clock.b - (turn === "b" && !over && g.moves.length ? now - turnStart.current : 0) } : null;
  const movable = over || viewing ? "none" : g.mode === "local" ? "both" : g.playerColor;
  const top: Color = orientation === "white" ? "b" : "w";
  const name = (c: Color) => (g.mode === "local" ? (c === "w" ? "White" : "Black") : c === g.playerColor ? "You" : "Bobby");
  const PlayerBar = ({ c }: { c: Color }) => (
    <div className={"pbar" + (turn === c && !over ? " on" : "")}>
      <span className="pname">{name(c)}{g.mode === "bot" && c !== g.playerColor ? <small> ~{g.botElo}</small> : null}{thinking && c !== g.playerColor && g.mode === "bot" ? <small className="think"> thinking…</small> : null}</span>
      {live ? <span className={"clock" + (live[c] < 20e3 ? " low" : "")} aria-label={`${name(c)} clock`}>{fmtClock(live[c])}</span> : null}
    </div>
  );

  return (
    <div className={"play arena with-coach" + (panelOpen ? "" : " panel-min") + (coachOpen ? "" : " coach-min")} style={sides.style}>
      {panelOpen ? <div {...sides.handle("panel")} /> : null}
      {coachOpen ? <div {...sides.handle("coach")} /> : null}
      <div className="play-board">
        <PlayerBar c={top} />
        <div className="board-row">
          {showEval ? <EvalBar ev={ev?.fen === fen ? ev.e : null} orientation={orientation} /> : null}
          <Board fen={cb.board.fen} orientation={orientation} movable={cb.play ? "none" : movable} onMove={onMove} lastMove={cb.board.lastMove ?? lastMove}
            highlight={hint && hint.fen === fen ? hint.from ?? null : null}
            arrows={risky ? [[risky.warn.arrow?.[0] ?? "", risky.warn.arrow?.[1] ?? "", "rgba(214,58,58,.9)"] as [string, string, string]].filter((a) => a[0])
              : hint && hint.fen === fen && hint.from && hint.to ? [[hint.from, hint.to]] : cb.board.arrows}
            marks={risky ? Object.fromEntries(risky.warn.squares.map((q) => [q, "rgba(220,60,60,.5)"])) : cb.board.marks}
            theme={s.boardTheme} pieceSet={s.pieceSet} coordinates={s.coordinates} legalHighlights={s.legalHighlights} label={`Chess board, ${turn === "w" ? "white" : "black"} to move`} />
        </div>
        <PlayerBar c={top === "w" ? "b" : "w"} />
        <p className="sr-only" aria-live="polite">{announce}</p>
      </div>

      {!panelOpen ? (
        <aside className="rail" aria-label="Game controls">
          <button className="rail-btn" onClick={() => setPanelPref(true)} aria-label="Show game panel" title="Show game panel"><Ico d="M4 6h16M4 12h16M4 18h16" /></button>
          <span className="rail-sep" aria-hidden="true" />
          {s.hints ? <button className="rail-btn" onClick={() => void askHint()} disabled={botTurn} aria-label="Hint" title="Hint (H)"><Ico d="M9 18h6M10 21h4M12 3a6 6 0 0 0-4 10.5c.7.7 1 1.5 1 2.5h6c0-1 .3-1.8 1-2.5A6 6 0 0 0 12 3z" /></button> : null}
          {s.takebacks ? <button className="rail-btn" onClick={takeback} disabled={!g.moves.length || thinking} aria-label="Take back" title="Take back (U)"><Ico d="M9 14L4 9l5-5M4 9h10a6 6 0 0 1 0 12h-3" /></button> : null}
          <button className="rail-btn" onClick={() => void offerDraw()} aria-label="Draw" title="Offer a draw"><Ico d="M5 9h14M5 15h14" /></button>
          <button className="rail-btn danger" onClick={resign} aria-label="Resign" title="Resign"><Ico d="M5 21V4M5 4h11l-2 4 2 4H5" /></button>
          <span className="rail-sep" aria-hidden="true" />
          <button className="rail-btn" onClick={() => setFlipped((f) => !f)} aria-label="Flip board" title="Flip board (F)"><Ico d="M7 4v16M7 20l-3-3M7 20l3-3M17 20V4M17 4l-3 3M17 4l3 3" /></button>
          {hint && hint.fen === fen ? <span className="rail-hint" role="status" title={hint.text}>{hint.level}/3</span> : null}
        </aside>
      ) : null}
      <aside className="panel" aria-label="Game panel" hidden={!panelOpen}>
        {inGame ? <button className="panel-hide" onClick={() => setPanelPref(false)} aria-label="Hide game panel" title="Hide panel">«</button> : null}
        {levelCard ? <LevelCard onDone={() => { setLevelCard(false); void newGame({ mode: "bot", color: g.playerColor, strength: null, tc: g.tc.id }); }} /> : null}

        <div className="seg" role="group" aria-label="Opponent">
          <button className={"seg-b" + (g.mode === "bot" ? " on" : "")} aria-pressed={g.mode === "bot"} onClick={() => g.mode !== "bot" && void newGame({ mode: "bot", color: "w", strength: null, tc: g.tc.id })}>vs Bobby</button>
          <button className={"seg-b" + (g.mode === "local" ? " on" : "")} aria-pressed={g.mode === "local"} onClick={() => g.mode !== "local" && void newGame({ mode: "local", color: "w", strength: null, tc: g.tc.id })}>Two players</button>
        </div>

        <section className="pgroup">
          <p className="status" role="status">
            {over ? <strong>{resultText(g)}</strong> : viewing ? <>Viewing move {view}. <button className="textlink" onClick={() => setView(null)}>Back to game</button></> :
              g.mode === "bot" ? (botTurn ? "Bobby is thinking…" : "Your move") : `${turn === "w" ? "White" : "Black"} to move`}
          </p>
          {g.mode === "bot" && !over && g.botElo ? <p className="muted small">{describeStrength(g.botElo)}</p> : null}
          {opening ? <p className="opening-name small" data-testid="opening-name"><strong>{opening.eco}</strong> {opening.name}</p> : null}
          {showEval ? (
            <div className="evline" aria-live="off">
              <strong>{fmtEval(ev?.fen === fen ? ev.e : null)}</strong> <span className="muted">{ev?.fen === fen ? ev.pv : "thinking…"}</span>
            </div>
          ) : null}
          {focused ? <p className="focus-note" data-testid="focus-note"><span className="dot" aria-hidden="true" />Focus mode: eval and coach return when the game ends.</p> : null}
          {hint && hint.fen === fen ? <p className="hint">Hint {hint.level}/3: {hint.text}</p> : null}
        </section>

        <MoveList sans={sans} current={viewing ? view! : sans.length} onJump={(p) => setView(p >= sans.length ? null : p)} />

        {progress && progress.stage !== "done" ? (
          <p className="muted small">Reviewing your game: {progress.stage === "analysing" ? `${progress.done}/${progress.total} positions` : progress.stage}…</p>
        ) : null}
        {over && progress?.stage === "done" ? <button className="btn btn-primary btn-wide" onClick={() => go(`/review/${g.id}`)}>Open review</button> : null}

        {!over ? (
          <div className="actions">
            {s.hints ? <button className="btn" onClick={() => void askHint()} disabled={botTurn} title="Hint (H). Press again for more.">Hint</button> : null}
            {s.takebacks ? <button className="btn" onClick={takeback} disabled={!g.moves.length || thinking} title="Take back (U)">Take back</button> : null}
            <button className="btn" onClick={() => void offerDraw()} disabled={!g.moves.length}>Draw</button>
            <button className="btn btn-danger" onClick={resign} disabled={!g.moves.length}>Resign</button>
          </div>
        ) : null}
        <button className={"btn btn-wide" + (over ? " btn-primary" : " btn-soft")} onClick={() => setShowNew(true)}>New game</button>

        <form className="typed" onSubmit={typedMove}>
          <label className="sr-only" htmlFor="typed">Type a move</label>
          <input id="typed" value={moveText} onChange={(e) => setMoveText(e.target.value)} placeholder="Type a move (e4, Nf3, e7e8q)" autoComplete="off" spellCheck={false} disabled={over || botTurn} />
        </form>

        <div className="opts">
          <button className="opt" onClick={() => setFlipped((f) => !f)} title="Flip board (F)">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M7 4v16M7 20l-3-3M7 20l3-3M17 20V4M17 4l-3 3M17 4l3 3" /></svg>
            Flip board
          </button>
          {g.mode === "local" ? <label className="switch"><input type="checkbox" checked={autoFlip} onChange={(e) => setAutoFlip(e.target.checked)} /><span className="track" aria-hidden="true" />Auto-flip</label> : null}
          <label className="switch"><input type="checkbox" checked={s.focusMode} onChange={(e) => settings.set({ focusMode: e.target.checked })} /><span className="track" aria-hidden="true" />Focus mode</label>
        </div>
      </aside>

      {!coachOpen ? <CoachRail onOpen={() => setCoachPref(true)} /> : null}
      <CoachDrawer hidden={!coachOpen} onClose={inGame ? () => setCoachPref(false) : undefined} fen={fen} board={cb}
        locked={focused ? "Focus mode is on, so Bobby stays quiet until the game ends. Turn it off in the panel to chat now." : undefined}
        summary={over && g.moves.length ? { gameId: g.id, pending: !!progress && progress.stage !== "done" } : null} />
      {risky ? (
        <Dialog title="Wait, are you sure?" onClose={() => setRisky(null)}>
          <div className="form safety">
            <p className="safety-warn"><span aria-hidden="true">⚠</span> {risky.warn.text}</p>
            <p className="muted small">The red arrow on the board shows how. The safety net only checks for pieces left hanging and mate in one; you can turn it off in Settings.</p>
            <div className="btnrow">
              <button className="btn btn-primary" onClick={() => setRisky(null)} data-testid="safety-cancel">Pick another move</button>
              <button className="btn" onClick={() => { const u = risky.uci; setRisky(null); if (g) commit(g, u); }} data-testid="safety-play">Play it anyway</button>
            </div>
          </div>
        </Dialog>
      ) : null}
      {showNew ? <NewGameDialog cur={g} onClose={() => setShowNew(false)} onStart={(o) => { setShowNew(false); void newGame(o); }} /> : null}
      {showIO ? <IODialog g={g} fen={fen} onClose={() => setShowIO(false)} onLoad={(o) => { setShowIO(false); void newGame({ mode: g.mode, color: g.playerColor, strength: g.adaptive ? null : g.botElo, tc: "none", ...o }); }} copy={copy} /> : null}
    </div>
  );
}

async function freshBotGame(color: Color | "random", strength: number | null, tc: string, startFen?: string, moves?: string[]): Promise<LiveGame> {
  const pc: Color = color === "random" ? (Math.random() < 0.5 ? "w" : "b") : color;
  let elo = strength;
  if (elo === null) {
    const profile = await ensureProfile();
    // Rating-based target + your manual offset + today's level step (see lib/progress.ts).
    const daily = (await todaysProgression().catch(() => null))?.offset ?? 0;
    elo = await py.bot_target_rating(profile, settings.get().strengthOffset + daily).catch(() => Math.round(profile.rating + daily));
  }
  return newLiveGame({ mode: "bot", playerColor: pc, botElo: elo, adaptive: strength === null, tc: TIME_CONTROLS.find((t) => t.id === tc) ?? TIME_CONTROLS[0], startFen, moves });
}

const Ico = ({ d }: { d: string }) => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={d} /></svg>
);

function resultText(g: LiveGame) {
  const draw = g.result === "1/2-1/2";
  if (g.mode === "local") return draw ? `Draw (${g.reason})` : `${g.result === "1-0" ? "White" : "Black"} wins (${g.reason})`;
  if (draw) return `Draw (${g.reason})`;
  const won = (g.result === "1-0") === (g.playerColor === "w");
  return `${won ? "You win" : "Bobby wins"} (${g.reason})`;
}

function NewGameDialog({ cur, onClose, onStart }: { cur: LiveGame; onClose: () => void; onStart: (o: { mode: "bot" | "local"; color: Color | "random"; strength: number | null; tc: string }) => void }) {
  const [mode, setMode] = useState(cur.mode);
  const [color, setColor] = useState<Color | "random">(cur.playerColor);
  const [strength, setStrength] = useState<number | null>(cur.adaptive ? null : cur.botElo);
  const [tc, setTc] = useState(cur.tc.id);
  return (
    <Dialog title="New game" onClose={onClose}>
      <div className="form">
        <label>Opponent <Select value={mode} onChange={(e) => setMode(e.target.value as "bot" | "local")}><option value="bot">Bobby</option><option value="local">Two players, one screen</option></Select></label>
        {mode === "bot" ? <>
          <label>Your colour <Select value={color} onChange={(e) => setColor(e.target.value as Color | "random")}><option value="w">White</option><option value="b">Black</option><option value="random">Random</option></Select></label>
          <label>Bobby's strength <Select value={strength ?? "adaptive"} onChange={(e) => setStrength(e.target.value === "adaptive" ? null : +e.target.value)}>
            <option value="adaptive">Adaptive (your level)</option>{FIXED_STRENGTHS.map((x) => <option key={x} value={x}>About {x}</option>)}</Select></label>
        </> : null}
        <label>Time <Select value={tc} onChange={(e) => setTc(e.target.value)}>{TIME_CONTROLS.map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}</Select></label>
        <div className="btnrow"><button className="btn btn-primary" onClick={() => onStart({ mode, color, strength, tc })}>Start</button><button className="btn" onClick={onClose}>Cancel</button></div>
      </div>
    </Dialog>
  );
}

function IODialog({ g, fen, onClose, onLoad, copy }: { g: LiveGame; fen: string; onClose: () => void; onLoad: (o: { startFen: string; moves: string[] }) => void; copy: (t: string, w: string) => void }) {
  const [txt, setTxt] = useState("");
  const [err, setErr] = useState("");
  const parse = (): { startFen: string; moves: string[]; pgn?: string } | null => {
    const t = txt.trim();
    if (!t) return null;
    try { const c = new Chess(t); return { startFen: c.fen(), moves: [] }; } catch { /* not a FEN */ }
    try {
      const c = new Chess(); c.loadPgn(t);
      const h = c.history({ verbose: true });
      return { startFen: h[0]?.before ?? c.fen(), moves: h.map(uciOf), pgn: t };
    } catch (e) { setErr("Not a valid FEN or PGN: " + (e as Error).message.slice(0, 100)); return null; }
  };
  const review = async () => {
    const p = parse(); if (!p?.pgn) { setErr("Paste a PGN to review."); return; }
    const c = new Chess(); c.loadPgn(p.pgn);
    const id = "imp-" + Date.now().toString(36);
    const res = (c.getHeaders().Result as GameRow["result"]) || "*";
    await store.saveGame({ id, pgn: p.pgn, result: res, mode: "local", playerColor: "w", botRating: null, date: new Date().toISOString(), startFen: p.startFen, timeControl: "none", termination: null, analysed: false });
    onClose(); go(`/review/${id}`);
  };
  const download = () => {
    const a = Object.assign(document.createElement("a"), { href: URL.createObjectURL(new Blob([pgnOf(g)], { type: "application/x-chess-pgn" })), download: `bobby-${g.id}.pgn` });
    a.click(); URL.revokeObjectURL(a.href);
  };
  return (
    <Dialog title="PGN and FEN" onClose={onClose} wide>
      <div className="form">
        <div className="btnrow">
          <button className="btn" onClick={() => copy(fen, "FEN")}>Copy FEN</button>
          <button className="btn" onClick={() => copy(pgnOf(g), "PGN")}>Copy PGN</button>
          <button className="btn" onClick={download}>Download PGN</button>
        </div>
        <label htmlFor="io-t">Import</label>
        <textarea id="io-t" rows={6} value={txt} onChange={(e) => { setTxt(e.target.value); setErr(""); }} placeholder="Paste a FEN or PGN" spellCheck={false} />
        {err ? <p className="err">{err}</p> : null}
        <div className="btnrow">
          <button className="btn btn-primary" onClick={() => { const p = parse(); if (p) onLoad(p); }}>Play from here</button>
          <button className="btn" onClick={() => void review()}>Review PGN</button>
        </div>
      </div>
    </Dialog>
  );
}
