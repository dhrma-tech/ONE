import { isDeload, lastSets, missedSessions, nextSession, personalRecords, prCount, progressionHint, trainingWeek, weightRate, type Template } from "./body";

const T: Template = { exercise: "Leg press", sets: 3, rep_low: 8, rep_high: 12, unit: "reps", weight_step: 5, order_no: 0 };

describe("rotation + pre-fill", () => {
  it("alternates A and B", () => {
    expect(nextSession([])).toBe("Full Body A");
    expect(nextSession([{ id: "1", date: "2026-12-01", session: "Full Body A" }])).toBe("Full Body B");
    expect(nextSession([{ id: "1", date: "2026-12-01", session: "Full Body A" }, { id: "2", date: "2026-12-03", session: "Full Body B" }])).toBe("Full Body A");
  });
  it("finds the most recent sets for an exercise", () => {
    const ws = [{ id: "w1", date: "2026-12-01", session: "A" }, { id: "w2", date: "2026-12-05", session: "A" }];
    const sets = [
      { workout_id: "w1", exercise: "Leg press", set_no: 1, reps: 10, weight_kg: 40 },
      { workout_id: "w2", exercise: "Leg press", set_no: 2, reps: 9, weight_kg: 45 },
      { workout_id: "w2", exercise: "Leg press", set_no: 1, reps: 10, weight_kg: 45 },
    ];
    expect(lastSets("Leg press", ws, sets).map((s) => s.set_no)).toEqual([1, 2]);
  });
});

describe("progression hints", () => {
  it("adds the smallest weight jump when every set hit the top", () => {
    const h = progressionHint(T, [1, 2, 3].map((n) => ({ exercise: "Leg press", set_no: n, reps: 12, weight_kg: 40 })));
    expect(h).toMatchObject({ kind: "weight", weight: 45, reps: 8 });
  });
  it("otherwise asks for +1 rep at the same weight", () => {
    const h = progressionHint(T, [12, 11, 9].map((r, i) => ({ exercise: "Leg press", set_no: i + 1, reps: r, weight_kg: 40 })));
    expect(h).toMatchObject({ kind: "reps", weight: 40, reps: 10 });
  });
  it("handles first sessions and timed holds", () => {
    expect(progressionHint(T, []).kind).toBe("start");
    const plank = { ...T, exercise: "Plank", rep_low: 30, rep_high: 30, unit: "seconds" };
    expect(progressionHint(plank, [1, 2, 3].map((n) => ({ exercise: "Plank", set_no: n, reps: 30, weight_kg: null }))).reps).toBe(35);
  });
});

describe("PRs", () => {
  it("detects a heavier or more-reps best set", () => {
    const sets = [
      { workout_id: "w1", date: "2026-12-01", exercise: "Bench", set_no: 1, reps: 8, weight_kg: 20 },
      { workout_id: "w2", date: "2026-12-03", exercise: "Bench", set_no: 1, reps: 8, weight_kg: 22.5 },
      { workout_id: "w3", date: "2026-12-05", exercise: "Bench", set_no: 1, reps: 6, weight_kg: 22.5 },
    ];
    expect(personalRecords(sets, "w2")).toEqual([{ exercise: "Bench", weight_kg: 22.5, reps: 8 }]);
    expect(personalRecords(sets, "w3")).toEqual([]);
    expect(prCount(sets)).toBe(1);
  });
});

describe("weight rate + schedule", () => {
  it("flags slow and fast gains", () => {
    expect(weightRate([{ date: "2026-11-01", weight_kg: 50 }, { date: "2026-11-15", weight_kg: 50.2 }]).tone).toBe("low");
    expect(weightRate([{ date: "2026-11-01", weight_kg: 50 }, { date: "2026-11-15", weight_kg: 51.6 }]).tone).toBe("high");
    expect(weightRate([{ date: "2026-11-01", weight_kg: 50 }, { date: "2026-11-15", weight_kg: 50.7 }]).tone).toBe("ok");
    expect(weightRate([{ date: "2026-11-01", weight_kg: 50 }]).perWeek).toBeNull();
  });
  it("deloads every 5th week", () => {
    expect(trainingWeek("2026-11-30", "2026-12-28")).toBe(5);
    expect(isDeload("2026-11-30", "2026-12-28")).toBe(true);
    expect(isDeload("2026-11-30", "2026-12-21")).toBe(false);
  });
  it("never miss twice on scheduled days (makeup the next day counts)", () => {
    // Mon 30 Nov, Wed 2 Dec, Fri 4 Dec scheduled; today Sat 5 Dec
    const one = missedSessions([1, 3, 5], new Set(["2026-11-30", "2026-12-02"]), "2026-11-30", "2026-12-05");
    expect(one).toMatchObject({ missedLast: true, missedTwice: false });
    const two = missedSessions([1, 3, 5], new Set(["2026-11-30"]), "2026-11-30", "2026-12-05");
    expect(two.missedTwice).toBe(true);
    const makeup = missedSessions([1, 3, 5], new Set(["2026-12-01", "2026-12-03", "2026-12-04"]), "2026-11-30", "2026-12-05");
    expect(makeup.missed).toEqual([]);
  });
});
