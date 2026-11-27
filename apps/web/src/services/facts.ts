import { useLiveQuery } from "dexie-react-hooks";
import { db } from "@/data/db";
import { buildFacts, FACT_TABLES, type DayFacts, type FactRows } from "@/domain/facts";
import { withDefaults } from "@/domain/targets";
import { range, type ISODate } from "@/lib/dates";
import { getSettings } from "./settings";

/** Load raw rows for facts (all live rows; data volume for one person is small). */
export async function loadFactRows(): Promise<FactRows> {
  const out = {} as Record<keyof FactRows, unknown[]>;
  await Promise.all(
    FACT_TABLES.map(async (t) => {
      out[t] = ((await db.table(t).toArray()) as { deleted_at: string | null }[]).filter((r) => !r.deleted_at);
    }),
  );
  return out as unknown as FactRows;
}

export async function loadFacts(from: ISODate, to: ISODate): Promise<{ facts: Map<ISODate, DayFacts>; examMode: boolean; targets: ReturnType<typeof withDefaults> }> {
  const [rows, s] = await Promise.all([loadFactRows(), getSettings()]);
  const targets = withDefaults(s?.targets);
  return { facts: buildFacts(range(from, to), rows, targets), examMode: !!s?.exam_mode, targets };
}

/** Live facts for a date range; recomputes on any write to the underlying tables. */
export function useFacts(from: ISODate, to: ISODate) {
  return useLiveQuery(() => loadFacts(from, to), [from, to]);
}
