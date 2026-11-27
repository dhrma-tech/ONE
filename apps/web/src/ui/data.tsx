import { useMemo, useState, type CSSProperties, type ReactNode } from "react";
import { useCountUp, useSeen } from "./hooks";
import { addDays, dow, monthName, pretty, today, type ISODate } from "@/lib/dates";

/** Big number with count-up when it enters the view. */
export function StatCard({
  label,
  value,
  unit,
  decimals = 0,
  delta,
  hint,
  icon,
}: {
  label: string;
  value: number | null | undefined;
  unit?: string;
  decimals?: number;
  delta?: { value: number; unit?: string; goodWhen?: "up" | "down" };
  hint?: ReactNode;
  icon?: ReactNode;
}) {
  const [ref, seen] = useSeen<HTMLDivElement>();
  const target = value ?? 0;
  const v = useCountUp(target, seen);
  const shown = value === null || value === undefined ? "—" : v.toFixed(decimals);
  const good = delta ? (delta.goodWhen ?? "up") === (delta.value >= 0 ? "up" : "down") : false;
  return (
    <div ref={ref} className="stat" aria-label={`${label}: ${value ?? "no data"}${unit ? ` ${unit}` : ""}`}>
      <span className="micro row">
        {icon}
        {label}
      </span>
      <span className="value" aria-hidden>
        {shown}
        {unit && value !== null && value !== undefined ? <span className="unit">{unit}</span> : null}
      </span>
      {delta && delta.value !== 0 ? (
        <span className={`delta ${good ? "up" : "down"}`}>
          {delta.value > 0 ? "+" : ""}
          {delta.value.toFixed(decimals)}
          {delta.unit ?? ""}
        </span>
      ) : null}
      {hint ? <span className="xs muted">{hint}</span> : null}
    </div>
  );
}

/** Circular progress (0..1). */
export function ProgressRing({
  value,
  size = 48,
  stroke = 4,
  label,
  color,
  children,
}: {
  value: number;
  size?: number;
  stroke?: number;
  label: string;
  color?: string;
  children?: ReactNode;
}) {
  const [ref, seen] = useSeen<HTMLDivElement>();
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const p = Math.max(0, Math.min(1, value || 0));
  return (
    <div
      ref={ref}
      className="ring"
      role="img"
      aria-label={`${label}: ${Math.round(p * 100)}%`}
      style={{ width: size, height: size, ...(color ? ({ "--ring-color": color } as CSSProperties) : {}) }}
    >
      <svg width={size} height={size} aria-hidden>
        <circle className="track" cx={size / 2} cy={size / 2} r={r} fill="none" strokeWidth={stroke} />
        <circle
          className="bar"
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={seen ? c * (1 - p) : c}
        />
      </svg>
      <span className="label" aria-hidden>
        {children ?? `${Math.round(p * 100)}`}
      </span>
    </div>
  );
}

export function ProgressBar({ value, label, color }: { value: number; label: string; color?: string }) {
  const [ref, seen] = useSeen<HTMLDivElement>();
  const p = Math.max(0, Math.min(1, value || 0));
  return (
    <div
      ref={ref}
      className="bar-track"
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(p * 100)}
      style={color ? ({ "--bar-color": color } as CSSProperties) : undefined}
    >
      <div className="bar-fill" style={{ transform: `scaleX(${seen ? p : 0})` }} />
    </div>
  );
}

export interface GridDay {
  date: ISODate;
  level: 0 | 1 | 2 | 3 | 4;
  note?: string;
}

/**
 * GitHub-style contribution grid: weeks as columns (Mon..Sun rows), levels 0-4.
 * Cells settle in (staggered) on first view; today's cell pulses.
 */
