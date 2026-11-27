// Daily cron (Vercel Hobby: at most once a day). Snapshots GitHub, LeetCode and Chess.com for the owner
// and keeps the free Supabase project active. Auth: Authorization: Bearer $CRON_SECRET (Vercel sends it).
import { env, json, type Handler } from "../http.js";
import { supabaseConfigured } from "../auth.js";
import { select, upsertRow, setIntegrationStatus } from "../supabaseAdmin.js";
import { fetchGithub } from "./github.js";
import { parseLeetcode } from "./leetcode.js";
import { parseStats } from "./chesscom.js";

const istToday = () => new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata" }).format(new Date());

export const cronDaily: Handler = async (req) => {
  const secret = env("CRON_SECRET");
  if (!secret || req.headers.authorization !== `Bearer ${secret}`) return json({ error: "forbidden" }, 403);
  const uid = env("ONE_OWNER_USER_ID");
  if (!supabaseConfigured() || !uid) return json({ ok: true, skipped: "not_configured" });
  const date = istToday();
  const out: Record<string, string> = {};
  const settings = (await select<{ usernames: { chesscom?: string; leetcode?: string } }>("settings", `user_id=eq.${uid}&deleted_at=is.null&select=usernames&limit=1`))[0];
  if (env("GITHUB_TOKEN")) {
    try {
      const g = await fetchGithub(env("GITHUB_USERNAME") || "dhrma-tech", env("GITHUB_TOKEN"));
      await upsertRow("github_snapshots", uid, { date }, { contributions: g.contributions, pushes_today: g.pushes_today, calendar: g.calendar });
      await setIntegrationStatus(uid, "github", "connected");
      out.github = "ok";
    } catch (e) {
      out.github = String((e as Error).message);
    }
  }
  const lc = settings?.usernames?.leetcode;
  if (lc) {
    try {
      const r = await fetch("https://leetcode.com/graphql", {
        method: "POST",
        headers: { "content-type": "application/json", referer: "https://leetcode.com" },
        body: JSON.stringify({ query: "query($username: String!) { matchedUser(username: $username) { profile { ranking } submitStatsGlobal { acSubmissionNum { difficulty count } } } }", variables: { username: lc } }),
        signal: AbortSignal.timeout(10_000),
      });
      const p = parseLeetcode(await r.json());
      if (p) await upsertRow("leetcode_snapshots", uid, { date }, p);
      out.leetcode = p ? "ok" : "not_found";
    } catch (e) {
      out.leetcode = String((e as Error).message);
    }
  }
  const cc = settings?.usernames?.chesscom;
  if (cc) {
    try {
      const r = await fetch(`https://api.chess.com/pub/player/${encodeURIComponent(cc.toLowerCase())}/stats`, {
        headers: { "user-agent": `ONE/1.0 (personal dashboard; contact: ${env("CHESSCOM_USER_AGENT_CONTACT") || "github.com/dhrma-tech/ONE"})` },
        signal: AbortSignal.timeout(10_000),
      });
      if (r.ok) await upsertRow("chess_snapshots", uid, { date }, parseStats(await r.json()));
      out.chesscom = r.ok ? "ok" : `http_${r.status}`;
    } catch (e) {
      out.chesscom = String((e as Error).message);
    }
  }
  return json({ ok: true, date, ...out });
};
