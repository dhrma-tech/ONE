// Locked MIND modules (switched on in Settings › Modules): Cube timer, Mental math, Memory palace.
import { useCallback, useEffect, useRef, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "@/data/db";
import { repo } from "@/data/repo";
import { ao5, fmtMs, makeProblem, scramble, type DrillKind, type Problem } from "@/domain/mind";
import { today } from "@/lib/dates";
import { Button, Card, Chip, Empty, IconButton, Input, StatCard, toast } from "@/ui";

export function Cube() {
  const solves = useLiveQuery(async () => (await db.t("cube_solves").toArray()).filter((s) => !s.deleted_at).sort((a, b) => (a.created_at < b.created_at ? -1 : 1)), []);
  const [scr, setScr] = useState(() => scramble());
  const [state, setState] = useState<"idle" | "ready" | "running">("idle");
  const [ms, setMs] = useState(0);
  const t0 = useRef(0);
  useEffect(() => {
    if (state !== "running") return;
    const id = setInterval(() => setMs(Date.now() - t0.current), 31);
    return () => clearInterval(id);
  }, [state]);
  const press = useCallback(async () => {
    if (state === "running") {
      const time = Date.now() - t0.current;
      setState("idle");
      setMs(time);
      await repo.insert("cube_solves", { date: today(), time_ms: time, scramble: scr });
      setScr(scramble());
    } else {
      t0.current = Date.now();
      setMs(0);
      setState("running");
    }
  }, [state, scr]);
  useEffect(() => {
    const f = (e: KeyboardEvent) => {
      if (e.code === "Space" && (e.target as HTMLElement).tagName !== "INPUT") {
        e.preventDefault();
        void press();
      }
    };
    window.addEventListener("keydown", f);
    return () => window.removeEventListener("keydown", f);
  }, [press]);
  const times = (solves ?? []).map((s) => (s.dnf ? null : s.time_ms));
  const best = Math.min(...times.filter((x): x is number => x !== null));
  return (
    <div className="bento">
      <Card className="span-8" eyebrow="First target: under 2:00 · space to start/stop" title="Cube timer">
        <p className="mono" style={{ fontSize: 18, textAlign: "center", margin: "8px 0 16px" }}>{scr}</p>
        <button type="button" className="flash" style={{ width: "100%", fontSize: 64, fontFamily: "var(--font-mono)" }} onClick={() => void press()}>
          {fmtMs(ms)}
        </button>
        <div className="row" style={{ justifyContent: "center", marginTop: 8 }}>
          <Button size="sm" onClick={() => setScr(scramble())}>New scramble</Button>
        </div>
      </Card>
      <Card className="span-4" title="Stats">
        <div className="cols-2">
          <StatCard label="Best" value={Number.isFinite(best) ? best / 1000 : null} unit="s" decimals={2} />
          <StatCard label="Ao5" value={ao5(times) !== null ? ao5(times)! / 1000 : null} unit="s" decimals={2} />
          <StatCard label="Solves" value={solves?.length ?? 0} />
        </div>
        <ul className="list" style={{ marginTop: 12 }}>
          {(solves ?? []).slice(-5).reverse().map((s) => (
            <li key={s.id}>
              <span className="mono small grow">{s.dnf ? "DNF" : fmtMs(s.time_ms)}</span>
              <Chip on={s.dnf} onClick={() => void repo.patch("cube_solves", s.id, { dnf: !s.dnf })}>DNF</Chip>
              <IconButton icon="trash" size="sm" label="Delete solve" onClick={() => void repo.remove("cube_solves", s.id)} />
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}

export function MentalMath() {
  const [kind, setKind] = useState<DrillKind>("tables");
  const [running, setRunning] = useState(false);
  const [p, setP] = useState<Problem>(() => makeProblem("tables"));
  const [ans, setAns] = useState("");
  const [score, setScore] = useState({ ok: 0, total: 0 });
  const [left, setLeft] = useState(300);
  const started = useRef(0);
  const scoreRef = useRef(score);
  scoreRef.current = score;
  useEffect(() => {
    if (!running) return;
    const id = setInterval(() => {
      const l = 300 - Math.floor((Date.now() - started.current) / 1000);
      setLeft(l);
      if (l <= 0) {
        setRunning(false);
        const s = scoreRef.current;
        void repo.insert("math_drills", { date: today(), kind, correct: s.ok, total: s.total, seconds: 300 });
        toast.ok(`${s.ok}/${s.total} correct. Logged.`);
      }
    }, 250);
    return () => clearInterval(id);
  }, [running, kind]);
  const drills = useLiveQuery(async () => (await db.t("math_drills").toArray()).filter((d) => !d.deleted_at).slice(-5).reverse(), []);
  return (
    <Card eyebrow="5-minute drills" title="Mental math">
      {!running ? (
        <div className="stack">
          <div className="row wrap">
            {(["tables", "squares", "2x1", "2x2"] as DrillKind[]).map((k) => (
              <Chip key={k} on={kind === k} onClick={() => setKind(k)}>
                {{ tables: "Tables to 20", squares: "Squares to 30", "2x1": "2-digit × 1-digit", "2x2": "2-digit × 2-digit" }[k]}
              </Chip>
            ))}
          </div>
          <Button variant="accent" icon="play" onClick={() => { started.current = Date.now(); setScore({ ok: 0, total: 0 }); setP(makeProblem(kind)); setRunning(true); setLeft(300); }}>
            Start 5 minutes
          </Button>
          <ul className="list">
            {(drills ?? []).map((d) => (
              <li key={d.id}><span className="small grow">{d.date} · {d.kind}</span><span className="mono small">{d.correct}/{d.total}</span></li>
            ))}
          </ul>
        </div>
      ) : (
        <form
          className="stack"
          style={{ alignItems: "center" }}
          onSubmit={(e) => {
            e.preventDefault();
            const ok = Number(ans) === p.answer;
            setScore((s) => ({ ok: s.ok + (ok ? 1 : 0), total: s.total + 1 }));
            setAns("");
            setP(makeProblem(kind));
          }}
        >
          <span className="micro">{Math.floor(left / 60)}:{String(left % 60).padStart(2, "0")} · {score.ok}/{score.total}</span>
          <span className="display" style={{ fontSize: 56 }}>{p.op === "²" ? `${p.a}²` : `${p.a} × ${p.b}`}</span>
          <Input aria-label="Answer" autoFocus inputMode="numeric" value={ans} onChange={(e) => setAns(e.target.value)} style={{ maxWidth: 200, textAlign: "center", fontSize: 24 }} />
        </form>
      )}
    </Card>
  );
}

export function Palace() {
  const rows = useLiveQuery(async () => (await db.t("memory_palaces").toArray()).filter((r) => !r.deleted_at), []);
  const [title, setTitle] = useState("");
  return (
    <Card eyebrow="Loci lists · 2×15 min a week" title="Memory palace">
      <form className="row" onSubmit={(e) => { e.preventDefault(); if (title.trim()) void repo.insert("memory_palaces", { title: title.trim(), loci: [] }); setTitle(""); }}>
        <Input aria-label="Palace title" placeholder="e.g. Python built-ins in my room" value={title} onChange={(e) => setTitle(e.target.value)} />
        <Button type="submit" icon="plus">Palace</Button>
      </form>
      {(rows ?? []).map((p) => {
        const loci = (p.loci as { place: string; item: string }[]) ?? [];
        return (
          <div key={p.id} className="stage" style={{ marginTop: 12 }}>
            <div className="row between"><span className="small">{p.title}</span><IconButton icon="trash" size="sm" label="Delete palace" onClick={() => void repo.remove("memory_palaces", p.id)} /></div>
            <ol className="small text">
              {loci.map((l, i) => <li key={i}><strong>{l.place}</strong> → {l.item}</li>)}
            </ol>
            <form className="row" onSubmit={(e) => {
              e.preventDefault();
              const f = new FormData(e.currentTarget);
              const place = String(f.get("place") || "").trim();
              const item = String(f.get("item") || "").trim();
              if (place && item) void repo.patch("memory_palaces", p.id, { loci: [...loci, { place, item }] });
              e.currentTarget.reset();
            }}>
              <Input name="place" aria-label="Place" placeholder="Door" />
              <Input name="item" aria-label="Item" placeholder="len()" />
              <Button type="submit" size="sm">Add</Button>
            </form>
          </div>
        );
      })}
      {!rows?.length ? <Empty>No palaces yet. Your room is a hard drive.</Empty> : null}
    </Card>
  );
}
