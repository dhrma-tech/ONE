// Storage adapter (PLAN section 8). IndexedDB via Dexie for app data; settings in localStorage.
// Python stays pure: TS loads state, passes it to bobby.api, and persists what comes back.
import Dexie, { type Table } from "dexie";
import { py } from "./py";
import type { Achievement, AnalyzedGame, Card, Challenge, Classification, Color, Profile, Puzzle, Result } from "./types";


export interface GameRow {
  id: string; pgn: string; result: Result; mode: "bot" | "local"; playerColor: Color; botRating: number | null;
  date: string; startFen: string; timeControl: string; termination: string | null; analysed: boolean;
  ratingAfter?: number; rdAfter?: number; opening?: { eco: string; name: string } | null;
}
export interface AnalysisRow { gameId: string; game: AnalyzedGame; classification: Classification }
export interface KV<T = unknown> { key: string; value: T }
/** SRS card for a puzzle; puzzles generated from the user's own mistakes are embedded so they export with it. */
export interface PuzzleProgressRow extends Card { id: string; puzzle?: Puzzle }
export interface LessonProgressRow { id: string; [k: string]: unknown }

class BobbyDB extends Dexie {
  profile!: Table<KV<Profile>, string>;
  games!: Table<GameRow, string>;
  analysis!: Table<AnalysisRow, string>;
  weakness!: Table<KV, string>; // key "state": opaque weakness state from Python
  puzzleProgress!: Table<PuzzleProgressRow, string>;
  lessonProgress!: Table<LessonProgressRow, string>;
  challenges!: Table<Challenge, string>;
  achievements!: Table<Achievement, string>;
  current!: Table<KV, string>; // autosave of the game in progress
  cubicle!: Table<KV, string>; // Cubicle video library state (key "state"): saved, done, queue, notes, positions...
  constructor() {
    super("bobby");
    this.version(1).stores({
      profile: "key", games: "id, date, mode, result", analysis: "gameId", weakness: "key",
      puzzleProgress: "id, due", lessonProgress: "id", challenges: "id", achievements: "id", personas: "id", current: "key",
    });
    this.version(2).stores({ coachCache: "key" });
    // v3: the AI coach was removed (rule-based coach only): drop its answer cache and the personas table.
    this.version(3).stores({ coachCache: null, personas: null });
    // v4: Cubicle (video library) state. New table only; existing data is untouched.
    this.version(4).stores({ cubicle: "key" });
  }
}

export const db = new BobbyDB();

export const store = {
  getProfile: async () => (await db.profile.get("me"))?.value ?? null,
  setProfile: (p: Profile) => db.profile.put({ key: "me", value: p }),
  getWeakness: async () => (await db.weakness.get("state"))?.value ?? null,
  setWeakness: (w: unknown) => db.weakness.put({ key: "state", value: w }),
  saveGame: (g: GameRow) => db.games.put(g),
  getGame: (id: string) => db.games.get(id),
  listGames: () => db.games.orderBy("date").reverse().toArray(),
  saveAnalysis: (a: AnalysisRow) => db.analysis.put(a),
  getAnalysis: (id: string) => db.analysis.get(id),
  getCurrent: async <T>() => (await db.current.get("game"))?.value as T | undefined,
  setCurrent: (v: unknown) => db.current.put({ key: "game", value: v }),
  clearCurrent: () => db.current.delete("game"),
};

const LIST_TABLES = ["games", "analysis", "puzzleProgress", "lessonProgress", "challenges", "achievements", "cubicle"] as const;

/** Export everything through Python `export_all`. Shape follows py/bobby/export.py SCHEMA. */
export async function exportAll(): Promise<string> {
  const data: Record<string, unknown> = { profile: await store.getProfile(), weakness: await store.getWeakness(), settings: loadSettings() };
  for (const t of LIST_TABLES) data[t] = await db.table(t).toArray();
  return JSON.stringify(await py.export_all(data));
}

