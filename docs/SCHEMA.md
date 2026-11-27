# ONE Schema

Source of truth: `apps/web/src/data/schema.ts`. `pnpm db:gen` regenerates `supabase/migrations/0001_init.sql`, the client row types (`types.gen.ts`) and the tables section below. `pnpm db:check` runs every migration on real Postgres (PGlite) and verifies RLS, last-write-wins, the views and public-stats filtering.

## For Claude (reading via the Supabase connector)
- Start with **`daily_summary`** (one row per date, all sections) and **`weekly_summary`** (per Monday-start week + grade).
- Dates are `date` columns in **Asia/Kolkata** local time. Timestamps are `timestamptz`.
- Ignore rows where `deleted_at` is not null (soft deletes).
- Journal lives in `daily_reviews` (journal_good / journal_bad / journal_lesson). Weekly reviews in `weekly_grades`.
- Sections are always one of `career | mind | body | persona | home`.

## Conventions (every table)
| Column | Meaning |
|---|---|
| `id uuid` | Primary key, generated on the client (seed rows use deterministic ids) |
| `user_id uuid` | Owner. RLS: `user_id = auth.uid()` for select/insert/update/delete |
| `created_at` | First write |
| `updated_at` | Last edit, client clock. Server trigger ignores writes older than the stored row (last-write-wins) |
| `synced_at` | Server clock, set by trigger on every write. Clients pull `synced_at > last pull` |
| `deleted_at` | Soft delete, so deletes sync |

Unique keys are partial unique indexes `where deleted_at is null`.

## Views and functions
| Name | What |
|---|---|
| `daily_summary` (view, security_invoker) | date, tasks done per section, xp, focus_min, python_block1_min, gym_done, weight_kg, calories, protein_g, water_ml, chess_rapid, meditation_min, speaking_min, posts_published, pushes, review_submitted |
| `weekly_summary` (view, security_invoker) | week_start + weekly totals (block1_days, gym_sessions, reviews_submitted …) + grade |
| `public_stats` (view) | What the portfolio sees: `my_public_stats()` for the signed-in user |
| `public_stats_for(uid)` (function, security definer, service_role only) | Returns only stats whose flag is true in `settings.public_stat_flags`. Candidates: lock_in_day, overall_streak, level, current_focus, python_hours_week, github_pushes_week, chess_rapid, posts_month, books_finished, workouts_month, grid. Body data, journal, contacts, recordings and photos are never candidates. |

## Storage (private buckets)
`progress-photos`, `recordings`, `pyq`. Object path `<user_id>/<file>`; policies allow only the owner. Read with signed URLs.

## Server-only tables
`integration_secrets` (AES-256-GCM encrypted tokens) and `api_cache`: RLS enabled with no policies, privileges revoked from `anon`/`authenticated`. Only the service role (the Vercel function) touches them.

## Tables
<!-- TABLES:START -->
### Core

#### `profile`
One row. Who Dharma is and when the lock-in started.

| Column | Type | Notes |
|---|---|---|
| `name` | text | required; default `'Dharmaraj Aparadh'`; Display name |
| `tagline` | text | default `'AI Engineer in training'`; Shown under the name |
| `target_title` | text | default `'AI Engineer'`; AI Engineer or AI/ML Engineer |
| `photo_url` | text | Avatar URL or storage path |
| `lock_in_start_date` | date | Day 1 of the lock-in |
| `timezone` | text | required; default `'Asia/Kolkata'`; IANA timezone |

#### `settings`
One row. App preferences, usernames, targets and flags.

| Column | Type | Notes |
|---|---|---|
| `theme` | text | required; default `'dark'`; dark / light |
| `accents` | jsonb | required; default `'{}'::jsonb`; Section accent overrides {career,mind,body,persona} |
| `reduced_motion` | text | required; default `'system'`; system / reduced / full |
| `font_scale` | numeric | required; default `1`; 1 = default |
| `usernames` | jsonb | required; default `'{}'::jsonb`; {chesscom, leetcode, github} |
| `public_stat_flags` | jsonb | required; default `'{}'::jsonb`; Which stats the portfolio may show. All false by default. |
| `exam_mode` | boolean | required; default `false`; Exam mode switch |
| `modules` | jsonb | required; default `'{}'::jsonb`; Locked MIND modules on/off {cube, math, palace} |
| `targets` | jsonb | required; default `'{}'::jsonb`; Every numeric target (see domain/targets.ts) |
| `music_url` | text | Apple Music embed URL |
| `obsidian` | jsonb | required; default `'{}'::jsonb`; Obsidian mirror state {folder_name, last_mirror_at, error} |
| `seed_version` | integer | required; default `0`; Seed content version applied |

