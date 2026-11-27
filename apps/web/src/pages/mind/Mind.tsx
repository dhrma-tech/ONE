import { lazy, useState } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "@/data/db";
import { repo } from "@/data/repo";
import { SectionLayout } from "@/modules/section";
import { FocusStrip } from "@/modules/focus";
import { Library } from "@/modules/library/Library";
import { SectionAnalytics, countBy, sumBy } from "@/modules/analytics";
import { ladderTarget } from "@/domain/mind";
import { pretty, today, weekStart } from "@/lib/dates";
import { award } from "@/services/xp";
import { useSettings, useTargets } from "@/services/settings";
import { Button, Card, Checklist, Chip, Empty, Input, Select, StatCard, toast } from "@/ui";
import { Cube, MentalMath, Palace } from "./Locked";

const Chess = lazy(() => import("./Chess"));
const Meditate = lazy(() => import("./Meditate"));
const Memory = lazy(() => import("./Memory"));
const Watch = lazy(() => import("@/modules/library/Watch"));

const PHONE_RULES = [
  "Instagram + YouTube uninstalled",
  "Phone in another room during Blocks 1-2",
  "Charging outside arm's reach",
  "No phone in bed",
  "15 min of book at 11:45 PM",
  "10-min boredom walk",
];

function Focus() {
  const t = useTargets();
  const data = useLiveQuery(async () => {
    const ws = weekStart(today());
    const sessions = (await db.t("focus_sessions").toArray()).filter((s) => !s.deleted_at && s.date >= ws);
    const ladder = (await db.t("stuck_ladder").toArray()).filter((r) => !r.deleted_at);
    const probs = (await db.t("problem_log").toArray()).filter((p) => !p.deleted_at && p.date >= ws);
    const reviews = (await db.t("daily_reviews").toArray()).filter((r) => !r.deleted_at && r.date >= ws);
    const stuck = Math.max(0, ...probs.map((p) => p.stuck_min ?? 0), ...reviews.map((r) => r.stuck_min ?? 0));
    return { longest: Math.max(0, ...sessions.filter((s) => s.phone_free).map((s) => s.minutes)), target: ladderTarget(ladder, ws), stuck, ladder: ladder.sort((a, b) => (a.week_start < b.week_start ? -1 : 1)) };
  }, []);
  const [rules, setRules] = useState<Record<string, boolean>>(() => {
    try {
      return JSON.parse(localStorage.getItem(`one.phone.${today()}`) || "{}");
    } catch {
      return {};
    }
  });
  const toggle = (k: string, v: boolean) => {
    const n = { ...rules, [k]: v };
    setRules(n);
    try {
      localStorage.setItem(`one.phone.${today()}`, JSON.stringify(n));
    } catch {
      /* ignore */
    }
  };
  return (
    <div className="bento">
      <Card className="span-6" eyebrow={`Start at ${t.focus_block_min} min, +5 a week, up to 50`} title="Phone-free block">
        <FocusStrip block1Target={t.block1_min} />
        <div className="cols-2" style={{ marginTop: 16 }}>
          <StatCard label="Longest phone-free (week)" value={data?.longest ?? 0} unit="min" />
          <StatCard label="Stuck this week" value={data?.stuck ?? 0} unit={data?.target ? `/${data.target} min` : "min"} />
        </div>
      </Card>
      <Card className="span-6" eyebrow="Always visible" title="Stuck protocol" edge>
        <ol className="text small" style={{ paddingLeft: 18, margin: 0, lineHeight: 1.8 }}>
          <li>Restate the problem in one line.</li>
          <li>Write what you know and what you tried.</li>
          <li>Take the smallest next step.</li>
          <li>Try 3 approaches before asking.</li>
          <li>At least 25 minutes before any AI help. Then ask "why is this wrong", not "fix it".</li>
          <li>Log the stuck minutes.</li>
        </ol>
      </Card>
      <Card className="span-6" eyebrow="15 → 20 → 25 → 30 → 45" title="Stuck ladder">
        <ul className="list">
          {(data?.ladder ?? []).map((r) => (
            <li key={r.id}>
              <span className="small grow">Week of {pretty(r.week_start)}</span>
              <Input aria-label="Target minutes" inputMode="numeric" defaultValue={r.target_min} onBlur={(e) => void repo.patch("stuck_ladder", r.id, { target_min: Number(e.target.value) || r.target_min })} style={{ width: 80 }} />
              <span className="xs muted">min</span>
              {r.week_start === weekStart(today()) ? <Chip on>this week</Chip> : null}
            </li>
          ))}
        </ul>
      </Card>
      <Card className="span-6" eyebrow="Today" title="Phone rules">
        <Checklist items={PHONE_RULES.map((r) => ({ id: r, label: r, done: !!rules[r] }))} onToggle={toggle} />
      </Card>
    </div>
  );
}

