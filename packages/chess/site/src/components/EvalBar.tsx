import type { Eval } from "../bridge/types";
import { winprob } from "../bridge/fallback";

export const fmtEval = (e: Eval | null | undefined) => {
  if (!e) return "…";
  if (e.mate !== null && e.mate !== undefined) return (e.mate > 0 ? "#" : "#-") + Math.abs(e.mate);
  const v = (e.cp ?? 0) / 100;
  return (v > 0 ? "+" : "") + v.toFixed(1);
};

/** Vertical eval bar, white at the bottom (flips with orientation). Display-only winprob for bar height. */
export function EvalBar({ ev, orientation }: { ev: Eval | null; orientation: "white" | "black" }) {
  const w = ev ? winprob(ev.cp, ev.mate) : 0.5;
  const pct = Math.round(w * 1000) / 10;
  return (
    <div className={"evalbar" + (orientation === "black" ? " flip" : "")} role="meter" aria-label="Evaluation" aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct} aria-valuetext={fmtEval(ev)}>
      <div className="evalbar-w" style={{ height: pct + "%" }} />
      <span className={"evalbar-n" + (w >= 0.5 ? " lo" : " hi")}>{fmtEval(ev)}</span>
    </div>
  );
}