#### `tasks`
Daily tasks from paths, habits, reviews, follow-ups, calendar or manual entry.

| Column | Type | Notes |
|---|---|---|
| `section` | text | required; career / mind / body / persona / home |
| `title` | text | required; What to do |
| `due_date` | date | Day it belongs to (IST) |
| `done_at` | timestamptz | When it was ticked |
| `source` | text | required; default `'manual'`; manual / path / habit / review / followup / calendar / exam / note |
| `source_ref` | text | Idempotency key for generated tasks, e.g. habit:<id>:<date> |
| `path_item_id` | uuid | → `path_items.id`; Linked path item |
| `priority` | integer | required; default `2`; 1 high .. 3 low |
| `is_one_thing` | boolean | required; default `false`; The day's One Thing |
| `notes` | text |  |

#### `habits`
Recurring tasks that generate a task on matching weekdays.

| Column | Type | Notes |
|---|---|---|
| `section` | text | required; career / mind / body / persona / home |
| `title` | text | required |
| `days` | integer[] | required; default `'{1,2,3,4,5,6,0}'`; Weekdays 0=Sun..6=Sat |
| `time` | time | Planned start time (IST) |
| `minutes` | integer | Planned duration |
| `calendar` | boolean | required; default `false`; Push to the ONE Google calendar |
| `active` | boolean | required; default `true`; Generates tasks |
| `order_no` | integer | required; default `0` |

#### `path_stages`
Planning engine stages per section (and lane, e.g. python / llm).

| Column | Type | Notes |
|---|---|---|
| `section` | text | required; career / mind / body / persona / home |
| `lane` | text | required; default `'main'`; python / llm / main |
| `order_no` | integer | required; default `0` |
| `title` | text | required |
| `description` | text |  |
| `gate_criteria` | text | What must be true to pass the stage |
| `gate_passed_at` | timestamptz |  |
| `status` | text | required; default `'todo'`; todo / active / done |
| `target_week` | integer | Planned week number from lock-in start |

#### `path_items`
Items inside a stage (lessons, projects, drills).

| Column | Type | Notes |
|---|---|---|
| `stage_id` | uuid | required; → `path_stages.id` |
| `section` | text | required; career / mind / body / persona / home |
| `order_no` | integer | required; default `0` |
| `title` | text | required |
| `kind` | text | required; default `'learn'`; learn / build / drill / share |
| `target_week` | integer |  |
| `status` | text | required; default `'todo'`; todo / doing / done |
| `done_at` | timestamptz |  |

#### `xp_events`
Every XP award. Idempotent by (kind, ref_table, ref_id).

| Column | Type | Notes |
|---|---|---|
| `date` | date | required |
| `section` | text | required; career / mind / body / persona / home |
| `kind` | text | required; See domain/xp.ts |
| `points` | integer | required |
| `ref_table` | text | required; default `''` |
| `ref_id` | text | required; default `''` |

Unique per user: (kind, ref_table, ref_id).

#### `achievement_unlocks`
Unlocked achievements (definitions live in code: domain/achievements.ts).

| Column | Type | Notes |
|---|---|---|
| `code` | text | required |
| `unlocked_at` | timestamptz | required; default `now()` |

Unique per user: (code).

#### `daily_reviews` (private)
Nightly review + journal, one per date.

| Column | Type | Notes |
|---|---|---|
| `date` | date | required |
| `gym_status` | text | done / missed / rest |
| `calories` | integer |  |
| `protein_g` | integer |  |
| `water_ml` | integer |  |
| `python_block1_min` | integer |  |
| `pushes` | integer |  |
| `stuck_min` | integer | Longest stuck stretch |
| `outreach_done` | boolean |  |
| `speaking_min` | integer |  |
| `journal_good` | text | Went well |
| `journal_bad` | text | Didn't |
| `journal_lesson` | text | Lesson |
| `tomorrow_one_thing` | text |  |
| `lights_out_time` | time |  |
| `mood_optional` | integer | 1-5 |
| `submitted_at` | timestamptz |  |

