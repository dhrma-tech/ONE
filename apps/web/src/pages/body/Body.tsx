import { lazy, useEffect, useState } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "@/data/db";
import { repo } from "@/data/repo";
import type { Rows } from "@/data/types.gen";
import { SectionLayout } from "@/modules/section";
import { Library } from "@/modules/library/Library";
import { SectionAnalytics, countBy, sumBy } from "@/modules/analytics";
import { isDeload, missedSessions, prCount, trainingWeek, weightRate } from "@/domain/body";
import { addDays, dayName, dow, pretty, range, today, weekStart } from "@/lib/dates";
import { logDiet, logWater, logWeight } from "@/services/log";
import { patchTargets, useTargets } from "@/services/settings";
import { blobUrl, compressImage, deleteBlob, saveBlob } from "@/services/blobs";
import { uuid } from "@/data/repo";
import { Button, Card, Chip, Empty, IconButton, Input, ProgressRing, Select, StatCard, TrendChart, toast } from "@/ui";

const Workout = lazy(() => import("./Workout"));
const Watch = lazy(() => import("@/modules/library/Watch"));
const live = <T extends { deleted_at: string | null }>(x: T[]) => x.filter((r) => !r.deleted_at);

const TABS = [
  { id: "workout", label: "Workout" },
  { id: "schedule", label: "Schedule" },
  { id: "weigh-in", label: "Weigh-in" },
  { id: "diet", label: "Diet" },
  { id: "water", label: "Water" },
  { id: "progress", label: "Progress" },
  { id: "library", label: "Library" },
  { id: "analytics", label: "Analytics" },
];

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export function useBodyTargets() {
  return useLiveQuery(async () => live(await db.t("body_targets").toArray())[0] ?? null, []);
}

/** Home + Schedule use this: never-miss-twice flags for scheduled gym days. */
export function useGymFlags() {
  const t = useTargets();
  const bt = useBodyTargets();
  return useLiveQuery(async () => {
    const ws = live(await db.t("workouts").toArray());
    const since = bt?.training_start_date ?? addDays(today(), -14);
    return missedSessions(t.gym_days, new Set(ws.map((w) => w.date)), since > addDays(today(), -28) ? since : addDays(today(), -28), today());
  }, [t.gym_days.join(","), bt?.training_start_date]);
}

function Schedule() {
  const t = useTargets();
  const bt = useBodyTargets();
  const flags = useGymFlags();
  const workouts = useLiveQuery(async () => new Set(live(await db.t("workouts").toArray()).map((w) => w.date)), []);
  const ws = weekStart(today());
  const start = bt?.training_start_date ?? null;
  return (
    <div className="bento">
      <Card className="span-8" eyebrow={`${t.gym_time} · pushed to the ONE calendar`} title="Gym days">
        <div className="row wrap">
          {DAYS.map((d, i) => (
            <Chip key={d} on={t.gym_days.includes(i)} onClick={() => void patchTargets({ gym_days: t.gym_days.includes(i) ? t.gym_days.filter((x) => x !== i) : [...t.gym_days, i].sort() })}>
              {d}
            </Chip>
          ))}
          <Input aria-label="Gym time" type="time" value={t.gym_time} onChange={(e) => void patchTargets({ gym_time: e.target.value })} style={{ width: 130 }} />
        </div>
        <div className="cols-4" style={{ gridTemplateColumns: "repeat(7, minmax(0,1fr))", marginTop: 16 }}>
          {range(ws, addDays(ws, 6)).map((d) => {
            const sched = t.gym_days.includes(dow(d));
            const done = workouts?.has(d);
            return (
              <div key={d} className="card pad-sm" style={{ textAlign: "center", opacity: sched ? 1 : 0.5, borderColor: done ? "var(--success)" : undefined }}>
                <span className="micro">{dayName(d)}</span>
                <p className="display" style={{ fontSize: 22 }}>{done ? "✓" : sched ? (d < today() ? "×" : "·") : "–"}</p>
              </div>
            );
          })}
        </div>
        {flags?.missedTwice ? (
          <p className="notice bad" style={{ marginTop: 12 }}>Two misses in a row. Streak reset, no episodes this week. Gravity wins sometimes. Not twice.</p>
        ) : flags?.missedLast ? (
          <p className="notice" style={{ marginTop: 12 }}>Missed one. 20-minute minimum today.</p>
        ) : null}
      </Card>
      <Card className="span-4" title="Block" eyebrow="Deload every 5th week">
        <Input label="Training start date" type="date" value={start ?? ""} onChange={(e) => bt && void repo.patch("body_targets", bt.id, { training_start_date: e.target.value || null })} />
        {start ? (
          <p className="small" style={{ marginTop: 12 }}>
            Week {trainingWeek(start, today())}. {isDeload(start, today()) ? <strong className="accent">Deload week: same exercises, about half the sets.</strong> : `Next deload: week ${Math.ceil(trainingWeek(start, today()) / 5) * 5}.`}
          </p>
        ) : (
          <p className="xs muted" style={{ marginTop: 12 }}>Set it once and the deload reminder appears automatically. Weeks 1-4 full body, then upper/lower.</p>
        )}
        <hr className="dash" />
        <ul className="xs text muted" style={{ paddingLeft: 16, margin: 0, lineHeight: 1.7 }}>
          <li>"Tomorrow" is banned. Replace it with a time.</li>
          <li>Gym bag packed the night before.</li>
          <li>2-minute rule: just get there and warm up.</li>
          <li>Never miss twice.</li>
        </ul>
      </Card>
    </div>
  );
}

