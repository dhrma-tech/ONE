// Minimal PostgREST client with the service role (server only). Never import from client code.
import { env, HttpError } from "./http.js";
import { supabaseConfigured } from "./auth.js";
import { decrypt, encrypt } from "./crypto.js";

const headers = () => ({
  apikey: env("SUPABASE_SERVICE_ROLE_KEY"),
  authorization: `Bearer ${env("SUPABASE_SERVICE_ROLE_KEY")}`,
  "content-type": "application/json",
});

export function needSupabase() {
  if (!supabaseConfigured()) throw new HttpError(409, "needs_supabase");
}

export async function rest<T = unknown>(path: string, init: RequestInit = {}): Promise<T> {
  needSupabase();
  const r = await fetch(`${env("SUPABASE_URL")}/rest/v1/${path}`, { ...init, headers: { ...headers(), ...(init.headers as Record<string, string> | undefined) }, signal: AbortSignal.timeout(10_000) });
  if (!r.ok) throw new Error(`supabase_${r.status}: ${(await r.text()).slice(0, 200)}`);
  const txt = await r.text();
  return (txt ? JSON.parse(txt) : null) as T;
}

export const select = <T>(table: string, query: string) => rest<T[]>(`${table}?${query}`);
export const insert = <T>(table: string, row: Record<string, unknown>) => rest<T[]>(table, { method: "POST", headers: { prefer: "return=representation" }, body: JSON.stringify(row) });
export const patch = (table: string, query: string, row: Record<string, unknown>) => rest(`${table}?${query}`, { method: "PATCH", headers: { prefer: "return=minimal" }, body: JSON.stringify(row) });
export const rpc = <T>(fn: string, args: Record<string, unknown>) => rest<T>(`rpc/${fn}`, { method: "POST", body: JSON.stringify(args) });

/** Insert-or-update a per-user row matched by `match` columns (works with partial unique indexes). */
export async function upsertRow(table: string, userId: string, match: Record<string, string>, values: Record<string, unknown>) {
  const q = [`user_id=eq.${userId}`, "deleted_at=is.null", ...Object.entries(match).map(([k, v]) => `${k}=eq.${encodeURIComponent(v)}`)].join("&");
  const now = new Date().toISOString();
  const found = await select<{ id: string }>(table, `${q}&select=id&limit=1`);
  if (found[0]) await patch(table, `id=eq.${found[0].id}`, { ...values, updated_at: now });
  else await insert(table, { user_id: userId, ...match, ...values, updated_at: now });
}

// ---------- encrypted third-party secrets ----------
export async function getSecret(userId: string, provider: string): Promise<string | null> {
  const rows = await select<{ ciphertext: string; iv: string; tag: string }>("integration_secrets", `user_id=eq.${userId}&provider=eq.${provider}&select=ciphertext,iv,tag&limit=1`);
  return rows[0] ? decrypt(rows[0]) : null;
}

export async function putSecret(userId: string, provider: string, value: string): Promise<void> {
  const box = encrypt(value);
  await rest("integration_secrets?on_conflict=user_id,provider", {
    method: "POST",
    headers: { prefer: "resolution=merge-duplicates,return=minimal" },
    body: JSON.stringify({ user_id: userId, provider, ...box, updated_at: new Date().toISOString() }),
  });
}

export async function deleteSecret(userId: string, provider: string): Promise<void> {
  await rest(`integration_secrets?user_id=eq.${userId}&provider=eq.${provider}`, { method: "DELETE" });
}

export async function setIntegrationStatus(userId: string, provider: string, status: string, error: string | null = null) {
  await upsertRow("integration_status", userId, { provider }, { status, last_error: error, ...(status === "connected" ? { last_ok_at: new Date().toISOString() } : {}) });
}