export function ContributionGrid({
  days,
  weeks = 53,
  end = today(),
  label = "Activity",
  cell = 11,
  summary,
}: {
  days: GridDay[];
  weeks?: number;
  end?: ISODate;
  label?: string;
  cell?: number;
  summary?: ReactNode;
}) {
  const [ref, seen] = useSeen<HTMLDivElement>();
  const [tip, setTip] = useState<{ x: number; y: number; text: string } | null>(null);
  const byDate = useMemo(() => new Map(days.map((d) => [d.date, d])), [days]);
  const t = today();
  // Last column contains `end`; columns start on Monday.
  const lastMonday = addDays(end, -((dow(end) + 6) % 7));
  const start = addDays(lastMonday, -(weeks - 1) * 7);
  const cells: { date: ISODate; level: number; note?: string; future: boolean }[] = [];
  for (let i = 0; i < weeks * 7; i++) {
    const date = addDays(start, i);
    const d = byDate.get(date);
    cells.push({ date, level: d?.level ?? 0, note: d?.note, future: date > end });
  }
  const months: { col: number; name: string }[] = [];
  for (let w = 0; w < weeks; w++) {
    const first = addDays(start, w * 7);
    const prev = addDays(first, -7);
    if (w === 0 || first.slice(5, 7) !== prev.slice(5, 7)) months.push({ col: w, name: monthName(first) });
  }
  const active = cells.filter((c) => c.level > 0).length;
  const gap = 3;
  return (
    <div
      ref={ref}
      className="cg"
      data-seen={seen ? 1 : 0}
      style={{ "--cell": `${cell}px`, "--cell-gap": `${gap}px` } as CSSProperties}
    >
      <div className="cg-scroll">
        <div className="cg-months" style={{ position: "relative", height: 12, width: weeks * (cell + gap) }} aria-hidden>
          {months.map((m) => (
            <span key={m.col} style={{ position: "absolute", left: m.col * (cell + gap) }}>
              {m.name}
            </span>
          ))}
        </div>
        <div className="cg-grid" role="grid" aria-label={`${label}: ${active} active days`}>
          {cells.map((c, i) => {
            const text = `${pretty(c.date)}: ${c.note ?? (c.level ? `level ${c.level}` : "nothing logged")}`;
            return (
              <div
                key={c.date}
                role="gridcell"
                aria-label={c.future ? undefined : text}
                className={`cg-cell l${c.level}${c.future ? " future" : ""}${c.date === t ? " today" : ""}`}
                style={{ "--i": Math.min(i, 300) } as CSSProperties}
                onMouseEnter={(e) => {
                  if (c.future) return;
                  const r = (e.target as HTMLElement).getBoundingClientRect();
                  setTip({ x: r.left + r.width / 2, y: r.top - 8, text });
                }}
                onMouseLeave={() => setTip(null)}
              />
            );
          })}
        </div>
      </div>
      <div className="cg-legend">
        <span>{summary ?? `${active} active days`}</span>
        <span className="swatches" aria-hidden>
          Less
          {[0, 1, 2, 3, 4].map((l) => (
            <i key={l} style={{ background: `var(--contrib-${l})` }} />
          ))}
          More
        </span>
      </div>
      {tip ? (
        <div className="cg-tip" style={{ left: tip.x, top: tip.y, transform: "translate(-50%, -100%)" }} role="tooltip">
          {tip.text}
        </div>
      ) : null}
    </div>
  );
}

export interface TrendPoint {
  label: string;
  value: number | null;
}

