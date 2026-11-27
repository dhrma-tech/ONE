// Brief 17: Dharma's real plans, pre-loaded on first run. Deterministic ids (seedId) so seeds merge across devices.
// Everything here is editable in-app. Bump SEED_VERSION to add new seed content; existing rows are never overwritten.
import { db } from "@/data/db";
import { repo, seedId } from "@/data/repo";
import type { TableName } from "@/data/schema";
import type { Rows } from "@/data/types.gen";
import { DEFAULT_TARGETS } from "@/domain/targets";
import { today } from "@/lib/dates";

export const SEED_VERSION = 1;

type Seed<K extends TableName> = Partial<Rows[K]> & { key: string };

const habits: Seed<"habits">[] = [
  { key: "h-block1", section: "career", title: "Block 1: Python, no AI (90+ min)", days: [1, 2, 3, 4, 5, 6, 0], time: "18:10", minutes: 140, calendar: true, order_no: 1 },
  { key: "h-block2", section: "career", title: "Block 2: LLM concepts", days: [1, 2, 3, 4, 5], time: "20:30", minutes: 120, calendar: false, order_no: 2 },
  { key: "h-block3", section: "career", title: "Block 3: Python practice / project", days: [1, 2, 3, 4, 5], time: "22:30", minutes: 60, calendar: false, order_no: 3 },
  { key: "h-push", section: "career", title: "One real GitHub push", days: [1, 2, 3, 4, 5, 6, 0], order_no: 4 },
  { key: "h-gym", section: "body", title: "Gym 6:30 AM", days: [1, 3, 5], time: "06:30", minutes: 60, calendar: true, order_no: 1 },
  { key: "h-bag", section: "body", title: "Pack the gym bag tonight", days: [0, 2, 4], time: "21:00", order_no: 2 },
  { key: "h-weigh", section: "body", title: "Sunday weigh-in (empty stomach)", days: [0], time: "06:15", order_no: 3 },
  { key: "h-meditate", section: "mind", title: "Meditate 10 min", days: [1, 2, 3, 4, 5, 6, 0], order_no: 1 },
  { key: "h-cards", section: "mind", title: "Flashcards (10 min)", days: [1, 2, 3, 4, 5, 6, 0], order_no: 2 },
  { key: "h-puzzles", section: "mind", title: "Chess puzzles", days: [1, 2, 3, 4, 5, 6, 0], order_no: 3 },
  { key: "h-read", section: "mind", title: "15 min book at 11:45 PM (no phone)", days: [1, 2, 3, 4, 5, 6, 0], time: "23:45", order_no: 4 },
  { key: "h-english", section: "persona", title: "10 min English narration + shadowing", days: [1, 2, 3, 4, 5, 6, 0], order_no: 1 },
  { key: "h-record", section: "persona", title: "2-min recording on a random topic", days: [1, 2, 3, 4, 5, 6, 0], order_no: 2 },
  { key: "h-outreach", section: "persona", title: "Outreach: 10 people + 3 companies", days: [1, 2, 3, 4, 5, 6], order_no: 3 },
  { key: "h-convo", section: "persona", title: "One real conversation in English", days: [1, 2, 3, 4, 5, 6, 0], order_no: 4 },
  { key: "h-review", section: "home", title: "Nightly review (11:30 PM)", days: [1, 2, 3, 4, 5, 6, 0], time: "23:30", minutes: 30, calendar: true, order_no: 1 },
  { key: "h-weekly", section: "home", title: "Sunday weekly review (8:00 AM)", days: [0], time: "08:00", minutes: 45, calendar: true, order_no: 2 },
];

interface StageSeed {
  key: string;
  section: "career" | "mind" | "body" | "persona";
  lane: string;
  title: string;
  description?: string;
  gate?: string;
  week?: number;
  items: string[];
}

