import { describe as describeCmd, fuzzy, parseCommand } from "@/domain/command";
import { frameCandidates, youtubeId, fmtDuration } from "@/domain/thumbs";
import { sortQueue, type QueueVideo } from "@/services/library";
import { appleMusicEmbed } from "./music";
import { parseBulk } from "./library/actions";
import { isWatched } from "./library/player";
import { laggingIn, bucketize, type AnalyticsCtx } from "./analytics";
import { emptyFacts } from "@/domain/facts";

describe("command parser", () => {
  it("parses quick logs", () => {
    expect(parseCommand("log water 500")).toEqual({ kind: "water", ml: 500 });
    expect(parseCommand("water 1.5 l")).toEqual({ kind: "water", ml: 1500 });
    expect(parseCommand("log weight 52.4")).toEqual({ kind: "weight", kg: 52.4 });
    expect(parseCommand("start focus 25")).toEqual({ kind: "focus", minutes: 25 });
    expect(parseCommand("focus")).toEqual({ kind: "focus", minutes: 25 });
    expect(parseCommand("add task Read PY4E ch.8 #mind")).toEqual({ kind: "task", title: "Read PY4E ch.8", section: "mind", oneThing: false });
    expect(parseCommand("one thing Ship the parser")).toMatchObject({ kind: "task", oneThing: true, section: "career" });
    expect(parseCommand("protein 30g")).toEqual({ kind: "protein", grams: 30 });
    expect(parseCommand("meditate 10 min")).toEqual({ kind: "meditate", minutes: 10 });
    expect(parseCommand("hello there")).toBeNull();
    expect(describeCmd({ kind: "water", ml: 250 })).toBe("Log 250 ml water");
  });
  it("fuzzy matches route names", () => {
    expect(fuzzy("lib", "Career · Library")).toBeGreaterThanOrEqual(0);
    expect(fuzzy("crlb", "Career · Library")).toBeGreaterThanOrEqual(100);
    expect(fuzzy("zzz", "Career")).toBe(-1);
  });
});

describe("thumbnails", () => {
  it("prefers the chosen frame and falls back through the others", () => {
    const c = frameCandidates("abcdefghijk", 2, "card");
    expect(c[0]).toBe("https://i.ytimg.com/vi/abcdefghijk/mq2.jpg");
    expect(c.slice(0, 3)).toEqual(["mq2", "mq1", "mq3"].map((f) => `https://i.ytimg.com/vi/abcdefghijk/${f}.jpg`));
    expect(frameCandidates("abcdefghijk", 3, "poster")[0]).toContain("/hq3.jpg");
  });
  it("extracts ids from any YouTube URL", () => {
    expect(youtubeId("https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=10")).toBe("dQw4w9WgXcQ");
    expect(youtubeId("https://youtu.be/dQw4w9WgXcQ")).toBe("dQw4w9WgXcQ");
    expect(youtubeId("https://www.youtube.com/shorts/dQw4w9WgXcQ")).toBe("dQw4w9WgXcQ");
    expect(youtubeId("dQw4w9WgXcQ")).toBe("dQw4w9WgXcQ");
    expect(youtubeId("https://example.com/x")).toBeNull();
    expect(fmtDuration(3725)).toBe("1:02:05");
  });
  it("parses bulk lists and JSON", () => {
    expect(parseBulk("https://youtu.be/dQw4w9WgXcQ\ndQw4w9WgXcQ\nnope").map((x) => x.youtube_id)).toEqual(["dQw4w9WgXcQ"]);
    expect(parseBulk('[{"url":"https://youtu.be/dQw4w9WgXcQ","topic":"RAG","rating":4}]')).toEqual([{ youtube_id: "dQw4w9WgXcQ", title: undefined, topic: "RAG", rating: 4 }]);
  });
});

describe("next-up queue", () => {
  const v = (id: string, p: Partial<QueueVideo>) => ({ id, title: id, priority: 2, rating: 0, duration_s: 600, pathOrder: 1e9, ...p }) as QueueVideo;
  it("sorts by path order → priority → rating → shortest", () => {
    const out = sortQueue([v("a", {}), v("b", { duration_s: 60 }), v("c", { rating: 5 }), v("d", { priority: 1 }), v("e", { pathOrder: 5 })]);
    expect(out.map((x) => x.id)).toEqual(["e", "d", "c", "b", "a"]);
  });
  it("counts ≥ 90% as watched", () => {
    expect(isWatched(89, 100)).toBe(false);
    expect(isWatched(90, 100)).toBe(true);
    expect(isWatched(10, 0)).toBe(false);
  });
});

describe("music + analytics helpers", () => {
  it("converts Apple Music links to embed URLs", () => {
    expect(appleMusicEmbed("https://music.apple.com/in/playlist/focus/pl.u-abc123")).toBe("https://embed.music.apple.com/in/playlist/focus/pl.u-abc123");
    expect(appleMusicEmbed("https://music.apple.com/in/album/x/123?i=456")).toBe("https://embed.music.apple.com/in/album/x/123?i=456");
    expect(appleMusicEmbed("https://open.spotify.com/x")).toBeNull();
  });
  it("buckets by week and finds the worst lagging metric", () => {
    const days = ["2026-11-23", "2026-11-24", "2026-11-30"].map((d) => emptyFacts(d));
    expect(bucketize(days, "week").map((b) => b.days.length)).toEqual([2, 1]);
    const c = {} as AnalyticsCtx;
    const lag = laggingIn(
      [
        { label: "Protein", actual: () => 3, target: () => 7, quip: "Feed the machine." },
        { label: "Water", actual: () => 6, target: () => 7, quip: "" },
        { label: "Done", actual: () => 7, target: () => 7, quip: "" },
      ],
      c,
    );
    expect(lag?.def.label).toBe("Protein");
  });
});
