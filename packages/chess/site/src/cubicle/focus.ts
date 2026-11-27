// Pomodoro for Cubicle focus mode: 25 min study / 5 min break. Study time only counts while a video is
// playing (pausing the video pauses the timer). At the end of a study block a quiet summary is shown inline.
import { useSyncExternalStore } from "react";
import { getCubicle } from "./store";

export interface BlockSummary { videos: number; minutes: number; notes: number }
interface P {
  phase: "work" | "break"; running: boolean; left: number; work: number; brk: number; cycles: number;
  videoPlaying: boolean; summary: BlockSummary | null;
}
let p: P = { phase: "work", running: false, left: 25 * 60, work: 25, brk: 5, cycles: 0, videoPlaying: false, summary: null };
let iv = 0;
let last = 0;
let snap = { done: 0, notes: 0 };
const subs = new Set<() => void>();
const set = (n: Partial<P>) => { p = { ...p, ...n }; subs.forEach((f) => f()); };
const counts = () => {
  const s = getCubicle();
  return { done: Object.keys(s.done).length, notes: Object.values(s.notes).reduce((a, l) => a + l.length, 0) };
};

function tick() {
  const now = Date.now();
  const dt = (now - last) / 1000; last = now;
  // study time advances only while the video plays; break time is real time
  if (p.phase === "work" && !p.videoPlaying) return;
  const left = p.left - dt;
  if (left > 0) { set({ left }); return; }
  if (p.phase === "work") {
    const c = counts();
    set({ phase: "break", left: p.brk * 60, cycles: p.cycles + 1,
      summary: { videos: c.done - snap.done, minutes: p.work, notes: c.notes - snap.notes } });
  } else {
    snap = counts();
    set({ phase: "work", left: p.work * 60 });
  }
}

export const pomo = {
  start: () => {
    if (p.phase === "work" && p.left === p.work * 60) snap = counts();
    last = Date.now(); clearInterval(iv); iv = window.setInterval(tick, 500); set({ running: true });
  },
  pause: () => { clearInterval(iv); set({ running: false }); },
  reset: () => { clearInterval(iv); set({ running: false, phase: "work", left: p.work * 60, summary: null }); },
  dismissSummary: () => set({ summary: null }),
  /** Called by the watch page whenever the embedded video starts or stops playing. */
  setVideoPlaying: (playing: boolean) => { if (playing !== p.videoPlaying) { last = Date.now(); set({ videoPlaying: playing }); } },
};
export const usePomo = () => useSyncExternalStore((cb) => { subs.add(cb); return () => { subs.delete(cb); }; }, () => p);
