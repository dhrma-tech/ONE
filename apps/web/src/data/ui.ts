// Tiny UI store (no persistence beyond localStorage mirrors). Data lives in Dexie; this is view state.
import { useSyncExternalStore } from "react";

export type Theme = "dark" | "light";
export type Motion = "full" | "reduced" | "system";

interface UIState {
  theme: Theme;
  motion: Motion;
  paletteOpen: boolean;
  helpOpen: boolean;
  musicOpen: boolean;
  noteRequest: number; // bumps when "n" is pressed
}

const ls = {
  get: (k: string) => {
    try {
      return localStorage.getItem(k);
    } catch {
      return null;
    }
  },
  set: (k: string, v: string) => {
    try {
      localStorage.setItem(k, v);
    } catch {
      /* storage unavailable */
    }
  },
};

let state: UIState = {
  theme: ls.get("one.theme") === "light" ? "light" : "dark",
  motion: (ls.get("one.motion") as Motion) || "system",
  paletteOpen: false,
  helpOpen: false,
  musicOpen: false,
  noteRequest: 0,
};
const subs = new Set<() => void>();
const emit = () => subs.forEach((f) => f());

function applyMotion(m: Motion) {
  const reduce = m === "reduced" || (m === "system" && window.matchMedia("(prefers-reduced-motion: reduce)").matches);
  document.documentElement.dataset.motion = reduce ? "reduced" : "full";
}

export const ui = {
  get: () => state,
  set(p: Partial<UIState>) {
    state = { ...state, ...p };
    emit();
  },
  setTheme(theme: Theme) {
    state = { ...state, theme };
    document.documentElement.dataset.theme = theme;
    document.querySelector('meta[name="theme-color"]')?.setAttribute("content", theme === "dark" ? "#000000" : "#f8f0fa");
    ls.set("one.theme", theme);
    emit();
  },
  toggleTheme() {
    ui.setTheme(state.theme === "dark" ? "light" : "dark");
  },
  setMotion(motion: Motion) {
    state = { ...state, motion };
    ls.set("one.motion", motion);
    applyMotion(motion);
    emit();
  },
};

export function useUI(): UIState {
  return useSyncExternalStore(
    (cb) => {
      subs.add(cb);
      return () => subs.delete(cb);
    },
    () => state,
  );
}
