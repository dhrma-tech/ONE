// BODY logic (rule-based, no AI): A/B rotation, pre-fill from last time, progression hints, PRs,
// weight-gain rate hints, deload weeks, "never miss twice" on scheduled gym days.
import { addDays, daysBetween, dow, type ISODate } from "@/lib/dates";

export interface SetLog {
  exercise: string;
  set_no: number;
  reps?: number | null;
  weight_kg?: number | null;
}
export interface Template {
  exercise: string;
  sets: number;
  rep_low: number;
  rep_high: number;
  unit: string;
  weight_step: number;
  order_no: number;
}
export interface WorkoutLite {
  id: string;
  date: ISODate;
  session: string;
}

/** Rotation alternates the two main templates: A, B, A, B … (= A,B,A in week 1, then B,A,B). */
export function nextSession(history: WorkoutLite[], pair: [string, string] = ["Full Body A", "Full Body B"]): string {
  const last = [...history].filter((w) => pair.includes(w.session)).sort((a, b) => (a.date < b.date ? 1 : -1))[0];
  if (!last) return pair[0];
  return last.session === pair[0] ? pair[1] : pair[0];
}

/** Most recent sets for an exercise (from the latest workout that has it). */
export function lastSets(exercise: string, workouts: WorkoutLite[], sets: (SetLog & { workout_id: string })[]): SetLog[] {
  const byW = new Map(workouts.map((w) => [w.id, w]));
  const withEx = sets.filter((s) => s.exercise === exercise && byW.has(s.workout_id));
  if (!withEx.length) return [];
  const latest = withEx.reduce((a, s) => (byW.get(s.workout_id)!.date > byW.get(a.workout_id)!.date ? s : a));
  return withEx.filter((s) => s.workout_id === latest.workout_id).sort((a, b) => a.set_no - b.set_no);
}

export interface Hint {
  kind: "weight" | "reps" | "start";
  text: string;
  weight: number | null;
  reps: number;
}

/**
 * Progression: if every set hit the top of the rep range last time → smallest weight jump, reps back to the bottom.
 * Otherwise → same weight, +1 rep (capped at the top).
 */
export function progressionHint(t: Template, prev: SetLog[]): Hint {
  if (!prev.length) return { kind: "start", text: `Start light: ${t.sets}×${t.rep_low}${t.rep_high !== t.rep_low ? `-${t.rep_high}` : ""}${t.unit === "seconds" ? " s" : ""}.`, weight: null, reps: t.rep_low };
  const w = Math.max(...prev.map((s) => s.weight_kg ?? 0));
  const allTop = prev.length >= t.sets && prev.every((s) => (s.reps ?? 0) >= t.rep_high);
  if (allTop) {
    if (t.unit === "seconds") return { kind: "reps", text: `All sets hit ${t.rep_high} s. Add 5-10 s.`, weight: w || null, reps: t.rep_high + 5 };
    const nw = Math.round((w + t.weight_step) * 100) / 100;
    return { kind: "weight", text: `Top of the range last time. Go ${nw} kg × ${t.rep_low}.`, weight: nw, reps: t.rep_low };
  }
  const minReps = Math.min(...prev.map((s) => s.reps ?? 0));
  const target = Math.min(t.rep_high, minReps + 1);
  return { kind: "reps", text: `Same weight${w ? ` (${w} kg)` : ""}, aim for ${target} reps.`, weight: w || null, reps: target };
}

