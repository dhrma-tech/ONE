// Sunday weekly review: the week's 9 checks + grade (live), top 3 wins/fails, next week's 3 priorities.
// Saves to weekly_grades, awards XP, mirrors to Obsidian.
import { useEffect, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "@/data/db";
import { repo } from "@/data/repo";
import { addDays, dow, pretty, today, weekStart } from "@/lib/dates";
import { useWeek } from "@/services/grade";
import { award } from "@/services/xp";
import { obsidian, useObsidian } from "@/modules/obsidian";
import { Banner, Button, Card, Chip, Input, StatCard, toast } from "@/ui";

const three = (a: string[] | undefined) => [0, 1, 2].map((i) => a?.[i] ?? "");

export default function WeeklyReview() {
  // On Sunday review this week; Monday-Saturday default to the week that just ended.
  const t = today();
  const [ws, setWs] = useState(dow(t) === 0 ? weekStart(t) : addDays(weekStart(t), -7));
  const w = useWeek(ws);
  const o = useObsidian();
  const saved = useLiveQuery(async () => (await db.t("weekly_grades").where("week_start").equals(ws).toArray()).find((g) => !g.deleted_at) ?? null, [ws]);
  const [wins, setWins] = useState(["", "", ""]);
  const [fails, setFails] = useState(["", "", ""]);
  const [prio, setPrio] = useState(["", "", ""]);
  useEffect(() => {
    setWins(three(saved?.wins));
    setFails(three(saved?.fails));
    setPrio(three(saved?.priorities));
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reset only when the saved row changes
  }, [saved?.id, saved?.updated_at]);

  const save = async () => {
    if (!w) return;
    const checks = Object.fromEntries(w.checks.map((c) => [c.key, c.pass]));
    await repo.upsertBy("weekly_grades", { week_start: ws }, { checks, grade: w.grade, wins: wins.filter(Boolean), fails: fails.filter(Boolean), priorities: prio.filter(Boolean), finalised_at: new Date().toISOString() });
    await award("weekly_review", "home", "weekly_grades", ws, { date: t });
    if (o.folder) await obsidian.mirrorAll().catch(() => undefined);
    toast.ok(`Week graded: ${w.grade}.`, w.rewardUnlocked ? "Episodes earned. Enjoy them." : "No episodes this week. Next week.");
  };

  const list = (label: string, v: string[], setV: (x: string[]) => void, ph: string) => (
    <div className="stack">
      <span className="micro">{label}</span>
      {v.map((x, i) => (
        <Input key={i} aria-label={`${label} ${i + 1}`} value={x} placeholder={i === 0 ? ph : ""} onChange={(e) => setV(v.map((y, j) => (j === i ? e.target.value : y)))} />
      ))}
    </div>
  );

  return (
    <div className="page" data-section="home">
      <Banner scene="home" label="Weekly review" />
      <div className="row wrap between">
        <h1 className="page-title">Week of {pretty(ws)}<span className="dot">.</span></h1>
        <div className="row">
          <Button size="sm" onClick={() => setWs(addDays(ws, -7))}>← Prev</Button>
          <Button size="sm" disabled={addDays(ws, 7) > t} onClick={() => setWs(addDays(ws, 7))}>Next →</Button>
        </div>
      </div>
      {w ? (
        <div className="bento">
          <Card className="span-4" title="Grade" eyebrow={saved?.finalised_at ? "finalised" : "live"}>
            <div className="row" style={{ gap: 20 }}>
              <span className={`grade grade-${w.grade}`} style={{ width: 88, height: 88, fontSize: 56 }}>{w.grade}</span>
              <StatCard label="Checks" value={w.score} unit="/9" />
            </div>
            <p className={`small ${w.rewardUnlocked ? "ok-text" : "muted"}`} style={{ marginTop: 12 }}>
              Reward rule: 2 episodes only with gym 3/3 + weigh-in + Block 1 ≥ 5/7. {w.rewardUnlocked ? "Unlocked." : "Locked."}
            </p>
          </Card>
          <Card className="span-8" title="9 checks">
            <ul className="list">
              {w.checks.map((c) => (
                <li key={c.key}>
                  <Chip tone={c.pass ? "ok" : "bad"}>{c.pass ? "pass" : "fail"}</Chip>
                  <span className="small grow">{c.label}</span>
                  <span className="mono xs muted">{c.detail}</span>
                </li>
              ))}
            </ul>
          </Card>
          <Card className="span-12" title="Reflect" eyebrow="Short lines. Then plan.">
            <div className="cols-3">
              {list("Top 3 wins", wins, setWins, "Shipped the JSON task manager")}
              {list("Top 3 fails", fails, setFails, "Skipped Block 1 on Thursday")}
              {list("Next week's 3 priorities", prio, setPrio, "PY4E Course 3 chapters 12-13")}
            </div>
            <div className="row" style={{ marginTop: 16 }}>
              <Button variant="primary" icon="check" onClick={() => void save()}>{saved?.finalised_at ? "Update review" : "Save weekly review"}</Button>
              <span className="xs muted">Mirrors to Obsidian{o.folder ? "" : " (choose a folder in Settings)"}.</span>
            </div>
          </Card>
        </div>
      ) : (
        <p className="micro">Grading…</p>
      )}
    </div>
  );
}
