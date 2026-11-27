// LeetCode stats via the UNOFFICIAL public GraphQL endpoint. May break at any time: callers show a stale badge.
import { json, type Handler } from "../http.js";
import { requireUser } from "../auth.js";
import { cached } from "../cache.js";

const QUERY = `query userStats($username: String!) {
  matchedUser(username: $username) {
    profile { ranking }
    submitStatsGlobal { acSubmissionNum { difficulty count } }
  }
}`;

export function parseLeetcode(j: unknown): { easy: number; medium: number; hard: number; total: number; ranking: number | null } | null {
  const u = (j as { data?: { matchedUser?: { profile?: { ranking?: number }; submitStatsGlobal?: { acSubmissionNum?: { difficulty: string; count: number }[] } } } })?.data?.matchedUser;
  const list = u?.submitStatsGlobal?.acSubmissionNum;
  if (!u || !list) return null;
  const get = (d: string) => list.find((x) => x.difficulty === d)?.count ?? 0;
  return { easy: get("Easy"), medium: get("Medium"), hard: get("Hard"), total: get("All"), ranking: u.profile?.ranking ?? null };
}

export const leetcode: Handler = async (req) => {
  const user = await requireUser(req);
  const u = (req.query.get("u") ?? "").trim();
  if (!/^[\w.-]{1,40}$/.test(u)) return json({ error: "bad_username" }, 400);
  const data = await cached(`leetcode:${user.id}:${u}`, 6 * 3600, async () => {
    const r = await fetch("https://leetcode.com/graphql", {
      method: "POST",
      headers: { "content-type": "application/json", referer: "https://leetcode.com", "user-agent": "ONE/1.0 (personal dashboard)" },
      body: JSON.stringify({ query: QUERY, variables: { username: u } }),
      signal: AbortSignal.timeout(10_000),
    });
    if (!r.ok) throw new Error(`leetcode_${r.status}`);
    const parsed = parseLeetcode(await r.json());
    if (!parsed) throw new Error("leetcode_user_not_found");
    return parsed;
  });
  return json(data);
};
