import { lazy, useMemo, useState } from "react";
import { Navigate, Route, Routes, useNavigate } from "react-router-dom";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "@/data/db";
import { repo } from "@/data/repo";
import { SectionLayout } from "@/modules/section";
import { Library } from "@/modules/library/Library";
import { SectionAnalytics, countBy, sumBy } from "@/modules/analytics";
import { LADDER, ladderRung, parseSkills, topSkills } from "@/domain/persona";
import { pretty, today, weekStart } from "@/lib/dates";
import { bumpPersona } from "@/services/log";
import { useProfile } from "@/services/settings";
import { award } from "@/services/xp";
import { Button, Card, Checklist, Chip, Empty, IconButton, Input, Pager, paginate, Select, StatCard, toast } from "@/ui";

const Speak = lazy(() => import("./Speak"));
const Connections = lazy(() => import("./Connections"));
const Compose = lazy(() => import("./Compose"));
const Watch = lazy(() => import("@/modules/library/Watch"));
const live = <T extends { deleted_at: string | null }>(x: T[]) => x.filter((r) => !r.deleted_at);

const TABS = [
  { id: "speak", label: "Speak" },
  { id: "daily", label: "Daily" },
  { id: "connections", label: "Connections" },
  { id: "compose", label: "Compose" },
  { id: "ideas", label: "Ideas" },
  { id: "x-follows", label: "X Follows" },
  { id: "intel", label: "Market Intel" },
  { id: "presence", label: "Presence" },
  { id: "library", label: "Library" },
  { id: "analytics", label: "Analytics" },
];

function Daily() {
  const d = today();
  const p = useProfile();
  const row = useLiveQuery(async () => live(await db.t("persona_daily").where("date").equals(d).toArray())[0] ?? null, [d]);
  const rung = row?.ladder_rung ?? ladderRung(p?.lock_in_start_date ?? null, d);
  const counters: [Parameters<typeof bumpPersona>[0], string, number][] = [
    ["english_min", "English minutes", 5],
    ["conversations_started", "Conversations started", 1],
    ["real_conversations", "Real conversations", 1],
    ["calls_answered", "Calls answered (≤ 3 rings)", 1],
    ["calls_made", "Calls made", 1],
  ];
  return (
    <div className="bento">
      <Card className="span-8" title="Today" eyebrow="Big buttons. +1 and move on.">
        <div className="stack">
          {counters.map(([k, label, step]) => (
            <div key={k} className="counter">
              <span className="stack tight"><span className="micro">{label}</span><span className="v">{row?.[k] ?? 0}</span></span>
              <div className="row">
                <Button size="lg" variant="ghost" onClick={() => void bumpPersona(k, -step)} aria-label={`Minus ${step} ${label}`}>−</Button>
                <Button size="lg" variant="accent" onClick={() => void bumpPersona(k, step)} aria-label={`Plus ${step} ${label}`}>+{step}</Button>
              </div>
            </div>
          ))}
        </div>
      </Card>
      <Card className="span-4" title="Extroversion ladder" eyebrow={`Rung ${rung}`}>
        <ol className="text small" style={{ paddingLeft: 18, margin: 0, lineHeight: 1.9 }}>
          {LADDER.map((l, i) => <li key={l} style={{ color: i + 1 === rung ? "var(--accent)" : i + 1 < rung ? "var(--muted-foreground)" : undefined }}>{l}</li>)}
        </ol>
        <Select aria-label="Set rung" value={String(rung)} onChange={(e) => void repo.upsertBy("persona_daily", { date: d }, { ladder_rung: Number(e.target.value) })} options={[1, 2, 3, 4].map((n) => ({ value: String(n), label: `Rung ${n}` }))} style={{ marginTop: 12 }} />
        <hr className="dash" />
        <p className="xs muted text">Daily protocol (~40 min): 10 min narration · 10 min shadowing · 10 min of 2-min recordings · talk to Claude in English (outside ONE) · 1 real conversation. Phone drill: answer within 3 rings for 14 days; make 1 call a day.</p>
      </Card>
    </div>
  );
}

const STAGES = ["note", "x", "linkedin", "article"];

