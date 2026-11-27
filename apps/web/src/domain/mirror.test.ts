import { bookFile, journalFile, noteFile, postFile, safeName, weeklyFile } from "./mirror";
import type { Rows } from "@/data/types.gen";

const base = { id: "x1", created_at: "2026-11-30T10:00:00Z", updated_at: "2026-11-30T10:00:00Z", deleted_at: null };

describe("obsidian mirror markdown", () => {
  it("writes the nightly review to ONE/Journal/YYYY-MM-DD.md with front-matter and the ownership header", () => {
    const f = journalFile({ ...base, date: "2026-11-30", journal_good: "Shipped", journal_bad: "Slept late", journal_lesson: "Pack the bag", tomorrow_one_thing: "Tests", python_block1_min: 95, submitted_at: "2026-11-30T18:00:00Z" } as Rows["daily_reviews"]);
    expect(f.path).toEqual(["ONE", "Journal", "2026-11-30.md"]);
    expect(f.content).toMatch(/^---\nid: "x1"\ndate: "2026-11-30"/);
    expect(f.content).toContain("Managed by ONE");
    expect(f.content).toContain("## Lesson\nPack the bag");
  });
  it("names weekly files by ISO week and notes by topic folder", () => {
    expect(weeklyFile({ ...base, week_start: "2026-11-23", checks: { gym: true }, grade: "B", wins: ["a"], fails: [], priorities: [] } as unknown as Rows["weekly_grades"]).path).toEqual(["ONE", "Weekly", "2026-W48.md"]);
    expect(noteFile({ ...base, section: "career", title: "RAG: chunking?", topic: "LLM/RAG", body_md: "x", review_stage: 0 } as Rows["notes"]).path).toEqual(["ONE", "Career", "Notes", "LLM RAG", "RAG chunking.md"]);
    expect(postFile({ ...base, platform: "x", body: "Calling the API with raw requests!", status: "published", published_at: "2026-12-01", kind: "post" } as Rows["posts"]).path.at(-1)).toBe("2026-12-01-calling-the-api-with-raw-requests.md");
  });
  it("lists book sessions in date order and sanitises names", () => {
    const b = bookFile({ ...base, title: "Deep Work", author: "Cal Newport", status: "reading" } as Rows["books"], [
      { ...base, book_id: "x1", date: "2026-12-02", lesson: "b" },
      { ...base, book_id: "x1", date: "2026-12-01", lesson: "a | b" },
    ] as Rows["reading_sessions"][]);
    expect(b.content.indexOf("2026-12-01")).toBeLessThan(b.content.indexOf("2026-12-02"));
    expect(b.content).toContain("a / b");
    expect(safeName('a/b:c*?"d<e>|f.')).toBe("a b c d e f");
  });
});
