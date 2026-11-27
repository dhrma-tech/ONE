// Distraction-free watch page: nocookie embed, ONE's own pause/end cards (no YouTube suggestions),
// resume position, done at ≥ 90%, timestamped notes (press N), focus dim.
import { useEffect, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "@/data/db";
import { repo } from "@/data/repo";
import { fmtClock } from "@/lib/dates";
import { useUI } from "@/data/ui";
import { nextUp } from "@/services/library";
import { Button, Card, Empty, IconButton, Input, Stars, Switch, toast } from "@/ui";
import { embedUrl, isWatched, usePlayer } from "./player";
import { addNote, getProgress, markDone, savePosition } from "./actions";

export default function Watch() {
  const { videoId = "" } = useParams();
  const nav = useNavigate();
  const v = useLiveQuery(() => db.t("videos").get(videoId), [videoId]);
  const notes = useLiveQuery(async () => (await db.t("video_notes").where("video_id").equals(videoId).toArray()).filter((n) => !n.deleted_at).sort((a, b) => a.t_seconds - b.t_seconds), [videoId]);
  const [start, setStart] = useState<number | null>(null);
  const [ended, setEnded] = useState(false);
  const [paused, setPaused] = useState(false);
  const [focusDim, setFocusDim] = useState(false);
  const [note, setNote] = useState("");
  const [noteAt, setNoteAt] = useState<number | null>(null);
  const [next, setNext] = useState<Awaited<ReturnType<typeof nextUp>>>(null);
  const frame = useRef<HTMLIFrameElement>(null);
  const noteInput = useRef<HTMLInputElement>(null);
  const lastSave = useRef(0);
  const doneMarked = useRef(false);
  const { noteRequest } = useUI();

  useEffect(() => {
    let alive = true;
    doneMarked.current = false;
    setEnded(false);
    void getProgress(videoId).then((p) => alive && setStart(p && p.status !== "done" ? p.position_s : 0));
    return () => {
      alive = false;
    };
  }, [videoId]);

  const player = usePlayer(frame, videoId, {
    onState: (st) => setPaused(st === 2),
    onEnd: () => {
      setEnded(true);
      if (v) void nextUp(v.section).then((n) => setNext(n && n.id !== v.id ? n : null));
    },
    onTick: (t, d) => {
      if (!v) return;
      if (Date.now() - lastSave.current > 5000) {
        lastSave.current = Date.now();
        void savePosition(v.id, t);
      }
      if (!doneMarked.current && isWatched(t, d)) {
        doneMarked.current = true;
        void markDone(v).then(() => toast.ok("Marked done.", "90% watched counts."));
      }
    },
  });

  // "n" anywhere on this page → note at the current time
  const firstNote = useRef(noteRequest);
  useEffect(() => {
    if (noteRequest === firstNote.current) return;
    setNoteAt(player.now());
    player.pause();
    setTimeout(() => noteInput.current?.focus(), 30);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only react to the key press counter
  }, [noteRequest]);

  if (v === undefined || start === null) return <p className="micro">Loading…</p>;
  if (!v) return <Empty>Video not found. It may have been removed.</Empty>;

  return (
    <div className={`bento watch${focusDim ? " watch-focus" : ""}`} data-section={v.section}>
      <div className="span-8 stack">
        <div className="player">
          <iframe ref={frame} src={embedUrl(v.youtube_id, start)} title={v.title} allow="autoplay; encrypted-media; picture-in-picture; fullscreen" allowFullScreen referrerPolicy="strict-origin-when-cross-origin" />
          <div className="shield-top" aria-hidden />
          {paused && !ended ? (
            <button type="button" className="end-card" onClick={() => player.play()} aria-label="Resume">
              <span className="micro">Paused at {fmtClock(player.now())}</span>
              <span className="display" style={{ fontSize: 28 }}>Resume ▶</span>
              <span className="xs" style={{ opacity: 0.7 }}>No suggestions here. Just the video you chose.</span>
            </button>
          ) : null}
          {ended ? (
            <div className="end-card" role="dialog" aria-label="Video finished">
              <span className="micro">Done.</span>
              <span className="display" style={{ fontSize: 26 }}>Mark complete?</span>
              <div className="row wrap" style={{ justifyContent: "center" }}>
                <Button
                  variant="accent"
                  icon="check"
                  onClick={async () => {
                    await markDone(v);
                    toast.ok("Logged.");
                  }}
                >
                  Mark done
                </Button>
                <Button onClick={() => { setEnded(false); player.seek(0); }}>Rewatch</Button>
              </div>
              {next ? (
                <Link to={`/${next.section}/library/watch/${next.id}`} className="small" style={{ textDecoration: "underline" }}>
                  Next up: {next.title}
                </Link>
              ) : (
                <span className="xs">Queue empty. Go build something.</span>
              )}
            </div>
          ) : null}
        </div>
        <div className="row wrap between">
          <div className="stack tight" style={{ minWidth: 0 }}>
            <h1 style={{ fontSize: "var(--fs-xl)" }}>{v.title}</h1>
            <span className="muted small">{v.channel} · {v.topic}</span>
          </div>
          <div className="row wrap">
            <Stars value={v.rating ?? 0} onChange={(r) => void repo.patch("videos", v.id, { rating: r })} label="Your rating" />
            <Switch checked={focusDim} onChange={setFocusDim} label="Focus" />
            <Button size="sm" onClick={() => void markDone(v).then(() => toast.ok("Marked done."))}>Mark done</Button>
            <IconButton icon="x" label="Back to library" onClick={() => nav(`/${v.section}/library`)} />
          </div>
        </div>
      </div>
      <Card className="span-4 stretch notes-panel" title="Notes" eyebrow="Press N to note this moment" rise={false}>
        <form
          className="row"
          onSubmit={async (e) => {
            e.preventDefault();
            await addNote(v.id, noteAt ?? player.now(), note);
            setNote("");
            setNoteAt(null);
            player.play();
          }}
        >
          <span className="chip">{fmtClock(noteAt ?? player.now())}</span>
          <Input ref={noteInput} aria-label="Note" placeholder="What clicked?" value={note} onChange={(e) => setNote(e.target.value)} onFocus={() => setNoteAt((x) => x ?? player.now())} />
        </form>
        <ul className="list" style={{ marginTop: 8 }}>
          {(notes ?? []).map((n) => (
            <li key={n.id}>
              <button type="button" className="chip" onClick={() => player.seek(n.t_seconds)} aria-label={`Seek to ${fmtClock(n.t_seconds)}`}>
                {fmtClock(n.t_seconds)}
              </button>
              <span className="small text grow">{n.text}</span>
              <IconButton icon="trash" size="sm" label="Delete note" onClick={() => void repo.remove("video_notes", n.id)} />
            </li>
          ))}
        </ul>
        {!notes?.length ? <p className="xs muted">No notes yet. Future-you would like some.</p> : null}
      </Card>
    </div>
  );
}
