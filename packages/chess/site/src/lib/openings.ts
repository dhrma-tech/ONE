// Opening names (lichess-org/chess-openings, CC0) by position. Lookup is by EPD so transpositions are named too.
import { Chess } from "chess.js";
import { data, type Opening } from "./data";
import { uciOf } from "./chess";

export interface OpeningEntry extends Opening { ucis: string[]; sans: string[] }

let byEpd: Map<string, Opening> | null = null;
let loading: Promise<Map<string, Opening>> | null = null;
let entries: OpeningEntry[] | null = null;

export const epdOf = (fen: string) => fen.split(" ").slice(0, 4).join(" ");

export function loadOpenings(): Promise<Map<string, Opening>> {
  if (byEpd) return Promise.resolve(byEpd);
  loading ??= data.openings().then((list) => {
    const m = new Map<string, Opening>();
    // Later (deeper/more specific) entries for the same EPD win only if the earlier one is absent.
    for (const o of list) if (!m.has(o.epd)) m.set(o.epd, o);
    byEpd = m;
    return m;
  });
  return loading;
}

function lookup(m: Map<string, Opening>, fen: string): Opening | undefined {
  const e = epdOf(fen);
  return m.get(e) ?? m.get(e.replace(/ [a-h][36]$/, " -"));
}

/** Deepest named opening along a sequence of positions (FENs after each move). */
export function openingFor(m: Map<string, Opening>, fens: string[]): Opening | null {
  let best: Opening | null = null;
  for (const f of fens) { const o = lookup(m, f); if (o) best = o; }
  return best;
}

export async function openingOfPgn(pgn: string): Promise<Opening | null> {
  const m = await loadOpenings();
  const c = new Chess();
  try { c.loadPgn(pgn); } catch { return null; }
  return openingFor(m, c.history({ verbose: true }).slice(0, 30).map((h) => h.after));
}

/** All openings with their move lists parsed (for the explorer). Parsed once, lazily. */
export async function openingEntries(): Promise<OpeningEntry[]> {
  if (entries) return entries;
  const list = await data.openings();
  const out: OpeningEntry[] = [];
  for (const o of list) {
    const c = new Chess();
    try { c.loadPgn(o.pgn); } catch { continue; }
    const h = c.history({ verbose: true });
    out.push({ ...o, ucis: h.map(uciOf), sans: h.map((x) => x.san) });
  }
  entries = out;
  return out;
}
