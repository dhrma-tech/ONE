// Local-first store: Dexie tables mirror the Postgres tables 1:1, plus sync bookkeeping tables.
import Dexie, { type Table } from "dexie";
import { SYNC_TABLES, TABLES, dexieStore, type Col, type TableDef, type TableName } from "./schema";
import type { Rows } from "./types.gen";

export interface OutboxEntry {
  seq?: number;
  table: TableName;
  row_id: string;
  at: string;
}
export interface MetaEntry {
  key: string;
  value: unknown;
}
export interface BlobEntry {
  path: string; // "<bucket>/<user-or-local>/<file>"
  bucket: string;
  blob: Blob;
  mime: string;
  uploaded: 0 | 1;
  created_at: string;
}
export interface SyncLogEntry {
  id?: number;
  at: string;
  kind: "conflict" | "error" | "info";
  table?: string;
  row_id?: string;
  message: string;
}

type DataTables = { [K in TableName]: Table<Rows[K], string> };

export class OneDB extends Dexie {
  outbox!: Table<OutboxEntry, number>;
  meta!: Table<MetaEntry, string>;
  blobs!: Table<BlobEntry, string>;
  sync_log!: Table<SyncLogEntry, number>;

  constructor(name = "one") {
    super(name);
    const stores: Record<string, string> = {
      outbox: "++seq, table, row_id",
      meta: "key",
      blobs: "path, uploaded",
      sync_log: "++id, at",
    };
    for (const t of SYNC_TABLES) stores[t] = dexieStore(t);
    this.version(1).stores(stores);
  }

  /** Typed table accessor. */
  t<K extends TableName>(name: K): DataTables[K] {
    return this.table(name) as unknown as DataTables[K];
  }
}

export const db = new OneDB();

/** Parse a SQL default expression into a JS value for new local rows. */
export function sqlDefault(c: Col): unknown {
  const d = c.def;
  if (d === undefined) return null;
  if (d === "now()") return new Date().toISOString();
  if (d === "true" || d === "false") return d === "true";
  if (/^-?\d+(\.\d+)?$/.test(d)) return Number(d);
  const json = d.match(/^'(.*)'::jsonb$/);
  if (json) return JSON.parse(json[1]);
  const str = d.match(/^'(.*)'$/);
  if (str) {
    const v = str[1].replace(/''/g, "'");
    if (c.t === "text[]" || c.t === "int[]") {
      const inner = v.replace(/^\{|\}$/g, "");
      const parts = inner ? inner.split(",") : [];
      return c.t === "int[]" ? parts.map(Number) : parts;
    }
    return v;
  }
  return null;
}

export function defaultsFor(t: TableName): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, c] of Object.entries((TABLES[t] as TableDef).cols) as [string, Col][]) {
    const v = sqlDefault(c);
    if (v !== null) out[k] = v;
  }
  return out;
}