function WeighIn() {
  const bt = useBodyTargets();
  const rows = useLiveQuery(async () => live(await db.t("weigh_ins").toArray()).sort((a, b) => (a.date < b.date ? -1 : 1)), []);
  const [w, setW] = useState("");
  if (!rows) return null;
  const rate = weightRate(rows.map((r) => ({ date: r.date, weight_kg: Number(r.weight_kg) })), Number(bt?.weekly_gain_low ?? 0.25), Number(bt?.weekly_gain_high ?? 0.4));
  const last = rows.at(-1);
  const startKg = Number(bt?.start_kg ?? 50);
  const isSunday = dow(today()) === 0;
  const points = [...(bt?.start_date ? [{ label: bt.start_date.slice(5), value: startKg }] : []), ...rows.map((r) => ({ label: r.date.slice(5), value: Number(r.weight_kg) }))];
  return (
    <div className="bento">
      <Card className="span-4" eyebrow={isSunday ? "It's Sunday. Empty stomach, same scale." : "Sunday, empty stomach, same scale"} title="Weigh-in">
        <form className="stack" onSubmit={async (e) => { e.preventDefault(); const n = Number(w); if (n > 20 && n < 200) { await logWeight(n); setW(""); toast.ok(`${n} kg logged.`); } }}>
          <Input aria-label="Weight in kg" inputMode="decimal" placeholder="e.g. 50.8" value={w} onChange={(e) => setW(e.target.value)} style={{ fontSize: 28, minHeight: 56 }} />
          <Button type="submit" variant="accent">Log weight</Button>
        </form>
        <div className="cols-2" style={{ marginTop: 16 }}>
          <StatCard label="Current" value={last ? Number(last.weight_kg) : null} unit="kg" decimals={1} />
          <StatCard label="Since start" value={last ? Number(last.weight_kg) - startKg : null} unit="kg" decimals={1} />
          <StatCard label="Rate" value={rate.perWeek} unit="kg/wk" decimals={2} />
        </div>
        {rate.text ? <p className={`notice${rate.tone === "high" ? " bad" : ""}`} style={{ marginTop: 12 }}>{rate.text}</p> : null}
      </Card>
      <Card className="span-8" eyebrow={`Baseline ${startKg} kg · 12-week ${bt?.target_12w_low ?? 53}-${bt?.target_12w_high ?? 55} kg · long ${bt?.target_long_low ?? 60}-${bt?.target_long_high ?? 62} kg`} title="Weight">
        {points.length > 1 ? <TrendChart label="Weight over time" unit="kg" decimals={1} points={points} band={[Number(bt?.target_12w_low ?? 53), Number(bt?.target_12w_high ?? 55)]} height={220} /> : <Empty>One more weigh-in and there's a graph.</Empty>}
        <ul className="list" style={{ marginTop: 8 }}>
          {[...rows].reverse().slice(0, 6).map((r) => (
            <li key={r.id}><span className="mono xs grow">{pretty(r.date)}</span><span className="num small">{Number(r.weight_kg).toFixed(1)} kg</span><IconButton icon="trash" size="sm" label="Delete" onClick={() => void repo.remove("weigh_ins", r.id)} /></li>
          ))}
        </ul>
      </Card>
      {bt ? (
        <Card className="span-12" title="Targets" eyebrow="All editable. No medical rules hard-coded.">
          <div className="form-grid">
            {([
              ["height_cm", "Height (cm)"], ["start_kg", "Start (kg)"], ["target_12w_low", "12-week low"], ["target_12w_high", "12-week high"],
              ["target_long_low", "Long-term low"], ["target_long_high", "Long-term high"], ["weekly_gain_low", "Gain/wk low"], ["weekly_gain_high", "Gain/wk high"],
            ] as [keyof Rows["body_targets"], string][]).map(([k, l]) => (
              <Input key={k} label={l} inputMode="decimal" defaultValue={String(bt[k] ?? "")} onBlur={(e) => void repo.patch("body_targets", bt.id, { [k]: e.target.value === "" ? null : Number(e.target.value) })} />
            ))}
            <Input label="Start date" type="date" defaultValue={bt.start_date ?? undefined} onBlur={(e) => void repo.patch("body_targets", bt.id, { start_date: e.target.value || bt.start_date })} />
          </div>
        </Card>
      ) : null}
    </div>
  );
}

function Diet() {
  const t = useTargets();
  const d = today();
  const meals = useLiveQuery(async () => live(await db.t("meal_templates").toArray()).sort((a, b) => a.order_no - b.order_no), []);
  const logs = useLiveQuery(async () => live(await db.t("diet_logs").where("date").equals(d).toArray()), [d]);
  const [f, setF] = useState({ kcal: "", protein: "", label: "" });
  const kcal = (logs ?? []).reduce((a, l) => a + l.calories, 0);
  const prot = (logs ?? []).reduce((a, l) => a + l.protein_g, 0);
  return (
    <div className="bento">
      <Card className="span-4" title="Today" eyebrow={`${t.calories} kcal · ${t.protein_low}-${t.protein_high} g protein`}>
        <div className="row" style={{ justifyContent: "space-around" }}>
          <ProgressRing value={kcal / t.calories} size={110} stroke={8} label="Calories"><span className="stack tight" style={{ alignItems: "center" }}><span className="num">{kcal}</span><span className="micro">kcal</span></span></ProgressRing>
          <ProgressRing value={prot / t.protein_low} size={110} stroke={8} label="Protein"><span className="stack tight" style={{ alignItems: "center" }}><span className="num">{prot}</span><span className="micro">g</span></span></ProgressRing>
        </div>
        <ul className="list" style={{ marginTop: 12 }}>
          {(logs ?? []).map((l) => (
            <li key={l.id}><span className="small grow truncate">{l.label ?? "entry"}</span><span className="mono xs">{l.calories} · {l.protein_g}g</span><IconButton icon="trash" size="sm" label="Delete entry" onClick={() => void repo.remove("diet_logs", l.id)} /></li>
          ))}
        </ul>
      </Card>
      <Card className="span-8" title="One-tap meals" eyebrow="Values marked est. are estimates. Correct them once.">
        <div className="big-buttons">
          {(meals ?? []).map((m) => (
            <button key={m.id} type="button" className="big-btn" onClick={() => void logDiet(m.calories, m.protein_g, m.name, m.id).then(() => toast.ok("+ " + m.name.split(":")[0]))}>
              <span className="xs">{m.name}</span>
              <span className="v">{m.calories}<span className="micro"> kcal</span></span>
              <span className="xs muted">{m.protein_g} g protein{m.is_estimate ? " · est." : ""}</span>
            </button>
          ))}
        </div>
        <form className="row wrap" style={{ marginTop: 12 }} onSubmit={async (e) => { e.preventDefault(); if (!f.kcal && !f.protein) return; await logDiet(Number(f.kcal) || 0, Number(f.protein) || 0, f.label || "manual"); setF({ kcal: "", protein: "", label: "" }); }}>
          <Input aria-label="Calories" placeholder="kcal" inputMode="numeric" value={f.kcal} onChange={(e) => setF({ ...f, kcal: e.target.value })} style={{ width: 100 }} />
          <Input aria-label="Protein" placeholder="protein g" inputMode="numeric" value={f.protein} onChange={(e) => setF({ ...f, protein: e.target.value })} style={{ width: 110 }} />
          <Input aria-label="Label" placeholder="what" value={f.label} onChange={(e) => setF({ ...f, label: e.target.value })} />
          <Button type="submit" icon="plus">Log</Button>
        </form>
        <details style={{ marginTop: 12 }}>
          <summary className="micro" style={{ cursor: "pointer" }}>Edit meal templates</summary>
          <ul className="list">
            {(meals ?? []).map((m) => (
              <li key={m.id}>
                <Input aria-label="Name" defaultValue={m.name} onBlur={(e) => void repo.patch("meal_templates", m.id, { name: e.target.value })} />
                <Input aria-label="kcal" inputMode="numeric" defaultValue={m.calories} onBlur={(e) => void repo.patch("meal_templates", m.id, { calories: Number(e.target.value) || 0, is_estimate: false })} style={{ width: 80 }} />
                <Input aria-label="protein" inputMode="numeric" defaultValue={m.protein_g} onBlur={(e) => void repo.patch("meal_templates", m.id, { protein_g: Number(e.target.value) || 0, is_estimate: false })} style={{ width: 70 }} />
                <IconButton icon="trash" size="sm" label="Delete template" onClick={() => void repo.remove("meal_templates", m.id)} />
              </li>
            ))}
          </ul>
          <Button size="sm" icon="plus" onClick={() => void repo.insert("meal_templates", { name: "New meal", calories: 0, protein_g: 0, order_no: (meals?.length ?? 0) + 1 })}>Template</Button>
        </details>
      </Card>
    </div>
  );
}

function Water() {
  const t = useTargets();
  const d = today();
  const logs = useLiveQuery(async () => live(await db.t("water_logs").where("date").equals(d).toArray()), [d]);
  const [custom, setCustom] = useState("");
  const [target, setTarget] = useState("");
  const total = (logs ?? []).reduce((a, l) => a + l.ml, 0);
  return (
    <div className="bento">
      <Card className="span-6" title={`${total} ml`} eyebrow={t.water_ml ? `of ${t.water_ml} ml` : "no target yet"}>
        {t.water_ml ? <ProgressRing value={total / t.water_ml} size={120} stroke={8} label="Water" color="var(--accent-persona)" /> : null}
        <div className="big-buttons" style={{ marginTop: 16 }}>
          {[250, 500].map((ml) => (
            <button key={ml} type="button" className="big-btn" onClick={() => void logWater(ml).then(() => toast.ok(`+${ml} ml`))}>
              <span className="v">+{ml}</span>
              <span className="micro">ml</span>
            </button>
          ))}
        </div>
        <form className="row" style={{ marginTop: 12 }} onSubmit={(e) => { e.preventDefault(); const n = Number(custom); if (n > 0) void logWater(n); setCustom(""); }}>
          <Input aria-label="Custom ml" placeholder="custom ml" inputMode="numeric" value={custom} onChange={(e) => setCustom(e.target.value)} />
          <Button type="submit">Add</Button>
        </form>
      </Card>
      <Card className="span-6" title="Target" eyebrow="Set it with your doctor's advice">
        {t.water_ml ? (
          <p className="small">Target: <span className="num">{t.water_ml} ml</span>. Change it any time.</p>
        ) : (
          <p className="small muted">Set your target. ONE won't guess one for you.</p>
        )}
        <form className="row" style={{ marginTop: 8 }} onSubmit={(e) => { e.preventDefault(); const n = Number(target); void patchTargets({ water_ml: n > 0 ? n : null }); setTarget(""); }}>
          <Input aria-label="Water target ml" placeholder="ml per day" inputMode="numeric" value={target} onChange={(e) => setTarget(e.target.value)} />
          <Button type="submit">Save</Button>
        </form>
        <ul className="list" style={{ marginTop: 12 }}>
          {(logs ?? []).map((l) => <li key={l.id}><span className="mono xs grow">{new Date(l.created_at).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}</span><span className="small">{l.ml} ml</span><IconButton icon="trash" size="sm" label="Delete" onClick={() => void repo.remove("water_logs", l.id)} /></li>)}
        </ul>
      </Card>
    </div>
  );
}

const MEASURES = ["chest", "waist", "arm", "thigh", "shoulders"];

function Photo({ p }: { p: Rows["progress_photos"] }) {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    void blobUrl("progress-photos", p.storage_path).then(setUrl);
  }, [p.storage_path]);
  return url ? <img src={url} alt={`${p.pose} ${p.date}`} /> : <div className="skeleton" style={{ aspectRatio: "3/4" }} />;
}

