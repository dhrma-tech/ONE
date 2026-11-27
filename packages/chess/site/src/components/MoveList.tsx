import { useEffect, useRef } from "react";
import type { MoveClass } from "../bridge/types";

export const CLASS_GLYPH: Record<MoveClass, string> = { best: "", good: "", inaccuracy: "?!", mistake: "?", blunder: "??" };

export function MoveList({ sans, current, onJump, classes }: { sans: string[]; current: number; onJump?: (ply: number) => void; classes?: (MoveClass | undefined)[] }) {
  const ref = useRef<HTMLOListElement>(null);
  useEffect(() => { ref.current?.querySelector(".mv.on")?.scrollIntoView({ block: "nearest" }); }, [current]);
  const rows: number[] = [];
  for (let i = 0; i < sans.length; i += 2) rows.push(i);
  if (!sans.length) return <p className="muted small">No moves yet.</p>;
  const cell = (i: number) => {
    if (i >= sans.length) return <span />;
    const cls = classes?.[i];
    return (
      <button type="button" className={"mv" + (current === i + 1 ? " on" : "") + (cls ? " c-" + cls : "")} onClick={() => onJump?.(i + 1)} aria-current={current === i + 1 ? "step" : undefined}>
        {sans[i]}{cls ? <sup>{CLASS_GLYPH[cls]}</sup> : null}
      </button>
    );
  };
  return (
    <ol className="moves" ref={ref} aria-label="Moves">
      {rows.map((i) => (
        <li key={i}><span className="mvn">{i / 2 + 1}.</span>{cell(i)}{cell(i + 1)}</li>
      ))}
    </ol>
  );
}
