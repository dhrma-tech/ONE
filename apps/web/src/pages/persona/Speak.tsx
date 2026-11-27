// Speak: in-browser 2-minute recordings (MediaRecorder; Opus/WebM on Chrome/Edge, MP4/AAC on iOS Safari),
// random prompts (fixed list, no AI), self-rating, baseline + day 30/60/90 redo with side-by-side playback.
import { useEffect, useRef, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "@/data/db";
import { repo, uuid } from "@/data/repo";
import type { Rows } from "@/data/types.gen";
import { BASELINE_PROMPT, SPEAKING_PROMPTS } from "@/seed/prompts";
import { baselineDue, extFor, nextBaseline, pickRecorderMime } from "@/domain/persona";
import { fmtClock, pretty, today } from "@/lib/dates";
import { blobUrl, deleteBlob, saveBlob } from "@/services/blobs";
import { award } from "@/services/xp";
import { bumpPersona } from "@/services/log";
import { Button, Card, Chip, Empty, IconButton, Input, Select, toast } from "@/ui";

const LIMIT = 120;

function Audio({ r }: { r: Rows["speaking_recordings"] }) {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    void blobUrl("recordings", r.storage_path).then(setUrl);
  }, [r.storage_path]);
  return url ? <audio controls src={url} preload="none" style={{ width: "100%" }} /> : <span className="xs muted">Audio not on this device yet.</span>;
}

