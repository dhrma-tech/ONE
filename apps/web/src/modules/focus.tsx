// Focus timer: terminal strip with Run/Stop, presets 25/50/90, phone-free check at the end.
// While running, ONE dims and other sections lock (html[data-focus="on"]); state survives reloads.
import { useEffect, useState, useSyncExternalStore } from "react";
import { repo } from "@/data/repo";
import { award } from "@/services/xp";
import { focusXp } from "@/domain/xp";
import { db } from "@/data/db";
import { fmtClock, isoDate } from "@/lib/dates";
import { Button, Chip, Modal, Select, Switch, TerminalStrip, toast } from "@/ui";
import type { SectionId } from "@/lib/sections";

export type FocusKind = "block1" | "block2" | "block3" | "study" | "free";

interface FocusState {
  running: boolean;
  startedAt: number;
  plannedMin: number;
  label: string;
  section: SectionId;
  kind: FocusKind;
}

const KEY = "one.focus";
const read = (): FocusState => {
  try {
    const s = JSON.parse(localStorage.getItem(KEY) || "null");
    if (s && typeof s.startedAt === "number") return s;
  } catch {
    /* ignore */
  }
  return { running: false, startedAt: 0, plannedMin: 90, label: "python block 1", section: "career", kind: "block1" };
};
let state = read();
const subs = new Set<() => void>();
const apply = () => {
  document.documentElement.dataset.focus = state.running ? "on" : "off";
};
const set = (p: Partial<FocusState>) => {
  state = { ...state, ...p };
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
  } catch {
    /* ignore */
  }
  apply();
  subs.forEach((f) => f());
};
if (typeof document !== "undefined") apply();

export const focus = {
  get: () => state,
  start(p: Partial<Omit<FocusState, "running" | "startedAt">> = {}) {
    set({ ...p, running: true, startedAt: Date.now() });
  },
  cancel() {
    set({ running: false });
  },
  configure(p: Partial<Omit<FocusState, "running" | "startedAt">>) {
    if (!state.running) set(p);
  },
};

export function useFocus(): FocusState {
  return useSyncExternalStore(
    (cb) => {
      subs.add(cb);
      return () => subs.delete(cb);
    },
    () => state,
  );
}

function useTick(on: boolean) {
  const [, setN] = useState(0);
  useEffect(() => {
    if (!on) return;
    const id = setInterval(() => setN((n) => n + 1), 1000);
    return () => clearInterval(id);
  }, [on]);
}

/** Save a finished session: focus_sessions row + XP (+ block1_done when the day crosses the target). */
export async function logFocus(p: { section: SectionId; kind: FocusKind; label: string; startedAt: number; minutes: number; phoneFree: boolean; block1Target: number }) {
  if (p.minutes < 1) return;
  const date = isoDate(new Date(p.startedAt));
  const before = (await db.t("focus_sessions").where("date").equals(date).toArray()).filter((s) => !s.deleted_at);
  const row = await repo.insert("focus_sessions", {
    date,
    section: p.section,
    kind: p.kind,
    label: p.label,
    started_at: new Date(p.startedAt).toISOString(),
    ended_at: new Date().toISOString(),
    minutes: p.minutes,
    phone_free: p.phoneFree,
  });
  const xpToday = (await db.t("xp_events").where("date").equals(date).toArray()).filter((e) => e.kind === "focus_minutes" && !e.deleted_at).reduce((a, e) => a + e.points, 0);
  await award("focus_minutes", p.section, "focus_sessions", row.id, { date, points: focusXp(p.minutes, xpToday), quiet: true });
  if (p.kind === "block1") {
    const prev = before.filter((s) => s.kind === "block1").reduce((a, s) => a + s.minutes, 0);
    if (prev < p.block1Target && prev + p.minutes >= p.block1Target) await award("block1_done", "career", "block1", date, { date });
  }
}

