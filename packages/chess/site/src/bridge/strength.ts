// Bobby strength calibration: ALL tunable constants for sub-1320 play live here.
// Used by the browser engine (engine.ts) and by scripts/calibrate-strength.mjs (Node, type-stripped import),
// so keep this file free of imports and non-erasable TypeScript syntax (no enums, namespaces, parameter properties).
//
// Below Stockfish's UCI_Elo floor we emulate weaker play: shallow multi-PV search, softmax sampling over
// centipawn loss, plus an occasional deliberate weaker choice. Values are interpolated linearly between
// WEAK.lo (at ELO_LO) and WEAK.hi (at SF_ELO_MIN). Re-run `npm run calibrate` after changing them and record
// the measured numbers in docs/STRENGTH.md.

/** Stockfish's UCI_Elo range (SF 16+). Below MIN we emulate weaker play. */
export const SF_ELO_MIN = 1320;
export const SF_ELO_MAX = 3190;

/** Lowest target the weak-play curve is defined for. */
export const ELO_LO = 250;

export const WEAK = {
  // v2 (2026-11-24): weakened after calibration showed v1 (lo 3/6/0/260/0.2, hi 9/4/6/45/0.03) at 800 outscoring
  // Stockfish UCI_Elo 1320. See docs/STRENGTH.md.
  lo: { depth: 1, multipv: 6, skill: 0, temperatureCp: 360, blunderProb: 0.3 },
  hi: { depth: 5, multipv: 5, skill: 2, temperatureCp: 125, blunderProb: 0.09 },
  /** Cap on search time per move for weak play (ms). */
  maxMovetimeMs: 400,
  /** Take mate-in-1 when the engine sees it (beginners usually do). */
  alwaysTakeMateIn1: true,
};

export interface WeakParams { depth: number; multipv: number; skill: number; temperatureCp: number; blunderProb: number }

const lerp = (a: number, b: number, t: number) => a + (b - a) * Math.max(0, Math.min(1, t));

export function weakPlayParams(elo: number): WeakParams {
  const t = (elo - ELO_LO) / (SF_ELO_MIN - ELO_LO);
  const { lo, hi } = WEAK;
  return {
    depth: Math.round(lerp(lo.depth, hi.depth, t)),
    multipv: Math.round(lerp(lo.multipv, hi.multipv, t)),
    skill: Math.round(lerp(lo.skill, hi.skill, t)),
    temperatureCp: lerp(lo.temperatureCp, hi.temperatureCp, t),
    blunderProb: lerp(lo.blunderProb, hi.blunderProb, t),
  };
}

export interface SampleLine { pv: string[]; cp: number | null; mate: number | null }

/** Pick a move from multi-PV lines: softmax over centipawn loss, plus an occasional deliberate weaker choice. */
export function sampleHumanMove(lines: SampleLine[], temperatureCp: number, blunderProb: number, rnd: () => number = Math.random): string | null {
  const ls = lines.filter((l) => l && l.pv && l.pv.length);
  if (!ls.length) return null;
  const score = (l: SampleLine) => (l.mate !== null ? (l.mate > 0 ? 10000 - l.mate * 10 : -10000 - l.mate * 10) : (l.cp ?? 0));
  if (WEAK.alwaysTakeMateIn1 && ls[0].mate !== null && ls[0].mate > 0 && ls[0].mate <= 1) return ls[0].pv[0];
  if (ls.length > 1 && rnd() < blunderProb) return ls[ls.length - 1 - Math.floor(rnd() * Math.min(2, ls.length - 1))].pv[0];
  const best = score(ls[0]);
  const ws = ls.map((l) => Math.exp(-Math.min(3000, best - score(l)) / temperatureCp));
  let r = rnd() * ws.reduce((a, b) => a + b, 0);
  for (let i = 0; i < ls.length; i++) { r -= ws[i]; if (r <= 0) return ls[i].pv[0]; }
  return ls[0].pv[0];
}
