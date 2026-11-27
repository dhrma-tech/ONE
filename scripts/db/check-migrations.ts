// Runs every migration against real Postgres (PGlite, WASM) with stubbed Supabase auth/storage schemas,
// then checks RLS isolation, the LWW trigger, the views and public_stats filtering.
// Run: pnpm db:check
import { PGlite } from "@electric-sql/pglite";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

const root = join(import.meta.dirname, "..", "..");
const dir = join(root, "supabase", "migrations");
const db = new PGlite();

const STUB = `
create role anon nologin; create role authenticated nologin; create role service_role nologin bypassrls;
create schema auth;
create table auth.users (id uuid primary key);
create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
create schema storage;
create table storage.buckets (id text primary key, name text, public boolean);
create table storage.objects (id uuid primary key default gen_random_uuid(), bucket_id text, name text);
alter table storage.objects enable row level security;
create function storage.foldername(name text) returns text[] language sql immutable as $$ select string_to_array(name, '/') $$;
grant usage on schema public, auth, storage to anon, authenticated, service_role;
grant execute on function auth.uid() to anon, authenticated, service_role;
alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
alter default privileges in schema public grant all on functions to anon, authenticated, service_role;
`;

const fail = (m: string) => {
  console.error("FAIL:", m);
  process.exit(1);
};

await db.exec(STUB);
for (const f of readdirSync(dir).filter((x) => x.endsWith(".sql")).sort()) {
  try {
    await db.exec(readFileSync(join(dir, f), "utf8"));
    console.log("ok   ", f);
  } catch (e) {
    fail(`${f}: ${(e as Error).message}`);
  }
}

const A = "00000000-0000-0000-0000-00000000000a";
const B = "00000000-0000-0000-0000-00000000000b";
await db.exec(`insert into auth.users values ('${A}'), ('${B}');`);
const as = async (uid: string, sql: string) => {
  await db.exec(`set role authenticated; select set_config('request.jwt.claim.sub', '${uid}', false);`);
  try {
    return await db.query(sql);
  } finally {
    await db.exec("reset role;");
  }
};

// RLS isolation
await as(A, `insert into public.weigh_ins (date, weight_kg) values ('2026-11-29', 50.4)`);
await as(B, `insert into public.weigh_ins (date, weight_kg) values ('2026-11-29', 70)`);
const rowsA = (await as(A, `select weight_kg from public.weigh_ins`)).rows as { weight_kg: string }[];
if (rowsA.length !== 1 || Number(rowsA[0].weight_kg) !== 50.4) fail("RLS: user A should see only their row");
try {
  await as(A, `insert into public.weigh_ins (user_id, date, weight_kg) values ('${B}', '2026-11-30', 1)`);
  fail("RLS: user A inserted a row for user B");
} catch {
  console.log("ok    RLS blocks cross-user insert");
}
// server-only tables unreadable
await db.exec(`insert into public.integration_secrets (user_id, provider, ciphertext, iv, tag) values ('${A}', 'github', 'x', 'y', 'z')`);
const leaked = await as(A, `select * from public.integration_secrets`).then((r) => r.rows.length).catch(() => 0);
if (leaked) fail("integration_secrets readable by authenticated");
console.log("ok    integration_secrets is service-role only");

// LWW trigger: a stale update is ignored
await as(A, `insert into public.tasks (id, section, title, updated_at) values ('00000000-0000-0000-0000-0000000000f1', 'career', 'new', '2026-11-27T10:00:00Z')`);
await as(A, `update public.tasks set title = 'stale', updated_at = '2026-11-27T09:00:00Z' where id = '00000000-0000-0000-0000-0000000000f1'`);
const t = (await as(A, `select title from public.tasks`)).rows as { title: string }[];
if (t[0].title !== "new") fail("LWW: stale write overwrote newer data");
console.log("ok    last-write-wins trigger");

// Views
await as(A, `insert into public.focus_sessions (date, section, kind, started_at, minutes) values ('2026-11-29', 'career', 'block1', now(), 95)`);
await as(A, `insert into public.daily_reviews (date, submitted_at) values ('2026-11-29', now())`);
const ds = (await as(A, `select python_block1_min, review_submitted, weight_kg from public.daily_summary where date = '2026-11-29'`)).rows as Record<string, unknown>[];
if (ds.length !== 1 || ds[0].python_block1_min !== 95 || ds[0].review_submitted !== true) fail(`daily_summary wrong: ${JSON.stringify(ds)}`);
const ws = (await as(A, `select block1_days, reviews_submitted from public.weekly_summary`)).rows as Record<string, unknown>[];
if (ws[0]?.block1_days !== 1) fail(`weekly_summary wrong: ${JSON.stringify(ws)}`);
console.log("ok    daily_summary / weekly_summary");

// public_stats only returns flagged fields
await as(A, `insert into public.profile (lock_in_start_date) values (current_date - 9)`);
await as(A, `insert into public.settings (public_stat_flags, derived_stats) values ('{"lock_in_day": true, "level": false}', '{"level": 4, "overall_streak": 3}')`);
const ps = (await as(A, `select stats from public.public_stats`)).rows as { stats: Record<string, unknown> }[];
const keys = Object.keys(ps[0].stats);
if (keys.length !== 1 || keys[0] !== "lock_in_day") fail(`public_stats leaked: ${JSON.stringify(ps[0].stats)}`);
const anonDenied = await db
  .exec(`set role anon; select public.public_stats_for('${A}');`)
  .then(() => false)
  .catch(() => true);
await db.exec("reset role;");
if (!anonDenied) fail("anon can call public_stats_for");
console.log("ok    public_stats returns only flagged fields; anon cannot call it");
console.log("All migration checks passed.");
