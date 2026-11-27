// Fetch a page's <title> / og:title for the Reading list. SSRF-guarded: http(s) only, public hosts only,
// 6 s timeout, first 512 KB.
import { json, type Handler } from "../http.js";
import { requireUser } from "../auth.js";

export function isPublicHost(host: string): boolean {
  const h = host.toLowerCase().replace(/^\[|\]$/g, "");
  if (!h || h === "localhost" || h.endsWith(".localhost") || h.endsWith(".local") || h.endsWith(".internal")) return false;
  if (/^\d+\.\d+\.\d+\.\d+$/.test(h)) {
    const [a, b] = h.split(".").map(Number);
    if (a === 10 || a === 127 || a === 0 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || a >= 224) return false;
  }
  if (h.includes(":")) return false; // raw IPv6 literals: refuse
  return true;
}

export function extractTitle(html: string): string | null {
  const og = html.match(/<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)["']/i) ?? html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:title["']/i);
  const t = og?.[1] ?? html.match(/<title[^>]*>([^<]{1,300})<\/title>/i)?.[1];
  if (!t) return null;
  return t
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 200);
}

export const linkTitle: Handler = async (req) => {
  await requireUser(req);
  let u: URL;
  try {
    u = new URL(req.query.get("url") ?? "");
  } catch {
    return json({ error: "bad_url" }, 400);
  }
  if (!/^https?:$/.test(u.protocol) || !isPublicHost(u.hostname)) return json({ error: "blocked" }, 400);
  try {
    const r = await fetch(u, { redirect: "follow", headers: { "user-agent": "ONE/1.0 (reading list title fetch)", accept: "text/html" }, signal: AbortSignal.timeout(6000) });
    if (!r.ok || !r.body) return json({ title: u.hostname });
    const reader = r.body.getReader();
    let html = "";
    const dec = new TextDecoder();
    while (html.length < 512_000) {
      const { done, value } = await reader.read();
      if (done) break;
      html += dec.decode(value, { stream: true });
      if (/<\/head>/i.test(html)) break;
    }
    void reader.cancel().catch(() => undefined);
    return json({ title: extractTitle(html) ?? u.hostname }, 200, { "cache-control": "private, max-age=86400" });
  } catch {
    return json({ title: u.hostname });
  }
};
