// MIND logic: SM-2 spaced repetition, daily card selection (max 5 new), cube scrambles + averages,
// mental math drills, stuck ladder lookup. Pure and tested.
import { addDays, type ISODate } from "@/lib/dates";

export interface Sm2Card {
  ef: number;
  interval_days: number;
  reps: number;
  lapses: number;
  due_at?: ISODate | null;
  is_new: boolean;
}

/**
 * SM-2 (SuperMemo 2). grade 0-5; < 3 = lapse (reset to 1 day). EF floor 1.3.
 * UI buttons map to: Again = 1, Hard = 3, Good = 4, Easy = 5.
 */
export function sm2(card: Sm2Card, grade: number, on: ISODate): Sm2Card {
  const q = Math.max(0, Math.min(5, Math.round(grade)));
  let { ef, interval_days, reps, lapses } = card;
  if (q < 3) {
    reps = 0;
    interval_days = 1;
    lapses += 1;
  } else {
    reps += 1;
    interval_days = reps === 1 ? 1 : reps === 2 ? 6 : Math.round(interval_days * ef);
  }
  ef = Math.max(1.3, Math.round((ef + (0.1 - (5 - q) * (0.08 + (5 - q) * 0.02))) * 100) / 100);
  return { ef, interval_days, reps, lapses, due_at: addDays(on, interval_days), is_new: false };
}

/** Today's session: all due reviews (oldest first), plus up to `maxNew` new cards minus new ones already started today. */
export function todaysCards<T extends Sm2Card & { id: string; created_at?: string }>(cards: T[], today: ISODate, maxNew: number, newDoneToday: number): T[] {
  const due = cards.filter((c) => !c.is_new && c.due_at && c.due_at <= today).sort((a, b) => (a.due_at! < b.due_at! ? -1 : 1));
  const fresh = cards
    .filter((c) => c.is_new)
    .sort((a, b) => ((a.created_at ?? "") < (b.created_at ?? "") ? -1 : 1))
    .slice(0, Math.max(0, maxNew - newDoneToday));
  return [...due, ...fresh];
}

// ---------- Cube ----------
const FACES = ["U", "D", "L", "R", "F", "B"];
const AXIS: Record<string, number> = { U: 0, D: 0, L: 1, R: 1, F: 2, B: 2 };
const SUFFIX = ["", "'", "2"];

/** WCA-style random-move 3x3 scramble: no repeated face, no same-axis triple. */
export function scramble(len = 20, rnd: () => number = Math.random): string {
  const out: string[] = [];
  while (out.length < len) {
    const f = FACES[Math.floor(rnd() * 6)];
    const last = out.at(-1)?.[0];
    const prev = out.at(-2)?.[0];
    if (f === last) continue;
    if (last && prev && AXIS[f] === AXIS[last] && AXIS[f] === AXIS[prev]) continue;
    out.push(f + SUFFIX[Math.floor(rnd() * 3)]);
  }
  return out.join(" ");
}

/** WCA average of 5: drop best and worst; DNF counts as worst; 2+ DNFs = DNF (null). */
export function ao5(times: (number | null)[]): number | null {
  if (times.length < 5) return null;
  const last = times.slice(-5);
  const dnf = last.filter((t) => t === null).length;
  if (dnf >= 2) return null;
  const sorted = last.map((t) => (t === null ? Infinity : t)).sort((a, b) => a - b);
  const mid = sorted.slice(1, 4);
  return Math.round(mid.reduce((a, b) => a + b, 0) / 3);
}

export const fmtMs = (ms: number | null): string => {
  if (ms === null || !Number.isFinite(ms)) return "DNF";
  const s = ms / 1000;
  return s >= 60 ? `${Math.floor(s / 60)}:${(s % 60).toFixed(2).padStart(5, "0")}` : s.toFixed(2);
};

// ---------- Mental math ----------
export type DrillKind = "tables" | "squares" | "2x1" | "2x2";
export interface Problem {
  a: number;
  b: number;
  op: "×" | "²";
  answer: number;
}

export function makeProblem(kind: DrillKind, rnd: () => number = Math.random): Problem {
  const r = (lo: number, hi: number) => lo + Math.floor(rnd() * (hi - lo + 1));
  switch (kind) {
    case "tables": {
      const a = r(2, 20);
      const b = r(2, 10);
      return { a, b, op: "×", answer: a * b };
    }
    case "squares": {
      const a = r(2, 30);
      return { a, b: 2, op: "²", answer: a * a };
    }
    case "2x1": {
      const a = r(11, 99);
      const b = r(2, 9);
      return { a, b, op: "×", answer: a * b };
    }
    case "2x2": {
      const a = r(11, 99);
      const b = r(11, 99);
      return { a, b, op: "×", answer: a * b };
    }
  }
}

// ---------- Stuck ladder ----------
/** Target for the week containing `weekStart` (latest ladder row on or before it). */
export function ladderTarget(rows: { week_start: ISODate; target_min: number }[], weekStart: ISODate): number | null {
  return [...rows].filter((r) => r.week_start <= weekStart).sort((a, b) => (a.week_start < b.week_start ? 1 : -1))[0]?.target_min ?? null;
}

export const MEDITATION_PRESETS = [5, 10, 20];
/** Breathing rhythm (seconds): in, hold, out. Calm 4-4-6. */
export const BREATH = { in: 4, hold: 4, out: 6 };