const stages: StageSeed[] = [
  // CAREER: Python lane (gates beat dates)
  { key: "py-w1", section: "career", lane: "python", week: 1, title: "Week 1: Diagnostic + PY4E Course 1 review", description: "No AI, no Google, 20 minutes: FizzBuzz, is-prime, sum of evens 1..N, largest in list without max(), count vowels. Then PY4E Course 1 review + Exercism basics.", gate: "FizzBuzz + largest-in-list from memory in under 5 minutes.", items: ["Diagnostic: FizzBuzz", "Diagnostic: is-prime", "Diagnostic: sum of evens 1..N", "Diagnostic: largest in list without max()", "Diagnostic: count vowels", "PY4E Course 1 review", "Exercism Python basics (5 exercises)"] },
  { key: "py-w2", section: "career", lane: "python", week: 2, title: "Weeks 2-3: PY4E Course 2 (data structures)", gate: "Log file analyser and JSON task manager both run, written by hand.", items: ["PY4E Course 2: strings and files", "PY4E Course 2: lists and dictionaries", "PY4E Course 2: tuples", "Project: log file analyser", "Project: JSON task manager"] },
  { key: "py-w4", section: "career", lane: "python", week: 4, title: "Week 4: PY4E Course 3 (web data & APIs)", description: "Most important week.", gate: "First raw Anthropic API call with requests, no SDK, working end to end.", items: ["PY4E Course 3: HTTP and urllib", "PY4E Course 3: parsing JSON and XML", "PY4E Course 3: web APIs", "Project: raw Anthropic API call with requests"] },
  { key: "py-w5", section: "career", lane: "python", week: 5, title: "Weeks 5-6: OOP, errors, venv, async, typing, SQLite", gate: "Modify a feature in one AI-built project by hand, no Claude Code.", items: ["Classes and objects", "Error handling", "venv and packaging basics", "async basics", "Type hints", "SQLite basics", "Refactor the task manager", "Milestone: hand-modify an AI-built project"] },
  { key: "py-later1", section: "career", lane: "python", week: 7, title: "Agents with LangChain / LangGraph", items: ["LangChain basics", "LangGraph agent", "Build: small agent for Rocky"] },
  { key: "py-later2", section: "career", lane: "python", week: 10, title: "Full-stack AI apps & deployment", items: ["Backend API", "Frontend", "Deploy an AI app"] },
  { key: "py-later3", section: "career", lane: "python", week: 14, title: "Advanced: fine-tuning, LLM internals", items: ["Fine-tuning basics", "Transformer internals", "Evals in depth"] },
  // CAREER: LLM lane (parallel)
  { key: "llm-w1", section: "career", lane: "llm", week: 1, title: "W1: What LLMs are", items: ["Tokens", "Context window", "Temperature", "Ship + share one thing"] },
  { key: "llm-w2", section: "career", lane: "llm", week: 2, title: "W2: Prompt engineering", items: ["System prompts", "Few-shot", "Chain-of-thought", "Ship + share one thing"] },
  { key: "llm-w3", section: "career", lane: "llm", week: 3, title: "W3: Structured output", items: ["JSON from models", "Schemas and validation", "Ship + share one thing"] },
  { key: "llm-w4", section: "career", lane: "llm", week: 4, title: "W4: Tool calling", description: "Converges with the first raw API call in Python.", items: ["Tool-calling concepts", "Tool call via raw API", "Ship + share one thing"] },
  { key: "llm-w5", section: "career", lane: "llm", week: 5, title: "W5: Embeddings, chunking, RAG, evals", items: ["Embeddings", "Chunking", "RAG pipeline", "Evaluation", "Article: A RAG chunking experiment"] },
  { key: "llm-w6", section: "career", lane: "llm", week: 6, title: "W6: Agents", items: ["ReAct", "Tool use", "Multi-agent", "Ship + share one thing"] },
  // MIND
  { key: "mind-1", section: "mind", lane: "main", week: 1, title: "Foundation: chess + meditation", gate: "Meditate 7 days in a row; play 2 rapid games and review one loss.", items: ["Meditate 5-10 min daily", "1-2 rapid games (15+10) per week", "Review one loss with Bobby", "Daily puzzles"] },
  { key: "mind-2", section: "mind", lane: "main", week: 3, title: "Focus ladder", gate: "One 45-minute phone-free block.", items: ["25-min phone-free blocks", "+5 min per week", "Stuck ladder 15 → 45 min"] },
  { key: "mind-3", section: "mind", lane: "main", week: 6, title: "Unlock later modules", items: ["Cube: under 2 minutes", "Mental math 5 min/day", "Memory palace 2×15 min/week"] },
  // BODY
  { key: "body-1", section: "body", lane: "main", week: 1, title: "Weeks 1-4: Full body A/B", description: "Rotation A, B, A then B, A, B. One warm-up set, stop with ~2 reps left, session under 60 minutes.", gate: "12 sessions logged.", items: ["Full Body A", "Full Body B", "Weigh in every Sunday", "Hit protein 5 of 7 days"] },
  { key: "body-2", section: "body", lane: "main", week: 5, title: "Week 5: Deload", items: ["Same exercises, about half the sets"] },
  { key: "body-3", section: "body", lane: "main", week: 6, title: "Weeks 6-12: 4-day upper/lower", description: "Detail after week 4.", items: ["Write Upper A/B and Lower A/B templates", "Reach 53-55 kg by week 12"] },
  // PERSONA
  { key: "per-1", section: "persona", lane: "main", week: 1, title: "Week 1: Greeting + one question daily", gate: "7 days of greetings; baseline recording done.", items: ["Baseline recording: best project (2 min)", "Phone drill: answer within 3 rings", "1 call/day with a script (known person)"] },
  { key: "per-2", section: "persona", lane: "main", week: 2, title: "Week 2: 3-minute conversations with classmates", items: ["3-min conversations", "2 LinkedIn + 3 X posts", "70 connection requests"] },
  { key: "per-3", section: "persona", lane: "main", week: 3, title: "Week 3: Initiate with seniors/professors", items: ["Initiate with a senior", "Initiate with a professor", "First article: Calling the Anthropic API with raw requests"] },
  { key: "per-4", section: "persona", lane: "main", week: 4, title: "Week 4: Lead a club session or open a pitch", gate: "20 job posts + 8 conversations logged in Market Intel.", items: ["Lead a club session", "Lead the intro at the next pitch", "Day 30 baseline redo"] },
];

