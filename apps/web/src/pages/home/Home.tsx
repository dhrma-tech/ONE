import { useEffect, useMemo, useState, type CSSProperties } from "react";
import { Link } from "react-router-dom";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "@/data/db";
import type { Rows } from "@/data/types.gen";
import { daysBetween, istHour, pretty, reviewDate, today, weekStart, addDays } from "@/lib/dates";
import { SECTIONS, type SectionId } from "@/lib/sections";
import { quoteOfDay } from "@/seed/quotes";
import { useProfile, useSettings } from "@/services/settings";
import { useSummary } from "@/services/summary";
import { useWeek } from "@/services/grade";
import { useNextUp } from "@/services/library";
import { addTask, ensureTodayTasks, makeOneThing, setTaskDone } from "@/services/tasks";
import { ACHIEVEMENTS } from "@/domain/achievements";
import { FocusStrip } from "@/modules/focus";
import { NightlyReview } from "@/modules/review";
import { CalendarToday } from "@/modules/calendar";
import { ExamBanner } from "@/modules/exam";
import {
  Banner, Button, Card, Chip, ContributionGrid, Empty, Footer, Icon, IconButton, IndexTable, Input, PillButton,
  ProgressBar, ProgressRing, QuoteBlock, Select, StatCard, useNow,
} from "@/ui";
import { VideoCard } from "@/ui/video";
import { env } from "@/env";
import { boot } from "@/app/boot";

const LABEL: Record<SectionId, string> = { career: "Career", mind: "Mind", body: "Body", persona: "Persona" };

