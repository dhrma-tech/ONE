// Puzzles: own-mistake puzzles on a spaced-repetition schedule (Python srs_*), plus rating-aware themed sets (select_puzzles).
import { useCallback, useEffect, useState } from "react";
import { PuzzlePlayer, type PuzzleResult } from "../../components/PuzzlePlayer";
import { py } from "../../bridge/py";
import { db, type PuzzleProgressRow } from "../../bridge/storage";
import type { Puzzle } from "../../bridge/types";
import { ensureProfile } from "../../dialogs/LevelCard";
import { data } from "../../lib/data";
import { today } from "../../lib/chess";
import { markActivity } from "../../lib/progress";
import { useRoute, go } from "../../lib/router";
import { Select } from "../../components/Select";

export const THEMES: [string, string][] = [
  ["", "Mixed"], ["mateIn1", "Mate in 1"], ["mateIn2", "Mate in 2"], ["mateIn3", "Mate in 3"], ["fork", "Fork"], ["pin", "Pin"], ["skewer", "Skewer"],
  ["discoveredAttack", "Discovered attack"], ["doubleCheck", "Double check"], ["backRankMate", "Back-rank mate"], ["hangingPiece", "Hanging piece"],
  ["deflection", "Deflection"], ["attraction", "Attraction"], ["sacrifice", "Sacrifice"], ["trappedPiece", "Trapped piece"], ["promotion", "Promotion"],
  ["advancedPawn", "Advanced pawn"], ["zugzwang", "Zugzwang"], ["endgame", "Endgame"], ["pawnEndgame", "Pawn endgame"], ["rookEndgame", "Rook endgame"],
  ["opening", "Opening"], ["kingsideAttack", "Kingside attack"], ["defensiveMove", "Defensive move"], ["quietMove", "Quiet move"],
];

const SEEN_KEY = "puzzleSeen";
const gradeOf = (r: PuzzleResult): 0 | 1 | 2 | 3 => (!r.solved ? 0 : r.mistakes || r.hinted ? 1 : r.ms < 20000 ? 3 : 2);

/** Themed queue: prefilter the big file by rating window in TS, then let Python pick (select_puzzles). */
export async function themedQueue(theme: string | null, n = 20): Promise<Puzzle[]> {
  const [all, profile, seenRow] = await Promise.all([data.puzzles(), ensureProfile(), db.current.get(SEEN_KEY)]);
  const seen = new Set((seenRow?.value as string[] | undefined) ?? []);
  const target = profile.rating + 50;
  let pool: Puzzle[] = [];
  for (const w of [250, 500, 900, 3000]) {
    pool = all.filter((p) => !seen.has(p.id) && (!theme || p.themes.includes(theme)) && Math.abs(p.rating - target) <= w);
    if (pool.length >= n * 3) break;
  }
  if (pool.length > 1500) pool = pool.sort(() => Math.random() - 0.5).slice(0, 1500);
  const picked = await py.select_puzzles(pool, profile, theme, n * 2);
  return picked.sort(() => Math.random() - 0.5).slice(0, n);
}
export async function markSeen(id: string) {
  const row = await db.current.get(SEEN_KEY);
  const list = ((row?.value as string[] | undefined) ?? []).filter((x) => x !== id);
  list.push(id);
  await db.current.put({ key: SEEN_KEY, value: list.slice(-600) });
}

