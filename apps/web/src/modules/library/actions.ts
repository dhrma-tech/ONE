import { db } from "@/data/db";
import { repo } from "@/data/repo";
import type { Rows } from "@/data/types.gen";
import { api } from "@/lib/api";
import { youtubeId } from "@/domain/thumbs";
import { award } from "@/services/xp";

export interface VideoMeta {
  id: string;
  title?: string;
  channel?: string;
  seconds?: number;
  error?: string;
}

export async function fetchMeta(id: string): Promise<VideoMeta> {
  try {
    return await api.get<VideoMeta>(`/api/video?id=${encodeURIComponent(id)}`);
  } catch {
    return { id, error: "offline" };
  }
}

export async function findVideo(youtube_id: string, section: string): Promise<Rows["videos"] | undefined> {
  return (await db.t("videos").where("[youtube_id+section]").equals([youtube_id, section]).toArray()).find((v) => !v.deleted_at);
}

export async function addVideo(v: Partial<Rows["videos"]> & { youtube_id: string; section: string; title: string }): Promise<Rows["videos"]> {
  const existing = await findVideo(v.youtube_id, v.section);
  if (existing) {
    await repo.patch("videos", existing.id, { ...v, rejected: false });
    return { ...existing, ...v };
  }
  return repo.insert("videos", { added_at: new Date().toISOString(), ...v });
}

/** Parse a pasted list (URLs/ids, one per line) or JSON ([{url|id, title?, topic?, rating?}]). */
export function parseBulk(text: string): { youtube_id: string; title?: string; topic?: string; rating?: number }[] {
  const t = text.trim();
  if (!t) return [];
  if (t.startsWith("[")) {
    const arr = JSON.parse(t) as Record<string, unknown>[];
    return arr
      .map((o) => ({
        youtube_id: youtubeId(String(o.url ?? o.id ?? o.youtube_id ?? "")) ?? "",
        title: typeof o.title === "string" ? o.title : undefined,
        topic: typeof o.topic === "string" ? o.topic : undefined,
        rating: typeof o.rating === "number" ? o.rating : undefined,
      }))
      .filter((x) => x.youtube_id);
  }
  const seen = new Set<string>();
  return t
    .split(/[\s,]+/)
    .map((s) => youtubeId(s))
    .filter((id): id is string => !!id && !seen.has(id) && !!seen.add(id))
    .map((youtube_id) => ({ youtube_id }));
}

export interface Pack {
  v: number;
  name: string;
  source: string;
  section: string;
  topics: { id: string; title: string; group: string }[];
  videos: [string, string, string, number, string][];
}

/** Import a candidate pack into the Inbox (approved = false). Skips videos already present. */
export async function importPack(name: string): Promise<number> {
  const r = await fetch(`/packs/${name}.json`);
  if (!r.ok) throw new Error("pack_missing");
  const p = (await r.json()) as Pack;
  const topic = new Map(p.topics.map((t) => [t.id, t.title]));
  const existing = new Set((await db.t("videos").toArray()).filter((v) => v.section === p.section).map((v) => v.youtube_id));
  const rows = p.videos
    .filter(([id]) => !existing.has(id))
    .map(([youtube_id, title, channel, d, node]) => ({ youtube_id, title, channel, duration_s: d || null, section: p.section, topic: topic.get(node) ?? node, approved: false, source: p.name, added_at: new Date().toISOString() }));
  await repo.insertMany("videos", rows);
  return rows.length;
}

export async function getProgress(videoId: string): Promise<Rows["video_progress"] | undefined> {
  return (await db.t("video_progress").where("video_id").equals(videoId).toArray()).find((p) => !p.deleted_at);
}

/** Quiet position save (no re-render storm): writes at most every few seconds from the player. */
export async function savePosition(videoId: string, position_s: number): Promise<void> {
  const p = await getProgress(videoId);
  if (p?.status === "done") {
    await repo.patch("video_progress", p.id, { position_s: Math.floor(position_s) });
    return;
  }
  await repo.upsertBy("video_progress", { video_id: videoId }, { position_s: Math.floor(position_s), status: "watching" });
}

export async function markDone(v: Rows["videos"], done = true): Promise<void> {
  await repo.upsertBy("video_progress", { video_id: v.id }, { status: done ? "done" : "watching", finished_at: done ? new Date().toISOString() : null });
  if (done) await award("video_done", v.section, "videos", v.id);
}

export async function addNote(videoId: string, t: number, text: string): Promise<void> {
  if (!text.trim()) return;
  await repo.insert("video_notes", { video_id: videoId, t_seconds: Math.max(0, Math.floor(t)), text: text.trim() });
}
