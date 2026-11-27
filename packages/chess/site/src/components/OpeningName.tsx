// Live opening name for a move sequence (deepest named position), loaded lazily from openings.json.
import { useEffect, useMemo, useState } from "react";
import { Chess } from "chess.js";
import { loadOpenings, openingFor } from "../lib/openings";
import type { Opening } from "../lib/data";
import { tryMove } from "../lib/chess";

export function useOpeningName(startFen: string, ucis: string[]): Opening | null {
  const [map, setMap] = useState<Map<string, Opening> | null>(null);
  useEffect(() => { let live = true; loadOpenings().then((m) => live && setMap(m)).catch(() => {}); return () => { live = false; }; }, []);
  const key = startFen + "|" + ucis.slice(0, 40).join(" ");
  return useMemo(() => {
    if (!map || !ucis.length) return null;
    const c = new Chess(startFen); const fens: string[] = [];
    for (const u of ucis.slice(0, 40)) { if (!tryMove(c, u.slice(0, 2), u.slice(2, 4), u[4])) break; fens.push(c.fen()); }
    return openingFor(map, fens);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map, key]);
}
