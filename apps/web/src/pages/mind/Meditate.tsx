// Meditate: presets 5/10/20 + custom, slow breathing circle (4-4-6), optional soft bell (WebAudio, generated), no-UI mode.
import { useEffect, useRef, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "@/data/db";
import { BREATH, MEDITATION_PRESETS } from "@/domain/mind";
import { fmtClock, lastNDays } from "@/lib/dates";
import { logMeditation } from "@/services/log";
import { Button, Card, Chip, Input, StatCard, Switch, toast } from "@/ui";

/** Original bell: two decaying sine partials. No audio file shipped. */
function bell() {
  try {
    const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const ctx = new Ctx();
    const now = ctx.currentTime;
    for (const [f, g] of [
      [528, 0.25],
      [792, 0.08],
    ] as const) {
      const o = ctx.createOscillator();
      const gain = ctx.createGain();
      o.type = "sine";
      o.frequency.value = f;
      gain.gain.setValueAtTime(0.0001, now);
      gain.gain.exponentialRampToValueAtTime(g, now + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 4);
      o.connect(gain).connect(ctx.destination);
      o.start(now);
      o.stop(now + 4.1);
    }
    setTimeout(() => void ctx.close(), 4500);
  } catch {
    /* audio unavailable */
  }
}

export default function Meditate() {
  const [mins, setMins] = useState(10);
  const [custom, setCustom] = useState("");
  const [running, setRunning] = useState(false);
  const [left, setLeft] = useState(0);
  const [phase, setPhase] = useState<"in" | "hold" | "out">("in");
  const [sound, setSound] = useState(true);
  const [noUi, setNoUi] = useState(false);
  const started = useRef(0);
  const sessions = useLiveQuery(async () => (await db.t("meditation_sessions").toArray()).filter((s) => !s.deleted_at), []);
  const week = lastNDays(7);
  const weekMin = (sessions ?? []).filter((s) => week.includes(s.date)).reduce((a, s) => a + s.minutes, 0);
  const days = new Set((sessions ?? []).map((s) => s.date));
  let streak = 0;
  for (let i = 0; ; i++) {
    const d = lastNDays(i + 1)[0];
    if (days.has(d)) streak++;
    else if (i > 0) break;
    if (i > 400) break;
  }

  useEffect(() => {
    if (!running) return;
    const total = mins * 60;
    const id = setInterval(() => {
      const el = Math.floor((Date.now() - started.current) / 1000);
      setLeft(Math.max(0, total - el));
      const cyc = el % (BREATH.in + BREATH.hold + BREATH.out);
      setPhase(cyc < BREATH.in ? "in" : cyc < BREATH.in + BREATH.hold ? "hold" : "out");
      if (el >= total) {
        clearInterval(id);
        setRunning(false);
        setNoUi(false);
        if (sound) bell();
        void logMeditation(mins, `${mins} min`).then(() => toast.ok(`${mins} minutes. Calm, logged.`, "Breathe, astronaut."));
      }
    }, 250);
    return () => clearInterval(id);
  }, [running, mins, sound]);

  const start = () => {
    started.current = Date.now();
    setLeft(mins * 60);
    setRunning(true);
    if (sound) bell();
  };

  if (running && noUi)
    return (
      <button type="button" aria-label="Meditating. Tap to show the timer." onClick={() => setNoUi(false)} style={{ position: "fixed", inset: 0, background: "#000", zIndex: 400, cursor: "default" }}>
        <span className="sr-only">{fmtClock(left)} left</span>
      </button>
    );

  return (
    <div className="bento">
      <Card className="span-8" title={running ? fmtClock(left) : "Sit. Breathe."} eyebrow={running ? phase === "in" ? "breathe in" : phase === "hold" ? "hold" : "breathe out" : "4 in · 4 hold · 6 out"}>
        <div className="breath" data-phase={running ? phase : "out"} aria-hidden />
        {running ? (
          <div className="row" style={{ justifyContent: "center" }}>
            <Button onClick={() => setNoUi(true)}>No-UI mode</Button>
            <Button
              variant="ghost"
              onClick={() => {
                const done = Math.floor((Date.now() - started.current) / 60000);
                setRunning(false);
                if (done >= 1) void logMeditation(done, "stopped early").then(() => toast.ok(`${done} min logged. Partial still counts.`));
              }}
            >
              Stop
            </Button>
          </div>
        ) : (
          <div className="stack" style={{ alignItems: "center" }}>
            <div className="row wrap" style={{ justifyContent: "center" }}>
              {MEDITATION_PRESETS.map((m) => (
                <Chip key={m} on={mins === m} onClick={() => setMins(m)}>
                  {m} min
                </Chip>
              ))}
              <Input aria-label="Custom minutes" placeholder="custom" inputMode="numeric" value={custom} onChange={(e) => { setCustom(e.target.value); if (Number(e.target.value) > 0) setMins(Math.min(120, Number(e.target.value))); }} style={{ width: 90 }} />
            </div>
            <Switch checked={sound} onChange={setSound} label="Soft bell at start and end" />
            <Button variant="accent" size="lg" icon="play" onClick={start}>
              Start {mins} min
            </Button>
          </div>
        )}
      </Card>
      <Card className="span-4" title="Practice">
        <div className="cols-2">
          <StatCard label="This week" value={weekMin} unit="min" />
          <StatCard label="Streak" value={streak} unit="d" />
          <StatCard label="Sessions" value={sessions?.length ?? 0} />
        </div>
        <p className="xs muted" style={{ marginTop: 12 }}>Counts for the weekly grade: meditation on 5 of 7 days.</p>
      </Card>
    </div>
  );
}