function Progress() {
  const ms = useLiveQuery(async () => live(await db.t("measurements").toArray()).sort((a, b) => (a.date < b.date ? 1 : -1)), []);
  const photos = useLiveQuery(async () => live(await db.t("progress_photos").toArray()).sort((a, b) => (a.date < b.date ? 1 : -1)), []);
  const [vals, setVals] = useState<Record<string, string>>({});
  const [pose, setPose] = useState("front");
  const months = [...new Set((photos ?? []).map((p) => p.date.slice(0, 7)))];
  const [cmp, setCmp] = useState<[string, string]>(["", ""]);
  const a = cmp[0] || months[months.length - 1] || "";
  const b = cmp[1] || months[0] || "";
  return (
    <div className="bento">
      <Card className="span-5" title="Measurements" eyebrow="Monthly · cm">
        <form className="form-grid" onSubmit={async (e) => { e.preventDefault(); const v = Object.fromEntries(Object.entries(vals).filter(([, x]) => x).map(([k, x]) => [k, Number(x)])); if (Object.keys(v).length) { await repo.insert("measurements", { date: today(), values: v }); setVals({}); toast.ok("Measured."); } }}>
          {MEASURES.map((m) => <Input key={m} label={m} inputMode="decimal" value={vals[m] ?? ""} onChange={(e) => setVals({ ...vals, [m]: e.target.value })} />)}
          <div className="field" style={{ justifyContent: "flex-end" }}><Button type="submit">Save</Button></div>
        </form>
        <div className="table-wrap" style={{ marginTop: 12 }}>
          <table className="table">
            <thead><tr><th>Date</th>{MEASURES.map((m) => <th key={m}>{m}</th>)}</tr></thead>
            <tbody>{(ms ?? []).slice(0, 6).map((r) => <tr key={r.id}><td className="mono xs">{r.date}</td>{MEASURES.map((m) => <td key={m} className="mono xs">{(r.values as Record<string, number>)[m] ?? "—"}</td>)}</tr>)}</tbody>
          </table>
        </div>
      </Card>
      <Card className="span-7" title="Progress photos" eyebrow="Private bucket · never public · never exported to the portfolio">
        <div className="row wrap">
          <Select aria-label="Pose" value={pose} onChange={(e) => setPose(e.target.value)} options={["front", "side", "back"].map((p) => ({ value: p, label: p }))} style={{ width: 110 }} />
          <label className="btn" style={{ cursor: "pointer" }}>
            Add photo
            <input type="file" accept="image/*" capture="environment" className="sr-only" onChange={async (e) => {
              const file = e.target.files?.[0];
              if (!file) return;
              const blob = await compressImage(file);
              const object = `${today()}-${pose}-${uuid().slice(0, 8)}.jpg`;
              await saveBlob("progress-photos", object, blob);
              await repo.insert("progress_photos", { date: today(), pose, storage_path: object });
              toast.ok("Saved privately.");
              e.target.value = "";
            }} />
          </label>
        </div>
        {months.length >= 2 ? (
          <>
            <div className="row wrap" style={{ marginTop: 12 }}>
              <span className="micro">Compare</span>
              <Select aria-label="Month A" value={a} onChange={(e) => setCmp([e.target.value, b])} options={months.map((m) => ({ value: m, label: m }))} style={{ width: 120 }} />
              <Select aria-label="Month B" value={b} onChange={(e) => setCmp([a, e.target.value])} options={months.map((m) => ({ value: m, label: m }))} style={{ width: 120 }} />
            </div>
            <div className="cols-2" style={{ marginTop: 8 }}>
              {[a, b].map((m) => (
                <div key={m} className="photo-grid">{(photos ?? []).filter((p) => p.date.startsWith(m) && p.pose === pose).slice(0, 1).map((p) => <Photo key={p.id} p={p} />)}</div>
              ))}
            </div>
          </>
        ) : null}
        <div className="photo-grid" style={{ marginTop: 12 }}>
          {(photos ?? []).slice(0, 12).map((p) => (
            <div key={p.id} className="stack tight">
              <Photo p={p} />
              <span className="row xs muted">{p.date} · {p.pose}<IconButton icon="trash" size="sm" label="Delete photo" onClick={async () => { await deleteBlob("progress-photos", p.storage_path); await repo.remove("progress_photos", p.id); }} /></span>
            </div>
          ))}
        </div>
        {!photos?.length ? <Empty glyph="◐">No photos yet. Month 1 is the baseline.</Empty> : null}
      </Card>
    </div>
  );
}

