// Learn: course lessons by section with progress; lessons open inline on the board (#/learn?l=<id>).
import { useCallback, useEffect, useState } from "react";
import { Chess } from "chess.js";
import { Board } from "../components/Board";
import { toast } from "../components/Toast";
import { py } from "../bridge/py";
import { db, store, type LessonProgressRow } from "../bridge/storage";
import { data, lessonForTag, sections, type Lesson, type LessonMeta } from "../lib/data";
import { tryMove, uciOf } from "../lib/chess";
import { markActivity } from "../lib/progress";
import { go, useRoute } from "../lib/router";
import { useSettings } from "../lib/useSettings";

interface LP extends LessonProgressRow { step?: number; done?: boolean; completedAt?: string; mistakes?: number; steps?: number }

/** Adaptive next lesson: a not-yet-done lesson for the top weakness tags, else the first unfinished lesson in course order. */
export async function nextLesson(index: LessonMeta[], progress: Map<string, LP>): Promise<{ lesson: LessonMeta; why: string } | null> {
  const w = (await store.getWeakness()) as { tags?: Record<string, { score?: number }> } | null;
  const tags = Object.entries(w?.tags ?? {}).filter(([t]) => !t.startsWith("phase_")).sort((a, b) => (b[1].score ?? 0) - (a[1].score ?? 0)).map(([t]) => t);
  for (const t of tags.slice(0, 5)) {
    const id = lessonForTag(t);
    const l = id ? index.find((x) => x.id === id) : undefined;
    if (l && !progress.get(l.id)?.done) return { lesson: l, why: `Your games show ${t.replace(/_/g, " ")} mistakes.` };
  }
  const profile = await store.getProfile();
  const ordered = [...index].sort((a, b) => a.order - b.order);
  // Players who already know the basics skip ahead to tactics on their first visit.
  const skipBasics = profile && ["basic", "casual", "club"].includes(String(profile.level)) && ![...progress.values()].some((p) => p.done);
  const pool = skipBasics ? ordered.filter((l) => !["Basics", "Special moves"].includes(l.section)) : ordered;
  const l = pool.find((x) => !progress.get(x.id)?.done) ?? ordered.find((x) => !progress.get(x.id)?.done);
  return l ? { lesson: l, why: progress.get(l.id)?.step ? "Pick up where you left off." : skipBasics ? "Matched to your level." : "Next in the course." } : null;
}

async function loadProgress() {
  const rows = (await db.lessonProgress.toArray()) as LP[];
  return new Map(rows.filter((r) => !String(r.id).includes(":")).map((r) => [r.id, r]));
}

export function Learn() {
  const route = useRoute();
  const open = route.q.get("l");
  const [index, setIndex] = useState<LessonMeta[] | null>(null);
  const [err, setErr] = useState("");
  const [prog, setProg] = useState<Map<string, LP>>(new Map());
  const [next, setNext] = useState<{ lesson: LessonMeta; why: string } | null>(null);
  const reload = useCallback(async () => {
    const [ix, p] = await Promise.all([data.lessonIndex(), loadProgress()]);
    setIndex(ix); setProg(p); setNext(await nextLesson(ix, p));
  }, []);
  useEffect(() => { reload().catch((e) => setErr((e as Error).message)); }, [reload, open]);

  if (err) return <div className="page empty"><h1>Learn</h1><p className="err">Could not load lessons: {err}</p></div>;
  if (!index) return <div className="loading">Loading lessons…</div>;
  if (open) return <LessonPlayer id={open} key={open} index={index} onExit={() => go("/learn")} />;

  const done = [...prog.values()].filter((p) => p.done).length;
  return (
    <div className="page learn">
      <header className="page-h">
        <h1>Learn</h1>
        <p className="muted">{done} of {index.length} lessons complete.</p>
        <div className="progress" role="progressbar" aria-valuemin={0} aria-valuemax={index.length} aria-valuenow={done}><span style={{ width: `${(done / Math.max(1, index.length)) * 100}%` }} /></div>
      </header>
      {next ? (
        <section className="card next-card" aria-label="Suggested lesson">
          <div><small className="muted">Next for you</small><h2>{next.lesson.title}</h2><p className="muted small">{next.why}</p></div>
          <button className="btn btn-primary" onClick={() => go(`/learn?l=${next.lesson.id}`)}>Start</button>
        </section>
      ) : <section className="card next-card"><div><h2>Course complete</h2><p className="muted small">Keep sharp in Train.</p></div><a className="btn" href="#/train">Train</a></section>}
      {sections(index).map((sec) => (
        <section key={sec.name} className="lsec">
          <h2>{sec.name} <small className="muted">{sec.lessons.filter((l) => prog.get(l.id)?.done).length}/{sec.lessons.length}</small></h2>
          <ul className="lgrid">
            {sec.lessons.map((l) => {
              const p = prog.get(l.id);
              const pct = p?.done ? 100 : Math.round(((p?.step ?? 0) / Math.max(1, l.steps)) * 100);
              return (
                <li key={l.id}>
                  <a className={"lcard" + (p?.done ? " done" : "")} href={`#/learn?l=${l.id}`} data-lesson={l.id}>
                    <span className="lcard-t">{l.title}</span>
                    <small className="muted">{p?.done ? "Done" : pct ? `${pct}%` : `${l.steps} steps`}</small>
                    <span className="lbar"><span style={{ width: pct + "%" }} /></span>
                  </a>
                </li>
              );
            })}
          </ul>
        </section>
      ))}
    </div>
  );
}

