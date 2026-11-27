// Write API. Every write stamps updated_at, goes to IndexedDB first and queues an outbox entry for sync.
import { db, defaultsFor } from "./db";
import type { TableName } from "./schema";
import type { Rows } from "./types.gen";

type Listener = () => void;
const listeners = new Set<Listener>();
/** Subscribe to local writes (the sync engine uses it to push soon after). */
export const onLocalWrite = (f: Listener) => {
  listeners.add(f);
  return () => listeners.delete(f);
};
const notify = () => listeners.forEach((f) => f());

let currentUserId: string | null = null;
export const setRepoUser = (uid: string | null) => {
  currentUserId = uid;
};

export const nowIso = () => new Date().toISOString();

export function uuid(): string {
  const c = globalThis.crypto as Crypto | undefined;
  if (c && typeof c.randomUUID === "function") return c.randomUUID();
  const b = new Uint8Array(16);
  if (c) c.getRandomValues(b);
  else for (let i = 0; i < 16; i++) b[i] = Math.floor(Math.random() * 256);
  b[6] = (b[6] & 0x0f) | 0x40;
  b[8] = (b[8] & 0x3f) | 0x80;
  const h = [...b].map((x) => x.toString(16).padStart(2, "0")).join("");
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}

/** Deterministic UUID for seed rows (same id on every device, so seeds merge instead of duplicating). */
export function seedId(key: string): string {
  // FNV-1a 32-bit, run four times with different salts → 128 bits, formatted as a v4-shaped UUID.
  const parts: string[] = [];
  for (let salt = 0; salt < 4; salt++) {
    let h = 0x811c9dc5 ^ salt;
    const s = `one:${salt}:${key}`;
    for (let i = 0; i < s.length; i++) {
      h ^= s.charCodeAt(i);
      h = Math.imul(h, 0x01000193) >>> 0;
    }
    parts.push(h.toString(16).padStart(8, "0"));
  }
  const hex = parts.join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-4${hex.slice(13, 16)}-${((parseInt(hex[16], 16) & 0x3) | 0x8).toString(16)}${hex.slice(17, 20)}-${hex.slice(20, 32)}`;
}

export type NewRow<K extends TableName> = Partial<Rows[K]>;

function build<K extends TableName>(table: K, values: NewRow<K>): Rows[K] {
  const now = nowIso();
  return {
    ...defaultsFor(table),
    ...values,
    id: values.id ?? uuid(),
    user_id: values.user_id ?? currentUserId,
    created_at: values.created_at ?? now,
    updated_at: now,
    deleted_at: values.deleted_at ?? null,
  } as unknown as Rows[K];
}

async function enqueue(table: TableName, ids: string[]) {
  const at = nowIso();
  await db.outbox.bulkAdd(ids.map((row_id) => ({ table, row_id, at })));
}

export const repo = {
  /** Insert a new row (defaults applied). Returns the row. */
  async insert<K extends TableName>(table: K, values: NewRow<K>): Promise<Rows[K]> {
    const row = build(table, values);
    await db.transaction("rw", db.table(table), db.outbox, async () => {
      await db.t(table).put(row);
      await enqueue(table, [row.id]);
    });
    notify();
    return row;
  },

  async insertMany<K extends TableName>(table: K, values: NewRow<K>[]): Promise<Rows[K][]> {
    const rows = values.map((v) => build(table, v));
    if (!rows.length) return rows;
    await db.transaction("rw", db.table(table), db.outbox, async () => {
      await db.t(table).bulkPut(rows);
      await enqueue(table, rows.map((r) => r.id));
    });
    notify();
    return rows;
  },

  /** Patch fields on an existing row. */
  async patch<K extends TableName>(table: K, id: string, changes: NewRow<K>): Promise<void> {
    await db.transaction("rw", db.table(table), db.outbox, async () => {
      const cur = await db.t(table).get(id);
      if (!cur) return;
      await db.t(table).put({ ...cur, ...changes, id, updated_at: nowIso() } as Rows[K]);
      await enqueue(table, [id]);
    });
    notify();
  },

  /** Soft delete (syncs as deleted_at). */
  async remove<K extends TableName>(table: K, id: string): Promise<void> {
    await repo.patch(table, id, { deleted_at: nowIso() } as NewRow<K>);
  },

  /**
   * Insert or update the row matching `match` (e.g. {date} for one-per-day tables).
   * Revives soft-deleted matches so unique keys stay unique.
   */
  async upsertBy<K extends TableName>(table: K, match: NewRow<K>, values: NewRow<K>): Promise<Rows[K]> {
    const all = (await db.t(table).toArray()) as Rows[K][];
    const keys = Object.entries(match) as [string, unknown][];
    const found = all.find((r) => keys.every(([k, v]) => (r as unknown as Record<string, unknown>)[k] === v));
    if (found) {
      const next = { ...found, ...values, deleted_at: null, updated_at: nowIso() } as Rows[K];
      await db.transaction("rw", db.table(table), db.outbox, async () => {
        await db.t(table).put(next);
        await enqueue(table, [found.id]);
      });
      notify();
      return next;
    }
    return repo.insert(table, { ...match, ...values });
  },

  /** Put rows exactly as given (used by seeding and imports). Keeps their updated_at. */
  async putRaw<K extends TableName>(table: K, rows: Rows[K][], queue = true): Promise<void> {
    if (!rows.length) return;
    await db.transaction("rw", db.table(table), db.outbox, async () => {
      await db.t(table).bulkPut(rows);
      if (queue) await enqueue(table, rows.map((r) => r.id));
    });
    notify();
  },

  build,
};

export const alive = <T extends { deleted_at?: string | null }>(r: T | undefined | null): r is T => !!r && !r.deleted_at;