const projects: Seed<"projects">[] = [
  { key: "p-rocky", name: "Rocky", status: "building", notes: "Always-on personal AI agent for the Windows laptop. The build focus.", order_no: 1 },
  { key: "p-sih", name: "SIH", status: "paused", notes: "Deadline-driven minimum only.", order_no: 2 },
  { key: "p-eureka", name: "Eureka", status: "paused", notes: "Deadline-driven minimum only.", order_no: 3 },
  { key: "p-python", name: "python-foundations", repo: "https://github.com/dhrma-tech/python-foundations", status: "building", notes: "All Python practice goes here.", order_no: 4 },
];

const templates: Seed<"exercise_templates">[] = [
  ...[
    ["Leg press", 3, 8, 12],
    ["DB bench press or machine chest press", 3, 8, 12],
    ["Seated cable row", 3, 8, 12],
    ["DB shoulder press", 2, 8, 12],
    ["Biceps curl", 2, 10, 12],
    ["Plank", 3, 30, 30],
  ].map(([exercise, sets, lo, hi], i) => ({
    key: `ft-a-${i}`,
    template: "Full Body A",
    exercise: exercise as string,
    sets: sets as number,
    rep_low: lo as number,
    rep_high: hi as number,
    unit: exercise === "Plank" ? "seconds" : "reps",
    weight_step: exercise === "Leg press" ? 5 : 2.5,
    order_no: i,
  })),
  ...[
    ["DB Romanian deadlift", 3, 8, 12],
    ["Lat pulldown", 3, 8, 12],
    ["Incline DB press", 3, 8, 12],
    ["Leg curl", 2, 10, 12],
    ["DB lateral raise", 2, 12, 15],
    ["Triceps pushdown", 2, 10, 12],
  ].map(([exercise, sets, lo, hi], i) => ({
    key: `ft-b-${i}`,
    template: "Full Body B",
    exercise: exercise as string,
    sets: sets as number,
    rep_low: lo as number,
    rep_high: hi as number,
    unit: "reps",
    weight_step: exercise === "DB lateral raise" ? 1 : 2.5,
    order_no: i,
  })),
];

