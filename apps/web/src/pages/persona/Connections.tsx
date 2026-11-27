// Connections: mini contact tracker. Tier A-D, Request sent → Accepted → Talked, follow-up 2-3 days after
// accepted (shows up in Today). No LinkedIn automation. Imported rows keep verified=false.
import { useMemo, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "@/data/db";
import { repo } from "@/data/repo";
import type { Rows } from "@/data/types.gen";
import { FOLLOW_UP_QUESTIONS, TIERS } from "@/domain/persona";
import { followUpDate } from "@/domain/taskgen";
import { pretty, today } from "@/lib/dates";
import { useTargets } from "@/services/settings";
import { award } from "@/services/xp";
import { Button, Card, Chip, Empty, IconButton, Input, Modal, Pager, paginate, Select, StatCard, Textarea, toast } from "@/ui";

const STATUSES = ["sent", "accepted", "talked"];

export default function Connections() {
  const t = useTargets();
  const rows = useLiveQuery(async () => (await db.t("contacts").toArray()).filter((r) => !r.deleted_at).sort((a, b) => (a.updated_at < b.updated_at ? 1 : -1)), []);
  const [q, setQ] = useState("");
  const [status, setStatus] = useState<string>("all");
  const [tier, setTier] = useState<string>("all");
  const [page, setPage] = useState(0);
  const [edit, setEdit] = useState<Partial<Rows["contacts"]> | null>(null);
  const d = today();
  const list = useMemo(
    () => (rows ?? []).filter((r) => (status === "all" || r.status === status) && (tier === "all" || r.tier === tier) && (!q || `${r.name} ${r.company ?? ""} ${r.title ?? ""}`.toLowerCase().includes(q.toLowerCase()))),
    [rows, status, tier, q],
  );
  const { slice, pages } = paginate(list, page, 20);
  const sentToday = (rows ?? []).filter((r) => r.sent_at === d).length;
  const due = (rows ?? []).filter((r) => r.status === "accepted" && r.follow_up_at && r.follow_up_at <= d);

  const setStat = async (c: Rows["contacts"], s: string) => {
    const p: Partial<Rows["contacts"]> = { status: s };
    if (s === "accepted" && !c.accepted_at) Object.assign(p, { accepted_at: d, follow_up_at: followUpDate(d) });
    if (s === "talked" && !c.talked_at) Object.assign(p, { talked_at: d, follow_up_at: null });
    await repo.patch("contacts", c.id, p);
    if (s === "talked") await award("contact_talked", "persona", "contacts", c.id);
  };

  return (
    <div className="bento">
      <Card className="span-4" title="Today" eyebrow={`Target ~${t.outreach_per_day} (6 A · 3 B · 1 C) + ${t.companies_per_day} companies`}>
        <div className="cols-2">
          <StatCard label="Sent today" value={sentToday} unit={`/${t.outreach_per_day}`} />
          <StatCard label="Follow-ups due" value={due.length} />
          <StatCard label="Accepted" value={(rows ?? []).filter((r) => r.status !== "sent").length} />
          <StatCard label="Talked" value={(rows ?? []).filter((r) => r.status === "talked").length} />
        </div>
        <Button variant="accent" icon="plus" block onClick={() => setEdit({ status: "sent", tier: "A", sent_at: d, verified: true })}>
          Log a request
        </Button>
        <p className="xs muted" style={{ marginTop: 8 }}>Cap: if this passes 30 min a day, cut companies first.</p>
      </Card>
      <Card className="span-8" title="Message rules" edge eyebrow="Sticky">
        <ul className="text small" style={{ paddingLeft: 18, margin: 0, lineHeight: 1.8 }}>
          <li>1-2 sentences, max 50 words. Genuine curiosity. Vary the opening.</li>
          <li>Never mention jobs or internships. Respectful tone.</li>
          <li>Follow-up 2-3 days after "Accepted": one specific question about their work.</li>
        </ul>
        <div className="row wrap" style={{ marginTop: 10 }}>
          {FOLLOW_UP_QUESTIONS.map((x) => (
            <Chip key={x} onClick={() => void navigator.clipboard?.writeText(x).then(() => toast.ok("Copied."))}>{x}</Chip>
          ))}
        </div>
      </Card>
      {due.length ? (
        <Card className="span-12" title="Follow up now" eyebrow="Ask about their work">
          <ul className="list">
            {due.map((c) => (
              <li key={c.id}>
                <span className="small grow">{c.name} <span className="xs muted">· {c.title} @ {c.company}</span></span>
                {c.linkedin_url ? <a className="icon-btn sm" href={c.linkedin_url} target="_blank" rel="noreferrer" aria-label="Open LinkedIn">↗</a> : null}
                <Button size="sm" onClick={() => void repo.patch("contacts", c.id, { follow_up_at: null })}>Asked</Button>
                <Button size="sm" variant="accent" onClick={() => void setStat(c, "talked")}>Talked</Button>
              </li>
            ))}
          </ul>
        </Card>
      ) : null}
      <Card className="span-12" title={`Contacts · ${list.length}`}>
        <div className="row wrap" style={{ marginBottom: 8 }}>
          <Input aria-label="Search contacts" placeholder="Search name, company…" value={q} onChange={(e) => { setQ(e.target.value); setPage(0); }} style={{ maxWidth: 260 }} />
          <Select aria-label="Status" value={status} onChange={(e) => { setStatus(e.target.value); setPage(0); }} options={[{ value: "all", label: "All statuses" }, ...STATUSES.map((s) => ({ value: s, label: s }))]} style={{ width: 150 }} />
          <Select aria-label="Tier" value={tier} onChange={(e) => { setTier(e.target.value); setPage(0); }} options={[{ value: "all", label: "All tiers" }, ...Object.entries(TIERS).map(([k, v]) => ({ value: k, label: `${k} · ${v.split(" (")[0]}` }))]} style={{ width: 210 }} />
        </div>
        <div className="table-wrap">
          <table className="table">
            <thead><tr><th>Name</th><th>Company</th><th>Tier</th><th>Status</th><th>Sent</th><th /></tr></thead>
            <tbody>
              {slice.map((c) => (
                <tr key={c.id}>
                  <td>
                    <button type="button" className="small" style={{ textAlign: "left" }} onClick={() => setEdit(c)}>{c.name}</button>
                    {!c.verified ? <Chip tone="warn" title="URL not verified">unverified</Chip> : null}
                    <br /><span className="xs muted">{c.title}</span>
                  </td>
                  <td className="xs">{c.company}</td>
                  <td><Chip>{c.tier ?? "—"}</Chip></td>
                  <td><Select aria-label={`${c.name} status`} value={c.status} onChange={(e) => void setStat(c, e.target.value)} options={STATUSES.map((s) => ({ value: s, label: s }))} style={{ width: 120, minHeight: 30 }} /></td>
                  <td className="mono xs">{c.sent_at ? pretty(c.sent_at) : "—"}</td>
                  <td>{c.linkedin_url ? <a className="icon-btn sm" href={c.linkedin_url} target="_blank" rel="noreferrer" aria-label="Open LinkedIn profile">↗</a> : null}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {!list.length ? <Empty>No contacts match. Import the Notion tracker or log a request.</Empty> : null}
        <Pager page={page} pages={pages} onPage={setPage} total={list.length} />
      </Card>
      <Modal open={!!edit} onClose={() => setEdit(null)} title={edit?.id ? "Contact" : "New request"}>
        {edit ? (
          <form
            className="stack"
            onSubmit={async (e) => {
              e.preventDefault();
              if (!edit.name?.trim()) return;
              if (edit.id) await repo.patch("contacts", edit.id, edit);
              else {
                await repo.insert("contacts", edit);
                const sent = (rows ?? []).filter((r) => r.sent_at === d).length + 1;
                if (sent >= t.outreach_per_day) await award("outreach_day", "persona", "outreach", d, { quiet: true });
                await repo.upsertBy("persona_daily", { date: d }, { outreach_done: true });
              }
              setEdit(null);
            }}
          >
            <div className="form-grid">
              <Input label="Name" required value={edit.name ?? ""} onChange={(e) => setEdit({ ...edit, name: e.target.value })} />
              <Input label="Title" value={edit.title ?? ""} onChange={(e) => setEdit({ ...edit, title: e.target.value })} />
              <Input label="Company" value={edit.company ?? ""} onChange={(e) => setEdit({ ...edit, company: e.target.value })} />
              <Select label="Tier" value={edit.tier ?? "A"} onChange={(e) => setEdit({ ...edit, tier: e.target.value })} options={Object.entries(TIERS).map(([k, v]) => ({ value: k, label: `${k} · ${v}` }))} />
            </div>
            <Input label="LinkedIn URL" type="url" value={edit.linkedin_url ?? ""} onChange={(e) => setEdit({ ...edit, linkedin_url: e.target.value, verified: true })} />
            {edit.tier === "D" ? <p className="notice small">Tier D: follow only. Never message.</p> : null}
            <Textarea label="Notes" rows={2} value={edit.notes ?? ""} onChange={(e) => setEdit({ ...edit, notes: e.target.value })} />
            <div className="row">
              <Button type="submit" variant="primary">Save</Button>
              {edit.id ? <IconButton icon="trash" label="Delete contact" onClick={async () => { await repo.remove("contacts", edit.id!); setEdit(null); }} /> : null}
            </div>
          </form>
        ) : null}
      </Modal>
    </div>
  );
}
