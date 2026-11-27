// College logic: DBATU-style marks (theory CA20+MSE20+ESE60, practical CA60+ESE40), pass rules,
// grade points from an editable scale, SGPA/CGPA, and the 4-day milestone planner.
import { addDays, daysBetween, type ISODate } from "@/lib/dates";

export interface ScaleRow {
  min_pct: number;
  grade: string;
  points: number;
}

export interface MarksIn {
  kind: string; // theory | practical | audit
  credits: number | null;
  ca: number | null;
  mse: number | null;
  ese: number | null;
  has_ese: boolean;
  grade_point?: number | null; // manual override
}

export interface SubjectResult {
  total: number | null;
  max: number;
  pct: number | null;
  pass: boolean | null; // null = not enough marks yet
  grade: string | null;
  points: number | null;
  warn: string | null;
}

const MAX = { theory: { ca: 20, mse: 20, ese: 60 }, practical: { ca: 60, mse: 0, ese: 40 } };

export function gradeFor(pct: number, scale: ScaleRow[]): ScaleRow | null {
  return [...scale].sort((a, b) => b.min_pct - a.min_pct).find((r) => pct >= r.min_pct) ?? null;
}

export function subjectResult(m: MarksIn, scale: ScaleRow[]): SubjectResult {
  if (m.kind === "audit") return { total: null, max: 0, pct: null, pass: null, grade: null, points: null, warn: null };
  const k = m.kind === "practical" ? "practical" : "theory";
  const mx = MAX[k];
  const parts = [m.ca, k === "theory" ? m.mse : 0, m.has_ese ? m.ese : 0];
  const max = mx.ca + mx.mse + (m.has_ese ? mx.ese : 0);
  const known = parts.every((p) => p !== null && p !== undefined);
  const partial = parts.reduce<number>((a, p) => a + (p ?? 0), 0);
  // How much of the remaining ESE is needed for 40 overall (and 20/60 ESE for theory)
  if (!known) {
    let warn: string | null = null;
    if (m.has_ese && m.ese === null && m.ca !== null && (k === "practical" || m.mse !== null)) {
      const need = Math.max(k === "theory" ? 20 : 0, 40 - (m.ca ?? 0) - (k === "theory" ? (m.mse ?? 0) : 0));
      if (need > (k === "theory" ? 35 : 25)) warn = `Need ${need}/${mx.ese} in ESE to pass. Start now.`;
      else warn = `Need ${need}/${mx.ese} in ESE to pass.`;
    }
    return { total: null, max, pct: null, pass: null, grade: null, points: null, warn };
  }
  const total = partial;
  const pct = (total / max) * 100;
  const eseOk = k === "theory" && m.has_ese ? (m.ese ?? 0) >= 20 : true;
  const pass = pct >= 40 && eseOk;
  const g = pass ? gradeFor(pct, scale) : (scale.find((r) => r.points === 0) ?? { min_pct: 0, grade: "FF", points: 0 });
  let warn: string | null = null;
  if (!pass) warn = !eseOk ? "ESE below 20/60: fail regardless of total." : "Below 40%: fail.";
  else if (pct < 45 || (k === "theory" && m.has_ese && (m.ese ?? 0) < 24)) warn = "Close to failing. Too close.";
  const points = m.grade_point ?? g?.points ?? null;
  return { total, max, pct, pass, grade: g?.grade ?? null, points, warn };
}

/** Credit-weighted grade point average over subjects with credits and a result. */
export function gpa(rows: { credits: number | null; points: number | null }[]): number | null {
  const valid = rows.filter((r) => (r.credits ?? 0) > 0 && r.points !== null);
  const cr = valid.reduce((a, r) => a + (r.credits ?? 0), 0);
  if (!cr) return null;
  return Math.round((valid.reduce((a, r) => a + (r.credits ?? 0) * (r.points ?? 0), 0) / cr) * 100) / 100;
}

export interface PlanUnit {
  id: string;
  subject_id: string;
  number: number;
  importance: number; // 1 = most important
  examDate: ISODate | null;
}

export interface PlannedBlock {
  start_date: ISODate;
  end_date: ISODate;
  unit_ids: string[];
}

/**
 * 4-day milestone blocks with unit-level targets, from `from` until the last exam.
 * Units are ordered by their subject's exam date, then importance, then unit number,
 * and each unit lands in a block that ends before its subject's exam whenever possible.
 */
export function planMilestones(units: PlanUnit[], from: ISODate, blockDays = 4): PlannedBlock[] {
  const exams = units.map((u) => u.examDate).filter((d): d is ISODate => !!d && d > from);
  if (!units.length) return [];
  const lastExam = exams.length ? exams.sort().at(-1)! : addDays(from, 28);
  const span = Math.max(blockDays, daysBetween(from, lastExam));
  const nBlocks = Math.max(1, Math.ceil(span / blockDays));
  const blocks: PlannedBlock[] = Array.from({ length: nBlocks }, (_, i) => ({
    start_date: addDays(from, i * blockDays),
    end_date: addDays(from, Math.min(i * blockDays + blockDays - 1, span)),
    unit_ids: [],
  }));
  const ordered = [...units].sort(
    (a, b) => (a.examDate ?? "9999").localeCompare(b.examDate ?? "9999") || a.importance - b.importance || a.number - b.number,
  );
  const cap = Math.max(1, Math.ceil(ordered.length / nBlocks));
  for (const u of ordered) {
    const deadline = u.examDate ? addDays(u.examDate, -1) : lastExam;
    let target = blocks.find((b) => b.unit_ids.length < cap && b.end_date <= deadline);
    target ??= [...blocks].filter((b) => b.start_date <= deadline).sort((a, b) => a.unit_ids.length - b.unit_ids.length)[0];
    target ??= blocks[0];
    target.unit_ids.push(u.id);
  }
  return blocks.filter((b) => b.unit_ids.length);
}

/** Repeat frequency per unit from tagged PYQ questions → "most asked". */
export function mostAsked(questions: { unit_id?: string | null; repeat_count: number }[]): Map<string, number> {
  const m = new Map<string, number>();
  for (const q of questions) if (q.unit_id) m.set(q.unit_id, (m.get(q.unit_id) ?? 0) + Math.max(1, q.repeat_count));
  return m;
}
