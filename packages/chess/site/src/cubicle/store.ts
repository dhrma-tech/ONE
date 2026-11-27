// Cubicle state, kept in Bobby's Dexie database (table "cubicle", key "state") so export/import covers it.
// In memory for instant reads; writes are debounced. Positions are saved quietly (no re-render) while playing.
import { useSyncExternalStore } from "react";
import { db } from "../bridge/storage";

export interface Note { id: string; t: number; text: string; ts: number }
export interface Prefs {
  focus: boolean; speed: number; autoNext: boolean; hideOutdated: boolean; budget: number;
  /** "mid": a frame from inside the video (default); "default": the uploader's thumbnail. */
  thumb: "mid" | "default";
  /** Muted preview when hovering a card (as in Cubicle). */
  preview: boolean;
  view: "grid" | "list";
}
export interface CubicleState {
  saved: string[]; done: Record<string, number>; hidden: string[]; muted: string[]; queue: string[];
  positions: Record<string, number>; speeds: Record<string, number>; notes: Record<string, Note[]>;
  paths: Record<string, number>; // path id -> index of the next video
  current: string | null; // last opened video (for "continue watching")
  watched: Record<string, number>; // seconds of playback per day (YYYY-MM-DD)
  prefs: Prefs;
}

const fresh = (): CubicleState => ({
  saved: [], done: {}, hidden: [], muted: [], queue: [], positions: {}, speeds: {}, notes: {}, paths: {}, current: null,
  watched: {}, prefs: { focus: false, speed: 1, autoNext: true, hideOutdated: false, budget: 30, thumb: "mid", preview: true, view: "grid" },
});

let state: CubicleState = fresh();
let ready = false;
let readyP: Promise<void> | null = null;
const subs = new Set<() => void>();
let timer = 0;

function persist(now = false) {
  clearTimeout(timer);
  const write = () => { db.cubicle.put({ key: "state", value: state }).catch(() => { /* storage unavailable */ }); };
  if (now) write(); else timer = window.setTimeout(write, 400);
}
function commit(next: CubicleState, notify = true) {
  state = next;
  persist();
  if (notify) subs.forEach((f) => f());
}

/** Load once from Dexie. Safe to call many times. */
export function loadCubicleState(): Promise<void> {
  readyP ??= db.cubicle.get("state").then((row) => {
    const v = (row?.value ?? {}) as Partial<CubicleState>;
    const f = fresh();
    state = { ...f, ...v, prefs: { ...f.prefs, ...(v.prefs ?? {}) } };
  }).catch(() => { /* keep defaults */ }).then(() => { ready = true; subs.forEach((f) => f()); });
  return readyP;
}
addEventListener("pagehide", () => persist(true));

export const useCubicle = () => useSyncExternalStore((cb) => { subs.add(cb); return () => { subs.delete(cb); }; }, () => state);
export const getCubicle = () => state;
export const cubicleReady = () => ready;

const toggle = (list: string[], id: string) => (list.includes(id) ? list.filter((x) => x !== id) : [...list, id]);
const uid = () => Math.random().toString(36).slice(2, 9);
const today = () => new Date().toISOString().slice(0, 10);

export const cubicle = {
  toggleSaved: (id: string) => commit({ ...state, saved: toggle(state.saved, id) }),
  toggleDone: (id: string) => {
    const done = { ...state.done };
    if (done[id]) delete done[id]; else done[id] = Date.now();
    commit({ ...state, done, queue: done[id] ? state.queue.filter((q) => q !== id) : state.queue });
  },
  markDone: (id: string) => { if (!state.done[id]) cubicle.toggleDone(id); },
  hide: (id: string) => commit({ ...state, hidden: toggle(state.hidden, id) }),
  muteChannel: (c: string) => commit({ ...state, muted: toggle(state.muted, c) }),
  toggleQueue: (id: string) => commit({ ...state, queue: toggle(state.queue, id) }),
  enqueue: (ids: string[]) => commit({ ...state, queue: [...state.queue, ...ids.filter((i) => !state.queue.includes(i))] }),
  dequeue: (id: string) => commit({ ...state, queue: state.queue.filter((q) => q !== id) }),
  moveQueue: (id: string, dir: -1 | 1) => {
    const q = [...state.queue]; const i = q.indexOf(id); const j = i + dir;
    if (i < 0 || j < 0 || j >= q.length) return;
    [q[i], q[j]] = [q[j], q[i]];
    commit({ ...state, queue: q });
  },
  clearQueue: () => commit({ ...state, queue: [] }),
  setPosition: (id: string, sec: number, dur?: number) => {
    const positions = { ...state.positions };
    if (sec < 15 || (dur && sec > dur - 20)) delete positions[id]; else positions[id] = Math.floor(sec);
    commit({ ...state, positions }, false);
  },
  setSpeed: (id: string, r: number) => commit({ ...state, speeds: { ...state.speeds, [id]: r }, prefs: { ...state.prefs, speed: r } }),
  setCurrent: (id: string) => { if (state.current !== id) commit({ ...state, current: id }, false); },
  addNote: (id: string, t: number, text: string) => {
    const n: Note = { id: uid(), t: Math.max(0, Math.floor(t)), text: text.trim(), ts: Date.now() };
    if (!n.text) return;
    commit({ ...state, notes: { ...state.notes, [id]: [...(state.notes[id] ?? []), n].sort((a, b) => a.t - b.t) } });
  },
  editNote: (id: string, nid: string, text: string) =>
    commit({ ...state, notes: { ...state.notes, [id]: (state.notes[id] ?? []).map((n) => (n.id === nid ? { ...n, text } : n)) } }),
  delNote: (id: string, nid: string) => {
    const list = (state.notes[id] ?? []).filter((n) => n.id !== nid);
    const notes = { ...state.notes };
    if (list.length) notes[id] = list; else delete notes[id];
    commit({ ...state, notes });
  },
  setPathStep: (pid: string, i: number) => commit({ ...state, paths: { ...state.paths, [pid]: i } }),
  addWatched: (sec: number) => {
    const d = today();
    commit({ ...state, watched: { ...state.watched, [d]: (state.watched[d] ?? 0) + sec } }, false);
  },
  setPrefs: (p: Partial<Prefs>) => commit({ ...state, prefs: { ...state.prefs, ...p } }),
};
