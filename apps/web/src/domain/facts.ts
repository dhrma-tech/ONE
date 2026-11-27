// Per-day facts: everything the done rules, grade, streaks, review auto-fill and analytics need.
// Pure: built from plain row arrays, so it is unit-testable and reusable by the server if needed.
import type { Rows } from "@/data/types.gen";
import type { SectionId } from "@/lib/sections";
import { dow, isoDate, type ISODate } from "@/lib/dates";
import type { Targets } from "./targets";

export interface DayFacts {
  date: ISODate;
  block1_min: number;
  career_min: number; // all career focus minutes
  focus_min: number;
  phone_free_max: number;
  tasks_done: Record<SectionId | "home", number>;
  tasks_total: Record<SectionId | "home", number>;
  meditation_min: number;
  flashcard_reviews: number;
  reading_sessions: number;
  reading_min: number;
  chess_events: number;
  workout_logged: boolean;
  workout_min: number;
  workout_minimum: boolean;
  diet_logged: boolean;
  calories: number;
  protein_g: number;
  water_ml: number;
  weight_kg: number | null;
  english_min: number;
  conversations: number;
  real_conversations: number;
  recordings: number;
  outreach_done: boolean;
  contacts_sent: number;
  presence_ticks: number;
  posts_published: number;
  pushes: number | null;
  review_submitted: boolean;
  lights_out: string | null;
  stuck_min: number;
  problems_solved: number;
  videos_done: number;
  notes_reviewed: number;
  units_cracked: number;
  gym_day: boolean;
  xp: number;
}

export interface FactRows {
  focus_sessions: Rows["focus_sessions"][];
  tasks: Rows["tasks"][];
  meditation_sessions: Rows["meditation_sessions"][];
  flashcard_reviews: Rows["flashcard_reviews"][];
  reading_sessions: Rows["reading_sessions"][];
  chess_events: Rows["chess_events"][];
  workouts: Rows["workouts"][];
  diet_logs: Rows["diet_logs"][];
  water_logs: Rows["water_logs"][];
  weigh_ins: Rows["weigh_ins"][];
  persona_daily: Rows["persona_daily"][];
  speaking_recordings: Rows["speaking_recordings"][];
  contacts: Rows["contacts"][];
  presence_ticks: Rows["presence_ticks"][];
  posts: Rows["posts"][];
  github_snapshots: Rows["github_snapshots"][];
  daily_reviews: Rows["daily_reviews"][];
  problem_log: Rows["problem_log"][];
  video_progress: Rows["video_progress"][];
  xp_events: Rows["xp_events"][];
  units: Rows["units"][];
}

export const FACT_TABLES: (keyof FactRows)[] = [
  "focus_sessions", "tasks", "meditation_sessions", "flashcard_reviews", "reading_sessions", "chess_events", "workouts",
  "diet_logs", "water_logs", "weigh_ins", "persona_daily", "speaking_recordings", "contacts", "presence_ticks", "posts",
  "github_snapshots", "daily_reviews", "problem_log", "video_progress", "xp_events", "units",
];

const zeroSec = () => ({ career: 0, mind: 0, body: 0, persona: 0, home: 0 });

export function emptyFacts(date: ISODate, targets?: Targets): DayFacts {
  return {
    date, block1_min: 0, career_min: 0, focus_min: 0, phone_free_max: 0, tasks_done: zeroSec(), tasks_total: zeroSec(),
    meditation_min: 0, flashcard_reviews: 0, reading_sessions: 0, reading_min: 0, chess_events: 0, workout_logged: false,
    workout_min: 0, workout_minimum: false, diet_logged: false, calories: 0, protein_g: 0, water_ml: 0, weight_kg: null,
    english_min: 0, conversations: 0, real_conversations: 0, recordings: 0, outreach_done: false, contacts_sent: 0,
    presence_ticks: 0, posts_published: 0, pushes: null, review_submitted: false, lights_out: null, stuck_min: 0,
    problems_solved: 0, videos_done: 0, notes_reviewed: 0, units_cracked: 0,
    gym_day: targets ? targets.gym_days.includes(dow(date)) : [1, 3, 5].includes(dow(date)), xp: 0,
  };
}

const tsDate = (ts: string | null | undefined): ISODate | null => (ts ? isoDate(new Date(ts)) : null);

