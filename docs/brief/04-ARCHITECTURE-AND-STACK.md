# 04: Architecture and Stack

## Stack
| Layer | Choice | Notes |
|---|---|---|
| Frontend | Vite + React 18 + TypeScript (strict) | Same as Cubicle/BOBBY. Plain CSS or CSS Modules with CSS variables. Tailwind only if you can justify it. |
| Routing | Real paths (`/`, `/career`, `/mind`, `/body`, `/persona`, `/settings`) | **Not hash routing.** The per-section PWAs need path scopes (see 12). |
| Data | **Supabase** (Postgres, Auth, Storage, RLS) | Free plan: pauses after about 1 week of low activity; max 2 active free projects. Dharma uses ONE daily, so that's fine. |
| Server functions | **Vercel serverless functions** (Cubicle already uses them) or Supabase Edge Functions | Use them for every third-party call that needs a secret, a custom header or CORS bypass. Pick one platform, log it in DECISIONS.md. |
| Hosting | **Vercel Hobby** | Personal, non-commercial use. |
| Local cache / offline | IndexedDB (Dexie, as in BOBBY) | Cache reads, queue writes offline, sync when back online. |
| PWA | `vite-plugin-pwa` (Workbox) or hand-written service worker | 5 manifests (see 12). |
| Desktop | **Tauri** (after the PWA is done) | See 12. |
| Tests | Vitest + React Testing Library; Playwright for key flows | |
| Package manager | pnpm (workspace) | Windows-friendly scripts. |

## Auth and security
- Supabase Auth, **one user only (Dharma)**. Disable public sign-ups in the Supabase dashboard. Use email magic link or email+password (Dharma's choice; default magic link).
- **Row Level Security on every table:** `user_id = auth.uid()`.
- Third-party secrets (GitHub token, Google OAuth refresh token, Buffer key, YouTube API key) live **only server-side** (Vercel env vars or Supabase secrets). Never in the client bundle.
- The **public stats endpoint** (for the portfolio) returns only fields Dharma marked public, through a dedicated read-only view or function. No auth leaks.

## Data model (proposal; finalise in PLAN.md and document in `docs/SCHEMA.md`)
Use plain, readable snake_case names, because **Claude reads this database through the Supabase connector** to review Dharma's days. Every user-data table has `id`, `user_id`, `created_at`, `updated_at`. Use `date` columns (Asia/Kolkata local date) for anything daily.

**Core**
- `profile` (name, tagline, photo_url, lock_in_start_date, timezone `Asia/Kolkata`)
- `settings` (theme, accents, reduced_motion, usernames, public_stat_flags jsonb, exam_mode)
- `tasks` (section, title, due_date, done_at, source: path|manual|calendar, path_item_id, priority, is_one_thing)
- `path_stages`, `path_items` (section, stage, title, gate_criteria, target_week, status)
- `xp_events` (section, kind, points, ref_table, ref_id, date)
- `achievements`, `achievement_unlocks`
- `daily_reviews` (date, gym_status, calories, protein_g, water_ml, python_block1_min, pushes, stuck_min, outreach_done, speaking_min, journal_good, journal_bad, journal_lesson, tomorrow_one_thing, lights_out_time, mood_optional)
- `focus_sessions` (section, started_at, ended_at, minutes, label, phone_free bool)
- `weekly_grades` (week_start, checks jsonb, grade)

**Library (shared)**
- `videos` (youtube_id, title, channel, duration_s, section, topic, rating 1-5, priority, path_item_id, approved bool, frame_thumb_url, added_at)
- `video_progress` (video_id, status queue|watching|done, position_s, finished_at)
- `video_notes` (video_id, t_seconds, text)

**CAREER**
- `leetcode_snapshots` (date, easy, medium, hard, total, ranking)
- `problem_log` (date, platform, title, url, difficulty, minutes, stuck_min, solved bool, notes)
- `projects` (name, repo, status, notes), `github_snapshots` (date, contributions, pushes_today)
- `website_ideas`, `hackathons` (name, url, dates, status, team, notes)
- `news_items` (date, source, title, url, read bool), capped at 10/day
- `reading_list` (url, title, saved_at, read_at, takeaway)
- `notes` (section, topic, title, body_md, next_review_at, review_stage)
- College: `semesters`, `subjects` (credits, importance_rank, notebooklm_url, syllabus_url, formula_sheet_url), `units` (status not_started|in_progress|cracked), `exams` (subject_id, date, kind), `milestones` (start, end, targets jsonb), `pyq_papers`, `pyq_questions` (paper_id, unit_id, text_or_ref, repeat_count), `submissions` (kind, due, done_at), `marks` (ca, mse, ese, grade_point)

**MIND**
- `chess_snapshots` (date, rapid, blitz, bullet, daily, puzzles, puzzle_rush_best)
- `chess_games` (archive_url, end_time, time_class, result, accuracy_if_available, pgn), via the Chess.com API
- `meditation_sessions` (date, minutes, preset)
- `flashcards`, `flashcard_reviews` (SM-2 or FSRS fields)
- `books`, `reading_sessions` (book_id, date, pages_or_min, lesson)
- `stuck_ladder` (week_start, target_min)

**BODY**
- `exercise_templates` (session A/B, exercise, sets, rep_low, rep_high, order)
- `workouts` (date, session, duration_min, notes), `workout_sets` (workout_id, exercise, set_no, reps, weight_kg)
- `weigh_ins` (date, weight_kg), `body_targets` (start_kg, target_12w, target_long, weekly_gain_low, weekly_gain_high)
- `diet_logs` (date, calories, protein_g), `meal_templates` (name, calories, protein_g)
- `water_logs` (date, ml), with the target in settings
- `measurements` (date, chest, waist, arm, thigh…), `progress_photos` (date, storage_path); private bucket

**PERSONA**
- `speaking_recordings` (date, storage_path, duration_s, restarts, topic, is_baseline)
- `persona_daily` (date, english_min, conversations_started, calls_answered, calls_made, ladder_rung)
- `contacts` (name, title, company, tier A-D, linkedin_url, status sent|accepted|talked, sent_at, accepted_at, follow_up_at, notes)
- `posts` (platform linkedin|x, body, status draft|queued|published, buffer_id, published_at, url)
- `post_ideas` (source_note_id, text)
- `x_follows` (handle, name, why, first_reply, followed_at)
- `market_intel` (date, company, role, skills text[], source, notes)
- `presence_ticks` (date, front_seat, eye_contact, grooming, skincare, wall_angels)

**Views for Claude and the portfolio**
- `daily_summary`: one row per date across all sections (tasks done per section, XP, focus minutes, gym, weight, calories, protein, water, chess rating, meditation minutes, speaking minutes, posts, pushes, review submitted).
- `weekly_summary`: the same, per week, plus the grade.
- `public_stats`: only fields where the flag in `settings.public_stat_flags` is true.

## Sync rules
- The client writes to IndexedDB first (instant UI), then syncs to Supabase. Last-write-wins per row with `updated_at`; log conflicts.
- Snapshots from third parties (GitHub, LeetCode, Chess.com) are fetched by scheduled server jobs (e.g. Vercel Cron on Hobby, which is limited; check the current limits) and on demand from the UI with a cache TTL. Document the schedule.

## Environments
- `.env.example` lists every variable with a comment.
- Local dev: `pnpm dev`. Supabase can be remote (Dharma's free project) or local via the Supabase CLI (Docker). Default: remote dev project, with migrations in `supabase/migrations`.
- Seed: `supabase/seed.sql` plus TypeScript seed scripts for the content in 17-SEED-CONTENT.
