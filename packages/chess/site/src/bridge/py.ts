// Main-thread client for the Pyodide worker. `call(fn, ...args)` returns the JSON result of bobby.api.<fn>.
// If the Python core cannot load, or lacks a function, a clearly-labelled TS dev fallback is used (see fallback.ts).
import { useSyncExternalStore } from "react";
import { fallback } from "./fallback";
import type {
  AnalyzedGame, BenchmarkRow, Card, Challenge, Classification, ClassifyInputMove, Color, CoachMode, GameResultInput, GameState, LessonCheck,
  Level, ParsedPgn, PgnMove, Progression, Viz, PlanItem, Profile, Puzzle, StatsSummary, WeaknessState, Achievement,
} from "./types";

export type BridgeMode = "idle" | "loading" | "python" | "fallback";
export interface BridgeStatus { mode: BridgeMode; fns: string[]; error?: string; fallbackUsed: string[] }

export class PyError extends Error { constructor(msg: string, public kind: string) { super(msg); } }

let status: BridgeStatus = { mode: "idle", fns: [], fallbackUsed: [] };
const subs = new Set<() => void>();
const setStatus = (s: Partial<BridgeStatus>) => { status = { ...status, ...s }; subs.forEach((f) => f()); };
export const bridgeStatus = () => status;
export const useBridgeStatus = () => useSyncExternalStore((cb) => { subs.add(cb); return () => { subs.delete(cb); }; }, () => status);

let worker: Worker | null = null;
let seq = 0;
const pending = new Map<number, { res: (v: unknown) => void; rej: (e: Error) => void }>();
let initP: Promise<void> | null = null;

function post(fn: string, args: unknown[] = [], extra: Record<string, unknown> = {}): Promise<unknown> {
  const id = ++seq;
  return new Promise((res, rej) => { pending.set(id, { res, rej }); worker!.postMessage({ id, fn, args, ...extra }); });
}

/** Start loading Pyodide in the background. Safe to call many times. */
export function initPython(): Promise<void> {
  if (initP) return initP;
  setStatus({ mode: "loading" });
  initP = (async () => {
    try {
      worker = new Worker(new URL("./py.worker.ts", import.meta.url), { type: "module" });
      worker.onmessage = (e: MessageEvent) => {
        const m = e.data as { id: number; ok: boolean; value?: unknown; error?: string; kind?: string };
        const p = pending.get(m.id); if (!p) return; pending.delete(m.id);
        if (m.ok) p.res(m.value); else p.rej(new PyError(m.error ?? "python error", m.kind ?? "Error"));
      };
      worker.onerror = (e) => { console.error("[bobby/py] worker error", e.message); };
      const root = new URL("./", document.baseURI).href;
      const info = (await post("__init__", [], { root })) as { hasApi: boolean; fns: string[] };
      setStatus({ mode: info.hasApi ? "python" : "fallback", fns: info.fns, error: info.hasApi ? undefined : "bobby.api not importable" });
    } catch (e) {
      console.warn("[bobby/py] Pyodide failed to load, using dev fallback:", e);
      setStatus({ mode: "fallback", error: String((e as Error).message ?? e) });
    }
  })();
  return initP;
}

/** Call bobby.api.<fn>(...args). Arguments and results must be JSON-serialisable. */
export async function call<T = unknown>(fn: string, ...args: unknown[]): Promise<T> {
  await initPython();
  if (status.mode === "python" && status.fns.includes(fn)) return (await post(fn, args)) as T;
  const fb = fallback[fn] as ((...a: unknown[]) => unknown) | undefined;
  if (fb) {
    if (!status.fallbackUsed.includes(fn)) { console.warn(`[bobby/py] DEV FALLBACK for ${fn} (Python core not available)`); setStatus({ fallbackUsed: [...status.fallbackUsed, fn] }); }
    try { return fb(...args) as T; } catch (e) { throw new PyError(String((e as Error).message), "ValueError"); }
  }
  throw new PyError(`bobby.api.${fn} is not available yet`, "missing");
}

