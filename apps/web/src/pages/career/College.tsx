// College: semesters → subjects → units (Not started / In progress / Cracked), exam countdown + timetable,
// 4-day milestone planner, PYQ bank with manual unit tags, study links, submissions, marks + SGPA/CGPA, exam mode.
import { useMemo, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "@/data/db";
import { repo } from "@/data/repo";
import type { Rows } from "@/data/types.gen";
import { daysBetween, pretty, today } from "@/lib/dates";
import { gpa, mostAsked, planMilestones, subjectResult, type ScaleRow } from "@/domain/college";
import { award, revoke } from "@/services/xp";
import { patchSettings, useSettings } from "@/services/settings";
import { Button, Card, Chip, Empty, IconButton, Input, Modal, ProgressBar, Select, Switch, Textarea, toast } from "@/ui";

const live = <T extends { deleted_at: string | null }>(x: T[]) => x.filter((r) => !r.deleted_at);

function useCollege() {
  return useLiveQuery(async () => {
    const [semesters, subjects, units, exams, milestones, papers, questions, submissions, marks, scale] = await Promise.all([
      db.t("semesters").toArray().then(live),
      db.t("subjects").toArray().then(live),
      db.t("units").toArray().then(live),
      db.t("exams").toArray().then(live),
      db.t("milestones").toArray().then(live),
      db.t("pyq_papers").toArray().then(live),
      db.t("pyq_questions").toArray().then(live),
      db.t("submissions").toArray().then(live),
      db.t("marks").toArray().then(live),
      db.t("grade_scale").toArray().then(live),
    ]);
    return { semesters: semesters.sort((a, b) => (a.number ?? 0) - (b.number ?? 0)), subjects, units, exams, milestones, papers, questions, submissions, marks, scale: scale as ScaleRow[] };
  }, []);
}
type College = NonNullable<ReturnType<typeof useCollege>>;

const STATUS = [
  { value: "not_started", label: "Not started" },
  { value: "in_progress", label: "In progress" },
  { value: "cracked", label: "Cracked" },
];

async function setUnitStatus(u: Rows["units"], status: string, section = "career") {
  await repo.patch("units", u.id, { status });
  if (status === "cracked") await award("unit_cracked", section, "units", u.id);
  else await revoke("unit_cracked", "units", u.id);
}

function SubjectDetail({ c, s, ro }: { c: College; s: Rows["subjects"]; ro: boolean }) {
  const units = c.units.filter((u) => u.subject_id === s.id).sort((a, b) => a.number - b.number);
  const papers = c.papers.filter((p) => p.subject_id === s.id);
  const qs = c.questions.filter((q) => papers.some((p) => p.id === q.paper_id));
  const asked = mostAsked(qs);
  const subs = c.submissions.filter((x) => x.subject_id === s.id).sort((a, b) => (a.due_date ?? "9").localeCompare(b.due_date ?? "9"));
  const [unitTitle, setUnitTitle] = useState("");
  const [paper, setPaper] = useState({ year: "", session: "", url: "" });
  const [q, setQ] = useState({ paper_id: "", unit_id: "", text: "", marks: "" });
  const [sub, setSub] = useState({ title: "", kind: "assignment", due: "" });
  const [links, setLinks] = useState(false);
  return (
    <div className="bento">
      <Card className="span-6" eyebrow="Cracked = concept + examples + every PYQ, no notes" title={`Units · ${s.name}`}>
        <ul className="list">
          {units.map((u) => (
            <li key={u.id}>
              <span className="mono xs" style={{ width: 28 }}>U{u.number}</span>
              <span className="small grow">{u.title || "—"}</span>
              {asked.get(u.id) ? <Chip title="PYQ frequency">×{asked.get(u.id)}</Chip> : null}
              <Select aria-label={`Unit ${u.number} status`} disabled={ro} value={u.status} onChange={(e) => void setUnitStatus(u, e.target.value)} options={STATUS} style={{ width: 140, minHeight: 30 }} />
              {!ro ? <IconButton icon="trash" size="sm" label="Delete unit" onClick={() => void repo.remove("units", u.id)} /> : null}
            </li>
          ))}
        </ul>
        {!units.length ? <Empty>No units yet. Add them from the syllabus.</Empty> : null}
        {!ro ? (
          <form
            className="row"
            style={{ marginTop: 8 }}
            onSubmit={(e) => {
              e.preventDefault();
              void repo.insert("units", { subject_id: s.id, number: (units.at(-1)?.number ?? 0) + 1, title: unitTitle.trim() || null });
              setUnitTitle("");
            }}
          >
            <Input aria-label="Unit title" placeholder={`Unit ${(units.at(-1)?.number ?? 0) + 1} title`} value={unitTitle} onChange={(e) => setUnitTitle(e.target.value)} />
            <Button type="submit" icon="plus">Unit</Button>
          </form>
        ) : null}
      </Card>
      <Card className="span-6" eyebrow="Tick units by hand. No OCR." title="PYQ bank">
        <ul className="list">
          {papers.map((p) => (
            <li key={p.id}>
              <span className="small grow">{p.session || p.year || "Paper"}</span>
              <span className="xs muted">{qs.filter((x) => x.paper_id === p.id).length} questions</span>
              {p.url ? <a className="icon-btn sm" href={p.url} target="_blank" rel="noreferrer" aria-label="Open paper">↗</a> : null}
            </li>
          ))}
        </ul>
        {!ro ? (
          <>
            <form
              className="row wrap"
              onSubmit={(e) => {
                e.preventDefault();
                void repo.insert("pyq_papers", { subject_id: s.id, year: Number(paper.year) || null, session: paper.session || null, url: paper.url || null });
                setPaper({ year: "", session: "", url: "" });
              }}
            >
              <Input aria-label="Session" placeholder="Winter 2025" value={paper.session} onChange={(e) => setPaper({ ...paper, session: e.target.value })} style={{ width: 140 }} />
              <Input aria-label="Paper link" placeholder="PDF link (Drive, etc.)" value={paper.url} onChange={(e) => setPaper({ ...paper, url: e.target.value })} />
              <Button type="submit" size="sm" icon="plus">Paper</Button>
            </form>
            {papers.length ? (
              <form
                className="form-grid"
                style={{ marginTop: 8 }}
                onSubmit={(e) => {
                  e.preventDefault();
                  if (!q.text.trim() || !q.paper_id) return;
                  const same = qs.find((x) => x.unit_id === (q.unit_id || null) && x.text_or_ref.trim().toLowerCase() === q.text.trim().toLowerCase());
                  if (same) void repo.patch("pyq_questions", same.id, { repeat_count: same.repeat_count + 1 });
                  else void repo.insert("pyq_questions", { paper_id: q.paper_id, unit_id: q.unit_id || null, text_or_ref: q.text.trim(), marks: Number(q.marks) || null });
                  setQ({ ...q, text: "", marks: "" });
                }}
              >
                <Select label="Paper" value={q.paper_id} onChange={(e) => setQ({ ...q, paper_id: e.target.value })} options={[{ value: "", label: "—" }, ...papers.map((p) => ({ value: p.id, label: p.session || String(p.year ?? "Paper") }))]} />
                <Select label="Unit" value={q.unit_id} onChange={(e) => setQ({ ...q, unit_id: e.target.value })} options={[{ value: "", label: "untagged" }, ...units.map((u) => ({ value: u.id, label: `U${u.number}` }))]} />
                <Input label="Question / ref" value={q.text} onChange={(e) => setQ({ ...q, text: e.target.value })} />
                <Input label="Marks" inputMode="numeric" value={q.marks} onChange={(e) => setQ({ ...q, marks: e.target.value })} />
                <div className="field" style={{ justifyContent: "flex-end" }}><Button type="submit" size="sm">Tag question</Button></div>
              </form>
            ) : null}
          </>
        ) : null}
        {units.some((u) => asked.get(u.id)) ? (
          <p className="xs muted" style={{ marginTop: 8 }}>
            Most asked: {[...units].sort((a, b) => (asked.get(b.id) ?? 0) - (asked.get(a.id) ?? 0)).slice(0, 3).filter((u) => asked.get(u.id)).map((u) => `U${u.number} (×${asked.get(u.id)})`).join(", ")}
          </p>
        ) : null}
      </Card>
      <Card className="span-6" title="Submissions" eyebrow={`${subs.filter((x) => x.done_at).length}/${subs.length} done`}>
        <ul className="list">
          {subs.map((x) => (
            <li key={x.id}>
              <input type="checkbox" className="checkbox" disabled={ro} checked={!!x.done_at} onChange={(e) => void repo.patch("submissions", x.id, { done_at: e.target.checked ? new Date().toISOString() : null })} aria-label={x.title} />
              <span className="small grow">{x.title} <span className="xs muted">· {x.kind}</span></span>
              <span className="mono xs muted">{x.due_date ? pretty(x.due_date) : ""}</span>
            </li>
          ))}
        </ul>
        {!ro ? (
          <form
            className="row wrap"
            onSubmit={(e) => {
              e.preventDefault();
              if (!sub.title.trim()) return;
              void repo.insert("submissions", { subject_id: s.id, title: sub.title.trim(), kind: sub.kind, due_date: sub.due || null });
              setSub({ ...sub, title: "", due: "" });
            }}
          >
            <Input aria-label="Submission" placeholder="Assignment 3" value={sub.title} onChange={(e) => setSub({ ...sub, title: e.target.value })} />
            <Select aria-label="Kind" value={sub.kind} onChange={(e) => setSub({ ...sub, kind: e.target.value })} options={["assignment", "practical", "journal", "other"].map((k) => ({ value: k, label: k }))} style={{ width: 130 }} />
            <Input aria-label="Due" type="date" value={sub.due} onChange={(e) => setSub({ ...sub, due: e.target.value })} style={{ width: 150 }} />
            <Button type="submit" size="sm" icon="plus">Add</Button>
          </form>
        ) : null}
      </Card>
      <Card className="span-6" title="Study links" right={!ro ? <Button size="sm" onClick={() => setLinks(true)}>Edit</Button> : null}>
        <ul className="list">
          {([
            ["NotebookLM", s.notebooklm_url],
            ["Syllabus", s.syllabus_url],
            ["Formula sheet", s.formula_sheet_url],
            ["Mind map", s.mindmap_url],
          ] as const).map(([k, v]) => (
            <li key={k}>
              <span className="small grow">{k}</span>
              {v ? <a className="accent small" href={v} target="_blank" rel="noreferrer">open ↗</a> : <span className="xs muted">not set</span>}
            </li>
          ))}
        </ul>
        <Modal open={links} onClose={() => setLinks(false)} title="Study links">
          <form
            className="stack"
            onSubmit={async (e) => {
              e.preventDefault();
              const f = new FormData(e.currentTarget);
              await repo.patch("subjects", s.id, { notebooklm_url: String(f.get("n") || "") || null, syllabus_url: String(f.get("s") || "") || null, formula_sheet_url: String(f.get("f") || "") || null, mindmap_url: String(f.get("m") || "") || null });
              setLinks(false);
            }}
          >
            <Input label="NotebookLM notebook URL" name="n" defaultValue={s.notebooklm_url ?? ""} />
            <Input label="Syllabus URL" name="s" defaultValue={s.syllabus_url ?? ""} />
            <Input label="Formula sheet URL" name="f" defaultValue={s.formula_sheet_url ?? ""} />
            <Input label="Mind map URL" name="m" defaultValue={s.mindmap_url ?? ""} />
            <Button type="submit" variant="primary">Save</Button>
          </form>
        </Modal>
      </Card>
    </div>
  );
}

function MarksCard({ c, sem, ro }: { c: College; sem: Rows["semesters"]; ro: boolean }) {
  const subs = c.subjects.filter((s) => s.semester_id === sem.id).sort((a, b) => a.order_no - b.order_no);
  const markOf = (id: string) => c.marks.find((m) => m.subject_id === id);
  const results = subs.map((s) => {
    const m = markOf(s.id);
    return { s, m, r: subjectResult({ kind: s.kind, credits: s.credits ?? null, ca: m?.ca ?? null, mse: m?.mse ?? null, ese: m?.ese ?? null, has_ese: s.has_ese, grade_point: m?.grade_point }, c.scale) };
  });
  const sgpa = gpa(results.map((x) => ({ credits: x.s.credits ?? null, points: x.r.points })));
  const allRows = c.semesters.flatMap((se) =>
    c.subjects
      .filter((s) => s.semester_id === se.id)
      .map((s) => {
        const m = markOf(s.id);
        return { credits: s.credits ?? null, points: subjectResult({ kind: s.kind, credits: s.credits ?? null, ca: m?.ca ?? null, mse: m?.mse ?? null, ese: m?.ese ?? null, has_ese: s.has_ese, grade_point: m?.grade_point }, c.scale).points };
      }),
  );
  const cgpa = gpa(allRows);
  const [scaleOpen, setScaleOpen] = useState(false);
  const setMark = (s: Rows["subjects"], k: "ca" | "mse" | "ese" | "credits", v: string) => {
    const n = v.trim() === "" ? null : Number(v);
    if (k === "credits") return void repo.patch("subjects", s.id, { credits: n });
    void repo.upsertBy("marks", { subject_id: s.id }, { [k]: n });
  };
  return (
    <Card className="span-12" eyebrow="Theory CA 20 + MSE 20 + ESE 60 · pass 40/100 and ≥ 20/60 ESE · practical CA 60 + ESE 40" title="Marks" right={<><Chip>SGPA {sgpa ?? "—"}</Chip><Chip>CGPA {cgpa ?? "—"}</Chip><Button size="sm" variant="ghost" onClick={() => setScaleOpen(true)}>Grade table</Button></>}>
      <div className="table-wrap">
        <table className="table">
          <thead>
            <tr><th>Subject</th><th>Cr</th><th>CA</th><th>MSE</th><th>ESE</th><th>Total</th><th>Grade</th><th /></tr>
          </thead>
          <tbody>
            {results.map(({ s, m, r }) => (
              <tr key={s.id}>
                <td className="small">{s.name}<br /><span className="xs muted">{s.kind}{s.has_ese ? "" : " · no ESE"}</span></td>
                {(["credits", "ca", "mse", "ese"] as const).map((k) => (
                  <td key={k}>
                    <input
                      className="input num"
                      style={{ width: 64, minHeight: 30, padding: "4px 6px" }}
                      inputMode="decimal"
                      disabled={ro || s.kind === "audit" || (k === "mse" && s.kind === "practical") || (k === "ese" && !s.has_ese)}
                      aria-label={`${s.name} ${k}`}
                      defaultValue={(k === "credits" ? s.credits : m?.[k]) ?? ""}
                      onBlur={(e) => setMark(s, k, e.target.value)}
                    />
                  </td>
                ))}
                <td className="mono small">{r.total !== null ? `${r.total}/${r.max}` : "—"}</td>
                <td>{r.grade ? <Chip tone={r.pass ? "ok" : "bad"}>{r.grade} · {r.points}</Chip> : "—"}</td>
                <td className="xs">{r.warn ? <span className={r.pass === false ? "danger" : "warn-text"}>{r.warn}</span> : null}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <Modal open={scaleOpen} onClose={() => setScaleOpen(false)} title="Grade table (verify against DBATU)">
        <ul className="list">
          {[...c.scale].sort((a, b) => b.min_pct - a.min_pct).map((g) => {
            const row = g as unknown as Rows["grade_scale"];
            return (
              <li key={row.id}>
                <Input aria-label="Grade" defaultValue={row.grade} onBlur={(e) => void repo.patch("grade_scale", row.id, { grade: e.target.value })} style={{ width: 70 }} />
                <span className="xs muted">from</span>
                <Input aria-label="Min %" inputMode="numeric" defaultValue={row.min_pct} onBlur={(e) => void repo.patch("grade_scale", row.id, { min_pct: Number(e.target.value) })} style={{ width: 70 }} />
                <span className="xs muted">% →</span>
                <Input aria-label="Points" inputMode="numeric" defaultValue={row.points} onBlur={(e) => void repo.patch("grade_scale", row.id, { points: Number(e.target.value) })} style={{ width: 70 }} />
                <span className="xs muted">points</span>
              </li>
            );
          })}
        </ul>
        <p className="xs muted" style={{ marginTop: 8 }}>SGPA = Σ(credits × points) / Σ credits. Audit/no-credit subjects are ignored.</p>
      </Modal>
    </Card>
  );
}

function ExamsCard({ c, sem, ro }: { c: College; sem: Rows["semesters"]; ro: boolean }) {
  const subs = c.subjects.filter((s) => s.semester_id === sem.id);
  const exams = c.exams.filter((e) => subs.some((s) => s.id === e.subject_id)).sort((a, b) => a.date.localeCompare(b.date));
  const [f, setF] = useState({ subject_id: "", date: "", kind: "ese", time: "10:00" });
  const t = today();
  return (
    <Card className="span-6" eyebrow="Pushed to the ONE calendar" title="Exams">
      <ul className="list">
        {exams.map((e) => {
          const d = daysBetween(t, e.date);
          return (
            <li key={e.id} style={{ opacity: d < 0 ? 0.45 : 1 }}>
              <span className="display" style={{ width: 52, fontSize: 22, color: d <= 3 && d >= 0 ? "var(--destructive)" : undefined }}>{d >= 0 ? `${d}d` : "done"}</span>
              <span className="stack tight grow">
                <span className="small">{subs.find((s) => s.id === e.subject_id)?.name}</span>
                <span className="xs muted">{pretty(e.date)} · {e.start_time ?? ""} · {e.kind.toUpperCase()}</span>
              </span>
              {!ro ? <IconButton icon="trash" size="sm" label="Delete exam" onClick={() => void repo.remove("exams", e.id)} /> : null}
            </li>
          );
        })}
      </ul>
      {!exams.length ? <Empty glyph="✎">No exam dates yet.</Empty> : null}
      {!ro ? (
        <form
          className="form-grid"
          style={{ marginTop: 8 }}
          onSubmit={(e) => {
            e.preventDefault();
            if (!f.subject_id || !f.date) return;
            void repo.insert("exams", { subject_id: f.subject_id, date: f.date, kind: f.kind, start_time: f.time || null });
            setF({ ...f, date: "" });
          }}
        >
          <Select label="Subject" value={f.subject_id} onChange={(e) => setF({ ...f, subject_id: e.target.value })} options={[{ value: "", label: "—" }, ...subs.map((s) => ({ value: s.id, label: s.name }))]} />
          <Input label="Date" type="date" value={f.date} onChange={(e) => setF({ ...f, date: e.target.value })} />
          <Input label="Time" type="time" value={f.time} onChange={(e) => setF({ ...f, time: e.target.value })} />
          <Select label="Kind" value={f.kind} onChange={(e) => setF({ ...f, kind: e.target.value })} options={["ese", "mse", "ca", "practical", "oral"].map((k) => ({ value: k, label: k.toUpperCase() }))} />
          <div className="field" style={{ justifyContent: "flex-end" }}><Button type="submit" size="sm" icon="plus">Exam</Button></div>
        </form>
      ) : null}
    </Card>
  );
}

function MilestonesCard({ c, sem, ro }: { c: College; sem: Rows["semesters"]; ro: boolean }) {
  const subs = c.subjects.filter((s) => s.semester_id === sem.id);
  const ms = c.milestones.filter((m) => m.semester_id === sem.id).sort((a, b) => a.start_date.localeCompare(b.start_date));
  const unit = new Map(c.units.map((u) => [u.id, u]));
  const sub = new Map(subs.map((s) => [s.id, s]));
  const t = today();
  const generate = async () => {
    const examOf = (sid: string) => c.exams.filter((e) => e.subject_id === sid && e.kind === "ese" && e.date >= t).sort((a, b) => a.date.localeCompare(b.date))[0]?.date ?? null;
    const units = c.units
      .filter((u) => sub.has(u.subject_id) && u.status !== "cracked")
      .map((u) => ({ id: u.id, subject_id: u.subject_id, number: u.number, importance: sub.get(u.subject_id)?.importance_rank ?? 9, examDate: examOf(u.subject_id) }));
    if (!units.length) return void toast.info("No uncracked units. Either done or not entered yet.");
    for (const m of ms.filter((m) => !m.done && m.start_date >= t)) await repo.remove("milestones", m.id);
    const blocks = planMilestones(units, t);
    await repo.insertMany("milestones", blocks.map((b, i) => ({ semester_id: sem.id, start_date: b.start_date, end_date: b.end_date, title: `Block ${i + 1}`, targets: b.unit_ids })));
    toast.ok(`${blocks.length} four-day blocks planned.`);
  };
  return (
    <Card className="span-6" eyebrow="4-day blocks · unit targets · editable" title="Milestones" right={!ro ? <Button size="sm" icon="refresh" onClick={() => void generate()}>Generate</Button> : null}>
      <ul className="list">
        {ms.map((m) => {
          const ids = (m.targets as string[]) ?? [];
          const cracked = ids.filter((id) => unit.get(id)?.status === "cracked").length;
          const current = m.start_date <= t && m.end_date >= t;
          return (
            <li key={m.id} style={{ alignItems: "flex-start", opacity: m.end_date < t && !current ? 0.6 : 1 }}>
              <input type="checkbox" className="checkbox" disabled={ro} checked={m.done} onChange={(e) => void repo.patch("milestones", m.id, { done: e.target.checked })} aria-label={`${m.title} done`} />
              <span className="stack tight grow">
                <span className="small">{m.title} {current ? <Chip on>now</Chip> : null}</span>
                <span className="xs muted">{pretty(m.start_date)} → {pretty(m.end_date)} · {cracked}/{ids.length} cracked</span>
                <span className="row wrap" style={{ gap: 4 }}>
                  {ids.map((id) => {
                    const u = unit.get(id);
                    return u ? <Chip key={id} tone={u.status === "cracked" ? "ok" : undefined}>{sub.get(u.subject_id)?.name.split(" ").map((w) => w[0]).join("")}·U{u.number}</Chip> : null;
                  })}
                </span>
              </span>
            </li>
          );
        })}
      </ul>
      {!ms.length ? <Empty glyph="▦">No blocks yet. Add units and exam dates, then Generate.</Empty> : null}
    </Card>
  );
}

export default function CollegePage() {
  const c = useCollege();
  const settings = useSettings();
  const [semId, setSemId] = useState<string | null>(null);
  const [subId, setSubId] = useState<string | null>(null);
  const [addSem, setAddSem] = useState(false);
  const [addSub, setAddSub] = useState(false);
  const sem = useMemo(() => c?.semesters.find((s) => s.id === semId) ?? c?.semesters.find((s) => !s.archived) ?? c?.semesters[0], [c, semId]);
  if (!c) return <p className="micro">Loading…</p>;
  if (!sem) return <Empty action={<Button onClick={() => setAddSem(true)}>Add semester</Button>}>No semesters yet.</Empty>;
  const ro = sem.archived;
  const subs = c.subjects.filter((s) => s.semester_id === sem.id).sort((a, b) => (a.importance_rank ?? 99) - (b.importance_rank ?? 99));
  const selected = subs.find((s) => s.id === subId);
  return (
    <div className="stack loose">
      <div className="row wrap between">
        <div className="row wrap">
          {c.semesters.map((s) => (
            <Chip key={s.id} on={s.id === sem.id} onClick={() => { setSemId(s.id); setSubId(null); }}>
              {s.name}{s.archived ? " · archived" : ""}
            </Chip>
          ))}
          <Button size="sm" variant="ghost" icon="plus" onClick={() => setAddSem(true)}>Semester</Button>
        </div>
        <div className="row wrap">
          <Switch checked={!!settings?.exam_mode} onChange={(v) => void patchSettings({ exam_mode: v })} label="Exam mode" />
          <Button size="sm" onClick={() => void repo.patch("semesters", sem.id, { archived: !sem.archived })}>{sem.archived ? "Unarchive" : "Archive"}</Button>
        </div>
      </div>
      {ro ? <p className="notice">Archived semester: read-only.</p> : null}
      {sem.end_date && !sem.archived && sem.end_date < today() ? <p className="notice">{sem.name} ended on {pretty(sem.end_date)}. Archive it?</p> : null}
      <div className="bento">
        <Card className="span-12" eyebrow="Ranked by importance" title="Subjects" right={!ro ? <Button size="sm" icon="plus" onClick={() => setAddSub(true)}>Subject</Button> : null}>
          <div className="cols-4" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))" }}>
            {subs.map((s) => {
              const us = c.units.filter((u) => u.subject_id === s.id);
              const cr = us.filter((u) => u.status === "cracked").length;
              return (
                <button key={s.id} type="button" className={`card pad-sm interactive${s.id === subId ? " accent-edge" : ""}`} style={{ textAlign: "left" }} onClick={() => setSubId(s.id === subId ? null : s.id)}>
                  <span className="micro">#{s.importance_rank ?? "—"} · {s.credits ?? "?"} cr</span>
                  <p className="small" style={{ margin: "4px 0 8px" }}>{s.name}</p>
                  <ProgressBar value={us.length ? cr / us.length : 0} label={`${s.name} units cracked`} />
                  <span className="xs muted">{cr}/{us.length} units cracked</span>
                </button>
              );
            })}
          </div>
          {!subs.length ? <Empty>Empty semester. Add subjects when the timetable drops.</Empty> : null}
        </Card>
      </div>
      {selected ? <SubjectDetail c={c} s={selected} ro={ro} /> : null}
      <div className="bento">
        <ExamsCard c={c} sem={sem} ro={ro} />
        <MilestonesCard c={c} sem={sem} ro={ro} />
        <MarksCard c={c} sem={sem} ro={ro} />
      </div>
      <Modal open={addSem} onClose={() => setAddSem(false)} title="New semester">
        <form
          className="stack"
          onSubmit={async (e) => {
            e.preventDefault();
            const f = new FormData(e.currentTarget);
            const s = await repo.insert("semesters", { name: String(f.get("name")), number: Number(f.get("number")) || null, start_date: String(f.get("start") || "") || null, end_date: String(f.get("end") || "") || null });
            setSemId(s.id);
            setAddSem(false);
          }}
        >
          <Input label="Name" name="name" required placeholder="Sem V" />
          <Input label="Number" name="number" inputMode="numeric" />
          <div className="form-grid">
            <Input label="Start" name="start" type="date" />
            <Input label="End" name="end" type="date" />
          </div>
          <Button type="submit" variant="primary">Add</Button>
        </form>
      </Modal>
      <Modal open={addSub} onClose={() => setAddSub(false)} title="New subject">
        <form
          className="stack"
          onSubmit={async (e) => {
            e.preventDefault();
            const f = new FormData(e.currentTarget);
            await repo.insert("subjects", { semester_id: sem.id, name: String(f.get("name")), code: String(f.get("code") || "") || null, credits: Number(f.get("credits")) || null, importance_rank: Number(f.get("rank")) || null, kind: String(f.get("kind")), has_ese: f.get("ese") === "on", order_no: subs.length });
            setAddSub(false);
          }}
        >
          <Input label="Name" name="name" required />
          <div className="form-grid">
            <Input label="Code" name="code" />
            <Input label="Credits" name="credits" inputMode="decimal" />
            <Input label="Importance rank" name="rank" inputMode="numeric" />
            <Select label="Kind" name="kind" options={[{ value: "theory", label: "Theory" }, { value: "practical", label: "Practical" }, { value: "audit", label: "Audit" }]} />
          </div>
          <label className="row small"><input type="checkbox" name="ese" defaultChecked className="checkbox" /> Has an ESE</label>
          <Textarea label="Notes" name="notes" rows={2} />
          <Button type="submit" variant="primary">Add subject</Button>
        </form>
      </Modal>
    </div>
  );
}
