import { useLiveQuery } from "dexie-react-hooks";
import { db } from "./db";
import type { TableName } from "./schema";
import type { Rows } from "./types.gen";

/** All live (not soft-deleted) rows of a table, optionally filtered. Re-renders on any write. */
export function useRows<K extends TableName>(
  table: K,
  filter?: (r: Rows[K]) => boolean,
  deps: unknown[] = [],
): Rows[K][] | undefined {
  return useLiveQuery(async () => {
    const all = (await db.t(table).toArray()) as Rows[K][];
    return all.filter((r) => !r.deleted_at && (!filter || filter(r)));
     
  }, [table, ...deps]);
}

/** Live rows where an indexed column equals a value. */
export function useWhere<K extends TableName>(table: K, index: string, value: string | number | null | undefined): Rows[K][] | undefined {
  return useLiveQuery(async () => {
    if (value === null || value === undefined) return [];
    const rows = (await db.table(table).where(index).equals(value).toArray()) as Rows[K][];
    return rows.filter((r) => !r.deleted_at);
  }, [table, index, value]);
}

/** First live row of a single-row table (profile, settings, body_targets). */
export function useSingle<K extends TableName>(table: K): Rows[K] | null | undefined {
  return useLiveQuery(async () => {
    const all = (await db.t(table).toArray()) as Rows[K][];
    return all.find((r) => !r.deleted_at) ?? null;
  }, [table]);
}

/** Generic live query passthrough. */
export const useLive = useLiveQuery;
