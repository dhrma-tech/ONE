import { gpa, gradeFor, mostAsked, planMilestones, subjectResult, type ScaleRow } from "./college";
import { firstReview, gradeReview, pickNews, type NewsIn } from "./career";
import { renderMarkdown } from "@/lib/markdown";

const scale: ScaleRow[] = [
  { min_pct: 91, grade: "AA", points: 10 },
  { min_pct: 81, grade: "AB", points: 9 },
  { min_pct: 71, grade: "BB", points: 8 },
  { min_pct: 61, grade: "BC", points: 7 },
  { min_pct: 51, grade: "CC", points: 6 },
  { min_pct: 46, grade: "CD", points: 5 },
  { min_pct: 40, grade: "DD", points: 4 },
  { min_pct: 0, grade: "FF", points: 0 },
];
const th = (ca: number | null, mse: number | null, ese: number | null) => ({ kind: "theory", credits: 3, ca, mse, ese, has_ese: true });

describe("college marks", () => {
  it("passes theory with ≥ 40 overall and ≥ 20/60 ESE", () => {
    const r = subjectResult(th(15, 15, 30), scale);
    expect(r).toMatchObject({ total: 60, pass: true, grade: "CC", points: 6 });
  });
  it("fails on ESE below 20 even with a good total", () => {
    const r = subjectResult(th(20, 20, 19), scale);
    expect(r.pass).toBe(false);
    expect(r.points).toBe(0);
    expect(r.warn).toMatch(/ESE below 20/);
  });
  it("warns before the ESE how much is needed", () => {
    expect(subjectResult(th(8, 6, null), scale).warn).toMatch(/Need 26\/60/);
    expect(subjectResult(th(2, 2, null), scale).warn).toMatch(/Start now/);
  });
  it("handles practicals (CA 60 + ESE 40) and close calls", () => {
    expect(subjectResult({ kind: "practical", credits: 1, ca: 30, mse: null, ese: 12, has_ese: true }, scale)).toMatchObject({ total: 42, pass: true, warn: "Close to failing. Too close." });
  });
  it("computes SGPA weighted by credits", () => {
    expect(gpa([{ credits: 4, points: 8 }, { credits: 2, points: 5 }, { credits: 0, points: 10 }, { credits: 3, points: null }])).toBe(7);
    expect(gpa([])).toBeNull();
    expect(gradeFor(72, scale)?.grade).toBe("BB");
  });
});

describe("milestone planner", () => {
  it("makes 4-day blocks and schedules units before their exam", () => {
    const units = [
      { id: "m1", subject_id: "math", number: 1, importance: 1, examDate: "2026-12-10" },
      { id: "m2", subject_id: "math", number: 2, importance: 1, examDate: "2026-12-10" },
      { id: "e1", subject_id: "elec", number: 1, importance: 2, examDate: "2026-12-14" },
      { id: "e2", subject_id: "elec", number: 2, importance: 2, examDate: "2026-12-14" },
    ];
    const blocks = planMilestones(units, "2026-12-01");
    expect(blocks[0].start_date).toBe("2026-12-01");
    expect(blocks[0].end_date).toBe("2026-12-04");
    const where = (id: string) => blocks.find((b) => b.unit_ids.includes(id))!;
    expect(where("m2").end_date < "2026-12-10").toBe(true);
    expect(where("m1").start_date <= where("e1").start_date).toBe(true);
    expect(blocks.flatMap((b) => b.unit_ids).sort()).toEqual(["e1", "e2", "m1", "m2"]);
  });
  it("tallies most-asked units", () => {
    expect(mostAsked([{ unit_id: "u1", repeat_count: 2 }, { unit_id: "u1", repeat_count: 1 }, { unit_id: null, repeat_count: 5 }]).get("u1")).toBe(3);
  });
});

describe("notes review + news cap", () => {
  it("schedules 3/7/30/90 and graduates", () => {
    expect(firstReview("2026-11-27")).toEqual({ next_review_at: "2026-11-30", review_stage: 0 });
    expect(gradeReview(0, true, "2026-11-30")).toEqual({ next_review_at: "2026-12-07", review_stage: 1 });
    expect(gradeReview(3, true, "2027-01-01").next_review_at).toBeNull();
    expect(gradeReview(2, false, "2026-12-01")).toEqual({ next_review_at: "2026-12-02", review_stage: 0 });
  });
  it("never returns more than 10 news items per day", () => {
    const mk = (i: number, g: string): NewsIn => ({ id: `${g}${i}`, s: g, sn: g, g, t: `t${i}`, u: `https://x.com/${g}/${i}`, ts: 1, sc: 100 - i });
    const items = [...Array.from({ length: 20 }, (_, i) => mk(i, "hn")), ...Array.from({ length: 5 }, (_, i) => mk(i, "research")), ...Array.from({ length: 5 }, (_, i) => mk(i, "community"))];
    const p = pickNews(items);
    expect(p).toHaveLength(10);
    expect(p.filter((x) => x.g === "research").length).toBeGreaterThanOrEqual(3);
    expect(pickNews(items, Array.from({ length: 8 }, (_, i) => `https://x.com/z/${i}`))).toHaveLength(2);
    expect(pickNews(items, Array.from({ length: 10 }, (_, i) => `https://x.com/z/${i}`))).toHaveLength(0);
  });
});

describe("markdown", () => {
  it("escapes HTML and renders a safe subset", () => {
    const h = renderMarkdown("# Title\n\n- **bold** and `code`\n- [link](https://a.b)\n\n<script>x</script>");
    expect(h).toContain("<h2>Title</h2>");
    expect(h).toContain("<strong>bold</strong>");
    expect(h).toContain('<a href="https://a.b"');
    expect(h).not.toContain("<script>");
    expect(renderMarkdown("[x](javascript:alert(1))")).not.toContain("href");
  });
});