function Ideas() {
  const ideas = useLiveQuery(async () => live(await db.t("post_ideas").toArray()).sort((a, b) => (a.created_at < b.created_at ? 1 : -1)), []);
  const [text, setText] = useState("");
  const [page, setPage] = useState(0);
  const nav = useNavigate();
  const { slice, pages } = paginate(ideas ?? [], page, 15);
  return (
    <Card eyebrow="Flywheel: Block 2 note → X post → LinkedIn post → article" title="Ideas bank">
      <form className="row" onSubmit={(e) => { e.preventDefault(); if (text.trim()) void repo.insert("post_ideas", { text: text.trim(), stage: "note" }); setText(""); }}>
        <Input aria-label="Idea" placeholder="An idea worth sharing…" value={text} onChange={(e) => setText(e.target.value)} />
        <Button type="submit" icon="plus">Add</Button>
      </form>
      <div className="kanban" style={{ marginTop: 12 }}>
        {STAGES.map((s) => (
          <div key={s} className="stack">
            <span className="micro">{s} · {(ideas ?? []).filter((i) => i.stage === s).length}</span>
            {slice.filter((i) => i.stage === s).map((i) => (
              <div key={i.id} className="card pad-sm stack tight">
                <span className="small text">{i.text}</span>
                <span className="row">
                  {s !== "article" ? <Button size="sm" onClick={() => void repo.patch("post_ideas", i.id, { stage: STAGES[STAGES.indexOf(s) + 1] })}>Next →</Button> : null}
                  {s === "x" || s === "linkedin" ? <IconButton icon="edit" size="sm" label="Draft it" onClick={() => nav("/persona/compose")} /> : null}
                  <IconButton icon="trash" size="sm" label="Delete idea" onClick={() => void repo.remove("post_ideas", i.id)} />
                </span>
              </div>
            ))}
          </div>
        ))}
      </div>
      {!ideas?.length ? <Empty>No ideas yet. Notes and reading takeaways land here.</Empty> : null}
      <Pager page={page} pages={pages} onPage={setPage} total={ideas?.length} />
    </Card>
  );
}

function XFollows() {
  const rows = useLiveQuery(async () => live(await db.t("x_follows").toArray()).sort((a, b) => ((a.followed_at ?? "") < (b.followed_at ?? "") ? 1 : -1)), []);
  const [f, setF] = useState({ handle: "", name: "", why: "", learn: "" });
  const [page, setPage] = useState(0);
  const [routine, setRoutine] = useState<Record<string, boolean>>({});
  const { slice, pages } = paginate(rows ?? [], page, 15);
  return (
    <div className="bento">
      <Card className="span-4" title="Routine" eyebrow="10 minutes max" edge>
        <Checklist items={["Follow today's accounts (if any)", "Reply thoughtfully to one", "Reply to 2-3 practitioner posts"].map((l) => ({ id: l, label: l, done: !!routine[l] }))} onToggle={(id, v) => setRoutine((r) => ({ ...r, [id]: v }))} />
        <p className="xs muted" style={{ marginTop: 8 }}>Every handle must be real and active. ONE only stores what you add.</p>
      </Card>
      <Card className="span-8" title={`Following · ${rows?.length ?? 0}`}>
        <form className="form-grid" onSubmit={(e) => { e.preventDefault(); const h = f.handle.trim().replace(/^@/, ""); if (!/^\w{1,15}$/.test(h)) return void toast.err("Not a valid X handle."); void repo.upsertBy("x_follows", { handle: h }, { name: f.name || null, why: f.why || null, learn: f.learn || null, followed_at: today() }); setF({ handle: "", name: "", why: "", learn: "" }); }}>
          <Input label="@handle" value={f.handle} onChange={(e) => setF({ ...f, handle: e.target.value })} />
          <Input label="Name, company" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} />
          <Input label="Why" value={f.why} onChange={(e) => setF({ ...f, why: e.target.value })} />
          <Input label="What to learn" value={f.learn} onChange={(e) => setF({ ...f, learn: e.target.value })} />
          <div className="field" style={{ justifyContent: "flex-end" }}><Button type="submit" icon="plus">Add</Button></div>
        </form>
        <ul className="list" style={{ marginTop: 8 }}>
          {slice.map((r) => (
            <li key={r.id}>
              <a className="small accent" href={`https://x.com/${r.handle}`} target="_blank" rel="noreferrer" style={{ width: 140 }}>@{r.handle}</a>
              <span className="xs grow text">{r.name}{r.why ? ` · ${r.why}` : ""}</span>
              <Input aria-label="First reply" placeholder="first reply" defaultValue={r.first_reply ?? ""} onBlur={(e) => void repo.patch("x_follows", r.id, { first_reply: e.target.value || null })} style={{ width: 180 }} />
              <IconButton icon="trash" size="sm" label="Remove" onClick={() => void repo.remove("x_follows", r.id)} />
            </li>
          ))}
        </ul>
        {!rows?.length ? <Empty>No follows yet. Import the Notion list or add one.</Empty> : null}
        <Pager page={page} pages={pages} onPage={setPage} total={rows?.length} />
      </Card>
    </div>
  );
}

