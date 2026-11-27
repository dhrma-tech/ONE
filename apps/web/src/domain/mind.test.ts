import { ao5, fmtMs, ladderTarget, makeProblem, scramble, sm2, todaysCards, type Sm2Card } from "./mind";

const fresh: Sm2Card = { ef: 2.5, interval_days: 0, reps: 0, lapses: 0, due_at: null, is_new: true };

describe("SM-2", () => {
  it("schedules 1, 6, then interval × EF", () => {
    const a = sm2(fresh, 4, "2026-12-01");
    expect(a).toMatchObject({ interval_days: 1, reps: 1, due_at: "2026-12-02", is_new: false });
    const b = sm2(a, 4, "2026-12-02");
    expect(b).toMatchObject({ interval_days: 6, reps: 2, due_at: "2026-12-08" });
    const c = sm2(b, 5, "2026-12-08");
    expect(c.interval_days).toBe(Math.round(6 * b.ef));
    expect(c.ef).toBeGreaterThan(b.ef);
  });
  it("resets on a lapse and floors EF at 1.3", () => {
    let c = { ...fresh, ef: 1.35, interval_days: 20, reps: 5 };
    c = sm2(c, 1, "2026-12-01");
    expect(c).toMatchObject({ interval_days: 1, reps: 0, lapses: 1, due_at: "2026-12-02" });
    expect(c.ef).toBe(1.3);
  });
  it("caps new cards per day", () => {
    const cards = [
      { id: "d1", ...fresh, is_new: false, due_at: "2026-11-30" },
      { id: "d2", ...fresh, is_new: false, due_at: "2026-12-05" },
      ...Array.from({ length: 8 }, (_, i) => ({ id: `n${i}`, ...fresh, created_at: `2026-11-0${i + 1}` })),
    ];
    const t = todaysCards(cards, "2026-12-01", 5, 2);
    expect(t.map((c) => c.id)).toEqual(["d1", "n0", "n1", "n2"]);
  });
});

describe("cube + math + ladder", () => {
  it("makes valid scrambles", () => {
    let seed = 1;
    const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    const s = scramble(25, rnd).split(" ");
    expect(s).toHaveLength(25);
    for (let i = 1; i < s.length; i++) expect(s[i][0]).not.toBe(s[i - 1][0]);
  });
  it("computes ao5 with DNFs", () => {
    expect(ao5([10000, 12000, 11000, 9000, 15000])).toBe(11000);
    expect(ao5([10000, null, 11000, 9000, 15000])).toBe(12000);
    expect(ao5([null, null, 1, 2, 3])).toBeNull();
    expect(ao5([1, 2, 3])).toBeNull();
    expect(fmtMs(83450)).toBe("1:23.45");
    expect(fmtMs(null)).toBe("DNF");
  });
  it("generates drills with correct answers", () => {
    for (const k of ["tables", "squares", "2x1", "2x2"] as const) {
      const p = makeProblem(k);
      expect(p.answer).toBe(p.op === "²" ? p.a * p.a : p.a * p.b);
    }
  });
  it("finds the ladder target for a week", () => {
    const rows = [
      { week_start: "2026-11-23", target_min: 15 },
      { week_start: "2026-11-30", target_min: 20 },
    ];
    expect(ladderTarget(rows, "2026-12-07")).toBe(20);
    expect(ladderTarget(rows, "2026-11-23")).toBe(15);
    expect(ladderTarget(rows, "2026-11-16")).toBeNull();
  });
});
