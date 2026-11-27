// XP table (PLAN §8). One xp_events row per award, idempotent by (kind, ref_table, ref_id).
import type { SectionId } from "@/lib/sections";
import { levelFromXp } from "./levels";

export type XpKind =
  | "task_done" | "one_thing_done" | "block1_done" | "focus_minutes" | "video_done" | "note_reviewed" | "problem_solved"
  | "problem_logged" | "unit_cracked" | "gate_passed" | "workout_logged" | "workout_minimum" | "weigh_in" | "diet_logged"
  | "water_target" | "meditation" | "flashcards_session" | "reading_session" | "book_finished" | "recording"
  | "conversation" | "contact_talked" | "outreach_day" | "post_published" | "review_submitted" | "weekly_review"
  | "achievement";

export const XP: Record<XpKind, number> = {
  task_done: 10,
  one_thing_done: 25,
  block1_done: 50,
  focus_minutes: 0, // computed: 1 per 2 minutes, max 90 per day
  video_done: 15,
  note_reviewed: 5,
  problem_solved: 15,
  problem_logged: 8,
  unit_cracked: 40,
  gate_passed: 100,
  workout_logged: 40,
  workout_minimum: 25,
  weigh_in: 10,
  diet_logged: 10,
  water_target: 5,
  meditation: 15,
  flashcards_session: 10,
  reading_session: 10,
  book_finished: 50,
  recording: 20,
  conversation: 20,
  contact_talked: 20,
  outreach_day: 10,
  post_published: 30,
  review_submitted: 30,
  weekly_review: 50,
  achievement: 25,
};

export const focusXp = (minutes: number, alreadyToday: number): number =>
  Math.max(0, Math.min(90 - alreadyToday, Math.floor(minutes / 2)));

export interface XpTotals {
  total: number;
  bySection: Record<SectionId | "home", number>;
}

export function totals(events: { section: string; points: number }[]): XpTotals {
  const bySection = { career: 0, mind: 0, body: 0, persona: 0, home: 0 };
  let total = 0;
  for (const e of events) {
    total += e.points;
    if (e.section in bySection) bySection[e.section as keyof typeof bySection] += e.points;
  }
  return { total, bySection };
}

export { levelFromXp };