function Shelf() {
  const books = useLiveQuery(async () => (await db.t("books").toArray()).filter((b) => !b.deleted_at), []);
  const sessions = useLiveQuery(async () => (await db.t("reading_sessions").toArray()).filter((s) => !s.deleted_at).sort((a, b) => (a.date < b.date ? 1 : -1)), []);
  const [title, setTitle] = useState("");
  const [author, setAuthor] = useState("");
  const [log, setLog] = useState({ book: "", minutes: "15", pages: "", lesson: "" });
  const reading = (books ?? []).filter((b) => b.status === "reading");
  return (
    <div className="bento">
      <Card className="span-6" title="Log a session" eyebrow="15 minutes of book instead of the phone">
        {reading.length ? (
          <form
            className="stack"
            onSubmit={async (e) => {
              e.preventDefault();
              const book = log.book || reading[0].id;
              const row = await repo.insert("reading_sessions", { book_id: book, date: today(), minutes: Number(log.minutes) || null, pages: Number(log.pages) || null, lesson: log.lesson || null });
              await award("reading_session", "mind", "reading_sessions", row.id, { quiet: true });
              setLog({ ...log, pages: "", lesson: "" });
              toast.ok("Logged.");
            }}
          >
            <Select label="Book" value={log.book || reading[0].id} onChange={(e) => setLog({ ...log, book: e.target.value })} options={reading.map((b) => ({ value: b.id, label: b.title }))} />
            <div className="form-grid">
              <Input label="Minutes" inputMode="numeric" value={log.minutes} onChange={(e) => setLog({ ...log, minutes: e.target.value })} />
              <Input label="Pages" inputMode="numeric" value={log.pages} onChange={(e) => setLog({ ...log, pages: e.target.value })} />
            </div>
            <Input label="One-line lesson" value={log.lesson} onChange={(e) => setLog({ ...log, lesson: e.target.value })} />
            <Button type="submit" variant="accent">Log</Button>
          </form>
        ) : (
          <Empty glyph="❏">Nothing marked "reading". Pick a book below.</Empty>
        )}
      </Card>
      <Card className="span-6" title="Shelf">
        <form className="row wrap" onSubmit={(e) => { e.preventDefault(); if (title.trim()) void repo.insert("books", { title: title.trim(), author: author || null }); setTitle(""); setAuthor(""); }}>
          <Input aria-label="Title" placeholder="Title" value={title} onChange={(e) => setTitle(e.target.value)} />
          <Input aria-label="Author" placeholder="Author" value={author} onChange={(e) => setAuthor(e.target.value)} />
          <Button type="submit" icon="plus">Add</Button>
        </form>
        <ul className="list" style={{ marginTop: 8 }}>
          {(books ?? []).map((b) => (
            <li key={b.id}>
              <span className="stack tight grow"><span className="small">{b.title}</span><span className="xs muted">{b.author}</span></span>
              <Select
                aria-label="Status"
                value={b.status}
                onChange={async (e) => {
                  const s = e.target.value;
                  await repo.patch("books", b.id, { status: s, ...(s === "reading" && !b.started_at ? { started_at: today() } : {}), ...(s === "finished" ? { finished_at: today() } : {}) });
                  if (s === "finished") await award("book_finished", "mind", "books", b.id);
                }}
                options={["queued", "reading", "finished"].map((s) => ({ value: s, label: s }))}
                style={{ width: 120, minHeight: 30 }}
              />
            </li>
          ))}
        </ul>
      </Card>
      <Card className="span-12" title="Lessons" eyebrow="Mirrored to Obsidian">
        <ul className="list">
          {(sessions ?? []).slice(0, 15).map((s) => (
            <li key={s.id}>
              <span className="mono xs" style={{ width: 90 }}>{s.date}</span>
              <span className="small grow text">{s.lesson ?? <span className="muted">no lesson</span>}</span>
              <span className="xs muted">{(books ?? []).find((b) => b.id === s.book_id)?.title}</span>
            </li>
          ))}
        </ul>
        {!sessions?.length ? <Empty>No sessions yet.</Empty> : null}
      </Card>
    </div>
  );
}

