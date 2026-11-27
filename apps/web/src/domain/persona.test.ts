import { baselineDue, extFor, ladderRung, nextBaseline, parseSkills, pickRecorderMime, postHints, topSkills, xIntentUrl, xLength } from "./persona";

describe("posts", () => {
  it("counts X URLs as 23 characters", () => {
    expect(xLength("hello")).toBe(5);
    expect(xLength("see https://example.com/a/very/long/path/that/goes/on")).toBe(4 + 23);
  });
  it("hints against hashtags, day-N posts, overlong text and job asks", () => {
    expect(postHints("linkedin", "Built a RAG thing #ai")).toContain("No hashtags on LinkedIn.");
    expect(postHints("x", "Day 12 of learning Python")[0]).toMatch(/day N/);
    expect(postHints("x", "x".repeat(281))).toContain("Over 280 characters.");
    expect(postHints("linkedin", "Any internship openings?")[0]).toMatch(/job ask/);
    expect(postHints("linkedin", "Shipped my first raw API call.")).toEqual([]);
  });
  it("builds the X intent fallback", () => {
    expect(xIntentUrl("a b&c")).toBe("https://twitter.com/intent/tweet?text=a%20b%26c");
  });
});

describe("speaking + ladder + intel", () => {
  it("schedules baseline redos at day 30, 60, 90", () => {
    expect(baselineDue(null, [], "2026-12-01")).toBe(0);
    expect(baselineDue("2026-11-01", [0], "2026-11-20")).toBeNull();
    expect(baselineDue("2026-11-01", [0], "2026-12-01")).toBe(30);
    expect(baselineDue("2026-11-01", [0, 30], "2027-01-31")).toBe(60);
    expect(nextBaseline("2026-11-01", [0, 30])).toEqual({ day: 60, date: "2026-12-31" });
  });
  it("suggests the ladder rung by week", () => {
    expect(ladderRung("2026-11-27", "2026-11-27")).toBe(1);
    expect(ladderRung("2026-11-27", "2026-12-12")).toBe(3);
    expect(ladderRung("2026-11-27", "2027-03-01")).toBe(4);
  });
  it("tallies skills case-insensitively", () => {
    const t = topSkills([{ skills: ["Python", "RAG"] }, { skills: ["python", "LangChain"] }, { skills: ["RAG", "Python "] }]);
    expect(t[0]).toEqual({ skill: "Python", count: 3 });
    expect(t[1]).toEqual({ skill: "RAG", count: 2 });
    expect(parseSkills("Python, RAG;  evals\nPython")).toEqual(["Python", "RAG", "evals"]);
  });
  it("picks a recorder MIME per browser", () => {
    expect(pickRecorderMime((m) => m.startsWith("audio/webm"))).toBe("audio/webm;codecs=opus");
    expect(pickRecorderMime((m) => m === "audio/mp4")).toBe("audio/mp4");
    expect(pickRecorderMime(() => false)).toBeNull();
    expect(extFor("audio/mp4")).toBe("m4a");
  });
});
