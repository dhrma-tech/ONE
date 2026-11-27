// Memory: SM-2 flashcards, max 5 new/day, ~10 min review. Decks: Python, LLM, English, numbers, chess.
import { useMemo, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "@/data/db";
import { repo } from "@/data/repo";
import type { Rows } from "@/data/types.gen";
import { sm2, todaysCards } from "@/domain/mind";
import { today } from "@/lib/dates";
import { useTargets } from "@/services/settings";
import { award } from "@/services/xp";
import { Button, Card, Chip, Empty, IconButton, Input, Pager, paginate, Select, StatCard, Textarea, toast } from "@/ui";

export default function Memory() {
  const t = today();
  const targets = useTargets();
  const data = useLiveQuery(async () => {
    const [decks, cards, reviews] = await Promise.all([db.t("flashcard_decks").toArray(), db.t("flashcards").toArray(), db.t("flashcard_reviews").where("date").equals(t).toArray()]);
    return { decks: decks.filter((d) => !d.deleted_at).sort((a, b) => a.order_no - b.order_no), cards: cards.filter((c) => !c.deleted_at), reviews: reviews.filter((r) => !r.deleted_at) };
  }, [t]);
  const [deck, setDeck] = useState<string | "all">("all");
  const [flip, setFlip] = useState(false);
  const [front, setFront] = useState("");
  const [back, setBack] = useState("");
  const [page, setPage] = useState(0);
  const newToday = useMemo(() => {
    if (!data) return 0;
    const ids = new Set(data.reviews.map((r) => r.card_id));
    return data.cards.filter((c) => ids.has(c.id) && c.reps <= 1 && c.lapses === 0 && c.interval_days <= 1).length;
  }, [data]);
  if (!data) return <p className="micro">Loading…</p>;
  const pool = data.cards.filter((c) => deck === "all" || c.deck_id === deck);
  const session = todaysCards(pool, t, targets.flashcards_new_per_day, newToday);
  const cur = session[0];
  const grade = async (c: Rows["flashcards"], g: number) => {
    const next = sm2({ ef: Number(c.ef), interval_days: c.interval_days, reps: c.reps, lapses: c.lapses, due_at: c.due_at ?? null, is_new: c.is_new }, g, t);
    await repo.patch("flashcards", c.id, next);
    await repo.insert("flashcard_reviews", { card_id: c.id, date: t, grade: g, interval_days: next.interval_days });
    setFlip(false);
    if (data.reviews.length + 1 >= targets.flashcards_reviews_done) await award("flashcards_session", "mind", "flashcards", t, { quiet: true });
  };
  const { slice, pages } = paginate(pool, page, 12);
  return (
    <div className="bento">
      <Card className="span-8" eyebrow={`${session.length} in today's session · max ${targets.flashcards_new_per_day} new/day`} title="Review" right={<Select aria-label="Deck" value={deck} onChange={(e) => setDeck(e.target.value)} options={[{ value: "all", label: "All decks" }, ...data.decks.map((d) => ({ value: d.id, label: d.name }))]} style={{ width: 200 }} />}>
        {cur ? (
          <div className="stack">
            <div className="flash" role="region" aria-live="polite">
              <span className="micro">{data.decks.find((d) => d.id === cur.deck_id)?.name}{cur.is_new ? " · new" : ""}</span>
              <span className="text" style={{ whiteSpace: "pre-wrap" }}>{cur.front}</span>
              {flip ? <span className="text accent" style={{ whiteSpace: "pre-wrap", fontSize: "var(--fs-md)" }}>{cur.back}</span> : null}
            </div>
            {!flip ? (
              <Button variant="primary" size="lg" block onClick={() => setFlip(true)}>Show answer</Button>
            ) : (
              <div className="cols-4">
                <Button onClick={() => void grade(cur, 1)}>Again</Button>
                <Button onClick={() => void grade(cur, 3)}>Hard</Button>
                <Button variant="accent" onClick={() => void grade(cur, 4)}>Good</Button>
                <Button onClick={() => void grade(cur, 5)}>Easy</Button>
              </div>
            )}
          </div>
        ) : (
          <Empty glyph="✓">Session done. {data.reviews.length} reviews today. Memory: upgraded.</Empty>
        )}
      </Card>
      <Card className="span-4" title="Today">
        <div className="cols-2">
          <StatCard label="Reviewed" value={data.reviews.length} />
          <StatCard label="Cards" value={data.cards.length} />
        </div>
        <form
          className="stack"
          style={{ marginTop: 16 }}
          onSubmit={async (e) => {
            e.preventDefault();
            const d = deck === "all" ? data.decks[0]?.id : deck;
            if (!front.trim() || !back.trim() || !d) return;
            await repo.insert("flashcards", { deck_id: d, front: front.trim(), back: back.trim(), source: "manual" });
            setFront("");
            setBack("");
            toast.ok("Card added.");
          }}
        >
          <span className="micro">New card {deck === "all" ? `→ ${data.decks[0]?.name ?? ""}` : ""}</span>
          <Input aria-label="Front" placeholder="Front: what does enumerate() return?" value={front} onChange={(e) => setFront(e.target.value)} />
          <Textarea aria-label="Back" placeholder="Back" rows={2} value={back} onChange={(e) => setBack(e.target.value)} />
          <Button type="submit" size="sm" icon="plus">Add card</Button>
        </form>
      </Card>
      <Card className="span-12" title="Cards" eyebrow="Browse and prune">
        <ul className="list">
          {slice.map((c) => (
            <li key={c.id}>
              <span className="small grow truncate">{c.front}</span>
              <Chip>{c.is_new ? "new" : `due ${c.due_at ?? "—"}`}</Chip>
              <IconButton icon="trash" size="sm" label="Delete card" onClick={() => void repo.remove("flashcards", c.id)} />
            </li>
          ))}
        </ul>
        {!pool.length ? <Empty>No cards yet. Make them from Notes or above.</Empty> : null}
        <Pager page={page} pages={pages} onPage={setPage} total={pool.length} />
      </Card>
    </div>
  );
}
