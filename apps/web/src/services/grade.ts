import { useLiveQuery } from "dexie-react-hooks";
import { db } from "@/data/db";
import { weeklyGrade } from "@/domain/rules";
import { addDays, range, today, weekStart, type ISODate } from "@/lib/dates";
import { loadFacts } from "./facts";

export async function computeWeek(ws: ISODate = weekStart(today())) {
  const end = addDays(ws, 6);
  const { facts, examMode, targets } = await loadFacts(ws, end);
  const days = range(ws, end).map((d) => facts.get(d)!);
  const reviews = (await db.t("flashcard_reviews").toArray()).filter((r) => !r.deleted_at && r.date >= ws && r.date <= end);
  const flashcardDays = new Set(reviews.map((r) => r.date)).size;
  const ladder = (await db.t("stuck_ladder").toArray()).filter((r) => !r.deleted_at && r.week_start <= ws).sort((a, b) => (a.week_start < b.week_start ? 1 : -1))[0];
  const g = weeklyGrade({ days, flashcardDays, stuckTarget: ladder?.target_min ?? null, ctx: { targets, examMode } });
  const t = today();
  return {
    ...g,
    weekStart: ws,
    days,
    focusMin: days.reduce((a, f) => a + f.focus_min, 0),
    gym: days.filter((f) => f.workout_logged).length,
    pushes: days.reduce((a, f) => a + (f.pushes ?? 0), 0),
    block1Min: days.reduce((a, f) => a + f.block1_min, 0),
    targets,
    elapsedDays: days.filter((f) => f.date <= t).length,
  };
}

export type WeekResult = Awaited<ReturnType<typeof computeWeek>>;

export function useWeek(ws?: ISODate) {
  return useLiveQuery(() => computeWeek(ws), [ws]);
}
