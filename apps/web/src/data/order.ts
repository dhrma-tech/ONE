import { TABLES, TABLE_NAMES, type Col, type TableDef, type TableName } from "./schema";

/** Tables ordered so referenced tables come first (for SQL creation and initial pushes). */
export function topoOrder(): TableName[] {
  const done = new Set<TableName>();
  const out: TableName[] = [];
  const visit = (t: TableName, stack: Set<TableName>) => {
    if (done.has(t)) return;
    if (stack.has(t)) throw new Error(`cycle at ${t}`);
    stack.add(t);
    for (const c of Object.values((TABLES[t] as TableDef).cols) as Col[]) if (c.ref && c.ref !== t) visit(c.ref as TableName, stack);
    stack.delete(t);
    done.add(t);
    out.push(t);
  };
  for (const t of TABLE_NAMES) visit(t, new Set());
  return out;
}
