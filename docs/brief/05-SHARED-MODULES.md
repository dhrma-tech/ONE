# 05: Shared Modules (used by every section)

## 5.1 Library (curated videos)
Every section has a Library. It's a distraction-free YouTube.

**Rules**
- Only videos with `approved = true` show up. Curation happens in chat between Dharma and Claude; ONE stores the result. Add an **"Add video"** form (paste a URL → fetch metadata via oEmbed / YouTube Data API → set section, topic, rating, priority → approve) and a **bulk import** (paste a list of URLs or a JSON file).
- Optional: reuse Cubicle's pipeline to propose candidates into a hidden **"Inbox"** that Dharma approves or rejects one by one.
- Fields: section, topic, title, channel, duration, **rating 1-5 (Dharma's)**, priority, linked path item, status, timestamped notes.

**"Next up" queue**
- Auto-sorted: path order → priority → rating → shortest first, as a tie-breaker.
- Home and each section show **one** "Next up" video. Dharma never browses to decide.

**No clickbait thumbnails**
- Don't use the uploader's custom thumbnail. Use **YouTube's auto-captured in-video frame images** served under `https://i.ytimg.com/vi/<id>/`. There are numbered frame images (e.g. `1.jpg`, `2.jpg`, `3.jpg` and higher-resolution `hq1.jpg`, `hq2.jpg`, `hq3.jpg`). **Verify which ones exist** for a sample of videos and pick the best available (prefer `hq2`), with a fallback to a neutral generated card (title + channel on the section accent).
- Optionally let Dharma pick which frame to use per video.

**Player**
- Embed via `https://www.youtube-nocookie.com/embed/<id>` using the **YouTube IFrame Player API**.
- On `ENDED`, cover the player with ONE's own end card ("Done. Mark complete? Next up: …") so YouTube's end-screen suggestions never show. Also overlay or hide anything that links out.
- Track position (resume where he left off) and mark done at ≥90% watched.
- Timestamped notes: press `N` while watching to add a note at the current time.
- Focus mode: dims everything except the player and notes.

**Library UI**
- Topic tabs + "Next up" + "Queue" + "Done" + "Inbox" (unapproved). Each list paginates, so no infinite scroll.
- Video card: frame thumbnail, title, channel, duration, rating stars, status, accent bar.

## 5.2 Analytics (per section)
Keep it **simple and readable in 3 seconds**.
- **Contribution grid:** 53 weeks × 7 days, GitHub-style, colour levels 0-4 (03-DESIGN-SYSTEM tokens). The level is based on that section's daily "done" score. Animate cells settling on first view. Tooltip: date + what was done.
- **3-5 stat cards** with count-up.
- **One trend chart** (e.g. Python hours per week, weight over time).
- **"Lagging in" callout:** whichever metric is furthest below target this week, in one line ("Protein: 3 of 7 days. Feed the machine.").
- Range switch: week / month / year.
- **Home** has a master grid: the level is based on how many of the 4 sections were "done" that day.

Define each section's "done for the day" rule in PLAN.md (e.g. CAREER done = Python Block 1 ≥ 90 min OR exam-mode study ≥ 2 h).

## 5.3 Path (planning engine)
- Each section has a **path**: stages → items (with gate criteria) → weekly targets → daily tasks.
- Dharma edits paths in-app (simple editor: reorder, add, mark gate passed). Seed paths from 17-SEED-CONTENT.
- **Today view:** tasks generated from the path + recurring habits + manual tasks.
- **Week view:** targets with progress bars. **Month view:** milestones and the calendar.
- **"One thing":** one task per day pinned on Home.
- **Gates:** a stage completes only when its gate is ticked (e.g. "FizzBuzz + largest-in-list from memory in under 5 minutes").

## 5.4 Google Calendar sync
- OAuth (Google Cloud project, Calendar API v3, consent screen in **Testing** mode with Dharma as a test user, which is free).
- **Push:** planned blocks (Python Block 1, gym, exam dates, the review) as events in a dedicated **"ONE" calendar** (create it), so his main calendar stays clean. Include the 11:30 PM nightly review event with a popup reminder.
- **Pull:** today's events from his calendars, shown on Home (read-only).
- Store the refresh token server-side only. Handle token expiry.

## 5.5 XP, levels, streaks, achievements
- XP is earned for real actions: tasks done, a video finished, a workout logged, the review submitted, a post published, a unit cracked, and so on. Keep the table small and documented in PLAN.md.
- Overall level + per-section level. Curve: level n needs about `100 × n^1.5` XP (tune it).
- Streaks per section + an overall streak (a day counts if the review was submitted and at least 2 sections were done; tune and document).
- "Never miss twice": a single missed day shows a gentle flag; two in a row breaks the streak.
- Achievements: about 25 to start (first push, 7/30/100-day streaks, first unit cracked, 1,000 chess rating, 10 workouts, first post, 10 real conversations, 5 kg gained, and so on). Show them on Home, with locked ones as silhouettes.

## 5.6 Obsidian mirror (backup)
- ONE is the source of truth. Obsidian gets a **markdown mirror**.
- Folder layout inside the chosen vault folder:
  - `ONE/Journal/YYYY-MM-DD.md` (nightly review + journal)
  - `ONE/Weekly/YYYY-Www.md` (weekly summary + grade)
  - `ONE/Career/Notes/<topic>/<title>.md`, `ONE/Career/Reading/<title>.md`
  - `ONE/Mind/Books/<book>.md`
  - `ONE/Persona/Posts/YYYY-MM-DD-<slug>.md`
- Front-matter with ids and dates. Overwrite-safe: ONE owns these files, so don't merge edits made in Obsidian (say so in the file header).
- **PWA (Chrome/Edge):** File System Access API (`showDirectoryPicker`). Persist the handle in IndexedDB and re-request permission when needed (Chrome may offer persistent permission for installed apps; use it if available).
- **iPhone:** not supported (no File System Access). Skip silently.
- **Desktop (Tauri):** direct writes, seamless.
- A **"Mirror now"** button + auto-mirror after the nightly review.

## 5.7 Command palette + shortcuts
- `Ctrl/⌘+K`: go anywhere, run actions ("log water 500", "start focus 25", "log weight 52.4", "add task …").
- Shortcuts: `g h/c/m/b/p` to switch sections, `d` to toggle the theme, `f` for focus, `n` for a note, `?` for help.

## 5.8 Focus timer
- A terminal-strip timer (`Run` / `Stop`). Presets: 25, 50, 90 (Python Block 1).
- Phone-free checkbox at the end. Logs to `focus_sessions` and the section.
- While running, the rest of ONE dims and other sections are locked (an "Exit focus" button is available).

## 5.9 Music corner
- Apple Music embed (see 11). A small collapsible player in the rail/dock corner. Persists across route changes (mount once at the app root).