function Analytics() {
  return (
    <SectionAnalytics
      section="mind"
      stats={[
        { label: "Chess rapid", value: (c) => [...c.sum.dates].reverse().map((d) => c.sum.facts.get(d)!.rapid).find((r) => r !== null) ?? null, delta: (c) => { const r = c.days.map((d) => d.rapid).filter((x): x is number => x !== null); return r.length > 1 ? r[r.length - 1] - r[0] : null; } },
        { label: "Chess events", value: (c) => sumBy(c.days, (d) => d.chess_events) },
        { label: "Meditation (week)", value: (c) => sumBy(c.week, (d) => d.meditation_min), unit: "min" },
        { label: "Longest focus", value: (c) => Math.max(0, ...c.days.map((d) => d.phone_free_max)), unit: "min" },
        { label: "Flashcard days", value: (c) => countBy(c.days, (d) => d.flashcard_reviews > 0) },
      ]}
      trend={{ label: "Chess.com rapid rating", kind: "line", value: (ds) => [...ds].reverse().map((d) => d.rapid).find((r) => r !== null) ?? null }}
      lag={[
        { label: "Meditation", actual: (c) => countBy(c.week, (d) => d.meditation_min >= 5), target: (c) => Math.min(5, c.week.length), unit: " days", quip: "Breathe, astronaut." },
        { label: "Flashcards", actual: (c) => countBy(c.week, (d) => d.flashcard_reviews > 0), target: (c) => Math.min(5, c.week.length), unit: " days", quip: "Ten minutes. That's it." },
      ]}
    />
  );
}

export default function Mind() {
  const s = useSettings();
  const mods = (s?.modules ?? {}) as { cube?: boolean; math?: boolean; palace?: boolean };
  const tabs = [
    { id: "chess", label: "Chess" },
    { id: "meditate", label: "Meditate" },
    { id: "library", label: "Library" },
    { id: "focus", label: "Focus" },
    { id: "memory", label: "Memory" },
    { id: "reading", label: "Reading" },
    ...(mods.cube ? [{ id: "cube", label: "Cube" }] : []),
    ...(mods.math ? [{ id: "math", label: "Math" }] : []),
    ...(mods.palace ? [{ id: "palace", label: "Palace" }] : []),
    { id: "analytics", label: "Analytics" },
  ];
  return (
    <SectionLayout section="mind" tabs={tabs}>
      <Routes>
        <Route index element={<Navigate to="chess" replace />} />
        <Route path="chess" element={<Chess />} />
        <Route path="meditate" element={<Meditate />} />
        <Route path="library" element={<Library section="mind" suggestedTopics={["Chess", "Meditation", "Philosophy", "Mindset & discipline", "Focus & memory science"]} />} />
        <Route path="library/watch/:videoId" element={<Watch />} />
        <Route path="focus" element={<Focus />} />
        <Route path="memory" element={<Memory />} />
        <Route path="reading" element={<Shelf />} />
        <Route path="cube" element={mods.cube ? <Cube /> : <Navigate to="/settings/modules" replace />} />
        <Route path="math" element={mods.math ? <MentalMath /> : <Navigate to="/settings/modules" replace />} />
        <Route path="palace" element={mods.palace ? <Palace /> : <Navigate to="/settings/modules" replace />} />
        <Route path="analytics" element={<Analytics />} />
        <Route path="*" element={<Navigate to="chess" replace />} />
      </Routes>
    </SectionLayout>
  );
}
