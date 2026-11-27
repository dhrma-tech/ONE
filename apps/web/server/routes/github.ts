// GitHub: contribution calendar (GraphQL contributionsCollection) + pushes today/this week (REST events).
// Fine-grained read-only token in GITHUB_TOKEN (server only). Cached 1 hour.
import { env, json, type Handler } from "../http.js";
import { requireUser } from "../auth.js";
import { cached } from "../cache.js";

const QUERY = `query($login: String!) { user(login: $login) { contributionsCollection { contributionCalendar { totalContributions weeks { contributionDays { date contributionCount } } } } } }`;

export interface GithubSummary {
  contributions: number;
  pushes_today: number;
  pushes_week: number;
  calendar: { date: string; count: number }[];
}

const ist = (iso: string) => new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata" }).format(new Date(iso));

export function countPushes(events: { type: string; created_at: string; payload?: { size?: number; distinct_size?: number } }[], today: string, weekStart: string) {
  let t = 0;
  let w = 0;
  for (const e of events) {
    if (e.type !== "PushEvent") continue;
    const d = ist(e.created_at);
    if (d === today) t++;
    if (d >= weekStart && d <= today) w++;
  }
  return { pushes_today: t, pushes_week: w };
}

export async function fetchGithub(login: string, token: string): Promise<GithubSummary> {
  const h = { authorization: `Bearer ${token}`, "user-agent": "ONE/1.0", accept: "application/vnd.github+json" };
  const [g, ev] = await Promise.all([
    fetch("https://api.github.com/graphql", { method: "POST", headers: h, body: JSON.stringify({ query: QUERY, variables: { login } }), signal: AbortSignal.timeout(10_000) }),
    fetch(`https://api.github.com/users/${login}/events?per_page=100`, { headers: h, signal: AbortSignal.timeout(10_000) }),
  ]);
  if (!g.ok) throw new Error(`github_graphql_${g.status}`);
  const gj = (await g.json()) as { data?: { user?: { contributionsCollection: { contributionCalendar: { totalContributions: number; weeks: { contributionDays: { date: string; contributionCount: number }[] }[] } } } } };
  const cal = gj.data?.user?.contributionsCollection.contributionCalendar;
  if (!cal) throw new Error("github_user_not_found");
  const events = ev.ok ? ((await ev.json()) as Parameters<typeof countPushes>[0]) : [];
  const today = ist(new Date().toISOString());
  const d = new Date(`${today}T00:00:00Z`);
  const ws = new Date(d.getTime() - ((d.getUTCDay() + 6) % 7) * 86_400_000).toISOString().slice(0, 10);
  return {
    contributions: cal.totalContributions,
    calendar: cal.weeks.flatMap((w) => w.contributionDays.map((x) => ({ date: x.date, count: x.contributionCount }))),
    ...countPushes(events, today, ws),
  };
}

export const github: Handler = async (req) => {
  const user = await requireUser(req);
  const token = env("GITHUB_TOKEN");
  if (!token) return json({ error: "not_configured" }, 409);
  const login = env("GITHUB_USERNAME") || "dhrma-tech";
  return json(await cached(`github:${user.id}:${login}`, 3600, () => fetchGithub(login, token)));
};
