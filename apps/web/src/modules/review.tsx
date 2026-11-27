// Nightly review + journal (one form). Auto-fills from the day's logs; every field stays editable.
// Submit → "Logged. Go sleep, Cooper." → XP → Obsidian mirror → the day's grid cell updates.
import { useEffect, useMemo, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "@/data/db";
import { repo } from "@/data/repo";
import type { Rows } from "@/data/types.gen";
import type { DayFacts } from "@/domain/facts";
import { pretty, type ISODate } from "@/lib/dates";
import { award } from "@/services/xp";
import { Button, Chip, Field, Input, Select, Textarea, toast } from "@/ui";

export type ReviewDraft = Omit<Rows["daily_reviews"], "id" | "created_at" | "updated_at" | "deleted_at" | "user_id" | "synced_at">;

/** Values derived from the day's logs (used to prefill). */
export function autoFill(f: DayFacts | undefined): Partial<ReviewDraft> {
  if (!f) return {};
  return {
    gym_status: f.workout_logged ? "done" : f.gym_day ? "missed" : "rest",
    calories: f.diet_logged ? f.calories : null,
    protein_g: f.diet_logged ? f.protein_g : null,
    water_ml: f.water_ml || null,
    python_block1_min: f.block1_min,
    pushes: f.pushes,
    stuck_min: f.stuck_min || null,
    outreach_done: f.outreach_done,
    speaking_min: f.english_min,
  };
}

type AutoKey = "gym_status" | "calories" | "protein_g" | "water_ml" | "python_block1_min" | "pushes" | "stuck_min" | "outreach_done" | "speaking_min";

/** Merge: saved values win over auto values, except nulls. */
export function mergeReview(saved: Partial<ReviewDraft> | undefined, auto: Partial<ReviewDraft>): Partial<ReviewDraft> {
  const out: Partial<ReviewDraft> = { ...auto };
  for (const [k, v] of Object.entries(saved ?? {})) if (v !== null && v !== undefined && v !== "") (out as Record<string, unknown>)[k] = v;
  return out;
}

const num = (v: string): number | null => (v.trim() === "" ? null : Math.max(0, Math.round(Number(v)) || 0));

export function NightlyReview({ date, facts, onSubmitted }: { date: ISODate; facts: DayFacts | undefined; onSubmitted?: (row: Rows["daily_reviews"]) => void }) {
  const saved = useLiveQuery(async () => (await db.t("daily_reviews").where("date").equals(date).toArray()).find((r) => !r.deleted_at) ?? null, [date]);
  const auto = useMemo(() => autoFill(facts), [facts]);
  const [v, setV] = useState<Partial<ReviewDraft>>({});
  const [touched, setTouched] = useState(false);

  useEffect(() => {
    if (saved === undefined) return;
    if (!touched) setV(mergeReview(saved ?? undefined, auto));
  }, [saved, auto, touched]);

  const set = (p: Partial<ReviewDraft>) => {
    setTouched(true);
    setV((x) => ({ ...x, ...p }));
  };
  const isAuto = (k: AutoKey) => auto[k] !== undefined && auto[k] !== null && v[k] === auto[k];

  const save = async (submit: boolean) => {
    const row = await repo.upsertBy("daily_reviews", { date }, { ...v, date, ...(submit ? { submitted_at: new Date().toISOString() } : {}) });
    setTouched(false);
    if (submit) {
      await award("review_submitted", "home", "daily_reviews", date, { date, quiet: true });
      toast.ok("Logged. Go sleep, Cooper.", v.tomorrow_one_thing ? `Tomorrow: ${v.tomorrow_one_thing}` : undefined);
      void import("./obsidian").then((m) => m.mirrorAfterReview(date)).catch(() => undefined);
      onSubmitted?.(row);
    }
  };

  const AutoTag = ({ k }: { k: AutoKey }) => (isAuto(k) ? <span className="chip ok" style={{ height: 18 }}>auto</span> : null);

  return (
    <form
      className="stack"
      onSubmit={(e) => {
        e.preventDefault();
        void save(true);
      }}
      onBlur={() => touched && void save(false)}
      aria-label={`Nightly review for ${pretty(date)}`}
    >
      <div className="form-grid">
        <Field label="Gym" hint={<AutoTag k="gym_status" />}>
          <Select
            value={v.gym_status ?? ""}
            onChange={(e) => set({ gym_status: e.target.value || null })}
            options={[
              { value: "", label: "—" },
              { value: "done", label: "Done" },
              { value: "missed", label: "Missed" },
              { value: "rest", label: "Rest day" },
            ]}
          />
        </Field>
        <Input label="Calories" inputMode="numeric" value={v.calories ?? ""} onChange={(e) => set({ calories: num(e.target.value) })} hint={<AutoTag k="calories" />} />
        <Input label="Protein (g)" inputMode="numeric" value={v.protein_g ?? ""} onChange={(e) => set({ protein_g: num(e.target.value) })} hint={<AutoTag k="protein_g" />} />
        <Input label="Water (ml)" inputMode="numeric" value={v.water_ml ?? ""} onChange={(e) => set({ water_ml: num(e.target.value) })} hint={<AutoTag k="water_ml" />} />
        <Input label="Block 1 (min)" inputMode="numeric" value={v.python_block1_min ?? ""} onChange={(e) => set({ python_block1_min: num(e.target.value) })} hint={<AutoTag k="python_block1_min" />} />
        <Input label="GitHub pushes" inputMode="numeric" value={v.pushes ?? ""} onChange={(e) => set({ pushes: num(e.target.value) })} hint={<AutoTag k="pushes" />} />
        <Input label="Stuck (longest, min)" inputMode="numeric" value={v.stuck_min ?? ""} onChange={(e) => set({ stuck_min: num(e.target.value) })} hint={<AutoTag k="stuck_min" />} />
        <Input label="English speaking (min)" inputMode="numeric" value={v.speaking_min ?? ""} onChange={(e) => set({ speaking_min: num(e.target.value) })} hint={<AutoTag k="speaking_min" />} />
        <Field label="Outreach done" hint={<AutoTag k="outreach_done" />}>
          <div className="row" style={{ minHeight: 40 }}>
            <Chip on={v.outreach_done === true} onClick={() => set({ outreach_done: true })}>
              Yes
            </Chip>
            <Chip on={v.outreach_done === false} onClick={() => set({ outreach_done: false })}>
              No
            </Chip>
          </div>
        </Field>
        <Input label="Lights out (planned)" type="time" value={v.lights_out_time ?? ""} onChange={(e) => set({ lights_out_time: e.target.value || null })} />
      </div>
      <div className="cols-3">
        <Textarea label="Went well" rows={2} maxLength={280} value={v.journal_good ?? ""} onChange={(e) => set({ journal_good: e.target.value })} placeholder="One line." />
        <Textarea label="Didn't" rows={2} maxLength={280} value={v.journal_bad ?? ""} onChange={(e) => set({ journal_bad: e.target.value })} placeholder="One line. No drama." />
        <Textarea label="Lesson" rows={2} maxLength={280} value={v.journal_lesson ?? ""} onChange={(e) => set({ journal_lesson: e.target.value })} placeholder="One line you'd tell tomorrow-you." />
      </div>
      <Input
        label="Tomorrow's One Thing"
        value={v.tomorrow_one_thing ?? ""}
        onChange={(e) => set({ tomorrow_one_thing: e.target.value })}
        placeholder="e.g. Finish the JSON task manager's delete command"
        hint="Becomes tomorrow's pinned task."
      />
      <div className="row wrap">
        <Button type="submit" variant="primary" icon="check">
          {saved?.submitted_at ? "Update review" : "Submit review"}
        </Button>
        {saved?.submitted_at ? <span className="micro ok">Submitted. The grid knows.</span> : <span className="micro">Draft saves when you leave a field.</span>}
      </div>
    </form>
  );
}