const PRESETS = [25, 50, 90];
const KINDS: { value: FocusKind; label: string; section: SectionId }[] = [
  { value: "block1", label: "Block 1 · Python (no AI)", section: "career" },
  { value: "block2", label: "Block 2 · LLM concepts", section: "career" },
  { value: "block3", label: "Block 3 · Practice / exam prep", section: "career" },
  { value: "study", label: "College study", section: "career" },
  { value: "free", label: "Free focus", section: "mind" },
];

/** The focus strip (Home, CAREER, MIND › Focus). */
export function FocusStrip({ block1Target = 90, compact }: { block1Target?: number; compact?: boolean }) {
  const s = useFocus();
  useTick(s.running);
  const [finish, setFinish] = useState<{ minutes: number } | null>(null);
  const [phoneFree, setPhoneFree] = useState(true);
  const elapsed = s.running ? Math.floor((Date.now() - s.startedAt) / 1000) : 0;
  const left = s.plannedMin * 60 - elapsed;
  const time = s.running ? (left >= 0 ? fmtClock(left) : `+${fmtClock(-left)}`) : fmtClock(s.plannedMin * 60);

  useEffect(() => {
    if (s.running && left === 0) toast.ok("Time. Finish the thought, then Stop.");
  }, [s.running, left]);

  return (
    <div className={s.running ? "focus-keep stack" : "stack"}>
      <TerminalStrip
        label={s.label}
        time={time}
        running={s.running}
        onRun={() => focus.start({})}
        onStop={() => setFinish({ minutes: Math.max(1, Math.round(elapsed / 60)) })}
      />
      {!s.running && !compact ? (
        <div className="row wrap">
          {PRESETS.map((m) => (
            <Chip key={m} on={s.plannedMin === m} onClick={() => focus.configure({ plannedMin: m })}>
              {m} min
            </Chip>
          ))}
          <Select
            aria-label="Focus kind"
            value={s.kind}
            onChange={(e) => {
              const k = KINDS.find((x) => x.value === e.target.value)!;
              focus.configure({ kind: k.value, section: k.section, label: k.label.split(" · ").join(" ").toLowerCase() });
            }}
            options={KINDS.map((k) => ({ value: k.value, label: k.label }))}
            style={{ width: "auto", minHeight: 28, paddingTop: 2, paddingBottom: 2 }}
          />
        </div>
      ) : null}
      {s.running ? (
        <div className="row">
          <span className="micro">Focus mode on. Other sections are locked.</span>
          <span className="grow" />
          <Button size="sm" variant="ghost" onClick={() => focus.cancel()}>
            Exit focus (discard)
          </Button>
        </div>
      ) : null}
      <Modal open={!!finish} onClose={() => setFinish(null)} title="Session done">
        <div className="stack">
          <p className="display" style={{ fontSize: 40 }}>
            {finish?.minutes} min
          </p>
          <Switch checked={phoneFree} onChange={setPhoneFree} label="Phone was in another room (phone-free)" />
          <div className="row">
            <Button
              variant="primary"
              onClick={async () => {
                const f = finish!;
                setFinish(null);
                focus.cancel();
                await logFocus({ section: s.section, kind: s.kind, label: s.label, startedAt: s.startedAt, minutes: f.minutes, phoneFree, block1Target });
                toast.ok("Logged.", s.kind === "block1" ? "Block 1 counted. The snake respects you." : undefined);
              }}
            >
              Log it
            </Button>
            <Button variant="ghost" onClick={() => setFinish(null)}>
              Keep going
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

/** Small global bar shown on every page while a session runs. */
export function FocusBar() {
  const s = useFocus();
  useTick(s.running);
  if (!s.running) return null;
  const left = s.plannedMin * 60 - Math.floor((Date.now() - s.startedAt) / 1000);
  return (
    <div className="focus-keep notice" data-section={s.section} style={{ marginBottom: 16 }} role="status">
      <span className="micro accent">Focus</span>
      <span className="grow truncate">{s.label}</span>
      <span className="num">{left >= 0 ? fmtClock(left) : `+${fmtClock(-left)}`}</span>
    </div>
  );
}

