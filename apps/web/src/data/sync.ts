// Sync engine: push the outbox, pull remote changes since the last pull (by server clock synced_at),
// last-write-wins by updated_at, conflicts logged. Pure logic over a small RemoteApi so it is testable.
import { db, type OutboxEntry } from "./db";
import { SYNC_TABLES, type TableName } from "./schema";
import { topoOrder } from "./order";
import { nowIso } from "./repo";
import type { BaseRow } from "./types.gen";

export interface RemoteApi {
  upsert(table: TableName, rows: BaseRow[]): Promise<void>;
  /** Rows with synced_at > since, ordered by synced_at ascending. */
  pullSince(table: TableName, since: string | null, limit: number): Promise<BaseRow[]>;
  uploadBlob?(bucket: string, path: string, blob: Blob, mime: string): Promise<void>;
}

export interface SyncResult {
  pushed: number;
  pulled: number;
  conflicts: number;
  errors: string[];
}

const PULL_KEY = (t: string) => `pull:${t}`;
const BATCH = 200;
const PAGE = 1000;

async function getMeta<T>(key: string, def: T): Promise<T> {
  const m = await db.meta.get(key);
  return (m?.value as T) ?? def;
}
const setMeta = (key: string, value: unknown) => db.meta.put({ key, value });

/** Queue every local row (in FK order) the first time a user syncs on this device. */
export async function bootstrapOutbox(userId: string): Promise<number> {
  if ((await getMeta<string | null>("bootstrapped_for", null)) === userId) return 0;
  let n = 0;
  const at = nowIso();
  for (const t of topoOrder()) {
    if (!SYNC_TABLES.includes(t)) continue;
    const rows = (await db.table(t).toArray()) as BaseRow[];
    const mine = rows.map((r) => ({ ...r, user_id: userId }));
    if (!mine.length) continue;
    await db.table(t).bulkPut(mine);
    await db.outbox.bulkAdd(mine.map((r) => ({ table: t, row_id: r.id, at })));
    n += mine.length;
  }
  await setMeta("bootstrapped_for", userId);
  return n;
}

export async function push(remote: RemoteApi, userId: string | null): Promise<{ pushed: number; errors: string[] }> {
  const entries = await db.outbox.orderBy("seq").toArray();
  let pushed = 0;
  const errors: string[] = [];
  // Group consecutive entries by table to preserve parent-before-child order.
  const groups: { table: TableName; entries: OutboxEntry[] }[] = [];
  for (const e of entries) {
    const g = groups[groups.length - 1];
    if (g && g.table === e.table && g.entries.length < BATCH) g.entries.push(e);
    else groups.push({ table: e.table, entries: [e] });
  }
  for (const g of groups) {
    const ids = [...new Set(g.entries.map((e) => e.row_id))];
    const rows = ((await db.table(g.table).bulkGet(ids)) as (BaseRow | undefined)[]).filter((r): r is BaseRow => !!r);
    const payload = rows.map((r) => {
      const { synced_at: _s, ...rest } = r;
      return userId ? { ...rest, user_id: userId } : rest;
    });
    try {
      if (payload.length) await remote.upsert(g.table, payload as BaseRow[]);
      await db.outbox.bulkDelete(g.entries.map((e) => e.seq!));
      pushed += payload.length;
    } catch (err) {
      const msg = `push ${g.table}: ${(err as Error).message}`;
      errors.push(msg);
      await db.sync_log.add({ at: nowIso(), kind: "error", table: g.table, message: msg });
      break; // keep order: stop at the first failing group and retry later
    }
  }
  return { pushed, errors };
}

export async function pull(remote: RemoteApi): Promise<{ pulled: number; conflicts: number; errors: string[] }> {
  let pulled = 0;
  let conflicts = 0;
  const errors: string[] = [];
  const pending = new Set((await db.outbox.toArray()).map((e) => `${e.table}:${e.row_id}`));
  for (const t of topoOrder()) {
    if (!SYNC_TABLES.includes(t)) continue;
    let since = await getMeta<string | null>(PULL_KEY(t), null);
    try {
      for (;;) {
        const rows = await remote.pullSince(t, since, PAGE);
        if (!rows.length) break;
        const locals = (await db.table(t).bulkGet(rows.map((r) => r.id))) as (BaseRow | undefined)[];
        const toPut: BaseRow[] = [];
        rows.forEach((r, i) => {
          const l = locals[i];
          if (!l || r.updated_at >= l.updated_at) {
            if (l && pending.has(`${t}:${r.id}`) && r.updated_at > l.updated_at) {
              conflicts++;
              void db.sync_log.add({ at: nowIso(), kind: "conflict", table: t, row_id: r.id, message: "remote newer than unsynced local edit; remote kept" });
            }
            toPut.push(r);
          }
        });
        if (toPut.length) await db.table(t).bulkPut(toPut);
        pulled += toPut.length;
        since = rows[rows.length - 1].synced_at ?? since;
        await setMeta(PULL_KEY(t), since);
        if (rows.length < PAGE) break;
      }
    } catch (err) {
      errors.push(`pull ${t}: ${(err as Error).message}`);
    }
  }
  return { pulled, conflicts, errors };
}

export async function uploadBlobs(remote: RemoteApi, userId: string): Promise<number> {
  if (!remote.uploadBlob) return 0;
  const list = await db.blobs.where("uploaded").equals(0).toArray();
  let n = 0;
  for (const b of list) {
    const objectPath = b.path.split("/").slice(2).join("/");
    await remote.uploadBlob(b.bucket, `${userId}/${objectPath}`, b.blob, b.mime);
    await db.blobs.update(b.path, { uploaded: 1 });
    n++;
  }
  return n;
}

export async function syncOnce(remote: RemoteApi, userId: string): Promise<SyncResult> {
  await bootstrapOutbox(userId);
  const p = await push(remote, userId);
  let blobErr: string[] = [];
  try {
    await uploadBlobs(remote, userId);
  } catch (e) {
    blobErr = [`blobs: ${(e as Error).message}`];
  }
  const q = await pull(remote);
  await setMeta("last_sync_at", nowIso());
  return { pushed: p.pushed, pulled: q.pulled, conflicts: q.conflicts, errors: [...p.errors, ...blobErr, ...q.errors] };
}
