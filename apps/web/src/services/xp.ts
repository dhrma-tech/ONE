import { db } from "@/data/db";
import { repo } from "@/data/repo";
import { XP, type XpKind } from "@/domain/xp";
import { today, type ISODate } from "@/lib/dates";
import { toast } from "@/ui/overlay";

/** Award XP once per (kind, ref_table, ref_id). Returns points awarded (0 if already awarded). */
export async function award(kind: XpKind, section: string, ref_table = "", ref_id = "", opts: { date?: ISODate; points?: number; quiet?: boolean } = {}): Promise<number> {
  const existing = await db.t("xp_events").where("[kind+ref_table+ref_id]").equals([kind, ref_table, ref_id]).first();
  const points = opts.points ?? XP[kind];
  if (points <= 0) return 0;
  if (existing && !existing.deleted_at) return 0;
  if (existing) await repo.patch("xp_events", existing.id, { deleted_at: null, points, date: opts.date ?? today() });
  else await repo.insert("xp_events", { kind, section, ref_table, ref_id, points, date: opts.date ?? today() });
  if (!opts.quiet) toast.ok(`+${points} XP`);
  // Achievements are checked lazily to avoid import cycles.
  void import("./achievements").then((m) => m.checkAchievements());
  return points;
}

/** Undo an award (e.g. a task unticked). */
export async function revoke(kind: XpKind, ref_table: string, ref_id: string): Promise<void> {
  const e = await db.t("xp_events").where("[kind+ref_table+ref_id]").equals([kind, ref_table, ref_id]).first();
  if (e && !e.deleted_at) await repo.remove("xp_events", e.id);
}