function Avatar({ url, name }: { url?: string | null; name: string }) {
  const initials = name
    .split(/\s+/)
    .map((w) => w[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
  return (
    <div className="avatar" aria-hidden>
      {url ? <img src={url} alt="" /> : <span>{initials}</span>}
    </div>
  );
}

function ProfileHero() {
  const profile = useProfile();
  const sum = useSummary();
  const name = profile?.name ?? "Dharmaraj Aparadh";
  const day = profile?.lock_in_start_date ? daysBetween(profile.lock_in_start_date, today()) + 1 : null;
  const lvl = sum?.xp.level;
  return (
    <section className="hero span-12" aria-label="Profile">
      <Banner scene="home" />
      <div className="hero-card">
        <Avatar url={profile?.photo_url} name={name} />
        <div className="hero-id">
          <h1 className="hero-name">{name}</h1>
          <span className="muted small">
            {profile?.tagline ?? "AI Engineer in training"} · <span className="mono xs">@dhrma-tech</span>
          </span>
        </div>
        <div className="hero-stats">
          <div className="hero-stat">
            <span className="micro">Day</span>
            <span className="display num-xl">{day ?? "—"}</span>
          </div>
          <div className="hero-stat">
            <span className="micro">Level</span>
            <span className="display num-xl">{lvl?.level ?? 1}</span>
            <ProgressBar value={lvl?.pct ?? 0} label={`XP to level ${(lvl?.level ?? 1) + 1}`} />
            <span className="xs muted mono">
              {lvl?.into ?? 0}/{lvl?.need ?? 100} xp
            </span>
          </div>
          <div className="hero-stat">
            <span className="micro row">
              <Icon name="flame" size={12} /> Streak
            </span>
            <span className="display num-xl">{sum?.overall.current ?? 0}</span>
            {sum?.overall.missedYesterday ? <span className="xs warn-text">Missed one. 20-minute minimum today.</span> : null}
          </div>
        </div>
      </div>
    </section>
  );
}

function TaskRow({ t }: { t: Rows["tasks"] }) {
  return (
    <li className={`check-row${t.done_at ? " done" : ""}`}>
      <input
        type="checkbox"
        className="checkbox"
        checked={!!t.done_at}
        onChange={(e) => void setTaskDone(t, e.target.checked)}
        aria-label={t.title}
        style={{ "--check-color": `var(--accent-${t.section === "home" ? "home" : t.section})` } as CSSProperties}
      />
      <span className="check-label grow">{t.title}</span>
      <IconButton icon="star" size="sm" label={t.is_one_thing ? "Unpin One Thing" : "Make this the One Thing"} onClick={() => void makeOneThing(t)} className={t.is_one_thing ? "accent" : ""} />
    </li>
  );
}

function Today() {
  const d = today();
  const tasks = useLiveQuery(async () => (await db.t("tasks").where("due_date").equals(d).toArray()).filter((t) => !t.deleted_at), [d]);
  const [title, setTitle] = useState("");
  const [section, setSection] = useState<string>("career");
  useEffect(() => {
    void boot().then(() => ensureTodayTasks(d));
  }, [d]);
  const one = tasks?.find((t) => t.is_one_thing);
  const groups = useMemo(() => {
    const g: Record<string, Rows["tasks"][]> = {};
    for (const t of tasks ?? []) if (!t.is_one_thing) (g[t.section] ??= []).push(t);
    for (const k of Object.keys(g)) g[k].sort((a, b) => Number(!!a.done_at) - Number(!!b.done_at) || a.priority - b.priority);
    return g;
  }, [tasks]);
  const done = (tasks ?? []).filter((t) => t.done_at).length;
  return (
    <Card className="span-8 stretch" eyebrow={pretty(d)} title="Today" right={<span className="micro">{done}/{tasks?.length ?? 0} done</span>}>
      <div className="one-thing" data-done={one?.done_at ? 1 : 0}>
        <span className="micro">The One Thing</span>
        {one ? (
          <label className="row" style={{ gap: 14 }}>
            <input type="checkbox" className="checkbox lg" checked={!!one.done_at} onChange={(e) => void setTaskDone(one, e.target.checked)} aria-label={`One Thing: ${one.title}`} />
            <span className="one-thing-title">{one.title}</span>
          </label>
        ) : (
          <p className="muted small">Nothing pinned. Star a task below, or set it in tonight's review.</p>
        )}
      </div>
      <div className="task-groups">
        {SECTIONS.filter((s) => groups[s]?.length).map((s) => (
          <div key={s} data-section={s}>
            <span className="micro accent">{LABEL[s]}</span>
            <ul className="checklist">
              {groups[s].map((t) => (
                <TaskRow key={t.id} t={t} />
              ))}
            </ul>
          </div>
        ))}
        {!tasks?.length ? <Empty>No tasks yet. Suspiciously quiet.</Empty> : null}
      </div>
      <form
        className="row"
        style={{ marginTop: 12 }}
        onSubmit={(e) => {
          e.preventDefault();
          void addTask(title, section);
          setTitle("");
        }}
      >
        <Input aria-label="New task" placeholder="Add a task…" value={title} onChange={(e) => setTitle(e.target.value)} />
        <Select aria-label="Section" value={section} onChange={(e) => setSection(e.target.value)} options={SECTIONS.map((s) => ({ value: s, label: LABEL[s] }))} style={{ width: 120 }} />
        <IconButton icon="plus" label="Add task" type="submit" />
      </form>
    </Card>
  );
}

function SectionTiles() {
  const sum = useSummary();
  const keyStat = useLiveQuery(async () => {
    const ws = weekStart(today());
    const focus = (await db.t("focus_sessions").toArray()).filter((s) => !s.deleted_at && s.kind === "block1" && s.date >= ws);
    const chess = (await db.t("chess_snapshots").toArray()).filter((c) => !c.deleted_at && c.rapid).sort((a, b) => (a.date < b.date ? 1 : -1))[0];
    const w = (await db.t("weigh_ins").toArray()).filter((x) => !x.deleted_at).sort((a, b) => (a.date < b.date ? 1 : -1))[0];
    const posts = (await db.t("posts").toArray()).filter((p) => !p.deleted_at && p.status === "published" && (p.published_at ?? "") >= ws).length;
    return {
      career: `${(focus.reduce((a, s) => a + s.minutes, 0) / 60).toFixed(1)} h Python this week`,
      mind: chess ? `Rapid ${chess.rapid}` : "Rapid —",
      body: w ? `${Number(w.weight_kg).toFixed(1)} kg` : "No weigh-in yet",
      persona: `${posts} post${posts === 1 ? "" : "s"} this week`,
    } as Record<SectionId, string>;
  }, []);
  return (
    <div className="span-12">
      <IndexTable label="Sections" right={`04 entries · ${sum ? Object.values(sum.todaySections).filter((s) => s.done).length : 0} done today`}>
        {SECTIONS.map((s, i) => {
          const sec = sum?.todaySections[s];
          return (
            <Link key={s} to={`/${s}`} className={`index-row tile-row${sec?.done ? " active" : ""}`} style={{ "--row-accent": `var(--accent-${s})` } as CSSProperties}>
              <span className="idx">{String(i + 1).padStart(2, "0")}</span>
              <span className="micro cat cat-col">{LABEL[s]}</span>
              <span className="ttl row" style={{ gap: 14 }}>
                <ProgressRing value={sec?.progress ?? 0} size={40} label={`${LABEL[s]} today`} color={`var(--accent-${s})`} />
                <span className="stack tight" style={{ minWidth: 0 }}>
                  <span className="truncate">{keyStat?.[s] ?? "…"}</span>
                  <span className="xs muted truncate">{sec?.note}</span>
                </span>
              </span>
              <span className="muted small row">
                <Icon name="flame" size={12} />
                {sum?.sectionStreaks[s].current ?? 0}
              </span>
              <span className="go" aria-hidden>
                <Icon name="arrow" size={14} />
              </span>
            </Link>
          );
        })}
      </IndexTable>
    </div>
  );
}

function WeekStrip() {
  const w = useWeek();
  if (!w) return <Card className="span-4" title="This week">…</Card>;
  return (
    <Card className="span-4 stretch" eyebrow={`Week of ${pretty(w.weekStart)}`} title="This week" right={<span className={`grade grade-${w.grade}`} aria-label={`Live grade ${w.grade}`}>{w.grade}</span>}>
      <div className="cols-2">
        <StatCard label="Focus" value={w.focusMin / 60} unit="h" decimals={1} />
        <StatCard label="Gym" value={w.gym} unit={`/${w.targets.gym_sessions_week}`} />
        <StatCard label="Pushes" value={w.pushes} />
        <StatCard label="Checks" value={w.score} unit="/9" />
      </div>
      <p className={`xs ${w.rewardUnlocked ? "ok-text" : "muted"}`} style={{ marginTop: 12 }}>
        {w.rewardUnlocked ? "2 episodes unlocked. Earned, not given." : "Episodes unlock with gym 3/3 + weigh-in + Block 1 ≥ 5/7."}
      </p>
      <div style={{ marginTop: 8 }}>
        <PillButton to="/review/week">Weekly review</PillButton>
      </div>
    </Card>
  );
}

function NextUpCard() {
  const v = useNextUp();
  return (
    <Card className="span-6 stretch" eyebrow="Library" title="Next up" right={<PillButton to="/career/library">Library</PillButton>}>
      {v ? (
        <div style={{ maxWidth: 420 }}>
          <VideoCard v={{ ...v, frame: v.frame, status: v.progress?.status, position_s: v.progress?.position_s }} to={`/${v.section}/library/watch/${v.id}`} />
        </div>
      ) : (
        <Empty glyph="▶">No approved videos yet. The Inbox has candidates waiting for your verdict.</Empty>
      )}
    </Card>
  );
}

function Achievements() {
  const unlocks = useLiveQuery(async () => (await db.t("achievement_unlocks").toArray()).filter((u) => !u.deleted_at), []);
  const got = new Set((unlocks ?? []).map((u) => u.code));
  const recent = [...(unlocks ?? [])].sort((a, b) => (a.unlocked_at < b.unlocked_at ? 1 : -1)).slice(0, 3);
  const locked = ACHIEVEMENTS.filter((a) => !got.has(a.code)).slice(0, 3);
  return (
    <Card className="span-4 stretch" eyebrow={`${got.size}/${ACHIEVEMENTS.length}`} title="Achievements">
      <ul className="ach-list">
        {recent.map((u) => {
          const a = ACHIEVEMENTS.find((x) => x.code === u.code);
          return a ? (
            <li key={u.code} className="ach">
              <span className="ach-icon">
                <Icon name="trophy" size={16} />
              </span>
              <span className="stack tight">
                <span className="small">{a.title}</span>
                <span className="xs muted">{a.desc}</span>
              </span>
            </li>
          ) : null;
        })}
        {locked.map((a) => (
          <li key={a.code} className="ach locked" aria-label={`Locked: ${a.title}. ${a.desc}`}>
            <span className="ach-icon">
              <Icon name="lock" size={14} />
            </span>
            <span className="stack tight">
              <span className="small">{a.title}</span>
              <span className="xs muted">{a.desc}</span>
            </span>
          </li>
        ))}
      </ul>
    </Card>
  );
}

function ReviewCard({ prominent }: { prominent: boolean }) {
  const d = reviewDate();
  const sum = useSummary();
  const [open, setOpen] = useState(prominent);
  useEffect(() => setOpen(prominent), [prominent]);
  const facts = sum?.facts.get(d);
  return (
    <Card id="review" className={prominent ? "span-12 review-card hot" : "span-8 review-card"} edge={prominent} eyebrow={`${pretty(d)} · reminder 11:30 PM`} title="Nightly review" right={!prominent ? <Button size="sm" onClick={() => setOpen((o) => !o)}>{open ? "Hide" : "Open"}</Button> : null}>
      {open ? <NightlyReview date={d} facts={facts} /> : <p className="muted small">Opens up properly after 9 PM. Or now, if you're early.</p>}
    </Card>
  );
}

export default function Home() {
  const now = useNow(60_000);
  const settings = useSettings();
  const sum = useSummary();
  const profile = useProfile();
  const prominent = istHour(now) >= 21 || istHour(now) < 4;
  const q = quoteOfDay(today());
  const day = profile?.lock_in_start_date ? daysBetween(profile.lock_in_start_date, today()) + 1 : null;
  const gridDays = sum?.masterGrid ?? [];
  const activeDays = gridDays.filter((g) => g.level > 0).length;
  return (
    <div className="page" data-section="home">
      <div className="bento">
        <ProfileHero />
        {settings?.exam_mode ? <ExamBanner /> : null}
        {prominent ? <ReviewCard prominent /> : null}
        <Today />
        <CalendarToday className="span-4 stretch" />
        <SectionTiles />
        <Card className="span-8" eyebrow="Last 53 weeks" title="Master grid" right={<span className="micro">level = sections done</span>}>
          <ContributionGrid days={gridDays} label="Days by sections done" summary={`${activeDays} active days · best streak ${sum?.overall.best ?? 0}`} end={addDays(today(), 0)} />
        </Card>
        <WeekStrip />
        <Card className="span-6 stretch" eyebrow="Focus" title="Terminal">
          <FocusStrip block1Target={sum?.ctx.targets.block1_min ?? 90} />
        </Card>
        <NextUpCard />
        {!prominent ? <ReviewCard prominent={false} /> : null}
        <Achievements />
        <div className="span-12">
          <QuoteBlock text={q.text} by={q.by} source={q.source} />
        </div>
      </div>
      <Footer day={day} version={env.version} />
      <div className="row" style={{ justifyContent: "center", marginTop: 8 }}>
        <Chip>{sum ? `${sum.xp.total} xp total` : "…"}</Chip>
      </div>
    </div>
  );
}
