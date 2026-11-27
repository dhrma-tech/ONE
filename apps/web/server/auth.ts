import { env, HttpError, type ApiRequest } from "./http.js";

export interface ApiUser {
  id: string;
  email?: string;
  local: boolean;
}

export const supabaseConfigured = (): boolean => !!env("SUPABASE_URL") && !!env("SUPABASE_SERVICE_ROLE_KEY");

const cache = new Map<string, { user: ApiUser; until: number }>();

/**
 * Resolve the caller. With Supabase configured: verify the Bearer token with Supabase Auth and,
 * when ONE_OWNER_USER_ID is set, require that user. Without Supabase (local mode): a local user.
 */
export async function requireUser(req: ApiRequest): Promise<ApiUser> {
  if (!supabaseConfigured()) return { id: "local", local: true };
  const auth = req.headers.authorization ?? "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";
  if (!token) throw new HttpError(401, "unauthenticated");
  const hit = cache.get(token);
  if (hit && hit.until > Date.now()) return hit.user;
  const r = await fetch(`${env("SUPABASE_URL")}/auth/v1/user`, {
    headers: { apikey: env("SUPABASE_SERVICE_ROLE_KEY"), authorization: `Bearer ${token}` },
    signal: AbortSignal.timeout(8000),
  });
  if (!r.ok) throw new HttpError(401, "invalid_token");
  const u = (await r.json()) as { id: string; email?: string };
  const owner = env("ONE_OWNER_USER_ID");
  if (owner && u.id !== owner) throw new HttpError(403, "not_owner");
  const user = { id: u.id, email: u.email, local: false };
  cache.set(token, { user, until: Date.now() + 60_000 });
  return user;
}
