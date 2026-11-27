// Library queue logic shared by Home and sections. Full Library UI lives in modules/library.
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "@/data/db";
import type { Rows } from "@/data/types.gen";

type VideoRow = Rows["videos"];
export interface QueueVideo extends VideoRow {
  progress?: Rows["video_progress"];
  pathOrder: number;
}

/**
 * "Next up" sort: path order → priority → rating (desc) → shortest first.
 * Videos linked to an earlier path item come first; unlinked videos sort after linked ones.
 */
export function sortQueue(videos: QueueVideo[]): QueueVideo[] {
  return [...videos].sort(
    (a, b) =>
      a.pathOrder - b.pathOrder ||
      a.priority - b.priority ||
      (b.rating ?? 0) - (a.rating ?? 0) ||
      (a.duration_s ?? 1e9) - (b.duration_s ?? 1e9) ||
      a.title.localeCompare(b.title),
  );
}

export async function loadQueue(section?: string): Promise<QueueVideo[]> {
  const [videos, progress, items, stages] = await Promise.all([db.t("videos").toArray(), db.t("video_progress").toArray(), db.t("path_items").toArray(), db.t("path_stages").toArray()]);
  const prog = new Map(progress.filter((p) => !p.deleted_at).map((p) => [p.video_id, p]));
  const stageOrder = new Map(stages.map((s) => [s.id, (s.target_week ?? 99) * 100 + s.order_no]));
  const itemOrder = new Map(items.map((i) => [i.id, (stageOrder.get(i.stage_id) ?? 9999) * 100 + i.order_no]));
  const list = videos
    .filter((v) => !v.deleted_at && v.approved && !v.rejected && (!section || v.section === section))
    .map((v) => ({ ...v, progress: prog.get(v.id), pathOrder: v.path_item_id ? (itemOrder.get(v.path_item_id) ?? 1e8) : 1e9 }))
    .filter((v) => v.progress?.status !== "done");
  return sortQueue(list);
}

const SECTION_PRIORITY = ["career", "mind", "body", "persona"];

/** The single next video: from the highest-priority section that has one. */
export async function nextUp(section?: string): Promise<QueueVideo | null> {
  if (section) return (await loadQueue(section))[0] ?? null;
  const all = await loadQueue();
  for (const s of SECTION_PRIORITY) {
    const v = all.find((x) => x.section === s);
    if (v) return v;
  }
  return null;
}

export function useNextUp(section?: string) {
  return useLiveQuery(() => nextUp(section), [section]);
}
