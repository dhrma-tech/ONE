// MIND › Chess: Bobby (lazy iframe, same origin) + Chess.com stats + "Review on Bobby" for recent games.
import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "@/data/db";
import { repo } from "@/data/repo";
import { today, pretty } from "@/lib/dates";
import { useUI } from "@/data/ui";
import { refreshChess, refreshIfStale, useLatest, useStatus } from "@/services/integrations";
import { useSettings } from "@/services/settings";
import { award } from "@/services/xp";
import { Button, Card, Chip, Empty, IconButton, StatCard, TrendChart, toast } from "@/ui";

function ChessCom({ onReview }: { onReview: (pgn: string, url: string, color: "w" | "b") => void }) {
  const s = useSettings();
  const user = s?.usernames?.chesscom as string | undefined;
  const snap = useLatest("chess_snapshots");
  const st = useStatus("chesscom");
  const hist = useLiveQuery(async () => (await db.t("chess_snapshots").toArray()).filter((r) => !r.deleted_at && r.rapid).sort((a, b) => (a.date < b.date ? -1 : 1)).slice(-30), []);
  const games = useLiveQuery(async () => (await db.t("chess_games").toArray()).filter((g) => !g.deleted_at).sort((a, b) => ((a.end_time ?? "") < (b.end_time ?? "") ? 1 : -1)).slice(0, 8), []);
  useEffect(() => {
    if (user) void refreshIfStale("chesscom");
  }, [user]);
  if (!user)
    return (
      <Card className="span-4" title="Chess.com">
        <Empty glyph="♞">
          Set your Chess.com username in <Link className="accent" to="/settings/profile">Settings</Link>.
        </Empty>
      </Card>
    );
  const prev = hist && hist.length > 1 ? hist[hist.length - 2].rapid : null;
  return (
    <Card className="span-4" eyebrow={`@${user} · Published-Data API`} title="Chess.com" right={<>{snap && snap.date !== today() ? <Chip tone="warn" dot>stale</Chip> : null}<IconButton icon="refresh" label="Refresh" onClick={() => void refreshChess().then((ok) => toast[ok ? "ok" : "err"](ok ? "Updated." : st?.last_error ?? "Chess.com unreachable."))} /></>}>
      <div className="cols-2">
        <StatCard label="Rapid" value={snap?.rapid ?? null} delta={snap?.rapid && prev ? { value: snap.rapid - prev } : undefined} />
        <StatCard label="Blitz" value={snap?.blitz ?? null} />
        <StatCard label="Puzzles" value={snap?.puzzles ?? null} />
        <StatCard label="Rush best" value={snap?.puzzle_rush_best ?? null} />
      </div>
      {hist && hist.length > 1 ? <TrendChart label="Rapid rating" points={hist.map((h) => ({ label: h.date.slice(5), value: h.rapid ?? null }))} height={120} /> : null}
      <span className="micro" style={{ display: "block", margin: "12px 0 4px" }}>Recent games</span>
      <ul className="list">
        {(games ?? []).map((g) => (
          <li key={g.id}>
            <Chip tone={g.result === "win" ? "ok" : g.result === "loss" ? "bad" : undefined}>{g.result}</Chip>
            <span className="xs grow truncate">vs {g.opponent} · {g.time_class}</span>
            {g.pgn ? (
              <Button size="sm" onClick={() => onReview(g.pgn!, g.url, (g.pgn!.match(/\[White "([^"]+)"\]/)?.[1] ?? "").toLowerCase() === user.toLowerCase() ? "w" : "b")}>
                Review
              </Button>
            ) : null}
          </li>
        ))}
      </ul>
      {!games?.length ? <p className="xs muted">No games fetched yet.</p> : null}
      <p className="xs muted" style={{ marginTop: 8 }}>Plan: 1-2 rapid games (15+10) a week, review one loss.</p>
    </Card>
  );
}

export default function Chess() {
  const { theme } = useUI();
  const frame = useRef<HTMLIFrameElement>(null);
  const [ready, setReady] = useState(false);
  const pending = useRef<{ pgn: string; url: string; color: "w" | "b" } | null>(null);

  useEffect(() => {
    const onMsg = async (e: MessageEvent) => {
      if (e.origin !== location.origin || e.source !== frame.current?.contentWindow) return;
      const d = e.data as { type?: string; kind?: string; detail?: Record<string, unknown> };
      if (d?.type !== "one:chess-event") return;
      if (d.detail?.ready) {
        setReady(true);
        if (pending.current) {
          frame.current?.contentWindow?.postMessage({ type: "one:review-pgn", ...pending.current, playerColor: pending.current.color }, location.origin);
          pending.current = null;
        }
        return;
      }
      const row = await repo.insert("chess_events", { date: today(), kind: d.kind ?? "event", detail: d.detail ?? {} });
      if (d.kind === "lesson_done") await award("task_done", "mind", "chess_events", row.id, { points: 10, quiet: true });
    };
    window.addEventListener("message", onMsg);
    return () => window.removeEventListener("message", onMsg);
  }, []);

  const review = (pgn: string, url: string, color: "w" | "b") => {
    if (ready) frame.current?.contentWindow?.postMessage({ type: "one:review-pgn", pgn, url, playerColor: color }, location.origin);
    else pending.current = { pgn, url, color };
    frame.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const events = useLiveQuery(async () => (await db.t("chess_events").where("date").equals(today()).toArray()).filter((x) => !x.deleted_at).length, []);
  return (
    <div className="bento">
      <div className="span-8 stack">
        <iframe
          key={theme}
          ref={frame}
          className="chess-frame"
          title="Bobby chess"
          src={`/chess-app/index.html?theme=${theme}`}
          loading="lazy"
          allow="clipboard-write; fullscreen"
        />
        <p className="xs muted">
          Bobby runs fully on this device: Stockfish (single-threaded WASM) and python-chess in Pyodide. First load downloads the engine once. Coach is rule-based, not AI. Today: {events ?? 0} chess events logged · {pretty(today())}
        </p>
      </div>
      <ChessCom onReview={review} />
    </div>
  );
}
