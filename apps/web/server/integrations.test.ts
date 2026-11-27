import { decrypt, encrypt, signState, verifyState } from "./crypto";
import { eventId, toGoogle } from "./routes/google";
import { countPushes } from "./routes/github";
import { pickChannel } from "./routes/buffer";
import { corsFor, publicStats } from "./routes/publicStats";
import { parseGame, parseStats } from "./routes/chesscom";
import { handle } from "./router";

const K = Buffer.alloc(32, 7);

describe("crypto", () => {
  it("round-trips AES-GCM and rejects tampering", () => {
    const box = encrypt("refresh-token-123", K);
    expect(decrypt(box, K)).toBe("refresh-token-123");
    expect(() => decrypt({ ...box, ciphertext: Buffer.from("x").toString("base64") }, K)).toThrow();
  });
  it("signs and verifies OAuth state", () => {
    const s = signState({ uid: "u1" }, 60, K);
    expect(verifyState<{ uid: string }>(s, K)?.uid).toBe("u1");
    expect(verifyState(s.replace(/.$/, (c) => (c === "A" ? "B" : "A")), K)).toBeNull();
    expect(verifyState(signState({ uid: "u1" }, -1, K), K)).toBeNull();
  });
});

describe("google calendar mapping", () => {
  it("makes stable base32hex-safe ids and only reminds for the review", () => {
    expect(eventId("review")).toBe(eventId("review"));
    expect(eventId("review")).toMatch(/^[0-9a-v]{5,1024}$/);
    const review = toGoogle({ key: "review", summary: "Nightly review", start: "2026-12-01T23:30", end: "2026-12-02T00:00", rrule: "RRULE:FREQ=DAILY", reminder: true });
    expect(review.reminders.overrides).toEqual([{ method: "popup", minutes: 0 }]);
    expect(review.start).toEqual({ dateTime: "2026-12-01T23:30:00", timeZone: "Asia/Kolkata" });
    const gym = toGoogle({ key: "gym", summary: "Gym", start: "2026-12-02T06:30", end: "2026-12-02T07:30" });
    expect(gym.reminders.overrides).toEqual([]);
    const exam = toGoogle({ key: "exam:1", summary: "Maths ESE", start: "2026-12-10" });
    expect(exam.start).toEqual({ date: "2026-12-10" });
    expect(exam.end).toEqual({ date: "2026-12-11" });
  });
});

describe("github / buffer / chess parsing", () => {
  it("counts pushes by IST date", () => {
    const ev = [
      { type: "PushEvent", created_at: "2026-11-30T19:00:00Z" }, // 00:30 IST Dec 1
      { type: "PushEvent", created_at: "2026-11-30T10:00:00Z" },
      { type: "WatchEvent", created_at: "2026-11-30T10:00:00Z" },
    ];
    expect(countPushes(ev, "2026-12-01", "2026-11-30")).toEqual({ pushes_today: 1, pushes_week: 2 });
  });
  it("picks Buffer channels by service", () => {
    const list = [{ id: "1", name: "me", service: "linkedin" }, { id: "2", name: "me", service: "twitter" }];
    expect(pickChannel(list, "x")?.id).toBe("2");
    expect(pickChannel(list, "linkedin")?.id).toBe("1");
  });
  it("parses Chess.com stats and games", () => {
    expect(parseStats({ chess_rapid: { last: { rating: 812 } }, tactics: { highest: { rating: 1500 } } })).toMatchObject({ rapid: 812, puzzles: 1500, blitz: null });
    const g = parseGame({ url: "u", end_time: 1764000000, time_class: "rapid", white: { username: "Dharma", result: "resigned" }, black: { username: "Opp", result: "win" } }, "dharma");
    expect(g).toMatchObject({ result: "loss", opponent: "Opp" });
  });
});

describe("public stats", () => {
  it("only allows the portfolio origin and returns an empty, versioned payload when unconfigured", async () => {
    process.env.PORTFOLIO_ORIGIN = "https://dharma-phi.vercel.app";
    expect(corsFor("https://dharma-phi.vercel.app")["access-control-allow-origin"]).toBe("https://dharma-phi.vercel.app");
    expect(corsFor("https://evil.example")["access-control-allow-origin"]).toBeUndefined();
    const r = await publicStats({ method: "GET", path: "/api/public-stats", query: new URLSearchParams(), headers: {}, body: undefined });
    expect(r.body).toMatchObject({ v: 1, stats: {} });
  });
  it("protects cron and secret routes", async () => {
    const res = await handle({ method: "GET", path: "/api/cron/daily", query: new URLSearchParams(), headers: {}, body: undefined });
    expect(res.status).toBe(403);
    const gh = await handle({ method: "GET", path: "/api/github", query: new URLSearchParams(), headers: {}, body: undefined });
    expect(gh.status).toBe(409); // no token in tests
    const g = await handle({ method: "POST", path: "/api/google/push", query: new URLSearchParams(), headers: {}, body: { events: [] } });
    expect(g.status).toBe(409); // needs Supabase
  });
});
