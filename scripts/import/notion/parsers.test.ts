import { join } from "node:path";
import { contactsFromCsv, hackathonsFromMarkdown, parseCsv, parseDate, xFollowsFromCsv } from "./parsers";
import { parseExport } from "./index";

describe("notion parsers", () => {
  it("parses RFC 4180 CSV with quotes, escaped quotes and BOM", () => {
    const rows = parseCsv('﻿Name,Note\n"Rao, Asha","said ""hi""\nthen left"\nB,x\n');
    expect(rows).toEqual([{ Name: "Rao, Asha", Note: 'said "hi"\nthen left' }, { Name: "B", Note: "x" }]);
  });
  it("parses Notion dates", () => {
    expect(parseDate("October 12, 2026")).toBe("2026-10-12");
    expect(parseDate("2026-10-12 → 2026-10-14")).toBe("2026-10-12");
    expect(parseDate("12/10/2026")).toBe("2026-10-12");
    expect(parseDate("someday")).toBeNull();
  });
  it("maps contact CSV columns and marks URLs unverified unless stated", () => {
    const c = contactsFromCsv(parseCsv("Name,Title,Company,Tier,LinkedIn,Status\nAsha,ML Eng,Acme,Tier A,https://www.linkedin.com/in/Asha-X/,Accepted\n"));
    expect(c[0]).toMatchObject({ name: "Asha", tier: "A", status: "accepted", verified: false, linkedin_url: "https://www.linkedin.com/in/asha-x" });
  });
  it("cleans X handles from URLs", () => {
    expect(xFollowsFromCsv(parseCsv("Handle,Name\nhttps://x.com/some_one?s=1,Some One\n"))[0].handle).toBe("some_one");
  });
  it("flags link-only hackathons as needing details", () => {
    const h = hackathonsFromMarkdown("- https://lnkd.in/abc\n- SIH / 2026-12-01 / team");
    expect(h[0]).toMatchObject({ needs_details: true, url: "https://lnkd.in/abc" });
    expect(h[1]).toMatchObject({ name: "SIH", deadline: "2026-12-01", needs_details: false });
  });
});

describe("export folder", () => {
  it("classifies files, parses and dedupes (dry-run data)", () => {
    const p = parseExport(join(import.meta.dirname, "fixtures", "export"));
    expect(p.contacts).toHaveLength(3); // duplicate Asha removed by normalised LinkedIn URL
    expect(p.contacts[0]).toMatchObject({ name: "Asha Rao", title: "ML Engineer", company: "Acme AI", tier: "A", verified: false });
    expect(p.contacts.find((c) => c.name === "Meera Iyer")).toMatchObject({ status: "accepted", tier: "C", linkedin_url: null });
    expect(p.x_follows.map((x) => x.handle)).toEqual(["testhandle_one", "second_test"]);
    expect(p.x_follows[0]).toMatchObject({ name: "Jane Doe", company: "Example AI", followed_at: "2026-10-12", first_reply: "Loved the chunking thread" });
    expect(p.website_ideas).toEqual([
      { title: "Study timer for hostels", description: 'A shared "quiet hours" board', status: "idea", idea_date: "2026-10-03" },
      { title: "PYQ finder", description: "Search previous papers by unit", status: "validating", idea_date: "2026-10-05" },
    ]);
    expect(p.hackathons).toHaveLength(3);
    expect(p.hackathons.find((h) => h.url?.includes("lnkd.in"))?.needs_details).toBe(true);
    expect(p.hackathons.find((h) => h.name === "AI Build Week")).toMatchObject({ url: "https://example.com/build-week", deadline: "2026-11-20" });
  });
});
