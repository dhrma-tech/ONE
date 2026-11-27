import { db } from "@/data/db";
import { repo } from "@/data/repo";
import { ACHIEVEMENTS, newlyUnlocked, type AchStats } from "@/domain/achievements";
import { today } from "@/lib/dates";
import { toast } from "@/ui/overlay";
import { computeSummary } from "./summary";

let checking = false;
const live = <T extends { deleted_at: string | null }>(x: T[]) => x.filter((r) => !r.deleted_at);

export async function achievementStats(): Promise<AchStats> {
  const s = await computeSummary();
  const f = [...s.facts.values()];
  const [weighs, targets, posts, contacts, recs, books, grades, chess, med, units] = await Promise.all([
    db.t("weigh_ins").toArray().then(live),
    db.t("body_targets").toArray().then(live),
    db.t("posts").toArray().then(live),
    db.t("contacts").toArray().then(live),
    db.t("speaking_recordings").toArray().then(live),
    db.t("books").toArray().then(live),
    db.t("weekly_grades").toArray().then(live),
    db.t("chess_snapshots").toArray().then(live),
    db.t("meditation_sessions").toArray().then(live),
    db.t("units").toArray().then(live),
  ]);
  const latestW = [...weighs].sort((a, b) => (a.date < b.date ? 1 : -1))[0];
  const start = targets[0]?.start_kg ?? null;
  const rapid = [...chess].filter((c) => c.rapid).sort((a, b) => (a.date < b.date ? 1 : -1))[0]?.rapid ?? null;
  let medStreak = 0;
  for (let i = s.dates.length - 1; i >= 0; i--) {
    const d = s.facts.get(s.dates[i])!;
    if (d.meditation_min >= 5) medStreak++;
    else if (i !== s.dates.length - 1) break;
  }
  const weekProtein = s.dates.slice(-7).every((d) => s.facts.get(d)!.protein_g >= s.ctx.targets.protein_low);
  return {
    pushDays: f.filter((x) => (x.pushes ?? 0) > 0).length,
    block1Days: f.filter((x) => x.block1_min >= s.ctx.targets.block1_min).length,
    overallStreak: s.overall.current,
    bestStreak: s.overall.best,
    reviews: f.filter((x) => x.review_submitted).length,
    unitsCracked: units.filter((u) => u.status === "cracked").length,
    rapid,
    puzzlesSolved: f.reduce((a, x) => a + x.chess_events, 0),
    meditationStreak: medStreak,
    meditationSessions: med.length,
    workouts: f.filter((x) => x.workout_logged).length,
    weightGain: latestW && start ? Number(latestW.weight_kg) - Number(start) : null,
    proteinWeek: weekProtein,
    postsPublished: posts.filter((p) => p.status === "published").length,
    realConversations: f.reduce((a, x) => a + x.real_conversations, 0),
    connections: contacts.filter((c) => c.status !== "sent").length,
    recordings: recs.length,
    booksFinished: books.filter((b) => b.status === "finished").length,
    gradeA: grades.some((g) => g.grade === "A"),
    level: s.xp.level.level,
  };
}

/** Unlock any newly earned achievements (toast + 25 XP each). */
export async function checkAchievements(): Promise<void> {
  if (checking) return;
  checking = true;
  try {
    const unlocked = new Set(live(await db.t("achievement_unlocks").toArray()).map((u) => u.code));
    const fresh = newlyUnlocked(await achievementStats(), unlocked);
    for (const a of fresh) {
      await repo.insert("achievement_unlocks", { code: a.code, unlocked_at: new Date().toISOString() });
      await repo.insert("xp_events", { kind: "achievement", section: "home", ref_table: "achievements", ref_id: a.code, points: 25, date: today() });
      toast.ok("Achievement: " + a.title, a.desc);
    }
  } finally {
    checking = false;
  }
}

export { ACHIEVEMENTS };
