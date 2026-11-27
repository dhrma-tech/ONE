// CAREER helpers: spaced review for notes (3/7/30/90 days, from Cubicle), news room selection (hard cap 10/day).
import { addDays, type ISODate } from "@/lib/dates";

export const REVIEW_DAYS = [3, 7, 30, 90];

export function firstReview(created: ISODate): { next_review_at: ISODate; review_stage: number } {
  return { next_review_at: addDays(created, REVIEW_DAYS[0]), review_stage: 0 };
}

/** Grade a due review. Remembered → next interval (null after 90 days: graduated). Forgot → back to day 1. */
export function gradeReview(stage: number, remembered: boolean, on: ISODate): { next_review_at: ISODate | null; review_stage: number } {
  if (!remembered) return { next_review_at: addDays(on, 1), review_stage: 0 };
  const next = stage + 1;
  if (next >= REVIEW_DAYS.length) return { next_review_at: null, review_stage: REVIEW_DAYS.length };
  return { next_review_at: addDays(on, REVIEW_DAYS[next]), review_stage: next };
}

export interface NewsIn {
  id: string;
  s: string; // source id
  sn: string; // source name
  g: string; // group: hn | research | community | labs | github
  t: string; // title
  u: string; // url
  ts: number; // unix seconds
  sc: number; // score
}

export const NEWS_CAP = 10;
const QUOTA: Record<string, number> = { hn: 4, research: 3, community: 2, labs: 2, github: 1 };

/** Pick at most 10 by fixed source rules (no AI ranking): per-group quotas by score, then fill by score. */
export function pickNews(items: NewsIn[], already: string[] = [], cap = NEWS_CAP): NewsIn[] {
  const seen = new Set(already.map(normUrl));
  const fresh = items.filter((i) => i.u && i.u !== "#" && !seen.has(normUrl(i.u)));
  const uniq = new Map<string, NewsIn>();
  for (const i of fresh) if (!uniq.has(normUrl(i.u))) uniq.set(normUrl(i.u), i);
  const all = [...uniq.values()].sort((a, b) => b.sc - a.sc || b.ts - a.ts);
  const room = Math.max(0, cap - already.length);
  const out: NewsIn[] = [];
  for (const [g, q] of Object.entries(QUOTA)) for (const i of all.filter((x) => x.g === g).slice(0, q)) if (out.length < room) out.push(i);
  for (const i of all) if (out.length < room && !out.includes(i)) out.push(i);
  return out;
}

export const normUrl = (u: string) => u.trim().toLowerCase().replace(/^https?:\/\/(www\.)?/, "").replace(/[?#].*$/, "").replace(/\/$/, "");