Unique per user: (date).

#### `focus_sessions`
Focus timer sessions. kind=block1 counts for CAREER done.

| Column | Type | Notes |
|---|---|---|
| `date` | date | required |
| `section` | text | required; career / mind / body / persona / home |
| `kind` | text | required; default `'free'`; block1 / block2 / block3 / study / free |
| `label` | text |  |
| `started_at` | timestamptz | required |
| `ended_at` | timestamptz |  |
| `minutes` | integer | required; default `0` |
| `phone_free` | boolean | required; default `false` |

#### `weekly_grades`
Weekly grade (9 checks) and Sunday review.

| Column | Type | Notes |
|---|---|---|
| `week_start` | date | required; Monday |
| `checks` | jsonb | required; default `'{}'::jsonb`; {gym, weigh_in, block1, push, review, outreach, flashcards, lights_out, meditation}: bool |
| `grade` | text | A-F |
| `wins` | text[] | required; default `'{}'` |
| `fails` | text[] | required; default `'{}'` |
| `priorities` | text[] | required; default `'{}'` |
| `finalised_at` | timestamptz |  |

Unique per user: (week_start).

#### `calendar_links`
Maps local items to Google Calendar event ids in the ONE calendar.

| Column | Type | Notes |
|---|---|---|
| `local_kind` | text | required |
| `local_id` | text | required |
| `google_event_id` | text | required |

Unique per user: (local_kind, local_id).

#### `integration_status`
Status per integration for the Settings page.

| Column | Type | Notes |
|---|---|---|
| `provider` | text | required; google / github / leetcode / chesscom / buffer / youtube / apple_music / obsidian |
| `status` | text | required; default `'off'`; connected / error / stale / off |
| `last_ok_at` | timestamptz |  |
| `last_error` | text |  |
| `meta` | jsonb | required; default `'{}'::jsonb` |

Unique per user: (provider).

### Library

#### `videos`
Curated YouTube videos. Only approved=true show outside the Inbox.

| Column | Type | Notes |
|---|---|---|
| `youtube_id` | text | required |
| `title` | text | required |
| `channel` | text |  |
| `duration_s` | integer |  |
| `section` | text | required; career / mind / body / persona / home |
| `topic` | text |  |
| `rating` | integer | Dharma's 1-5 |
| `priority` | integer | required; default `2`; 1 high .. 3 low |
| `path_item_id` | uuid | → `path_items.id` |
| `approved` | boolean | required; default `false` |
| `rejected` | boolean | required; default `false` |
| `frame` | integer | required; default `2`; Preferred frame image 1-3 |
| `source` | text | manual / cubicle / bobby / bulk |
| `added_at` | timestamptz | required; default `now()` |

Unique per user: (youtube_id, section).

#### `video_progress`
Watch state per video.

| Column | Type | Notes |
|---|---|---|
| `video_id` | uuid | required; → `videos.id` |
| `status` | text | required; default `'queue'`; queue / watching / done |
| `position_s` | integer | required; default `0` |
| `finished_at` | timestamptz |  |

Unique per user: (video_id).

#### `video_notes`
Timestamped notes while watching.

| Column | Type | Notes |
|---|---|---|
| `video_id` | uuid | required; → `videos.id` |
| `t_seconds` | integer | required; default `0` |
| `text` | text | required |

### Career

#### `leetcode_snapshots`
Daily LeetCode solved counts (unofficial API).

| Column | Type | Notes |
|---|---|---|
| `date` | date | required |
| `easy` | integer |  |
| `medium` | integer |  |
| `hard` | integer |  |
| `total` | integer |  |
| `ranking` | integer |  |

Unique per user: (date).

#### `problem_log`
Practice problems with stuck minutes.

| Column | Type | Notes |
|---|---|---|
| `date` | date | required |
| `platform` | text | required; LeetCode / Exercism / HackerRank / py4e / other |
| `title` | text | required |
| `url` | text |  |
| `difficulty` | text | easy / medium / hard |
| `minutes` | integer |  |
| `stuck_min` | integer |  |
| `solved` | boolean | required; default `false` |
| `notes` | text |  |

#### `projects`
Build board: idea | building | shipped | paused.