/** Minimal SVG line or bar chart with optional target line and band. */
export function TrendChart({
  points,
  kind = "line",
  height = 160,
  target,
  band,
  unit = "",
  label,
  decimals = 0,
}: {
  points: TrendPoint[];
  kind?: "line" | "bar";
  height?: number;
  target?: number;
  band?: [number, number];
  unit?: string;
  label: string;
  decimals?: number;
}) {
  const W = 600;
  const H = height;
  const pad = { l: 36, r: 10, t: 10, b: 22 };
  const vals = points.map((p) => p.value).filter((v): v is number => v !== null && Number.isFinite(v));
  const extra = [target, ...(band ?? [])].filter((v): v is number => typeof v === "number");
  let min = Math.min(...vals, ...extra);
  let max = Math.max(...vals, ...extra);
  if (!Number.isFinite(min)) {
    min = 0;
    max = 1;
  }
  if (kind === "bar") min = Math.min(0, min);
  if (max === min) max = min + 1;
  const span = max - min;
  min -= kind === "bar" ? 0 : span * 0.08;
  max += span * 0.08;
  const x = (i: number) => pad.l + (points.length <= 1 ? 0.5 : i / (points.length - 1)) * (W - pad.l - pad.r);
  const y = (v: number) => pad.t + (1 - (v - min) / (max - min)) * (H - pad.t - pad.b);
  const ticks = [min, (min + max) / 2, max];
  const defined = points.map((p, i) => ({ ...p, i })).filter((p) => p.value !== null);
  const path = defined.map((p, k) => `${k ? "L" : "M"}${x(p.i).toFixed(1)},${y(p.value as number).toFixed(1)}`).join(" ");
  const area = defined.length
    ? `${path} L${x(defined[defined.length - 1].i)},${y(min)} L${x(defined[0].i)},${y(min)} Z`
    : "";
  const bw = Math.max(4, ((W - pad.l - pad.r) / Math.max(1, points.length)) * 0.6);
  const desc = defined.map((p) => `${p.label}: ${(p.value as number).toFixed(decimals)}${unit}`).join(", ");
  const labelEvery = Math.ceil(points.length / 8);
  return (
    <figure className="trend" style={{ margin: 0 }}>
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`${label}. ${desc || "No data yet."}`}>
        {ticks.map((t, i) => (
          <g key={i}>
            <line className="grid-line" x1={pad.l} x2={W - pad.r} y1={y(t)} y2={y(t)} />
            <text className="axis" x={pad.l - 6} y={y(t) + 3} textAnchor="end">
              {t.toFixed(span < 5 ? 1 : 0)}
            </text>
          </g>
        ))}
        {band ? <rect className="band" x={pad.l} width={W - pad.l - pad.r} y={y(band[1])} height={Math.max(0, y(band[0]) - y(band[1]))} /> : null}
        {typeof target === "number" ? <line className="target" x1={pad.l} x2={W - pad.r} y1={y(target)} y2={y(target)} /> : null}
        {kind === "line" ? (
          <>
            {area ? <path className="area" d={area} /> : null}
            {path ? <path className="line" d={path} /> : null}
            {defined.length <= 20 ? defined.map((p) => <circle key={p.i} className="dot" cx={x(p.i)} cy={y(p.value as number)} r={3} />) : null}
          </>
        ) : (
          defined.map((p) => (
            <rect
              key={p.i}
              className="bar"
              x={x(p.i) - bw / 2}
              width={bw}
              y={y(Math.max(0, p.value as number))}
              height={Math.max(1, y(min) - y(Math.max(0, p.value as number)))}
              rx={2}
            />
          ))
        )}
        {points.map((p, i) =>
          i % labelEvery === 0 || i === points.length - 1 ? (
            <text key={i} className="axis" x={x(i)} y={H - 6} textAnchor="middle">
              {p.label}
            </text>
          ) : null,
        )}
      </svg>
    </figure>
  );
}

export interface CheckItem {
  id: string;
  label: ReactNode;
  done: boolean;
  meta?: ReactNode;
  section?: string;
}

/** Tap-to-check list. */
export function Checklist({
  items,
  onToggle,
  size,
  empty,
}: {
  items: CheckItem[];
  onToggle: (id: string, done: boolean) => void;
  size?: "lg";
  empty?: ReactNode;
}) {
  if (!items.length) return <>{empty ?? null}</>;
  return (
    <ul className="checklist">
      {items.map((it) => (
        <li key={it.id} className={`check-row${it.done ? " done" : ""}`}>
          <input
            type="checkbox"
            className={`checkbox${size === "lg" ? " lg" : ""}`}
            checked={it.done}
            onChange={(e) => onToggle(it.id, e.target.checked)}
            aria-label={typeof it.label === "string" ? it.label : "Toggle item"}
            style={it.section ? ({ "--check-color": `var(--accent-${it.section})` } as CSSProperties) : undefined}
          />
          <span className="check-label grow">{it.label}</span>
          {it.meta ? <span className="muted xs">{it.meta}</span> : null}
        </li>
      ))}
    </ul>
  );
}
