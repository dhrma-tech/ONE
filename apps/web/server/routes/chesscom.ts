// Chess.com Published-Data API (public, read-only, no key). Server-side so we can send a descriptive
// User-Agent with contact info (Chess.com's request) and cache. Data there is refreshed periodically, not live.
import { env, json, type Handler } from "../http.js";
import { requireUser } from "../auth.js";
import { cached } from "../cache.js";

const ua = () => `ONE/1.0 (personal dashboard; contact: ${env("CHESSCOM_USER_AGENT_CONTACT") || "github.com/dhrma-tech/ONE"})`;

async function get<T>(url: string): Promise<T> {
  const r = await fetch(url, { headers: { "user-agent": ua(), accept: "application/json" }, signal: AbortSignal.timeout(10_000) });
  if (r.status === 404) throw new Error("chesscom_user_not_found");
  if (r.status === 429) throw new Error("chesscom_rate_limited");
  if (!r.ok) throw new Error(`chesscom_${r.status}`);
  return (await r.json()) as T;
}

type Rating = { last?: { rating?: number } } | undefined;
interface StatsJson {
  chess_rapid?: Rating;
  chess_blitz?: Rating;
  chess_bullet?: Rating;
  chess_daily?: Rating;
  tactics?: { highest?: { rating?: number }; lowest?: { rating?: number } };
  puzzle_rush?: { best?: { score?: number } };
}
interface GameJson {
  url: string;
  end_time: number;
  time_class: string;
  pgn?: string;
  accuracies?: { white?: number; black?: number };
  white: { username: string; result: string };
  black: { username: string; result: string };
}

export function parseStats(s: StatsJson) {
  return {
    rapid: s.chess_rapid?.last?.rating ?? null,
    blitz: s.chess_blitz?.last?.rating ?? null,
    bullet: s.chess_bullet?.last?.rating ?? null,
    daily: s.chess_daily?.last?.rating ?? null,
    puzzles: s.tactics?.highest?.rating ?? null,
    puzzle_rush_best: s.puzzle_rush?.best?.score ?? null,
  };
}

const WIN = new Set(["win"]);
const DRAW = new Set(["agreed", "repetition", "stalemate", "insufficient", "50move", "timevsinsufficient"]);

export function parseGame(g: GameJson, user: string) {
  const me = g.white.username.toLowerCase() === user.toLowerCase() ? "white" : "black";
  const mine = g[me];
  const opp = g[me === "white" ? "black" : "white"];
  return {
    url: g.url,
    end_time: new Date(g.end_time * 1000).toISOString(),
    time_class: g.time_class,
    result: WIN.has(mine.result) ? "win" : DRAW.has(mine.result) ? "draw" : "loss",
    accuracy: g.accuracies?.[me] ?? null,
    opponent: opp.username,
    pgn: g.pgn ?? "",
  };
}

export const chesscom: Handler = async (req) => {
  const user = await requireUser(req);
  const u = (req.query.get("u") ?? "").trim().toLowerCase();
  if (!/^[a-z0-9_-]{3,25}$/.test(u)) return json({ error: "bad_username" }, 400);
  const data = await cached(`chesscom:${user.id}:${u}`, 3 * 3600, async () => {
    const [stats, archives] = await Promise.all([get<StatsJson>(`https://api.chess.com/pub/player/${u}/stats`), get<{ archives: string[] }>(`https://api.chess.com/pub/player/${u}/games/archives`)]);
    const last = archives.archives.slice(-2).reverse();
    const games: ReturnType<typeof parseGame>[] = [];
    for (const a of last) {
      const m = await get<{ games: GameJson[] }>(a);
      games.push(...m.games.map((g) => parseGame(g, u)));
      if (games.length >= 20) break;
    }
    games.sort((a, b) => (a.end_time < b.end_time ? 1 : -1));
    return { stats: parseStats(stats), games: games.slice(0, 20) };
  });
  return json(data);
};