export default function Speak() {
  const recs = useLiveQuery(async () => (await db.t("speaking_recordings").toArray()).filter((r) => !r.deleted_at).sort((a, b) => (a.created_at < b.created_at ? 1 : -1)), []);
  const baselines = (recs ?? []).filter((r) => r.is_baseline).sort((a, b) => (a.baseline_day ?? 0) - (b.baseline_day ?? 0));
  const base0 = baselines.find((b) => b.baseline_day === 0) ?? null;
  const due = baselineDue(base0?.date ?? null, baselines.map((b) => b.baseline_day ?? 0), today());
  const [topic, setTopic] = useState(() => SPEAKING_PROMPTS[1 + Math.floor(Math.random() * (SPEAKING_PROMPTS.length - 1))]);
  const [state, setState] = useState<"idle" | "rec" | "rate">("idle");
  const [left, setLeft] = useState(LIMIT);
  const [err, setErr] = useState<string | null>(null);
  const [pending, setPending] = useState<{ blob: Blob; mime: string; seconds: number; baselineDay: number | null } | null>(null);
  const [rate, setRate] = useState({ restarts: "0", fillers: "0", switches: "0", pace: "3" });
  const rec = useRef<MediaRecorder | null>(null);
  const t0 = useRef(0);
  const baselineMode = due !== null;

  useEffect(() => {
    if (state !== "rec") return;
    const id = setInterval(() => {
      const l = LIMIT - Math.floor((Date.now() - t0.current) / 1000);
      setLeft(l);
      if (l <= 0) rec.current?.stop();
    }, 200);
    return () => clearInterval(id);
  }, [state]);

  const start = async (asBaseline: boolean) => {
    setErr(null);
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") return setErr("This browser can't record audio.");
    const mime = pickRecorderMime((m) => MediaRecorder.isTypeSupported?.(m) ?? false);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } });
      const mr = new MediaRecorder(stream, mime ? { mimeType: mime, audioBitsPerSecond: 32_000 } : undefined);
      const chunks: Blob[] = [];
      mr.ondataavailable = (e) => e.data.size && chunks.push(e.data);
      mr.onstop = () => {
        stream.getTracks().forEach((t) => t.stop());
        const type = mr.mimeType || mime || "audio/webm";
        setPending({ blob: new Blob(chunks, { type }), mime: type, seconds: Math.min(LIMIT, Math.round((Date.now() - t0.current) / 1000)), baselineDay: asBaseline ? due : null });
        setState("rate");
      };
      rec.current = mr;
      t0.current = Date.now();
      setLeft(LIMIT);
      if (asBaseline) setTopic(BASELINE_PROMPT);
      mr.start(1000);
      setState("rec");
    } catch {
      setErr("Microphone blocked. Allow it in the browser's site settings.");
    }
  };

  const save = async () => {
    if (!pending) return;
    const object = `${today()}-${uuid().slice(0, 8)}.${extFor(pending.mime)}`;
    await saveBlob("recordings", object, pending.blob);
    const row = await repo.insert("speaking_recordings", {
      date: today(),
      storage_path: object,
      mime: pending.mime,
      duration_s: pending.seconds,
      topic,
      restarts: Number(rate.restarts) || 0,
      fillers: Number(rate.fillers) || 0,
      switches: Number(rate.switches) || 0,
      pace_rating: Number(rate.pace) || 3,
      is_baseline: pending.baselineDay !== null,
      baseline_day: pending.baselineDay,
    });
    await award("recording", "persona", "speaking_recordings", row.id, { quiet: true });
    await bumpPersona("english_min", Math.max(1, Math.round(pending.seconds / 60)));
    setPending(null);
    setState("idle");
    setRate({ restarts: "0", fillers: "0", switches: "0", pace: "3" });
    toast.ok("Saved privately.", Number(rate.restarts) === 0 ? "Zero restarts. That's the goal." : "Rephrase and keep going next time.");
  };

  return (
    <div className="bento">
      <div className="span-12 notice">
        <span className="micro">90-day target</span>
        <span className="small">5 minutes on a technical topic, no restarts, no Marathi switching, then Q&amp;A.</span>
      </div>
      <Card className="span-8" eyebrow={state === "rec" ? "recording" : baselineMode ? `Baseline ${due === 0 ? "" : `day ${due} redo `}due` : "Random topic"} title={state === "rec" ? fmtClock(left) : "2-minute drill"}>
        <p className="display" style={{ fontSize: "var(--fs-xl)", lineHeight: 1.3, margin: "8px 0 16px" }}>{state === "idle" && baselineMode ? BASELINE_PROMPT : topic}</p>
        {state === "idle" ? (
          <div className="row wrap">
            {baselineMode ? (
              <Button variant="accent" icon="mic" onClick={() => void start(true)}>Record baseline{due ? ` (day ${due})` : ""}</Button>
            ) : null}
            <Button variant={baselineMode ? "default" : "accent"} icon="mic" onClick={() => void start(false)}>Record 2 min</Button>
            <Button variant="ghost" icon="refresh" onClick={() => setTopic(SPEAKING_PROMPTS[1 + Math.floor(Math.random() * (SPEAKING_PROMPTS.length - 1))])}>New topic</Button>
          </div>
        ) : state === "rec" ? (
          <div className="stack">
            <div className="bar-track" style={{ height: 8 }}><div className="bar-fill" style={{ transform: `scaleX(${1 - left / LIMIT})` }} /></div>
            <Button variant="danger" icon="stop" onClick={() => rec.current?.stop()}>Stop</Button>
          </div>
        ) : (
          <form className="stack" onSubmit={(e) => { e.preventDefault(); void save(); }}>
            <span className="micro">Be honest. Nobody else sees this.</span>
            <div className="form-grid">
              <Input label="Restarts" inputMode="numeric" value={rate.restarts} onChange={(e) => setRate({ ...rate, restarts: e.target.value })} />
              <Input label="Fillers (rough)" inputMode="numeric" value={rate.fillers} onChange={(e) => setRate({ ...rate, fillers: e.target.value })} />
              <Input label="Marathi/Hindi switches" inputMode="numeric" value={rate.switches} onChange={(e) => setRate({ ...rate, switches: e.target.value })} />
              <Select label="Pace" value={rate.pace} onChange={(e) => setRate({ ...rate, pace: e.target.value })} options={[{ value: "1", label: "1 · too slow" }, { value: "2", label: "2 · slow" }, { value: "3", label: "3 · about right" }, { value: "4", label: "4 · fast" }, { value: "5", label: "5 · rushed" }]} />
            </div>
            <div className="row">
              <Button type="submit" variant="primary">Save</Button>
              <Button variant="ghost" onClick={() => { setPending(null); setState("idle"); }}>Discard</Button>
            </div>
          </form>
        )}
        {err ? <p className="danger small" style={{ marginTop: 8 }}>{err}</p> : null}
      </Card>
      <Card className="span-4" title="Delivery checklist" edge>
        <ul className="text small" style={{ paddingLeft: 18, margin: 0, lineHeight: 1.8 }}>
          <li>Pace about 130-150 wpm.</li>
          <li>Voice drops at the end of statements.</li>
          <li>No restarts: rephrase and keep going.</li>
          <li>2-second pauses OK. Fillers not.</li>
          <li>PREP: Point, Reason, Example, Point.</li>
          <li>English only in pitches, Q&amp;A, interviews.</li>
        </ul>
      </Card>
      <Card className="span-12" eyebrow={base0 ? (nextBaseline(base0.date, baselines.map((b) => b.baseline_day ?? 0)) ? `Next redo: ${pretty(nextBaseline(base0.date, baselines.map((b) => b.baseline_day ?? 0))!.date)}` : "All baselines done") : "Record the first baseline"} title="Baseline: side by side">
        {baselines.length ? (
          <div className="cols-4" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))" }}>
            {baselines.map((b) => (
              <div key={b.id} className="card pad-sm stack tight">
                <span className="micro">Day {b.baseline_day} · {pretty(b.date)}</span>
                <Audio r={b} />
                <span className="xs muted">{b.restarts} restarts · {b.fillers} fillers · {b.switches} switches</span>
              </div>
            ))}
          </div>
        ) : (
          <Empty glyph="◉">No baseline yet. "Explain your best project to an interviewer", 2 minutes.</Empty>
        )}
      </Card>
      <Card className="span-12" title="Recordings" eyebrow="Private bucket · newest first">
        <ul className="list">
          {(recs ?? []).filter((r) => !r.is_baseline).slice(0, 10).map((r) => (
            <li key={r.id} style={{ flexWrap: "wrap" }}>
              <span className="stack tight" style={{ minWidth: 200, flex: 1 }}>
                <span className="small">{r.topic}</span>
                <span className="xs muted">{pretty(r.date)} · {r.duration_s}s · {r.restarts} restarts · {r.fillers} fillers</span>
              </span>
              <div style={{ flex: 1, minWidth: 220 }}><Audio r={r} /></div>
              <Chip>pace {r.pace_rating}</Chip>
              <IconButton icon="trash" size="sm" label="Delete recording" onClick={async () => { await deleteBlob("recordings", r.storage_path); await repo.remove("speaking_recordings", r.id); }} />
            </li>
          ))}
        </ul>
        {!(recs ?? []).some((r) => !r.is_baseline) ? <Empty>No drills yet. Two minutes. Go.</Empty> : null}
      </Card>
    </div>
  );
}
