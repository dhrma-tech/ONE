// News sources for the News room (adapted from Cubicle's api/news.js, MIT): HN Algolia, Hugging Face daily papers,
// Lobsters. Public JSON APIs, no keys. The client picks at most 10 per day with fixed quotas.
import { createHash } from "node:crypto";
import { json, type Handler } from "../http.js";
import { requireUser } from "../auth.js";

const UA = { "user-agent": "ONE/1.0 (personal dashboard; news room)" };
const AI = /\b(ai|llms?|gpt-?\d*|claude|anthropic|openai|gemini|deepmind|mistral|llama|qwen|deepseek|transformers?|neural|machine learning|deep learning|inference|fine-?tun\w*|hugging ?face|pytorch|mcp|agentic|ai agents?|language models?|open[- ]weights?|rag|embeddings?)\b/i;

export interface NewsItem {
  id: string;
  s: string;
  sn: string;
  g: string;
  t: string;
  u: string;
  ts: number;
  sc: number;
}

const norm = (u: string) => (u || "").trim().toLowerCase().replace(/^https?:\/\/(www\.)?/, "").replace(/[?#].*$/, "").replace(/\/$/, "");
const clean = (s: string, n = 160) => {
  const x = String(s || "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
  return x.length <= n ? x : `${x.slice(0, n).replace(/\s+\S*$/, "")}…`;
};
const web = (u: unknown) => (/^https?:\/\//i.test(String(u || "")) ? String(u) : null);
const mk = (s: string, sn: string, g: string, t: string, u: string, ts: number, sc: number): NewsItem => ({
  id: `${s}:${createHash("md5").update(norm(u)).digest("hex").slice(0, 10)}`,
  s,
  sn,
  g,
  t: clean(t),
  u: web(u) ?? "#",
  ts: Math.floor(ts),
  sc: Math.floor(sc || 0),
});
const get = async <T>(url: string): Promise<T> => {
  const r = await fetch(url, { headers: UA, signal: AbortSignal.timeout(10_000) });
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  return (await r.json()) as T;
};

async function hn(): Promise<NewsItem[]> {
  const since = Math.floor(Date.now() / 1000 - 72 * 3600);
  const qs = ["AI", "LLM", "Claude", "OpenAI", "Anthropic", "machine learning", "AI agents", "RAG"];
  const seen = new Set<string>();
  const out: NewsItem[] = [];
  const res = await Promise.all(
    qs.map((q) =>
      get<{ hits: { objectID: string; title: string; url?: string; created_at_i: number; points: number }[] }>(
        `https://hn.algolia.com/api/v1/search_by_date?tags=story&hitsPerPage=30&query=${encodeURIComponent(q)}&numericFilters=${encodeURIComponent(`created_at_i>${since},points>25`)}`,
      )
        .then((j) => j.hits ?? [])
        .catch(() => []),
    ),
  );
  for (const hits of res)
    for (const h of hits) {
      if (seen.has(h.objectID) || !AI.test(h.title || "")) continue;
      seen.add(h.objectID);
      out.push(mk("hn", "Hacker News", "hn", h.title, h.url || `https://news.ycombinator.com/item?id=${h.objectID}`, h.created_at_i, h.points));
    }
  return out;
}

async function papers(): Promise<NewsItem[]> {
  const j = await get<{ paper?: { id: string; title: string; upvotes: number; publishedAt: string }; title?: string; publishedAt?: string; upvotes?: number }[]>("https://huggingface.co/api/daily_papers?limit=30");
  return j
    .filter((x) => x.paper?.id)
    .map((x) => mk("hfpapers", "HF Papers", "research", x.paper!.title || x.title || "", `https://huggingface.co/papers/${x.paper!.id}`, Date.parse(x.paper!.publishedAt || x.publishedAt || "") / 1000 || Date.now() / 1000, x.paper!.upvotes ?? x.upvotes ?? 0));
}

async function lobsters(): Promise<NewsItem[]> {
  const out: NewsItem[] = [];
  const seen = new Set<string>();
  for (const tag of ["ai", "ml"]) {
    const list = await get<{ short_id: string; title: string; url: string; comments_url: string; created_at: string; score: number }[]>(`https://lobste.rs/t/${tag}.json`).catch(() => []);
    for (const x of list) {
      const ts = Date.parse(x.created_at) / 1000;
      if (seen.has(x.short_id) || Date.now() / 1000 - ts > 4 * 86400) continue;
      seen.add(x.short_id);
      out.push(mk("lobsters", "Lobsters", "community", x.title, x.url || x.comments_url, ts, x.score));
    }
  }
  return out;
}

export const news: Handler = async (req) => {
  await requireUser(req);
  const jobs = { hn, hfpapers: papers, lobsters };
  const items: NewsItem[] = [];
  const sources: { id: string; ok: boolean; count: number }[] = [];
  await Promise.all(
    Object.entries(jobs).map(async ([id, fn]) => {
      try {
        const r = await fn();
        items.push(...r);
        sources.push({ id, ok: true, count: r.length });
      } catch {
        sources.push({ id, ok: false, count: 0 });
      }
    }),
  );
  return json({ updated: new Date().toISOString(), items: items.filter((i) => i.u !== "#"), sources }, 200, { "cache-control": "private, max-age=900" });
};
