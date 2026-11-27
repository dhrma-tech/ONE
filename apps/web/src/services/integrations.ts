// Client side of third-party snapshots. Calls ONE's /api/*, writes daily snapshot rows, tracks status.
// All failures are soft: the UI shows the last snapshot with a "stale" tag and never blocks.
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "@/data/db";
import { repo } from "@/data/repo";
import { api, ApiError } from "@/lib/api";
import { today } from "@/lib/dates";
import { getSettings } from "./settings";

export type Provider = "google" | "github" | "leetcode" | "chesscom" | "buffer" | "youtube" | "apple_music" | "obsidian";

export async function setStatus(provider: Provider, status: "connected" | "error" | "stale" | "off", error?: string, meta?: Record<string, unknown>) {
  const cur = (await db.t("integration_status").where("provider").equals(provider).toArray())[0];
  await repo.upsertBy("integration_status", { provider }, {
    status,
    last_error: error ?? null,
    ...(status === "connected" ? { last_ok_at: new Date().toISOString() } : {}),
    meta: { ...(cur?.meta ?? {}), ...(meta ?? {}) },
  });
}

export function useStatus(provider: Provider) {
  return useLiveQuery(async () => (await db.t("integration_status").where("provider").equals(provider).toArray()).find((r) => !r.deleted_at) ?? null, [provider]);
}

const errMsg = (e: unknown) => (e instanceof ApiError ? e.code : String((e as Error)?.message ?? e));

export async function refreshLeetcode(): Promise<boolean> {
  const u = (await getSettings())?.usernames?.leetcode;
  if (!u) return false;
  try {
    const r = await api.get<{ easy: number; medium: number; hard: number; total: number; ranking: number | null }>(`/api/leetcode?u=${encodeURIComponent(u)}`);
    await repo.upsertBy("leetcode_snapshots", { date: today() }, r);
    await setStatus("leetcode", "connected");
    return true;
  } catch (e) {
    await setStatus("leetcode", "stale", errMsg(e));
    return false;
  }
}

export interface ChessResult {
  stats: { rapid: number | null; blitz: number | null; bullet: number | null; daily: number | null; puzzles: number | null; puzzle_rush_best: number | null };
  games: { url: string; end_time: string; time_class: string; result: string; accuracy: number | null; opponent: string; pgn: string }[];
}

export async function refreshChess(): Promise<boolean> {
  const u = (await getSettings())?.usernames?.chesscom;
  if (!u) return false;
  try {
    const r = await api.get<ChessResult>(`/api/chesscom?u=${encodeURIComponent(u)}`);
    await repo.upsertBy("chess_snapshots", { date: today() }, r.stats);
    for (const g of r.games.slice(0, 20)) await repo.upsertBy("chess_games", { url: g.url }, { ...g, archive_url: null });
    await setStatus("chesscom", "connected");
    return true;
  } catch (e) {
    await setStatus("chesscom", "stale", errMsg(e));
    return false;
  }
}

export async function refreshGithub(): Promise<boolean> {
  try {
    const r = await api.get<{ contributions: number; pushes_today: number; pushes_week: number; calendar: { date: string; count: number }[] }>(`/api/github`);
    await repo.upsertBy("github_snapshots", { date: today() }, { contributions: r.contributions, pushes_today: r.pushes_today, calendar: r.calendar });
    await setStatus("github", "connected", undefined, { pushes_week: r.pushes_week });
    return true;
  } catch (e) {
    await setStatus("github", e instanceof ApiError && e.status === 409 ? "off" : "stale", errMsg(e));
    return false;
  }
}

/** Refresh at most once per TTL per provider (on-demand from the UI; Hobby cron is daily). */
const TTL: Record<string, number> = { leetcode: 6 * 3600_000, chesscom: 3 * 3600_000, github: 3600_000 };
export async function refreshIfStale(p: "leetcode" | "chesscom" | "github"): Promise<void> {
  const s = (await db.t("integration_status").where("provider").equals(p).toArray())[0];
  const last = s?.last_ok_at ? Date.parse(s.last_ok_at) : 0;
  const lastTry = Number((s?.meta as { tried?: number } | undefined)?.tried ?? 0);
  if (Date.now() - last < TTL[p] || Date.now() - lastTry < 10 * 60_000) return;
  if (s) await repo.patch("integration_status", s.id, { meta: { ...(s.meta ?? {}), tried: Date.now() } });
  if (p === "leetcode") await refreshLeetcode();
  if (p === "chesscom") await refreshChess();
  if (p === "github") await refreshGithub();
}

export function useLatest<K extends "leetcode_snapshots" | "chess_snapshots" | "github_snapshots">(table: K) {
  return useLiveQuery(async () => (await db.t(table).toArray()).filter((r) => !r.deleted_at).sort((a, b) => (a.date < b.date ? 1 : -1))[0] ?? null, [table]);
}
