// News room: hard cap 10 per day, picked by fixed source rules (no AI ranking). No comments, no infinite list.
import { useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "@/data/db";
import { repo } from "@/data/repo";
import { api } from "@/lib/api";
import { today } from "@/lib/dates";
import { NEWS_CAP, pickNews, type NewsIn } from "@/domain/career";
import { Button, Card, Chip, Empty, IconButton, toast } from "@/ui";

export default function News() {
  const d = today();
  const items = useLiveQuery(async () => (await db.t("news_items").where("date").equals(d).toArray()).filter((n) => !n.deleted_at).sort((a, b) => (a.created_at < b.created_at ? -1 : 1)), [d]);
  const [busy, setBusy] = useState(false);
  const full = (items?.length ?? 0) >= NEWS_CAP;
  const fetchToday = async () => {
    setBusy(true);
    try {
      const r = await api.get<{ items: NewsIn[] }>("/api/news");
      const picks = pickNews(r.items, (items ?? []).map((i) => i.url));
      await repo.insertMany("news_items", picks.map((p) => ({ date: d, source: p.sn, title: p.t, url: p.u })));
      toast.ok(picks.length ? `${picks.length} items. That's the ration.` : "Nothing new worth your time.");
    } catch {
      toast.err("News sources unreachable. The world will survive.");
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="bento">
      <Card className="span-8" eyebrow={`${items?.length ?? 0}/${NEWS_CAP} today`} title="News room" right={!full ? <Button size="sm" icon="refresh" disabled={busy} onClick={() => void fetchToday()}>{items?.length ? "Top up" : "Get today's 10"}</Button> : null}>
        {items?.length ? (
          <ul className="list">
            {items.map((n, i) => (
              <li key={n.id} style={{ opacity: n.read ? 0.5 : 1 }}>
                <span className="mono xs muted" style={{ width: 22 }}>{String(i + 1).padStart(2, "0")}</span>
                <a className="small grow" href={n.url} target="_blank" rel="noopener noreferrer" onClick={() => void repo.patch("news_items", n.id, { read: true })}>
                  {n.title}
                </a>
                <span className="micro">{n.source}</span>
                <IconButton
                  icon="book"
                  size="sm"
                  label="Save to reading list"
                  onClick={async () => {
                    await repo.insert("reading_list", { url: n.url, title: n.title });
                    await repo.patch("news_items", n.id, { saved: true });
                    toast.ok("Saved to Reading.");
                  }}
                />
                <IconButton icon="check" size="sm" label={n.read ? "Mark unread" : "Mark read"} onClick={() => void repo.patch("news_items", n.id, { read: !n.read })} />
              </li>
            ))}
          </ul>
        ) : (
          <Empty glyph="◎">No news yet today. Fetch it once; it won't refill.</Empty>
        )}
        {full ? <p className="notice" style={{ marginTop: 12 }}>That's today's news. The rest can wait.</p> : null}
      </Card>
      <Card className="span-4" title="Rules" eyebrow="No algorithm, just quotas">
        <ul className="list small">
          <li>Hacker News: top 4 by points (AI topics, last 72 h)</li>
          <li>Papers: top 3 Hugging Face daily papers by upvotes</li>
          <li>Community: top 2 from Lobsters</li>
          <li>Then the best remaining by score, up to 10</li>
        </ul>
        <div className="row wrap" style={{ marginTop: 8 }}>
          <Chip>no comments</Chip>
          <Chip>no refills</Chip>
          <Chip>no feed</Chip>
        </div>
      </Card>
    </div>
  );
}
