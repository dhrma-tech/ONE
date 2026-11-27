// Analytics kit: contribution grid + 3-5 count-up stats + one trend + "Lagging in" line + range switch.
import { useState, type ReactNode } from "react";
import type { DayFacts } from "@/domain/facts";
import type { Targets } from "@/domain/targets";
import { addDays, isoWeek, monthName, today, weekStart, type ISODate } from "@/lib/dates";
import type { SectionId } from "@/lib/sections";
import { useSummary, type Summary } from "@/services/summary";
import { Card, ContributionGrid, Icon, Seg, StatCard, TrendChart, type TrendPoint } from "@/ui";

export type Range = "week" | "month" | "year";
export const RANGE_DAYS: Record<Range, number> = { week: 7, month: 30, year: 365 };

export interface AnalyticsCtx {
  sum: Summary;
  days: DayFacts[]; // within range, oldest first
  week: DayFacts[]; // this ISO week so far
  targets: Targets;
  range: Range;
}

export interface StatDef {
  label: string;
  value: (c: AnalyticsCtx) => number | null;
  unit?: string;
  decimals?: number;
  delta?: (c: AnalyticsCtx) => number | null;
  goodWhen?: "up" | "down";
}

export interface LagDef {
  label: string;
  actual: (c: AnalyticsCtx) => number;
  target: (c: AnalyticsCtx) => number;
  unit?: string;
  quip: string;
}

export interface TrendDef {
  label: string;
  kind?: "line" | "bar";
  unit?: string;
  decimals?: number;
  /** Value per bucket (week or day) from the facts in that bucket. Return null for no data. */
  value: (days: DayFacts[]) => number | null;
  bucket?: "day" | "week";
  target?: (c: AnalyticsCtx) => number | undefined;
  band?: (c: AnalyticsCtx) => [number, number] | undefined;
  extra?: ReactNode;
}

/** Group facts into week (Mon) buckets or keep days. */
export function bucketize(days: DayFacts[], bucket: "day" | "week"): { label: string; days: DayFacts[] }[] {
  if (bucket === "day") return days.map((d) => ({ label: `${Number(d.date.slice(8))} ${monthName(d.date)}`, days: [d] }));
  const m = new Map<string, DayFacts[]>();
  for (const d of days) {
    const k = weekStart(d.date);
    (m.get(k) ?? m.set(k, []).get(k)!).push(d);
  }
  return [...m.entries()].map(([k, v]) => ({ label: isoWeek(k).slice(5), days: v }));
}

/** Lowest actual/target ratio wins. */
export function laggingIn(defs: LagDef[], c: AnalyticsCtx): { def: LagDef; actual: number; target: number } | null {
  let worst: { def: LagDef; actual: number; target: number; ratio: number } | null = null;
  for (const def of defs) {
    const target = def.target(c);
    if (!target) continue;
    const actual = def.actual(c);
    const ratio = actual / target;
    if (ratio < 1 && (!worst || ratio < worst.ratio)) worst = { def, actual, target, ratio };
  }
  return worst;
}

export function SectionAnalytics({ section, stats, trend, lag }: { section: SectionId; stats: StatDef[]; trend: TrendDef; lag: LagDef[] }) {
  const sum = useSummary();
  const [range, setRange] = useState<Range>("month");
  if (!sum) return <p className="micro">Crunching numbers…</p>;
  const t = today();
  const from = addDays(t, -(RANGE_DAYS[range] - 1));
  const ws = weekStart(t);
  const days = sum.dates.filter((d) => d >= from).map((d) => sum.facts.get(d)!);
  const week = sum.dates.filter((d) => d >= ws).map((d) => sum.facts.get(d)!);
  const c: AnalyticsCtx = { sum, days, week, targets: sum.ctx.targets, range };
  const bucket = trend.bucket ?? (range === "week" ? "day" : "week");
  const points: TrendPoint[] = bucketize(days, bucket).map((b) => ({ label: b.label, value: trend.value(b.days) }));
  const lagging = laggingIn(lag, c);
  const st = sum.sectionStreaks[section];
  return (
    <div className="bento">
      <Card className="span-12" eyebrow={`${sum.sectionGrid[section].filter((g) => g.level >= 3).length} done days`} title="Done days" right={<span className="micro row"><Icon name="flame" size={12} /> {st.current} now · best {st.best}</span>}>
        <ContributionGrid days={sum.sectionGrid[section]} label={`${section} done days`} />
      </Card>
      {lagging ? (
        <div className="span-12 lagging" role="status">
          <span className="micro">Lagging in</span>
          <span>
            {lagging.def.label}: {Math.round(lagging.actual * 10) / 10} of {lagging.target}
            {lagging.def.unit ?? ""}. {lagging.def.quip}
          </span>
        </div>
      ) : (
        <div className="span-12 lagging" role="status">
          <span className="micro">Lagging in</span>
          <span>Nothing this week. Suspicious. Keep it that way.</span>
        </div>
      )}
      <Card className="span-12" title="Numbers" right={<Seg label="Range" value={range} onChange={setRange} options={[{ value: "week", label: "Week" }, { value: "month", label: "Month" }, { value: "year", label: "Year" }]} />}>
        <div className="cols-4" style={{ gridTemplateColumns: `repeat(auto-fit, minmax(150px, 1fr))` }}>
          {stats.map((s) => {
            const d = s.delta?.(c);
            return <StatCard key={s.label} label={s.label} value={s.value(c)} unit={s.unit} decimals={s.decimals} delta={d !== null && d !== undefined ? { value: d, unit: s.unit, goodWhen: s.goodWhen } : undefined} />;
          })}
        </div>
      </Card>
      <Card className="span-12" title={trend.label}>
        <TrendChart label={trend.label} kind={trend.kind} unit={trend.unit} decimals={trend.decimals} points={points} target={trend.target?.(c)} band={trend.band?.(c)} />
        {trend.extra}
      </Card>
    </div>
  );
}

export const sumBy = (days: DayFacts[], f: (d: DayFacts) => number) => days.reduce((a, d) => a + f(d), 0);
export const countBy = (days: DayFacts[], f: (d: DayFacts) => boolean) => days.filter(f).length;
export type { ISODate };
