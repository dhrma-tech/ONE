// Draggable widths for the arena's side columns (game panel on the left, Ask Bobby on the right).
// Widths are CSS variables on the arena (--panel-w, --coach-w), remembered per browser in localStorage.
import { useCallback, useEffect, useRef, useState, type CSSProperties, type KeyboardEvent, type PointerEvent } from "react";

const KEY = "bobby.sideWidths";
const DEF = { panel: 290, coach: 360 };
const MIN = { panel: 220, coach: 280 };
const MAX = { panel: 520, coach: 640 };
const BOARD_MIN = 380; // never squeeze the board below this
type Side = keyof typeof DEF;

function load(): typeof DEF {
  try { const v = JSON.parse(localStorage.getItem(KEY) ?? "null"); if (v && typeof v.panel === "number" && typeof v.coach === "number") return v; } catch { /* storage unavailable */ }
  return { ...DEF };
}

export function useSideWidths() {
  const [w, setW] = useState(load);
  const drag = useRef<{ side: Side; x: number; start: number } | null>(null);

  const clamp = useCallback((side: Side, v: number, cur: typeof DEF) => {
    const other = side === "panel" ? cur.coach : cur.panel;
    const room = innerWidth - other - BOARD_MIN - 120; // page gutters + column gaps
    return Math.round(Math.max(MIN[side], Math.min(MAX[side], room, v)));
  }, []);
  const set = useCallback((side: Side, v: number) => setW((cur) => ({ ...cur, [side]: clamp(side, v, cur) })), [clamp]);

  useEffect(() => { try { localStorage.setItem(KEY, JSON.stringify(w)); } catch { /* storage unavailable */ } }, [w]);

  const handle = (side: Side) => ({
    role: "separator" as const, tabIndex: 0, "aria-orientation": "vertical" as const,
    "aria-label": side === "panel" ? "Resize game panel" : "Resize Ask Bobby",
    "aria-valuemin": MIN[side], "aria-valuemax": MAX[side], "aria-valuenow": w[side],
    title: "Drag to resize · double-click to reset",
    className: "resizer resizer-" + side,
    onPointerDown: (e: PointerEvent<HTMLDivElement>) => {
      e.preventDefault(); e.currentTarget.setPointerCapture(e.pointerId);
      drag.current = { side, x: e.clientX, start: w[side] };
      document.body.classList.add("resizing");
    },
    onPointerMove: (e: PointerEvent<HTMLDivElement>) => {
      const d = drag.current; if (!d) return;
      const dx = e.clientX - d.x;
      set(d.side, d.side === "panel" ? d.start + dx : d.start - dx);
    },
    onPointerUp: () => { drag.current = null; document.body.classList.remove("resizing"); },
    onPointerCancel: () => { drag.current = null; document.body.classList.remove("resizing"); },
    onDoubleClick: () => set(side, DEF[side]),
    onKeyDown: (e: KeyboardEvent<HTMLDivElement>) => {
      const step = e.shiftKey ? 48 : 16;
      const grow = side === "panel" ? "ArrowRight" : "ArrowLeft", shrink = side === "panel" ? "ArrowLeft" : "ArrowRight";
      if (e.key === grow) { e.preventDefault(); set(side, w[side] + step); }
      else if (e.key === shrink) { e.preventDefault(); set(side, w[side] - step); }
      else if (e.key === "Home") { e.preventDefault(); set(side, DEF[side]); }
    },
  });

  const style = { "--panel-w": `${w.panel}px`, "--coach-w": `${w.coach}px` } as CSSProperties;
  return { style, handle };
}
