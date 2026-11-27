// Whole-history summary: streaks, levels, grids. Shared by Home, Analytics, achievements and public stats.
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "@/data/db";
import type { DayFacts } from "@/domain/facts";
import { masterLevel, overallCounts, sectionsDone, streak, type RuleCtx, type SectionDay, type StreakInfo } from "@/domain/rules";
import { levelFromXp } from "@/domain/levels";
import { totals } from "@/domain/xp";
import { addDays, today, type ISODate } from "@/lib/dates";
import { SECTIONS, type SectionId } from "@/lib/sections";
import type { GridDay } from "@/ui/data";
import { loadFacts } from "./facts";

export interface Summary {
  today: ISODate;
  ctx: RuleCtx;
  facts: Map<ISODate, DayFacts>;
  todayFacts: DayFacts;
  todaySections: Record<SectionId, SectionDay>;
  overall: StreakInfo;
  sectionStreaks: Record<SectionId, StreakInfo>;
  xp: { total: number; level: ReturnType<typeof levelFromXp>; bySection: Record<SectionId, { xp: number; level: number }> };
  masterGrid: GridDay[];
  sectionGrid: Record<SectionId, GridDay[]>;
  dates: ISODate[];
}

export async function computeSummary(days = 371): Promise<Summary> {
  const t = today();
  const from = addDays(t, -(days - 1));
  const { facts, examMode, targets } = await loadFacts(from, t);
  const ctx: RuleCtx = { targets, examMode };
  const dates = [...facts.keys()];
  const per = new Map(dates.map((d) => [d, sectionsDone(facts.get(d)!, ctx)]));
  const sectionGrid = {} as Record<SectionId, GridDay[]>;
  const sectionStreaks = {} as Record<SectionId, StreakInfo>;
  for (const s of SECTIONS) {
    sectionGrid[s] = dates.map((d) => ({ date: d, level: per.get(d)![s].level, note: per.get(d)![s].note }));
    sectionStreaks[s] = streak(dates, (d) => per.get(d)![s].done, t);
  }
  const masterGrid: GridDay[] = dates.map((d) => {
    const f = facts.get(d)!;
    const l = masterLevel(f, ctx);
    return { date: d, level: l, note: l + " of 4 sections done" + (f.review_submitted ? ", review in" : "") };
  });
  const xpEvents = (await db.t("xp_events").toArray()).filter((e) => !e.deleted_at);
  const tot = totals(xpEvents);
  const bySection = {} as Summary["xp"]["bySection"];
  for (const s of SECTIONS) bySection[s] = { xp: tot.bySection[s], level: levelFromXp(tot.bySection[s]).level };
  return {
    today: t,
    ctx,
    facts,
    todayFacts: facts.get(t)!,
    todaySections: per.get(t)!,
    overall: streak(dates, (d) => overallCounts(facts.get(d)!, ctx), t),
    sectionStreaks,
    xp: { total: tot.total, level: levelFromXp(tot.total), bySection },
    masterGrid,
    sectionGrid,
    dates,
  };
}

export function useSummary(): Summary | undefined {
  return useLiveQuery(() => computeSummary(), []);
}