function LessonPlayer({ id, index, onExit }: { id: string; index: LessonMeta[]; onExit: () => void }) {
  const s = useSettings();
  const [lesson, setLesson] = useState<Lesson | null>(null);
  const [err, setErr] = useState("");
  const [idx, setIdx] = useState(0);
  const [fen, setFen] = useState("");
  const [feedback, setFeedback] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, setPending] = useState<number | null | undefined>(undefined); // set after a correct answer; null = finished
  const [hint, setHint] = useState(false);
  const [marks, setMarks] = useState<Record<string, string>>({});
  const [last, setLast] = useState<[string, string] | null>(null);
  const [mistakes, setMistakes] = useState(0);
  const [finished, setFinished] = useState(false);
  const [suggest, setSuggest] = useState<{ lesson: LessonMeta; why: string } | null>(null);

  useEffect(() => {
    let live = true;
    (async () => {
      const l = await data.lesson(id);
      const p = (await db.lessonProgress.get(id)) as LP | undefined;
      if (!live) return;
      setLesson(l);
      const start = p && !p.done && typeof p.step === "number" && p.step < l.steps.length ? p.step : 0;
      setIdx(start);
    })().catch((e) => setErr((e as Error).message));
    return () => { live = false; };
  }, [id]);

  const step = lesson?.steps[idx];
  useEffect(() => { if (step) { setFen(step.fen); setFeedback(null); setPending(undefined); setHint(false); setMarks({}); setLast(null); } }, [step]);

  const save = useCallback(async (stepIdx: number, done: boolean) => {
    if (!lesson) return;
    const prev = (await db.lessonProgress.get(lesson.id)) as LP | undefined;
    await db.lessonProgress.put({ ...(prev ?? {}), id: lesson.id, step: stepIdx, steps: lesson.steps.length, done: done || !!prev?.done, mistakes: (prev?.mistakes ?? 0) + 0, ...(done && !prev?.done ? { completedAt: new Date().toISOString() } : {}) });
    if (done && !prev?.done) await markActivity("lessons_done");
  }, [lesson]);

  const check = useCallback(async (answer: string) => {
    if (!lesson || pending !== undefined) return null;
    const r = await py.lesson_check(lesson, idx, answer);
    setFeedback({ ok: r.correct, text: r.feedback });
    if (r.correct) setPending(r.next_index); else setMistakes((m) => m + 1);
    return r;
  }, [lesson, idx, pending]);

  const advance = async () => {
    if (!lesson || pending === undefined) return;
    if (pending === null) {
      await save(lesson.steps.length, true);
      const p = await loadProgress();
      setSuggest(await nextLesson(index, p));
      setFinished(true);
      return;
    }
    await save(pending, false);
    setIdx(pending);
  };

  const onMove = (from: string, to: string, promo?: string) => {
    if (!step || step.type !== "move" || pending !== undefined) return false;
    const c = new Chess(fen);
    const m = tryMove(c, from, to, promo);
    if (!m) return false;
    void check(uciOf(m)).then((r) => { if (r?.correct) { setFen(c.fen()); setLast([from, to]); } });
    return false; // board re-renders from fen when correct
  };
  const onSquare = (sq: string) => {
    if (!step || step.type !== "square" || pending !== undefined) return;
    void check(sq).then((r) => { if (r) setMarks({ [sq]: r.correct ? "rgba(31,107,87,.6)" : "rgba(192,38,45,.5)" }); });
  };

  // keyboard: Enter continues
  useEffect(() => {
    const k = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (e.key !== "Enter" || (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.tagName === "BUTTON"))) return;
      if (step?.type === "info" && pending === undefined) void check("").then(() => undefined);
      else if (pending !== undefined) void advance();
    };
    addEventListener("keydown", k); return () => removeEventListener("keydown", k);
  });

  if (err) return <div className="page empty"><h1>Lesson</h1><p className="err">{err}</p><button className="btn" onClick={onExit}>Back to lessons</button></div>;
  if (!lesson || !step) return <div className="loading">Loading lesson…</div>;
  const turn = fen.split(" ")[1] === "b" ? "b" : "w";
  // Orient from the side that solves the step (the step's starting position), so the board doesn't flip after
  // the student plays their move.
  const orientation = step.type === "move" && step.fen.split(" ")[1] === "b" ? "black" : "white";

  if (finished) {
    return (
      <div className="page lesson-done" data-testid="lesson-complete">
        <h1>Lesson complete: {lesson.title}</h1>
        <p className="muted">{mistakes ? `${mistakes} wrong tries along the way.` : "No wrong answers."}</p>
        <div className="btnrow">
          {suggest ? <button className="btn btn-primary" onClick={() => go(`/learn?l=${suggest.lesson.id}`)}>Next: {suggest.lesson.title}</button> : null}
          <button className="btn" onClick={onExit}>All lessons</button>
          <a className="btn" href="#/">Play a game</a>
        </div>
        {suggest ? <p className="muted small">{suggest.why}</p> : null}
      </div>
    );
  }

  return (
    <div className="play lesson" data-lesson-id={lesson.id} data-step={idx}>
      <div className="play-board">
        <div className="board-row">
          <Board fen={fen} orientation={orientation} movable={step.type === "move" && pending === undefined ? turn : "none"} onMove={onMove}
            onSquare={step.type === "square" ? onSquare : undefined} marks={marks} lastMove={last}
            highlight={hint && step.type === "move" && step.correct[0] ? step.correct[0].slice(0, 2) : null}
            theme={s.boardTheme} pieceSet={s.pieceSet} coordinates={s.coordinates} legalHighlights={s.legalHighlights} label={`Lesson board: ${step.prompt}`} />
        </div>
      </div>
      <aside className="panel" aria-label="Lesson">
        <div className="lesson-h">
          <button className="textlink" onClick={onExit}>← Lessons</button>
          <small className="muted">{lesson.section} · step {idx + 1} of {lesson.steps.length}</small>
        </div>
        <h1 className="panel-h">{lesson.title}</h1>
        <div className="progress" aria-hidden="true"><span style={{ width: `${(idx / lesson.steps.length) * 100}%` }} /></div>
        <p className="prompt" data-testid="lesson-prompt">{step.prompt}</p>
        {step.type === "move" && pending === undefined ? <p className="muted small">Make the move on the board ({turn === "w" ? "White" : "Black"} to play).</p> : null}
        {step.type === "square" && pending === undefined ? <p className="muted small">Click the square on the board.</p> : null}
        {step.type === "quiz" ? (
          <div className="quiz" role="group" aria-label="Answers">
            {(step.options ?? []).map((o) => (
              <button key={o} className={"qopt" + (pending !== undefined && step.correct.map((c) => c.toLowerCase()).includes(o.toLowerCase()) ? " ok" : "")} disabled={pending !== undefined} onClick={() => void check(o)}>{o}</button>
            ))}
          </div>
        ) : null}
        {feedback ? <p className={"fb " + (feedback.ok ? "ok" : "bad")} role="status">{feedback.text}</p> : null}
        {hint && step.hint && pending === undefined ? <p className="hint">{step.hint}</p> : null}
        <div className="btnrow">
          {step.type === "info" && pending === undefined ? <button className="btn btn-primary" onClick={() => void check("")}>Continue</button> : null}
          {pending !== undefined ? <button className="btn btn-primary" onClick={() => void advance()} data-testid="lesson-continue">{pending === null ? "Finish lesson" : "Continue"}</button> : null}
          {step.type !== "info" && pending === undefined && s.hints ? <button className="btn" onClick={() => setHint(true)} disabled={hint}>Hint</button> : null}
        </div>
        <button className="textlink" onClick={() => { if (idx > 0) setIdx(idx - 1); else toast("This is the first step."); }}>Previous step</button>
      </aside>
    </div>
  );
}