function Intel() {
  const rows = useLiveQuery(async () => live(await db.t("market_intel").toArray()).sort((a, b) => (a.date < b.date ? 1 : -1)), []);
  const [f, setF] = useState({ kind: "job", company: "", role: "", skills: "", source: "", notes: "" });
  const [page, setPage] = useState(0);
  const ws = weekStart(today());
  const week = (rows ?? []).filter((r) => r.date >= ws);
  const tally = useMemo(() => topSkills(week), [week]);
  const all = useMemo(() => topSkills(rows ?? [], 15), [rows]);
  const { slice, pages } = paginate(rows ?? [], page, 15);
  return (
    <div className="bento">
      <Card className="span-4" title="Top skills this week" eyebrow="Simple counts, no AI">
        <ul className="list">{tally.map((s) => <li key={s.skill}><span className="small grow">{s.skill}</span><span className="num">{s.count}</span></li>)}</ul>
        {!tally.length ? <Empty>No intel this week.</Empty> : null}
        <div className="cols-2" style={{ marginTop: 12 }}>
          <StatCard label="Job posts" value={(rows ?? []).filter((r) => r.kind === "job").length} unit="/20" />
          <StatCard label="Conversations" value={(rows ?? []).filter((r) => r.kind === "conversation").length} unit="/8" />
        </div>
        {all.length ? <p className="xs muted" style={{ marginTop: 8 }}>All-time: {all.slice(0, 8).map((s) => `${s.skill} ${s.count}`).join(" · ")}</p> : null}
      </Card>
      <Card className="span-8" title="Log" eyebrow="Feeds CAREER: which skills to prioritise">
        <form className="form-grid" onSubmit={async (e) => { e.preventDefault(); if (!f.company && !f.role) return; await repo.insert("market_intel", { date: today(), kind: f.kind, company: f.company || null, role: f.role || null, skills: parseSkills(f.skills), source: f.source || null, notes: f.notes || null }); setF({ ...f, company: "", role: "", skills: "", notes: "" }); toast.ok("Logged."); }}>
          <Select label="Kind" value={f.kind} onChange={(e) => setF({ ...f, kind: e.target.value })} options={[{ value: "job", label: "Job post" }, { value: "conversation", label: "Conversation" }]} />
          <Input label="Company" value={f.company} onChange={(e) => setF({ ...f, company: e.target.value })} />
          <Input label="Role" value={f.role} onChange={(e) => setF({ ...f, role: e.target.value })} />
          <Input label="Skills (comma separated)" value={f.skills} onChange={(e) => setF({ ...f, skills: e.target.value })} />
          <Input label="Source" value={f.source} onChange={(e) => setF({ ...f, source: e.target.value })} />
          <Input label="Notes" value={f.notes} onChange={(e) => setF({ ...f, notes: e.target.value })} />
          <div className="field" style={{ justifyContent: "flex-end" }}><Button type="submit" icon="plus">Log</Button></div>
        </form>
        <ul className="list" style={{ marginTop: 8 }}>
          {slice.map((r) => (
            <li key={r.id} style={{ flexWrap: "wrap" }}>
              <span className="mono xs" style={{ width: 80 }}>{r.date.slice(5)}</span>
              <span className="small grow">{r.role} <span className="muted xs">@ {r.company} · {r.kind}</span></span>
              <span className="row wrap" style={{ gap: 4 }}>{r.skills.map((s) => <Chip key={s}>{s}</Chip>)}</span>
              <IconButton icon="trash" size="sm" label="Delete" onClick={() => void repo.remove("market_intel", r.id)} />
            </li>
          ))}
        </ul>
        <Pager page={page} pages={pages} onPage={setPage} total={rows?.length} />
      </Card>
    </div>
  );
}