| Column | Type | Notes |
|---|---|---|
| `name` | text | required |
| `repo` | text |  |
| `status` | text | required; default `'idea'` |
| `notes` | text |  |
| `order_no` | integer | required; default `0` |

#### `github_snapshots`
Daily GitHub contributions and pushes.

| Column | Type | Notes |
|---|---|---|
| `date` | date | required |
| `contributions` | integer |  |
| `pushes_today` | integer |  |
| `calendar` | jsonb | required; default `'{}'::jsonb`; [{date,count}] last year |

Unique per user: (date).

#### `website_ideas`
Website ideas (migrated from Notion).

| Column | Type | Notes |
|---|---|---|
| `title` | text | required |
| `description` | text |  |
| `status` | text | required; default `'idea'`; idea / validating / building / dropped |
| `idea_date` | date |  |

#### `hackathons`
Hackathon list (migrated from Notion).

| Column | Type | Notes |
|---|---|---|
| `name` | text | required |
| `url` | text |  |
| `start_date` | date |  |
| `end_date` | date |  |
| `deadline` | date |  |
| `team` | text |  |
| `status` | text | required; default `'interested'`; interested / applied / building / submitted / done / skipped |
| `notes` | text |  |
| `needs_details` | boolean | required; default `false` |

#### `news_items`
News room picks, hard-capped at 10 per day.

| Column | Type | Notes |
|---|---|---|
| `date` | date | required |
| `source` | text |  |
| `title` | text | required |
| `url` | text | required |
| `read` | boolean | required; default `false` |
| `saved` | boolean | required; default `false` |

Unique per user: (date, url).

#### `reading_list`
Saved articles. A takeaway is required before marking read.

| Column | Type | Notes |
|---|---|---|
| `url` | text | required |
| `title` | text |  |
| `saved_at` | timestamptz | required; default `now()` |
| `read_at` | timestamptz |  |
| `takeaway` | text |  |

#### `notes`
Markdown notes with spaced review 3/7/30/90 days.

| Column | Type | Notes |
|---|---|---|
| `section` | text | required; default `'career'`; career / mind / body / persona / home |
| `topic` | text |  |
| `title` | text | required |
| `body_md` | text | required; default `''` |
| `next_review_at` | date |  |
| `review_stage` | integer | required; default `0` |

### College

#### `semesters`
Semesters. Archived ones are read-only.

| Column | Type | Notes |
|---|---|---|
| `name` | text | required |
| `number` | integer |  |
| `start_date` | date |  |
| `end_date` | date |  |
| `archived` | boolean | required; default `false` |

#### `subjects`
Subjects per semester.

| Column | Type | Notes |
|---|---|---|
| `semester_id` | uuid | required; → `semesters.id` |
| `name` | text | required |
| `code` | text |  |
| `credits` | numeric |  |
| `importance_rank` | integer | 1 = most important |
| `has_ese` | boolean | required; default `true`; Has an end-semester exam |
| `kind` | text | required; default `'theory'`; theory / practical / audit |
| `notebooklm_url` | text |  |
| `syllabus_url` | text |  |
| `formula_sheet_url` | text |  |
| `mindmap_url` | text |  |
| `order_no` | integer | required; default `0` |

#### `units`
Units. Cracked = concept + examples + every PYQ solved without notes.

| Column | Type | Notes |
|---|---|---|
| `subject_id` | uuid | required; → `subjects.id` |
| `number` | integer | required |
| `title` | text |  |
| `status` | text | required; default `'not_started'`; not_started / in_progress / cracked |

#### `exams`
Exam timetable.

| Column | Type | Notes |
|---|---|---|
| `subject_id` | uuid | required; → `subjects.id` |
| `date` | date | required |
| `start_time` | time |  |
| `kind` | text | required; default `'ese'`; ese / mse / ca / practical / oral |

#### `milestones`
4-day study blocks with unit-level targets.

| Column | Type | Notes |
|---|---|---|
| `semester_id` | uuid | required; → `semesters.id` |
| `start_date` | date | required |
| `end_date` | date | required |
| `title` | text |  |
| `targets` | jsonb | required; default `'[]'::jsonb`; [unit_id] |
| `done` | boolean | required; default `false` |

#### `pyq_papers`
Previous-year papers (link or storage path).