// ---------- typed wrappers, one per contract function ----------
export const py = {
  // rules
  new_game: (fen: string | null = null) => call<GameState>("new_game", fen),
  apply_move: (fen: string, uci: string) => call<GameState>("apply_move", fen, uci),
  legal_moves: (fen: string) => call<string[]>("legal_moves", fen),
  parse_pgn: (pgn: string) => call<ParsedPgn>("parse_pgn", pgn),
  to_pgn: (headers: Record<string, string>, moves: PgnMove[] | { uci: string }[]) => call<string>("to_pgn", headers, moves),
  // analysis
  classify_moves: (moves: ClassifyInputMove[], player_color: Color | null) => call<Classification>("classify_moves", moves, player_color),
  winprob: (cp: number | null, mate: number | null) => call<number>("winprob", cp, mate),
  // player model
  new_profile: (level: Level, known_rating: number | null, today: string) => call<Profile>("new_profile", level, known_rating, today),
  update_rating: (profile: Profile, game_result: GameResultInput) => call<Profile>("update_rating", profile, game_result),
  bot_target_rating: (profile: Profile, offset: number) => call<number>("bot_target_rating", profile, offset),
  update_weakness: (weakness: WeaknessState, analyzed_game: AnalyzedGame) => call<WeaknessState>("update_weakness", weakness, analyzed_game),
  benchmarks_compare: (profile: Profile, game_stats: unknown, benchmarks: unknown) => call<BenchmarkRow[]>("benchmarks_compare", profile, game_stats, benchmarks),
  // training
  puzzles_from_mistakes: (analyzed_game: AnalyzedGame) => call<Puzzle[]>("puzzles_from_mistakes", analyzed_game),
  select_puzzles: (puzzles: Puzzle[], profile: Profile, theme: string | null = null, n = 10) => call<Puzzle[]>("select_puzzles", puzzles, profile, theme, n),
  srs_new_card: (item_id: string, today: string) => call<Card>("srs_new_card", item_id, today),
  srs_review: (card: Card, grade: 0 | 1 | 2 | 3, today: string) => call<Card>("srs_review", card, grade, today),
  due_cards: (cards: Card[], today: string) => call<Card[]>("due_cards", cards, today),
  daily_plan: (profile: Profile, weakness: WeaknessState, cards: Card[], today: string) => call<{ items: PlanItem[] }>("daily_plan", profile, weakness, cards, today),
  generate_challenges: (weakness: WeaknessState, profile: Profile, today: string, progression: Progression | null = null) => call<Challenge[]>("generate_challenges", weakness, profile, today, progression),
  daily_progression: (profile: Profile, games: AnalyzedGame[], prev: Progression | null, yesterday: Challenge[], today: string) => call<Progression>("daily_progression", profile, games, prev, yesterday, today),
  progress_report: (games: AnalyzedGame[], weakness: WeaknessState, progression: Progression | null) => call<Record<string, unknown>>("progress_report", games, weakness, progression),
  update_challenges: (challenges: Challenge[], analyzed_game: AnalyzedGame) => call<Challenge[]>("update_challenges", challenges, analyzed_game),
  check_achievements: (profile: Profile, stats: unknown, achievements: Achievement[]) => call<Achievement[]>("check_achievements", profile, stats, achievements),
  lesson_check: (lesson: unknown, step_index: number, answer: string) => call<LessonCheck>("lesson_check", lesson, step_index, answer),
  // stats & data
  stats_summary: (games: unknown[], analyses: unknown[]) => call<StatsSummary>("stats_summary", games, analyses),
  export_all: (data: unknown) => call<{ version: number; data: unknown }>("export_all", data),
  import_all: (blob: unknown) => call<Record<string, unknown[]>>("import_all", blob),
  // coach
  template_explanation: (facts: Record<string, unknown>, mode: CoachMode) => call<string>("template_explanation", facts, mode),
  explain_move: (move: Record<string, unknown>, reply_pv: string[]) => call<{ text: string; viz: Viz; tags: string[] }>("explain_move", move, reply_pv),
  explain_position: (fen: string, question: string, lines: { pv: string[]; cp: number | null; mate: number | null }[]) => call<{ text: string; viz: Viz; tags: string[] }>("explain_position", fen, question, lines),
};