function Presence() {
  const d = today();
  const items = useLiveQuery(async () => live(await db.t("presence_items").toArray()).filter((i) => i.active).sort((a, b) => a.order_no - b.order_no), []);
  const ticks = useLiveQuery(async () => live(await db.t("presence_ticks").where("date").equals(d).toArray()), [d]);
  const [label, setLabel] = useState("");
  const done = new Set((ticks ?? []).filter((t) => t.done).map((t) => t.item_id));
  return (
    <div className="bento">
      <Card className="span-7" title="Presence & style" eyebrow={`${done.size}/${items?.length ?? 0} today`}>
        <Checklist
          size="lg"
          items={(items ?? []).map((i) => ({ id: i.id, label: i.label, done: done.has(i.id) }))}
          onToggle={async (id, v) => {
            await repo.upsertBy("presence_ticks", { date: d, item_id: id }, { done: v });
            if (v && done.size + 1 >= 3) await award("task_done", "persona", "presence", d, { points: 10, quiet: true });
          }}
        />
        <form className="row" style={{ marginTop: 12 }} onSubmit={(e) => { e.preventDefault(); if (label.trim()) void repo.insert("presence_items", { label: label.trim(), order_no: (items?.length ?? 0) + 1 }); setLabel(""); }}>
          <Input aria-label="New item" placeholder="Add a tick…" value={label} onChange={(e) => setLabel(e.target.value)} />
          <Button type="submit" icon="plus">Add</Button>
        </form>
        <details style={{ marginTop: 8 }}>
          <summary className="micro" style={{ cursor: "pointer" }}>Edit list</summary>
          <ul className="list">{(items ?? []).map((i) => <li key={i.id}><Input aria-label="Label" defaultValue={i.label} onBlur={(e) => void repo.patch("presence_items", i.id, { label: e.target.value })} /><IconButton icon="trash" size="sm" label="Remove" onClick={() => void repo.patch("presence_items", i.id, { active: false })} /></li>)}</ul>
        </details>
      </Card>
      <Card className="span-5" title="Harvey checklist" edge eyebrow="Walking into a room">
        <ul className="text small" style={{ paddingLeft: 18, margin: 0, lineHeight: 1.9 }}>
          <li>Walk in slow.</li>
          <li>Shoulders back, open stance.</li>
          <li>Hands visible.</li>
          <li>Voice lower and slower. Endings drop.</li>
          <li>Silence is a tool.</li>
          <li>Eye contact 3-4 s, break sideways. +1 s a week up to 5-6.</li>
        </ul>
        <hr className="dash" />
        <p className="xs muted text">Style: fit beats brand. Slim, not skinny or baggy. Solid colours (navy, charcoal, white, light blue, black, grey, olive). Haircut every 3-4 weeks.</p>
      </Card>
    </div>
  );
}

function Analytics() {
  const recs = useLiveQuery(async () => live(await db.t("speaking_recordings").toArray()).sort((a, b) => (a.date < b.date ? -1 : 1)), []);
  return (
    <>
      <SectionAnalytics
        section="persona"
        stats={[
          { label: "English (week)", value: (c) => sumBy(c.week, (d) => d.english_min), unit: "min" },
          { label: "Conversations", value: (c) => sumBy(c.days, (d) => d.conversations) },
          { label: "Requests sent", value: (c) => sumBy(c.days, (d) => d.contacts_sent) },
          { label: "Posts", value: (c) => sumBy(c.days, (d) => d.posts_published) },
          { label: "Real conversations", value: (c) => sumBy(c.days, (d) => d.real_conversations) },
        ]}
        trend={{ label: "Speaking minutes per week", kind: "bar", unit: "min", bucket: "week", value: (ds) => sumBy(ds, (d) => d.english_min) }}
        lag={[
          { label: "Posts", actual: (c) => sumBy(c.week, (d) => d.posts_published), target: (c) => c.targets.posts_linkedin_week + c.targets.posts_x_week, quip: "The internet won't know you exist." },
          { label: "English days", actual: (c) => countBy(c.week, (d) => d.english_min >= c.targets.english_min), target: (c) => c.week.length, unit: " days", quip: "Narrate your walk. Out loud." },
          { label: "Outreach days", actual: (c) => countBy(c.week, (d) => d.outreach_done), target: (c) => Math.min(5, c.week.length), unit: " days", quip: "Ten people. Ten minutes." },
        ]}
      />
      {recs && recs.length > 1 ? (
        <Card title="Restarts per recording" eyebrow="Should go down" style={{ marginTop: 16 }}>
          <div className="row wrap">{recs.slice(-20).map((r) => <span key={r.id} className="chip" title={pretty(r.date)}>{r.restarts ?? 0}</span>)}</div>
        </Card>
      ) : null}
    </>
  );
}

export default function Persona() {
  return (
    <SectionLayout section="persona" tabs={TABS}>
      <Routes>
        <Route index element={<Navigate to="speak" replace />} />
        <Route path="speak" element={<Speak />} />
        <Route path="daily" element={<Daily />} />
        <Route path="connections" element={<Connections />} />
        <Route path="compose" element={<Compose />} />
        <Route path="ideas" element={<Ideas />} />
        <Route path="x-follows" element={<XFollows />} />
        <Route path="intel" element={<Intel />} />
        <Route path="presence" element={<Presence />} />
        <Route path="library" element={<Library section="persona" suggestedTopics={["Public speaking", "English fluency & shadowing", "Storytelling", "Networking", "LinkedIn/X writing", "Body language"]} />} />
        <Route path="library/watch/:videoId" element={<Watch />} />
        <Route path="analytics" element={<Analytics />} />
        <Route path="*" element={<Navigate to="speak" replace />} />
      </Routes>
    </SectionLayout>
  );
}

