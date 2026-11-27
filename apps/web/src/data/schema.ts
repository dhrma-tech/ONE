// Single source of truth for ONE's data model.
// Generates: Supabase SQL (scripts/db/gen.ts → supabase/migrations/0001_init.sql), the Dexie schema (db.ts)
// and docs/SCHEMA.md. Every table also gets: id uuid, user_id uuid, created_at, updated_at, deleted_at.
// Plain snake_case names on purpose: Claude reads this database through the Supabase connector.

export type ColType = "text" | "int" | "num" | "bool" | "date" | "ts" | "time" | "uuid" | "jsonb" | "text[]" | "int[]";

export interface Col {
  t: ColType;
  null?: boolean; // nullable (default true unless `req`)
  req?: boolean; // NOT NULL
  def?: string; // SQL default expression
  ref?: string; // referenced table (on delete cascade)
  check?: string; // SQL check expression
  doc?: string;
}

export interface TableDef {
  doc: string;
  cols: Record<string, Col>;
  /** Dexie secondary indexes (also become SQL indexes with user_id first). */
  idx?: string[];
  /** Unique per user (SQL unique constraint incl. user_id; Dexie compound unique index). */
  unique?: string[][];
  group: "core" | "library" | "career" | "college" | "mind" | "body" | "persona" | "server";
  /** Server-only tables are not synced to the client. */
  serverOnly?: boolean;
  /** Private: never in public stats or exports to third parties. */
  private?: boolean;
}

const txt = (doc?: string, o: Partial<Col> = {}): Col => ({ t: "text", doc, ...o });
const int = (doc?: string, o: Partial<Col> = {}): Col => ({ t: "int", doc, ...o });
const num = (doc?: string, o: Partial<Col> = {}): Col => ({ t: "num", doc, ...o });
const bool = (doc?: string, def = "false"): Col => ({ t: "bool", req: true, def, doc });
const date = (doc?: string, o: Partial<Col> = {}): Col => ({ t: "date", doc, ...o });
const ts = (doc?: string, o: Partial<Col> = {}): Col => ({ t: "ts", doc, ...o });
const ref = (table: string, doc?: string, o: Partial<Col> = {}): Col => ({ t: "uuid", ref: table, doc, ...o });
const json = (doc?: string, def = "'{}'::jsonb"): Col => ({ t: "jsonb", req: true, def, doc });
const section = (o: Partial<Col> = {}): Col => ({
  t: "text",
  check: "section in ('career','mind','body','persona','home')",
  doc: "career | mind | body | persona | home",
  ...o,
});