/** Personal records: best weight for an exercise, tie-broken by reps. Returns PRs set in `workoutId`. */
export function personalRecords(sets: (SetLog & { workout_id: string; date: ISODate })[], workoutId: string): { exercise: string; weight_kg: number; reps: number }[] {
  const prs: { exercise: string; weight_kg: number; reps: number }[] = [];
  const ex = [...new Set(sets.filter((s) => s.workout_id === workoutId).map((s) => s.exercise))];
  const thisDate = sets.find((s) => s.workout_id === workoutId)?.date ?? "";
  for (const e of ex) {
    const mine = sets.filter((s) => s.exercise === e && s.workout_id === workoutId && (s.weight_kg ?? 0) > 0);
    if (!mine.length) continue;
    const best = mine.reduce((a, s) => ((s.weight_kg ?? 0) > (a.weight_kg ?? 0) || ((s.weight_kg ?? 0) === (a.weight_kg ?? 0) && (s.reps ?? 0) > (a.reps ?? 0)) ? s : a));
    const before = sets.filter((s) => s.exercise === e && s.workout_id !== workoutId && s.date <= thisDate);
    const beat = before.every((s) => (s.weight_kg ?? 0) < (best.weight_kg ?? 0) || ((s.weight_kg ?? 0) === (best.weight_kg ?? 0) && (s.reps ?? 0) < (best.reps ?? 0)));
    if (before.length && beat) prs.push({ exercise: e, weight_kg: best.weight_kg ?? 0, reps: best.reps ?? 0 });
  }
  return prs;
}

/** All-time PR count (exercise-days where the best set beat everything before). */
export function prCount(sets: (SetLog & { workout_id: string; date: ISODate })[]): number {
  const ids = [...new Set(sets.map((s) => s.workout_id))];
  return ids.reduce((a, id) => a + personalRecords(sets, id).length, 0);
}

export interface RateHint {
  perWeek: number | null;
  text: string | null;
  tone: "ok" | "low" | "high" | null;
}

/** Weekly gain over the last 2+ weeks from weigh-ins. < low for 2 weeks → eat more; > 0.5 → ease off. */
export function weightRate(weighIns: { date: ISODate; weight_kg: number }[], low = 0.25, high = 0.4): RateHint {
  const w = [...weighIns].sort((a, b) => (a.date < b.date ? -1 : 1));
  if (w.length < 2) return { perWeek: null, text: null, tone: null };
  const last = w[w.length - 1];
  const base = [...w].reverse().find((x) => daysBetween(x.date, last.date) >= 13) ?? w[0];
  const days = daysBetween(base.date, last.date);
  if (days < 6) return { perWeek: null, text: null, tone: null };
  const perWeek = Math.round(((last.weight_kg - base.weight_kg) / days) * 7 * 100) / 100;
  if (days >= 13 && perWeek < low) return { perWeek, text: "Under 0.25 kg/week for 2 weeks. Add 200-300 kcal.", tone: "low" };
  if (perWeek > 0.5) return { perWeek, text: "Over 0.5 kg/week. Mostly fat. Ease off a bit.", tone: "high" };
  if (perWeek >= low && perWeek <= high) return { perWeek, text: "On pace. Keep feeding the machine.", tone: "ok" };
  return { perWeek, text: null, tone: null };
}

/** Training week number (1-based) from the training start date; every 5th week is a deload. */
export const trainingWeek = (start: ISODate, on: ISODate): number => Math.floor(daysBetween(start, on) / 7) + 1;
export const isDeload = (start: ISODate, on: ISODate): boolean => trainingWeek(start, on) % 5 === 0;

/**
 * Missed scheduled gym days before `today` (since `since`). "Never miss twice":
 * the latest scheduled day missed → flag; the last two scheduled days both missed → streak break + no episodes.
 */
export function missedSessions(gymDays: number[], workoutDates: Set<ISODate>, since: ISODate, today: ISODate): { missedLast: boolean; missedTwice: boolean; missed: ISODate[] } {
  const scheduled: ISODate[] = [];
  for (let d = since; d < today; d = addDays(d, 1)) if (gymDays.includes(dow(d))) scheduled.push(d);
  // A workout within a day after a scheduled day still counts (e.g. Tuesday makeup for Monday).
  const done = (d: ISODate) => workoutDates.has(d) || workoutDates.has(addDays(d, 1));
  const missed = scheduled.filter((d) => !done(d));
  const n = scheduled.length;
  const missedLast = n >= 1 && !done(scheduled[n - 1]);
  const missedTwice = n >= 2 && !done(scheduled[n - 1]) && !done(scheduled[n - 2]);
  return { missedLast, missedTwice, missed };
}
