// No clickbait thumbnails: use YouTube's auto-captured in-video frames under i.ytimg.com/vi/<id>/.
// Verified 2026-11-27: 1/2/3.jpg (120x90), mq1-3 (320x180), hq1-3 (480x360), sd1-3, maxres1-3 exist; missing → 404.

export type ThumbSize = "card" | "poster";

/** Ordered candidates for a video: preferred frame first, then the other frames, at the right size. */
export function frameCandidates(id: string, frame = 2, size: ThumbSize = "card"): string[] {
  const order = [frame, ...[2, 1, 3].filter((f) => f !== frame)];
  const prefix = size === "card" ? "mq" : "hq";
  const fallbackPrefix = size === "card" ? "" : "mq";
  const base = `https://i.ytimg.com/vi/${encodeURIComponent(id)}/`;
  return [...order.map((f) => `${base}${prefix}${f}.jpg`), ...order.map((f) => `${base}${fallbackPrefix}${f}.jpg`)];
}

/** Extract an 11-char video id from any common YouTube URL (or a bare id). */
export function youtubeId(input: string): string | null {
  const s = input.trim();
  if (/^[\w-]{11}$/.test(s)) return s;
  try {
    const u = new URL(s);
    const host = u.hostname.replace(/^www\.|^m\./, "");
    if (host === "youtu.be") return u.pathname.slice(1, 12) || null;
    if (host.endsWith("youtube.com") || host.endsWith("youtube-nocookie.com")) {
      const v = u.searchParams.get("v");
      if (v && /^[\w-]{11}$/.test(v)) return v;
      const m = u.pathname.match(/\/(?:embed|shorts|live|v)\/([\w-]{11})/);
      if (m) return m[1];
    }
  } catch {
    /* not a URL */
  }
  return null;
}

export const fmtDuration = (s: number | null | undefined): string => {
  if (!s) return "";
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const x = s % 60;
  return h ? `${h}:${String(m).padStart(2, "0")}:${String(x).padStart(2, "0")}` : `${m}:${String(x).padStart(2, "0")}`;
};