// Estimates only (is_estimate = true): Dharma corrects them once.
const meals: Seed<"meal_templates">[] = [
  { key: "m-pregym", name: "Pre-gym: oats + peanut butter + jaggery", calories: 450, protein_g: 15, order_no: 1 },
  { key: "m-postgym", name: "Post-gym: 3-4 eggs + rice/roti", calories: 550, protein_g: 28, order_no: 2 },
  { key: "m-lunch", name: "Lunch: rice + dal + soya/paneer/chicken + ghee", calories: 750, protein_g: 30, order_no: 3 },
  { key: "m-evening", name: "Evening: almonds + PB sandwich + chana", calories: 500, protein_g: 18, order_no: 4 },
  { key: "m-dinner", name: "Dinner: roti/rice + dal/chana + eggs/soya", calories: 650, protein_g: 28, order_no: 5 },
  { key: "m-bed", name: "Before bed: PB or eggs", calories: 200, protein_g: 10, order_no: 6 },
].map((m) => ({ ...m, is_estimate: true }));

const decks: Seed<"flashcard_decks">[] = [
  { key: "d-python", name: "Python syntax & built-ins", order_no: 1 },
  { key: "d-llm", name: "LLM concepts", order_no: 2 },
  { key: "d-english", name: "English phrases", order_no: 3 },
  { key: "d-numbers", name: "Number facts", order_no: 4 },
  { key: "d-chess", name: "Chess patterns", order_no: 5 },
];

const presence: Seed<"presence_items">[] = [
  "Front/centre seat (never the corner)",
  "Eye contact held 3-6 s in one conversation",
  "Stillness: no fidgeting, slower speech",
  "Wall angels ×10",
  "Grooming: hair/beard sharp",
  "Skincare AM: cleanser → vitamin C → moisturiser → SPF 50",
  "Skincare PM: cleanse → rose water → night cream",
  "Clothes fitted + ironed",
].map((label, i) => ({ key: `pr-${i}`, label, order_no: i }));

// DBATU-style 10-point scale. Editable in College › Marks. Verify against the current DBATU rules.
const gradeScale: Seed<"grade_scale">[] = [
  [91, "AA", 10],
  [81, "AB", 9],
  [71, "BB", 8],
  [61, "BC", 7],
  [51, "CC", 6],
  [46, "CD", 5],
  [40, "DD", 4],
  [0, "FF", 0],
].map(([min_pct, grade, points]) => ({ key: `gs-${grade}`, min_pct: min_pct as number, grade: grade as string, points: points as number }));

const sem3Subjects: [string, number, boolean, string][] = [
  ["Engineering Mathematics III", 1, true, "theory"],
  ["Analog & Digital Electronics", 2, true, "theory"],
  ["Electronic Devices & Circuits (MDM)", 3, true, "theory"],
  ["Material Science & Metallurgy", 4, true, "theory"],
  ["Renewable Energy Sources (Open Elective)", 5, true, "theory"],
  ["Machine Drawing & CAD", 6, true, "theory"],
  ["Constitution of India (audit)", 7, false, "audit"],
  ["Life of Bharat Ratna Dr Ambedkar (IKS)", 8, false, "audit"],
];

