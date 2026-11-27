import { db } from "@/data/db";
import { repo } from "@/data/repo";
import type { Rows } from "@/data/types.gen";
import { generateTasks } from "@/domain/taskgen";
import { addDays, today, type ISODate } from "@/lib/dates";
import { award, revoke } from "./xp";
import { getSettings } from "./settings";

const live = <T extends { deleted_at: string | null }>(rows: T[]) => rows.filter((r) => !r.deleted_at);

let genRunning: Promise<number> | null = null;

/** Creates today's generated tasks (idempotent). Returns how many were added. */
export function ensureTodayTasks(date: ISODate = today()): Promise<number> {
  genRunning ??= (async () => {
    try {
      const [habits, stages, items, notes, contacts, tasks, settings, reviews] = await Promise.all([
        db.t("habits").toArray(),
        db.t("path_stages").toArray(),
        db.t("path_items").toArray(),
        db.t("notes").toArray(),
        db.t("contacts").toArray(),
        db.t("tasks").toArray(),
        getSettings(),
        db.t("daily_reviews").where("date").equals(addDays(date, -1)).toArray(),
      ]);
      const review = reviews.find((r) => !r.deleted_at);
      const existingRefs = new Set(tasks.filter((t) => t.source_ref).map((t) => t.source_ref!));
      const examMode = !!settings?.exam_mode;
      const gen = generateTasks({
        date,
        habits: live(habits),
        stages: live(stages),
        items: live(items),
        notes: live(notes),
        contacts: live(contacts),
        existingRefs,
        examMode,
        minimal: examMode,
        oneThing: review?.tomorrow_one_thing ?? null,
      });
      if (gen.some((g) => g.is_one_thing)) {
        for (const t of tasks.filter((x) => x.due_date === date && x.is_one_thing && !x.deleted_at)) await repo.patch("tasks", t.id, { is_one_thing: false });
      }
      await repo.insertMany("tasks", gen);
      return gen.length;
    } finally {
      genRunning = null;
    }
  })();
  return genRunning;
}

export async function setTaskDone(t: Rows["tasks"], done: boolean): Promise<void> {
  await repo.patch("tasks", t.id, { done_at: done ? new Date().toISOString() : null });
  const kind = t.is_one_thing ? "one_thing_done" : "task_done";
  if (done) {
    await award(kind, t.section, "tasks", t.id, { date: t.due_date ?? today(), quiet: true });
    if (t.path_item_id) await repo.patch("path_items", t.path_item_id, { status: "done", done_at: new Date().toISOString() });
  } else {
    await revoke(kind, "tasks", t.id);
    if (t.path_item_id) await repo.patch("path_items", t.path_item_id, { status: "todo", done_at: null });
  }
}

export async function addTask(title: string, section: string, date: ISODate = today(), oneThing = false): Promise<void> {
  const clean = title.trim();
  if (!clean) return;
  if (oneThing) {
    const same = await db.t("tasks").where("due_date").equals(date).toArray();
    for (const t of same.filter((x) => x.is_one_thing)) await repo.patch("tasks", t.id, { is_one_thing: false });
  }
  await repo.insert("tasks", { title: clean, section, due_date: date, source: "manual", is_one_thing: oneThing, priority: oneThing ? 1 : 2 });
}

export async function makeOneThing(t: Rows["tasks"]): Promise<void> {
  const same = await db.t("tasks").where("due_date").equals(t.due_date ?? today()).toArray();
  for (const x of same.filter((y) => y.is_one_thing && y.id !== t.id)) await repo.patch("tasks", x.id, { is_one_thing: false });
  await repo.patch("tasks", t.id, { is_one_thing: !t.is_one_thing });
}
