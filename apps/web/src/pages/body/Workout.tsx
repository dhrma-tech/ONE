// Workout log (after the session, not live): pick session (rotation suggests), sets × reps × kg pre-filled
// from last time, rule-based progression hints, 20-min minimum flag, PR detection, editable templates.
import { useEffect, useMemo, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "@/data/db";
import { repo } from "@/data/repo";
import type { Rows } from "@/data/types.gen";
import { lastSets, nextSession, personalRecords, progressionHint, type Template } from "@/domain/body";
import { pretty, today } from "@/lib/dates";
import { award } from "@/services/xp";
import { Button, Card, Chip, Empty, IconButton, Input, Modal, Select, Switch, Textarea, toast } from "@/ui";

const live = <T extends { deleted_at: string | null }>(x: T[]) => x.filter((r) => !r.deleted_at);

function useBody() {
  return useLiveQuery(async () => {
    const [templates, workouts, sets] = await Promise.all([db.t("exercise_templates").toArray().then(live), db.t("workouts").toArray().then(live), db.t("workout_sets").toArray().then(live)]);
    return { templates: templates.sort((a, b) => a.order_no - b.order_no), workouts: workouts.sort((a, b) => (a.date < b.date ? 1 : -1)), sets };
  }, []);
}

type Draft = Record<string, { reps: string; weight: string }[]>;

export default function Workout() {
  const b = useBody();
  const [session, setSession] = useState<string | null>(null);
  const [date, setDate] = useState(today());
  const [draft, setDraft] = useState<Draft>({});
  const [duration, setDuration] = useState("50");
  const [notes, setNotes] = useState("");
  const [minimum, setMinimum] = useState(false);
  const [editT, setEditT] = useState(false);
  const names = useMemo(() => [...new Set((b?.templates ?? []).map((t) => t.template))], [b?.templates]);
  const suggested = b ? nextSession(b.workouts) : "Full Body A";
  const cur = session ?? suggested;
  const ex = (b?.templates ?? []).filter((t) => t.template === cur);

  useEffect(() => {
    if (!b) return;
    const d: Draft = {};
    for (const t of ex) {
      const prev = lastSets(t.exercise, b.workouts, b.sets);
      const hint = progressionHint(t as Template, prev);
      d[t.exercise] = Array.from({ length: t.sets }, (_, i) => ({
        reps: String(prev[i]?.reps ?? hint.reps ?? t.rep_low),
        weight: hint.weight !== null ? String(hint.weight) : prev[i]?.weight_kg ? String(prev[i].weight_kg) : "",
      }));
    }
    setDraft(d);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- rebuild only when the session or data changes
  }, [cur, b?.workouts.length, b?.templates.length]);

  if (!b) return <p className="micro">Loading…</p>;

  const save = async () => {
    const w = await repo.insert("workouts", { date, session: cur, duration_min: Number(duration) || null, notes: notes || null, minimum_session: minimum });
    const rows = Object.entries(draft).flatMap(([exercise, ss]) =>
      ss.map((s, i) => ({ workout_id: w.id, exercise, set_no: i + 1, reps: s.reps === "" ? null : Number(s.reps), weight_kg: s.weight === "" ? null : Number(s.weight) })).filter((s) => s.reps !== null),
    );
    await repo.insertMany("workout_sets", rows);
    await award(minimum && (Number(duration) || 0) < 40 ? "workout_minimum" : "workout_logged", "body", "workouts", w.id, { date });
    const allSets = [...b.sets, ...rows].map((s) => ({ ...s, date: s.workout_id === w.id ? date : (b.workouts.find((x) => x.id === s.workout_id)?.date ?? "") }));
    const prs = personalRecords(allSets as never, w.id);
    toast.ok("Logged. Goggins nods.", prs.length ? `PR: ${prs.map((p) => `${p.exercise} ${p.weight_kg}×${p.reps}`).join(", ")}` : undefined);
    setNotes("");
    setSession(null);
  };

  return (
    <div className="bento">
      <Card className="span-8" eyebrow={`Suggested: ${suggested} · log it after, not during`} title="Log workout" right={<Button size="sm" variant="ghost" onClick={() => setEditT(true)}>Templates</Button>}>
        <div className="row wrap" style={{ marginBottom: 12 }}>
          {names.map((n) => (
            <Chip key={n} on={n === cur} onClick={() => setSession(n)}>
              {n}
            </Chip>
          ))}
          <Input aria-label="Date" type="date" value={date} onChange={(e) => setDate(e.target.value)} style={{ width: 160 }} />
        </div>
        {ex.length ? (
          <div className="stack">
            {ex.map((t) => {
              const prev = lastSets(t.exercise, b.workouts, b.sets);
              const hint = progressionHint(t as Template, prev);
              return (
                <div key={t.id} className="stage">
                  <div className="row between wrap">
                    <span className="small">{t.exercise} <span className="xs muted">{t.sets}×{t.rep_low}{t.rep_high !== t.rep_low ? `-${t.rep_high}` : ""}{t.unit === "seconds" ? " s" : ""}</span></span>
                    <span className={`xs ${hint.kind === "weight" ? "ok-text" : "muted"}`}>{hint.text}</span>
                  </div>
                  <div className="row wrap" style={{ marginTop: 8 }}>
                    {(draft[t.exercise] ?? []).map((s, i) => (
                      <span key={i} className="row" style={{ gap: 4 }}>
                        <span className="micro">S{i + 1}</span>
                        <input className="input num" style={{ width: 58, minHeight: 34 }} inputMode="numeric" aria-label={`${t.exercise} set ${i + 1} ${t.unit}`} value={s.reps} onChange={(e) => setDraft({ ...draft, [t.exercise]: draft[t.exercise].map((x, j) => (j === i ? { ...x, reps: e.target.value } : x)) })} />
                        {t.unit !== "seconds" ? (
                          <>
                            <span className="xs muted">×</span>
                            <input className="input num" style={{ width: 64, minHeight: 34 }} inputMode="decimal" aria-label={`${t.exercise} set ${i + 1} kg`} placeholder="kg" value={s.weight} onChange={(e) => setDraft({ ...draft, [t.exercise]: draft[t.exercise].map((x, j) => (j === i ? { ...x, weight: e.target.value } : x)) })} />
                          </>
                        ) : (
                          <span className="xs muted">s</span>
                        )}
                      </span>
                    ))}
                  </div>
                </div>
              );
            })}
            <div className="form-grid">
              <Input label="Duration (min)" inputMode="numeric" value={duration} onChange={(e) => setDuration(e.target.value)} />
              <Input label="Notes" value={notes} onChange={(e) => setNotes(e.target.value)} />
            </div>
            <Switch checked={minimum} onChange={setMinimum} label="20-minute minimum session (still counts)" />
            <Button variant="accent" size="lg" icon="check" onClick={() => void save()}>
              Log {cur}
            </Button>
          </div>
        ) : (
          <Empty>No exercises in this template.</Empty>
        )}
      </Card>
      <Card className="span-4" title="History" eyebrow={`${b.workouts.length} workouts`}>
        <ul className="list">
          {b.workouts.slice(0, 10).map((w) => (
            <li key={w.id}>
              <span className="mono xs" style={{ width: 90 }}>{pretty(w.date)}</span>
              <span className="small grow">{w.session}</span>
              <span className="xs muted">{w.duration_min ?? "—"} min</span>
              <IconButton icon="trash" size="sm" label="Delete workout" onClick={() => void repo.remove("workouts", w.id)} />
            </li>
          ))}
        </ul>
        {!b.workouts.length ? <Empty>No workouts yet. The bar is waiting.</Empty> : null}
        <hr className="dash" />
        <ul className="text xs muted" style={{ paddingLeft: 16, margin: 0, lineHeight: 1.7 }}>
          <li>One light warm-up set per exercise.</li>
          <li>Rest 2-3 min on big lifts, 60-90 s on small.</li>
          <li>Stop with about 2 reps left.</li>
          <li>Reps to the top of the range, then the smallest weight jump.</li>
          <li>Session under 60 minutes.</li>
        </ul>
      </Card>
      <TemplatesModal open={editT} onClose={() => setEditT(false)} templates={b.templates} names={names} />
    </div>
  );
}

function TemplatesModal({ open, onClose, templates, names }: { open: boolean; onClose: () => void; templates: Rows["exercise_templates"][]; names: string[] }) {
  const [tpl, setTpl] = useState(names[0] ?? "Full Body A");
  const [newTpl, setNewTpl] = useState("");
  const [f, setF] = useState({ exercise: "", sets: "3", lo: "8", hi: "12" });
  const list = templates.filter((t) => t.template === tpl);
  return (
    <Modal open={open} onClose={onClose} title="Workout templates" wide>
      <div className="row wrap">
        <Select aria-label="Template" value={tpl} onChange={(e) => setTpl(e.target.value)} options={[...new Set([...names, tpl])].map((n) => ({ value: n, label: n }))} style={{ width: 220 }} />
        <Input aria-label="New template name" placeholder="New: Upper A" value={newTpl} onChange={(e) => setNewTpl(e.target.value)} style={{ width: 180 }} />
        <Button size="sm" onClick={() => { if (newTpl.trim()) { setTpl(newTpl.trim()); setNewTpl(""); } }}>Create</Button>
      </div>
      <ul className="list">
        {list.map((t) => (
          <li key={t.id}>
            <span className="small grow">{t.exercise}</span>
            <Input aria-label="Sets" inputMode="numeric" defaultValue={t.sets} onBlur={(e) => void repo.patch("exercise_templates", t.id, { sets: Number(e.target.value) || t.sets })} style={{ width: 56 }} />
            <span className="xs muted">×</span>
            <Input aria-label="Rep low" inputMode="numeric" defaultValue={t.rep_low} onBlur={(e) => void repo.patch("exercise_templates", t.id, { rep_low: Number(e.target.value) || t.rep_low })} style={{ width: 56 }} />
            <span className="xs muted">-</span>
            <Input aria-label="Rep high" inputMode="numeric" defaultValue={t.rep_high} onBlur={(e) => void repo.patch("exercise_templates", t.id, { rep_high: Number(e.target.value) || t.rep_high })} style={{ width: 56 }} />
            <Input aria-label="Weight step" inputMode="decimal" defaultValue={t.weight_step} onBlur={(e) => void repo.patch("exercise_templates", t.id, { weight_step: Number(e.target.value) || t.weight_step })} style={{ width: 64 }} title="Smallest weight jump (kg)" />
            <IconButton icon="trash" size="sm" label="Remove exercise" onClick={() => void repo.remove("exercise_templates", t.id)} />
          </li>
        ))}
      </ul>
      <form
        className="row wrap"
        style={{ marginTop: 8 }}
        onSubmit={(e) => {
          e.preventDefault();
          if (!f.exercise.trim()) return;
          void repo.insert("exercise_templates", { template: tpl, exercise: f.exercise.trim(), sets: Number(f.sets) || 3, rep_low: Number(f.lo) || 8, rep_high: Number(f.hi) || 12, order_no: list.length });
          setF({ ...f, exercise: "" });
        }}
      >
        <Input aria-label="Exercise" placeholder="Exercise (swap or add)" value={f.exercise} onChange={(e) => setF({ ...f, exercise: e.target.value })} />
        <Input aria-label="Sets" value={f.sets} onChange={(e) => setF({ ...f, sets: e.target.value })} style={{ width: 56 }} />
        <Input aria-label="Low" value={f.lo} onChange={(e) => setF({ ...f, lo: e.target.value })} style={{ width: 56 }} />
        <Input aria-label="High" value={f.hi} onChange={(e) => setF({ ...f, hi: e.target.value })} style={{ width: 56 }} />
        <Button type="submit" size="sm" icon="plus">Add</Button>
      </form>
      <Textarea aria-label="Note" readOnly rows={2} value="Weeks 5-12: create Upper A/B and Lower A/B here. No rest timer, no live tracking, by design." style={{ marginTop: 12 }} />
    </Modal>
  );
}
