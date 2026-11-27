// Public, read-only stats for the portfolio. Only fields flagged in settings.public_stat_flags (all off by default).
// Never body data, journal, contacts, recordings or photos (they aren't even candidates in the SQL function).
import { env, json, type Handler } from "../http.js";
import { supabaseConfigured } from "../auth.js";
import { rpc } from "../supabaseAdmin.js";

export function corsFor(origin: string | undefined): Record<string, string> {
  const allowed = (env("PORTFOLIO_ORIGIN") || "").split(",").map((s) => s.trim()).filter(Boolean);
  if (origin && allowed.includes(origin)) return { "access-control-allow-origin": origin, vary: "Origin", "access-control-allow-methods": "GET" };
  return { vary: "Origin" };
}

export const publicStats: Handler = async (req) => {
  const headers = { ...corsFor(req.headers.origin), "cache-control": "public, s-maxage=300, stale-while-revalidate=600" };
  const owner = env("ONE_OWNER_USER_ID");
  if (!supabaseConfigured() || !owner) return json({ v: 1, updated_at: new Date().toISOString(), stats: {} }, 200, headers);
  try {
    const stats = await rpc<Record<string, unknown>>("public_stats_for", { uid: owner });
    return json({ v: 1, updated_at: new Date().toISOString(), stats: stats ?? {} }, 200, headers);
  } catch {
    return json({ v: 1, updated_at: new Date().toISOString(), stats: {} }, 200, { ...headers, "cache-control": "public, s-maxage=60" });
  }
};

export const publicStatsOptions: Handler = async (req) => ({ status: 204, headers: { ...corsFor(req.headers.origin), "access-control-max-age": "86400" } });