function rows<K extends TableName>(table: K, seeds: Seed<K>[]): Rows[K][] {
  return seeds.map(({ key, ...v }) => repo.build(table, { ...(v as Partial<Rows[K]>), id: seedId(`${table}:${key}`) }));
}

async function putMissing<K extends TableName>(table: K, list: Rows[K][]) {
  const existing = new Set((await db.t(table).bulkGet(list.map((r) => r.id))).filter(Boolean).map((r) => r!.id));
  await repo.putRaw(table, list.filter((r) => !existing.has(r.id)));
}

/** Applies seed content once per SEED_VERSION. Safe to call on every start. */
export async function applySeed(): Promise<boolean> {
  const meta = await db.meta.get("seed_version");
  if ((meta?.value as number) >= SEED_VERSION) return false;

  await putMissing("profile", [
    repo.build("profile", { id: seedId("profile"), name: "Dharmaraj Aparadh", tagline: "AI Engineer in training", target_title: "AI Engineer", lock_in_start_date: today(), timezone: "Asia/Kolkata" }),
  ]);
  await putMissing("settings", [
    repo.build("settings", {
      id: seedId("settings"),
      targets: DEFAULT_TARGETS,
      usernames: { chesscom: "", leetcode: "", github: "dhrma-tech" },
      public_stat_flags: {},
      modules: { cube: false, math: false, palace: false },
      seed_version: SEED_VERSION,
    }),
  ]);
  await putMissing("body_targets", [repo.build("body_targets", { id: seedId("body_targets") })]);
  await putMissing("habits", rows("habits", habits));

  const stageRows: Rows["path_stages"][] = [];
  const itemRows: Rows["path_items"][] = [];
  stages.forEach((s, i) => {
    const id = seedId(`path_stages:${s.key}`);
    stageRows.push(
      repo.build("path_stages", { id, section: s.section, lane: s.lane, order_no: i, title: s.title, description: s.description ?? null, gate_criteria: s.gate ?? null, target_week: s.week ?? null, status: i === 0 || s.key === "llm-w1" || s.key.endsWith("-1") ? "active" : "todo" }),
    );
    s.items.forEach((title, j) => itemRows.push(repo.build("path_items", { id: seedId(`path_items:${s.key}:${j}`), stage_id: id, section: s.section, order_no: j, title, target_week: s.week ?? null })));
  });
  await putMissing("path_stages", stageRows);
  await putMissing("path_items", itemRows);

  await putMissing("projects", rows("projects", projects));
  await putMissing("exercise_templates", rows("exercise_templates", templates));
  await putMissing("meal_templates", rows("meal_templates", meals));
  await putMissing("flashcard_decks", rows("flashcard_decks", decks));
  await putMissing("presence_items", rows("presence_items", presence));
  await putMissing("grade_scale", rows("grade_scale", gradeScale));

  const sem3 = seedId("semesters:sem3");
  await putMissing("semesters", [
    repo.build("semesters", { id: sem3, name: "Sem III", number: 3, end_date: "2026-12-05", archived: false }),
    repo.build("semesters", { id: seedId("semesters:sem4"), name: "Sem IV", number: 4, archived: false }),
  ]);
  await putMissing(
    "subjects",
    sem3Subjects.map(([name, rank, ese, kind], i) => repo.build("subjects", { id: seedId(`subjects:sem3:${i}`), semester_id: sem3, name, importance_rank: rank, has_ese: ese, kind, order_no: i })),
  );

  // Stuck ladder from the lock-in week: 15 → 20 → 25 → 30 → 45
  const { weekStart, addDays } = await import("@/lib/dates");
  const w0 = weekStart(today());
  await putMissing(
    "stuck_ladder",
    [15, 20, 25, 30, 45].map((m, i) => repo.build("stuck_ladder", { id: seedId(`stuck_ladder:${i}`), week_start: addDays(w0, i * 7), target_min: m })),
  );

  await db.meta.put({ key: "seed_version", value: SEED_VERSION });
  return true;
}