export const TABLES = {
  // ---------------- core ----------------
  profile: {
    group: "core",
    doc: "One row. Who Dharma is and when the lock-in started.",
    cols: {
      name: txt("Display name", { req: true, def: "'Dharmaraj Aparadh'" }),
      tagline: txt("Shown under the name", { def: "'AI Engineer in training'" }),
      target_title: txt("AI Engineer or AI/ML Engineer", { def: "'AI Engineer'" }),
      photo_url: txt("Avatar URL or storage path"),
      lock_in_start_date: date("Day 1 of the lock-in"),
      timezone: txt("IANA timezone", { req: true, def: "'Asia/Kolkata'" }),
    },
  },
  settings: {
    group: "core",
    doc: "One row. App preferences, usernames, targets and flags.",
    cols: {
      theme: txt("dark | light", { req: true, def: "'dark'" }),
      accents: json("Section accent overrides {career,mind,body,persona}"),
      reduced_motion: txt("system | reduced | full", { req: true, def: "'system'" }),
      font_scale: num("1 = default", { req: true, def: "1" }),
      usernames: json("{chesscom, leetcode, github}"),
      public_stat_flags: json("Which stats the portfolio may show. All false by default."),
      exam_mode: bool("Exam mode switch"),
      modules: json("Locked MIND modules on/off {cube, math, palace}"),
      targets: json("Every numeric target (see domain/targets.ts)"),
      music_url: txt("Apple Music embed URL"),
      obsidian: json("Obsidian mirror state {folder_name, last_mirror_at, error}"),
      seed_version: int("Seed content version applied", { req: true, def: "0" }),
      derived_stats: json("Stats computed by the app (streaks, level, current focus, grid) for public_stats"),
    },
  },
  tasks: {
    group: "core",
    doc: "Daily tasks from paths, habits, reviews, follow-ups, calendar or manual entry.",
    idx: ["due_date", "section", "source_ref"],
    cols: {
      section: section({ req: true }),
      title: txt("What to do", { req: true }),
      due_date: date("Day it belongs to (IST)"),
      done_at: ts("When it was ticked"),
      source: txt("manual | path | habit | review | followup | calendar | exam | note", { req: true, def: "'manual'" }),
      source_ref: txt("Idempotency key for generated tasks, e.g. habit:<id>:<date>"),
      path_item_id: ref("path_items", "Linked path item"),
      priority: int("1 high .. 3 low", { req: true, def: "2" }),
      is_one_thing: bool("The day's One Thing"),
      notes: txt(),
    },
  },
  habits: {
    group: "core",
    doc: "Recurring tasks that generate a task on matching weekdays.",
    cols: {
      section: section({ req: true }),
      title: txt(undefined, { req: true }),
      days: { t: "int[]", req: true, def: "'{1,2,3,4,5,6,0}'", doc: "Weekdays 0=Sun..6=Sat" },
      time: { t: "time", doc: "Planned start time (IST)" },
      minutes: int("Planned duration"),
      calendar: bool("Push to the ONE Google calendar"),
      active: bool("Generates tasks", "true"),
      order_no: int(undefined, { req: true, def: "0" }),
    },
  },
  path_stages: {
    group: "core",
    doc: "Planning engine stages per section (and lane, e.g. python / llm).",
    idx: ["section"],
    cols: {
      section: section({ req: true }),
      lane: txt("python | llm | main", { req: true, def: "'main'" }),
      order_no: int(undefined, { req: true, def: "0" }),
      title: txt(undefined, { req: true }),
      description: txt(),
      gate_criteria: txt("What must be true to pass the stage"),
      gate_passed_at: ts(),
      status: txt("todo | active | done", { req: true, def: "'todo'" }),
      target_week: int("Planned week number from lock-in start"),
    },
  },
  path_items: {
    group: "core",
    doc: "Items inside a stage (lessons, projects, drills).",
    idx: ["stage_id", "section"],
    cols: {
      stage_id: ref("path_stages", undefined, { req: true }),
      section: section({ req: true }),
      order_no: int(undefined, { req: true, def: "0" }),
      title: txt(undefined, { req: true }),
      kind: txt("learn | build | drill | share", { req: true, def: "'learn'" }),
      target_week: int(),
      status: txt("todo | doing | done", { req: true, def: "'todo'" }),
      done_at: ts(),
    },
  },
  xp_events: {
    group: "core",
    doc: "Every XP award. Idempotent by (kind, ref_table, ref_id).",
    idx: ["date", "section"],
    unique: [["kind", "ref_table", "ref_id"]],
    cols: {
      date: date(undefined, { req: true }),
      section: section({ req: true }),
      kind: txt("See domain/xp.ts", { req: true }),
      points: int(undefined, { req: true }),
      ref_table: txt(undefined, { req: true, def: "''" }),
      ref_id: txt(undefined, { req: true, def: "''" }),
    },
  },
  achievement_unlocks: {
    group: "core",
    doc: "Unlocked achievements (definitions live in code: domain/achievements.ts).",
    unique: [["code"]],
    cols: { code: txt(undefined, { req: true }), unlocked_at: ts(undefined, { req: true, def: "now()" }) },
  },
  daily_reviews: {
    group: "core",
    private: true,
    doc: "Nightly review + journal, one per date.",
    unique: [["date"]],
    cols: {
      date: date(undefined, { req: true }),
      gym_status: txt("done | missed | rest"),
      calories: int(),
      protein_g: int(),
      water_ml: int(),
      python_block1_min: int(),
      pushes: int(),
      stuck_min: int("Longest stuck stretch"),
      outreach_done: { t: "bool" },
      speaking_min: int(),
      journal_good: txt("Went well"),
      journal_bad: txt("Didn't"),
      journal_lesson: txt("Lesson"),
      tomorrow_one_thing: txt(),
      lights_out_time: { t: "time" },
      mood_optional: int("1-5"),
      submitted_at: ts(),
    },
  },
  focus_sessions: {
    group: "core",
    doc: "Focus timer sessions. kind=block1 counts for CAREER done.",
    idx: ["date", "section"],
    cols: {
      date: date(undefined, { req: true }),
      section: section({ req: true }),
      kind: txt("block1 | block2 | block3 | study | free", { req: true, def: "'free'" }),
      label: txt(),
      started_at: ts(undefined, { req: true }),
      ended_at: ts(),
      minutes: int(undefined, { req: true, def: "0" }),
      phone_free: bool(),
    },
  },
  weekly_grades: {
    group: "core",
    doc: "Weekly grade (9 checks) and Sunday review.",
    unique: [["week_start"]],
    cols: {
      week_start: date("Monday", { req: true }),
      checks: json("{gym, weigh_in, block1, push, review, outreach, flashcards, lights_out, meditation}: bool"),
      grade: txt("A-F"),
      wins: { t: "text[]", req: true, def: "'{}'" },
      fails: { t: "text[]", req: true, def: "'{}'" },
      priorities: { t: "text[]", req: true, def: "'{}'" },
      finalised_at: ts(),
    },
  },
  calendar_links: {
    group: "core",
    doc: "Maps local items to Google Calendar event ids in the ONE calendar.",
    unique: [["local_kind", "local_id"]],
    cols: { local_kind: txt(undefined, { req: true }), local_id: txt(undefined, { req: true }), google_event_id: txt(undefined, { req: true }) },
  },
  integration_status: {
    group: "core",
    doc: "Status per integration for the Settings page.",
    unique: [["provider"]],
    cols: {
      provider: txt("google | github | leetcode | chesscom | buffer | youtube | apple_music | obsidian", { req: true }),
      status: txt("connected | error | stale | off", { req: true, def: "'off'" }),
      last_ok_at: ts(),
      last_error: txt(),
      meta: json(),
    },
  },
  integration_secrets: {
    group: "server",
    serverOnly: true,
    doc: "Encrypted third-party tokens (AES-256-GCM). RLS on with NO policies: service role only.",
    unique: [["provider"]],
    cols: { provider: txt(undefined, { req: true }), ciphertext: txt(undefined, { req: true }), iv: txt(undefined, { req: true }), tag: txt(undefined, { req: true }) },
  },
  api_cache: {
    group: "server",
    serverOnly: true,
    doc: "Server-side cache for third-party responses. Service role only.",
    unique: [["key"]],
    cols: { key: txt(undefined, { req: true }), value: json(), etag: txt(), fetched_at: ts(undefined, { req: true, def: "now()" }) },
  },

  // ---------------- library ----------------
  videos: {
    group: "library",
    doc: "Curated YouTube videos. Only approved=true show outside the Inbox.",
    idx: ["section", "approved", "topic"],
    unique: [["youtube_id", "section"]],
    cols: {
      youtube_id: txt(undefined, { req: true }),
      title: txt(undefined, { req: true }),
      channel: txt(),
      duration_s: int(),
      section: section({ req: true }),
      topic: txt(),
      rating: int("Dharma's 1-5", { check: "rating between 0 and 5" }),
      priority: int("1 high .. 3 low", { req: true, def: "2" }),
      path_item_id: ref("path_items"),
      approved: bool(),
      rejected: bool(),
      frame: int("Preferred frame image 1-3", { req: true, def: "2" }),
      source: txt("manual | cubicle | bobby | bulk"),
      added_at: ts(undefined, { req: true, def: "now()" }),
    },
  },
  video_progress: {
    group: "library",
    doc: "Watch state per video.",
    unique: [["video_id"]],
    cols: {
      video_id: ref("videos", undefined, { req: true }),
      status: txt("queue | watching | done", { req: true, def: "'queue'" }),
      position_s: int(undefined, { req: true, def: "0" }),
      finished_at: ts(),
    },
  },
  video_notes: {
    group: "library",
    doc: "Timestamped notes while watching.",
    idx: ["video_id"],
    cols: { video_id: ref("videos", undefined, { req: true }), t_seconds: int(undefined, { req: true, def: "0" }), text: txt(undefined, { req: true }) },
  },

  // ---------------- career ----------------
  leetcode_snapshots: {
    group: "career",
    doc: "Daily LeetCode solved counts (unofficial API).",
    unique: [["date"]],
    cols: { date: date(undefined, { req: true }), easy: int(), medium: int(), hard: int(), total: int(), ranking: int() },
  },
  problem_log: {
    group: "career",
    doc: "Practice problems with stuck minutes.",
    idx: ["date"],
    cols: {
      date: date(undefined, { req: true }),
      platform: txt("LeetCode | Exercism | HackerRank | py4e | other", { req: true }),
      title: txt(undefined, { req: true }),
      url: txt(),
      difficulty: txt("easy | medium | hard"),
      minutes: int(),
      stuck_min: int(),
      solved: bool(),
      notes: txt(),
    },
  },
  projects: {
    group: "career",
    doc: "Build board: idea | building | shipped | paused.",
    cols: { name: txt(undefined, { req: true }), repo: txt(), status: txt(undefined, { req: true, def: "'idea'" }), notes: txt(), order_no: int(undefined, { req: true, def: "0" }) },
  },
  github_snapshots: {
    group: "career",
    doc: "Daily GitHub contributions and pushes.",
    unique: [["date"]],
    cols: { date: date(undefined, { req: true }), contributions: int(), pushes_today: int(), calendar: json("[{date,count}] last year") },
  },
  website_ideas: {
    group: "career",
    doc: "Website ideas (migrated from Notion).",
    cols: { title: txt(undefined, { req: true }), description: txt(), status: txt("idea | validating | building | dropped", { req: true, def: "'idea'" }), idea_date: date() },
  },
  hackathons: {
    group: "career",
    doc: "Hackathon list (migrated from Notion).",
    cols: {
      name: txt(undefined, { req: true }),
      url: txt(),
      start_date: date(),
      end_date: date(),
      deadline: date(),
      team: txt(),
      status: txt("interested | applied | building | submitted | done | skipped", { req: true, def: "'interested'" }),
      notes: txt(),
      needs_details: bool(),
    },
  },
  news_items: {
    group: "career",
    doc: "News room picks, hard-capped at 10 per day.",
    idx: ["date"],
    unique: [["date", "url"]],
    cols: { date: date(undefined, { req: true }), source: txt(), title: txt(undefined, { req: true }), url: txt(undefined, { req: true }), read: bool(), saved: bool() },
  },
  reading_list: {
    group: "career",
    doc: "Saved articles. A takeaway is required before marking read.",
    cols: { url: txt(undefined, { req: true }), title: txt(), saved_at: ts(undefined, { req: true, def: "now()" }), read_at: ts(), takeaway: txt() },
  },
  notes: {
    group: "career",
    doc: "Markdown notes with spaced review 3/7/30/90 days.",
    idx: ["section", "next_review_at"],
    cols: {
      section: section({ req: true, def: "'career'" }),
      topic: txt(),
      title: txt(undefined, { req: true }),
      body_md: txt(undefined, { req: true, def: "''" }),
      next_review_at: date(),
      review_stage: int(undefined, { req: true, def: "0" }),
    },
  },

  // ---------------- college ----------------
  semesters: {
    group: "college",
    doc: "Semesters. Archived ones are read-only.",
    cols: { name: txt(undefined, { req: true }), number: int(), start_date: date(), end_date: date(), archived: bool() },
  },
  subjects: {
    group: "college",
    doc: "Subjects per semester.",
    idx: ["semester_id"],
    cols: {
      semester_id: ref("semesters", undefined, { req: true }),
      name: txt(undefined, { req: true }),
      code: txt(),
      credits: num(),
      importance_rank: int("1 = most important"),
      has_ese: bool("Has an end-semester exam", "true"),
      kind: txt("theory | practical | audit", { req: true, def: "'theory'" }),
      notebooklm_url: txt(),
      syllabus_url: txt(),
      formula_sheet_url: txt(),
      mindmap_url: txt(),
      order_no: int(undefined, { req: true, def: "0" }),
    },
  },
  units: {
    group: "college",
    doc: "Units. Cracked = concept + examples + every PYQ solved without notes.",
    idx: ["subject_id"],
    cols: { subject_id: ref("subjects", undefined, { req: true }), number: int(undefined, { req: true }), title: txt(), status: txt("not_started | in_progress | cracked", { req: true, def: "'not_started'" }) },
  },
  exams: {
    group: "college",
    doc: "Exam timetable.",
    idx: ["date"],
    cols: { subject_id: ref("subjects", undefined, { req: true }), date: date(undefined, { req: true }), start_time: { t: "time" }, kind: txt("ese | mse | ca | practical | oral", { req: true, def: "'ese'" }) },
  },
  milestones: {
    group: "college",
    doc: "4-day study blocks with unit-level targets.",
    idx: ["semester_id"],
    cols: { semester_id: ref("semesters", undefined, { req: true }), start_date: date(undefined, { req: true }), end_date: date(undefined, { req: true }), title: txt(), targets: { t: "jsonb", req: true, def: "'[]'::jsonb", doc: "[unit_id]" }, done: bool() },
  },
  pyq_papers: {
    group: "college",
    doc: "Previous-year papers (link or storage path).",
    idx: ["subject_id"],
    cols: { subject_id: ref("subjects", undefined, { req: true }), year: int(), session: txt("e.g. Winter 2025"), url: txt(), storage_path: txt() },
  },
  pyq_questions: {
    group: "college",
    doc: "Questions tagged to units by hand (no OCR).",
    idx: ["paper_id", "unit_id"],
    cols: { paper_id: ref("pyq_papers", undefined, { req: true }), unit_id: ref("units"), text_or_ref: txt(undefined, { req: true }), marks: int(), repeat_count: int(undefined, { req: true, def: "1" }) },
  },
  submissions: {
    group: "college",
    doc: "Assignments, practicals, journals.",
    idx: ["subject_id", "due_date"],
    cols: { subject_id: ref("subjects", undefined, { req: true }), kind: txt("assignment | practical | journal | other", { req: true, def: "'assignment'" }), title: txt(undefined, { req: true }), due_date: date(), done_at: ts() },
  },
  marks: {
    group: "college",
    doc: "Marks per subject. Theory CA20+MSE20+ESE60; practical CA60+ESE40.",
    unique: [["subject_id"]],
    cols: { subject_id: ref("subjects", undefined, { req: true }), ca: num(), mse: num(), ese: num(), grade_point: num("Override; computed otherwise") },
  },
  grade_scale: {
    group: "college",
    doc: "Editable grade table (percentage -> grade -> points).",
    cols: { min_pct: num(undefined, { req: true }), grade: txt(undefined, { req: true }), points: num(undefined, { req: true }) },
  },

  // ---------------- mind ----------------
  chess_snapshots: {
    group: "mind",
    doc: "Daily Chess.com ratings.",
    unique: [["date"]],
    cols: { date: date(undefined, { req: true }), rapid: int(), blitz: int(), bullet: int(), daily: int(), puzzles: int("Tactics rating"), puzzle_rush_best: int() },
  },
  chess_games: {
    group: "mind",
    doc: "Recent Chess.com games (PGN) for review in Bobby.",
    idx: ["end_time"],
    unique: [["url"]],
    cols: { url: txt(undefined, { req: true }), archive_url: txt(), end_time: ts(), time_class: txt(), result: txt("win | loss | draw"), accuracy: num(), opponent: txt(), pgn: txt() },
  },
  chess_events: {
    group: "mind",
    doc: "Activity reported by the embedded Bobby app (puzzle solved, game finished, lesson done).",
    idx: ["date"],
    cols: { date: date(undefined, { req: true }), kind: txt(undefined, { req: true }), detail: json() },
  },
  meditation_sessions: {
    group: "mind",
    doc: "Meditation minutes.",
    idx: ["date"],
    cols: { date: date(undefined, { req: true }), minutes: int(undefined, { req: true }), preset: txt() },
  },
  flashcard_decks: {
    group: "mind",
    doc: "Flashcard decks.",
    cols: { name: txt(undefined, { req: true }), order_no: int(undefined, { req: true, def: "0" }) },
  },
  flashcards: {
    group: "mind",
    doc: "Cards scheduled with SM-2.",
    idx: ["deck_id", "due_at"],
    cols: {
      deck_id: ref("flashcard_decks", undefined, { req: true }),
      front: txt(undefined, { req: true }),
      back: txt(undefined, { req: true }),
      source: txt("manual | note | video"),
      ef: num("Ease factor", { req: true, def: "2.5" }),
      interval_days: int(undefined, { req: true, def: "0" }),
      reps: int(undefined, { req: true, def: "0" }),
      lapses: int(undefined, { req: true, def: "0" }),
      due_at: date(),
      is_new: bool(undefined, "true"),
    },
  },
  flashcard_reviews: {
    group: "mind",
    doc: "Review log.",
    idx: ["card_id", "date"],
    cols: { card_id: ref("flashcards", undefined, { req: true }), date: date(undefined, { req: true }), grade: int("0-5", { req: true }), interval_days: int() },
  },
  books: {
    group: "mind",
    doc: "Reading shelf.",
    cols: { title: txt(undefined, { req: true }), author: txt(), status: txt("queued | reading | finished", { req: true, def: "'queued'" }), started_at: date(), finished_at: date() },
  },
  reading_sessions: {
    group: "mind",
    doc: "Per session: pages or minutes + one-line lesson.",
    idx: ["book_id", "date"],
    cols: { book_id: ref("books", undefined, { req: true }), date: date(undefined, { req: true }), pages: int(), minutes: int(), lesson: txt() },
  },
  stuck_ladder: {
    group: "mind",
    doc: "Weekly stuck-minutes target.",
    unique: [["week_start"]],
    cols: { week_start: date(undefined, { req: true }), target_min: int(undefined, { req: true }) },
  },
  cube_solves: {
    group: "mind",
    doc: "Locked module: cube timer.",
    idx: ["date"],
    cols: { date: date(undefined, { req: true }), time_ms: int(undefined, { req: true }), scramble: txt(), dnf: bool() },
  },
  math_drills: {
    group: "mind",
    doc: "Locked module: mental math drills.",
    idx: ["date"],
    cols: { date: date(undefined, { req: true }), kind: txt(undefined, { req: true }), correct: int(undefined, { req: true }), total: int(undefined, { req: true }), seconds: int() },
  },
  memory_palaces: {
    group: "mind",
    doc: "Locked module: loci lists.",
    cols: { title: txt(undefined, { req: true }), loci: { t: "jsonb", req: true, def: "'[]'::jsonb", doc: "[{place, item}]" } },
  },

  // ---------------- body ----------------
  exercise_templates: {
    group: "body",
    doc: "Workout templates (Full Body A/B, Upper/Lower...).",
    idx: ["template"],
    cols: {
      template: txt("e.g. Full Body A", { req: true }),
      exercise: txt(undefined, { req: true }),
      sets: int(undefined, { req: true, def: "3" }),
      rep_low: int(undefined, { req: true, def: "8" }),
      rep_high: int(undefined, { req: true, def: "12" }),
      unit: txt("reps | seconds", { req: true, def: "'reps'" }),
      weight_step: num("Smallest weight jump (kg)", { req: true, def: "2.5" }),
      order_no: int(undefined, { req: true, def: "0" }),
    },
  },
  workouts: {
    group: "body",
    private: true,
    doc: "Workouts, logged after the session.",
    idx: ["date"],
    cols: { date: date(undefined, { req: true }), session: txt(undefined, { req: true }), duration_min: int(), notes: txt(), minimum_session: bool("Counts as the 20-minute minimum") },
  },
  workout_sets: {
    group: "body",
    private: true,
    doc: "Sets per workout.",
    idx: ["workout_id", "exercise"],
    cols: { workout_id: ref("workouts", undefined, { req: true }), exercise: txt(undefined, { req: true }), set_no: int(undefined, { req: true }), reps: int(), weight_kg: num() },
  },
  weigh_ins: {
    group: "body",
    private: true,
    doc: "Sunday weigh-ins.",
    unique: [["date"]],
    cols: { date: date(undefined, { req: true }), weight_kg: num(undefined, { req: true }) },
  },
  body_targets: {
    group: "body",
    private: true,
    doc: "One row. Weight targets (all editable).",
    cols: {
      height_cm: num(undefined, { def: "167" }),
      start_kg: num(undefined, { def: "50" }),
      start_date: date(undefined, { def: "'2026-10-11'" }),
      target_12w_low: num(undefined, { def: "53" }),
      target_12w_high: num(undefined, { def: "55" }),
      target_long_low: num(undefined, { def: "60" }),
      target_long_high: num(undefined, { def: "62" }),
      weekly_gain_low: num(undefined, { def: "0.25" }),
      weekly_gain_high: num(undefined, { def: "0.4" }),
      training_start_date: date(),
    },
  },
  diet_logs: {
    group: "body",
    private: true,
    doc: "Manual calorie/protein entries (many per day).",
    idx: ["date"],
    cols: { date: date(undefined, { req: true }), calories: int(undefined, { req: true, def: "0" }), protein_g: int(undefined, { req: true, def: "0" }), template_id: ref("meal_templates"), label: txt() },
  },
  meal_templates: {
    group: "body",
    doc: "One-tap meals. is_estimate=true until Dharma corrects the numbers.",
    cols: { name: txt(undefined, { req: true }), calories: int(undefined, { req: true, def: "0" }), protein_g: int(undefined, { req: true, def: "0" }), is_estimate: bool(undefined, "true"), order_no: int(undefined, { req: true, def: "0" }) },
  },
  water_logs: {
    group: "body",
    doc: "Water entries (ml).",
    idx: ["date"],
    cols: { date: date(undefined, { req: true }), ml: int(undefined, { req: true }) },
  },
  measurements: {
    group: "body",
    private: true,
    doc: "Monthly measurements {chest, waist, arm, thigh, shoulders} in cm.",
    idx: ["date"],
    cols: { date: date(undefined, { req: true }), values: json() },
  },
  progress_photos: {
    group: "body",
    private: true,
    doc: "Private progress photos (bucket: progress-photos).",
    idx: ["date"],
    cols: { date: date(undefined, { req: true }), pose: txt("front | side | back", { req: true }), storage_path: txt(undefined, { req: true }) },
  },

  // ---------------- persona ----------------
  speaking_recordings: {
    group: "persona",
    private: true,
    doc: "2-minute speaking drills (bucket: recordings).",
    idx: ["date"],
    cols: {
      date: date(undefined, { req: true }),
      storage_path: txt(undefined, { req: true }),
      mime: txt(),
      duration_s: int(),
      topic: txt(),
      restarts: int(),
      fillers: int(),
      switches: int("Marathi/Hindi switches"),
      pace_rating: int("1 slow .. 5 fast"),
      is_baseline: bool(),
      baseline_day: int("0, 30, 60, 90"),
    },
  },
  persona_daily: {
    group: "persona",
    doc: "Daily counters.",
    unique: [["date"]],
    cols: {
      date: date(undefined, { req: true }),
      english_min: int(undefined, { req: true, def: "0" }),
      conversations_started: int(undefined, { req: true, def: "0" }),
      real_conversations: int(undefined, { req: true, def: "0" }),
      calls_answered: int(undefined, { req: true, def: "0" }),
      calls_made: int(undefined, { req: true, def: "0" }),
      ladder_rung: int(),
      outreach_done: bool(),
    },
  },
  contacts: {
    group: "persona",
    private: true,
    doc: "Networking contacts. Tier A practitioners, B managers/recruiters, C founders, D follow-only.",
    idx: ["status", "follow_up_at"],
    cols: {
      name: txt(undefined, { req: true }),
      title: txt(),
      company: txt(),
      tier: txt("A | B | C | D"),
      linkedin_url: txt(),
      verified: bool("URL verified", "false"),
      status: txt("sent | accepted | talked", { req: true, def: "'sent'" }),
      sent_at: date(),
      accepted_at: date(),
      talked_at: date(),
      follow_up_at: date(),
      notes: txt(),
      import_key: txt("Dedupe key from the Notion import"),
    },
  },
  posts: {
    group: "persona",
    doc: "LinkedIn / X posts.",
    idx: ["status", "published_at"],
    cols: {
      platform: txt("linkedin | x", { req: true }),
      body: txt(undefined, { req: true, def: "''" }),
      status: txt("draft | queued | published", { req: true, def: "'draft'" }),
      buffer_id: txt(),
      published_at: date(),
      url: txt(),
      idea_id: ref("post_ideas"),
      kind: txt("post | article", { req: true, def: "'post'" }),
    },
  },
  post_ideas: {
    group: "persona",
    doc: "Ideas bank. Flywheel: note -> x -> linkedin -> article.",
    cols: { text: txt(undefined, { req: true }), source_table: txt(), source_id: txt(), stage: txt("note | x | linkedin | article", { req: true, def: "'note'" }) },
  },
  x_follows: {
    group: "persona",
    doc: "X follow list (migrated from Notion).",
    unique: [["handle"]],
    cols: { handle: txt(undefined, { req: true }), name: txt(), company: txt(), why: txt(), learn: txt(), first_reply: txt(), followed_at: date() },
  },
  market_intel: {
    group: "persona",
    doc: "Job posts read and conversation answers, with skills tags.",
    idx: ["date"],
    cols: { date: date(undefined, { req: true }), kind: txt("job | conversation", { req: true, def: "'job'" }), company: txt(), role: txt(), skills: { t: "text[]", req: true, def: "'{}'" }, source: txt(), notes: txt() },
  },
  presence_items: {
    group: "persona",
    doc: "Editable presence/style checklist.",
    cols: { label: txt(undefined, { req: true }), order_no: int(undefined, { req: true, def: "0" }), active: bool(undefined, "true") },
  },
  presence_ticks: {
    group: "persona",
    doc: "Daily presence ticks.",
    idx: ["date"],
    unique: [["date", "item_id"]],
    cols: { date: date(undefined, { req: true }), item_id: ref("presence_items", undefined, { req: true }), done: bool(undefined, "true") },
  },
} satisfies Record<string, TableDef>;

export type TableName = keyof typeof TABLES;
export const TABLE_NAMES = Object.keys(TABLES) as TableName[];
export const SYNC_TABLES = TABLE_NAMES.filter((t) => !(TABLES[t] as TableDef).serverOnly);

/** Dexie store definition string for a table: primary key id + secondary indexes. */
export function dexieStore(t: TableName): string {
  const d = TABLES[t] as TableDef;
  const idx = new Set<string>(["updated_at", ...(d.idx ?? [])]);
  for (const u of d.unique ?? []) idx.add(u.length === 1 ? u[0] : `[${u.join("+")}]`);
  return ["id", ...idx].join(", ");
}
