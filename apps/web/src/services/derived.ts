// Keeps settings.derived_stats fresh: the app-computed numbers the public_stats SQL function can expose
// (only if Dharma flags them). Never includes body data, journal, contacts or recordings.
import { db } from "@/data/db";
import { today } from "@/lib/dates";
import { computeSummary } from "./summary";
import { getSettings, patchSettings } from "./settings";

export async function refreshDerivedStats(force = false): Promise<void> {
  const s = await getSettings();
  if (!s) return;
  const prev = (s.derived_stats ?? {}) as { date?: string };
  if (!force && prev.date === today()) return;
  const sum = await computeSummary();
  const active = (await db.t("path_stages").toArray()).filter((x) => !x.deleted_at && x.section === "career" && x.status === "active").sort((a, b) => a.order_no - b.order_no)[0];
  const grid = sum.masterGrid.slice(-84).map((g) => g.level).join("");
  await patchSettings({
    derived_stats: {
      date: today(),
      overall_streak: sum.overall.current,
      level: sum.xp.level.level,
      current_focus: active ? `Learning: ${active.title.replace(/^Weeks? [\d-]+: /, "")}` : null,
      grid,
    },
  });
}

/** Public stat keys the portfolio may show (all off by default). */
export const PUBLIC_STATS: { key: string; label: string }[] = [
  { key: "lock_in_day", label: "Lock-in day count" },
  { key: "overall_streak", label: "Overall streak" },
  { key: "level", label: "Current level" },
  { key: "current_focus", label: "Current focus (path stage)" },
  { key: "python_hours_week", label: "Python hours this week" },
  { key: "github_pushes_week", label: "GitHub pushes this week" },
  { key: "chess_rapid", label: "Chess.com rapid rating" },
  { key: "posts_month", label: "Posts this month" },
  { key: "books_finished", label: "Books finished" },
  { key: "workouts_month", label: "Workouts this month" },
  { key: "grid", label: "Mini contribution grid (12 weeks)" },
];