| Column | Type | Notes |
|---|---|---|
| `subject_id` | uuid | required; → `subjects.id` |
| `year` | integer |  |
| `session` | text | e.g. Winter 2025 |
| `url` | text |  |
| `storage_path` | text |  |

#### `pyq_questions`
Questions tagged to units by hand (no OCR).

| Column | Type | Notes |
|---|---|---|
| `paper_id` | uuid | required; → `pyq_papers.id` |
| `unit_id` | uuid | → `units.id` |
| `text_or_ref` | text | required |
| `marks` | integer |  |
| `repeat_count` | integer | required; default `1` |

#### `submissions`
Assignments, practicals, journals.

| Column | Type | Notes |
|---|---|---|
| `subject_id` | uuid | required; → `subjects.id` |
| `kind` | text | required; default `'assignment'`; assignment / practical / journal / other |
| `title` | text | required |
| `due_date` | date |  |
| `done_at` | timestamptz |  |

#### `marks`
Marks per subject. Theory CA20+MSE20+ESE60; practical CA60+ESE40.

| Column | Type | Notes |
|---|---|---|
| `subject_id` | uuid | required; → `subjects.id` |
| `ca` | numeric |  |
| `mse` | numeric |  |
| `ese` | numeric |  |
| `grade_point` | numeric | Override; computed otherwise |

Unique per user: (subject_id).

#### `grade_scale`
Editable grade table (percentage -> grade -> points).

| Column | Type | Notes |
|---|---|---|
| `min_pct` | numeric | required |
| `grade` | text | required |
| `points` | numeric | required |

### Mind

#### `chess_snapshots`
Daily Chess.com ratings.

| Column | Type | Notes |
|---|---|---|
| `date` | date | required |
| `rapid` | integer |  |
| `blitz` | integer |  |
| `bullet` | integer |  |
| `daily` | integer |  |
| `puzzles` | integer | Tactics rating |
| `puzzle_rush_best` | integer |  |

Unique per user: (date).

#### `chess_games`
Recent Chess.com games (PGN) for review in Bobby.

| Column | Type | Notes |
|---|---|---|
| `url` | text | required |
| `archive_url` | text |  |
| `end_time` | timestamptz |  |
| `time_class` | text |  |
| `result` | text | win / loss / draw |
| `accuracy` | numeric |  |
| `opponent` | text |  |
| `pgn` | text |  |

Unique per user: (url).

#### `chess_events`
Activity reported by the embedded Bobby app (puzzle solved, game finished, lesson done).

| Column | Type | Notes |
|---|---|---|
| `date` | date | required |
| `kind` | text | required |
| `detail` | jsonb | required; default `'{}'::jsonb` |

#### `meditation_sessions`
Meditation minutes.

| Column | Type | Notes |
|---|---|---|
| `date` | date | required |
| `minutes` | integer | required |
| `preset` | text |  |

#### `flashcard_decks`
Flashcard decks.

| Column | Type | Notes |
|---|---|---|
| `name` | text | required |
| `order_no` | integer | required; default `0` |

#### `flashcards`
Cards scheduled with SM-2.

| Column | Type | Notes |
|---|---|---|
| `deck_id` | uuid | required; → `flashcard_decks.id` |
| `front` | text | required |
| `back` | text | required |
| `source` | text | manual / note / video |
| `ef` | numeric | required; default `2.5`; Ease factor |
| `interval_days` | integer | required; default `0` |
| `reps` | integer | required; default `0` |
| `lapses` | integer | required; default `0` |
| `due_at` | date |  |
| `is_new` | boolean | required; default `true` |

#### `flashcard_reviews`
Review log.

| Column | Type | Notes |
|---|---|---|
| `card_id` | uuid | required; → `flashcards.id` |
| `date` | date | required |
| `grade` | integer | required; 0-5 |
| `interval_days` | integer |  |

#### `books`
Reading shelf.

| Column | Type | Notes |
|---|---|---|
| `title` | text | required |
| `author` | text |  |
| `status` | text | required; default `'queued'`; queued / reading / finished |
| `started_at` | date |  |
| `finished_at` | date |  |

#### `reading_sessions`
Per session: pages or minutes + one-line lesson.

| Column | Type | Notes |
|---|---|---|
| `book_id` | uuid | required; → `books.id` |
| `date` | date | required |
| `pages` | integer |  |
| `minutes` | integer |  |
| `lesson` | text |  |

