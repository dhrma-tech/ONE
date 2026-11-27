// Builds the events ONE pushes to the dedicated "ONE" Google calendar.
// Only the 11:30 PM nightly review carries a reminder (the one allowed nudge).
import { db } from "@/data/db";
import { api } from "@/lib/api";
import { addDays, today, type ISODate } from "@/lib/dates";
import { withDefaults } from "@/domain/targets";
import { getSettings } from "./settings";
import { setStatus } from "./integrations";

export interface PushEvent {
  key: string;
  summary: string;
  description?: string;
  start: string;
  end?: string;
  rrule?: string;
  reminder?: boolean;
}

const BYDAY = ["SU", "MO", "TU", "WE", "TH", "FR", "SA"];
const addMin = (date: ISODate, hhmm: string, min: number): string => {
  const [h, m] = hhmm.split(":").map(Number);
  const total = h * 60 + m + min;
  const d = addDays(date, Math.floor(total / 1440));
  const r = ((total % 1440) + 1440) % 1440;
  return `${d}T${String(Math.floor(r / 60)).padStart(2, "0")}:${String(r % 60).padStart(2, "0")}`;
};
/** First date on/after `from` whose weekday is in `days`. */
const firstOn = (from: ISODate, days: number[]): ISODate => {
  for (let i = 0; i < 7; i++) {
    const d = addDays(from, i);
    if (days.includes(new Date(`${d}T00:00:00Z`).getUTCDay())) return d;
  }
  return from;
};

export async function buildCalendarEvents(from: ISODate = today()): Promise<PushEvent[]> {
  const live = <T extends { deleted_at: string | null }>(x: T[]) => x.filter((r) => !r.deleted_at);
  const [habits, exams, subjects, hackathons, settings] = await Promise.all([db.t("habits").toArray().then(live), db.t("exams").toArray().then(live), db.t("subjects").toArray().then(live), db.t("hackathons").toArray().then(live), getSettings()]);
  const t = withDefaults(settings?.targets);
  const out: PushEvent[] = [];
  const recurring = (key: string, summary: string, days: number[], time: string, minutes: number, reminder = false, description?: string) => {
    if (!days.length || !time) return;
    const d = firstOn(from, days);
    out.push({ key, summary, description, start: addMin(d, time, 0), end: addMin(d, time, Math.max(15, minutes)), rrule: `RRULE:FREQ=WEEKLY;BYDAY=${days.map((x) => BYDAY[x]).join(",")}`, reminder });
  };
  // The nightly review: the only event with a reminder.
  recurring("review", "ONE · Nightly review", [0, 1, 2, 3, 4, 5, 6], t.review_time, 30, true, "Open ONE → Home → Nightly review. Then lights out.");
  recurring("weekly-review", "ONE · Weekly review", [0], t.weekly_review_time, 45, false, "Grade the week, top 3 wins/fails, next week's 3 priorities.");
  recurring("gym", "Gym", t.gym_days, t.gym_time, 60);
  for (const h of habits) {
    if (!h.calendar || !h.active || !h.time || h.section === "home" || /^gym/i.test(h.title)) continue;
    recurring(`habit:${h.id}`, h.title, h.days, h.time, h.minutes ?? 60);
  }
  const subj = new Map(subjects.map((s) => [s.id, s.name]));
  for (const e of exams) {
    if (e.date < from) continue;
    out.push(e.start_time ? { key: `exam:${e.id}`, summary: `${e.kind.toUpperCase()}: ${subj.get(e.subject_id) ?? "Exam"}`, start: `${e.date}T${e.start_time.slice(0, 5)}`, end: addMin(e.date, e.start_time.slice(0, 5), 180) } : { key: `exam:${e.id}`, summary: `${e.kind.toUpperCase()}: ${subj.get(e.subject_id) ?? "Exam"}`, start: e.date });
  }
  for (const h of hackathons) if (h.deadline && h.deadline >= from && h.status !== "skipped") out.push({ key: `hackathon:${h.id}`, summary: `Deadline: ${h.name}`, start: h.deadline });
  return out;
}

export async function pushCalendar(): Promise<{ upserted: number; removed: number }> {
  const events = await buildCalendarEvents();
  try {
    const r = await api.post<{ upserted: number; removed: number }>("/api/google/push", { events });
    await setStatus("google", "connected", undefined, { last_push: new Date().toISOString(), pushed: r.upserted });
    try {
      localStorage.setItem("one.gcal.pushed", today());
    } catch {
      /* ignore */
    }
    return r;
  } catch (e) {
    await setStatus("google", "error", String((e as Error).message));
    throw e;
  }
}

/** Once a day, quietly re-sync the ONE calendar (if Google is connected). */
export async function pushCalendarDaily(): Promise<void> {
  try {
    if (localStorage.getItem("one.gcal.pushed") === today()) return;
  } catch {
    return;
  }
  const s = (await db.t("integration_status").where("provider").equals("google").toArray())[0];
  if (s?.status !== "connected") return;
  await pushCalendar().catch(() => undefined);
}
