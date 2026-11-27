// Tiny dependency-free SVG charts for the Stats page. Single series each, accent colour, muted axes.
import { useState } from "react";

export interface Pt { x: string; y: number; label?: string }

const W = 560, H = 180, PAD = { l: 40, r: 12, t: 12, b: 24 };

function ticks(min: number, max: number, n = 4) {
  if (min === max) { min -= 1; max += 1; }
  const step = (max - min) / n;
  return Array.from({ length: n + 1 }, (_, i) => min + i * step);
}
const fmt = (v: number) => (Math.abs(v) >= 100 ? Math.round(v).toString() : (Math.round(v * 10) / 10).toString());

export function LineChart({ points, title, unit = "", yMin, yMax, testId }: { points: Pt[]; title: string; unit?: string; yMin?: number; yMax?: number; testId?: string }) {
  const [hover, setHover] = useState<number | null>(null);
  if (!points.length) return <EmptyChart title={title} />;
  const ys = points.map((p) => p.y);
  const lo = yMin ?? Math.floor(Math.min(...ys) - (Math.max(...ys) - Math.min(...ys)) * 0.1 - 1);
  const hi = yMax ?? Math.ceil(Math.max(...ys) + (Math.max(...ys) - Math.min(...ys)) * 0.1 + 1);
  const iw = W - PAD.l - PAD.r, ih = H - PAD.t - PAD.b;
  const X = (i: number) => PAD.l + (points.length === 1 ? iw / 2 : (i / (points.length - 1)) * iw);
  const Y = (v: number) => PAD.t + ih - ((v - lo) / (hi - lo || 1)) * ih;
  const d = points.map((p, i) => `${i ? "L" : "M"}${X(i).toFixed(1)},${Y(p.y).toFixed(1)}`).join(" ");
  const h = hover !== null ? points[hover] : null;
  return (
    <figure className="chart" data-testid={testId}>
      <figcaption>{title}{h ? <span className="muted"> · {h.label ?? h.x}: <strong>{fmt(h.y)}{unit}</strong></span> : <span className="muted"> · latest <strong>{fmt(points[points.length - 1].y)}{unit}</strong></span>}</figcaption>
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`${title}: ${points.length} points, latest ${fmt(points[points.length - 1].y)}${unit}`} onMouseLeave={() => setHover(null)}>
        {ticks(lo, hi).map((t) => (
          <g key={t}><line className="ch-grid" x1={PAD.l} x2={W - PAD.r} y1={Y(t)} y2={Y(t)} /><text className="ch-ax" x={PAD.l - 6} y={Y(t) + 4} textAnchor="end">{fmt(t)}</text></g>
        ))}
        <path className="ch-line" d={d} />
        {points.map((p, i) => (
          <circle key={i} className={"ch-dot" + (hover === i ? " on" : "")} cx={X(i)} cy={Y(p.y)} r={hover === i ? 5 : 3} onMouseEnter={() => setHover(i)}><title>{`${p.label ?? p.x}: ${fmt(p.y)}${unit}`}</title></circle>
        ))}
        <text className="ch-ax" x={PAD.l} y={H - 6}>{points[0].x}</text>
        {points.length > 1 ? <text className="ch-ax" x={W - PAD.r} y={H - 6} textAnchor="end">{points[points.length - 1].x}</text> : null}
      </svg>
    </figure>
  );
}

export function BarChart({ points, title, unit = "", testId }: { points: Pt[]; title: string; unit?: string; testId?: string }) {
  if (!points.length) return <EmptyChart title={title} />;
  const hi = Math.max(1, ...points.map((p) => p.y));
  const iw = W - PAD.l - PAD.r, ih = H - PAD.t - PAD.b;
  const bw = Math.min(36, (iw / points.length) * 0.7);
  const X = (i: number) => PAD.l + (i + 0.5) * (iw / points.length);
  const Y = (v: number) => PAD.t + ih - (v / hi) * ih;
  return (
    <figure className="chart" data-testid={testId}>
      <figcaption>{title}</figcaption>
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`${title}: ${points.map((p) => `${p.label ?? p.x} ${fmt(p.y)}${unit}`).join(", ")}`}>
        {ticks(0, hi, 3).map((t) => (<g key={t}><line className="ch-grid" x1={PAD.l} x2={W - PAD.r} y1={Y(t)} y2={Y(t)} /><text className="ch-ax" x={PAD.l - 6} y={Y(t) + 4} textAnchor="end">{fmt(t)}</text></g>))}
        {points.map((p, i) => (
          <g key={i}>
            <rect className="ch-bar" x={X(i) - bw / 2} y={Y(p.y)} width={bw} height={Math.max(0, PAD.t + ih - Y(p.y))} rx={3}><title>{`${p.label ?? p.x}: ${fmt(p.y)}${unit}`}</title></rect>
            {points.length <= 12 ? <text className="ch-ax" x={X(i)} y={H - 6} textAnchor="middle">{p.x}</text> : null}
          </g>
        ))}
      </svg>
    </figure>
  );
}

/** Rows x columns grid, cell shade by value relative to the max. */
export function Heatmap({ rows, cols, value, title, rowLabel = (r) => r }: { rows: string[]; cols: string[]; value: (r: string, c: string) => number; title: string; rowLabel?: (r: string) => string }) {
  if (!rows.length) return <EmptyChart title={title} />;
  const max = Math.max(1, ...rows.flatMap((r) => cols.map((c) => value(r, c))));
  return (
    <figure className="chart">
      <figcaption>{title}</figcaption>
      <table className="heat">
        <thead><tr><th scope="col">Tag</th>{cols.map((c) => <th key={c} scope="col">{c}</th>)}</tr></thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r}><th scope="row">{rowLabel(r)}</th>
              {cols.map((c) => { const v = value(r, c); return <td key={c} style={{ background: `color-mix(in srgb, var(--c-mistake) ${Math.round((v / max) * 85)}%, transparent)` }}>{v || ""}</td>; })}
            </tr>
          ))}
        </tbody>
      </table>
    </figure>
  );
}

export function EmptyChart({ title }: { title: string }) {
  return <figure className="chart empty-chart"><figcaption>{title}</figcaption><p className="muted small">No data yet. Play a game against Bobby.</p></figure>;
}