#### `stuck_ladder`
Weekly stuck-minutes target.

| Column | Type | Notes |
|---|---|---|
| `week_start` | date | required |
| `target_min` | integer | required |

Unique per user: (week_start).

#### `cube_solves`
Locked module: cube timer.

| Column | Type | Notes |
|---|---|---|
| `date` | date | required |
| `time_ms` | integer | required |
| `scramble` | text |  |
| `dnf` | boolean | required; default `false` |

#### `math_drills`
Locked module: mental math drills.

| Column | Type | Notes |
|---|---|---|
| `date` | date | required |
| `kind` | text | required |
| `correct` | integer | required |
| `total` | integer | required |
| `seconds` | integer |  |

#### `memory_palaces`
Locked module: loci lists.

| Column | Type | Notes |
|---|---|---|
| `title` | text | required |
| `loci` | jsonb | required; default `'[]'::jsonb`; [{place, item}] |

### Body

#### `exercise_templates`
Workout templates (Full Body A/B, Upper/Lower...).

| Column | Type | Notes |
|---|---|---|
| `template` | text | required; e.g. Full Body A |
| `exercise` | text | required |
| `sets` | integer | required; default `3` |
| `rep_low` | integer | required; default `8` |
| `rep_high` | integer | required; default `12` |
| `unit` | text | required; default `'reps'`; reps / seconds |
| `weight_step` | numeric | required; default `2.5`; Smallest weight jump (kg) |
| `order_no` | integer | required; default `0` |

#### `workouts` (private)
Workouts, logged after the session.

| Column | Type | Notes |
|---|---|---|
| `date` | date | required |
| `session` | text | required |
| `duration_min` | integer |  |
| `notes` | text |  |
| `minimum_session` | boolean | required; default `false`; Counts as the 20-minute minimum |

#### `workout_sets` (private)
Sets per workout.

| Column | Type | Notes |
|---|---|---|
| `workout_id` | uuid | required; → `workouts.id` |
| `exercise` | text | required |
| `set_no` | integer | required |
| `reps` | integer |  |
| `weight_kg` | numeric |  |

#### `weigh_ins` (private)
Sunday weigh-ins.

| Column | Type | Notes |
|---|---|---|
| `date` | date | required |
| `weight_kg` | numeric | required |

Unique per user: (date).

#### `body_targets` (private)
One row. Weight targets (all editable).

| Column | Type | Notes |
|---|---|---|
| `height_cm` | numeric | default `167` |
| `start_kg` | numeric | default `50` |
| `start_date` | date | default `'2026-10-11'` |
| `target_12w_low` | numeric | default `53` |
| `target_12w_high` | numeric | default `55` |
| `target_long_low` | numeric | default `60` |
| `target_long_high` | numeric | default `62` |
| `weekly_gain_low` | numeric | default `0.25` |
| `weekly_gain_high` | numeric | default `0.4` |
| `training_start_date` | date |  |

#### `diet_logs` (private)
Manual calorie/protein entries (many per day).

| Column | Type | Notes |
|---|---|---|
| `date` | date | required |
| `calories` | integer | required; default `0` |
| `protein_g` | integer | required; default `0` |
| `template_id` | uuid | → `meal_templates.id` |
| `label` | text |  |

#### `meal_templates`
One-tap meals. is_estimate=true until Dharma corrects the numbers.

| Column | Type | Notes |
|---|---|---|
| `name` | text | required |
| `calories` | integer | required; default `0` |
| `protein_g` | integer | required; default `0` |
| `is_estimate` | boolean | required; default `true` |
| `order_no` | integer | required; default `0` |

#### `water_logs`
Water entries (ml).

| Column | Type | Notes |
|---|---|---|
| `date` | date | required |
| `ml` | integer | required |

#### `measurements` (private)
Monthly measurements {chest, waist, arm, thigh, shoulders} in cm.

| Column | Type | Notes |
|---|---|---|
| `date` | date | required |
| `values` | jsonb | required; default `'{}'::jsonb` |

#### `progress_photos` (private)
Private progress photos (bucket: progress-photos).

| Column | Type | Notes |
|---|---|---|
| `date` | date | required |
| `pose` | text | required; front / side / back |
| `storage_path` | text | required |

### Persona

#### `speaking_recordings` (private)
2-minute speaking drills (bucket: recordings).

