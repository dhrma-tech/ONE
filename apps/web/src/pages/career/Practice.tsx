import { useEffect, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { Link } from "react-router-dom";
import { db } from "@/data/db";
import { repo } from "@/data/repo";
import { pretty, today } from "@/lib/dates";
import { award } from "@/services/xp";
import { refreshIfStale, refreshLeetcode, useLatest, useStatus } from "@/services/integrations";
import { useSettings } from "@/services/settings";
import { Button, Card, Chip, Empty, IconButton, Input, Pager, paginate, Select, StatCard, Switch, toast } from "@/ui";

const PLATFORMS = ["Exercism", "HackerRank", "py4e", "LeetCode", "Other"];

function LeetCodeCard() {
  const snap = useLatest("leetcode_snapshots");
  const st = useStatus("leetcode");
  const s = useSettings();
  const user = s?.usernames?.leetcode;
  useEffect(() => {
    if (user) void refreshIfStale("leetcode");
  }, [user]);
  const stale = snap && snap.date !== today();
  return (
    <Card className="span-5" eyebrow="Unofficial API · tracked, not worshipped" title="LeetCode" right={<>{stale || st?.status === "stale" ? <Chip tone="warn" dot>stale</Chip> : null}{user ? <IconButton icon="refresh" label="Refresh" onClick={() => void refreshLeetcode().then((ok) => toast[ok ? "ok" : "err"](ok ? "Updated." : "LeetCode didn't answer. Showing the last snapshot."))} /> : null}</>}>
      {!user ? (
        <Empty glyph="#">
          Set your LeetCode username in <Link to="/settings/profile" className="accent">Settings</Link>.
        </Empty>
      ) : (
        <>
          <div className="cols-4">
            <StatCard label="Easy" value={snap?.easy ?? null} />
            <StatCard label="Medium" value={snap?.medium ?? null} />
            <StatCard label="Hard" value={snap?.hard ?? null} />
            <StatCard label="Total" value={snap?.total ?? null} />
          </div>
          <p className="xs muted" style={{ marginTop: 10 }}>
            {snap ? `Ranking ${snap.ranking?.toLocaleString() ?? "—"} · as of ${pretty(snap.date)}` : "No snapshot yet."} It's one input, not the goal.
          </p>
        </>
      )}
    </Card>
  );
}

function ProblemLog() {
  const rows = useLiveQuery(async () => (await db.t("problem_log").toArray()).filter((r) => !r.deleted_at).sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : a.created_at < b.created_at ? 1 : -1)), []);
  const [f, setF] = useState({ platform: "Exercism", title: "", url: "", difficulty: "easy", minutes: "", stuck_min: "", solved: true, notes: "" });
  const [page, setPage] = useState(0);
  const { slice, pages } = paginate(rows ?? [], page, 15);
  return (
    <Card className="span-12" eyebrow="Stuck minutes feed the ladder" title="Problem log">
      <form
        className="form-grid"
        onSubmit={async (e) => {
          e.preventDefault();
          if (!f.title.trim()) return;
          const row = await repo.insert("problem_log", { date: today(), platform: f.platform, title: f.title.trim(), url: f.url || null, difficulty: f.difficulty, minutes: Number(f.minutes) || null, stuck_min: Number(f.stuck_min) || null, solved: f.solved, notes: f.notes || null });
          await award(f.solved ? "problem_solved" : "problem_logged", "career", "problem_log", row.id, { quiet: true });
          toast.ok(f.solved ? "Solved. Logged." : "Logged. Unsolved is still data.");
          setF({ ...f, title: "", url: "", minutes: "", stuck_min: "", notes: "" });
        }}
      >
        <Select label="Platform" value={f.platform} onChange={(e) => setF({ ...f, platform: e.target.value })} options={PLATFORMS.map((p) => ({ value: p, label: p }))} />
        <Input label="Problem" required value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} />
        <Input label="URL" type="url" value={f.url} onChange={(e) => setF({ ...f, url: e.target.value })} />
        <Select label="Difficulty" value={f.difficulty} onChange={(e) => setF({ ...f, difficulty: e.target.value })} options={["easy", "medium", "hard"].map((d) => ({ value: d, label: d }))} />
        <Input label="Minutes" inputMode="numeric" value={f.minutes} onChange={(e) => setF({ ...f, minutes: e.target.value })} />
        <Input label="Stuck min" inputMode="numeric" value={f.stuck_min} onChange={(e) => setF({ ...f, stuck_min: e.target.value })} />
        <Input label="Notes" value={f.notes} onChange={(e) => setF({ ...f, notes: e.target.value })} />
        <div className="field">
          <span className="label">Solved?</span>
          <Switch checked={f.solved} onChange={(v) => setF({ ...f, solved: v })} label={f.solved ? "Solved" : "Not yet"} />
        </div>
        <div className="field" style={{ justifyContent: "flex-end" }}>
          <Button type="submit" variant="accent" icon="plus">Log problem</Button>
        </div>
      </form>
      <div className="table-wrap" style={{ marginTop: 16 }}>
        {slice.length ? (
          <table className="table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Platform</th>
                <th>Problem</th>
                <th>Diff</th>
                <th>Min</th>
                <th>Stuck</th>
                <th>Solved</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {slice.map((r) => (
                <tr key={r.id}>
                  <td className="mono xs">{r.date}</td>
                  <td className="xs">{r.platform}</td>
                  <td>{r.url ? <a href={r.url} target="_blank" rel="noreferrer" className="accent">{r.title}</a> : r.title}</td>
                  <td className="xs">{r.difficulty}</td>
                  <td className="mono xs">{r.minutes ?? "—"}</td>
                  <td className="mono xs">{r.stuck_min ?? "—"}</td>
                  <td>{r.solved ? <Chip tone="ok">yes</Chip> : <Chip>no</Chip>}</td>
                  <td><IconButton icon="trash" size="sm" label="Delete" onClick={() => void repo.remove("problem_log", r.id)} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <Empty>No problems logged. That's either peace or avoidance.</Empty>
        )}
      </div>
      <Pager page={page} pages={pages} onPage={setPage} total={rows?.length} />
    </Card>
  );
}

export default function Practice() {
  return (
    <div className="bento">
      <LeetCodeCard />
      <Card className="span-7" eyebrow="Where the reps happen" title="Practice platforms">
        <div className="cols-3">
          {[
            ["Exercism", "Python track, mentored", "https://exercism.org/tracks/python"],
            ["HackerRank", "Python domain", "https://www.hackerrank.com/domains/python"],
            ["py4e", "Python for Everybody", "https://www.py4e.com/"],
          ].map(([n, d, u]) => (
            <a key={n} className="card pad-sm interactive" href={u} target="_blank" rel="noreferrer">
              <span className="small">{n} ↗</span>
              <br />
              <span className="xs muted">{d}</span>
            </a>
          ))}
        </div>
      </Card>
      <ProblemLog />
    </div>
  );
}
