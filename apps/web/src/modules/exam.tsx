// Exam-mode banner for Home: next exam countdown + today's milestone units.
import { useLiveQuery } from "dexie-react-hooks";
import { Link } from "react-router-dom";
import { db } from "@/data/db";
import { daysBetween, pretty, today } from "@/lib/dates";
import { Card, Chip, Countdown } from "@/ui";

export function useExamFocus() {
  return useLiveQuery(async () => {
    const t = today();
    const live = <T extends { deleted_at: string | null }>(x: T[]) => x.filter((r) => !r.deleted_at);
    const [exams, subjects, milestones, units] = await Promise.all([
      db.t("exams").toArray().then(live),
      db.t("subjects").toArray().then(live),
      db.t("milestones").toArray().then(live),
      db.t("units").toArray().then(live),
    ]);
    const sub = new Map(subjects.map((s) => [s.id, s]));
    const upcoming = exams.filter((e) => e.date >= t).sort((a, b) => (a.date < b.date ? -1 : 1));
    const block = milestones.find((m) => m.start_date <= t && m.end_date >= t);
    const unitMap = new Map(units.map((u) => [u.id, u]));
    const todayUnits = ((block?.targets as string[] | undefined) ?? [])
      .map((id) => unitMap.get(id))
      .filter((u): u is NonNullable<typeof u> => !!u && u.status !== "cracked")
      .map((u) => ({ id: u.id, label: `${sub.get(u.subject_id)?.name ?? "Subject"} · U${u.number}${u.title ? ` ${u.title}` : ""}` }));
    return { next: upcoming[0] ? { ...upcoming[0], subject: sub.get(upcoming[0].subject_id)?.name ?? "Exam" } : null, upcoming: upcoming.length, todayUnits, block };
  }, []);
}

export function ExamBanner() {
  const x = useExamFocus();
  if (!x) return null;
  return (
    <Card className="span-12 exam-banner" edge eyebrow="Exam mode" title={x.next ? `${x.next.subject} in ${daysBetween(today(), x.next.date)} days` : "Exam mode is on"} right={<Link to="/career/college" className="pill">College →</Link>}>
      <div className="row wrap" data-section="career">
        {x.next ? (
          <span className="small">
            {pretty(x.next.date)} · <Countdown to={new Date(`${x.next.date}T${x.next.start_time ?? "10:00"}:00+05:30`)} /> · {x.upcoming} papers left
          </span>
        ) : (
          <span className="small muted">Add exam dates in College to get a countdown.</span>
        )}
      </div>
      <div className="row wrap" style={{ marginTop: 10 }}>
        <span className="micro">Today's units</span>
        {x.todayUnits.length ? x.todayUnits.map((u) => <Chip key={u.id} on>{u.label}</Chip>) : <span className="xs muted">No milestone block covers today.</span>}
      </div>
    </Card>
  );
}