| Column | Type | Notes |
|---|---|---|
| `date` | date | required |
| `storage_path` | text | required |
| `mime` | text |  |
| `duration_s` | integer |  |
| `topic` | text |  |
| `restarts` | integer |  |
| `fillers` | integer |  |
| `switches` | integer | Marathi/Hindi switches |
| `pace_rating` | integer | 1 slow .. 5 fast |
| `is_baseline` | boolean | required; default `false` |
| `baseline_day` | integer | 0, 30, 60, 90 |

#### `persona_daily`
Daily counters.

| Column | Type | Notes |
|---|---|---|
| `date` | date | required |
| `english_min` | integer | required; default `0` |
| `conversations_started` | integer | required; default `0` |
| `real_conversations` | integer | required; default `0` |
| `calls_answered` | integer | required; default `0` |
| `calls_made` | integer | required; default `0` |
| `ladder_rung` | integer |  |
| `outreach_done` | boolean | required; default `false` |

Unique per user: (date).

#### `contacts` (private)
Networking contacts. Tier A practitioners, B managers/recruiters, C founders, D follow-only.

| Column | Type | Notes |
|---|---|---|
| `name` | text | required |
| `title` | text |  |
| `company` | text |  |
| `tier` | text | A / B / C / D |
| `linkedin_url` | text |  |
| `verified` | boolean | required; default `false`; URL verified |
| `status` | text | required; default `'sent'`; sent / accepted / talked |
| `sent_at` | date |  |
| `accepted_at` | date |  |
| `talked_at` | date |  |
| `follow_up_at` | date |  |
| `notes` | text |  |
| `import_key` | text | Dedupe key from the Notion import |

#### `posts`
LinkedIn / X posts.

| Column | Type | Notes |
|---|---|---|
| `platform` | text | required; linkedin / x |
| `body` | text | required; default `''` |
| `status` | text | required; default `'draft'`; draft / queued / published |
| `buffer_id` | text |  |
| `published_at` | date |  |
| `url` | text |  |
| `idea_id` | uuid | → `post_ideas.id` |
| `kind` | text | required; default `'post'`; post / article |

#### `post_ideas`
Ideas bank. Flywheel: note -> x -> linkedin -> article.

| Column | Type | Notes |
|---|---|---|
| `text` | text | required |
| `source_table` | text |  |
| `source_id` | text |  |
| `stage` | text | required; default `'note'`; note / x / linkedin / article |

#### `x_follows`
X follow list (migrated from Notion).

| Column | Type | Notes |
|---|---|---|
| `handle` | text | required |
| `name` | text |  |
| `company` | text |  |
| `why` | text |  |
| `learn` | text |  |
| `first_reply` | text |  |
| `followed_at` | date |  |

Unique per user: (handle).

#### `market_intel`
Job posts read and conversation answers, with skills tags.

| Column | Type | Notes |
|---|---|---|
| `date` | date | required |
| `kind` | text | required; default `'job'`; job / conversation |
| `company` | text |  |
| `role` | text |  |
| `skills` | text[] | required; default `'{}'` |
| `source` | text |  |
| `notes` | text |  |

#### `presence_items`
Editable presence/style checklist.

| Column | Type | Notes |
|---|---|---|
| `label` | text | required |
| `order_no` | integer | required; default `0` |
| `active` | boolean | required; default `true` |

#### `presence_ticks`
Daily presence ticks.

| Column | Type | Notes |
|---|---|---|
| `date` | date | required |
| `item_id` | uuid | required; → `presence_items.id` |
| `done` | boolean | required; default `true` |

Unique per user: (date, item_id).

### Server

#### `integration_secrets` (server only)
Encrypted third-party tokens (AES-256-GCM). RLS on with NO policies: service role only.

| Column | Type | Notes |
|---|---|---|
| `provider` | text | required |
| `ciphertext` | text | required |
| `iv` | text | required |
| `tag` | text | required |

Unique per user: (provider).

#### `api_cache` (server only)
Server-side cache for third-party responses. Service role only.

| Column | Type | Notes |
|---|---|---|
| `key` | text | required |
| `value` | jsonb | required; default `'{}'::jsonb` |
| `etag` | text |  |
| `fetched_at` | timestamptz | required; default `now()` |

Unique per user: (key).

<!-- TABLES:END -->
