// Done-for-the-day rules (PLAN §6.0), section levels 0-4, master grid level, streaks, weekly grade.
import type { SectionId } from "@/lib/sections";
import { addDays, dow, timeToMin, type ISODate } from "@/lib/dates";
import type { DayFacts } from "./facts";
import type { Targets } from "./targets";

export interface RuleCtx {
  targets: Targets;
  examMode: boolean;
}

export interface SectionDay {
  done: boolean;
  level: 0 | 1 | 2 | 3 | 4;
  progress: number; // 0..1 toward "done"
  note: string;
}

function lvl(done: boolean, progress: number, extra: boolean, any: boolean): 0 | 1 | 2 | 3 | 4 {
  if (done) return extra ? 4 : 3;
  if (progress >= 0.5) return 2;
  return any || progress > 0 ? 1 : 0;
}

export function careerDay(f: DayFacts, c: RuleCtx): SectionDay {
  const t = c.targets.block1_min;
  const block1 = f.block1_min >= t;
  const exam = c.examMode && f.career_min >= c.targets.exam_study_min;
  const done = block1 || exam;
  const progress = Math.min(1, Math.max(f.block1_min / t, c.examMode ? f.career_min / c.targets.exam_study_min : 0));
  const any = f.career_min > 0 || f.tasks_done.career > 0 || f.problems_solved > 0 || (f.pushes ?? 0) > 0;
  return {
    done,
    progress,
    level: lvl(done, progress, f.block1_min >= t * 1.66 || (done && (f.pushes ?? 0) > 0 && f.tasks_done.career > 1), any),
    note: `Block 1 ${f.block1_min}/${t} min${c.examMode ? `, study ${f.career_min} min` : ""}`,
  };
}

export function mindDay(f: DayFacts, c: RuleCtx): SectionDay {
  const med = f.meditation_min >= 5;
  const others = [f.flashcard_reviews >= c.targets.flashcards_reviews_done, f.reading_sessions > 0, f.tasks_done.mind > 0, f.chess_events > 0].filter(Boolean).length;
  const done = med || others >= 2;
  const progress = Math.min(1, Math.max(f.meditation_min / 5, others / 2));
  const any = f.meditation_min > 0 || others > 0 || f.flashcard_reviews > 0;
  return { done, progress, level: lvl(done, progress, med && others >= 2, any), note: `Meditation ${f.meditation_min} min, ${others} of 4 extras` };
}

export function bodyDay(f: DayFacts, c: RuleCtx): SectionDay {
  const fuel = f.diet_logged && f.water_ml > 0;
  const done = f.gym_day ? f.workout_logged : fuel;
  const progress = f.gym_day ? (f.workout_logged ? 1 : fuel ? 0.5 : 0) : (Number(f.diet_logged) + Number(f.water_ml > 0)) / 2;
  const proteinHit = f.protein_g >= c.targets.protein_low;
  const any = f.workout_logged || f.diet_logged || f.water_ml > 0 || f.weight_kg !== null;
  return {
    done,
    progress,
    level: lvl(done, progress, done && fuel && proteinHit, any),
    note: f.gym_day ? (f.workout_logged ? "Workout logged" : "Gym day: no workout yet") : `Diet ${f.diet_logged ? "✓" : "–"}, water ${f.water_ml} ml`,
  };
}

export function personaDay(f: DayFacts, c: RuleCtx): SectionDay {
  const eng = f.english_min >= c.targets.english_min;
  const rec = f.recordings > 0;
  const social = f.outreach_done && f.presence_ticks >= 3;
  const done = eng || rec || social;
  const progress = Math.min(1, Math.max(f.english_min / c.targets.english_min, rec ? 1 : 0, (Number(f.outreach_done) + Math.min(1, f.presence_ticks / 3)) / 2));
  const any = f.english_min > 0 || rec || f.outreach_done || f.presence_ticks > 0 || f.posts_published > 0 || f.conversations > 0;
  return { done, progress, level: lvl(done, progress, [eng, rec, social, f.posts_published > 0].filter(Boolean).length >= 2, any), note: `English ${f.english_min} min, ${f.recordings} recordings` };
}

export const SECTION_RULES: Record<SectionId, (f: DayFacts, c: RuleCtx) => SectionDay> = {
  career: careerDay,
  mind: mindDay,
  body: bodyDay,
  persona: personaDay,
};

export function sectionsDone(f: DayFacts, c: RuleCtx): Record<SectionId, SectionDay> {
  return { career: careerDay(f, c), mind: mindDay(f, c), body: bodyDay(f, c), persona: personaDay(f, c) };
}

/** Master grid level = number of sections done (0-4). */
export const masterLevel = (f: DayFacts, c: RuleCtx): 0 | 1 | 2 | 3 | 4 =>
  Object.values(sectionsDone(f, c)).filter((s) => s.done).length as 0 | 1 | 2 | 3 | 4;

/** A day counts for the overall streak when the review is submitted and ≥ 2 sections are done. */
export const overallCounts = (f: DayFacts, c: RuleCtx): boolean => f.review_submitted && masterLevel(f, c) >= 2;

