// Reading list: save URLs (title fetched server-side). A one-line takeaway is required before marking read.
import { useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "@/data/db";
import { repo } from "@/data/repo";
import type { Rows } from "@/data/types.gen";
import { api } from "@/lib/api";
import { Button, Card, Empty, IconButton, Input, Modal, Pager, paginate, Tabs, toast } from "@/ui";

export default function Reading() {
  const rows = useLiveQuery(async () => (await db.t("reading_list").toArray()).filter((r) => !r.deleted_at).sort((a, b) => (a.saved_at < b.saved_at ? 1 : -1)), []);
  const [url, setUrl] = useState("");
  const [tab, setTab] = useState("unread");
  const [page, setPage] = useState(0);
  const [closing, setClosing] = useState<Rows["reading_list"] | null>(null);
  const [take, setTake] = useState("");
  const list = (rows ?? []).filter((r) => (tab === "unread" ? !r.read_at : !!r.read_at));
  const { slice, pages } = paginate(list, page, 12);
  return (
    <Card eyebrow="Takeaway or it didn't happen" title="Reading list">
      <form
        className="row"
        onSubmit={async (e) => {
          e.preventDefault();
          let u: URL;
          try {
            u = new URL(url.trim());
          } catch {
            return void toast.err("That's not a URL.");
          }
          let title = u.hostname;
          try {
            title = (await api.get<{ title: string }>(`/api/link-title?url=${encodeURIComponent(u.toString())}`)).title || title;
          } catch {
            /* keep hostname */
          }
          await repo.insert("reading_list", { url: u.toString(), title });
          setUrl("");
          toast.ok("Saved.");
        }}
      >
        <Input aria-label="Article URL" type="url" placeholder="Paste an article URL…" value={url} onChange={(e) => setUrl(e.target.value)} />
        <Button type="submit" icon="plus">Save</Button>
      </form>
      <div style={{ marginTop: 12 }}>
        <Tabs label="Reading views" value={tab} onChange={(t) => { setTab(t); setPage(0); }} tabs={[{ id: "unread", label: `To read ${(rows ?? []).filter((r) => !r.read_at).length}` }, { id: "read", label: "Read" }]} />
      </div>
      <ul className="list">
        {slice.map((r) => (
          <li key={r.id}>
            <span className="stack tight grow" style={{ minWidth: 0 }}>
              <a className="small truncate" href={r.url} target="_blank" rel="noopener noreferrer">{r.title ?? r.url}</a>
              {r.takeaway ? <span className="xs muted text">→ {r.takeaway}</span> : null}
            </span>
            {!r.read_at ? <Button size="sm" onClick={() => { setClosing(r); setTake(""); }}>Mark read</Button> : null}
            <IconButton icon="trash" size="sm" label="Delete" onClick={() => void repo.remove("reading_list", r.id)} />
          </li>
        ))}
      </ul>
      {!list.length ? <Empty>{tab === "unread" ? "Nothing queued. Reading list zero." : "Nothing read yet."}</Empty> : null}
      <Pager page={page} pages={pages} onPage={setPage} total={list.length} />
      <Modal open={!!closing} onClose={() => setClosing(null)} title="One-line takeaway">
        <form
          className="stack"
          onSubmit={async (e) => {
            e.preventDefault();
            if (take.trim().length < 8) return void toast.err("One real line, please.");
            await repo.patch("reading_list", closing!.id, { read_at: new Date().toISOString(), takeaway: take.trim() });
            await repo.insert("post_ideas", { text: take.trim(), source_table: "reading_list", source_id: closing!.id, stage: "note" });
            setClosing(null);
            toast.ok("Read. Takeaway also went to the Ideas bank.");
          }}
        >
          <p className="small muted">{closing?.title}</p>
          <Input label="Takeaway" autoFocus maxLength={200} value={take} onChange={(e) => setTake(e.target.value)} placeholder="What will you do differently?" />
          <Button type="submit" variant="primary">Mark read</Button>
        </form>
      </Modal>
    </Card>
  );
}
