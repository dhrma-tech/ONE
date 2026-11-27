// "Ask Bobby": a rule-based coach (no AI). Five questions about the position, a post-game summary and a progress
// report. Answers come from the engine + tactic detectors, in plain words, and can draw on the board.
import { useEffect, useRef, useState } from "react";
import { askPosition, gameSummaryFacts, practiceLinks, progressFacts, QUESTIONS, summarize, type CoachAnswer, type QuestionId } from "../lib/coach";
import type { CoachBoard } from "../lib/useCoachBoard";
import { speak, stopSpeaking } from "../lib/tts";
import { go } from "../lib/router";

interface Msg { id: number; role: "you" | "bobby"; text: string; answer?: CoachAnswer; summary?: boolean }

/** Ask Bobby's logo: the crystal knight (public/coach-knight*.png, transparent background). */
const Knight = ({ size = 96 }: { size?: number }) => (
  <img className="coach-knight" src={size > 96 ? "./coach-knight.png" : "./coach-knight-96.png"} alt="" width={size} height={size} draggable={false} />
);

const Chart = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><path d="M5 20V11M12 20V5M19 20v-7" /></svg>
);

/** Slim right-hand rail shown while the coach card is closed. */
export function CoachRail({ onOpen }: { onOpen: () => void }) {
  return (
    <aside className="rail coach-rail" aria-label="Ask Bobby (closed)">
      <button className="rail-btn accent" onClick={onOpen} aria-label="Open Ask Bobby" title="Open Ask Bobby"><Knight /></button>
    </aside>
  );
}

/** "Show me" player for a line drawn on the board. */
function LineControls({ cb }: { cb: CoachBoard }) {
  const p = cb.play;
  if (!p) return null;
  return (
    <div className="line-play" role="group" aria-label="Showing a line on the board">
      <button className="chip" onClick={() => cb.step(-1)} disabled={p.i === 0} aria-label="Previous move">‹</button>
      <span className="line-sans">{p.sans.map((s, i) => <b key={i} className={i === p.i - 1 ? "on" : i < p.i ? "done" : ""}>{s}</b>)}</span>
      <button className="chip" onClick={() => cb.step(1)} disabled={p.i >= p.fens.length - 1} aria-label="Next move">›</button>
      <button className="chip" onClick={cb.stop}>Back to game</button>
    </div>
  );
}

/**
 * Permanent coach card (right column of Play and Review). `locked` shows a placeholder instead, e.g. in focus mode.
 * `summary` adds "Summarize my game" once a finished game has been analysed (`pending` while the analysis runs).
 * `board` lets answers draw arrows on the page's board and play lines through ("Show me").
 */
