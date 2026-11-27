import { parseLeetcode } from "./routes/leetcode";
import { extractTitle, isPublicHost } from "./routes/linkTitle";
import { parseIsoDuration } from "./routes/video";
import { handle } from "./router";

describe("server helpers", () => {
  it("parses LeetCode GraphQL", () => {
    const j = { data: { matchedUser: { profile: { ranking: 123456 }, submitStatsGlobal: { acSubmissionNum: [{ difficulty: "All", count: 30 }, { difficulty: "Easy", count: 20 }, { difficulty: "Medium", count: 9 }, { difficulty: "Hard", count: 1 }] } } } };
    expect(parseLeetcode(j)).toEqual({ easy: 20, medium: 9, hard: 1, total: 30, ranking: 123456 });
    expect(parseLeetcode({ data: { matchedUser: null } })).toBeNull();
  });
  it("guards link-title against private hosts and extracts titles", () => {
    expect(isPublicHost("example.com")).toBe(true);
    for (const h of ["localhost", "127.0.0.1", "10.0.0.5", "192.168.1.1", "172.20.0.1", "169.254.169.254", "[::1]", "printer.local"]) expect(isPublicHost(h)).toBe(false);
    expect(extractTitle('<html><head><title>A &amp; B</title></head>')).toBe("A & B");
    expect(extractTitle('<meta property="og:title" content="OG wins"><title>x</title>')).toBe("OG wins");
  });
  it("parses YouTube ISO durations", () => {
    expect(parseIsoDuration("PT1H2M5S")).toBe(3725);
    expect(parseIsoDuration("PT45S")).toBe(45);
  });
  it("routes and 404s", async () => {
    expect((await handle({ method: "GET", path: "/api/health", query: new URLSearchParams(), headers: {}, body: undefined })).status).toBe(200);
    expect((await handle({ method: "GET", path: "/api/nope", query: new URLSearchParams(), headers: {}, body: undefined })).status).toBe(404);
  });
});