function Analytics() {
  const sets = useLiveQuery(async () => {
    const ws = live(await db.t("workouts").toArray());
    const byId = new Map(ws.map((w) => [w.id, w.date]));
    return live(await db.t("workout_sets").toArray()).map((s) => ({ ...s, date: byId.get(s.workout_id) ?? "" })).filter((s) => s.date);
  }, []);
  const bt = useBodyTargets();
  const prs = sets ? prCount(sets as never) : 0;
  return (
    <SectionAnalytics
      section="body"
      stats={[
        { label: "Weight", value: (c) => [...c.sum.dates].reverse().map((d) => c.sum.facts.get(d)!.weight_kg).find((w) => w !== null) ?? null, unit: "kg", decimals: 1, delta: (c) => { const w = c.days.map((d) => d.weight_kg).filter((x): x is number => x !== null); return w.length > 1 ? w[w.length - 1] - w[w.length - 2] : null; } },
        { label: "Sessions this week", value: (c) => countBy(c.week, (d) => d.workout_logged), unit: `/${3}` },
        { label: "Protein days", value: (c) => countBy(c.days, (d) => d.protein_g >= c.targets.protein_low) },
        { label: "PRs", value: () => prs },
      ]}
      trend={{ label: "Weight", kind: "line", unit: "kg", decimals: 1, bucket: "week", value: (ds) => [...ds].reverse().map((d) => d.weight_kg).find((w) => w !== null) ?? null, band: () => [Number(bt?.target_12w_low ?? 53), Number(bt?.target_12w_high ?? 55)] }}
      lag={[
        { label: "Protein", actual: (c) => countBy(c.week, (d) => d.protein_g >= c.targets.protein_low), target: (c) => c.week.length, unit: " days", quip: "Muscles are built in the kitchen." },
        { label: "Gym", actual: (c) => countBy(c.week, (d) => d.workout_logged), target: (c) => Math.min(3, countBy(c.week, (d) => d.gym_day)), unit: " sessions", quip: "Who's gonna carry the boats?" },
        { label: "Calories", actual: (c) => sumBy(c.week, (d) => d.calories) / Math.max(1, c.week.length), target: (c) => c.targets.calories, unit: " kcal/day", quip: "Eat like it's your job." },
      ]}
    />
  );
}

export default function Body() {
  return (
    <SectionLayout section="body" tabs={TABS}>
      <Routes>
        <Route index element={<Navigate to="workout" replace />} />
        <Route path="workout" element={<Workout />} />
        <Route path="schedule" element={<Schedule />} />
        <Route path="weigh-in" element={<WeighIn />} />
        <Route path="diet" element={<Diet />} />
        <Route path="water" element={<Water />} />
        <Route path="progress" element={<Progress />} />
        <Route path="library" element={<Library section="body" suggestedTopics={["Exercise form", "Lean bulk nutrition (Indian diet)", "Mobility & warm-up"]} />} />
        <Route path="library/watch/:videoId" element={<Watch />} />
        <Route path="analytics" element={<Analytics />} />
        <Route path="*" element={<Navigate to="workout" replace />} />
      </Routes>
    </SectionLayout>
  );
}
