import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { db } from "@/data/db";
import { emptyFacts } from "@/domain/facts";
import { DEFAULT_TARGETS } from "@/domain/targets";
import { NightlyReview, autoFill, mergeReview } from "./review";

beforeEach(async () => {
  await db.delete();
  await db.open();
});

describe("nightly review", () => {
  const facts = { ...emptyFacts("2026-11-30", DEFAULT_TARGETS), block1_min: 95, diet_logged: true, calories: 2400, protein_g: 92, water_ml: 2500 };

  it("auto-fills from the day's logs and lets saved values win", () => {
    const a = autoFill(facts);
    expect(a).toMatchObject({ gym_status: "missed", python_block1_min: 95, calories: 2400, protein_g: 92, water_ml: 2500 });
    expect(mergeReview({ calories: 2600, protein_g: null }, a)).toMatchObject({ calories: 2600, protein_g: 92 });
  });

  it("submits: saves the row, awards XP and keeps auto values editable", async () => {
    const onSubmitted = vi.fn();
    render(<NightlyReview date="2026-11-30" facts={facts} onSubmitted={onSubmitted} />);
    const block1 = await screen.findByLabelText("Block 1 (min)");
    await waitFor(() => expect(block1).toHaveValue("95"));
    fireEvent.change(screen.getByLabelText("Went well"), { target: { value: "Shipped the parser" } });
    fireEvent.change(screen.getByLabelText("Tomorrow's One Thing"), { target: { value: "Write tests" } });
    fireEvent.change(block1, { target: { value: "100" } });
    fireEvent.click(screen.getByRole("button", { name: /submit review/i }));
    await waitFor(() => expect(onSubmitted).toHaveBeenCalled());
    const row = (await db.t("daily_reviews").toArray())[0];
    expect(row).toMatchObject({ date: "2026-11-30", journal_good: "Shipped the parser", tomorrow_one_thing: "Write tests", python_block1_min: 100 });
    expect(row.submitted_at).toBeTruthy();
    const xp = await db.t("xp_events").toArray();
    expect(xp.some((e) => e.kind === "review_submitted" && e.points === 30)).toBe(true);
  });
});
