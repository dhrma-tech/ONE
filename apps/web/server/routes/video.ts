// Video metadata for "Add video": YouTube Data API v3 when YOUTUBE_API_KEY is set (1 quota unit),
// otherwise oEmbed (no key: title + channel, no duration).
import { env, json, type Handler } from "../http.js";
import { requireUser } from "../auth.js";

export function parseIsoDuration(d: string): number | null {
  const m = d.match(/^P(?:(\d+)D)?T?(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/);
  if (!m) return null;
  const [, D, H, M, S] = m.map((x) => Number(x || 0));
  return D * 86400 + H * 3600 + M * 60 + S;
}

export const video: Handler = async (req) => {
  await requireUser(req);
  const id = req.query.get("id") ?? "";
  if (!/^[\w-]{11}$/.test(id)) return json({ error: "bad_id" }, 400);
  const cache = { "cache-control": "private, max-age=86400" };
  const key = env("YOUTUBE_API_KEY");
  if (key) {
    try {
      const r = await fetch(`https://www.googleapis.com/youtube/v3/videos?part=snippet,contentDetails&id=${id}&key=${key}`, { signal: AbortSignal.timeout(8000) });
      if (r.ok) {
        const j = (await r.json()) as { items?: { snippet: { title: string; channelTitle: string; publishedAt: string }; contentDetails: { duration: string } }[] };
        const it = j.items?.[0];
        if (!it) return json({ id, error: "not_found" }, 200, cache);
        return json({ id, title: it.snippet.title, channel: it.snippet.channelTitle, seconds: parseIsoDuration(it.contentDetails.duration), published: it.snippet.publishedAt.slice(0, 10) }, 200, cache);
      }
    } catch {
      /* fall back to oEmbed */
    }
  }
  try {
    const o = await fetch(`https://www.youtube.com/oembed?url=${encodeURIComponent(`https://www.youtube.com/watch?v=${id}`)}&format=json`, { signal: AbortSignal.timeout(8000) });
    if (o.status === 401 || o.status === 403) return json({ id, error: "not_embeddable" }, 200);
    if (!o.ok) return json({ id, error: "not_found" }, 200);
    const j = (await o.json()) as { title: string; author_name: string };
    return json({ id, title: j.title, channel: j.author_name }, 200, cache);
  } catch {
    return json({ id, error: "upstream" }, 200);
  }
};
