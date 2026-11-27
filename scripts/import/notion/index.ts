// Notion "Lock-In OS" importer: LinkedIn Outreach Tracker, X Follow List, Website Ideas, Hackathon List.
// Input: a Notion export (Markdown & CSV, include subpages) unzipped into scripts/import/notion/input/ (gitignored).
// Usage:
//   pnpm import:notion --dry-run            # parse + print counts and the first 5 rows per table
//   pnpm import:notion                       # upsert into Supabase (service role; env from apps/web/.env.local)
//   pnpm import:notion --input <dir>
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { basename, join } from "node:path";
import {
  contactKey, contactsFromCsv, contactsFromMarkdown, dedupe, hackathonsFromCsv, hackathonsFromMarkdown, ideasFromCsv,
  ideasFromMarkdown, parseCsv, xFollowsFromCsv, xFollowsFromMarkdown, type ContactIn, type HackathonIn, type IdeaIn, type XFollowIn,
} from "./parsers";

const args = process.argv.slice(2);
const dry = args.includes("--dry-run");
const input = args.includes("--input") ? args[args.indexOf("--input") + 1] : join(import.meta.dirname, "input");

function loadEnv() {
  const f = join(import.meta.dirname, "..", "..", "..", "apps", "web", ".env.local");
  if (!existsSync(f)) return;
  for (const line of readFileSync(f, "utf8").split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*(#.*)?$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
}

const walk = (d: string): string[] => readdirSync(d).flatMap((f) => (statSync(join(d, f)).isDirectory() ? walk(join(d, f)) : [join(d, f)]));

export interface Parsed {
  contacts: ContactIn[];
  x_follows: XFollowIn[];
  website_ideas: IdeaIn[];
  hackathons: HackathonIn[];
  files: Record<string, string[]>;
}

/** Classify every exported file by name and parse it. CSV beats Markdown for the same page. */
export function parseExport(dir: string): Parsed {
  const out: Parsed = { contacts: [], x_follows: [], website_ideas: [], hackathons: [], files: { contacts: [], x_follows: [], website_ideas: [], hackathons: [] } };
  const files = walk(dir).filter((f) => /\.(csv|md)$/i.test(f));
  const kind = (f: string) => {
    const n = basename(f).toLowerCase();
    if (/linkedin|outreach/.test(n)) return "contacts";
    if (/x follow|twitter|x-follow/.test(n)) return "x_follows";
    if (/website idea/.test(n)) return "website_ideas";
    if (/hackathon/.test(n)) return "hackathons";
    return null;
  };
  for (const f of files) {
    const k = kind(f);
    if (!k) continue;
    const text = readFileSync(f, "utf8");
    const csv = f.toLowerCase().endsWith(".csv");
    out.files[k].push(basename(f));
    if (k === "contacts") out.contacts.push(...(csv ? contactsFromCsv(parseCsv(text)) : contactsFromMarkdown(text)));
    if (k === "x_follows") out.x_follows.push(...(csv ? xFollowsFromCsv(parseCsv(text)) : xFollowsFromMarkdown(text)));
    if (k === "website_ideas") out.website_ideas.push(...(csv ? ideasFromCsv(parseCsv(text)) : ideasFromMarkdown(text)));
    if (k === "hackathons") out.hackathons.push(...(csv ? hackathonsFromCsv(parseCsv(text)) : hackathonsFromMarkdown(text)));
  }
  out.contacts = dedupe(out.contacts, contactKey);
  out.x_follows = dedupe(out.x_follows, (x) => x.handle.toLowerCase());
  out.website_ideas = dedupe(out.website_ideas, (x) => x.title.toLowerCase());
  out.hackathons = dedupe(out.hackathons, (x) => (x.url ?? x.name).toLowerCase());
  return out;
}

async function rest(path: string, init: RequestInit = {}) {
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const r = await fetch(`${url}/rest/v1/${path}`, { ...init, headers: { apikey: key!, authorization: `Bearer ${key}`, "content-type": "application/json", prefer: "return=minimal", ...(init.headers as Record<string, string> | undefined) } });
  if (!r.ok) throw new Error(`${r.status} ${await r.text()}`);
  const t = await r.text();
  return t ? JSON.parse(t) : null;
}

async function insertMissing<T extends object>(table: string, uid: string, rows: T[], keyCol: string, key: (r: T) => string) {
  const existing = (await rest(`${table}?user_id=eq.${uid}&deleted_at=is.null&select=${keyCol}`, { headers: { prefer: "" } })) as Record<string, string>[];
  const have = new Set(existing.map((e) => String(e[keyCol] ?? "").toLowerCase()));
  const fresh = rows.filter((r) => !have.has(key(r).toLowerCase()));
  for (let i = 0; i < fresh.length; i += 200) await rest(table, { method: "POST", body: JSON.stringify(fresh.slice(i, i + 200).map((r) => ({ ...r, user_id: uid }))) });
  return { inserted: fresh.length, skipped: rows.length - fresh.length };
}

async function main() {
  if (!existsSync(input)) {
    console.error(`No input folder: ${input}\nExport the 4 Notion pages as "Markdown & CSV" (include subpages) and unzip them there.`);
    process.exit(1);
  }
  const p = parseExport(input);
  for (const t of ["contacts", "x_follows", "website_ideas", "hackathons"] as const) {
    console.log(`\n== ${t}: ${p[t].length} rows  (files: ${p.files[t].join(", ") || "none"})`);
    console.table(p[t].slice(0, 5));
  }
  if (dry) return console.log("\nDry run: nothing written.");
  loadEnv();
  const uid = process.env.ONE_OWNER_USER_ID;
  if (!(process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL) || !process.env.SUPABASE_SERVICE_ROLE_KEY || !uid) {
    console.error("Missing SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY or ONE_OWNER_USER_ID (apps/web/.env.local).");
    process.exit(1);
  }
  const now = new Date().toISOString();
  const stamp = <T extends object>(rows: T[]) => rows.map((r) => ({ ...r, created_at: now, updated_at: now }));
  console.log("contacts", await insertMissing("contacts", uid, stamp(p.contacts), "import_key", (r) => r.import_key));
  console.log("x_follows", await insertMissing("x_follows", uid, stamp(p.x_follows), "handle", (r) => r.handle));
  console.log("website_ideas", await insertMissing("website_ideas", uid, stamp(p.website_ideas), "title", (r) => r.title));
  console.log("hackathons", await insertMissing("hackathons", uid, stamp(p.hackathons), "name", (r) => r.name));
  console.log("\nDone. Open ONE: the rows sync down on the next pull.");
}

if (process.argv[1] && basename(process.argv[1]).startsWith("index")) void main();
