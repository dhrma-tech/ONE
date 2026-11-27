// Shipped JSON data (copied from ../data into public/data by scripts/prepare-assets.mjs), fetched lazily and memoised.
import type { Puzzle } from "../bridge/types";
import SAMPLE_BENCHMARKS from "../data/benchmarks.sample.json";

export interface LessonStep {
  type: "info" | "move" | "square" | "quiz"; fen: string; prompt: string; correct: string[]; options: string[] | null; explanation: string; hint: string;
}
export interface Lesson { id: string; title: string; section: string; order: number; steps: LessonStep[] }
export interface LessonMeta { id: string; title: string; section: string; order: number; steps: number }
export interface Opening { eco: string; name: string; pgn: string; epd: string }
export interface Endgame { id: string; name: string; fen: string; goal: "win" | "draw"; dtz: number | null; hint: string }
export interface KnowledgeCard { id: string; tags: string[]; title: string; text: string }
export type Benchmarks = Record<string, unknown>;

const base = () => new URL("data/", document.baseURI).href;
const memo = new Map<string, Promise<unknown>>();
function get<T>(path: string): Promise<T> {
  let p = memo.get(path) as Promise<T> | undefined;
  if (!p) {
    p = fetch(base() + path).then((r) => { if (!r.ok) throw new Error(`${path}: HTTP ${r.status}`); return r.json() as Promise<T>; });
    p.catch(() => memo.delete(path));
    memo.set(path, p);
  }
  return p;
}

export const data = {
  lessonIndex: () => get<LessonMeta[]>("lessons/index.json"),
  lesson: (id: string) => get<Lesson>(`lessons/${encodeURIComponent(id)}.json`),
  puzzles: () => get<Puzzle[]>("puzzles.json"),
  openings: () => get<Opening[]>("openings.json"),
  endgames: () => get<Endgame[]>("endgames.json"),
  cards: () => get<KnowledgeCard[]>("knowledge_cards.json"),
  /** Real benchmarks.json when the data pipeline has produced it, else the bundled sample. */
  benchmarks: async (): Promise<{ bands: Benchmarks; sample: boolean }> => {
    try {
      const b = await get<Record<string, unknown>>("benchmarks.json");
      return { bands: unwrap(b), sample: false };
    } catch {
      return { bands: unwrap(SAMPLE_BENCHMARKS as Record<string, unknown>), sample: true };
    }
  },
};

/** benchmarks.json may be `{band:{...}}` or `{"600-800":{...}}`; Python wants band keys at the top. */
function unwrap(b: Record<string, unknown>): Benchmarks {
  const inner = b.band ?? b.bands;
  return (inner && typeof inner === "object" ? inner : b) as Benchmarks;
}

/** Lesson sections in course order (by their first lesson). */
export function sections(index: LessonMeta[]): { name: string; lessons: LessonMeta[] }[] {
  const m = new Map<string, LessonMeta[]>();
  for (const l of [...index].sort((a, b) => a.order - b.order)) m.set(l.section, [...(m.get(l.section) ?? []), l]);
  return [...m.entries()].map(([name, lessons]) => ({ name, lessons }));
}

/** Weakness tag (Python) -> lesson id. */
export const TAG_LESSON: Record<string, string> = {
  fork: "fork", pin: "pin", skewer: "skewer", discovered: "discovered-attack", back_rank: "back-rank-mate",
  hanging_piece: "hanging-pieces", missed_capture: "counting-exchanges", missed_mate: "mate-in-one-drill",
  mate_threat: "scholars-mate-defend", removing_defender: "removing-defender", passed_pawn: "pawn-structure",
  king_activity: "king-activity", opposition: "opposition", smothered_mate: "smothered-mate",
  endgame_k_p: "endgame-king-and-pawn", endgame_rook: "endgame-rook-bridge", double_check: "double-check",
};
export const lessonForTag = (t: string) => TAG_LESSON[t] ?? (t.startsWith("opening_") ? "opening-develop" : null);

/** Weakness/knowledge tag -> Lichess puzzle theme. */
export const TAG_THEME: Record<string, string> = {
  fork: "fork", pin: "pin", skewer: "skewer", discovered: "discoveredAttack", back_rank: "backRankMate", hanging_piece: "hangingPiece",
  double_check: "doubleCheck", deflection: "deflection", decoy: "attraction", x_ray: "xRayAttack", zwischenzug: "intermezzo",
  trapped_piece: "trappedPiece", removing_defender: "capturingDefender", zugzwang: "zugzwang", endgame_k_p: "pawnEndgame",
  endgame_rook: "rookEndgame", mate_pattern: "mate", mate_threat: "mate", missed_mate: "mate", passed_pawn: "advancedPawn",
};
