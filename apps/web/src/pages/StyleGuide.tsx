import { useState } from "react";
import {
  Banner, Button, Card, Checklist, Chip, ContributionGrid, Countdown, Empty, Field, HandArrow, IconButton, IndexRow,
  IndexTable, Input, Kbd, Modal, Pager, PillButton, PillDivider, ProgressBar, ProgressRing, QuoteBlock, SectionFrame,
  SectionHeader, Seg, Select, Sheet, Skeleton, Stars, StatCard, Stepper, Switch, Tabs, TerminalStrip, Textarea,
  TrendChart, toast, Footer, type GridDay,
} from "@/ui";
import { Icon, type IconName } from "@/ui/icons";
import { addDays, today } from "@/lib/dates";
import { ui, useUI } from "@/data/ui";

const ICONS: IconName[] = ["home", "career", "mind", "body", "persona", "settings", "search", "arrow", "check", "plus", "x", "play", "stop", "music", "sun", "moon", "star", "flame", "clock", "calendar", "trash", "edit", "lock", "mic", "camera", "note", "book", "grid", "chart", "trophy", "focus", "drop", "scale", "bolt", "chess", "inbox", "copy", "refresh", "download", "upload", "send", "code", "news", "flag", "heart", "leaf"];

function fakeDays(seed = 3): GridDay[] {
  let s = seed;
  const r = () => ((s = (s * 9301 + 49297) % 233280) / 233280);
  return Array.from({ length: 370 }, (_, i) => ({ date: addDays(today(), -i), level: (r() > 0.35 ? Math.floor(r() * 5) : 0) as GridDay["level"] }));
}

