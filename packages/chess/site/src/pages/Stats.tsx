// Stats: rating curve, accuracy, blunders, phases, openings, weakness heatmap, benchmarks and game history (Python stats_summary).
import { useEffect, useMemo, useState } from "react";
import { BarChart, Heatmap, LineChart } from "../components/Charts";
import { py } from "../bridge/py";
import { db, store, type GameRow } from "../bridge/storage";
import type { BenchmarkRow, Profile, StatsSummary } from "../bridge/types";
import { data } from "../lib/data";
import { statsGame } from "../lib/pipeline";
import { go } from "../lib/router";
import { Select } from "../components/Select";

const PHASE_LABEL = { opening: "Opening", middle: "Middlegame", end: "Endgame" } as const;
const short = (d: string) => (d ?? "").slice(5, 10);
const tagLabel = (t: string) => (t.startsWith("opening_") ? `Opening ${t.slice(8)}` : t.replace(/_/g, " "));

export function Stats() {
  const [sum, setSum] = useState<StatsSummary | null>(null);
  const [games, setGames] = useState<GameRow[]>([]);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [bench, setBench] = useState<{ rows: BenchmarkRow[]; sample: boolean } | null>(null);
  const [err, setErr] = useState("");
  const [f, setF] = useState({ result: "all", mode: "all", color: "all", q: "" });

  useEffect(() => {
    (async () => {
      const gs = await store.listGames();
      setGames(gs);
      const p = await store.getProfile(); setProfile(p);
      const analyses = (await db.analysis.toArray()).filter((a) => gs.find((g) => g.id === a.gameId)?.mode === "bot").map((a) => ({ ...a.game, game_id: a.gameId }));
      const s = await py.stats_summary(gs.filter((g) => g.mode === "bot").map(statsGame), analyses);
      setSum(s);
      if (p) {
        const pb = s.phase_breakdown;
        const moves = pb.opening.moves + pb.middle.moves + pb.end.moves;
        const tot = s.blunders_per_game.reduce((a, b) => ({ bl: a.bl + b.blunders, mi: a.mi + b.mistakes, ia: a.ia + b.inaccuracies }), { bl: 0, mi: 0, ia: 0 });
        if (moves) {
          const w = (await store.getWeakness()) as { tags?: Record<string, { score?: number }> } | null;
          const missed = Object.entries(w?.tags ?? {}).filter(([t]) => !t.startsWith("phase_")).sort((a, b) => (b[1].score ?? 0) - (a[1].score ?? 0)).slice(0, 5).map(([t]) => t);
          const gameStats = {
            acpl: { opening: pb.opening.moves ? pb.opening.acpl : null, middle: pb.middle.moves ? pb.middle.acpl : null, end: pb.end.moves ? pb.end.acpl : null },
            blunder_rate: tot.bl / moves, mistake_rate: tot.mi / moves, inaccuracy_rate: tot.ia / moves, themes_missed: missed,
          };
          const b = await data.benchmarks();
          setBench({ rows: await py.benchmarks_compare(p, gameStats, b.bands), sample: b.sample });
        }
      }
    })().catch((e) => setErr((e as Error).message));
  }, []);

  const shown = useMemo(() => games.filter((g) => {
    const you = g.mode === "bot" ? g.playerColor : null;
    const r = g.result === "1/2-1/2" ? "draw" : g.result === "*" ? "unfinished" : you ? ((g.result === "1-0") === (you === "w") ? "win" : "loss") : "decisive";
    if (f.result !== "all" && r !== f.result) return false;
    if (f.mode !== "all" && g.mode !== f.mode) return false;
    if (f.color !== "all" && g.playerColor !== f.color) return false;
    if (f.q && !`${g.opening?.eco ?? ""} ${g.opening?.name ?? ""} ${g.termination ?? ""}`.toLowerCase().includes(f.q.toLowerCase())) return false;
    return true;
  }), [games, f]);

  if (err) return <div className="page empty"><h1>Stats</h1><p className="err">{err}</p></div>;
  if (!sum) return <div className="loading">Crunching your games…</div>;
  const rated = games.filter((g) => g.mode === "bot" && g.result !== "*");
  const heatRows = Object.entries(sum.weakness_heatmap).sort((a, b) => b[1].total - a[1].total).slice(0, 10).map(([t]) => t);
  const resultOf = (g: GameRow) => {
    if (g.result === "1/2-1/2") return "Draw";
    if (g.result === "*") return "Unfinished";
    if (g.mode !== "bot") return g.result;
    return (g.result === "1-0") === (g.playerColor === "w") ? "Win" : "Loss";
  };

  return (
    <div className="page stats" data-testid="stats">
      <header className="page-h">
        <h1>Stats</h1>
        <div className="kpis">
          <div className="kpi"><small>Rating</small><strong data-testid="rating">{profile ? Math.round(profile.rating) : "–"}</strong><small className="muted">{profile ? `uncertainty ±${Math.round(profile.rd)}` : "play to calibrate"}</small></div>
          <div className="kpi"><small>Games vs Bobby</small><strong>{rated.length}</strong><small className="muted">{rated.filter((g) => resultOf(g) === "Win").length} won</small></div>
          <div className="kpi"><small>Avg accuracy</small><strong>{sum.accuracy_trend.length ? Math.round(sum.accuracy_trend.reduce((a, b) => a + b.accuracy, 0) / sum.accuracy_trend.length) + "%" : "–"}</strong><small className="muted">last {sum.accuracy_trend.length}</small></div>
          <div className="kpi"><small>Blunders / game</small><strong>{sum.blunders_per_game.length ? (sum.blunders_per_game.reduce((a, b) => a + b.blunders, 0) / sum.blunders_per_game.length).toFixed(1) : "–"}</strong><small className="muted">lower is better</small></div>
        </div>
      </header>

      <div className="charts">
        <LineChart title="Rating" testId="chart-rating" points={sum.rating_curve.map((r) => ({ x: short(r.date), y: r.rating, label: r.date?.slice(0, 10) }))} />
        <LineChart title="Accuracy" unit="%" yMin={0} yMax={100} testId="chart-accuracy" points={sum.accuracy_trend.map((r) => ({ x: short(r.date), y: r.accuracy, label: r.date?.slice(0, 10) }))} />
        <BarChart title="Blunders per game" testId="chart-blunders" points={sum.blunders_per_game.slice(-20).map((r, i) => ({ x: String(i + 1), y: r.blunders, label: `${r.date?.slice(0, 10)} (${r.mistakes} mistakes)` }))} />
        <BarChart title="Avg centipawn loss by phase" points={(["opening", "middle", "end"] as const).filter((p) => sum.phase_breakdown[p].moves).map((p) => ({ x: PHASE_LABEL[p], y: sum.phase_breakdown[p].acpl, label: `${PHASE_LABEL[p]}: ${sum.phase_breakdown[p].moves} moves, ${(sum.phase_breakdown[p].error_rate * 100).toFixed(1)}% errors` }))} />
      </div>

      <div className="two">
        <Heatmap title="Weakness heatmap (errors by phase)" rows={heatRows} cols={["opening", "middle", "end"]} rowLabel={tagLabel} value={(r, c) => sum.weakness_heatmap[r]?.[c as "opening"] ?? 0} />
        <figure className="chart">
          <figcaption>Opening results</figcaption>
          {sum.opening_results.length ? (
            <table className="tbl"><thead><tr><th>Opening</th><th>Games</th><th>W/D/L</th><th>Score</th></tr></thead>
              <tbody>{sum.opening_results.slice(0, 10).map((o) => (
                <tr key={o.eco}><td><strong>{o.eco}</strong> {o.name ?? ""}</td><td>{o.n}</td><td>{o.w}/{o.d}/{o.l}</td><td><span className="meter sm"><span style={{ width: o.score * 100 + "%" }} /></span> {Math.round(o.score * 100)}%</td></tr>
              ))}</tbody></table>
          ) : <p className="muted small">No openings recorded yet.</p>}
        </figure>
      </div>

      <section className="chart">
        <h2 className="sub-h">Compared with players at your level {bench?.sample ? <small className="pill warn" title="data/benchmarks.json not built yet">sample data</small> : null}</h2>
        {bench?.rows.length ? (
          <table className="tbl" data-testid="benchmarks"><thead><tr><th>Metric</th><th>You</th><th>Typical</th><th /></tr></thead>
            <tbody>{bench.rows.map((r) => (
              <tr key={r.metric}><td>{r.label ?? r.metric}</td><td>{fmtMetric(r.metric, r.you)}</td><td>{fmtMetric(r.metric, r.typical)}</td><td className={/better/.test(r.note) ? "ok" : /worse/.test(r.note) ? "err" : "muted"}>{r.note}</td></tr>
            ))}</tbody></table>
        ) : <p className="muted small">Play a game against Bobby to compare with typical players at your rating.</p>}
      </section>

      <section className="history">
        <h2 className="sub-h">Game history <small className="muted">{shown.length}</small></h2>
        <div className="filters" role="group" aria-label="Filters">
          <Select aria-label="Result" value={f.result} onChange={(e) => setF({ ...f, result: e.target.value })}><option value="all">All results</option><option value="win">Wins</option><option value="loss">Losses</option><option value="draw">Draws</option><option value="unfinished">Unfinished</option></Select>
          <Select aria-label="Mode" value={f.mode} onChange={(e) => setF({ ...f, mode: e.target.value })}><option value="all">All games</option><option value="bot">vs Bobby</option><option value="local">Two-player / imported</option></Select>
          <Select aria-label="Colour" value={f.color} onChange={(e) => setF({ ...f, color: e.target.value })}><option value="all">Both colours</option><option value="w">As White</option><option value="b">As Black</option></Select>
          <input type="text" aria-label="Opening filter" placeholder="Opening or ending" value={f.q} onChange={(e) => setF({ ...f, q: e.target.value })} />
        </div>
        {shown.length ? (
          <table className="tbl hist" data-testid="history"><thead><tr><th>Date</th><th>Opponent</th><th>Colour</th><th>Result</th><th>Opening</th><th>Rating</th></tr></thead>
            <tbody>{shown.map((g) => (
              <tr key={g.id} onClick={() => go(`/review/${g.id}`)} className="rowlink">
                <td><a href={`#/review/${g.id}`}>{g.date.slice(0, 10)}</a></td>
                <td>{g.mode === "bot" ? `Bobby ~${g.botRating ?? "?"}` : "Two-player"}</td><td>{g.playerColor === "w" ? "White" : "Black"}</td>
                <td className={"res-" + resultOf(g).toLowerCase()}>{resultOf(g)}{g.termination ? <small className="muted"> · {g.termination}</small> : null}</td>
                <td>{g.opening ? `${g.opening.eco} ${g.opening.name}` : <span className="muted">–</span>}</td>
                <td>{g.ratingAfter ? Math.round(g.ratingAfter) : <span className="muted">–</span>}</td>
              </tr>
            ))}</tbody></table>
        ) : <p className="muted small">No games match.</p>}
      </section>
    </div>
  );
}

const fmtMetric = (m: string, v: number) => (m.endsWith("_rate") ? `${(v * 100).toFixed(1)}%` : m.startsWith("theme.") ? "" : v.toFixed(1));
