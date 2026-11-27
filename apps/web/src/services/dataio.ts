// JSON export/import of everything (local copy). Media blobs are not included (they stay in private storage).
import { db } from "@/data/db";
import { repo } from "@/data/repo";
import { SYNC_TABLES, type TableName } from "@/data/schema";
import { topoOrder } from "@/data/order";
import type { Rows } from "@/data/types.gen";
import { auth } from "@/data/supabase";

export interface ExportFile {
  app: "one";
  v: 1;
  exported_at: string;
  tables: Partial<Record<TableName, unknown[]>>;
}

export async function exportAll(): Promise<ExportFile> {
  const tables: ExportFile["tables"] = {};
  for (const t of SYNC_TABLES) tables[t] = await db.table(t).toArray();
  return { app: "one", v: 1, exported_at: new Date().toISOString(), tables };
}

export function downloadJson(data: unknown, name: string) {
  const blob = new Blob([JSON.stringify(data, null, 1)], { type: "application/json" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}

export function validateExport(j: unknown): ExportFile {
  const f = j as Partial<ExportFile>;
  if (!f || f.app !== "one" || f.v !== 1 || typeof f.tables !== "object" || !f.tables) throw new Error("Not a ONE export file.");
  for (const [t, rows] of Object.entries(f.tables)) {
    if (!SYNC_TABLES.includes(t as TableName)) throw new Error(`Unknown table "${t}".`);
    if (!Array.isArray(rows) || rows.some((r) => !r || typeof (r as { id?: unknown }).id !== "string")) throw new Error(`Bad rows in "${t}".`);
  }
  return f as ExportFile;
}

/** Merge an export into local data (newer updated_at wins per row) and queue it for sync. */
export async function importAll(j: unknown): Promise<number> {
  const f = validateExport(j);
  const uid = auth.get().userId;
  let n = 0;
  for (const t of topoOrder()) {
    const rows = (f.tables[t] ?? []) as Rows[typeof t][];
    if (!rows.length) continue;
    const local = new Map(((await db.table(t).bulkGet(rows.map((r) => r.id))) as (Rows[typeof t] | undefined)[]).filter(Boolean).map((r) => [r!.id, r!]));
    const next = rows.filter((r) => !local.has(r.id) || local.get(r.id)!.updated_at <= r.updated_at).map((r) => ({ ...r, user_id: uid ?? r.user_id ?? null }));
    await repo.putRaw(t, next as never);
    n += next.length;
  }
  return n;
}
