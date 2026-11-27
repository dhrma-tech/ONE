import { addDays, daysBetween, dow, isoDate, isoWeek, reviewDate, weekStart, range, fmtMin } from "./dates";

describe("dates (IST)", () => {
  it("formats IST date across UTC midnight", () => {
    // 2026-11-27 20:00 UTC = 2026-11-28 01:30 IST
    expect(isoDate(new Date("2026-11-27T20:00:00Z"))).toBe("2026-11-28");
  });
  it("does arithmetic", () => {
    expect(addDays("2026-12-31", 1)).toBe("2027-01-01");
    expect(daysBetween("2026-11-01", "2026-11-27")).toBe(26);
    expect(dow("2026-11-27")).toBe(5); // Friday
    expect(weekStart("2026-11-29")).toBe("2026-11-23"); // Sunday -> Monday
    expect(range("2026-11-01", "2026-11-03")).toEqual(["2026-11-01", "2026-11-02", "2026-11-03"]);
    expect(isoWeek("2026-11-27")).toBe("2026-W48");
  });
  it("assigns late-night reviews to the previous day", () => {
    // 00:30 IST on the 28th = 19:00 UTC on the 27th
    expect(reviewDate(new Date("2026-11-27T19:00:00Z"))).toBe("2026-11-27");
    expect(reviewDate(new Date("2026-11-27T17:00:00Z"))).toBe("2026-11-27"); // 22:30 IST
  });
  it("formats minutes", () => {
    expect(fmtMin(45)).toBe("45m");
    expect(fmtMin(90)).toBe("1h 30m");
    expect(fmtMin(120)).toBe("2h");
  });
});