export interface StreakInfo {
  current: number;
  best: number;
  missedYesterday: boolean; // the gentle "never miss twice" flag
  broken: boolean; // two misses in a row just reset it
}

/**
 * Streak with "never miss twice": a single missed day keeps the streak (but does not add to it);
 * two consecutive misses reset it. Today never breaks a streak while it is still in progress.
 */
export function streak(dates: ISODate[], counts: (d: ISODate) => boolean, todayIso: ISODate): StreakInfo {
  const sorted = [...dates].filter((d) => d <= todayIso).sort();
  let cur = 0;
  let best = 0;
  let misses = 0;
  let broken = false;
  for (const d of sorted) {
    if (counts(d)) {
      cur++;
      misses = 0;
      broken = false;
    } else if (d === todayIso) {
      // in progress: neutral
    } else {
      misses++;
      if (misses >= 2) {
        if (cur > 0) broken = true;
        cur = 0;
      }
    }
    best = Math.max(best, cur);
  }
  const y = addDays(todayIso, -1);
  const missedYesterday = sorted.includes(y) && !counts(y) && cur > 0;
  return { current: cur, best, missedYesterday, broken: broken && cur === 0 };
}

export interface GradeCheck {
  key: string;
  label: string;
  pass: boolean;
  detail: string;
}

export interface WeekInput {
  days: DayFacts[]; // Mon..Sun (may be partial for the live week)
  flashcardDays: number;
  stuckTarget: number | null;
  ctx: RuleCtx;
}

/** Weekly grade from 9 pass/fail checks (brief 06). */
export function weeklyGrade(w: WeekInput): { checks: GradeCheck[]; score: number; grade: "A" | "B" | "C" | "D" | "F"; rewardUnlocked: boolean } {
  const d = w.days;
  const count = (p: (f: DayFacts) => boolean) => d.filter(p).length;
  const gym = count((f) => f.workout_logged);
  const weighIn = d.some((f) => f.weight_kg !== null && dow(f.date) === 0);
  const block1 = count((f) => f.block1_min >= w.ctx.targets.block1_min);
  const push = count((f) => (f.pushes ?? 0) > 0);
  const reviews = count((f) => f.review_submitted);
  const outreachDays = count((f) => f.outreach_done);
  const posts = d.reduce((a, f) => a + f.posts_published, 0);
  const convos = d.reduce((a, f) => a + f.real_conversations, 0);
  const stuckMax = Math.max(0, ...d.map((f) => f.stuck_min));
  const stuckOk = w.stuckTarget === null ? true : stuckMax >= w.stuckTarget;
  const lightsLimit = timeToMin(w.ctx.targets.lights_out);
  const lights = count((f) => f.lights_out !== null && lateMin(timeToMin(f.lights_out)) <= lateMin(lightsLimit));
  const med = count((f) => f.meditation_min >= 5);
  const checks: GradeCheck[] = [
    { key: "gym", label: "Gym 3 of 3", pass: gym >= w.ctx.targets.gym_sessions_week, detail: `${gym}/${w.ctx.targets.gym_sessions_week}` },
    { key: "weigh_in", label: "Sunday weigh-in", pass: weighIn, detail: weighIn ? "logged" : "missing" },
    { key: "block1", label: "Block 1 ≥ 5 of 7", pass: block1 >= 5, detail: `${block1}/7` },
    { key: "push", label: "GitHub push ≥ 6 of 7", pass: push >= 6, detail: `${push}/7` },
    { key: "review", label: "Nightly review ≥ 6 of 7", pass: reviews >= 6, detail: `${reviews}/7` },
    { key: "outreach", label: "Outreach 5 days + 2 posts + 1 conversation", pass: outreachDays >= 5 && posts >= 2 && convos >= 1, detail: `${outreachDays}d · ${posts}p · ${convos}c` },
    { key: "flashcards", label: "Flashcards ≥ 5 days + stuck ladder", pass: w.flashcardDays >= 5 && stuckOk, detail: `${w.flashcardDays}d · stuck ${stuckMax}${w.stuckTarget ? `/${w.stuckTarget}` : ""}m` },
    { key: "lights_out", label: `Lights out by ${w.ctx.targets.lights_out} ≥ 5 nights`, pass: lights >= 5, detail: `${lights}/7` },
    { key: "meditation", label: "Meditation ≥ 5 days", pass: med >= 5, detail: `${med}/7` },
  ];
  const score = checks.filter((c) => c.pass).length;
  const grade = score >= 9 ? "A" : score >= 7 ? "B" : score >= 5 ? "C" : score >= 3 ? "D" : "F";
  const rewardUnlocked = checks[0].pass && checks[1].pass && checks[2].pass;
  return { checks, score, grade, rewardUnlocked };
}

/** Minutes after 18:00 so that 00:15 sorts after 23:50. */
function lateMin(m: number): number {
  return m < 12 * 60 ? m + 24 * 60 : m;
}
