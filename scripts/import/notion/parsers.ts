// Parsers for Notion's "Markdown & CSV" export. Pure functions, unit-tested with synthetic fixtures.
// Handles both database exports (CSV) and plain pages with numbered/bulleted lines (Markdown).

export interface ContactIn {
  name: string;
  title: string | null;
  company: string | null;
  tier: string | null;
  linkedin_url: string | null;
  verified: boolean;
  status: string;
  notes: string | null;
  sent_at: string | null;
  import_key: string;
}
export interface XFollowIn {
  handle: string;
  name: string | null;
  company: string | null;
  why: string | null;
  learn: string | null;
  first_reply: string | null;
  followed_at: string | null;
}
export interface IdeaIn {
  title: string;
  description: string | null;
  status: string;
  idea_date: string | null;
}
export interface HackathonIn {
  name: string;
  url: string | null;
  deadline: string | null;
  start_date: string | null;
  end_date: string | null;
  team: string | null;
  status: string;
  notes: string | null;
  needs_details: boolean;
}

/** RFC 4180 CSV (quotes, escaped quotes, newlines in quotes, BOM). */
export function parseCsv(text: string): Record<string, string>[] {
  const s = text.replace(/^﻿/, "");
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let q = false;
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (q) {
      if (c === '"' && s[i + 1] === '"') {
        cell += '"';
        i++;
      } else if (c === '"') q = false;
      else cell += c;
    } else if (c === '"') q = true;
    else if (c === ",") {
      row.push(cell);
      cell = "";
    } else if (c === "\n" || c === "\r") {
      if (c === "\r" && s[i + 1] === "\n") i++;
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
    } else cell += c;
  }
  if (cell || row.length) {
    row.push(cell);
    rows.push(row);
  }
  const [head, ...body] = rows.filter((r) => r.some((x) => x.trim()));
  if (!head) return [];
  const keys = head.map((h) => h.trim());
  return body.map((r) => Object.fromEntries(keys.map((k, i) => [k, (r[i] ?? "").trim()])));
}

const pick = (r: Record<string, string>, ...names: RegExp[]): string | null => {
  for (const n of names) for (const [k, v] of Object.entries(r)) if (n.test(k) && v) return v;
  return null;
};