/** Build facts for every date in `dates` from raw rows (soft-deleted rows must already be filtered out). */
export function buildFacts(dates: ISODate[], r: FactRows, targets: Targets): Map<ISODate, DayFacts> {
  const m = new Map<ISODate, DayFacts>(dates.map((d) => [d, emptyFacts(d, targets)]));
  const at = (d: ISODate | null | undefined) => (d ? m.get(d) : undefined);

  for (const s of r.focus_sessions) {
    const f = at(s.date);
    if (!f) continue;
    f.focus_min += s.minutes;
    if (s.section === "career") f.career_min += s.minutes;
    if (s.kind === "block1") f.block1_min += s.minutes;
    if (s.phone_free) f.phone_free_max = Math.max(f.phone_free_max, s.minutes);
  }
  for (const t of r.tasks) {
    const f = at(t.due_date);
    if (!f) continue;
    const s = (t.section as SectionId | "home") ?? "home";
    f.tasks_total[s]++;
    if (t.done_at) f.tasks_done[s]++;
  }
  for (const x of r.meditation_sessions) {
    const f = at(x.date);
    if (f) f.meditation_min += x.minutes;
  }
  for (const x of r.flashcard_reviews) {
    const f = at(x.date);
    if (f) f.flashcard_reviews++;
  }
  for (const x of r.reading_sessions) {
    const f = at(x.date);
    if (f) {
      f.reading_sessions++;
      f.reading_min += x.minutes ?? 0;
    }
  }
  for (const x of r.chess_events) {
    const f = at(x.date);
    if (f) f.chess_events++;
  }
  for (const w of r.workouts) {
    const f = at(w.date);
    if (!f) continue;
    f.workout_logged = true;
    f.workout_min += w.duration_min ?? 0;
    if (w.minimum_session || (w.duration_min ?? 0) >= 20) f.workout_minimum = true;
  }
  for (const x of r.diet_logs) {
    const f = at(x.date);
    if (!f) continue;
    f.diet_logged = true;
    f.calories += x.calories;
    f.protein_g += x.protein_g;
  }
  for (const x of r.water_logs) {
    const f = at(x.date);
    if (f) f.water_ml += x.ml;
  }
  for (const x of r.weigh_ins) {
    const f = at(x.date);
    if (f) f.weight_kg = Number(x.weight_kg);
  }
  for (const x of r.persona_daily) {
    const f = at(x.date);
    if (!f) continue;
    f.english_min += x.english_min;
    f.conversations += x.conversations_started;
    f.real_conversations += x.real_conversations;
    if (x.outreach_done) f.outreach_done = true;
  }
  for (const x of r.speaking_recordings) {
    const f = at(x.date);
    if (f) f.recordings++;
  }
  for (const c of r.contacts) {
    const f = at(c.sent_at);
    if (f) {
      f.contacts_sent++;
      f.outreach_done = true;
    }
  }
  for (const x of r.presence_ticks) {
    const f = at(x.date);
    if (f && x.done) f.presence_ticks++;
  }
  for (const p of r.posts) {
    const f = p.status === "published" ? at(p.published_at) : undefined;
    if (f) f.posts_published++;
  }
  for (const g of r.github_snapshots) {
    const f = at(g.date);
    if (f && typeof g.pushes_today === "number") f.pushes = g.pushes_today;
  }
  for (const v of r.daily_reviews) {
    const f = at(v.date);
    if (!f) continue;
    if (v.submitted_at) f.review_submitted = true;
    f.lights_out = v.lights_out_time ?? null;
    f.stuck_min = Math.max(f.stuck_min, v.stuck_min ?? 0);
    if (f.pushes === null && typeof v.pushes === "number") f.pushes = v.pushes;
    if (v.outreach_done) f.outreach_done = true;
  }
  for (const p of r.problem_log) {
    const f = at(p.date);
    if (!f) continue;
    if (p.solved) f.problems_solved++;
    f.stuck_min = Math.max(f.stuck_min, p.stuck_min ?? 0);
  }
  for (const v of r.video_progress) {
    const f = at(tsDate(v.finished_at));
    if (f && v.status === "done") f.videos_done++;
  }
  for (const x of r.xp_events) {
    const f = at(x.date);
    if (!f) continue;
    f.xp += x.points;
    if (x.kind === "note_reviewed") f.notes_reviewed++;
    if (x.kind === "unit_cracked") f.units_cracked++;
  }
  return m;
}
