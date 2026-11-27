import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { AREAS } from "@/lib/sections";
import { ui } from "@/data/ui";
import { inScope } from "@/scope";

const isTyping = (t: EventTarget | null) => {
  const el = t as HTMLElement | null;
  if (!el) return false;
  const tag = el.tagName;
  return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || el.isContentEditable;
};

export interface KeyHandlers {
  onFocus?: () => void;
}

/** Global shortcuts: Ctrl/⌘+K palette, g h/c/m/b/p/s navigation, d theme, f focus, n note, ? help. */
export function useGlobalKeys(h: KeyHandlers = {}) {
  const nav = useNavigate();
  useEffect(() => {
    let gAt = 0;
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        ui.set({ paletteOpen: !ui.get().paletteOpen });
        return;
      }
      if (e.ctrlKey || e.metaKey || e.altKey || isTyping(e.target)) return;
      if (ui.get().paletteOpen) return;
      const k = e.key;
      if (Date.now() - gAt < 1200) {
        gAt = 0;
        const a = AREAS.find((x) => x.key === k.toLowerCase());
        if (a) {
          e.preventDefault();
          if (inScope(a.path)) nav(a.path);
          else window.open(a.path, "_blank");
        }
        return;
      }
      if (k === "g") gAt = Date.now();
      else if (k === "d") ui.toggleTheme();
      else if (k === "?") ui.set({ helpOpen: true });
      else if (k === "f") h.onFocus?.();
      else if (k === "n") ui.set({ noteRequest: ui.get().noteRequest + 1 });
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [nav, h]);
}