export function Puzzles() {
  const route = useRoute();
  const mode = route.q.get("set") === "mine" ? "mine" : "themed";
  const theme = route.q.get("theme") ?? "";
  const [counts, setCounts] = useState<{ due: number; total: number; next: string | null }>({ due: 0, total: 0, next: null });
  const nav = (o: { set?: string; theme?: string }) => {
    const q = new URLSearchParams({ tab: "puzzles", set: o.set ?? mode, ...(o.theme ?? theme ? { theme: o.theme ?? theme } : {}) });
    go(`/train?${q}`);
  };
  const refresh = useCallback(async () => {
    const rows = await db.puzzleProgress.toArray();
    const due = await py.due_cards(rows, today()).catch(() => rows.filter((r) => r.due <= today()));
    const upcoming = rows.map((r) => r.due).filter((d) => d > today()).sort()[0] ?? null;
    setCounts({ due: due.length, total: rows.length, next: upcoming });
  }, []);
  useEffect(() => { void refresh(); }, [refresh]);

  return (
    <div className="tab-body">
      <div className="seg seg-inline" role="group" aria-label="Puzzle set">
        <button className={"seg-b" + (mode === "themed" ? " on" : "")} aria-pressed={mode === "themed"} onClick={() => nav({ set: "themed" })}>Themed</button>
        <button className={"seg-b" + (mode === "mine" ? " on" : "")} aria-pressed={mode === "mine"} onClick={() => nav({ set: "mine" })}>From your games{counts.due ? ` (${counts.due} due)` : ""}</button>
      </div>
      {mode === "mine" ? <MinePuzzles onChange={refresh} counts={counts} /> : (
        <>
          <label className="inline-l">Theme <Select value={theme} onChange={(e) => nav({ theme: e.target.value })} aria-label="Puzzle theme">
            {THEMES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</Select></label>
          <ThemedPuzzles theme={theme || null} key={theme} />
        </>
      )}
    </div>
  );
}

function ThemedPuzzles({ theme }: { theme: string | null }) {
  const [queue, setQueue] = useState<Puzzle[] | null>(null);
  const [i, setI] = useState(0);
  const [err, setErr] = useState("");
  const [score, setScore] = useState({ ok: 0, n: 0 });
  useEffect(() => { themedQueue(theme).then((q) => { setQueue(q); setI(0); }).catch((e) => setErr((e as Error).message)); }, [theme]);
  if (err) return <p className="err">Could not load puzzles: {err}</p>;
  if (!queue) return <p className="muted">Picking puzzles for your rating…</p>;
  if (!queue.length) return <p className="muted">No puzzles for this theme near your rating.</p>;
  const p = queue[i % queue.length];
  const onDone = async (r: PuzzleResult) => {
    setScore((s) => ({ ok: s.ok + (r.solved ? 1 : 0), n: s.n + 1 }));
    await markSeen(p.id);
    if (r.solved) await markActivity("puzzles_solved");
    else {
      // Missed themed puzzles join the spaced-repetition deck.
      const d = today();
      const card = await py.srs_new_card(p.id, d).catch(() => ({ due: d, interval: 0, ease: 2.5 }));
      await db.puzzleProgress.put({ ...card, id: p.id, puzzle: { ...p, source: "themed" } } as PuzzleProgressRow);
      await markActivity();
    }
  };
  return (
    <div className="trainer">
      <PuzzlePlayer puzzle={p} onDone={(r) => void onDone(r)} onNext={() => { if (i + 1 >= queue.length) themedQueue(theme).then((q) => { setQueue(q); setI(0); }); else setI(i + 1); }} />
      <p className="muted small">Session: {score.ok}/{score.n} solved. Missed puzzles are added to your review deck.</p>
    </div>
  );
}

function MinePuzzles({ onChange, counts }: { onChange: () => void; counts: { due: number; total: number; next: string | null } }) {
  const [due, setDue] = useState<PuzzleProgressRow[] | null>(null);
  const [cur, setCur] = useState<PuzzleProgressRow | null>(null);
  const [last, setLast] = useState<string>("");
  const load = useCallback(async () => {
    const rows = (await db.puzzleProgress.toArray()).filter((r) => r.puzzle);
    const d = (await py.due_cards(rows, today()).catch(() => rows.filter((r) => r.due <= today()))) as PuzzleProgressRow[];
    setDue(d); setCur(d[0] ?? null);
  }, []);
  useEffect(() => { void load(); }, [load]);
  if (!due) return <p className="muted">Loading your deck…</p>;
  if (!cur) {
    return (
      <div className="card">
        <h2>{counts.total ? "All caught up" : "No puzzles from your games yet"}</h2>
        <p className="muted">{counts.total ? `${counts.total} puzzles in your deck.${counts.next ? ` Next review on ${counts.next}.` : ""}` : "Mistakes and blunders from your games against Bobby become puzzles here, reviewed after 1, 3, 7 and 30 days."}</p>
        {last ? <p className="muted small">{last}</p> : null}
      </div>
    );
  }
  const onDone = async (r: PuzzleResult) => {
    const g = gradeOf(r);
    const { puzzle, ...card } = cur;
    const next = await py.srs_review(card, g, today());
    await db.puzzleProgress.put({ ...next, id: cur.id, puzzle } as PuzzleProgressRow);
    setLast(`Next review in ${next.interval} day${next.interval === 1 ? "" : "s"}.`);
    await markActivity(r.solved ? "puzzles_solved" : undefined);
    onChange();
  };
  return (
    <div className="trainer">
      <PuzzlePlayer puzzle={cur.puzzle!} onDone={(r) => void onDone(r)} onNext={() => void load()} label="Puzzle from your game" />
      <p className="muted small">{due.length} due today. {last} {cur.puzzle?.game_id ? <a href={`#/review/${String(cur.puzzle.game_id)}`}>Open the game</a> : null}</p>
    </div>
  );
}