const URL_RE = /https?:\/\/[^\s)>\]]+/i;
export const normLinkedin = (u: string | null): string | null => {
  if (!u) return null;
  const m = u.match(/linkedin\.com\/in\/([^/?#\s]+)/i);
  return m ? `https://www.linkedin.com/in/${decodeURIComponent(m[1]).toLowerCase().replace(/\/$/, "")}` : u.trim();
};

/** Notion dates: "October 12, 2026", "2026-10-12", "12/10/2026" (D/M/Y as used in India). */
export function parseDate(s: string | null): string | null {
  if (!s) return null;
  const t = s.trim().split(/\s*(→|->)\s*/)[0];
  let m = t.match(/(\d{4})-(\d{2})-(\d{2})/);
  if (m) return `${m[1]}-${m[2]}-${m[3]}`;
  m = t.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (m) return `${m[3]}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`;
  const d = Date.parse(`${t} 12:00 UTC`);
  return Number.isNaN(d) ? null : new Date(d).toISOString().slice(0, 10);
}

const tierOf = (s: string | null): string | null => {
  const m = s?.match(/\b(?:tier\s*)?([ABCD])\b/i);
  return m ? m[1].toUpperCase() : null;
};

function statusOf(s: string | null): string {
  const v = (s ?? "").toLowerCase();
  if (/talk|call|spoke|convers/.test(v)) return "talked";
  if (/accept|connected/.test(v)) return "accepted";
  return "sent";
}

export const contactKey = (c: { name: string; company: string | null; linkedin_url: string | null }) =>
  (normLinkedin(c.linkedin_url) ?? `${c.name}|${c.company ?? ""}`).toLowerCase().replace(/\s+/g, " ").trim();

export function contactsFromCsv(rows: Record<string, string>[]): ContactIn[] {
  return rows
    .map((r) => {
      const name = pick(r, /^name$/i, /person|contact/i) ?? "";
      const url = pick(r, /linkedin|url|profile/i);
      const verifiedRaw = pick(r, /verified/i);
      const c = {
        name: name.trim(),
        title: pick(r, /title|role|position/i),
        company: pick(r, /company|org/i),
        tier: tierOf(pick(r, /tier/i)),
        linkedin_url: normLinkedin(url?.match(URL_RE)?.[0] ?? null),
        verified: verifiedRaw ? /^(yes|true|✓|checked|verified)$/i.test(verifiedRaw) : false,
        status: statusOf(pick(r, /status|stage/i)),
        notes: pick(r, /note|comment/i),
        sent_at: parseDate(pick(r, /date|sent/i)),
      };
      return { ...c, import_key: contactKey(c) };
    })
    .filter((c) => c.name);
}

/** "12. Name / Title @ Company / note / https://linkedin.com/in/x" (separators: / | – —). */
export function contactsFromMarkdown(md: string): ContactIn[] {
  const out: ContactIn[] = [];
  for (const raw of md.split(/\r?\n/)) {
    if (!/^\s*(?:\d+[.)]|[-*•])\s+/.test(raw)) continue;
    const line = raw.replace(/^\s*(?:\d+[.)]|[-*•])\s+/, "").trim();
    if (!line) continue;
    const url = line.match(URL_RE)?.[0] ?? null;
    const parts = line
      .replace(URL_RE, "")
      .split(/\s+[/|–—]\s+|\s+-\s+/)
      .map((p) => p.replace(/\[|\]|\(\s*\)/g, "").trim())
      .filter(Boolean);
    if (!parts.length) continue;
    const [name, second, ...rest] = parts;
    let title: string | null = second ?? null;
    let company: string | null = null;
    const at = second?.match(/^(.*?)\s+(?:@|at)\s+(.+)$/i);
    if (at) {
      title = at[1].trim() || null;
      company = at[2].trim();
    }
    const c = { name: name.replace(/\*\*/g, ""), title, company, tier: tierOf(line), linkedin_url: normLinkedin(url), verified: false, status: statusOf(line), notes: rest.join(" / ") || null, sent_at: null };
    out.push({ ...c, import_key: contactKey(c) });
  }
  return out;
}

export function xFollowsFromCsv(rows: Record<string, string>[]): XFollowIn[] {
  return rows
    .map((r) => {
      const h = pick(r, /handle|username|@/i, /^name$/i) ?? "";
      const nameCompany = pick(r, /name|who/i);
      const [name, company] = (nameCompany ?? "").split(/,\s*/);
      return {
        handle: h.replace(/^@/, "").replace(/^https?:\/\/(www\.)?(x|twitter)\.com\//i, "").replace(/[/?].*$/, "").trim(),
        name: name?.trim() || null,
        company: company?.trim() || null,
        why: pick(r, /why/i),
        learn: pick(r, /learn/i),
        first_reply: pick(r, /reply/i),
        followed_at: parseDate(pick(r, /date|followed/i)),
      };
    })
    .filter((x) => /^\w{1,15}$/.test(x.handle));
}

/** "2026-10-12 / @handle / Name, Company / why / first reply" */
export function xFollowsFromMarkdown(md: string): XFollowIn[] {
  const out: XFollowIn[] = [];
  for (const raw of md.split(/\r?\n/)) {
    const h = raw.match(/@(\w{1,15})\b/);
    if (!h) continue;
    const parts = raw.replace(/^\s*(?:\d+[.)]|[-*•])\s+/, "").split(/\s+[/|–—]\s+/).map((p) => p.trim());
    const hi = parts.findIndex((p) => p.includes(`@${h[1]}`));
    const date = parts.slice(0, Math.max(0, hi)).map(parseDate).find(Boolean) ?? null;
    const [name, company] = (parts[hi + 1] ?? "").split(/,\s*/);
    out.push({ handle: h[1], name: name || null, company: company || null, why: parts[hi + 2] || null, learn: null, first_reply: parts[hi + 3] || null, followed_at: date });
  }
  return out;
}

export function ideasFromCsv(rows: Record<string, string>[]): IdeaIn[] {
  return rows
    .map((r) => ({
      title: pick(r, /^name$|title|idea/i) ?? "",
      description: pick(r, /desc|detail|note/i),
      status: /valid/i.test(pick(r, /status/i) ?? "") ? "validating" : /build/i.test(pick(r, /status/i) ?? "") ? "building" : /drop/i.test(pick(r, /status/i) ?? "") ? "dropped" : "idea",
      idea_date: parseDate(pick(r, /date|created/i)),
    }))
    .filter((x) => x.title);
}

/** One idea per heading or top-level bullet; following indented/plain lines become the description. */
export function ideasFromMarkdown(md: string): IdeaIn[] {
  const out: IdeaIn[] = [];
  for (const raw of md.split(/\r?\n/)) {
    const head = raw.match(/^\s{0,1}(?:#{1,4}\s+|[-*•]\s+|\d+[.)]\s+)(.+)$/);
    if (head && !/^\s{2,}/.test(raw)) {
      const [title, ...desc] = head[1].split(/\s+[:–—-]\s+/);
      out.push({ title: title.replace(/\*\*/g, "").trim(), description: desc.join(" - ") || null, status: "idea", idea_date: null });
    } else if (raw.trim() && out.length) {
      const last = out[out.length - 1];
      last.description = [last.description, raw.trim().replace(/^[-*•]\s+/, "")].filter(Boolean).join(" ");
    }
  }
  return out.filter((x) => x.title && !/^website ideas?$/i.test(x.title));
}

export function hackathonsFromCsv(rows: Record<string, string>[]): HackathonIn[] {
  return rows
    .map((r) => {
      const url = pick(r, /link|url|website/i)?.match(URL_RE)?.[0] ?? null;
      const name = pick(r, /^name$|hackathon|title/i) ?? "";
      const dates = pick(r, /^dates?$|when/i);
      return {
        name: name || url || "",
        url,
        deadline: parseDate(pick(r, /deadline|due/i)),
        start_date: parseDate(dates),
        end_date: dates && /→|->/.test(dates) ? parseDate(dates.split(/→|->/)[1]) : null,
        team: pick(r, /team/i),
        status: (pick(r, /status/i) ?? "interested").toLowerCase().replace(/[^a-z]/g, "") || "interested",
        notes: pick(r, /note/i),
        needs_details: !name || !!url?.includes("lnkd.in"),
      };
    })
    .filter((h) => h.name);
}

export function hackathonsFromMarkdown(md: string): HackathonIn[] {
  const out: HackathonIn[] = [];
  for (const raw of md.split(/\r?\n/)) {
    const line = raw.replace(/^\s*(?:\d+[.)]|[-*•])\s+/, "").trim();
    if (!line || /^#/.test(line)) continue;
    const url = line.match(URL_RE)?.[0] ?? null;
    const text = line.replace(URL_RE, "").replace(/\[|\]|\(\s*\)/g, "").replace(/\s+[/|–—-]\s*$/, "").trim();
    if (!text && !url) continue;
    const onlyLink = !text;
    const [name, ...rest] = text.split(/\s+[/|–—]\s+/);
    out.push({
      name: onlyLink ? url! : name,
      url,
      deadline: rest.map(parseDate).find(Boolean) ?? null,
      start_date: null,
      end_date: null,
      team: null,
      status: "interested",
      notes: rest.filter((r) => !parseDate(r)).join(" / ") || null,
      needs_details: onlyLink || !!url?.includes("lnkd.in"),
    });
  }
  return out;
}

export function dedupe<T>(rows: T[], key: (r: T) => string): T[] {
  const m = new Map<string, T>();
  for (const r of rows) if (!m.has(key(r))) m.set(key(r), r);
  return [...m.values()];
}
