// One-tap logging used by section pages and the command palette.
import { db } from "@/data/db";
import { repo } from "@/data/repo";
import { today, type ISODate } from "@/lib/dates";
import { award } from "./xp";
import { getSettings } from "./settings";
import { withDefaults } from "@/domain/targets";

export async function logWater(ml: number, date: ISODate = today()) {
  await repo.insert("water_logs", { date, ml: Math.round(ml) });
  const t = withDefaults((await getSettings())?.targets);
  if (t.water_ml) {
    const total = (await db.t("water_logs").where("date").equals(date).toArray()).filter((w) => !w.deleted_at).reduce((a, w) => a + w.ml, 0);
    if (total >= t.water_ml) await award("water_target", "body", "water", date, { date, quiet: true });
  }
}

export async function logWeight(kg: number, date: ISODate = today()) {
  await repo.upsertBy("weigh_ins", { date }, { weight_kg: Math.round(kg * 10) / 10 });
  await award("weigh_in", "body", "weigh_ins", date, { date, quiet: true });
}

export async function logDiet(calories: number, protein_g: number, label?: string, template_id?: string, date: ISODate = today()) {
  await repo.insert("diet_logs", { date, calories: Math.round(calories), protein_g: Math.round(protein_g), label: label ?? null, template_id: template_id ?? null });
  await award("diet_logged", "body", "diet", date, { date, quiet: true });
}

export async function logMeditation(minutes: number, preset?: string, date: ISODate = today()) {
  const row = await repo.insert("meditation_sessions", { date, minutes: Math.round(minutes), preset: preset ?? null });
  await award("meditation", "mind", "meditation_sessions", row.id, { date, quiet: true });
}

/** Increment a persona_daily counter for a date. */
export async function bumpPersona(field: "english_min" | "conversations_started" | "real_conversations" | "calls_answered" | "calls_made", by: number, date: ISODate = today()) {
  const cur = (await db.t("persona_daily").where("date").equals(date).toArray()).find((r) => !r.deleted_at);
  const next = Math.max(0, (cur?.[field] ?? 0) + by);
  await repo.upsertBy("persona_daily", { date }, { [field]: next });
  if (field === "real_conversations" && by > 0) await award("conversation", "persona", "persona_daily", `${date}:${next}`, { date, quiet: true });
}
