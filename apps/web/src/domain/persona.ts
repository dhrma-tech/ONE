// PERSONA logic: post length limits, share fallbacks, baseline redo schedule, extroversion ladder,
// weekly top-skills tally, recorder MIME choice. No AI anywhere.
import { addDays, daysBetween, type ISODate } from "@/lib/dates";

export const LIMITS = { x: 280, linkedin: 3000 } as const;

/** X counts every URL as 23 characters. Everything else ~1 per code point (good enough for a counter). */
export function xLength(text: string): number {
  const urls = text.match(/https?:\/\/\S+/g) ?? [];
  const without = urls.reduce((t, u) => t.replace(u, ""), text);
  return [...without].length + urls.length * 23;
}
export const postLength = (platform: "x" | "linkedin", text: string) => (platform === "x" ? xLength(text) : [...text].length);

export const xIntentUrl = (text: string) => `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}`;
/** LinkedIn's share URL only takes a link, so ONE copies the text and opens the composer. */
export const LINKEDIN_COMPOSER = "https://www.linkedin.com/feed/?shareActive=true";

/** Lint post text against Dharma's rules. Returns hints, not blocks. */
export function postHints(platform: "x" | "linkedin", text: string): string[] {
  const h: string[] = [];
  if (platform === "linkedin" && /(^|\s)#\w/.test(text)) h.push("No hashtags on LinkedIn.");
  if (platform === "x" && /\bday\s*\d+\s*(of|\/)/i.test(text)) h.push('Skip "day N of learning". Say the specific thing that clicked.');
  if (postLength(platform, text) > LIMITS[platform]) h.push(`Over ${LIMITS[platform]} characters.`);
  if (/\b(job|internship|hiring|opportunit(y|ies))\b/i.test(text) && platform === "linkedin") h.push("Careful: this reads like a job ask.");
  return h;
}

export const BASELINE_DAYS = [0, 30, 60, 90];

/** Which baseline redo is due (30/60/90 days after the first baseline), if any. */
export function baselineDue(baselineDate: ISODate | null, doneDays: number[], today: ISODate): number | null {
  if (!baselineDate) return 0;
  const age = daysBetween(baselineDate, today);
  for (const d of BASELINE_DAYS.slice(1)) if (age >= d && !doneDays.includes(d)) return d;
  return null;
}
export const nextBaseline = (baselineDate: ISODate, doneDays: number[]): { day: number; date: ISODate } | null => {
  const d = BASELINE_DAYS.slice(1).find((x) => !doneDays.includes(x));
  return d ? { day: d, date: addDays(baselineDate, d) } : null;
};

export const LADDER = [
  "Week 1: a greeting + one question, daily",
  "Week 2: 3-minute conversations with classmates",
  "Week 3: initiate with seniors / professors",
  "Week 4: lead a club session or open a pitch",
];

/** Suggested rung from the lock-in start (week 1-4, capped). */
export const ladderRung = (start: ISODate | null, today: ISODate): number => (start ? Math.min(4, Math.floor(daysBetween(start, today) / 7) + 1) : 1);

/** Count skills across market-intel rows (case-insensitive, trimmed), most frequent first. */
export function topSkills(rows: { skills: string[] }[], n = 10): { skill: string; count: number }[] {
  const m = new Map<string, { skill: string; count: number }>();
  for (const r of rows)
    for (const raw of r.skills ?? []) {
      const s = raw.trim();
      if (!s) continue;
      const k = s.toLowerCase();
      const cur = m.get(k) ?? { skill: s, count: 0 };
      cur.count++;
      m.set(k, cur);
    }
  return [...m.values()].sort((a, b) => b.count - a.count || a.skill.localeCompare(b.skill)).slice(0, n);
}

export const parseSkills = (s: string): string[] => [...new Set(s.split(/[,;\n]/).map((x) => x.trim()).filter(Boolean))];

/** Opus/WebM at ~32 kbps where supported (Chrome/Edge), else MP4/AAC (iOS Safari). */
export function pickRecorderMime(isSupported: (m: string) => boolean): string | null {
  for (const m of ["audio/webm;codecs=opus", "audio/webm", "audio/mp4;codecs=mp4a.40.2", "audio/mp4", "audio/aac"]) if (isSupported(m)) return m;
  return null;
}
export const extFor = (mime: string) => (mime.includes("webm") ? "webm" : mime.includes("mp4") ? "m4a" : mime.includes("aac") ? "aac" : "bin");

export const FOLLOW_UP_QUESTIONS = [
  "What does a normal week look like on your team?",
  "Which skill do you use daily that you didn't expect to need?",
  "What stack do you use for evals and RAG?",
  "If you were starting out today, what would you learn first?",
];

export const TIERS: Record<string, string> = {
  A: "Practitioners",
  B: "Managers / recruiters",
  C: "Founders / leaders",
  D: "Educators, creators, VCs (follow only, never message)",
};
