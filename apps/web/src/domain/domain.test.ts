import { buildFacts, emptyFacts, type FactRows } from "./facts";
import { bodyDay, careerDay, masterLevel, mindDay, personaDay, streak, weeklyGrade, type RuleCtx } from "./rules";
import { DEFAULT_TARGETS } from "./targets";
import { focusXp, totals } from "./xp";
import { ACHIEVEMENTS, newlyUnlocked, type AchStats } from "./achievements";
import { followUpDate, generateTasks } from "./taskgen";
import { range } from "@/lib/dates";
import type { Rows } from "@/data/types.gen";

const ctx: RuleCtx = { targets: DEFAULT_TARGETS, examMode: false };
const F = (date: string, p: Partial<ReturnType<typeof emptyFacts>> = {}) => ({ ...emptyFacts(date, DEFAULT_TARGETS), ...p });

describe("done rules", () => {
  it("career: Block 1 ≥ 90 or exam study ≥ 120", () => {
    expect(careerDay(F("2026-11-30", { block1_min: 89 }), ctx).done).toBe(false);
    expect(careerDay(F("2026-11-30", { block1_min: 90 }), ctx).done).toBe(true);
    expect(careerDay(F("2026-11-30", { block1_min: 150 }), ctx).level).toBe(4);
    expect(careerDay(F("2026-11-30", { career_min: 130 }), { ...ctx, examMode: true }).done).toBe(true);
    expect(careerDay(F("2026-11-30", { block1_min: 50 }), ctx).level).toBe(2);
  });
  it("mind: meditation ≥ 5 or two extras", () => {
    expect(mindDay(F("2026-11-30", { meditation_min: 5 }), ctx).done).toBe(true);
    expect(mindDay(F("2026-11-30", { flashcard_reviews: 12, reading_sessions: 1 }), ctx).done).toBe(true);
    expect(mindDay(F("2026-11-30", { flashcard_reviews: 12 }), ctx).done).toBe(false);
  });
  it("body: workout on gym days, diet + water otherwise", () => {
    expect(bodyDay(F("2026-11-30", { workout_logged: true }), ctx).done).toBe(true); // Monday
    expect(bodyDay(F("2026-11-30", { diet_logged: true, water_ml: 500 }), ctx).done).toBe(false);
    expect(bodyDay(F("2026-12-01", { diet_logged: true, water_ml: 500 }), ctx).done).toBe(true); // Tuesday
  });
  it("persona: english ≥ 10, a recording, or outreach + 3 presence ticks", () => {
    expect(personaDay(F("2026-11-30", { english_min: 10 }), ctx).done).toBe(true);
    expect(personaDay(F("2026-11-30", { recordings: 1 }), ctx).done).toBe(true);
    expect(personaDay(F("2026-11-30", { outreach_done: true, presence_ticks: 2 }), ctx).done).toBe(false);
    expect(personaDay(F("2026-11-30", { outreach_done: true, presence_ticks: 3 }), ctx).done).toBe(true);
  });
  it("master level counts sections done", () => {
    expect(masterLevel(F("2026-12-01", { block1_min: 95, meditation_min: 10, english_min: 12 }), ctx)).toBe(3);
  });
});

describe("streaks: never miss twice", () => {
  const dates = range("2026-11-01", "2026-11-10");
  it("keeps the streak through one miss and breaks on two", () => {
    const yes = new Set(["2026-11-01", "2026-11-02", "2026-11-04", "2026-11-05"]);
    const s = streak(dates.slice(0, 5), (d) => yes.has(d), "2026-11-05");
    expect(s.current).toBe(4);
    const s2 = streak(dates.slice(0, 7), (d) => yes.has(d), "2026-11-08");
    expect(s2.current).toBe(0);
  });
  it("flags a single miss yesterday and ignores an unfinished today", () => {
    const yes = new Set(["2026-11-01", "2026-11-02"]);
    const s = streak(dates.slice(0, 4), (d) => yes.has(d), "2026-11-04");
    expect(s.current).toBe(2);
    expect(s.missedYesterday).toBe(true);
  });
});

describe("weekly grade", () => {
  const week = range("2026-11-23", "2026-11-29"); // Mon..Sun
  it("scores an A with all 9 checks", () => {
    const days = week.map((d, i) =>
      F(d, {
        workout_logged: [0, 2, 4].includes(i),
        weight_kg: i === 6 ? 50.8 : null,
        block1_min: 95,
        pushes: 1,
        review_submitted: true,
        outreach_done: true,
        posts_published: i < 2 ? 1 : 0,
        real_conversations: i === 3 ? 1 : 0,
        lights_out: "00:10",
        meditation_min: 10,
        stuck_min: 20,
      }),
    );
    const g = weeklyGrade({ days, flashcardDays: 6, stuckTarget: 20, ctx });
    expect(g.score).toBe(9);
    expect(g.grade).toBe("A");
    expect(g.rewardUnlocked).toBe(true);
  });
  it("maps scores to grades and the reward rule", () => {
    const days = week.map((d) => F(d, { block1_min: 95, meditation_min: 10, lights_out: "01:30" }));
    const g = weeklyGrade({ days, flashcardDays: 0, stuckTarget: null, ctx });
    expect(g.score).toBe(2); // block1 + meditation
    expect(g.grade).toBe("F");
    expect(g.rewardUnlocked).toBe(false);
  });
});

