import { useEffect, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "@/data/db";
import { repo } from "@/data/repo";
import type { Rows } from "@/data/types.gen";
import { pretty, today, daysBetween } from "@/lib/dates";
import { refreshGithub, refreshIfStale, useLatest, useStatus } from "@/services/integrations";
import { Button, Card, Chip, ContributionGrid, Empty, IconButton, Input, Modal, Pager, paginate, Select, StatCard, Textarea, toast, type GridDay } from "@/ui";

const COLS = [
  { id: "idea", label: "Idea" },
  { id: "building", label: "Building" },
  { id: "shipped", label: "Shipped" },
  { id: "paused", label: "Paused" },
];

function Projects() {
  const rows = useLiveQuery(async () => (await db.t("projects").toArray()).filter((r) => !r.deleted_at).sort((a, b) => a.order_no - b.order_no), []);
  const [edit, setEdit] = useState<Partial<Rows["projects"]> | null>(null);
  const move = (p: Rows["projects"], dir: -1 | 1) => {
    const i = COLS.findIndex((c) => c.id === p.status);
    const n = COLS[i + dir];
    if (n) void repo.patch("projects", p.id, { status: n.id });
  };
  return (
    <Card className="span-12" eyebrow="Build focus: Rocky" title="Projects" right={<Button size="sm" icon="plus" onClick={() => setEdit({ status: "idea", name: "" })}>Project</Button>}>
      <div className="kanban">
        {COLS.map((c) => (
          <div key={c.id} className="stack">
            <span className="micro">
              {c.label} · {(rows ?? []).filter((p) => p.status === c.id).length}
            </span>
            {(rows ?? [])
              .filter((p) => p.status === c.id)
              .map((p) => (
                <div key={p.id} className="card pad-sm accent-edge">
                  <div className="row between">
                    <button type="button" className="small" style={{ textAlign: "left" }} onClick={() => setEdit(p)}>
                      {p.name}
                    </button>
                    <span className="row" style={{ gap: 0 }}>
                      <IconButton icon="arrowLeft" size="sm" label="Move left" onClick={() => move(p, -1)} disabled={c.id === "idea"} />
                      <IconButton icon="arrow" size="sm" label="Move right" onClick={() => move(p, 1)} disabled={c.id === "paused"} />
                    </span>
                  </div>
                  {p.notes ? <p className="xs muted text">{p.notes}</p> : null}
                  {p.repo ? <a className="xs accent" href={p.repo} target="_blank" rel="noreferrer">repo ↗</a> : null}
                </div>
              ))}
          </div>
        ))}
      </div>
      <Modal open={!!edit} onClose={() => setEdit(null)} title={edit?.id ? "Edit project" : "New project"}>
        {edit ? (
          <form
            className="stack"
            onSubmit={async (e) => {
              e.preventDefault();
              if (!edit.name?.trim()) return;
              if (edit.id) await repo.patch("projects", edit.id, edit);
              else await repo.insert("projects", { ...edit, order_no: (rows?.length ?? 0) + 1 });
              setEdit(null);
            }}
          >
            <Input label="Name" value={edit.name ?? ""} onChange={(e) => setEdit({ ...edit, name: e.target.value })} />
            <Input label="Repo URL" value={edit.repo ?? ""} onChange={(e) => setEdit({ ...edit, repo: e.target.value })} />
            <Select label="Status" value={edit.status ?? "idea"} onChange={(e) => setEdit({ ...edit, status: e.target.value })} options={COLS.map((c) => ({ value: c.id, label: c.label }))} />
            <Textarea label="Notes" value={edit.notes ?? ""} onChange={(e) => setEdit({ ...edit, notes: e.target.value })} />
            <div className="row">
              <Button type="submit" variant="primary">Save</Button>
              {edit.id ? <Button variant="danger" onClick={async () => { await repo.remove("projects", edit.id!); setEdit(null); }}>Delete</Button> : null}
            </div>
          </form>
        ) : null}
      </Modal>
    </Card>
  );
}

/** GitHub contribution counts → levels 0-4 by quartiles of non-zero days. */
export function contribLevels(cal: { date: string; count: number }[]): GridDay[] {
  const nz = cal.map((d) => d.count).filter((c) => c > 0).sort((a, b) => a - b);
  const q = (p: number) => nz[Math.min(nz.length - 1, Math.floor(p * nz.length))] ?? 1;
  const [q1, q2, q3] = [q(0.25), q(0.5), q(0.75)];
  return cal.map((d) => ({ date: d.date, level: (d.count === 0 ? 0 : d.count <= q1 ? 1 : d.count <= q2 ? 2 : d.count <= q3 ? 3 : 4) as GridDay["level"], note: `${d.count} contribution${d.count === 1 ? "" : "s"}` }));
}

function GitHub() {
  const snap = useLatest("github_snapshots");
  const st = useStatus("github");
  useEffect(() => {
    void refreshIfStale("github");
  }, []);
  const cal = (snap?.calendar as { date: string; count: number }[] | undefined) ?? [];
  return (
    <Card className="span-12" eyebrow="dhrma-tech · real pushes only" title="GitHub" right={<>{st?.status === "off" ? <Chip>token needed</Chip> : snap && snap.date !== today() ? <Chip tone="warn" dot>stale</Chip> : null}<IconButton icon="refresh" label="Refresh" onClick={() => void refreshGithub().then((ok) => toast[ok ? "ok" : "err"](ok ? "Updated." : "GitHub unreachable or no token yet."))} /></>}>
      <div className="cols-4" style={{ marginBottom: 16 }}>
        <StatCard label="Pushes today" value={snap?.pushes_today ?? null} />
        <StatCard label="Pushes this week" value={(st?.meta as { pushes_week?: number } | undefined)?.pushes_week ?? null} />
        <StatCard label="Contributions (year)" value={snap?.contributions ?? null} />
      </div>
      {cal.length ? <ContributionGrid days={contribLevels(cal)} label="GitHub contributions" summary={`${snap?.contributions ?? 0} contributions in the last year`} /> : <Empty glyph="⌥">No GitHub data yet. Add GITHUB_TOKEN (see NEEDS-FROM-DHARMA) and hit refresh.</Empty>}
    </Card>
  );
}

function Ideas() {
  const rows = useLiveQuery(async () => (await db.t("website_ideas").toArray()).filter((r) => !r.deleted_at).sort((a, b) => (a.created_at < b.created_at ? 1 : -1)), []);
  const [t, setT] = useState("");
  const [d, setD] = useState("");
  const [page, setPage] = useState(0);
  const { slice, pages } = paginate(rows ?? [], page, 10);
  return (
    <Card className="span-6" eyebrow="Quick add, same as the Notion habit" title="Website ideas">
      <form
        className="stack"
        onSubmit={(e) => {
          e.preventDefault();
          if (!t.trim()) return;
          void repo.insert("website_ideas", { title: t.trim(), description: d || null, idea_date: today() });
          setT("");
          setD("");
          toast.ok("Idea saved. Validate before building.");
        }}
      >
        <Input aria-label="Idea title" placeholder="Idea title" value={t} onChange={(e) => setT(e.target.value)} />
        <Input aria-label="Description" placeholder="One line: who is it for, why now?" value={d} onChange={(e) => setD(e.target.value)} />
        <Button type="submit" size="sm" icon="plus">Add idea</Button>
      </form>
      <ul className="list" style={{ marginTop: 12 }}>
        {slice.map((r) => (
          <li key={r.id}>
            <span className="stack tight grow" style={{ minWidth: 0 }}>
              <span className="small">{r.title}</span>
              {r.description ? <span className="xs muted text">{r.description}</span> : null}
            </span>
            <Select aria-label="Status" value={r.status} onChange={(e) => void repo.patch("website_ideas", r.id, { status: e.target.value })} options={["idea", "validating", "building", "dropped"].map((s) => ({ value: s, label: s }))} style={{ width: 120, minHeight: 30 }} />
            <IconButton icon="trash" size="sm" label="Delete idea" onClick={() => void repo.remove("website_ideas", r.id)} />
          </li>
        ))}
      </ul>
      {!rows?.length ? <Empty>No ideas yet. Shower thoughts welcome.</Empty> : null}
      <Pager page={page} pages={pages} onPage={setPage} total={rows?.length} />
    </Card>
  );
}

function Hackathons() {
  const rows = useLiveQuery(async () => (await db.t("hackathons").toArray()).filter((r) => !r.deleted_at).sort((a, b) => (a.deadline ?? "9999").localeCompare(b.deadline ?? "9999")), []);
  const [edit, setEdit] = useState<Partial<Rows["hackathons"]> | null>(null);
  const [page, setPage] = useState(0);
  const { slice, pages } = paginate(rows ?? [], page, 10);
  return (
    <Card className="span-6" eyebrow="Deadlines go to the ONE calendar" title="Hackathons" right={<Button size="sm" icon="plus" onClick={() => setEdit({ status: "interested" })}>Add</Button>}>
      <ul className="list">
        {slice.map((h) => (
          <li key={h.id}>
            <button type="button" className="stack tight grow" style={{ textAlign: "left", minWidth: 0 }} onClick={() => setEdit(h)}>
              <span className="small truncate">{h.name}</span>
              <span className="xs muted">
                {h.deadline ? `deadline ${pretty(h.deadline)} (${daysBetween(today(), h.deadline)}d)` : "no deadline"} · {h.status}
              </span>
            </button>
            {h.needs_details ? <Chip tone="warn">needs details</Chip> : null}
            {h.url ? <a className="icon-btn sm" href={h.url} target="_blank" rel="noreferrer" aria-label="Open link">↗</a> : null}
          </li>
        ))}
      </ul>
      {!rows?.length ? <Empty>No hackathons. Time to find one.</Empty> : null}
      <Pager page={page} pages={pages} onPage={setPage} total={rows?.length} />
      <Modal open={!!edit} onClose={() => setEdit(null)} title={edit?.id ? "Edit hackathon" : "New hackathon"}>
        {edit ? (
          <form
            className="stack"
            onSubmit={async (e) => {
              e.preventDefault();
              if (!edit.name?.trim()) return;
              const v = { ...edit, needs_details: false };
              if (edit.id) await repo.patch("hackathons", edit.id, v);
              else await repo.insert("hackathons", v);
              setEdit(null);
            }}
          >
            <Input label="Name" value={edit.name ?? ""} onChange={(e) => setEdit({ ...edit, name: e.target.value })} />
            <Input label="Link" type="url" value={edit.url ?? ""} onChange={(e) => setEdit({ ...edit, url: e.target.value })} />
            <div className="form-grid">
              <Input label="Start" type="date" value={edit.start_date ?? ""} onChange={(e) => setEdit({ ...edit, start_date: e.target.value || null })} />
              <Input label="End" type="date" value={edit.end_date ?? ""} onChange={(e) => setEdit({ ...edit, end_date: e.target.value || null })} />
              <Input label="Deadline" type="date" value={edit.deadline ?? ""} onChange={(e) => setEdit({ ...edit, deadline: e.target.value || null })} />
              <Select label="Status" value={edit.status ?? "interested"} onChange={(e) => setEdit({ ...edit, status: e.target.value })} options={["interested", "applied", "building", "submitted", "done", "skipped"].map((s) => ({ value: s, label: s }))} />
            </div>
            <Input label="Team" value={edit.team ?? ""} onChange={(e) => setEdit({ ...edit, team: e.target.value })} />
            <Textarea label="Notes" value={edit.notes ?? ""} onChange={(e) => setEdit({ ...edit, notes: e.target.value })} />
            <div className="row">
              <Button type="submit" variant="primary">Save</Button>
              {edit.id ? <Button variant="danger" onClick={async () => { await repo.remove("hackathons", edit.id!); setEdit(null); }}>Delete</Button> : null}
            </div>
          </form>
        ) : null}
      </Modal>
    </Card>
  );
}

export default function Build() {
  return (
    <div className="bento">
      <Projects />
      <GitHub />
      <Ideas />
      <Hackathons />
    </div>
  );
}