/** Hidden living style guide: every component in every state. Route: /ui */
export default function StyleGuide() {
  const { theme } = useUI();
  const [tab, setTab] = useState("one");
  const [range, setRange] = useState<"week" | "month" | "year">("week");
  const [sw, setSw] = useState(true);
  const [num, setNum] = useState(52.4);
  const [stars, setStars] = useState(3);
  const [modal, setModal] = useState(false);
  const [sheet, setSheet] = useState(false);
  const [page, setPage] = useState(0);
  const [running, setRunning] = useState(false);
  const [checks, setChecks] = useState([
    { id: "a", label: "Python Block 1 (90 min)", done: true, section: "career" },
    { id: "b", label: "Meditate 10 min", done: false, section: "mind" },
    { id: "c", label: "Gym 6:30, Full Body A", done: false, section: "body" },
    { id: "d", label: "10 connection requests", done: false, section: "persona" },
  ]);

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <span className="micro">Living style guide · /ui</span>
          <h1 className="page-title">
            ONE design system<span className="dot">.</span>
          </h1>
        </div>
        <Button icon={theme === "dark" ? "sun" : "moon"} onClick={() => ui.toggleTheme()}>
          Theme: {theme}
        </Button>
      </div>

      <SectionFrame>
        <SectionHeader eyebrow="Tokens" title="Section accents" />
        <div className="cols-4">
          {(["career", "mind", "body", "persona"] as const).map((s, i) => (
            <div key={s} data-section={s} className="card pad-sm row">
              <span style={{ width: 28, height: 28, background: "var(--accent)", borderRadius: 2 }} />
              <span>
                <span className="micro">0{i + 1}</span> <span className="accent">{s.toUpperCase()}</span>
              </span>
            </div>
          ))}
        </div>
        <div className="row wrap" style={{ marginTop: 16 }}>
          {[0, 1, 2, 3, 4].map((l) => (
            <span key={l} className="chip">
              <i style={{ width: 10, height: 10, background: `var(--contrib-${l})`, display: "block" }} /> contrib-{l}
            </span>
          ))}
        </div>
      </SectionFrame>

      <SectionFrame>
        <SectionHeader eyebrow="Art" title="Banner scenes" />
        <div className="cols-2">
          {(["home", "career", "mind", "body", "persona", "settings"] as const).map((s) => (
            <Banner key={s} scene={s} label={s} />
          ))}
        </div>
      </SectionFrame>

      <div className="bento">
        <Card className="span-6" title="Type" eyebrow="Fonts">
          <div className="stack">
            <span className="display" style={{ fontSize: 40 }}>Pixelify display 42</span>
            <span>Geist Pixel Square UI text, weight 500.</span>
            <span className="num" style={{ fontSize: 28 }}>Geist Mono 1,234.5</span>
            <p className="text">Inter for long text: journals, notes and anything longer than two lines stays readable.</p>
            <span className="micro">Micro label · uppercase · tracked</span>
          </div>
        </Card>
        <Card className="span-6" title="Buttons" eyebrow="Actions">
          <div className="stack">
            <div className="row wrap">
              <Button>Default</Button>
              <Button variant="primary">Primary</Button>
              <Button variant="accent" icon="play">Accent</Button>
              <Button variant="ghost">Ghost</Button>
              <Button variant="danger" icon="trash">Danger</Button>
              <Button disabled>Disabled</Button>
            </div>
            <div className="row wrap">
              <Button size="sm">Small</Button>
              <Button size="lg">Large</Button>
              <IconButton icon="edit" label="Edit" />
              <IconButton icon="arrow" label="Go" round />
              <PillButton onClick={() => toast.ok("Logged.", "Go sleep, Cooper.")}>Show toast</PillButton>
            </div>
            <PillDivider onClick={() => toast.ok("Nothing to show. Yet.")}>Show all experience</PillDivider>
            <div className="row wrap">
              <Chip>Default</Chip>
              <Chip tone="ok" dot>Connected</Chip>
              <Chip tone="warn" dot>Stale</Chip>
              <Chip tone="bad" dot>Error</Chip>
              <Chip section="mind" on onClick={() => undefined}>Toggle on</Chip>
              <Kbd>Ctrl</Kbd>
              <Kbd>K</Kbd>
            </div>
          </div>
        </Card>

        <Card className="span-4" title="Stats" eyebrow="Count-up">
          <div className="cols-2">
            <StatCard label="Python this week" value={6.5} unit="h" decimals={1} delta={{ value: 1.5, unit: "h" }} />
            <StatCard label="Weight" value={51.2} unit="kg" decimals={1} delta={{ value: 0.3, unit: "kg" }} />
            <StatCard label="Rapid" value={812} delta={{ value: -12 }} />
            <StatCard label="No data" value={null} />
          </div>
        </Card>
        <Card className="span-4" title="Progress" eyebrow="Rings and bars">
          <div className="row wrap" style={{ gap: 16 }}>
            {(["career", "mind", "body", "persona"] as const).map((s, i) => (
              <ProgressRing key={s} value={[0.9, 0.4, 1, 0.15][i]} label={s} color={`var(--accent-${s})`} size={56} />
            ))}
          </div>
          <div className="stack" style={{ marginTop: 16 }}>
            <ProgressBar value={0.62} label="Units cracked" />
            <ProgressBar value={0.2} label="Protein" color="var(--accent-body)" />
          </div>
        </Card>
        <Card className="span-4" title="Forms" eyebrow="Inputs">
          <div className="stack">
            <Input label="Task" placeholder="Add a task…" />
            <Select label="Section" options={[{ value: "career", label: "Career" }, { value: "mind", label: "Mind" }]} />
            <Textarea label="Went well" placeholder="One line." />
            <Field label="Weight (kg)">
              <Stepper value={num} onChange={setNum} step={0.1} label="Weight" />
            </Field>
            <Switch checked={sw} onChange={setSw} label="Reduced motion" />
            <Stars value={stars} onChange={setStars} />
          </div>
        </Card>

        <Card className="span-8" title="Contribution grid" eyebrow="Settle + today pulse">
          <ContributionGrid days={fakeDays()} label="Demo activity" />
        </Card>
        <Card className="span-4" title="Checklist" eyebrow="Today">
          <Checklist items={checks} onToggle={(id, done) => setChecks((c) => c.map((x) => (x.id === id ? { ...x, done } : x)))} />
        </Card>

        <Card className="span-6" title="Trend: line with target band">
          <TrendChart label="Weight" unit="kg" decimals={1} band={[53, 55]} points={Array.from({ length: 12 }, (_, i) => ({ label: `W${i + 1}`, value: 50 + i * 0.3 + (i % 3) * 0.1 }))} />
        </Card>
        <Card className="span-6" title="Trend: bars with target">
          <TrendChart label="Python hours" kind="bar" unit="h" target={7.5} points={Array.from({ length: 8 }, (_, i) => ({ label: `W${i + 1}`, value: [3, 5, 6.5, 4, 8, 7, 9, 6][i] }))} />
        </Card>

        <div className="span-12">
          <IndexTable label="Route index" right="04 entries">
            <IndexRow n={1} category="Career" title="Python Block 1" meta="streak 4" to="/ui" section="career" active />
            <IndexRow n={2} category="Mind" title="Meditate" meta="rapid 812" to="/ui" section="mind" />
            <IndexRow n={3} category="Body" title="Full Body B" meta="51.2 kg" to="/ui" section="body" />
            <IndexRow n={4} category="Persona" title="Record 2 min" meta="0 posts" to="/ui" section="persona" />
          </IndexTable>
        </div>

        <Card className="span-6" title="Terminal strip" eyebrow="Focus">
          <TerminalStrip label="python block 1" time={running ? "89:59" : "90:00"} running={running} onRun={() => setRunning(true)} onStop={() => setRunning(false)} />
        </Card>
        <Card className="span-6" title="Tabs and range" eyebrow="Navigation">
          <Tabs label="Demo" tabs={[{ id: "one", label: "Path" }, { id: "two", label: "Library" }, { id: "three", label: "Notes" }]} value={tab} onChange={setTab} />
          <Seg label="Range" value={range} onChange={setRange} options={[{ value: "week", label: "Week" }, { value: "month", label: "Month" }, { value: "year", label: "Year" }]} />
          <Pager page={page} pages={4} onPage={setPage} total={73} />
        </Card>

        <Card className="span-4" title="Empty" eyebrow="Dry humour">
          <Empty />
        </Card>
        <Card className="span-4" title="Overlays">
          <div className="row wrap">
            <Button onClick={() => setModal(true)}>Open modal</Button>
            <Button onClick={() => setSheet(true)}>Open sheet</Button>
            <Button onClick={() => ui.set({ paletteOpen: true })}>Palette</Button>
          </div>
          <div style={{ marginTop: 16 }}>
            <HandArrow>Press d to switch theme</HandArrow>
          </div>
        </Card>
        <Card className="span-4" title="Misc">
          <div className="stack">
            <span>
              Exam in <Countdown to={new Date(Date.now() + 9 * 86400000 + 3 * 3600000)} />
            </span>
            <Skeleton />
            <Skeleton w="60%" />
            <div className="row wrap">
              {ICONS.map((n) => (
                <span key={n} title={n} className="muted">
                  <Icon name={n} />
                </span>
              ))}
            </div>
          </div>
        </Card>
      </div>

      <QuoteBlock text="Discipline is choosing what you want most over what you want now." by="ONE" source="house rule" />
      <Footer day={12} version="0.1.0" />

      <Modal open={modal} onClose={() => setModal(false)} title="A modal">
        <p className="text">Escape closes it. Focus returns to the button.</p>
      </Modal>
      <Sheet open={sheet} onClose={() => setSheet(false)} title="A sheet">
        <p className="text">Bottom sheet for phone-first forms.</p>
      </Sheet>
    </div>
  );
}
