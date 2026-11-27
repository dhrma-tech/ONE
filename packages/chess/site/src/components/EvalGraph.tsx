import type { Eval, MoveClass } from "../bridge/types";
import { winprob } from "../bridge/fallback";

/** Win-probability graph across plies (white view). Click a point to jump. */
export function EvalGraph({ evals, classes, current, onJump }: { evals: Eval[]; classes: (MoveClass | undefined)[]; current: number; onJump: (ply: number) => void }) {
  const W = 600, H = 120;
  if (evals.length < 2) return null;
  const n = evals.length - 1;
  const x = (i: number) => (i / n) * W;
  const y = (e: Eval) => H - winprob(e.cp, e.mate) * H;
  const pts = evals.map((e, i) => `${x(i).toFixed(1)},${y(e).toFixed(1)}`).join(" ");
  return (
    <svg className="graph" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" role="img" aria-label="Evaluation graph"
      onClick={(ev) => { const r = (ev.currentTarget as SVGSVGElement).getBoundingClientRect(); onJump(Math.round(((ev.clientX - r.left) / r.width) * n)); }}>
      <polygon className="graph-w" points={`0,${H} ${pts} ${W},${H}`} />
      <line x1="0" x2={W} y1={H / 2} y2={H / 2} className="graph-mid" />
      {classes.map((c, i) => (c === "blunder" || c === "mistake" ? <circle key={i} cx={x(i + 1)} cy={y(evals[i + 1])} r="4" className={"graph-dot c-" + c} /> : null))}
      <line x1={x(current)} x2={x(current)} y1="0" y2={H} className="graph-cur" />
    </svg>
  );
}
