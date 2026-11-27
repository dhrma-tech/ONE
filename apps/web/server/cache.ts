// Server cache: in-memory per warm instance, plus Supabase api_cache (service role) when configured.
import { supabaseConfigured } from "./auth.js";
import { env } from "./http.js";

const mem = new Map<string, { value: unknown; until: number }>();

async function dbGet(key: string): Promise<{ value: unknown; fetched_at: string } | null> {
  if (!supabaseConfigured()) return null;
  try {
    const r = await fetch(`${env("SUPABASE_URL")}/rest/v1/api_cache?key=eq.${encodeURIComponent(key)}&select=value,fetched_at&limit=1`, {
      headers: { apikey: env("SUPABASE_SERVICE_ROLE_KEY"), authorization: `Bearer ${env("SUPABASE_SERVICE_ROLE_KEY")}` },
      signal: AbortSignal.timeout(5000),
    });
    if (!r.ok) return null;
    const rows = (await r.json()) as { value: unknown; fetched_at: string }[];
    return rows[0] ?? null;
  } catch {
    return null;
  }
}

async function dbPut(key: string, value: unknown, userId: string | null): Promise<void> {
  if (!supabaseConfigured() || !userId) return;
  try {
    await fetch(`${env("SUPABASE_URL")}/rest/v1/api_cache?on_conflict=user_id,key`, {
      method: "POST",
      headers: {
        apikey: env("SUPABASE_SERVICE_ROLE_KEY"),
        authorization: `Bearer ${env("SUPABASE_SERVICE_ROLE_KEY")}`,
        "content-type": "application/json",
        prefer: "resolution=merge-duplicates,return=minimal",
      },
      body: JSON.stringify({ user_id: userId, key, value, fetched_at: new Date().toISOString() }),
      signal: AbortSignal.timeout(5000),
    });
  } catch {
    /* cache is best effort */
  }
}

/** Return a cached value younger than ttl seconds, or compute it. On compute failure, return stale data if any. */
export async function cached<T>(key: string, ttlSec: number, compute: () => Promise<T>, userId: string | null = null): Promise<T> {
  const hit = mem.get(key);
  if (hit && hit.until > Date.now()) return hit.value as T;
  const row = await dbGet(key);
  if (row && Date.now() - Date.parse(row.fetched_at) < ttlSec * 1000) {
    mem.set(key, { value: row.value, until: Date.now() + 60_000 });
    return row.value as T;
  }
  try {
    const v = await compute();
    mem.set(key, { value: v, until: Date.now() + ttlSec * 1000 });
    await dbPut(key, v, userId ?? (key.split(":")[1] && key.split(":")[1] !== "local" ? key.split(":")[1] : null));
    return v;
  } catch (e) {
    if (row) return row.value as T;
    if (hit) return hit.value as T;
    throw e;
  }
}
