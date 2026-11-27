// Daily task generation: habits for today + active path items + due note reviews + follow-ups + exam units.
// Idempotent through `source_ref` (one task per source per day).
import type { Rows } from "@/data/types.gen";
import { addDays, dow, type ISODate } from "@/lib/dates";

export interface GenInput {
  date: ISODate;
  habits: Rows["habits"][];
  stages: Rows["path_stages"][];
  items: Rows["path_items"][];
  notes: Rows["notes"][];
  contacts: Rows["contacts"][];
  existingRefs: Set<string>;
  examMode: boolean;
  minimal: boolean; // exam mode shrinks other sections to minimum tasks
  examUnits?: { id: string; label: string }[];
  oneThing?: string | null; // tomorrow's one thing from last night's review
}

export interface GenTask {
  section: string;
  title: string;
  due_date: ISODate;
  source: string;
  source_ref: string;
  path_item_id?: string | null;
  priority: number;
  is_one_thing?: boolean;
}

export function generateTasks(g: GenInput): GenTask[] {
  const out: GenTask[] = [];
  const add = (t: GenTask) => {
    if (!g.existingRefs.has(t.source_ref) && !out.some((o) => o.source_ref === t.source_ref)) out.push(t);
  };
  const day = dow(g.date);

  if (g.oneThing?.trim()) {
    add({ section: "career", title: g.oneThing.trim(), due_date: g.date, source: "review", source_ref: `onething:${g.date}`, priority: 1, is_one_thing: true });
  }

  for (const h of g.habits) {
    if (!h.active || !h.days.includes(day)) continue;
    if (h.section === "home") continue; // review/weekly review have their own blocks on Home
    if (g.minimal && h.section !== "career" && h.order_no > 1) continue;
    let title = h.title;
    if (g.examMode && h.title.startsWith("Block 3")) title = "Block 3: exam prep";
    add({ section: h.section, title, due_date: g.date, source: "habit", source_ref: `habit:${h.id}:${g.date}`, priority: h.section === "career" ? 1 : 2 });
  }

  // First unfinished item of each active stage (one per lane) becomes today's path task.
  const active = g.stages.filter((s) => s.status === "active" && !s.deleted_at);
  for (const s of active) {
    if (g.minimal && s.section !== "career") continue;
    const next = g.items.filter((i) => i.stage_id === s.id && i.status !== "done" && !i.deleted_at).sort((a, b) => a.order_no - b.order_no)[0];
    if (next) add({ section: s.section, title: next.title, due_date: g.date, source: "path", source_ref: `path:${next.id}:${g.date}`, path_item_id: next.id, priority: 1 });
  }

  for (const n of g.notes) {
    if (n.next_review_at && n.next_review_at <= g.date)
      add({ section: n.section, title: `Review note: ${n.title}`, due_date: g.date, source: "note", source_ref: `note:${n.id}:${n.review_stage}`, priority: 3 });
  }

  for (const c of g.contacts) {
    if (c.status === "accepted" && c.follow_up_at && c.follow_up_at <= g.date)
      add({ section: "persona", title: `Follow up with ${c.name}: one specific question about their work`, due_date: g.date, source: "followup", source_ref: `followup:${c.id}:${c.follow_up_at}`, priority: 2 });
  }

  for (const u of g.examUnits ?? [])
    add({ section: "career", title: `Exam prep: ${u.label}`, due_date: g.date, source: "exam", source_ref: `exam:${u.id}:${g.date}`, priority: 1 });

  return out;
}

/** Follow-up date: 2-3 days after "accepted" (we use +2, or +3 if that lands on Sunday). */
export function followUpDate(acceptedAt: ISODate): ISODate {
  const d = addDays(acceptedAt, 2);
  return dow(d) === 0 ? addDays(d, 1) : d;
}
