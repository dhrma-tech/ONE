import { lazy } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import { SectionLayout } from "@/modules/section";
import { PathEditor } from "@/modules/path";
import { HabitsEditor } from "@/modules/habits";
import { FocusStrip } from "@/modules/focus";
import { Library } from "@/modules/library/Library";
import { SectionAnalytics, countBy, sumBy } from "@/modules/analytics";
import { useTargets, useSettings, patchSettings, useProfile, patchProfile } from "@/services/settings";
import { Card, Chip, Select, Switch } from "@/ui";

const Watch = lazy(() => import("@/modules/library/Watch"));
const Practice = lazy(() => import("./Practice"));
const Build = lazy(() => import("./Build"));
const News = lazy(() => import("./News"));
const Reading = lazy(() => import("./Reading"));
const Notes = lazy(() => import("./Notes"));
const College = lazy(() => import("./College"));

const TABS = [
  { id: "path", label: "Path" },
  { id: "library", label: "Library" },
  { id: "practice", label: "Practice" },
  { id: "build", label: "Build" },
  { id: "news", label: "News" },
  { id: "reading", label: "Reading" },
  { id: "notes", label: "Notes" },
  { id: "college", label: "College" },
  { id: "analytics", label: "Analytics" },
];

const TOPICS = ["Python fundamentals", "Advanced Python", "LLM basics", "Prompting", "RAG", "Agents", "Evals", "MLOps"];

function PathTab() {
  const t = useTargets();
  const s = useSettings();
  const p = useProfile();
  return (
    <div className="bento">
      <Card className="span-8" eyebrow="Gates beat dates. If a gate fails, repeat the week." title="Path">
        <PathEditor section="career" lanes={[{ id: "python", label: "Python lane" }, { id: "llm", label: "LLM lane" }]} />
      </Card>
      <div className="span-4 stack">
        <Card title="Block 1" eyebrow={`Minimum viable day: ${t.block1_min}+ min, no AI`}>
          <FocusStrip block1Target={t.block1_min} />
        </Card>
        <Card title="Daily structure" eyebrow="Edit times and days">
          <HabitsEditor section="career" />
        </Card>
        <Card title="Target title" eyebrow="Undecided on purpose">
          <Select
            aria-label="Target title"
            value={p?.target_title ?? "AI Engineer"}
            onChange={(e) => void patchProfile({ target_title: e.target.value })}
            options={[{ value: "AI Engineer", label: "AI Engineer" }, { value: "AI/ML Engineer", label: "AI/ML Engineer" }]}
          />
          <div style={{ marginTop: 12 }}>
            <Switch checked={!!s?.exam_mode} onChange={(v) => void patchSettings({ exam_mode: v })} label="Exam mode (Block 3 → exam prep, other sections minimal)" />
          </div>
        </Card>
        <Card title="AI rules in Python blocks" eyebrow="House rules">
          <ul className="list small text">
            <li>No AI for assignments, practice or first drafts.</li>
            <li>Allowed: concept explanations, "why is this wrong" after 30 min stuck, review after finishing.</li>
            <li>Write badly → get it working → ask for review → rewrite yourself.</li>
            <li>One real push a day. No empty commits.</li>
            <li>Every concept: one thing shipped + one thing shared.</li>
            <li>Bored? Rotate to the LLM block. Never skip the Python block.</li>
          </ul>
          <div className="row wrap" style={{ marginTop: 8 }}>
            <Chip>Exercism</Chip>
            <Chip>HackerRank</Chip>
            <Chip>py4e.com</Chip>
            <Chip>Coursera: Python for Everybody</Chip>
          </div>
        </Card>
      </div>
    </div>
  );
}

function Analytics() {
  return (
    <SectionAnalytics
      section="career"
      stats={[
        { label: "Python this week", value: (c) => sumBy(c.week, (d) => d.block1_min) / 60, unit: "h", decimals: 1 },
        { label: "Problems solved", value: (c) => sumBy(c.days, (d) => d.problems_solved) },
        { label: "Pushes this week", value: (c) => sumBy(c.week, (d) => d.pushes ?? 0) },
        { label: "Videos done", value: (c) => sumBy(c.days, (d) => d.videos_done) },
        { label: "Notes reviewed", value: (c) => sumBy(c.days, (d) => d.notes_reviewed) },
      ]}
      trend={{ label: "Python hours per week", kind: "bar", unit: "h", decimals: 1, bucket: "week", value: (ds) => sumBy(ds, (d) => d.block1_min) / 60, target: (c) => (c.targets.block1_min * 5) / 60 }}
      lag={[
        { label: "Block 1", actual: (c) => countBy(c.week, (d) => d.block1_min >= c.targets.block1_min), target: (c) => Math.min(5, c.week.length), unit: " days", quip: "The snake is waiting." },
        { label: "Pushes", actual: (c) => countBy(c.week, (d) => (d.pushes ?? 0) > 0), target: (c) => Math.min(6, c.week.length), unit: " days", quip: "Ship something small." },
      ]}
    />
  );
}

export default function Career() {
  return (
    <SectionLayout section="career" tabs={TABS}>
      <Routes>
        <Route index element={<Navigate to="path" replace />} />
        <Route path="path" element={<PathTab />} />
        <Route path="library" element={<Library section="career" suggestedTopics={TOPICS} />} />
        <Route path="library/watch/:videoId" element={<Watch />} />
        <Route path="practice" element={<Practice />} />
        <Route path="build" element={<Build />} />
        <Route path="news" element={<News />} />
        <Route path="reading" element={<Reading />} />
        <Route path="notes" element={<Notes />} />
        <Route path="college/*" element={<College />} />
        <Route path="analytics" element={<Analytics />} />
        <Route path="*" element={<Navigate to="path" replace />} />
      </Routes>
    </SectionLayout>
  );
}
