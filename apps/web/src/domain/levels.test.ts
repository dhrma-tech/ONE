import { levelFromXp, xpForLevel } from "./levels";

describe("levels", () => {
  it("follows 100 * n^1.5", () => {
    expect(xpForLevel(1)).toBe(100);
    expect(xpForLevel(2)).toBe(283);
    expect(xpForLevel(10)).toBe(3162);
  });
  it("computes level from total xp", () => {
    expect(levelFromXp(0)).toMatchObject({ level: 1, into: 0, need: 100 });
    expect(levelFromXp(100)).toMatchObject({ level: 2, into: 0 });
    expect(levelFromXp(382)).toMatchObject({ level: 2, into: 282 });
    expect(levelFromXp(383)).toMatchObject({ level: 3, into: 0 });
    expect(levelFromXp(-5).level).toBe(1);
  });
});