/** Validate through Python `import_all`, then replace local data. Throws on invalid input. */
export async function importAll(json: string): Promise<void> {
  const data = (await py.import_all(JSON.parse(json))) as Record<string, unknown>;
  await db.transaction("rw", [...LIST_TABLES.map((t) => db.table(t)), db.profile, db.weakness], async () => {
    for (const t of LIST_TABLES) {
      await db.table(t).clear();
      const rows = data[t];
      if (Array.isArray(rows) && rows.length) await db.table(t).bulkPut(rows);
    }
    await db.profile.clear(); await db.weakness.clear();
    if (data.profile && typeof data.profile === "object") await store.setProfile(data.profile as Profile);
    if (data.weakness && typeof data.weakness === "object") await store.setWeakness(data.weakness);
  });
  const ls = data.settings;
  if (ls && typeof ls === "object") {
    saveSettings(normalise(ls as Partial<Settings>));
  }
}

export async function resetAll() {
  await db.delete();
  localStorage.removeItem(SETTINGS_KEY);
  location.reload();
}

// ---------- settings (localStorage) ----------
export type Theme = "auto" | "light" | "dark";
export type BoardTheme = "green" | "brown" | "blue" | "gray";
export type PieceSet = "classic" | "glyph" | "letters";
export interface VoicePrefs { rate: number; pitch: number; voiceURI: string }
export interface Settings {
  theme: Theme; boardTheme: BoardTheme; pieceSet: PieceSet; coordinates: boolean; sounds: boolean; legalHighlights: boolean;
  takebacks: boolean; hints: boolean; strengthOffset: number; levelCardDismissed: boolean;
  /** Safety net: ask before a move that hangs a piece or allows mate in one. */
  safetyNet: boolean;
  /** Focus mode: eval, hints and coach are hidden during a game until it ends. Default ON. */
  focusMode: boolean; showEval: boolean;
  voice: { enabled: boolean } & VoicePrefs;
  /** Settings schema revision, used for one-time migrations. */
  rev: number;
}
export const SETTINGS_REV = 3;
export const defaults: Settings = {
  theme: "auto", boardTheme: "green", pieceSet: "classic", coordinates: true, sounds: true, legalHighlights: true,
  takebacks: true, hints: true, strengthOffset: 0, levelCardDismissed: false, safetyNet: true,
  focusMode: true, showEval: true,
  voice: { enabled: false, rate: 1, pitch: 1, voiceURI: "" },
  rev: SETTINGS_REV,
};
const SETTINGS_KEY = "bobby:settings:v1";
function normalise(raw: Partial<Settings>): Settings {
  // Drop settings of the removed AI coach (provider, API key, personas) and the old per-persona voice map.
  const { llm: _llm, persona: _p, customCoach: _c, ...rest } = raw as Partial<Settings> & { llm?: unknown; persona?: unknown; customCoach?: unknown };
  const v = (raw.voice ?? {}) as Partial<Settings["voice"]> & { per?: unknown };
  const { per: _per, ...voice } = v;
  void _llm; void _p; void _c; void _per;
  const s: Settings = { ...defaults, ...rest, voice: { ...defaults.voice, ...voice } };
  s.strengthOffset = Math.max(-200, Math.min(200, Math.round(Number(s.strengthOffset) || 0)));
  // rev < 2: focus mode used to default off; the review asked for it to default ON during games.
  if ((raw.rev ?? 1) < 2) s.focusMode = true;
  s.rev = SETTINGS_REV;
  return s;
}
export function loadSettings(): Settings {
  try { return normalise(JSON.parse(localStorage.getItem(SETTINGS_KEY) || "{}")); } catch { return { ...defaults }; }
}
let current = loadSettings();
const subs = new Set<() => void>();
export function saveSettings(s: Settings) {
  current = s;
  try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(s)); } catch {}
  subs.forEach((f) => f());
}
export const settings = {
  get: () => current,
  set: (p: Partial<Settings>) => saveSettings({ ...current, ...p }),
  subscribe: (cb: () => void) => { subs.add(cb); return () => { subs.delete(cb); }; },
};
