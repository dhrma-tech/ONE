// Shared Library: Next up / Queue / Done / Inbox, topic chips, add video, bulk import. Every list paginates.
import { useMemo, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "@/data/db";
import { repo } from "@/data/repo";
import type { Rows } from "@/data/types.gen";
import { loadQueue, sortQueue, type QueueVideo } from "@/services/library";
import { youtubeId } from "@/domain/thumbs";
import { Button, Card, Chip, Empty, Field, Input, Modal, Pager, paginate, Select, Stars, Tabs, Textarea, toast } from "@/ui";
import { FrameThumb, VideoCard } from "@/ui/video";
import { addVideo, fetchMeta, importPack, parseBulk } from "./actions";

const PACKS: Record<string, { name: string; label: string }[]> = {
  career: [{ name: "cubicle-career", label: "Cubicle catalogue (AI/ML, Python)" }],
  mind: [{ name: "bobby-chess", label: "Bobby's chess videos" }],
};

type Tab = "next" | "queue" | "done" | "inbox";

function useLibrary(section: string) {
  return useLiveQuery(async () => {
    const [videos, progress] = await Promise.all([db.t("videos").where("section").equals(section).toArray(), db.t("video_progress").toArray()]);
    const prog = new Map(progress.filter((p) => !p.deleted_at).map((p) => [p.video_id, p]));
    const live = videos.filter((v) => !v.deleted_at);
    const queue = await loadQueue(section);
    const done = live
      .filter((v) => v.approved && prog.get(v.id)?.status === "done")
      .map((v) => ({ ...v, progress: prog.get(v.id), pathOrder: 0 }))
      .sort((a, b) => ((a.progress?.finished_at ?? "") < (b.progress?.finished_at ?? "") ? 1 : -1));
    const inbox = live.filter((v) => !v.approved && !v.rejected).sort((a, b) => (a.topic ?? "").localeCompare(b.topic ?? "") || a.title.localeCompare(b.title));
    const topics = [...new Set(live.filter((v) => v.approved).map((v) => v.topic).filter((t): t is string => !!t))].sort();
    return { queue, done, inbox, topics, prog };
  }, [section]);
}

function VideoGrid({ list, section }: { list: QueueVideo[]; section: string }) {
  const [page, setPage] = useState(0);
  const { slice, pages } = paginate(list, page, 12);
  if (!list.length) return <Empty />;
  return (
    <>
      <div className="cols-4 video-grid">
        {slice.map((v) => (
          <VideoCard key={v.id} v={{ ...v, status: v.progress?.status, position_s: v.progress?.position_s }} to={`/${section}/library/watch/${v.id}`} />
        ))}
      </div>
      <Pager page={page} pages={pages} onPage={setPage} total={list.length} />
    </>
  );
}

function Inbox({ list, section }: { list: Rows["videos"][]; section: string }) {
  const [rating, setRating] = useState(0);
  const [priority, setPriority] = useState("2");
  const [busy, setBusy] = useState(false);
  const v = list[0];
  const packs = PACKS[section] ?? [];
  return (
    <div className="stack loose">
      {v ? (
        <Card title={`${list.length} waiting`} eyebrow="Inbox · one at a time" rise={false}>
          <div className="cols-2">
            <FrameThumb v={{ ...v, frame: v.frame }} size="poster" />
            <div className="stack">
              <span className="micro accent">{v.topic}</span>
              <h3 style={{ fontSize: "var(--fs-lg)" }}>{v.title}</h3>
              <span className="muted small">{v.channel}</span>
              <a className="xs muted" href={`https://www.youtube.com/watch?v=${v.youtube_id}`} target="_blank" rel="noreferrer">
                Preview on YouTube ↗
              </a>
              <Field label="Your rating">
                <Stars value={rating} onChange={setRating} />
              </Field>
              <Select label="Priority" value={priority} onChange={(e) => setPriority(e.target.value)} options={[{ value: "1", label: "1 · high" }, { value: "2", label: "2 · normal" }, { value: "3", label: "3 · low" }]} />
              <div className="row wrap">
                <Button
                  variant="accent"
                  icon="check"
                  onClick={async () => {
                    await repo.patch("videos", v.id, { approved: true, rating: rating || null, priority: Number(priority) });
                    setRating(0);
                    toast.ok("Approved.");
                  }}
                >
                  Approve
                </Button>
                <Button variant="danger" icon="x" onClick={() => void repo.patch("videos", v.id, { rejected: true })}>
                  Reject
                </Button>
              </div>
            </div>
          </div>
        </Card>
      ) : (
        <Empty glyph="✓">Inbox zero. Rare. Treasure it.</Empty>
      )}
      {packs.length ? (
        <Card title="Candidate packs" eyebrow="Nothing goes live without your approval" rise={false}>
          <div className="row wrap">
            {packs.map((p) => (
              <Button
                key={p.name}
                icon="download"
                disabled={busy}
                onClick={async () => {
                  setBusy(true);
                  try {
                    const n = await importPack(p.name);
                    toast.ok(n ? `${n} candidates in the Inbox.` : "Already imported.");
                  } catch {
                    toast.err("Pack unavailable offline.");
                  } finally {
                    setBusy(false);
                  }
                }}
              >
                {p.label}
              </Button>
            ))}
          </div>
        </Card>
      ) : null}
    </div>
  );
}

export function AddVideo({ section, open, onClose, topics }: { section: string; open: boolean; onClose: () => void; topics: string[] }) {
  const [url, setUrl] = useState("");
  const [meta, setMeta] = useState<{ title: string; channel: string; seconds: number | null } | null>(null);
  const [topic, setTopic] = useState("");
  const [rating, setRating] = useState(0);
  const [priority, setPriority] = useState("2");
  const [pathItem, setPathItem] = useState("");
  const [bulk, setBulk] = useState("");
  const [mode, setMode] = useState<"one" | "bulk">("one");
  const [busy, setBusy] = useState(false);
  const items = useLiveQuery(async () => (await db.t("path_items").where("section").equals(section).toArray()).filter((i) => !i.deleted_at), [section]);
  const id = youtubeId(url);
  const reset = () => {
    setUrl("");
    setMeta(null);
    setRating(0);
    setBulk("");
  };
  return (
    <Modal open={open} onClose={onClose} title="Add videos" wide>
      <Tabs label="Add mode" value={mode} onChange={(m) => setMode(m as "one" | "bulk")} tabs={[{ id: "one", label: "One video" }, { id: "bulk", label: "Bulk import" }]} />
      {mode === "one" ? (
        <form
          className="stack"
          onSubmit={async (e) => {
            e.preventDefault();
            if (!id || !meta) return;
            await addVideo({ youtube_id: id, section, title: meta.title, channel: meta.channel, duration_s: meta.seconds, topic: topic || null, rating: rating || null, priority: Number(priority), path_item_id: pathItem || null, approved: true, source: "manual" });
            toast.ok("Added to the queue.");
            reset();
            onClose();
          }}
        >
          <div className="row">
            <Input label="YouTube URL" placeholder="https://youtu.be/…" value={url} onChange={(e) => setUrl(e.target.value)} />
            <Button
              disabled={!id || busy}
              onClick={async () => {
                setBusy(true);
                const m = await fetchMeta(id!);
                setBusy(false);
                setMeta({ title: m.title ?? "", channel: m.channel ?? "", seconds: m.seconds ?? null });
                if (m.error) toast.info("Couldn't fetch details. Type them in.");
              }}
              style={{ alignSelf: "flex-end" }}
            >
              Fetch
            </Button>
          </div>
          {meta ? (
            <>
              <div className="form-grid">
                <Input label="Title" required value={meta.title} onChange={(e) => setMeta({ ...meta, title: e.target.value })} />
                <Input label="Channel" value={meta.channel} onChange={(e) => setMeta({ ...meta, channel: e.target.value })} />
                <Input label="Duration (min)" inputMode="numeric" value={meta.seconds ? Math.round(meta.seconds / 60) : ""} onChange={(e) => setMeta({ ...meta, seconds: Number(e.target.value) * 60 || null })} />
                <Input label="Topic" list="lib-topics" value={topic} onChange={(e) => setTopic(e.target.value)} />
                <Select label="Priority" value={priority} onChange={(e) => setPriority(e.target.value)} options={[{ value: "1", label: "1 · high" }, { value: "2", label: "2 · normal" }, { value: "3", label: "3 · low" }]} />
                <Select label="Path item" value={pathItem} onChange={(e) => setPathItem(e.target.value)} options={[{ value: "", label: "— none —" }, ...(items ?? []).map((i) => ({ value: i.id, label: i.title }))]} />
              </div>
              <datalist id="lib-topics">
                {topics.map((t) => (
                  <option key={t} value={t} />
                ))}
              </datalist>
              <Field label="Your rating">
                <Stars value={rating} onChange={setRating} />
              </Field>
              <Button type="submit" variant="primary" disabled={!meta.title}>
                Approve and add
              </Button>
            </>
          ) : null}
        </form>
      ) : (
        <div className="stack">
          <Textarea label="URLs or ids (one per line) or a JSON array" rows={8} value={bulk} onChange={(e) => setBulk(e.target.value)} placeholder={'https://youtu.be/…\n[{"url": "…", "topic": "RAG", "rating": 4}]'} />
          <Button
            variant="primary"
            disabled={busy || !bulk.trim()}
            onClick={async () => {
              let list: ReturnType<typeof parseBulk>;
              try {
                list = parseBulk(bulk).slice(0, 100);
              } catch {
                toast.err("That JSON doesn't parse.");
                return;
              }
              setBusy(true);
              let n = 0;
              for (const x of list) {
                const m = x.title ? { title: x.title } : await fetchMeta(x.youtube_id);
                await addVideo({ youtube_id: x.youtube_id, section, title: m.title || x.youtube_id, channel: "channel" in m ? (m.channel ?? null) : null, duration_s: "seconds" in m ? (m.seconds ?? null) : null, topic: x.topic ?? null, rating: x.rating ?? null, approved: false, source: "bulk" });
                n++;
              }
              setBusy(false);
              toast.ok(`${n} sent to the Inbox.`, "Approve them one by one.");
              reset();
              onClose();
            }}
          >
            Import to Inbox
          </Button>
        </div>
      )}
    </Modal>
  );
}

/** Library for one section. `topics` are suggested topic tabs (from the brief). */
export function Library({ section, suggestedTopics = [] }: { section: string; suggestedTopics?: string[] }) {
  const lib = useLibrary(section);
  const [tab, setTab] = useState<Tab>("next");
  const [topic, setTopic] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const topics = useMemo(() => [...new Set([...(lib?.topics ?? []), ...suggestedTopics])], [lib?.topics, suggestedTopics]);
  if (!lib) return <p className="micro">Loading…</p>;
  const filt = <T extends { topic?: string | null }>(l: T[]) => (topic ? l.filter((v) => v.topic === topic) : l);
  const queue = sortQueue(filt(lib.queue));
  return (
    <div className="stack loose">
      <div className="row wrap between">
        <Tabs
          label="Library views"
          value={tab}
          onChange={(t) => setTab(t as Tab)}
          tabs={[
            { id: "next", label: "Next up" },
            { id: "queue", label: `Queue ${lib.queue.length}` },
            { id: "done", label: `Done ${lib.done.length}` },
            { id: "inbox", label: `Inbox ${lib.inbox.length}` },
          ]}
        />
        <Button icon="plus" onClick={() => setAdding(true)}>
          Add video
        </Button>
      </div>
      {tab !== "inbox" && topics.length ? (
        <div className="row wrap">
          <Chip on={!topic} onClick={() => setTopic(null)}>
            All
          </Chip>
          {topics.map((t) => (
            <Chip key={t} on={topic === t} onClick={() => setTopic(topic === t ? null : t)}>
              {t}
            </Chip>
          ))}
        </div>
      ) : null}
      {tab === "next" ? (
        queue[0] ? (
          <div className="cols-2">
            <VideoCard v={{ ...queue[0], status: queue[0].progress?.status, position_s: queue[0].progress?.position_s }} to={`/${section}/library/watch/${queue[0].id}`} />
            <div className="stack">
              <span className="micro">Then</span>
              <ul className="list">
                {queue.slice(1, 4).map((v) => (
                  <li key={v.id} className="small">
                    <span className="truncate grow">{v.title}</span>
                    <span className="xs muted">{v.topic}</span>
                  </li>
                ))}
              </ul>
              <p className="xs muted">Sorted by path order, priority, your rating, then shortest. No browsing needed.</p>
            </div>
          </div>
        ) : (
          <Empty glyph="▶">Nothing approved yet. Check the Inbox.</Empty>
        )
      ) : null}
      {tab === "queue" ? <VideoGrid list={queue} section={section} /> : null}
      {tab === "done" ? <VideoGrid list={filt(lib.done)} section={section} /> : null}
      {tab === "inbox" ? <Inbox list={lib.inbox} section={section} /> : null}
      <AddVideo section={section} open={adding} onClose={() => setAdding(false)} topics={topics} />
    </div>
  );
}
