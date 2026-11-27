// Notes per topic (markdown), spaced review 3/7/30/90, "Turn into post draft", "Make flashcard".
import { useMemo, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "@/data/db";
import { repo } from "@/data/repo";
import type { Rows } from "@/data/types.gen";
import { firstReview, gradeReview } from "@/domain/career";
import { renderMarkdown } from "@/lib/markdown";
import { pretty, today } from "@/lib/dates";
import { award } from "@/services/xp";
import { Button, Card, Chip, Empty, IconButton, Input, Pager, paginate, Select, Textarea, toast } from "@/ui";

export default function Notes({ section = "career" }: { section?: string }) {
  const notes = useLiveQuery(async () => (await db.t("notes").where("section").equals(section).toArray()).filter((n) => !n.deleted_at).sort((a, b) => (a.updated_at < b.updated_at ? 1 : -1)), [section]);
  const decks = useLiveQuery(async () => (await db.t("flashcard_decks").toArray()).filter((d) => !d.deleted_at), []);
  const [sel, setSel] = useState<string | null>(null);
  const [topic, setTopic] = useState<string | null>(null);
  const [preview, setPreview] = useState(false);
  const [page, setPage] = useState(0);
  const t = today();
  const due = (notes ?? []).filter((n) => n.next_review_at && n.next_review_at <= t);
  const topics = useMemo(() => [...new Set((notes ?? []).map((n) => n.topic).filter((x): x is string => !!x))].sort(), [notes]);
  const list = (notes ?? []).filter((n) => !topic || n.topic === topic);
  const { slice, pages } = paginate(list, page, 15);
  const cur = (notes ?? []).find((n) => n.id === sel) ?? null;

  const create = async () => {
    const n = await repo.insert("notes", { section, title: "Untitled note", topic, body_md: "", ...firstReview(t) });
    setSel(n.id);
    setPreview(false);
  };

  return (
    <div className="bento">
      <div className="span-4 stack">
        {due.length ? (
          <Card title={`${due.length} due for review`} eyebrow="3 · 7 · 30 · 90 days" edge rise={false}>
            <ul className="list">
              {due.slice(0, 6).map((n) => (
                <li key={n.id}>
                  <button type="button" className="small grow truncate" style={{ textAlign: "left" }} onClick={() => { setSel(n.id); setPreview(true); }}>{n.title}</button>
                  <Button size="sm" variant="accent" onClick={async () => { await repo.patch("notes", n.id, gradeReview(n.review_stage, true, t)); await award("note_reviewed", section, "notes", `${n.id}:${n.review_stage}`, { quiet: true }); toast.ok("Remembered."); }}>Got it</Button>
                  <Button size="sm" onClick={() => void repo.patch("notes", n.id, gradeReview(n.review_stage, false, t))}>Again</Button>
                </li>
              ))}
            </ul>
          </Card>
        ) : null}
        <Card title="Notes" right={<Button size="sm" icon="plus" onClick={() => void create()}>New</Button>} rise={false}>
          {topics.length ? (
            <div className="row wrap" style={{ marginBottom: 8 }}>
              <Chip on={!topic} onClick={() => setTopic(null)}>All</Chip>
              {topics.map((x) => <Chip key={x} on={topic === x} onClick={() => setTopic(topic === x ? null : x)}>{x}</Chip>)}
            </div>
          ) : null}
          <ul className="list">
            {slice.map((n) => (
              <li key={n.id}>
                <button type="button" className="stack tight grow" style={{ textAlign: "left", minWidth: 0 }} onClick={() => { setSel(n.id); setPreview(true); }}>
                  <span className={`small truncate${n.id === sel ? " accent" : ""}`}>{n.title}</span>
                  <span className="xs muted">{n.topic ?? "no topic"} · {n.next_review_at ? `review ${pretty(n.next_review_at)}` : "graduated"}</span>
                </button>
              </li>
            ))}
          </ul>
          {!list.length ? <Empty>No notes. Block 2 is the perfect time to start.</Empty> : null}
          <Pager page={page} pages={pages} onPage={setPage} total={list.length} />
        </Card>
      </div>
      <Card className="span-8 stretch" title={cur ? (preview ? cur.title : "Edit note") : "Select a note"} right={cur ? <Button size="sm" onClick={() => setPreview((p) => !p)}>{preview ? "Edit" : "Preview"}</Button> : null} rise={false}>
        {!cur ? (
          <Empty glyph="✎">Pick a note or start a new one.</Empty>
        ) : preview ? (
          <div className="md" dangerouslySetInnerHTML={{ __html: renderMarkdown(cur.body_md) || "<p class='muted'>Empty. Edit to write.</p>" }} />
        ) : (
          <div className="stack" key={cur.id}>
            <div className="form-grid">
              <Input label="Title" defaultValue={cur.title} onBlur={(e) => void repo.patch("notes", cur.id, { title: e.target.value || "Untitled note" })} />
              <Input label="Topic" list="note-topics" defaultValue={cur.topic ?? ""} onBlur={(e) => void repo.patch("notes", cur.id, { topic: e.target.value || null })} />
            </div>
            <datalist id="note-topics">{topics.map((x) => <option key={x} value={x} />)}</datalist>
            <Textarea label="Markdown" rows={16} defaultValue={cur.body_md} onBlur={(e) => void repo.patch("notes", cur.id, { body_md: e.target.value })} hint="Saves when you click away. **bold**, *italic*, `code`, # headings, - lists, [links](https://…)." />
          </div>
        )}
        {cur ? <NoteActions note={cur} decks={decks ?? []} onDelete={() => setSel(null)} /> : null}
      </Card>
    </div>
  );
}

function NoteActions({ note, decks, onDelete }: { note: Rows["notes"]; decks: Rows["flashcard_decks"][]; onDelete: () => void }) {
  const [deck, setDeck] = useState(decks[0]?.id ?? "");
  const [front, setFront] = useState("");
  return (
    <div className="stack" style={{ marginTop: 16 }}>
      <hr className="dash" />
      <div className="row wrap">
        <Button
          size="sm"
          icon="send"
          onClick={async () => {
            await repo.insert("post_ideas", { text: `${note.title}${note.body_md ? `: ${note.body_md.slice(0, 200)}` : ""}`, source_table: "notes", source_id: note.id, stage: "note" });
            toast.ok("Sent to PERSONA › Ideas.");
          }}
        >
          Turn into post draft
        </Button>
        <IconButton icon="trash" label="Delete note" onClick={async () => { await repo.remove("notes", note.id); onDelete(); }} />
      </div>
      <form
        className="row wrap"
        onSubmit={async (e) => {
          e.preventDefault();
          if (!front.trim() || !deck) return;
          await repo.insert("flashcards", { deck_id: deck, front: front.trim(), back: note.title + (note.body_md ? `\n\n${note.body_md.slice(0, 500)}` : ""), source: "note", due_at: today() });
          setFront("");
          toast.ok("Card created.");
        }}
      >
        <Input aria-label="Flashcard question" placeholder="Make a flashcard: question…" value={front} onChange={(e) => setFront(e.target.value)} />
        <Select aria-label="Deck" value={deck} onChange={(e) => setDeck(e.target.value)} options={decks.map((d) => ({ value: d.id, label: d.name }))} style={{ width: 200 }} />
        <Button type="submit" size="sm">Add card</Button>
      </form>
    </div>
  );
}
