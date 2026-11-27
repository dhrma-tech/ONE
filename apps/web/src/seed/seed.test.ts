import { db } from "@/data/db";
import { applySeed, SEED_VERSION } from "./seed";
import { SPEAKING_PROMPTS } from "./prompts";
import { QUOTES, quoteOfDay } from "./quotes";

beforeEach(async () => {
  await db.delete();
  await db.open();
});

describe("seed", () => {
  it("loads brief-17 content once and is idempotent", async () => {
    expect(await applySeed()).toBe(true);
    const habits = await db.t("habits").count();
    const stages = await db.t("path_stages").count();
    expect(habits).toBeGreaterThan(10);
    expect(stages).toBeGreaterThan(15);
    expect(await db.t("exercise_templates").where("template").equals("Full Body A").count()).toBe(6);
    expect((await db.t("meal_templates").toArray()).every((m) => m.is_estimate)).toBe(true);
    expect((await db.t("settings").toArray())[0].targets.water_ml).toBeNull();
    expect(await applySeed()).toBe(false);
    expect(await db.t("habits").count()).toBe(habits);
    expect((await db.meta.get("seed_version"))?.value).toBe(SEED_VERSION);
  });
  it("has 100 speaking prompts and ~60 quotes with a stable daily pick", () => {
    expect(SPEAKING_PROMPTS).toHaveLength(100);
    expect(new Set(SPEAKING_PROMPTS).size).toBe(100);
    expect(QUOTES.length).toBeGreaterThanOrEqual(60);
    expect(quoteOfDay("2026-11-29")).toEqual(quoteOfDay("2026-11-29"));
    expect(quoteOfDay("2026-11-29")).not.toEqual(quoteOfDay("2026-11-30"));
  });
});
