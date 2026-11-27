// Obsidian markdown mirror (backup). ONE is the source of truth.
// Chrome/Edge: File System Access API (handle persisted in IndexedDB, permission re-requested when needed).
// Desktop (Tauri): direct writes through the bridge in apps/desktop. iPhone/Safari: unsupported, skipped silently.
import { useSyncExternalStore } from "react";
import { db } from "@/data/db";
import { bookFile, journalFile, noteFile, postFile, readingFile, weeklyFile, type MirrorFile } from "@/domain/mirror";
import type { ISODate } from "@/lib/dates";
import { patchSettings, getSettings } from "@/services/settings";

interface DirHandle {
  name: string;
  getDirectoryHandle(n: string, o?: { create?: boolean }): Promise<DirHandle>;
  getFileHandle(n: string, o?: { create?: boolean }): Promise<{ createWritable(): Promise<{ write(d: string): Promise<void>; close(): Promise<void> }> }>;
  queryPermission?(o: { mode: "readwrite" }): Promise<PermissionState>;
  requestPermission?(o: { mode: "readwrite" }): Promise<PermissionState>;
}

/** Tauri exposes this bridge (see apps/desktop). */
interface DesktopBridge {
  pickFolder(): Promise<string | null>;
  writeFile(root: string, rel: string, content: string): Promise<void>;
}
const desktop = (): DesktopBridge | undefined => (window as unknown as { oneDesktop?: DesktopBridge }).oneDesktop;

const fsaSupported = () => typeof window !== "undefined" && "showDirectoryPicker" in window;

interface State {
  supported: boolean;
  folder: string | null;
}
let state: State = { supported: false, folder: null };
const subs = new Set<() => void>();
const set = (p: Partial<State>) => {
  state = { ...state, ...p };
  subs.forEach((f) => f());
};

async function init() {
  const s = await getSettings();
  set({ supported: !!desktop() || fsaSupported(), folder: ((s?.obsidian ?? {}) as { folder_name?: string }).folder_name ?? null });
}
if (typeof window !== "undefined") setTimeout(() => void init(), 0);

export function useObsidian(): State {
  return useSyncExternalStore(
    (cb) => {
      subs.add(cb);
      return () => subs.delete(cb);
    },
    () => state,
  );
}

async function getHandle(): Promise<DirHandle | null> {
  return ((await db.meta.get("obsidian_handle"))?.value as DirHandle | undefined) ?? null;
}

async function writeAll(files: MirrorFile[]): Promise<number> {
  const d = desktop();
  const s = await getSettings();
  const ob = (s?.obsidian ?? {}) as { folder_name?: string; desktop_path?: string };
  if (d && ob.desktop_path) {
    for (const f of files) await d.writeFile(ob.desktop_path, f.path.join("/"), f.content);
    return files.length;
  }
  const root = await getHandle();
  if (!root) throw new Error("No Obsidian folder chosen.");
  if (root.queryPermission && (await root.queryPermission({ mode: "readwrite" })) !== "granted") {
    if (!root.requestPermission || (await root.requestPermission({ mode: "readwrite" })) !== "granted") throw new Error("Folder permission denied.");
  }
  for (const f of files) {
    let dir = root;
    for (const seg of f.path.slice(0, -1)) dir = await dir.getDirectoryHandle(seg, { create: true });
    const fh = await dir.getFileHandle(f.path[f.path.length - 1], { create: true });
    const w = await fh.createWritable();
    await w.write(f.content);
    await w.close();
  }
  return files.length;
}

async function done(n: number, error: string | null = null) {
  const s = await getSettings();
  await patchSettings({ obsidian: { ...(s?.obsidian ?? {}), last_mirror_at: new Date().toISOString(), last_count: n, error } });
}

const live = <T extends { deleted_at: string | null }>(x: T[]) => x.filter((r) => !r.deleted_at);

export async function collectAll(): Promise<MirrorFile[]> {
  const [reviews, grades, notes, reading, books, sessions, posts] = await Promise.all([
    db.t("daily_reviews").toArray().then(live),
    db.t("weekly_grades").toArray().then(live),
    db.t("notes").toArray().then(live),
    db.t("reading_list").toArray().then(live),
    db.t("books").toArray().then(live),
    db.t("reading_sessions").toArray().then(live),
    db.t("posts").toArray().then(live),
  ]);
  return [
    ...reviews.filter((r) => r.submitted_at).map(journalFile),
    ...grades.filter((g) => g.finalised_at || g.grade).map(weeklyFile),
    ...notes.map(noteFile),
    ...reading.filter((r) => r.read_at).map(readingFile),
    ...books.map((b) => bookFile(b, sessions.filter((s) => s.book_id === b.id))),
    ...posts.map(postFile),
  ];
}

export const obsidian = {
  /** Choose the vault folder (user gesture required). Returns the folder name. */
  async pick(): Promise<string | null> {
    const d = desktop();
    if (d) {
      const p = await d.pickFolder();
      if (!p) return null;
      const s = await getSettings();
      await patchSettings({ obsidian: { ...(s?.obsidian ?? {}), folder_name: p, desktop_path: p } });
      set({ folder: p });
      return p;
    }
    if (!fsaSupported()) return null;
    const h = (await (window as unknown as { showDirectoryPicker(o: object): Promise<DirHandle> }).showDirectoryPicker({ id: "one-vault", mode: "readwrite" })) as DirHandle;
    await db.meta.put({ key: "obsidian_handle", value: h });
    const s = await getSettings();
    await patchSettings({ obsidian: { ...(s?.obsidian ?? {}), folder_name: h.name } });
    set({ folder: h.name });
    return h.name;
  },
  async mirrorAll(): Promise<number> {
    try {
      const n = await writeAll(await collectAll());
      await done(n);
      return n;
    } catch (e) {
      await done(0, String((e as Error).message));
      throw e;
    }
  },
};

/** Auto-mirror after the nightly review (journal + this week's grade + anything changed). Silent on failure. */
export async function mirrorAfterReview(date: ISODate): Promise<void> {
  if (!state.folder) return;
  try {
    const review = live(await db.t("daily_reviews").where("date").equals(date).toArray())[0];
    const files = review ? [journalFile(review)] : [];
    const grades = live(await db.t("weekly_grades").toArray()).filter((g) => g.grade);
    files.push(...grades.slice(-1).map(weeklyFile));
    await writeAll(files);
    await done(files.length);
  } catch (e) {
    await done(0, String((e as Error).message));
  }
}