export function CoachDrawer({ fen, locked, summary, onClose, hidden, board }: {
  fen: string; locked?: string; summary?: { gameId: string; pending?: boolean } | null;
  /** When given, the header shows a close button (Play uses this during a game). */
  onClose?: () => void;
  /** Kept mounted while hidden so the conversation survives closing and reopening. */
  hidden?: boolean;
  board?: CoachBoard;
}) {
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [busy, setBusy] = useState<false | "position" | "summary">(false);
  const [summarised, setSummarised] = useState<string | null>(null);
  const [shown, setShown] = useState<number | null>(null);
  const list = useRef<HTMLDivElement>(null);
  const nextId = useRef(1);
  useEffect(() => () => stopSpeaking(), []);
  useEffect(() => { list.current?.scrollTo({ top: list.current.scrollHeight, behavior: "smooth" }); }, [msgs, busy]);
  useEffect(() => { setShown(null); }, [fen]);

  const run = async (label: string, kind: "position" | "summary", get: () => Promise<CoachAnswer>, isSummary = false) => {
    if (busy) return;
    const qid = nextId.current++;
    setMsgs((m) => [...m, { id: qid, role: "you", text: label }]); setBusy(kind);
    let a: CoachAnswer;
    try { a = await get(); } catch (e) { a = { text: "", error: (e as Error).message }; }
    const id = nextId.current++;
    setMsgs((m) => [...m, { id, role: "bobby", text: a.text, answer: a, summary: isSummary }]);
    if (a.viz && board) { board.setViz(a.viz); setShown(id); }
    setBusy(false);
  };
  const ask = (q: (typeof QUESTIONS)[number]) => void run(q.label, "position", () => askPosition(fen, q.id as QuestionId));
  const summarizeGame = () => {
    if (!summary || summary.pending) return;
    void run("Summarize my game", "summary", async () => {
      const facts = await gameSummaryFacts(summary.gameId);
      if (!facts) throw new Error("This game has not been analysed yet.");
      const a = await summarize(facts, "review");
      setSummarised(summary.gameId);
      return a;
    }, true);
  };
  const improving = () => void run("How am I improving?", "summary", async () => summarize(await progressFacts(), "progress"), true);
  const fresh = summary && summarised !== summary.gameId;

  return (
    <aside className={"drawer coach-card" + (locked ? " locked" : "")} aria-label="Ask Bobby" hidden={hidden}>
      <div className="drawer-h">
        <span className="coach-mark" aria-hidden="true"><Knight /></span><h2>Ask Bobby</h2>
        {onClose ? <button className="icon-btn coach-x" onClick={onClose} aria-label="Close Ask Bobby" title="Close (reopens after the game)">×</button> : null}
      </div>
      {locked ? (
        <div className="coach-locked" data-testid="coach-locked">
          <span className="coach-lock-ico" aria-hidden="true"><Knight size={256} /></span>
          <p><strong>Coach is resting</strong></p>
          <p className="muted small">{locked}</p>
        </div>
      ) : <>
      <div className="chat" ref={list} aria-live="polite">
        {fresh ? (
          <button className="summary-cta" onClick={summarizeGame} disabled={!!summary.pending || !!busy} data-testid="summary-btn">
            <span className="summary-ico"><Chart /></span>
            <span><strong>{summary.pending ? "Analysing your game…" : "Summarize my game"}</strong>
              <small>Your stats, where you slipped, and what to work on. In plain words.</small></span>
          </button>
        ) : null}
        {!msgs.length && !fresh ? <p className="muted small coach-intro">Pick a question below. Bobby checks the position with the engine and explains it in plain words, with arrows on the board.</p> : null}
        {msgs.map((m) => {
          const a = m.answer;
          const links = practiceLinks(a?.tags);
          const drawable = !!a?.viz && !!board && (a.viz.arrows.length > 0 || Object.keys(a.viz.squares).length > 0);
          return (
            <div key={m.id} className={"msg " + m.role + (m.summary ? " summary" : "") + (shown === m.id ? " shown" : "")}>
              {m.text ? <p>{m.text}</p> : null}
              {a?.error ? <p className="err small">{a.error}</p> : null}
              {m.role === "bobby" && (drawable || links.length || m.text) ? (
                <div className="msg-f">
                  {drawable ? (
                    <button className="textlink" onClick={() => { board?.stop(); board?.setViz(a?.viz ?? null); setShown(m.id); }}>{shown === m.id ? "On the board" : "Show on board"}</button>
                  ) : null}
                  {a?.viz?.line && board ? <button className="textlink" onClick={() => board.showLine(a.viz?.line)} data-testid="show-me">Show me ▶</button> : null}
                  {links.map((l) => <button key={l.href} className="textlink" onClick={() => go(l.href)}>{l.label}</button>)}
                  {m.text ? <button className="textlink" onClick={() => speak(m.text, true)}>Speak</button> : null}
                </div>
              ) : null}
            </div>
          );
        })}
        {busy ? <p className="muted small think">{busy === "summary" ? "Bobby is going through your games…" : "Bobby is checking the position…"}</p> : null}
      </div>
      {board ? <LineControls cb={board} /> : null}
      <div className="questions" role="group" aria-label="Questions">
        {QUESTIONS.map((q) => <button key={q.id} className="qbtn" disabled={!!busy} onClick={() => ask(q)}>{q.label}</button>)}
        {summary && !fresh ? <button className="qbtn accent" disabled={!!busy} onClick={summarizeGame}>Summarize my game</button> : null}
        <button className="qbtn accent" disabled={!!busy} onClick={improving}>How am I improving?</button>
      </div>
      </>}
    </aside>
  );
}