describe("facts", () => {
  it("aggregates rows into days", () => {
    const empty = Object.fromEntries(
      ["focus_sessions", "tasks", "meditation_sessions", "flashcard_reviews", "reading_sessions", "chess_events", "workouts", "diet_logs", "water_logs", "weigh_ins", "persona_daily", "speaking_recordings", "contacts", "presence_ticks", "posts", "github_snapshots", "daily_reviews", "problem_log", "video_progress", "xp_events", "units", "chess_snapshots"].map((k) => [k, []]),
    ) as unknown as FactRows;
    const rows = {
      ...empty,
      focus_sessions: [{ date: "2026-11-30", section: "career", kind: "block1", minutes: 60, phone_free: true }, { date: "2026-11-30", section: "career", kind: "block1", minutes: 40, phone_free: false }] as Rows["focus_sessions"][],
      water_logs: [{ date: "2026-11-30", ml: 250 }, { date: "2026-11-30", ml: 500 }] as Rows["water_logs"][],
      contacts: [{ sent_at: "2026-11-30", status: "sent" }] as Rows["contacts"][],
    };
    const f = buildFacts(["2026-11-30"], rows, DEFAULT_TARGETS).get("2026-11-30")!;
    expect(f.block1_min).toBe(100);
    expect(f.phone_free_max).toBe(60);
    expect(f.water_ml).toBe(750);
    expect(f.outreach_done).toBe(true);
    expect(f.gym_day).toBe(true);
  });
});

describe("xp + achievements", () => {
  it("caps focus xp at 90/day", () => {
    expect(focusXp(90, 0)).toBe(45);
    expect(focusXp(200, 60)).toBe(30);
    expect(totals([{ section: "career", points: 10 }, { section: "mind", points: 5 }]).bySection.career).toBe(10);
  });
  it("unlocks only new achievements", () => {
    const base: AchStats = { pushDays: 1, block1Days: 0, overallStreak: 0, bestStreak: 0, reviews: 0, unitsCracked: 0, rapid: null, puzzlesSolved: 0, meditationStreak: 0, meditationSessions: 0, workouts: 0, weightGain: null, proteinWeek: false, postsPublished: 0, realConversations: 0, connections: 0, recordings: 0, booksFinished: 0, gradeA: false, level: 1 };
    expect(newlyUnlocked(base, new Set()).map((a) => a.code)).toEqual(["first_push"]);
    expect(newlyUnlocked(base, new Set(["first_push"]))).toEqual([]);
    expect(ACHIEVEMENTS.length).toBeGreaterThanOrEqual(25);
    expect(new Set(ACHIEVEMENTS.map((a) => a.code)).size).toBe(ACHIEVEMENTS.length);
  });
});

describe("task generation", () => {
  it("creates habit, path, note, follow-up tasks once", () => {
    const habit = { id: "h1", section: "career", title: "Block 1", days: [1], active: true, order_no: 1 } as Rows["habits"];
    const stage = { id: "s1", section: "career", status: "active", deleted_at: null } as Rows["path_stages"];
    const items = [{ id: "i2", stage_id: "s1", order_no: 2, status: "todo", title: "B", deleted_at: null }, { id: "i1", stage_id: "s1", order_no: 1, status: "todo", title: "A", deleted_at: null }] as Rows["path_items"][];
    const notes = [{ id: "n1", section: "career", title: "RAG", next_review_at: "2026-11-29", review_stage: 1 }] as Rows["notes"][];
    const contacts = [{ id: "c1", name: "Asha", status: "accepted", follow_up_at: "2026-11-30" }] as Rows["contacts"][];
    const g = generateTasks({ date: "2026-11-30", habits: [habit], stages: [stage], items, notes, contacts, existingRefs: new Set(), examMode: false, minimal: false, oneThing: "Ship the parser" });
    expect(g.map((t) => t.source)).toEqual(["review", "habit", "path", "note", "followup"]);
    expect(g.find((t) => t.source === "path")!.title).toBe("A");
    expect(g[0].is_one_thing).toBe(true);
    const again = generateTasks({ date: "2026-11-30", habits: [habit], stages: [stage], items, notes, contacts, existingRefs: new Set(g.map((t) => t.source_ref)), examMode: false, minimal: false });
    expect(again).toEqual([]);
  });
  it("schedules follow-ups 2-3 days after acceptance, skipping Sunday", () => {
    expect(followUpDate("2026-11-30")).toBe("2026-12-02");
    expect(followUpDate("2026-11-27")).toBe("2026-11-30"); // Fri + 2 = Sun → Mon
  });
});
