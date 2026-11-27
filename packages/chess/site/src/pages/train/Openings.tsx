// Opening explorer (names by position, CC0 lichess-org/chess-openings) and a repertoire built from your own games.
import { useEffect, useMemo, useState } from "react";
import { Chess } from "chess.js";
import { Board } from "../../components/Board";
import { db, type GameRow } from "../../bridge/storage";
import { openingEntries, loadOpenings, openingFor, type OpeningEntry } from "../../lib/openings";
import type { Opening } from "../../lib/data";
import { replay, START_FEN, tryMove, uciOf } from "../../lib/chess";
import { useSettings } from "../../lib/useSettings";
import { useRoute } from "../../lib/router";

export function Openings() {
  const s = useSettings();
  const [entries, setEntries] = useState<OpeningEntry[] | null>(null);
  const [map, setMap] = useState<Map<string, Opening> | null>(null);
  const route = useRoute();
  const [line, setLine] = useState<string[]>([]);
  const [q, setQ] = useState("");
  const [games, setGames] = useState<GameRow[]>([]);
  const [flip, setFlip] = useState(false);
  const [err, setErr] = useState("");
  useEffect(() => {
    Promise.all([openingEntries(), loadOpenings()]).then(([e, m]) => { setEntries(e); setMap(m); }).catch((x) => setErr((x as Error).message));
    db.games.toArray().then(setGames).catch(() => {});
  }, []);

  const c = useMemo(() => replay(START_FEN, line), [line]);
  const fens = useMemo(() => { const out: string[] = []; const cc = new Chess(); for (const u of line) { tryMove(cc, u.slice(0, 2), u.slice(2, 4), u[4]); out.push(cc.fen()); } return out; }, [line]);
  const name = map ? openingFor(map, fens) : null;
  const sans = c.history();

  const conts = useMemo(() => {
    if (!entries) return [];
    const m = new Map<string, { uci: string; san: string; n: number; name: string }>();
    for (const e of entries) {
      if (e.ucis.length <= line.length || line.some((u, i) => e.ucis[i] !== u)) continue;
      const u = e.ucis[line.length];
      const x = m.get(u) ?? { uci: u, san: e.sans[line.length], n: 0, name: "" };
      x.n++;
      m.set(u, x);
    }
    const out = [...m.values()].sort((a, b) => b.n - a.n).slice(0, 12);
    for (const x of out) {
      const cc = new Chess(c.fen()); tryMove(cc, x.uci.slice(0, 2), x.uci.slice(2, 4), x.uci[4]);
      x.name = (map ? openingFor(map, [cc.fen()])?.name : "") ?? "";
    }
    return out;
  }, [entries, line, map, c]);

  const results = useMemo(() => {
    const t = q.trim().toLowerCase();
    if (!entries || t.length < 2) return [];
    const words = t.split(/\s+/);
    const movesQ = t.replace(/\d+\.\s*/g, "");
    return entries.filter((e) => {
      const hay = `${e.eco} ${e.name}`.toLowerCase();
      return words.every((w) => hay.includes(w)) || e.sans.join(" ").toLowerCase().startsWith(movesQ);
    }).slice(0, 40);
  }, [q, entries]);

  const repertoire = useMemo(() => {
    const m = new Map<string, { color: "w" | "b"; eco: string; name: string; n: number; w: number; d: number; l: number }>();
    for (const g of games) {
      if (g.mode !== "bot" || !g.opening) continue;
      const k = g.playerColor + g.opening.eco + g.opening.name;
      const x = m.get(k) ?? { color: g.playerColor, eco: g.opening.eco, name: g.opening.name, n: 0, w: 0, d: 0, l: 0 };
      x.n++;
      if (g.result === "1/2-1/2") x.d++; else if ((g.result === "1-0") === (g.playerColor === "w")) x.w++; else if (g.result !== "*") x.l++;
      m.set(k, x);
    }
    return [...m.values()].sort((a, b) => b.n - a.n);
  }, [games]);

  const onMove = (from: string, to: string, promo?: string) => {
    const cc = new Chess(c.fen()); const m = tryMove(cc, from, to, promo);
    if (!m) return false; setLine([...line, uciOf(m)]); return true;
  };
  const loadByName = (nm: string) => { const e = entries?.find((x) => x.name === nm); if (e) setLine(e.ucis); };
  // Deep link from the top search bar: #/train?tab=openings&open=<opening name>
  const openParam = route.q.get("open");
  useEffect(() => { if (entries && openParam) { const e = entries.find((x) => x.name === openParam); if (e) setLine(e.ucis); } }, [entries, openParam]);

  if (err) return <p className="err">Could not load openings: {err}</p>;
  return (
    <div className="play openings">
      <div className="play-board">
        <p className="opening-name" data-testid="opening-name" aria-live="polite">{name ? <><strong>{name.eco}</strong> {name.name}</> : line.length ? <span className="muted">Out of book</span> : <span className="muted">Starting position</span>}</p>
        <div className="board-row">
          <Board fen={c.fen()} orientation={flip ? "black" : "white"} movable="both" onMove={onMove}
            lastMove={line.length ? [line[line.length - 1].slice(0, 2), line[line.length - 1].slice(2, 4)] : null}
            theme={s.boardTheme} pieceSet={s.pieceSet} coordinates={s.coordinates} legalHighlights={s.legalHighlights} label="Opening explorer board" />
        </div>
        <div className="navrow">
          <button className="btn" onClick={() => setLine([])}>Reset</button>
          <button className="btn" onClick={() => setLine(line.slice(0, -1))} disabled={!line.length}>Back</button>
          <button className="btn" onClick={() => setFlip(!flip)}>Flip</button>
        </div>
      </div>
      <aside className="panel">
        <label className="sr-only" htmlFor="op-q">Search openings</label>
        <input id="op-q" type="text" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search by name, ECO or moves (e4 c5)" autoComplete="off" />
        {results.length ? (
          <ul className="oplist" aria-label="Search results">
            {results.map((e) => <li key={e.eco + e.name + e.pgn}><button className="line" onClick={() => { setLine(e.ucis); setQ(""); }}><strong>{e.eco}</strong> {e.name} <small className="muted">{e.pgn}</small></button></li>)}
          </ul>
        ) : null}
        <p className="muted small mono">{sans.length ? sans.map((m, i) => (i % 2 === 0 ? `${i / 2 + 1}. ${m}` : m)).join(" ") : "Play moves on the board or pick a continuation."}</p>
        <div>
          <h3 className="sub-h">Book continuations</h3>
          {conts.length ? <div className="lines">{conts.map((x) => (
            <button key={x.uci} className="line" onClick={() => setLine([...line, x.uci])}><strong>{x.san}</strong> <span className="muted">{x.name || "unnamed"} · {x.n} line{x.n === 1 ? "" : "s"}</span></button>
          ))}</div> : <p className="muted small">{entries ? "No named continuations from here." : "Loading…"}</p>}
        </div>
        <div>
          <h3 className="sub-h">Your repertoire</h3>
          {repertoire.length ? (
            <table className="tbl"><thead><tr><th>As</th><th>Opening</th><th>Games</th><th>W/D/L</th></tr></thead>
              <tbody>{repertoire.slice(0, 12).map((r) => (
                <tr key={r.color + r.eco + r.name}><td>{r.color === "w" ? "White" : "Black"}</td><td><button className="textlink" onClick={() => loadByName(r.name)}>{r.eco} {r.name}</button></td><td>{r.n}</td><td>{r.w}/{r.d}/{r.l}</td></tr>
              ))}</tbody></table>
          ) : <p className="muted small">Openings from your games against Bobby will show up here.</p>}
        </div>
      </aside>
    </div>
  );
}
